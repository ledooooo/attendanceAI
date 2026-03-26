import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient'; // تأكد من صحة المسار
import { Lock, Volume2, VolumeX, HelpCircle, Clock, Star, Loader2, AlertCircle, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
    employee: any; // لتحديد التخصص وجلب الأسئلة المناسبة
}

// ─── جلب السؤال باستخدام AI مع Fallback ─────────────────────────────────────
async function fetchQuestionWithAI(specialty: string, difficulty: string = 'medium'): Promise<any> {
    let level = 6;
    switch (difficulty) {
        case 'easy': level = 3; break;
        case 'medium': level = 6; break;
        case 'hard': level = 10; break;
        case 'expert': level = 14; break;
        default: level = 6;
    }
    try {
        // محاولة جلب سؤال من AI عبر Edge Function
        const { data, error } = await supabase.functions.invoke('generate-beast-question', {
            body: { specialty, level, usedTopics: [] },
        });
        if (error || !data) throw new Error('AI request failed');
        if (data.error) throw new Error(data.error);
        // التحقق من صحة البيانات القادمة من الدالة
        if (!data.question || !data.options || data.correct === undefined) {
            throw new Error('Invalid question format from AI');
        }
        const correctAnswer = data.options[data.correct];
        return {
            source: 'ai',
            provider: data.provider || 'AI',
            question: data.question,
            options: data.options,
            correct_answer: correctAnswer,
            explanation: data.explanation,
        };
    } catch (err) {
        console.warn('AI fallback:', err);
        // الرجوع إلى بنك الأسئلة المحلي
        const { data: localQuestions, error: localError } = await supabase
            .from('quiz_questions')
            .select('*')
            .or(`specialty.ilike.%${specialty}%,specialty.ilike.%الكل%`)
            .limit(30);
        if (localError || !localQuestions?.length) {
            throw new Error('No questions available locally');
        }
        const random = localQuestions[Math.floor(Math.random() * localQuestions.length)];
        let options: string[] = [];
        if (random.options) {
            if (Array.isArray(random.options)) options = random.options;
            else {
                try { options = JSON.parse(random.options); } catch { options = random.options.split(',').map(s => s.trim()); }
            }
        }
        return {
            source: 'local',
            question: random.question_text,
            options,
            correct_answer: random.correct_answer,
        };
    }
}

