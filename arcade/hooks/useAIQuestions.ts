// ===================================================================
// CUSTOM HOOK: useAIQuestions
// ===================================================================
// Hook for fetching questions from AI with local fallback
// ===================================================================

import { useState, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { Question, QuestionConfig, DEFAULT_QUESTION_CONFIG, isMedicalSpecialty } from '../types';

// ===================================================================
// HOOK INTERFACE
// ===================================================================

interface UseAIQuestionsOptions {
    config?: Partial<QuestionConfig>;
    autoFetch?: boolean;
    fallbackSpecialty?: string;
}

interface UseAIQuestionsReturn {
    questions: Question[];
    loading: boolean;
    error: string | null;
    fetchQuestions: (config?: Partial<QuestionConfig>) => Promise<Question[]>;
    fetchSingleQuestion: (config?: Partial<QuestionConfig>) => Promise<Question | null>;
    isEnglish: boolean;
}

// ===================================================================
// HOOK IMPLEMENTATION
// ===================================================================

export function useAIQuestions(options: UseAIQuestionsOptions = {}): UseAIQuestionsReturn {
    const { autoFetch = false, fallbackSpecialty = 'الكل' } = options;
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(autoFetch);
    const [error, setError] = useState<string | null>(null);

    // Determine if medical specialty (needs English)
    const isEnglish = useCallback((config: QuestionConfig): boolean => {
        if (config.language === 'en') return true;
        if (config.language === 'both') {
            return isMedicalSpecialty(config.specialty);
        }
        return false;
    }, []);

    // Fetch questions from AI function
    const fetchQuestionsFromAI = useCallback(async (config: QuestionConfig): Promise<Question[]> => {
        try {
            const { data, error: funcError } = await supabase.functions.invoke('generate-medical-questions', {
                body: {
                    specialty: config.specialty || fallbackSpecialty,
                    language: config.language,
                    difficulty: config.difficulty,
                    question_length: config.question_length,
                    has_hint: config.has_hint,
                    question_count: config.question_count || 5,
                    question_type: config.question_type,
                    medical_approval_required: config.medical_approval_required,
                    exclude_topics: config.exclude_topics,
                    include_topics: config.include_topics,
                },
            });

            if (funcError) {
                console.error('AI function error:', funcError);
                throw funcError;
            }

            if (!data?.questions?.length) {
                throw new Error('No questions returned from AI');
            }

            return data.questions.map((q: any) => ({
                source: q.source || 'ai',
                provider: q.provider || 'AI',
                language: q.language || config.language,
                question: q.question,
                options: q.options,
                correct_index: q.correct_index,
                correct_answer: q.options?.[q.correct_index],
                explanation: q.explanation,
                hint: q.hint,
                image_url: q.image_url,
                difficulty: q.difficulty || config.difficulty,
                specialty: q.specialty || config.specialty,
                is_medical_approved: q.is_medical_approved,
                topic: q.topic,
                references: q.references,
                created_at: q.created_at,
            }));
        } catch (err) {
            console.warn('AI fetch failed, falling back to local:', err);
            return [];
        }
    }, [fallbackSpecialty]);

    // Fetch questions from local database
    const fetchQuestionsFromLocal = useCallback(async (config: QuestionConfig): Promise<Question[]> => {
        try {
            let query = supabase
                .from('quiz_questions')
                .select('*')
                .eq('is_active', true)
                .limit(50);

            // Filter by specialty
            const specTerms = [config.specialty, 'الكل', 'الكل'].filter(Boolean);
            const specFilters = specTerms.map(s => `specialty.ilike.%${s}%`).join(',');
            query = query.or(specFilters);

            // Filter by difficulty if specified
            if (config.difficulty && config.difficulty !== 'medium') {
                query = query.eq('difficulty', config.difficulty);
            }

            // Filter by language
            if (config.language === 'ar') {
                query = query.or('language.eq.ar,language.eq.both,language.is.null');
            } else if (config.language === 'en') {
                query = query.or('language.eq.en,language.eq.both');
            }

            const { data, error: dbError } = await query;

            if (dbError) {
                console.error('Local DB error:', dbError);
                return [];
            }

            if (!data?.length) return [];

            // Shuffle and transform data
            const shuffled = data.sort(() => Math.random() - 0.5);
            const limit = config.question_count || 5;

            return shuffled.slice(0, limit).map((q: any) => {
                let options: string[] = [];
                if (q.options) {
                    if (Array.isArray(q.options)) options = q.options;
                    else {
                        try { options = JSON.parse(q.options); }
                        catch { options = String(q.options).split(',').map((s: string) => s.trim()); }
                    }
                }

                let correctIndex = q.correct_index ?? 0;
                if (correctIndex === undefined || correctIndex === null) {
                    const answer = String(q.correct_answer || '').trim().toLowerCase();
                    if (answer === 'a' || answer.includes('أ')) correctIndex = 0;
                    else if (answer === 'b' || answer.includes('ب')) correctIndex = 1;
                    else if (answer === 'c' || answer.includes('ج')) correctIndex = 2;
                    else if (answer === 'd' || answer.includes('د')) correctIndex = 3;
                }

                return {
                    source: 'local' as const,
                    provider: 'database',
                    language: q.language || config.language,
                    question: q.question_text || q.question,
                    options,
                    correct_index: correctIndex,
                    correct_answer: options[correctIndex],
                    explanation: q.explanation,
                    hint: q.hint,
                    image_url: q.question_image,
                    difficulty: q.difficulty || config.difficulty,
                    specialty: q.specialty || config.specialty,
                    is_medical_approved: q.is_medical_approved,
                    topic: q.topic,
                    references: q.references_list || [],
                    created_at: q.created_at,
                };
            });
        } catch (err) {
            console.error('Local fetch error:', err);
            return [];
        }
    }, []);

    // Main fetch function
    const fetchQuestions = useCallback(async (config?: Partial<QuestionConfig>): Promise<Question[]> => {
        setLoading(true);
        setError(null);

        try {
            const fullConfig: QuestionConfig = {
                ...DEFAULT_QUESTION_CONFIG,
                ...options.config,
                ...config,
            };

            // Try AI first
            let fetchedQuestions = await fetchQuestionsFromAI(fullConfig);

            // Fallback to local if AI failed
            if (fetchedQuestions.length === 0) {
                fetchedQuestions = await fetchQuestionsFromLocal(fullConfig);
            }

            if (fetchedQuestions.length === 0) {
                setError('No questions available');
            }

            setQuestions(fetchedQuestions);
            return fetchedQuestions;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to fetch questions';
            setError(errorMsg);
            console.error('Fetch questions error:', err);
            return [];
        } finally {
            setLoading(false);
        }
    }, [options.config, fetchQuestionsFromAI, fetchQuestionsFromLocal]);

    // Fetch single question
    const fetchSingleQuestion = useCallback(async (config?: Partial<QuestionConfig>): Promise<Question | null> => {
        const questions = await fetchQuestions({ ...config, question_count: 1 });
        return questions.length > 0 ? questions[0] : null;
    }, [fetchQuestions]);

    return {
        questions,
        loading,
        error,
        fetchQuestions,
        fetchSingleQuestion,
        isEnglish: isEnglish({ ...DEFAULT_QUESTION_CONFIG, ...options.config }),
    };
}

// ===================================================================
// UTILITY: Direct API call without hook
// ===================================================================

export async function fetchQuestionsDirect(
    supabaseClient: any,
    config: QuestionConfig
): Promise<Question[]> {
    try {
        const { data, error } = await supabaseClient.functions.invoke('generate-medical-questions', {
            body: config,
        });

        if (error || !data?.questions?.length) {
            throw new Error(error?.message || 'No questions returned');
        }

        return data.questions.map((q: any) => ({
            source: q.source || 'ai',
            provider: q.provider || 'AI',
            language: q.language || config.language,
            question: q.question,
            options: q.options,
            correct_index: q.correct_index,
            correct_answer: q.options?.[q.correct_index],
            explanation: q.explanation,
            hint: q.hint,
            image_url: q.image_url,
            difficulty: q.difficulty || config.difficulty,
            specialty: q.specialty || config.specialty,
            is_medical_approved: q.is_medical_approved,
            topic: q.topic,
            references: q.references,
            created_at: q.created_at,
        }));
    } catch (err) {
        console.error('Direct fetch error:', err);
        return [];
    }
}

// ===================================================================
// UTILITY: Track question usage
// ===================================================================

export async function trackQuestionUsage(
    supabaseClient: any,
    questionId: number,
    isCorrect: boolean
): Promise<void> {
    try {
        await supabaseClient.rpc('track_question_accuracy', {
            p_question_id: questionId,
            p_is_correct: isCorrect,
        });
    } catch (err) {
        console.error('Track usage error:', err);
    }
}

// ===================================================================
// UTILITY: Save AI generated question to database
// ===================================================================

export async function saveQuestionToDatabase(
    supabaseClient: any,
    question: Question
): Promise<number | null> {
    try {
        const { data, error } = await supabaseClient
            .from('quiz_questions')
            .insert({
                question_text: question.question,
                question_image: question.image_url,
                options: question.options,
                correct_answer: question.correct_answer,
                correct_index: question.correct_index,
                explanation: question.explanation,
                hint: question.hint,
                difficulty: question.difficulty,
                specialty: question.specialty,
                language: question.language,
                topic: question.topic,
                source: question.source,
                provider: question.provider,
                is_medical_approved: question.is_medical_approved,
                references_list: question.references || [],
                is_active: true,
            })
            .select('id')
            .single();

        if (error) {
            console.error('Save question error:', error);
            return null;
        }

        return data.id;
    } catch (err) {
        console.error('Save question error:', err);
        return null;
    }
}
