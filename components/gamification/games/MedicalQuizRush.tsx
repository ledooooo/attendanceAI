import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Brain, CheckCircle, XCircle, Sparkles, Globe, Loader2, AlertCircle } from 'lucide-react';
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

// تعريف نوع السؤال
interface GeneratedQuestion {
    question: string;
    options: string[];
    correct: number;
    explanation?: string;
    topic?: string;
    source: 'ai' | 'local';
    provider?: string;
    language?: string;
}

// دالة جلب سؤال واحد من AI
async function fetchSingleQuestion(specialty: string, difficulty: string, language?: string): Promise<GeneratedQuestion> {
    let level = 3;
    switch (difficulty) {
        case 'easy': level = 3; break;
        case 'medium': level = 6; break;
        case 'hard': level = 10; break;
        case 'expert': level = 14; break;
        default: level = 6;
    }
    
    try {
        const { data, error } = await supabase.functions.invoke('generate-beast-question', {
            body: { specialty, level, usedTopics: [], language },
        });
        
        if (error || !data) throw new Error('AI request failed');
        if (data.error) throw new Error(data.error);
        if (!data.question || !data.options || data.correct === undefined) throw new Error('Invalid format');
        
        return {
            source: 'ai',
            provider: data.provider || 'AI',
            language: data.language || language || 'ar',
            question: data.question,
            options: data.options,
            correct: data.correct,
            explanation: data.explanation,
            topic: data.topic,
        };
    } catch (err) {
        console.warn('AI fallback:', err);
        
        // الرجوع إلى بنك الأسئلة المحلي
        const { data: localQuestions } = await supabase
            .from('quiz_questions')
            .select('*')
            .or(`specialty.ilike.%${specialty}%,specialty.ilike.%الكل%`)
            .limit(30);
        
        if (!localQuestions?.length) throw new Error('No questions available');
        
        const random = localQuestions[Math.floor(Math.random() * localQuestions.length)];
        let options: string[] = [];
        if (random.options) {
            if (Array.isArray(random.options)) options = random.options;
            else try { options = JSON.parse(random.options); } catch { options = random.options.split(',').map(s => s.trim()); }
        }
        
        // تحويل correct_index إلى فهرس صحيح
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
            language: 'ar',
            question: random.question_text,
            options,
            correct,
        };
    }
}

