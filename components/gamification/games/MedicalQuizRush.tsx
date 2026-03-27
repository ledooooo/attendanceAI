import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Brain, CheckCircle, XCircle, Sparkles, Globe, Loader2, AlertCircle, Volume2, VolumeX, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { Employee } from '../../../types';
import { DiffProfile, applyMultiplier } from '../../../features/staff/components/arcade/types';

interface Props {
    employee: Employee;
    diffProfile: DiffProfile;
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

type Category = 'medical' | 'technical' | 'scientific' | 'mathematical' | 'intelligence' | 'random';

const CATEGORY_OPTIONS: { value: Category; label: string; labelEn: string }[] = [
    { value: 'medical', label: 'طبى', labelEn: 'Medical' },
    { value: 'technical', label: 'فنى', labelEn: 'Technical' },
    { value: 'scientific', label: 'علمى', labelEn: 'Scientific' },
    { value: 'mathematical', label: 'رياضى', labelEn: 'Mathematical' },
    { value: 'intelligence', label: 'ذكاء', labelEn: 'Intelligence' },
    { value: 'random', label: 'عشوائى', labelEn: 'Random' },
];

interface GeneratedQuestion {
    question: string;
    options: string[];
    correct: number;
    explanation?: string;
    topic?: string;
    source: 'ai' | 'local';
    provider?: string;
    language?: string;
    category?: Category;
}

// دالة حفظ السؤال في بنك الأسئلة المحلي
async function saveQuestionToBank(question: GeneratedQuestion, category: Category) {
    try {
        const { error } = await supabase
            .from('quiz_questions')
            .insert({
                question_text: question.question,
                option_a: question.options[0],
                option_b: question.options[1],
                option_c: question.options[2],
                option_d: question.options[3],
                correct_index: question.correct,
                correct_answer: String.fromCharCode(65 + question.correct),
                explanation: question.explanation,
                specialty: category, // تخزين المجال
                difficulty: 'medium',
                language: question.language || 'ar',
                is_active: true,
                source: 'ai_generated',
            });
        if (error) console.warn('Failed to save question to bank:', error);
    } catch (err) {
        console.warn('Error saving question:', err);
    }
}

// دالة جلب سؤال واحد من AI (يدعم المجال)
async function fetchSingleQuestion(category: Category, language?: string): Promise<GeneratedQuestion> {
    // تحويل المجال إلى نص للـ AI
    const categoryMap: Record<Category, string> = {
        medical: 'طبية',
        technical: 'تقنية (فنية)',
        scientific: 'علمية',
        mathematical: 'رياضيات',
        intelligence: 'ذكاء عام',
        random: '',
    };
    const categoryPrompt = category === 'random' ? '' : categoryMap[category];
    const level = 6; // مستوى متوسط

    try {
        // إرسال طلب إلى Edge Function مع إضافة category
        const { data, error } = await supabase.functions.invoke('generate-beast-question', {
            body: {
                specialty: categoryPrompt || 'أسئلة عامة',
                level,
                usedTopics: [],
                language,
                category, // نمرر المجال للمساعدة في تحديد النوع
            },
        });
        
        if (error || !data) throw new Error('AI request failed');
        if (data.error) throw new Error(data.error);
        if (!data.question || !data.options || data.correct === undefined) throw new Error('Invalid format');
        
        const question: GeneratedQuestion = {
            source: 'ai',
            provider: data.provider || 'AI',
            language: data.language || language || 'ar',
            question: data.question,
            options: data.options,
            correct: data.correct,
            explanation: data.explanation,
            topic: data.topic,
            category,
        };
        
        // حفظ السؤال في بنك الأسئلة (اختياري)
        saveQuestionToBank(question, category).catch(console.warn);
        
        return question;
    } catch (err) {
        console.warn('AI fallback:', err);
        
        // الرجوع إلى بنك الأسئلة المحلي (يمكن أن يحتوي أسئلة حسب المجال لاحقاً)
        const { data: localQuestions } = await supabase
            .from('quiz_questions')
            .select('*')
            .or(`specialty.ilike.%${category}%,specialty.ilike.%الكل%`)
            .eq('language', language || 'ar')
            .limit(30);
        
        if (!localQuestions?.length) throw new Error('No questions available');
        
        const random = localQuestions[Math.floor(Math.random() * localQuestions.length)];
        let options: string[] = [];
        if (random.options) {
            if (Array.isArray(random.options)) options = random.options;
            else try { options = JSON.parse(random.options); } catch { options = random.options.split(',').map(s => s.trim()); }
        }
        
        let correct = random.correct_index;
        if (correct === undefined || correct === null) {
            const letter = String(random.correct_answer || '').trim().toLowerCase();
            if (letter === 'a') correct = 0;
            else if (letter === 'b') correct = 1;
            else if (letter === 'c') correct = 2;
            else if (letter === 'd') correct = 3;
            else correct = 0;
        }
        
        return {
            source: 'local',
            language: random.language || 'ar',
            question: random.question_text,
            options,
            correct,
            category,
        };
    }
}

export default function MedicalQuizRush({ employee, diffProfile, onStart, onComplete }: Props) {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(75); // 75 ثانية = 15 ث لكل سؤال × 5
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [language, setLanguage] = useState<'auto' | 'ar' | 'en'>('auto');
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<Category>('medical');
    const [categoryLocked, setCategoryLocked] = useState(false); // لمنع التغيير بعد بدء اللعبة
    
    const QUESTION_COUNT = 5;
    const BASE_TIME = 75; // 75 ثانية للأسئلة الخمسة (15 ثانية لكل سؤال في المتوسط)
    const POINTS_PER_CORRECT = 5;
    const BONUS_ALL_CORRECT = 15;

    // تحديد التخصصات التي تحتاج إنجليزية طبية (للتخصصات الطبية فقط)
    const needsMedicalEnglish = useCallback(() => {
        if (selectedCategory !== 'medical') return false;
        const specialty = employee.specialty?.toLowerCase() || '';
        const medicalEnglishSpecialties = [
            'بشر', 'بشري', 'طبيب', 'طب',
            'صيدلة', 'صيدلي', 'pharmacy',
            'أسنان', 'اسنان', 'dentistry', 'dental',
            'معمل', 'مختبر', 'laboratory',
            'أشعة', 'radiology',
            'تخدير', 'anesthesia',
        ];
        return medicalEnglishSpecialties.some(s => specialty.includes(s));
    }, [employee.specialty, selectedCategory]);

    // الحصول على اللغة الفعلية
    const getEffectiveLanguage = useCallback((): 'ar' | 'en' => {
        if (language === 'ar') return 'ar';
        if (language === 'en') return 'en';
        return needsMedicalEnglish() ? 'en' : 'ar';
    }, [language, needsMedicalEnglish]);

    // تشغيل الصوت
    const playSound = useCallback((type: 'win' | 'lose') => {
        if (!soundEnabled) return;
        try {
            const audio = new Audio(type === 'win' ? '/applause.mp3' : '/fail.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => {});
        } catch {}
    }, [soundEnabled]);

    // جلب مجموعة أسئلة حسب المجال
    const generateQuestionSet = async () => {
        setLoadingQuestions(true);
        const effectiveLang = getEffectiveLanguage();
        const generated: GeneratedQuestion[] = [];
        
        for (let i = 0; i < QUESTION_COUNT; i++) {
            try {
                const q = await fetchSingleQuestion(selectedCategory, effectiveLang);
                generated.push(q);
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (err) {
                console.error(`Failed to generate question ${i + 1}:`, err);
                // محاولة جلب سؤال احتياطي (محلي)
                try {
                    const fallback = await fetchSingleQuestion('random', effectiveLang);
                    generated.push(fallback);
                } catch {
                    throw new Error('Failed to generate questions');
                }
            }
        }
        
        setQuestions(generated);
        setLoadingQuestions(false);
        return generated;
    };

    const startGame = async () => {
        setStarting(true);
        try {
            await onStart();
            await generateQuestionSet();
        } catch (err) {
            toast.error(getEffectiveLanguage() === 'en' ? 'Failed to load questions. Please try again.' : 'فشل تحميل الأسئلة، حاول مرة أخرى');
            setStarting(false);
            return;
        }
        setCurrentQuestion(0);
        setScore(0);
        setTimeLeft(BASE_TIME);
        setSelectedAnswer(null);
        setShowFeedback(false);
        setIsActive(true);
        setStarting(false);
        setCategoryLocked(true);
    };

    // المؤقت
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (isActive && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (isActive && timeLeft === 0) {
            setIsActive(false);
            playSound('lose');
            toast.error(getEffectiveLanguage() === 'en' ? "Time's up!" : 'انتهى الوقت!');
            onComplete(0, false);
        }
        return () => clearInterval(timer);
    }, [isActive, timeLeft, onComplete, playSound]);

    const handleAnswer = (answerIndex: number) => {
        if (showFeedback || !questions[currentQuestion]) return;
        setSelectedAnswer(answerIndex);
        setShowFeedback(true);
        const isCorrect = answerIndex === questions[currentQuestion].correct;
        
        if (isCorrect) {
            setScore(prev => prev + 1);
        }
        
        setTimeout(() => {
            if (currentQuestion < questions.length - 1) {
                setCurrentQuestion(prev => prev + 1);
                setSelectedAnswer(null);
                setShowFeedback(false);
            } else {
                setIsActive(false);
                const finalCorrect = score + (isCorrect ? 1 : 0);
                // حساب النقاط الأساسية
                let basePoints = finalCorrect * POINTS_PER_CORRECT;
                if (finalCorrect === QUESTION_COUNT) {
                    basePoints += BONUS_ALL_CORRECT;
                }
                // تطبيق مضاعف الصعوبة
                let totalPoints = applyMultiplier(basePoints, diffProfile);
                // الحد الأقصى 40 نقطة بعد المضاعف (اختياري)
                totalPoints = Math.min(40, totalPoints);
                
                if (finalCorrect >= PASS_SCORE) {
                    playSound('win');
                    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#8b5cf6', '#ec4899', '#f59e0b'] });
                    toast.success(getEffectiveLanguage() === 'en' 
                        ? `Great! ${finalCorrect}/${QUESTION_COUNT} correct! +${totalPoints} points 🎉` 
                        : `رائع! ${finalCorrect}/${QUESTION_COUNT} إجابات صحيحة! +${totalPoints} نقطة 🎉`);
                    onComplete(totalPoints, true);
                } else {
                    playSound('lose');
                    toast.error(getEffectiveLanguage() === 'en' 
                        ? `Try again! ${finalCorrect}/${QUESTION_COUNT} only 💔` 
                        : `حاول مرة أخرى! ${finalCorrect}/${QUESTION_COUNT} فقط 💔`);
                    onComplete(0, false);
                }
            }
        }, 1500);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getLanguageDisplay = () => {
        if (language === 'ar') return '🇸🇦 عربي';
        if (language === 'en') return '🇬🇧 English';
        return needsMedicalEnglish() ? '🇬🇧 English (Auto)' : '🇸🇦 عربي (Auto)';
    };

    const cycleLanguage = () => {
        const options: ('auto' | 'ar' | 'en')[] = ['auto', 'ar', 'en'];
        const currentIndex = options.indexOf(language);
        const next = options[(currentIndex + 1) % options.length];
        setLanguage(next);
        const langMsg = next === 'auto' ? (needsMedicalEnglish() ? 'English (Auto)' : 'عربي (تلقائي)') : next === 'ar' ? 'عربي' : 'English Medical';
        toast.success(`Language: ${langMsg}`, { icon: '🌐' });
    };

    const isEn = getEffectiveLanguage() === 'en';
    const currentQ = questions[currentQuestion];
    const isEnglishQuestion = currentQ?.language === 'en';

    // شاشة البداية (اختيار المجال)
    if (!isActive && !starting && questions.length === 0) {
        return (
            <div className="text-center py-6 px-3">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Brain className="w-10 h-10 text-white"/>
                </div>
                <h3 className="text-xl font-black text-gray-800 mb-2">
                    {isEn ? 'Medical Quiz Rush! 🏃‍♂️' : 'سباق المعرفة الطبية! 🏃‍♂️'}
                </h3>
                <p className="text-xs font-bold text-gray-500 mb-4 max-w-xs mx-auto">
                    {isEn 
                        ? 'Choose your category, answer 5 short questions in 75 seconds!'
                        : 'اختر المجال، أجب على 5 أسئلة قصيرة في 75 ثانية!'}
                </p>

                {/* اختيار المجال */}
                <div className="bg-white rounded-2xl p-4 mb-5 shadow-md border border-gray-100 max-w-xs mx-auto">
                    <p className="text-xs font-bold text-gray-600 mb-2 flex items-center justify-center gap-1">
                        <Layers className="w-3 h-3" /> {isEn ? 'Select Category' : 'اختر المجال'}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {CATEGORY_OPTIONS.map(cat => (
                            <button
                                key={cat.value}
                                onClick={() => !categoryLocked && setSelectedCategory(cat.value)}
                                disabled={categoryLocked}
                                className={`px-2 py-1.5 rounded-lg text-xs font-black transition-all ${
                                    selectedCategory === cat.value
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                {isEn ? cat.labelEn : cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-3 rounded-2xl max-w-xs mx-auto mb-4 border border-indigo-200">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-white p-2 rounded-lg"><p className="text-indigo-600 font-bold">{isEn ? 'Time' : 'الوقت'}</p><p className="text-lg font-black">1:15</p></div>
                        <div className="bg-white p-2 rounded-lg"><p className="text-indigo-600 font-bold">{isEn ? 'Questions' : 'أسئلة'}</p><p className="text-lg font-black">5</p></div>
                        <div className="bg-white p-2 rounded-lg col-span-2"><p className="text-indigo-600 font-bold">{isEn ? 'Points' : 'النقاط'}</p><p className="text-base font-black">5 لكل صحيح + 15 مكافأة (40 نقطة)</p></div>
                    </div>
                </div>

                <div className="flex justify-center gap-2 mb-4">
                    <button
                        onClick={cycleLanguage}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-black"
                    >
                        <Globe className="w-3 h-3" />
                        {getLanguageDisplay()}
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
                    disabled={starting || loadingQuestions}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-black shadow-lg hover:scale-105 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2 mx-auto"
                >
                    {starting || loadingQuestions ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                    {loadingQuestions ? (isEn ? 'Generating...' : 'جاري التوليد...') : 
                     starting ? (isEn ? 'Starting...' : 'جاري البدء...') : 
                     (isEn ? '🚀 Start Race' : '🚀 ابدأ السباق')}
                </button>
            </div>
        );
    }

    // شاشة التحميل
    if (loadingQuestions && questions.length === 0) {
        const catName = isEn ? CATEGORY_OPTIONS.find(c => c.value === selectedCategory)?.labelEn : CATEGORY_OPTIONS.find(c => c.value === selectedCategory)?.label;
        return (
            <div className="text-center py-16">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-3" />
                <p className="text-sm font-bold text-gray-600">
                    {isEn ? `Generating ${catName} questions with AI...` : `جاري توليد أسئلة ${catName} بالذكاء الاصطناعي...`}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">{isEn ? 'Short & concise questions' : 'أسئلة قصيرة ومباشرة'}</p>
            </div>
        );
    }

    // شاشة اللعب
    if (isActive && questions.length > 0 && currentQ) {
        const opts = currentQ.options;
        return (
            <div className="min-h-screen bg-gray-50 py-3 px-3" dir={isEnglishQuestion ? 'ltr' : 'rtl'}>
                <div className="flex justify-between items-center mb-4 gap-2">
                    <div className={`px-3 py-1.5 rounded-xl font-black text-sm shadow-md ${
                        timeLeft > 60 ? 'bg-indigo-500 text-white' : 
                        timeLeft > 30 ? 'bg-orange-500 text-white' : 
                        'bg-red-500 text-white animate-pulse'
                    }`}>
                        ⏱️ {formatTime(timeLeft)}
                    </div>
                    <div className="bg-white px-3 py-1.5 rounded-xl font-black shadow-sm border border-indigo-200 text-sm">
                        <span className="text-indigo-600">{currentQuestion + 1}</span><span className="text-gray-400">/{QUESTION_COUNT}</span>
                    </div>
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-3 py-1.5 rounded-xl font-black shadow-md text-sm">
                        ✅ {score}/{QUESTION_COUNT}
                    </div>
                </div>
                
                <div className="w-full bg-gray-200 h-1.5 rounded-full mb-5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300 rounded-full" 
                         style={{ width: `${((currentQuestion + 1) / QUESTION_COUNT) * 100}%` }}></div>
                </div>
                
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-2xl mb-5 border border-indigo-200 shadow-sm">
                    <div className="flex items-start gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow">
                            {currentQuestion + 1}
                        </div>
                        <h3 className={`text-sm font-bold text-gray-800 leading-relaxed flex-1 ${isEnglishQuestion ? 'text-left' : 'text-right'}`}>
                            {currentQ.question}
                        </h3>
                    </div>
                    <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                        {currentQ.source === 'ai' && (
                            <span className="text-[9px] text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                <Sparkles className="w-2.5 h-2.5" /> AI
                            </span>
                        )}
                        {currentQ.source === 'local' && (
                            <span className="text-[9px] text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                <AlertCircle className="w-2.5 h-2.5" /> {isEn ? 'Local' : 'محلي'}
                            </span>
                        )}
                        <span className="text-[9px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            {isEnglishQuestion ? (isEn ? 'Medical English' : 'إنجليزي طبي') : (isEn ? 'Arabic' : 'عربي')}
                        </span>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 gap-2.5">
                    {opts.map((option, idx) => {
                        let btnClass = 'bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-800';
                        if (showFeedback) {
                            if (idx === currentQ.correct) btnClass = 'bg-gradient-to-r from-emerald-400 to-emerald-500 border-emerald-500 text-white';
                            else if (idx === selectedAnswer) btnClass = 'bg-gradient-to-r from-red-400 to-red-500 border-red-500 text-white';
                            else btnClass = 'bg-gray-100 border-gray-200 text-gray-400';
                        }
                        return (
                            <button
                                key={idx}
                                onClick={() => handleAnswer(idx)}
                                disabled={showFeedback}
                                className={`${btnClass} p-3 rounded-xl font-bold text-sm transition-all active:scale-98 shadow-sm flex items-center gap-2 ${isEnglishQuestion ? 'flex-row' : 'flex-row-reverse'}`}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0 ${
                                    showFeedback && idx === currentQ.correct ? 'bg-white text-emerald-600' : 
                                    showFeedback && idx === selectedAnswer ? 'bg-white text-red-600' : 
                                    'bg-indigo-100 text-indigo-600'
                                }`}>
                                    {String.fromCharCode(65 + idx)}
                                </div>
                                <span className="flex-1 text-right text-sm leading-relaxed">{option}</span>
                                {showFeedback && idx === currentQ.correct && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
                                {showFeedback && idx === selectedAnswer && idx !== currentQ.correct && <XCircle className="w-4 h-4 flex-shrink-0" />}
                            </button>
                        );
                    })}
                </div>
                
                <div className="mt-4 text-center">
                    <p className="text-[10px] text-gray-400">
                        {isEn ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')} remaining` : `متبقي ${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`}
                    </p>
                </div>
            </div>
        );
    }

    return null;
}
