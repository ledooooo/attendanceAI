import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import {
    Lock, Volume2, VolumeX, HelpCircle, Clock, Star, Loader2, AlertCircle,
    CheckCircle, XCircle, Sparkles, X, Globe, BookOpen, RotateCw, Settings,
    Zap, Shield, FileText, Languages
} from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

// ===================================================================
// TYPES & INTERFACES
// ===================================================================

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
    employee?: any;
}

// Question configuration interface
interface QuestionConfig {
    specialty: string;
    language: 'ar' | 'en' | 'both';
    difficulty: 'very_easy' | 'easy' | 'medium' | 'hard' | 'very_hard';
    question_length: 'very_short' | 'short' | 'medium' | 'long';
    has_hint: boolean;
    question_type: 'text' | 'image' | 'both';
    medical_approval_required: boolean;
}

interface Question {
    question: string;
    options: string[];
    correct_answer: string;
    explanation?: string;
    hint?: string;
    image_url?: string;
    source: 'ai' | 'local';
    provider: string;
    difficulty: string;
    specialty: string;
    language: string;
    is_medical_approved: boolean;
    topic?: string;
}

// ===================================================================
// SPECIALTIES LIST (Primary Healthcare Sector)
// ===================================================================

const SPECIALTIES_LIST = [
    { key: 'الكل', label: 'الكل', labelEn: 'All' },
    { key: 'طبيب أسنان', label: 'طبيب أسنان', labelEn: 'Dentist' },
    { key: 'طبيب بشرى', label: 'طبيب بشرى', labelEn: 'Family Medicine' },
    { key: 'مراقب صحى', label: 'مراقب صحى', labelEn: 'Public Health' },
    { key: 'فنى اسنان', label: 'فنى أسنان', labelEn: 'Dental Tech' },
    { key: 'إدارى', label: 'إدارى', labelEn: 'Admin' },
    { key: 'رائدة ريفية', label: 'رائدة ريفية', labelEn: 'Rural Health' },
    { key: 'فنى معمل', label: 'فنى معمل', labelEn: 'Lab Technician' },
    { key: 'تمريض', label: 'تمريض', labelEn: 'Nursing' },
    { key: 'علاج طبيعى', label: 'علاج طبيعى', labelEn: 'Physical Therapy' },
    { key: 'صيدلة', label: 'صيدلة', labelEn: 'Pharmacy' },
    { key: 'كاتب', label: 'كاتب', labelEn: 'Secretary' },
    { key: 'فنى احصاء', label: 'فنى إحصاء', labelEn: 'Statistics' },
    { key: 'معاون', label: 'معاون', labelEn: 'Assistant' },
];

// ===================================================================
// DIFFICULTY OPTIONS
// ===================================================================

const DIFFICULTY_OPTIONS = [
    { key: 'very_easy', label: 'سهل جداً', labelEn: 'Very Easy', points: 5, time: 10, color: 'emerald' },
    { key: 'easy', label: 'سهل', labelEn: 'Easy', points: 8, time: 12, color: 'green' },
    { key: 'medium', label: 'متوسط', labelEn: 'Medium', points: 12, time: 15, color: 'amber' },
    { key: 'hard', label: 'صعب', labelEn: 'Hard', points: 18, time: 20, color: 'orange' },
    { key: 'very_hard', label: 'صعب جداً', labelEn: 'Expert', points: 25, time: 25, color: 'red' },
];

// ===================================================================
// LENGTH OPTIONS
// ===================================================================

const LENGTH_OPTIONS = [
    { key: 'very_short', label: 'قصير جداً', labelEn: 'Very Short' },
    { key: 'short', label: 'قصير', labelEn: 'Short' },
    { key: 'medium', label: 'متوسط', labelEn: 'Medium' },
    { key: 'long', label: 'طويل', labelEn: 'Long' },
];

// ===================================================================
// COMPONENTS
// ===================================================================