export default function SafeCrackerGame({ onStart, onComplete, employee }: Props) {
    const [secretCode, setSecretCode] = useState('');
    const [guesses, setGuesses] = useState<{ guess: string; feedback: string[] }[]>([]);
    const [currentGuess, setCurrentGuess] = useState('');
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const [phase, setPhase] = useState<'code' | 'question' | 'complete'>('code');
    const [bonusQuestion, setBonusQuestion] = useState<any>(null);
    const [timeLeft, setTimeLeft] = useState(15);
    const [feedback, setFeedback] = useState<{ message: string; isCorrect: boolean } | null>(null);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [loading, setLoading] = useState(false);
    const MAX_GUESSES = 5;
    const BASE_POINTS = 20; // نقاط فتح الخزنة

    // تشغيل الصوت
    const playSound = useCallback((type: 'win' | 'lose') => {
        if (!soundEnabled) return;
        try {
            let audio: HTMLAudioElement;
            if (type === 'win') audio = new Audio('/applause.mp3');
            else audio = new Audio('/fail.mp3'); // استخدام fail.mp3 للخسارة
            audio.volume = 0.6;
            audio.play().catch(() => {});
        } catch {}
    }, [soundEnabled]);

    const startGame = async () => {
        setStarting(true);
        try {
            await onStart();
        } catch {
            setStarting(false);
            return;
        }
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
            toast.error('يجب إدخال 3 أرقام فقط!', { icon: '⚠️' });
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
            // نجاح فتح الخزنة
            playSound('win');
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#10b981', '#f59e0b', '#8b5cf6'] });
            toast.success('🎉 أحسنت! فتحت الخزنة!', { duration: 2000 });
            // الانتقال لجلب السؤال الإضافي
            loadBonusQuestion();
        } else if (newGuesses.length >= MAX_GUESSES) {
            // فشل فتح الخزنة
            playSound('lose');
            toast.error(`💔 الكود الصحيح كان: ${secretCode}`, { duration: 3000 });
            setTimeout(() => {
                onComplete(0, false);
                resetGame();
            }, 2000);
        }
    };

    const loadBonusQuestion = async () => {
        setPhase('question');
        setLoading(true);
        try {
            // اختيار صعوبة معتدلة
            const q = await fetchQuestionWithAI(employee.specialty, 'medium');
            setBonusQuestion(q);
            setTimeLeft(15);
        } catch (err) {
            console.error('Failed to load bonus question:', err);
            toast.error('فشل تحميل السؤال، سيتم إنهاء اللعبة');
            onComplete(BASE_POINTS, true); // نعطي نقاط الخزنة فقط
            resetGame();
        } finally {
            setLoading(false);
        }
    };

    // مؤقت السؤال
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (phase === 'question' && timeLeft > 0 && bonusQuestion) {
            timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (phase === 'question' && timeLeft === 0 && bonusQuestion) {
            handleAnswerTimeout();
        }
        return () => clearInterval(timer);
    }, [phase, timeLeft, bonusQuestion]);

    const handleAnswerTimeout = () => {
        playSound('lose');
        setFeedback({ message: '⌛ انتهى الوقت!', isCorrect: false });
        setTimeout(() => {
            setFeedback(null);
            onComplete(BASE_POINTS, true); // نعطي نقاط الخزنة فقط
            resetGame();
        }, 1500);
    };

    const handleBonusAnswer = (answer: string) => {
        if (phase !== 'question' || !bonusQuestion) return;
        const isCorrect = answer.trim().toLowerCase() === bonusQuestion.correct_answer.trim().toLowerCase();
        const bonusPoints = isCorrect ? 15 : 0;
        const totalPoints = BASE_POINTS + bonusPoints;

        if (isCorrect) {
            playSound('win');
            confetti({ particleCount: 200, spread: 80, origin: { y: 0.6 }, colors: ['#10b981', '#f59e0b', '#8b5cf6'] });
            setFeedback({ message: `✅ إجابة صحيحة! +${bonusPoints} نقطة إضافية`, isCorrect: true });
        } else {
            playSound('lose');
            setFeedback({ message: '❌ إجابة خاطئة!', isCorrect: false });
        }

        setTimeout(() => {
            setFeedback(null);
            onComplete(totalPoints, isCorrect);
            resetGame();
        }, 1800);
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
    };

    // ─────────────────────────────────────────────────────────────────────────
    // مرحلة بدء اللعبة (شاشة الترحيب)
    // ─────────────────────────────────────────────────────────────────────────
    if (!isActive) {
        return (
            <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl animate-pulse">
                    <Lock className="w-14 h-14 text-white" />
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">الخزنة السرية! 🔐</h3>
                <p className="text-base font-bold text-gray-600 mb-8 max-w-lg mx-auto">
                    خمن الرقم السري (3 أرقام مختلفة من 1-9) في 5 محاولات فقط بناءً على تلميحات الألوان.
                </p>
                <div className="flex justify-center gap-6 mb-8">
                    {[
                        ['bg-emerald-500', 'رقم صحيح\nمكان صحيح'],
                        ['bg-amber-500', 'رقم صحيح\nمكان خطأ'],
                        ['bg-red-500', 'رقم غير\nموجود'],
                    ].map(([color, label], i) => (
                        <div key={i} className="text-center">
                            <div className={`w-12 h-12 ${color} rounded-xl mb-2 shadow-md`}></div>
                            <p className="text-xs font-bold text-gray-600 whitespace-pre-line">{label}</p>
                        </div>
                    ))}
                </div>
                <button
                    onClick={startGame}
                    disabled={starting}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg"
                >
                    {starting ? '⏳ جاري البدء...' : '🔓 ابدأ المحاولة'}
                </button>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // مرحلة تخمين الكود
    // ─────────────────────────────────────────────────────────────────────────
    if (phase === 'code') {
        return (
            <div className="max-w-xl mx-auto py-8 animate-in slide-in-from-bottom-4 text-center">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-full hover:bg-gray-100 transition">
                        {soundEnabled ? <Volume2 className="w-5 h-5 text-gray-600" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
                    </button>
                    <div className="bg-indigo-50 rounded-xl px-4 py-2 text-center">
                        <p className="text-xs font-bold text-indigo-700">نقاط الخزنة</p>
                        <p className="text-xl font-black text-indigo-800">+{BASE_POINTS}</p>
                    </div>
                </div>
                <div className="flex items-center justify-center gap-3 mb-8">
                    <Lock className="w-10 h-10 text-emerald-600" />
                    <h3 className="text-2xl font-black text-gray-800">اكسر الخزنة!</h3>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-3xl mb-8 border-2 border-emerald-200">
                    <p className="text-sm font-bold text-gray-700 mb-3">
                        المحاولات المتبقية: <span className="text-2xl text-emerald-600 font-black">{MAX_GUESSES - guesses.length}</span>
                    </p>
                    <div className="flex justify-center gap-4 text-xs font-bold">
                        <div className="flex items-center gap-1"><div className="w-4 h-4 bg-emerald-500 rounded"></div> صح</div>
                        <div className="flex items-center gap-1"><div className="w-4 h-4 bg-amber-500 rounded"></div> مكان خطأ</div>
                        <div className="flex items-center gap-1"><div className="w-4 h-4 bg-red-500 rounded"></div> غير موجود</div>
                    </div>
                </div>
                <div className="space-y-4 mb-10">
                    {guesses.map((g, i) => (
                        <div key={i} className="flex justify-center gap-3 animate-in slide-in-from-right" dir="ltr">
                            {g.guess.split('').map((num, idx) => (
                                <div
                                    key={idx}
                                    className={`w-16 h-16 flex items-center justify-center text-2xl font-black text-white rounded-2xl shadow-xl transform transition-all hover:scale-110 ${
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
                        <div key={i} className="flex justify-center gap-3 opacity-20" dir="ltr">
                            {[1, 2, 3].map(n => <div key={n} className="w-16 h-16 bg-gray-300 rounded-2xl"></div>)}
                        </div>
                    ))}
                </div>
                {guesses.length < MAX_GUESSES && (
                    <div className="flex gap-3 justify-center items-stretch" dir="ltr">
                        <input
                            type="number"
                            maxLength={3}
                            value={currentGuess}
                            onChange={e => setCurrentGuess(e.target.value.slice(0, 3))}
                            onKeyDown={e => e.key === 'Enter' && submitGuess()}
                            className="w-48 text-center text-3xl font-black p-4 bg-gray-50 border-4 border-emerald-300 focus:border-emerald-500 outline-none rounded-2xl shadow-lg"
                            placeholder="***"
                            autoFocus
                        />
                        <button
                            onClick={submitGuess}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 rounded-2xl font-black hover:scale-105 active:scale-95 shadow-xl transition-all text-lg"
                        >
                            جرب ✨
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // مرحلة السؤال الإضافي (بعد فتح الخزنة)
    // ─────────────────────────────────────────────────────────────────────────
    if (phase === 'question') {
        if (loading) {
            return (
                <div className="text-center py-16">
                    <Loader2 className="w-16 h-16 text-emerald-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600 font-bold">جاري تحضير سؤال المكافأة...</p>
                </div>
            );
        }
        if (bonusQuestion) {
            const options = Array.isArray(bonusQuestion.options) ? bonusQuestion.options : [];
            return (
                <div className="text-center py-4 animate-in slide-in-from-right max-w-3xl mx-auto" dir="rtl">
                    <div className="flex justify-between items-center mb-6 px-4">
                        <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-5 py-2 rounded-xl font-black shadow-lg flex items-center gap-2">
                            <Clock className="w-4 h-4 animate-pulse" /> {timeLeft} ثانية
                        </div>
                        <div className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-5 py-2 rounded-xl font-black shadow-lg flex items-center gap-2">
                            <Star className="w-4 h-4" /> مكافأة: +15 نقطة
                        </div>
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-5 py-2 rounded-xl font-black shadow-lg flex items-center gap-2">
                            <Sparkles className="w-4 h-4" /> سؤال إضافي
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-8 rounded-3xl mb-8 border-2 border-emerald-200 shadow-xl relative">
                        <HelpCircle className="w-14 h-14 text-emerald-500 mx-auto mb-4 animate-bounce" />
                        <h3 className="text-2xl font-black text-emerald-900 leading-relaxed">{bonusQuestion.question}</h3>
                        {bonusQuestion.source === 'ai' && (
                            <p className="text-xs text-emerald-400 mt-4 flex items-center justify-center gap-1">
                                <Sparkles className="w-3 h-3" /> تم توليده بواسطة {bonusQuestion.provider}
                            </p>
                        )}
                        {bonusQuestion.source === 'local' && (
                            <p className="text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
                                <AlertCircle className="w-3 h-3" /> من بنك الأسئلة المحلي
                            </p>
                        )}
                        {feedback && (
                            <div className={`absolute inset-0 flex items-center justify-center rounded-3xl backdrop-blur-sm animate-in fade-in zoom-in duration-200 ${
                                feedback.isCorrect ? 'bg-green-100/90' : 'bg-red-100/90'
                            }`}>
                                <div className="text-center p-4 rounded-2xl bg-white shadow-xl">
                                    {feedback.isCorrect ? (
                                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                                    ) : (
                                        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                                    )}
                                    <p className={`text-xl font-black ${feedback.isCorrect ? 'text-green-700' : 'text-red-700'}`}>{feedback.message}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {options.map((opt: string, idx: number) => (
                            <button
                                key={idx}
                                onClick={() => handleBonusAnswer(opt)}
                                className="bg-white border-2 border-gray-200 p-5 rounded-2xl font-bold text-gray-800 hover:border-emerald-500 hover:bg-emerald-50 hover:scale-105 transition-all active:scale-95 shadow-md hover:shadow-xl text-lg"
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
            );
        }
    }

    return null;
}
