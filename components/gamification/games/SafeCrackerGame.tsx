import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Lock, Volume2, VolumeX, HelpCircle, Clock, Star, Loader2, AlertCircle, CheckCircle, XCircle, Sparkles, X, Globe, BookOpen, RotateCw } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
    employee: any;
}

// ─── مكون عرض الإجابة الصحيحة ────────────────────────────────────────────────
function WrongAnswerReveal({
    question,
    reason,
    isEnglish,
    onClose,
}: {
    question: any;
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
                            <p className="text-white/80 text-xs">لحظة تعلّم 📚</p>
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

// ─── جلب السؤال من AI (باستخدام تخصص الموظف الفعلي ودعم اللغة) ──────────────
async function fetchQuestionWithAI(
    specialty: string,
    difficulty: string,
    language?: string
): Promise<any> {
    let level = 6;
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
        if (!data.question || !data.options || data.correct === undefined) {
            throw new Error('Invalid question format from AI');
        }
        const correctAnswer = data.options[data.correct];
        return {
            source: 'ai',
            provider: data.provider || 'AI',
            language: data.language || language || 'ar',
            question: data.question,
            options: data.options,
            correct_answer: correctAnswer,
            explanation: data.explanation,
        };
    } catch (err) {
        console.warn('AI fallback:', err);
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
            language: 'ar',
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
    const [phase, setPhase] = useState<'code' | 'difficulty' | 'question' | 'complete'>('code');
    const [bonusQuestion, setBonusQuestion] = useState<any>(null);
    const [selectedDifficulty, setSelectedDifficulty] = useState<string>('medium');
    const [timeLeft, setTimeLeft] = useState(15);
    const [feedback, setFeedback] = useState<{ message: string; isCorrect: boolean } | null>(null);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [loading, setLoading] = useState(false);
    const [showWrongReveal, setShowWrongReveal] = useState(false);
    const [wrongRevealReason, setWrongRevealReason] = useState<'wrong' | 'timeout'>('wrong');
    const [language, setLanguage] = useState<'auto' | 'ar' | 'en'>('auto');
    const MAX_GUESSES = 5;
    const BASE_POINTS = 20;

    const difficultyOptions = [
        { key: 'easy', label: 'سهل', points: 5, time: 12 },
        { key: 'medium', label: 'متوسط', points: 10, time: 14 },
        { key: 'hard', label: 'صعب', points: 15, time: 17 },
        { key: 'expert', label: 'صعب جداً', points: 20, time: 20 },
    ];

    // تحديد التخصصات التي تحتاج إنجليزية طبية
    const needsMedicalEnglish = useCallback(() => {
        const specialty = employee.specialty?.toLowerCase() || '';
        const medicalTerms = [
            'بشر', 'بشري', 'طبيب', 'طب', 'صيدلة', 'صيدلي', 'pharmacy',
            'أسنان', 'اسنان', 'dentistry', 'dental', 'معمل', 'مختبر',
            'laboratory', 'lab', 'أشعة', 'radiology', 'تخدير', 'anesthesia',
            'علاج طبيعي', 'physical therapy', 'تمريض', 'nursing',
        ];
        return medicalTerms.some(term => specialty.includes(term));
    }, [employee.specialty]);

    const getEffectiveLanguage = useCallback((): 'ar' | 'en' => {
        if (language === 'ar') return 'ar';
        if (language === 'en') return 'en';
        return needsMedicalEnglish() ? 'en' : 'ar';
    }, [language, needsMedicalEnglish]);

    // تشغيل الصوت
    const playSound = useCallback((type: 'win' | 'lose') => {
        if (!soundEnabled) return;
        try {
            let audio: HTMLAudioElement;
            if (type === 'win') audio = new Audio('/applause.mp3');
            else audio = new Audio('/fail.mp3');
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
            toast.error(getEffectiveLanguage() === 'en' ? 'Please enter exactly 3 digits!' : 'يجب إدخال 3 أرقام فقط!', { icon: '⚠️' });
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
            toast.success(getEffectiveLanguage() === 'en' ? '🎉 Great! You cracked the safe!' : '🎉 أحسنت! فتحت الخزنة!', { duration: 2000 });
            setPhase('difficulty');
        } else if (newGuesses.length >= MAX_GUESSES) {
            playSound('lose');
            toast.error(getEffectiveLanguage() === 'en' ? `💔 The correct code was: ${secretCode}` : `💔 الكود الصحيح كان: ${secretCode}`, { duration: 3000 });
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
            const effectiveLang = getEffectiveLanguage();
            const q = await fetchQuestionWithAI(employee.specialty, difficulty, effectiveLang);
            setBonusQuestion(q);
            const selected = difficultyOptions.find(opt => opt.key === difficulty);
            setTimeLeft(selected?.time || 15);
        } catch (err) {
            console.error('Failed to load bonus question:', err);
            toast.error(getEffectiveLanguage() === 'en' ? 'Failed to load question. Ending game.' : 'فشل تحميل السؤال، سيتم إنهاء اللعبة');
            onComplete(BASE_POINTS, true);
            resetGame();
        } finally {
            setLoading(false);
        }
    };

    // مؤقت السؤال
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (phase === 'question' && timeLeft > 0 && bonusQuestion && !showWrongReveal) {
            timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (phase === 'question' && timeLeft === 0 && bonusQuestion && !showWrongReveal) {
            handleAnswerTimeout();
        }
        return () => clearInterval(timer);
    }, [phase, timeLeft, bonusQuestion, showWrongReveal]);

    const handleAnswerTimeout = () => {
        playSound('lose');
        setFeedback({ message: getEffectiveLanguage() === 'en' ? '⌛ Time\'s up!' : '⌛ انتهى الوقت!', isCorrect: false });
        setShowWrongReveal(true);
        setWrongRevealReason('timeout');
        onComplete(BASE_POINTS, true);
    };

    const handleBonusAnswer = (answer: string) => {
        if (phase !== 'question' || !bonusQuestion || showWrongReveal) return;
        const isCorrect = answer.trim().toLowerCase() === bonusQuestion.correct_answer.trim().toLowerCase();
        const difficultyPoints = difficultyOptions.find(opt => opt.key === selectedDifficulty)?.points || 0;
        const bonusPoints = isCorrect ? difficultyPoints : 0;
        const totalPoints = BASE_POINTS + bonusPoints;

        if (isCorrect) {
            playSound('win');
            confetti({ particleCount: 200, spread: 80, origin: { y: 0.6 }, colors: ['#10b981', '#f59e0b', '#8b5cf6'] });
            setFeedback({ message: getEffectiveLanguage() === 'en' ? `✅ Correct! +${bonusPoints} bonus points` : `✅ إجابة صحيحة! +${bonusPoints} نقطة إضافية`, isCorrect: true });
            setTimeout(() => {
                setFeedback(null);
                setShowWrongReveal(true);
                setWrongRevealReason('wrong'); // just to close modal after display
            }, 1800);
            onComplete(totalPoints, true);
        } else {
            playSound('lose');
            setFeedback({ message: getEffectiveLanguage() === 'en' ? '❌ Wrong answer!' : '❌ إجابة خاطئة!', isCorrect: false });
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

    // تنسيق الوقت
    const formatTime = (seconds: number) => {
        if (seconds >= 60) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        return `${seconds} ث`;
    };

    const getLanguageDisplay = () => {
        if (language === 'ar') return '🇸🇦 عربي';
        if (language === 'en') return '🇬🇧 English';
        return needsMedicalEnglish() ? '🇬🇧 English (تلقائي)' : '🇸🇦 عربي (تلقائي)';
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
    const isEnglishQuestion = bonusQuestion?.language === 'en';

    // ─────────────────────────────────────────────────────────────────────────
    // مرحلة بدء اللعبة (شاشة الترحيب)
    // ─────────────────────────────────────────────────────────────────────────
    if (!isActive && !showWrongReveal) {
        return (
            <div className="text-center py-6 px-3">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Lock className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-black text-gray-800 mb-2">
                    {isEn ? 'Secret Safe! 🔐' : 'الخزنة السرية! 🔐'}
                </h3>
                <p className="text-xs font-bold text-gray-500 mb-4 max-w-xs mx-auto">
                    {isEn
                        ? 'Guess the 3‑digit code (digits 1‑9, no repeats) in 5 attempts using color hints.'
                        : 'خمن الرقم السري (3 أرقام مختلفة من 1‑9) في 5 محاولات فقط بناءً على تلميحات الألوان.'}
                </p>
                <div className="flex justify-center gap-4 mb-6">
                    {[
                        ['bg-emerald-500', isEn ? 'Correct\nPosition' : 'رقم صحيح\nمكان صحيح'],
                        ['bg-amber-500', isEn ? 'Wrong\nPosition' : 'رقم صحيح\nمكان خطأ'],
                        ['bg-red-500', isEn ? 'Not\nPresent' : 'رقم غير\nموجود'],
                    ].map(([color, label], i) => (
                        <div key={i} className="text-center">
                            <div className={`w-10 h-10 ${color} rounded-xl mb-1 shadow-md`}></div>
                            <p className="text-[10px] font-bold text-gray-600 whitespace-pre-line">{label}</p>
                        </div>
                    ))}
                </div>
                <div className="flex justify-center gap-2 mb-4">
                    <button onClick={cycleLanguage} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-black">
                        <Globe className="w-3 h-3" />
                        {getLanguageDisplay()}
                    </button>
                    <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-lg hover:bg-gray-100">
                        {soundEnabled ? <Volume2 className="w-4 h-4 text-gray-600" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                    </button>
                </div>
                <button
                    onClick={startGame}
                    disabled={starting}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-xl font-black shadow-lg hover:scale-105 transition-all disabled:opacity-50 text-sm"
                >
                    {starting ? (isEn ? '⏳ Starting...' : '⏳ جاري البدء...') : (isEn ? '🔓 Start Game' : '🔓 ابدأ المحاولة')}
                </button>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // مرحلة تخمين الكود
    // ─────────────────────────────────────────────────────────────────────────
    if (phase === 'code' && !showWrongReveal) {
        return (
            <div className="max-w-xl mx-auto py-4 px-3 animate-in slide-in-from-bottom-4 text-center">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-2">
                        <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-full hover:bg-gray-100">
                            {soundEnabled ? <Volume2 className="w-4 h-4 text-gray-600" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                        </button>
                        <button onClick={cycleLanguage} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-[10px] font-black">
                            <Globe className="w-3 h-3" />
                            {getLanguageDisplay()}
                        </button>
                    </div>
                    <div className="bg-indigo-50 rounded-xl px-3 py-1 text-center">
                        <p className="text-[10px] font-bold text-indigo-700">{isEn ? 'Safe Points' : 'نقاط الخزنة'}</p>
                        <p className="text-base font-black text-indigo-800">+{BASE_POINTS}</p>
                    </div>
                </div>
                <div className="flex items-center justify-center gap-2 mb-5">
                    <Lock className="w-8 h-8 text-emerald-600" />
                    <h3 className="text-xl font-black text-gray-800">{isEn ? 'Crack the Safe!' : 'اكسر الخزنة!'}</h3>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-3 rounded-2xl mb-6 border border-emerald-200">
                    <p className="text-xs font-bold text-gray-700 mb-2">
                        {isEn ? 'Remaining attempts:' : 'المحاولات المتبقية:'} <span className="text-xl text-emerald-600 font-black">{MAX_GUESSES - guesses.length}</span>
                    </p>
                    <div className="flex justify-center gap-3 text-[10px] font-bold">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded"></div> {isEn ? 'Correct' : 'صح'}</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-500 rounded"></div> {isEn ? 'Wrong Position' : 'مكان خطأ'}</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded"></div> {isEn ? 'Not Present' : 'غير موجود'}</div>
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
                            {isEn ? 'Guess ✨' : 'جرب ✨'}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // مرحلة اختيار مستوى السؤال
    // ─────────────────────────────────────────────────────────────────────────
    if (phase === 'difficulty' && !showWrongReveal) {
        return (
            <div className="text-center py-6 px-3 animate-in fade-in duration-300" dir="rtl">
                <div className="bg-white rounded-2xl shadow-lg p-5 max-w-md mx-auto">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex gap-2">
                            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-full hover:bg-gray-100">
                                {soundEnabled ? <Volume2 className="w-4 h-4 text-gray-600" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                            </button>
                            <button onClick={cycleLanguage} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-[10px] font-black">
                                <Globe className="w-3 h-3" />
                                {getLanguageDisplay()}
                            </button>
                        </div>
                        <div className="bg-emerald-50 rounded-xl px-3 py-1 text-center">
                            <p className="text-[10px] font-bold text-emerald-700">{isEn ? 'Safe Points' : 'نقاط الخزنة'}</p>
                            <p className="text-base font-black text-emerald-800">+{BASE_POINTS}</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-1 mb-4">
                        <Sparkles className="w-6 h-6 text-emerald-500" />
                        <h3 className="text-lg font-black text-gray-800">{isEn ? 'Select Question Difficulty' : 'اختر مستوى السؤال'}</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">
                        {isEn ? 'Higher difficulty = more bonus points' : 'كلما زادت الصعوبة، زادت النقاط الإضافية'}
                    </p>
                    <div className="grid grid-cols-2 gap-2 mb-5">
                        {difficultyOptions.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => handleDifficultySelect(opt.key)}
                                className={`p-3 rounded-xl border-2 transition-all ${
                                    selectedDifficulty === opt.key
                                        ? 'border-emerald-500 bg-emerald-50 shadow-md'
                                        : 'border-gray-200 hover:border-emerald-300'
                                }`}
                            >
                                <p className="font-black text-gray-800 text-sm">{isEn ? (opt.key === 'easy' ? 'Easy' : opt.key === 'medium' ? 'Medium' : opt.key === 'hard' ? 'Hard' : 'Expert') : opt.label}</p>
                                <p className="text-xs font-bold text-emerald-600">+{opt.points} {isEn ? 'pts' : 'نقطة'}</p>
                                <p className="text-[9px] text-gray-400">{opt.time}s {isEn ? 'to answer' : 'للإجابة'}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // مرحلة السؤال الإضافي
    // ─────────────────────────────────────────────────────────────────────────
    if (phase === 'question' && bonusQuestion && !showWrongReveal) {
        const options = Array.isArray(bonusQuestion.options) ? bonusQuestion.options : [];
        const selectedOpt = difficultyOptions.find(opt => opt.key === selectedDifficulty);
        const timeDisplay = formatTime(timeLeft);

        return (
            <>
                <div className="text-center py-3 animate-in slide-in-from-right max-w-3xl mx-auto" dir={isEnglishQuestion ? 'ltr' : 'rtl'}>
                    <div className="flex justify-between items-center mb-4 px-3 flex-wrap gap-1">
                        <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-1.5 rounded-xl font-black text-xs shadow-lg flex items-center gap-1">
                            <Clock className="w-3 h-3 animate-pulse" /> {timeDisplay}
                        </div>
                        <div className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-3 py-1.5 rounded-xl font-black text-xs shadow-lg flex items-center gap-1">
                            <Star className="w-3 h-3" /> {isEn ? 'Bonus:' : 'مكافأة:'} +{selectedOpt?.points || 0} {isEn ? 'pts' : 'نقطة'}
                        </div>
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-3 py-1.5 rounded-xl font-black text-xs shadow-lg flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> {isEn ? (selectedOpt?.key === 'easy' ? 'Easy' : selectedOpt?.key === 'medium' ? 'Medium' : selectedOpt?.key === 'hard' ? 'Hard' : 'Expert') : (selectedOpt?.label || 'سؤال')}
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-5 rounded-2xl mb-6 border border-emerald-200 shadow-sm relative">
                        <HelpCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3 animate-bounce" />
                        <h3 className={`text-base font-black text-emerald-900 leading-relaxed ${isEnglishQuestion ? 'text-left' : 'text-right'}`}>
                            {bonusQuestion.question}
                        </h3>
                        <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                            {bonusQuestion.source === 'ai' && (
                                <span className="text-[9px] text-emerald-400 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                    <Sparkles className="w-2.5 h-2.5" /> {isEn ? 'Generated by' : 'بواسطة'} {bonusQuestion.provider}
                                </span>
                            )}
                            {bonusQuestion.source === 'local' && (
                                <span className="text-[9px] text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">
                                    <AlertCircle className="w-2.5 h-2.5" /> {isEn ? 'Local bank' : 'من بنك الأسئلة المحلي'}
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
                </div>
            </>
        );
    }

    // عرض الشاشة التعليمية
    if (showWrongReveal && bonusQuestion) {
        return (
            <WrongAnswerReveal
                question={bonusQuestion}
                reason={wrongRevealReason}
                isEnglish={isEnglishQuestion}
                onClose={closeWrongReveal}
            />
        );
    }

    return null;
}