export default function MedicalQuizRush({ employee, diffProfile, onStart, onComplete }: Props) {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [language, setLanguage] = useState<'auto' | 'ar' | 'en'>('auto');
    const [soundEnabled, setSoundEnabled] = useState(true);
    
    const QUESTION_COUNT = 5;
    const BASE_TIME = 60;
    const PASS_SCORE = 3;

    // تحديد التخصصات التي تحتاج إنجليزية طبية
    const needsMedicalEnglish = useCallback(() => {
        const specialty = employee.specialty?.toLowerCase() || '';
        const medicalEnglishSpecialties = [
            'صيدلة', 'صيدلي', 'pharmacy',
            'أسنان', 'اسنان', 'dentistry', 'dental',
            'معمل', 'مختبر', 'laboratory', 'lab',
            'أشعة', 'radiology',
            'تخدير', 'anesthesia',
            'جراحة', 'surgery',
            'قلب', 'cardiology',
            'أعصاب', 'neurology',
        ];
        return medicalEnglishSpecialties.some(s => specialty.includes(s));
    }, [employee.specialty]);

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
            audio.volume = 0.6;
            audio.play().catch(() => {});
        } catch {}
    }, [soundEnabled]);

    // جلب مجموعة أسئلة حسب مستويات الصعوبة
    const generateQuestionSet = async () => {
        setLoadingQuestions(true);
        const effectiveLang = getEffectiveLanguage();
        const difficultyLevels = ['easy', 'easy', 'medium', 'medium', 'hard'];
        const generated: GeneratedQuestion[] = [];
        
        for (let i = 0; i < QUESTION_COUNT; i++) {
            const difficulty = difficultyLevels[i % difficultyLevels.length];
            try {
                const q = await fetchSingleQuestion(employee.specialty, difficulty, effectiveLang);
                generated.push(q);
                // تأخير بسيط بين الطلبات لتجنب الضغط على API
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (err) {
                console.error(`Failed to generate question ${i + 1}:`, err);
                // إذا فشل جلب سؤال واحد، نستخدم سؤال احتياطي من بنك الأسئلة
                try {
                    const fallback = await fetchSingleQuestion(employee.specialty, 'easy', 'ar');
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
            // جلب الأسئلة من AI
            await generateQuestionSet();
        } catch (err) {
            toast.error('فشل تحميل الأسئلة، حاول مرة أخرى');
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
    };

    // المؤقت
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (isActive && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (isActive && timeLeft === 0) {
            setIsActive(false);
            playSound('lose');
            toast.error('انتهى الوقت!');
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
                // نهاية اللعبة
                setIsActive(false);
                const finalScore = score + (isCorrect ? 1 : 0);
                const rawTotal = finalScore * 3 + Math.floor(timeLeft / 3);
                let total = applyMultiplier(rawTotal, diffProfile);
                total = Math.min(30, total);
                
                if (finalScore >= PASS_SCORE) {
                    playSound('win');
                    confetti({ particleCount: 200, spread: 80, origin: { y: 0.6 }, colors: ['#8b5cf6', '#ec4899', '#f59e0b'] });
                    toast.success(`رائع! ${finalScore}/${QUESTION_COUNT} إجابات صحيحة! 🎉`);
                    onComplete(total, true);
                } else {
                    playSound('lose');
                    toast.error(`حاول مرة أخرى! ${finalScore}/${QUESTION_COUNT} فقط 💔`);
                    onComplete(0, false);
                }
            }
        }, 1500);
    };

    // الحصول على عرض اللغة
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
        toast.success(`اللغة: ${langMsg}`, { icon: '🌐' });
    };

    const isEn = getEffectiveLanguage() === 'en';

    // شاشة البداية
    if (!isActive && !starting && questions.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <Brain className="w-14 h-14 text-white animate-pulse"/>
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">
                    {isEn ? 'Medical Quiz Rush! 🏃‍♂️' : 'سباق المعرفة الطبية! 🏃‍♂️'}
                </h3>
                <p className="text-base font-bold text-gray-600 mb-4 max-w-lg mx-auto">
                    {isEn 
                        ? 'Answer 5 medical questions as fast as you can. Every second saved = bonus points!'
                        : 'أجب على 5 أسئلة طبية بأسرع وقت ممكن. كل ثانية توفرها = نقاط إضافية!'}
                </p>
                <p className="text-sm font-bold text-indigo-600 mb-6 flex items-center justify-center gap-1">
                    <Sparkles className="w-4 h-4"/> {isEn ? 'Your level' : 'مستواك'} {diffProfile.emoji}: {isEn ? 'Custom questions ×' : 'أسئلة مخصصة ×'}{diffProfile.multiplier.toFixed(1)} {isEn ? 'points' : 'نقاط'}
                </p>
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-3xl max-w-md mx-auto mb-8 border-2 border-indigo-200">
                    <div className="grid grid-cols-2 gap-4 text-sm font-bold">
                        <div className="bg-white p-3 rounded-xl shadow-sm"><p className="text-indigo-600">{isEn ? 'Time limit' : 'الوقت المحدد'}</p><p className="text-2xl text-gray-800">{BASE_TIME}s</p></div>
                        <div className="bg-white p-3 rounded-xl shadow-sm"><p className="text-indigo-600">{isEn ? 'Questions' : 'عدد الأسئلة'}</p><p className="text-2xl text-gray-800">{QUESTION_COUNT}</p></div>
                        <div className="bg-white p-3 rounded-xl shadow-sm col-span-2"><p className="text-indigo-600">{isEn ? 'Passing score' : 'شرط النجاح'}</p><p className="text-lg text-gray-800">{PASS_SCORE}/{QUESTION_COUNT} {isEn ? 'correct answers' : 'إجابات صحيحة'}</p></div>
                    </div>
                </div>
                <div className="flex justify-center gap-3 mb-6">
                    <button
                        onClick={cycleLanguage}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-100 text-indigo-700 font-black hover:bg-indigo-200 transition"
                    >
                        <Globe className="w-4 h-4" />
                        {getLanguageDisplay()}
                    </button>
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="p-2 rounded-full hover:bg-gray-100 transition"
                    >
                        {soundEnabled ? <span className="text-gray-600">🔊</span> : <span className="text-gray-400">🔇</span>}
                    </button>
                </div>
                <button
                    onClick={startGame}
                    disabled={starting || loadingQuestions}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg flex items-center justify-center gap-2 mx-auto"
                >
                    {starting || loadingQuestions ? <Loader2 className="w-5 h-5 animate-spin" /> : <Brain className="w-5 h-5" />}
                    {loadingQuestions ? (isEn ? 'Generating questions...' : 'جاري توليد الأسئلة...') : 
                     starting ? (isEn ? 'Starting...' : 'جاري البدء...') : 
                     (isEn ? '🚀 Start Race' : '🚀 ابدأ السباق')}
                </button>
            </div>
        );
    }

    // شاشة التحميل
    if (loadingQuestions && questions.length === 0) {
        return (
            <div className="text-center py-16">
                <Loader2 className="w-16 h-16 text-indigo-500 animate-spin mx-auto mb-4" />
                <p className="text-gray-600 font-bold">{isEn ? 'Generating medical questions with AI...' : 'جاري توليد أسئلة طبية بالذكاء الاصطناعي...'}</p>
                <p className="text-xs text-gray-400 mt-2">{isEn ? 'This may take a moment' : 'قد يستغرق هذا لحظة'}</p>
            </div>
        );
    }

    // شاشة اللعب
    if (isActive && questions.length > 0 && questions[currentQuestion]) {
        const currentQ = questions[currentQuestion];
        const opts = currentQ.options;
        const isEnglishQuestion = currentQ.language === 'en';

        return (
            <div className="max-w-3xl mx-auto py-8 animate-in zoom-in-95" dir={isEnglishQuestion ? 'ltr' : 'rtl'}>
                <div className="flex justify-between items-center mb-8 px-4 flex-wrap gap-2">
                    <div className={`px-6 py-3 rounded-2xl font-black text-xl shadow-lg ${timeLeft > 20 ? 'bg-indigo-500 text-white' : 'bg-red-500 text-white animate-pulse'}`}>
                        ⏱️ {timeLeft}s
                    </div>
                    <div className="bg-white px-6 py-3 rounded-2xl font-black shadow-lg border-2 border-indigo-200">
                        <span className="text-indigo-600">{currentQuestion + 1}</span><span className="text-gray-400"> / {QUESTION_COUNT}</span>
                    </div>
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg">
                        ✅ {score} {isEn ? 'correct' : 'صحيحة'}
                    </div>
                </div>
                
                <div className="w-full bg-gray-200 h-3 rounded-full mb-8 overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300 rounded-full" style={{ width: `${((currentQuestion + 1) / QUESTION_COUNT) * 100}%` }}></div>
                </div>
                
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-8 rounded-3xl mb-8 border-2 border-indigo-200 shadow-xl relative">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-black text-xl flex-shrink-0 shadow-lg">
                            {currentQuestion + 1}
                        </div>
                        <h3 className={`text-xl md:text-2xl font-black text-gray-900 leading-relaxed ${isEnglishQuestion ? 'text-left' : 'text-right'}`}>
                            {currentQ.question}
                        </h3>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                        {currentQ.source === 'ai' && (
                            <p className="text-xs text-indigo-400 flex items-center justify-center gap-1 bg-indigo-50 px-3 py-1 rounded-full">
                                <Sparkles className="w-3 h-3" /> {isEn ? 'Generated by' : 'تم توليده بواسطة'} {currentQ.provider}
                            </p>
                        )}
                        {currentQ.source === 'local' && (
                            <p className="text-xs text-amber-600 flex items-center justify-center gap-1 bg-amber-50 px-3 py-1 rounded-full">
                                <AlertCircle className="w-3 h-3" /> {isEn ? 'From local bank' : 'من بنك الأسئلة المحلي'}
                            </p>
                        )}
                        <p className="text-xs text-gray-400 flex items-center justify-center gap-1 bg-gray-100 px-3 py-1 rounded-full">
                            <Globe className="w-3 h-3" />
                            {isEnglishQuestion ? 'Medical English' : 'العربية'}
                        </p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {opts.map((option, idx) => {
                        let btnClass = 'bg-white border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 text-gray-800';
                        if (showFeedback) {
                            if (idx === currentQ.correct) btnClass = 'bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-600 text-white';
                            else if (idx === selectedAnswer) btnClass = 'bg-gradient-to-br from-red-400 to-red-600 border-red-600 text-white';
                            else btnClass = 'bg-gray-100 border-gray-200 text-gray-400';
                        }
                        return (
                            <button
                                key={idx}
                                onClick={() => handleAnswer(idx)}
                                disabled={showFeedback}
                                className={`${btnClass} p-5 rounded-2xl font-bold text-lg transition-all hover:scale-105 active:scale-95 shadow-md hover:shadow-xl disabled:cursor-not-allowed text-right flex items-center gap-3`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${showFeedback && idx === currentQ.correct ? 'bg-white text-emerald-600' : showFeedback && idx === selectedAnswer ? 'bg-white text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                    {String.fromCharCode(65 + idx)}
                                </div>
                                <span className="flex-1">{option}</span>
                                {showFeedback && idx === currentQ.correct && <CheckCircle className="w-6 h-6 flex-shrink-0"/>}
                                {showFeedback && idx === selectedAnswer && idx !== currentQ.correct && <XCircle className="w-6 h-6 flex-shrink-0"/>}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    return null;
}