// Wrong Answer Reveal Modal
function WrongAnswerReveal({
    question,
    reason,
    isEnglish,
    onClose,
}: {
    question: Question;
    reason: 'wrong' | 'timeout';
    isEnglish: boolean;
    onClose: () => void;
}) {
    const isTimeout = reason === 'timeout';
    const correctAnswer = question.correct_answer;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
            dir={isEnglish ? 'ltr' : 'rtl'}
        >
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                <div className={`px-5 py-4 flex items-center justify-between ${isTimeout ? 'bg-orange-500' : 'bg-red-500'}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white/25 rounded-xl flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-white font-black text-sm leading-tight">
                                {isTimeout ? '⏰ انتهى الوقت!' : '❌ إجابة خاطئة'}
                            </p>
                            <p className="text-white/80 text-xs">{isEnglish ? 'Learning moment' : 'لحظة تعلّم 📚'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition">
                        <X className="w-4 h-4 text-white" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1.5">
                            {isEnglish ? 'Question' : 'السؤال'}
                        </p>
                        <p className="text-gray-800 font-semibold text-sm leading-relaxed">
                            {question.question}
                        </p>
                    </div>
                    <div className="bg-emerald-50 rounded-2xl p-4 border-2 border-emerald-300">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                            <p className="text-[11px] font-black text-emerald-600 uppercase tracking-wider">
                                {isEnglish ? 'Correct Answer' : 'الإجابة الصحيحة'}
                            </p>
                        </div>
                        <p className="text-emerald-800 font-black text-lg leading-snug">
                            {correctAnswer}
                        </p>
                    </div>
                    {question.explanation && (
                        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                            <div className="flex items-center gap-2 mb-1.5">
                                <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                <p className="text-[11px] font-black text-amber-600 uppercase tracking-wider">
                                    {isEnglish ? 'Explanation' : 'الشرح'}
                                </p>
                            </div>
                            <p className="text-amber-900 text-sm leading-relaxed">
                                {question.explanation}
                            </p>
                        </div>
                    )}
                    {question.hint && !isTimeout && (
                        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
                            <div className="flex items-center gap-2 mb-1.5">
                                <HelpCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                <p className="text-[11px] font-black text-blue-600 uppercase tracking-wider">
                                    {isEnglish ? 'Hint (for next time)' : 'تلميح (للمرّة القادمة)'}
                                </p>
                            </div>
                            <p className="text-blue-900 text-sm leading-relaxed">
                                {question.hint}
                            </p>
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-2xl font-black text-sm shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <RotateCw className="w-4 h-4" />
                        {isEnglish ? 'Continue' : 'استمرار'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Settings Panel Component
function SettingsPanel({
    config,
    setConfig,
    onClose,
    isEnglish
}: {
    config: QuestionConfig;
    setConfig: React.Dispatch<React.SetStateAction<QuestionConfig>>;
    onClose: () => void;
    isEnglish: boolean;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95" dir={isEnglish ? 'ltr' : 'rtl'}>
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white/25 rounded-xl flex items-center justify-center">
                            <Settings className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-white font-black text-sm">{isEnglish ? 'Question Settings' : 'إعدادات الأسئلة'}</p>
                            <p className="text-white/80 text-xs">{isEnglish ? 'Customize your experience' : 'خصص تجربتك'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition">
                        <X className="w-4 h-4 text-white" />
                    </button>
                </div>
                <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
                    {/* Specialty */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                            <FileText className="w-4 h-4 text-indigo-500" />
                            {isEnglish ? 'Specialty' : 'التخصص'}
                        </label>
                        <select
                            value={config.specialty}
                            onChange={(e) => setConfig(prev => ({ ...prev, specialty: e.target.value }))}
                            className="w-full p-3 border-2 border-gray-200 rounded-xl font-medium focus:border-indigo-400 focus:outline-none"
                        >
                            {SPECIALTIES_LIST.map(spec => (
                                <option key={spec.key} value={spec.key}>
                                    {isEnglish ? spec.labelEn : spec.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Language */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                            <Languages className="w-4 h-4 text-indigo-500" />
                            {isEnglish ? 'Language' : 'اللغة'}
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { key: 'ar', label: '🇸🇦 عربي', labelEn: 'Arabic' },
                                { key: 'en', label: '🇬🇧 English', labelEn: 'English' },
                                { key: 'both', label: '🔄 كلاهما', labelEn: 'Both' },
                            ].map(lang => (
                                <button
                                    key={lang.key}
                                    onClick={() => setConfig(prev => ({ ...prev, language: lang.key as any }))}
                                    className={`p-3 rounded-xl font-bold text-sm transition-all ${
                                        config.language === lang.key
                                            ? 'bg-indigo-500 text-white shadow-lg'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {isEnglish ? lang.labelEn : lang.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Difficulty */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                            <Zap className="w-4 h-4 text-indigo-500" />
                            {isEnglish ? 'Difficulty' : 'مستوى الصعوبة'}
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                            {DIFFICULTY_OPTIONS.map(diff => (
                                <button
                                    key={diff.key}
                                    onClick={() => setConfig(prev => ({ ...prev, difficulty: diff.key as any }))}
                                    className={`p-2 rounded-xl font-bold text-xs transition-all ${
                                        config.difficulty === diff.key
                                            ? `bg-${diff.color}-500 text-white shadow-lg`
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {isEnglish ? diff.labelEn : diff.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Question Length */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                            <FileText className="w-4 h-4 text-indigo-500" />
                            {isEnglish ? 'Question Length' : 'طول السؤال'}
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {LENGTH_OPTIONS.map(len => (
                                <button
                                    key={len.key}
                                    onClick={() => setConfig(prev => ({ ...prev, question_length: len.key as any }))}
                                    className={`p-2 rounded-xl font-bold text-xs transition-all ${
                                        config.question_length === len.key
                                            ? 'bg-indigo-500 text-white shadow-lg'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {isEnglish ? len.labelEn : len.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Additional Options */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                            <div className="flex items-center gap-2">
                                <HelpCircle className="w-5 h-5 text-indigo-500" />
                                <span className="font-bold text-sm text-gray-700">
                                    {isEnglish ? 'Include Hints' : 'تضمين التلميحات'}
                                </span>
                            </div>
                            <button
                                onClick={() => setConfig(prev => ({ ...prev, has_hint: !prev.has_hint }))}
                                className={`w-12 h-6 rounded-full transition-all ${
                                    config.has_hint ? 'bg-indigo-500' : 'bg-gray-300'
                                }`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow transition-all ${
                                    config.has_hint ? 'translate-x-6' : 'translate-x-0.5'
                                }`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                            <div className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-red-500" />
                                <span className="font-bold text-sm text-gray-700">
                                    {isEnglish ? 'Medical Approval' : 'موافقة طبية'}
                                </span>
                            </div>
                            <button
                                onClick={() => setConfig(prev => ({ ...prev, medical_approval_required: !prev.medical_approval_required }))}
                                className={`w-12 h-6 rounded-full transition-all ${
                                    config.medical_approval_required ? 'bg-red-500' : 'bg-gray-300'
                                }`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow transition-all ${
                                    config.medical_approval_required ? 'translate-x-6' : 'translate-x-0.5'
                                }`} />
                            </button>
                        </div>
                    </div>
                </div>
                <div className="p-5 border-t">
                    <button
                        onClick={onClose}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all"
                    >
                        {isEnglish ? 'Apply Settings' : 'تطبيق الإعدادات'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ===================================================================
// MAIN COMPONENT
// ===================================================================

export default function SafeCrackerGame({ onStart, onComplete, employee }: Props) {
    // State
    const [secretCode, setSecretCode] = useState('');
    const [guesses, setGuesses] = useState<{ guess: string; feedback: string[] }[]>([]);
    const [currentGuess, setCurrentGuess] = useState('');
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const [phase, setPhase] = useState<'code' | 'difficulty' | 'question' | 'complete'>('code');
    const [bonusQuestion, setBonusQuestion] = useState<Question | null>(null);
    const [selectedDifficulty, setSelectedDifficulty] = useState<string>('medium');
    const [timeLeft, setTimeLeft] = useState(15);
    const [feedback, setFeedback] = useState<{ message: string; isCorrect: boolean } | null>(null);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [loading, setLoading] = useState(false);
    const [showWrongReveal, setShowWrongReveal] = useState(false);
    const [wrongRevealReason, setWrongRevealReason] = useState<'wrong' | 'timeout'>('wrong');
    const [showSettings, setShowSettings] = useState(false);
    const [generating, setGenerating] = useState(false);

    // Question configuration state
    const [questionConfig, setQuestionConfig] = useState<QuestionConfig>({
        specialty: employee?.specialty || 'الكل',
        language: 'ar',
        difficulty: 'medium',
        question_length: 'medium',
        has_hint: false,
        question_type: 'text',
        medical_approval_required: false,
    });

    const MAX_GUESSES = 5;
    const BASE_POINTS = 20;

    // ===================================================================
    // HELPERS
    // ===================================================================

    const getEmployeeSpecialty = useCallback(() => {
        return employee?.specialty || 'الكل';
    }, [employee]);

    const isEnglish = useMemo(() => {
        return questionConfig.language === 'en' ||
               (questionConfig.language === 'both' && ['صيدلة', 'طب', 'أسنان'].some(t => getEmployeeSpecialty().includes(t))));
    }, [questionConfig.language, getEmployeeSpecialty]);

    // Play sound effect
    const playSound = useCallback((type: 'win' | 'lose') => {
        if (!soundEnabled) return;
        try {
            const audio = new Audio(type === 'win' ? '/applause.mp3' : '/fail.mp3');
            audio.volume = 0.6;
            audio.play().catch(() => {});
        } catch {}
    }, [soundEnabled]);

    // ===================================================================
    // FETCH QUESTION FROM AI
    // ===================================================================

    const fetchQuestionWithAI = async (specialty: string, difficulty: string, lang: string): Promise<Question | null> => {
        setGenerating(true);
        try {
            const { data, error } = await supabase.functions.invoke('generate-medical-questions', {
                body: {
                    specialty: specialty,
                    language: lang,
                    difficulty: difficulty,
                    question_length: questionConfig.question_length,
                    has_hint: questionConfig.has_hint,
                    question_count: 1,
                    question_type: questionConfig.question_type,
                    medical_approval_required: questionConfig.medical_approval_required,
                },
            });

            if (error) {
                console.error('AI function error:', error);
                throw error;
            }

            if (!data?.questions?.[0]) {
                throw new Error('No questions returned');
            }

            const q = data.questions[0];
            return {
                source: q.source || 'ai',
                provider: q.provider || 'AI',
                language: q.language || lang,
                question: q.question,
                options: q.options,
                correct_answer: q.options[q.correct_index],
                explanation: q.explanation,
                hint: q.hint,
                image_url: q.image_url,
                difficulty: q.difficulty,
                specialty: q.specialty,
                is_medical_approved: q.is_medical_approved,
                topic: q.topic,
            };
        } catch (err) {
            console.warn('AI fallback to local:', err);

            // Try local database
            try {
                let query = supabase
                    .from('quiz_questions')
                    .select('*')
                    .eq('is_active', true);

                // Filter by specialty
                query = query.or(`specialty.ilike.%${specialty}%,specialty.ilike.%الكل%`);

                // Filter by difficulty if available
                if (difficulty !== 'medium') {
                    query = query.eq('difficulty', difficulty);
                }

                const { data: localData, error: localError } = await query.limit(30);

                if (localError || !localData?.length) {
                    throw new Error('No local questions');
                }

                const random = localData[Math.floor(Math.random() * localData.length)];
                let options: string[] = [];

                if (random.options) {
                    if (Array.isArray(random.options)) options = random.options;
                    else {
                        try { options = JSON.parse(random.options); }
                        catch { options = random.options.split(',').map((s: string) => s.trim()); }
                    }
                }

                let correctIndex = random.correct_index ?? 0;
                if (correctIndex === undefined || correctIndex === null) {
                    const answer = String(random.correct_answer || '').trim().toLowerCase();
                    if (answer === 'a' || answer.includes('أ')) correctIndex = 0;
                    else if (answer === 'b' || answer.includes('ب')) correctIndex = 1;
                    else if (answer === 'c' || answer.includes('ج')) correctIndex = 2;
                    else if (answer === 'd' || answer.includes('د')) correctIndex = 3;
                }

                return {
                    source: 'local',
                    provider: 'database',
                    language: random.language || lang,
                    question: random.question_text || random.question,
                    options,
                    correct_answer: options[correctIndex],
                    explanation: random.explanation,
                    hint: random.hint,
                    image_url: random.question_image,
                    difficulty: random.difficulty || difficulty,
                    specialty: random.specialty || specialty,
                    is_medical_approved: random.is_medical_approved,
                    topic: random.topic,
                };
            } catch (localErr) {
                console.error('Local fallback also failed:', localErr);
                return null;
            }
        } finally {
            setGenerating(false);
        }
    };

    // ===================================================================
    // GAME LOGIC
    // ===================================================================

    const startGame = async () => {
        setStarting(true);
        try {
            await onStart();
        } catch {
            setStarting(false);
            return;
        }
        // Generate 3-digit code (1-9, no repeats)
        let code = '';
        while (code.length < 3) {
            const r = Math.floor(Math.random() * 9) + 1;
            if (!code.includes(r.toString())) code += r;
        }
        setSecretCode(code);
        setGuesses([]);
        setCurrentGuess('');
        setIsActive(true);
        setPhase('code');
        setStarting(false);
    };

    const submitGuess = () => {
        if (currentGuess.length !== 3) {
            toast.error(isEnglish
                ? 'Please enter exactly 3 digits!'
                : 'يجب إدخال 3 أرقام فقط!', { icon: '⚠️' });
            return;
        }
        const feedbackArr: string[] = [];
        for (let i = 0; i < 3; i++) {
            if (currentGuess[i] === secretCode[i]) feedbackArr.push('green');
            else if (secretCode.includes(currentGuess[i])) feedbackArr.push('yellow');
            else feedbackArr.push('red');
        }
        const newGuesses = [...guesses, { guess: currentGuess, feedback: feedbackArr }];
        setGuesses(newGuesses);
        setCurrentGuess('');

        if (currentGuess === secretCode) {
            playSound('win');
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#10b981', '#f59e0b', '#8b5cf6'] });
            toast.success(isEnglish
                ? '🎉 Great! You cracked the safe!'
                : '🎉 أحسنت! فتحت الخزنة!', { duration: 2000 });
            setPhase('difficulty');
        } else if (newGuesses.length >= MAX_GUESSES) {
            playSound('lose');
            toast.error(isEnglish
                ? `💔 The correct code was: ${secretCode}`
                : `💔 الكود الصحيح كان: ${secretCode}`, { duration: 3000 });
            setTimeout(() => {
                onComplete(0, false);
                resetGame();
            }, 2000);
        }
    };

    const handleDifficultySelect = async (difficulty: string) => {
        setSelectedDifficulty(difficulty);
        setPhase('question');
        setLoading(true);
        try {
            const effectiveLang = questionConfig.language === 'both'
                ? (Math.random() > 0.5 ? 'ar' : 'en')
                : questionConfig.language;

            const q = await fetchQuestionWithAI(getEmployeeSpecialty(), difficulty, effectiveLang);
            if (q) {
                setBonusQuestion(q);
                const selected = DIFFICULTY_OPTIONS.find(opt => opt.key === difficulty);
                setTimeLeft(selected?.time || 15);
            } else {
                toast.error(isEnglish
                    ? 'Failed to load question'
                    : 'فشل تحميل السؤال');
                onComplete(BASE_POINTS, true);
                resetGame();
            }
        } catch (err) {
            console.error('Failed to load bonus question:', err);
            toast.error(isEnglish
                ? 'Failed to load question'
                : 'فشل تحميل السؤال');
            onComplete(BASE_POINTS, true);
            resetGame();
        } finally {
            setLoading(false);
        }
    };

    // Timer effect
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (phase === 'question' && timeLeft > 0 && bonusQuestion && !showWrongReveal && !loading) {
            timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (phase === 'question' && timeLeft === 0 && bonusQuestion && !showWrongReveal) {
            handleAnswerTimeout();
        }
        return () => clearInterval(timer);
    }, [phase, timeLeft, bonusQuestion, showWrongReveal, loading]);

    const handleAnswerTimeout = () => {
        playSound('lose');
        setFeedback({ message: isEnglish ? '⌛ Time\'s up!' : '⌛ انتهى الوقت!', isCorrect: false });
        setShowWrongReveal(true);
        setWrongRevealReason('timeout');
        onComplete(BASE_POINTS, true);
    };

    const handleBonusAnswer = (answer: string) => {
        if (phase !== 'question' || !bonusQuestion || showWrongReveal) return;
        const isCorrect = answer.trim().toLowerCase() === bonusQuestion.correct_answer.trim().toLowerCase();
        const difficultyPoints = DIFFICULTY_OPTIONS.find(opt => opt.key === selectedDifficulty)?.points || 0;
        const bonusPoints = isCorrect ? difficultyPoints : 0;
        const totalPoints = BASE_POINTS + bonusPoints;

        if (isCorrect) {
            playSound('win');
            confetti({ particleCount: 200, spread: 80, origin: { y: 0.6 }, colors: ['#10b981', '#f59e0b', '#8b5cf6'] });
            setFeedback({ message: isEnglish
                ? `✅ Correct! +${bonusPoints} bonus points`
                : `✅ إجابة صحيحة! +${bonusPoints} نقطة إضافية`, isCorrect: true });
            setTimeout(() => {
                setFeedback(null);
                setShowWrongReveal(true);
                setWrongRevealReason('wrong');
            }, 1800);
            onComplete(totalPoints, true);
        } else {
            playSound('lose');
            setFeedback({ message: isEnglish ? '❌ Wrong answer!' : '❌ إجابة خاطئة!', isCorrect: false });
            setShowWrongReveal(true);
            setWrongRevealReason('wrong');
            onComplete(totalPoints, false);
        }
    };

    const closeWrongReveal = () => {
        setShowWrongReveal(false);
        resetGame();
    };

    const resetGame = () => {
        setIsActive(false);
        setPhase('code');
        setSecretCode('');
        setGuesses([]);
        setCurrentGuess('');
        setBonusQuestion(null);
        setTimeLeft(15);
        setFeedback(null);
        setLoading(false);
        setSelectedDifficulty('medium');
        setShowWrongReveal(false);
    };

    // ===================================================================
    // RENDER HELPERS
    // ===================================================================

    const formatTime = (seconds: number) => {
        if (seconds >= 60) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        return `${seconds} ث`;
    };

    const getDifficultyColor = (key: string) => {
        const diff = DIFFICULTY_OPTIONS.find(d => d.key === key);
        return diff?.color || 'gray';
    };

    const getSourceBadge = () => {
        if (!bonusQuestion) return null;
        const isAI = bonusQuestion.source === 'ai';
        return (
            <span className={`text-[9px] ${isAI ? 'text-emerald-500' : 'text-amber-500'} bg-${isAI ? 'emerald' : 'amber'}-50 px-2 py-0.5 rounded-full flex items-center gap-0.5`}>
                {isAI ? <Sparkles className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                {isAI ? bonusQuestion.provider : (isEnglish ? 'Local' : 'محلي')}
            </span>
        );
    };

    // ===================================================================
    // RENDER
    // ===================================================================

    // Welcome Screen
    if (!isActive && !showWrongReveal && !showSettings) {
        return (
            <div className="text-center py-6 px-3">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Lock className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-black text-gray-800 mb-2">
                    {isEnglish ? 'Secret Safe! 🔐' : 'الخزنة السرية! 🔐'}
                </h3>
                <p className="text-xs font-bold text-gray-500 mb-4 max-w-xs mx-auto">
                    {isEnglish
                        ? 'Guess the 3‑digit code (digits 1‑9, no repeats) in 5 attempts using color hints.'
                        : 'خمن الرقم السري (3 أرقام مختلفة من 1‑9) في 5 محاولات فقط بناءً على تلميحات الألوان.'}
                </p>
                <div className="flex justify-center gap-4 mb-6">
                    {[
                        ['bg-emerald-500', isEnglish ? 'Correct\nPosition' : 'رقم صحيح\nمكان صحيح'],
                        ['bg-amber-500', isEnglish ? 'Wrong\nPosition' : 'رقم صحيح\nمكان خطأ'],
                        ['bg-red-500', isEnglish ? 'Not\nPresent' : 'رقم غير\nموجود'],
                    ].map(([color, label], i) => (
                        <div key={i} className="text-center">
                            <div className={`w-10 h-10 ${color} rounded-xl mb-1 shadow-md`}></div>
                            <p className="text-[10px] font-bold text-gray-600 whitespace-pre-line">{label}</p>
                        </div>
                    ))}
                </div>
                <div className="flex justify-center gap-2 mb-4">
                    <button
                        onClick={() => setShowSettings(true)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-black hover:bg-indigo-200 transition"
                    >
                        <Settings className="w-3 h-3" />
                        {isEnglish ? 'Settings' : 'الإعدادات'}
                    </button>
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="p-1.5 rounded-lg hover:bg-gray-100"
                    >
                        {soundEnabled ? <Volume2 className="w-4 h-4 text-gray-600" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                    </button>
                </div>
                <button
                    onClick={startGame}
                    disabled={starting}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-xl font-black shadow-lg hover:scale-105 transition-all disabled:opacity-50 text-sm"
                >
                    {starting ? (isEnglish ? '⏳ Starting...' : '⏳ جاري البدء...') : (isEnglish ? '🔓 Start Game' : '🔓 ابدأ المحاولة')}
                </button>
            </div>
        );
    }

    // Code Guessing Phase
    if (phase === 'code' && !showWrongReveal) {
        return (
            <div className="max-w-xl mx-auto py-4 px-3 animate-in slide-in-from-bottom-4 text-center">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-2">
                        <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-full hover:bg-gray-100">
                            {soundEnabled ? <Volume2 className="w-4 h-4 text-gray-600" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                        </button>
                        <button onClick={() => setShowSettings(true)} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-[10px] font-black">
                            <Settings className="w-3 h-3" />
                            {isEnglish ? 'Settings' : 'إعدادات'}
                        </button>
                    </div>
                    <div className="bg-indigo-50 rounded-xl px-3 py-1 text-center">
                        <p className="text-[10px] font-bold text-indigo-700">{isEnglish ? 'Safe Points' : 'نقاط الخزنة'}</p>
                        <p className="text-base font-black text-indigo-800">+{BASE_POINTS}</p>
                    </div>
                </div>
                <div className="flex items-center justify-center gap-2 mb-5">
                    <Lock className="w-8 h-8 text-emerald-600" />
                    <h3 className="text-xl font-black text-gray-800">{isEnglish ? 'Crack the Safe!' : 'اكسر الخزنة!'}</h3>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-3 rounded-2xl mb-6 border border-emerald-200">
                    <p className="text-xs font-bold text-gray-700 mb-2">
                        {isEnglish ? 'Remaining attempts:' : 'المحاولات المتبقية:'} <span className="text-xl text-emerald-600 font-black">{MAX_GUESSES - guesses.length}</span>
                    </p>
                    <div className="flex justify-center gap-3 text-[10px] font-bold">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded"></div> {isEnglish ? 'Correct' : 'صح'}</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-500 rounded"></div> {isEnglish ? 'Wrong Position' : 'مكان خطأ'}</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded"></div> {isEnglish ? 'Not Present' : 'غير موجود'}</div>
                    </div>
                </div>
                <div className="space-y-3 mb-8">
                    {guesses.map((g, i) => (
                        <div key={i} className="flex justify-center gap-2 animate-in slide-in-from-right" dir="ltr">
                            {g.guess.split('').map((num, idx) => (
                                <div
                                    key={idx}
                                    className={`w-12 h-12 flex items-center justify-center text-xl font-black text-white rounded-xl shadow-md ${
                                        g.feedback[idx] === 'green'
                                            ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
                                            : g.feedback[idx] === 'yellow'
                                            ? 'bg-gradient-to-br from-amber-400 to-amber-600'
                                            : 'bg-gradient-to-br from-red-400 to-red-600'
                                    }`}
                                >
                                    {num}
                                </div>
                            ))}
                        </div>
                    ))}
                    {[...Array(MAX_GUESSES - guesses.length)].map((_, i) => (
                        <div key={i} className="flex justify-center gap-2 opacity-30" dir="ltr">
                            {[1, 2, 3].map(n => <div key={n} className="w-12 h-12 bg-gray-300 rounded-xl"></div>)}
                        </div>
                    ))}
                </div>
                {guesses.length < MAX_GUESSES && (
                    <div className="flex gap-2 justify-center items-stretch" dir="ltr">
                        <input
                            type="number"
                            maxLength={3}
                            value={currentGuess}
                            onChange={e => setCurrentGuess(e.target.value.slice(0, 3))}
                            onKeyDown={e => e.key === 'Enter' && submitGuess()}
                            className="w-36 text-center text-2xl font-black p-2 bg-gray-50 border-2 border-emerald-300 focus:border-emerald-500 outline-none rounded-xl shadow"
                            placeholder="***"
                            autoFocus
                        />
                        <button
                            onClick={submitGuess}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 rounded-xl font-black text-sm shadow-md hover:scale-105 active:scale-95 transition-all"
                        >
                            {isEnglish ? 'Guess ✨' : 'جرب ✨'}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Difficulty Selection Phase
    if (phase === 'difficulty' && !showWrongReveal) {
        return (
            <div className="text-center py-6 px-3 animate-in fade-in duration-300" dir="rtl">
                <div className="bg-white rounded-2xl shadow-lg p-5 max-w-md mx-auto">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex gap-2">
                            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-full hover:bg-gray-100">
                                {soundEnabled ? <Volume2 className="w-4 h-4 text-gray-600" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                            </button>
                            <button onClick={() => setShowSettings(true)} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-[10px] font-black">
                                <Settings className="w-3 h-3" />
                                {isEnglish ? 'Settings' : 'إعدادات'}
                            </button>
                        </div>
                        <div className="bg-emerald-50 rounded-xl px-3 py-1 text-center">
                            <p className="text-[10px] font-bold text-emerald-700">{isEnglish ? 'Safe Points' : 'نقاط الخزنة'}</p>
                            <p className="text-base font-black text-emerald-800">+{BASE_POINTS}</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-1 mb-4">
                        <Sparkles className="w-6 h-6 text-emerald-500" />
                        <h3 className="text-lg font-black text-gray-800">{isEnglish ? 'Select Question Difficulty' : 'اختر مستوى السؤال'}</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">
                        {isEnglish ? 'Higher difficulty = more bonus points' : 'كلما زادت الصعوبة، زادت النقاط الإضافية'}
                    </p>
                    <div className="grid grid-cols-2 gap-2 mb-5">
                        {DIFFICULTY_OPTIONS.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => handleDifficultySelect(opt.key)}
                                disabled={generating}
                                className={`p-3 rounded-xl border-2 transition-all ${
                                    selectedDifficulty === opt.key
                                        ? `border-${opt.color}-500 bg-${opt.color}-50 shadow-md`
                                        : 'border-gray-200 hover:border-gray-300'
                                } ${generating ? 'opacity-50' : ''}`}
                            >
                                <p className="font-black text-gray-800 text-sm">{isEnglish ? opt.labelEn : opt.label}</p>
                                <p className="text-xs font-bold text-emerald-600">+{opt.points} {isEnglish ? 'pts' : 'نقطة'}</p>
                                <p className="text-[9px] text-gray-400">{opt.time}s {isEnglish ? 'to answer' : 'للإجابة'}</p>
                            </button>
                        ))}
                    </div>
                    {generating && (
                        <div className="flex items-center justify-center gap-2 text-indigo-600">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-sm font-bold">{isEnglish ? 'Generating question...' : 'جاري توليد السؤال...'}</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Question Phase
    if (phase === 'question' && bonusQuestion && !showWrongReveal) {
        const options = Array.isArray(bonusQuestion.options) ? bonusQuestion.options : [];
        const selectedOpt = DIFFICULTY_OPTIONS.find(opt => opt.key === selectedDifficulty);
        const timeDisplay = formatTime(timeLeft);

        return (
            <>
                <div className="text-center py-3 animate-in slide-in-from-right max-w-3xl mx-auto" dir={bonusQuestion.language === 'en' ? 'ltr' : 'rtl'}>
                    <div className="flex justify-between items-center mb-4 px-3 flex-wrap gap-1">
                        <div className={`bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-1.5 rounded-xl font-black text-xs shadow-lg flex items-center gap-1 ${loading ? 'animate-pulse' : ''}`}>
                            <Clock className="w-3 h-3" /> {timeDisplay}
                        </div>
                        <div className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-3 py-1.5 rounded-xl font-black text-xs shadow-lg flex items-center gap-1">
                            <Star className="w-3 h-3" /> {isEnglish ? 'Bonus:' : 'مكافأة:'} +{selectedOpt?.points || 0} {isEnglish ? 'pts' : 'نقطة'}
                        </div>
                        <div className={`bg-gradient-to-r ${
                            selectedDifficulty === 'very_easy' || selectedDifficulty === 'easy' ? 'from-emerald-500 to-teal-600' :
                            selectedDifficulty === 'medium' ? 'from-amber-500 to-orange-500' :
                            'from-red-500 to-rose-600'
                        } text-white px-3 py-1.5 rounded-xl font-black text-xs shadow-lg flex items-center gap-1`}>
                            <Sparkles className="w-3 h-3" /> {selectedOpt ? (isEnglish ? selectedOpt.labelEn : selectedOpt.label) : ''}
                        </div>
                    </div>

                    {loading ? (
                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-8 rounded-2xl border border-emerald-200 shadow-sm">
                            <Loader2 className="w-12 h-12 text-emerald-500 mx-auto mb-4 animate-spin" />
                            <p className="text-emerald-700 font-bold">{isEnglish ? 'Generating question...' : 'جاري توليد السؤال...'}</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-5 rounded-2xl mb-6 border border-emerald-200 shadow-sm relative">
                                <HelpCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3 animate-bounce" />
                                <h3 className={`text-base font-black text-emerald-900 leading-relaxed ${bonusQuestion.language === 'en' ? 'text-left' : 'text-right'}`}>
                                    {bonusQuestion.question}
                                </h3>

                                {/* Question Image */}
                                {bonusQuestion.image_url && (
                                    <div className="mt-4">
                                        <img
                                            src={bonusQuestion.image_url}
                                            alt="Question"
                                            className="max-w-full h-auto rounded-xl shadow-md"
                                        />
                                    </div>
                                )}

                                {/* Hint */}
                                {bonusQuestion.hint && (
                                    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <HelpCircle className="w-4 h-4 text-blue-500" />
                                            <span className="text-xs font-bold text-blue-600">{isEnglish ? 'Hint' : 'تلميح'}</span>
                                        </div>
                                        <p className="text-sm text-blue-800">{bonusQuestion.hint}</p>
                                    </div>
                                )}

                                <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                                    {getSourceBadge()}
                                    {bonusQuestion.topic && (
                                        <span className="text-[9px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                                            {bonusQuestion.topic}
                                        </span>
                                    )}
                                    {bonusQuestion.is_medical_approved && (
                                        <span className="text-[9px] text-red-500 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                            <Shield className="w-2.5 h-2.5" /> {isEnglish ? 'Verified' : 'موثق'}
                                        </span>
                                    )}
                                </div>
                                {feedback && (
                                    <div className={`absolute inset-0 flex items-center justify-center rounded-2xl backdrop-blur-sm animate-in fade-in zoom-in duration-200 ${
                                        feedback.isCorrect ? 'bg-green-100/90' : 'bg-red-100/90'
                                    }`}>
                                        <div className="text-center p-3 rounded-xl bg-white shadow">
                                            {feedback.isCorrect ? <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-1" /> : <XCircle className="w-8 h-8 text-red-500 mx-auto mb-1" />}
                                            <p className={`text-sm font-black ${feedback.isCorrect ? 'text-green-700' : 'text-red-700'}`}>{feedback.message}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {options.map((opt: string, idx: number) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleBonusAnswer(opt)}
                                        disabled={!!feedback}
                                        className="bg-white border border-gray-200 p-3 rounded-xl font-bold text-sm text-gray-800 hover:border-emerald-400 hover:bg-emerald-50 hover:scale-105 transition-all active:scale-95 shadow-sm text-right"
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </>
        );
    }

    // Wrong Answer Reveal Modal
    if (showWrongReveal && bonusQuestion) {
        return (
            <WrongAnswerReveal
                question={bonusQuestion}
                reason={wrongRevealReason}
                isEnglish={bonusQuestion.language === 'en'}
                onClose={closeWrongReveal}
            />
        );
    }

    // Settings Modal
    if (showSettings) {
        return (
            <SettingsPanel
                config={questionConfig}
                setConfig={setQuestionConfig}
                onClose={() => setShowSettings(false)}
                isEnglish={isEnglish}
            />
        );
    }

    return null;
}
