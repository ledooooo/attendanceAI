import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Lock, Volume2, VolumeX, HelpCircle, Clock, Star, Loader2, AlertCircle, CheckCircle, XCircle, Sparkles, X, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
    employee: any;
}

// ─── جلب السؤال باستخدام generate-beast-question مع دعم اللغة ─────────────────
async function fetchQuestionWithAI(specialty: string, difficulty: string = 'medium', language?: string): Promise<any> {
    let level = 6;
    switch (difficulty) {
        case 'easy': level = 3; break;
        case 'medium': level = 6; break;
        case 'hard': level = 10; break;
        case 'expert': level = 14; break;
        default: level = 6;
    }
    
    try {
        console.log(`🔄 محاولة جلب سؤال من AI: specialty=${specialty}, level=${level}, language=${language || 'auto'}`);
        const { data, error } = await supabase.functions.invoke('generate-beast-question', {
            body: { specialty, level, usedTopics: [], language },
        });
        
        if (error) {
            console.error('❌ AI request error:', error);
            throw new Error(`AI request failed: ${error.message}`);
        }
        
        if (!data) {
            console.error('❌ AI returned no data');
            throw new Error('AI returned no data');
        }
        
        if (data.error) {
            console.error('❌ AI error:', data.error);
            throw new Error(data.error);
        }
        
        if (!data.question || !data.options || data.correct === undefined) {
            console.error('❌ Invalid AI response format:', data);
            throw new Error('Invalid question format from AI');
        }
        
        const correctAnswer = data.options[data.correct];
        console.log(`✅ AI success! Provider: ${data.provider || 'unknown'}, Language: ${data.language || language || 'ar'}`);
        
        return {
            source: 'ai',
            provider: data.provider || 'AI',
            language: data.language || language || 'ar',
            question: data.question,
            options: data.options,
            correct_answer: correctAnswer,
            explanation: data.explanation,
        };
    } catch (aiError) {
        console.warn('⚠️ AI failed, falling back to local bank:', aiError);
        
        try {
            const { data: localQuestions, error: localError } = await supabase
                .from('quiz_questions')
                .select('*')
                .or(`specialty.ilike.%${specialty}%,specialty.ilike.%الكل%`)
                .limit(30);
            
            if (localError) {
                console.error('❌ Local DB error:', localError);
                throw new Error(localError.message);
            }
            
            if (!localQuestions || localQuestions.length === 0) {
                console.error('❌ No local questions found');
                throw new Error('No questions available locally');
            }
            
            const random = localQuestions[Math.floor(Math.random() * localQuestions.length)];
            let options: string[] = [];
            if (random.options) {
                if (Array.isArray(random.options)) options = random.options;
                else {
                    try { options = JSON.parse(random.options); } 
                    catch { options = random.options.split(',').map(s => s.trim()); }
                }
            }
            
            console.log(`✅ Local fallback success! Question: ${random.question_text?.substring(0, 50)}...`);
            
            return {
                source: 'local',
                language: 'ar',
                question: random.question_text,
                options,
                correct_answer: random.correct_answer,
            };
        } catch (localError) {
            console.error('❌ Local fallback also failed:', localError);
            throw new Error('No questions available');
        }
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
    const [showAnswerModal, setShowAnswerModal] = useState(false);
    const [language, setLanguage] = useState<'auto' | 'ar' | 'en'>('auto');
    const MAX_GUESSES = 5;
    const BASE_POINTS = 20;

    const difficultyOptions = [
        { key: 'easy', label: 'سهل', labelEn: 'Easy', points: 5, time: 12 },
        { key: 'medium', label: 'متوسط', labelEn: 'Medium', points: 10, time: 14 },
        { key: 'hard', label: 'صعب', labelEn: 'Hard', points: 15, time: 17 },
        { key: 'expert', label: 'صعب جداً', labelEn: 'Expert', points: 20, time: 20 },
    ];

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

    // الحصول على اللغة الفعلية المستخدمة
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
            playSound('win');
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#10b981', '#f59e0b', '#8b5cf6'] });
            toast.success('🎉 أحسنت! فتحت الخزنة!', { duration: 2000 });
            setPhase('difficulty');
        } else if (newGuesses.length >= MAX_GUESSES) {
            playSound('lose');
            toast.error(`💔 الكود الصحيح كان: ${secretCode}`, { duration: 3000 });
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
            console.log(`🚀 Starting to fetch question: difficulty=${difficulty}, language=${effectiveLang}`);
            const q = await fetchQuestionWithAI(employee.specialty, difficulty, effectiveLang);
            console.log('✅ Question loaded successfully:', q.source, 'Language:', q.language);
            setBonusQuestion(q);
            const selected = difficultyOptions.find(opt => opt.key === difficulty);
            setTimeLeft(selected?.time || 15);
        } catch (err) {
            console.error('❌ Failed to load bonus question:', err);
            toast.error('فشل تحميل السؤال، سيتم إنهاء اللعبة');
            onComplete(BASE_POINTS, true);
            resetGame();
        } finally {
            setLoading(false);
        }
    };

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
            setShowAnswerModal(true);
        }, 1500);
        onComplete(BASE_POINTS, true);
    };

    const handleBonusAnswer = (answer: string) => {
        if (phase !== 'question' || !bonusQuestion) return;
        const isCorrect = answer.trim().toLowerCase() === bonusQuestion.correct_answer.trim().toLowerCase();
        const difficultyPoints = difficultyOptions.find(opt => opt.key === selectedDifficulty)?.points || 0;
        const bonusPoints = isCorrect ? difficultyPoints : 0;
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
            setShowAnswerModal(true);
        }, 1800);
        onComplete(totalPoints, isCorrect);
    };

    const closeModalAndReset = () => {
        setShowAnswerModal(false);
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
    };

    // تنسيق عرض اللغة
    const getLanguageDisplay = () => {
        if (language === 'ar') return '🇸🇦 عربي';
        if (language === 'en') return '🇬🇧 English';
        return needsMedicalEnglish() ? '🇬🇧 English (تلقائي)' : '🇸🇦 عربي (تلقائي)';
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
                    <div className="flex gap-2">
                        <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-full hover:bg-gray-100 transition">
                            {soundEnabled ? <Volume2 className="w-5 h-5 text-gray-600" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
                        </button>
                        <button
                            onClick={() => {
                                const options: ('auto' | 'ar' | 'en')[] = ['auto', 'ar', 'en'];
                                const currentIndex = options.indexOf(language);
                                const next = options[(currentIndex + 1) % options.length];
                                setLanguage(next);
                                toast.success(`اللغة: ${next === 'auto' ? 'تلقائي حسب التخصص' : next === 'ar' ? 'عربي' : 'English Medical'}`, { icon: '🌐' });
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-100 text-indigo-700 text-xs font-black hover:bg-indigo-200 transition"
                        >
                            <Globe className="w-3 h-3" />
                            {getLanguageDisplay()}
                        </button>
                    </div>
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
    // مرحلة اختيار مستوى السؤال
    // ─────────────────────────────────────────────────────────────────────────
    if (phase === 'difficulty') {
        const isEnglish = getEffectiveLanguage() === 'en';
        return (
            <div className="text-center py-12 animate-in fade-in duration-300" dir={isEnglish ? 'ltr' : 'rtl'}>
                <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md mx-auto">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-full hover:bg-gray-100 transition">
                            {soundEnabled ? <Volume2 className="w-5 h-5 text-gray-600" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
                        </button>
                        <div className="bg-emerald-50 rounded-xl px-4 py-2 text-center">
                            <p className="text-xs font-bold text-emerald-700">
                                {isEnglish ? 'Vault Points' : 'نقاط الخزنة'}
                            </p>
                            <p className="text-xl font-black text-emerald-800">+{BASE_POINTS}</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-6">
                        <Sparkles className="w-8 h-8 text-emerald-500" />
                        <h3 className="text-2xl font-black text-gray-800">
                            {isEnglish ? 'Choose Question Difficulty' : 'اختر مستوى السؤال'}
                        </h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-6">
                        {isEnglish ? 'Higher difficulty = more bonus points' : 'كلما زادت الصعوبة، زادت النقاط الإضافية'}
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        {difficultyOptions.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => handleDifficultySelect(opt.key)}
                                className={`p-4 rounded-xl border-2 transition-all ${
                                    selectedDifficulty === opt.key
                                        ? 'border-emerald-500 bg-emerald-50 shadow-md'
                                        : 'border-gray-200 hover:border-emerald-300'
                                }`}
                            >
                                <p className="font-black text-gray-800">{isEnglish ? opt.labelEn : opt.label}</p>
                                <p className="text-sm font-bold text-emerald-600">+{opt.points} {isEnglish ? 'pts' : 'نقطة'}</p>
                                <p className="text-[10px] text-gray-400">{opt.time} {isEnglish ? 'seconds' : 'ثانية للإجابة'}</p>
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
    if (phase === 'question') {
        if (loading) {
            const isEnglish = getEffectiveLanguage() === 'en';
            return (
                <div className="text-center py-16">
                    <Loader2 className="w-16 h-16 text-emerald-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600 font-bold">
                        {isEnglish ? 'Preparing bonus question...' : 'جاري تحضير سؤال المكافأة...'}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                        {isEnglish ? 'Contacting AI...' : 'جاري الاتصال بالذكاء الاصطناعي...'}
                    </p>
                </div>
            );
        }
        if (bonusQuestion) {
            const options = Array.isArray(bonusQuestion.options) ? bonusQuestion.options : [];
            const selectedOpt = difficultyOptions.find(opt => opt.key === selectedDifficulty);
            const isEnglish = bonusQuestion.language === 'en';
            
            return (
                <>
                    <div className="text-center py-4 animate-in slide-in-from-right max-w-3xl mx-auto" dir={isEnglish ? 'ltr' : 'rtl'}>
                        <div className="flex justify-between items-center mb-6 px-4 flex-wrap gap-2">
                            <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-5 py-2 rounded-xl font-black shadow-lg flex items-center gap-2">
                                <Clock className="w-4 h-4 animate-pulse" /> {timeLeft} {isEnglish ? 'sec' : 'ثانية'}
                            </div>
                            <div className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-5 py-2 rounded-xl font-black shadow-lg flex items-center gap-2">
                                <Star className="w-4 h-4" /> {isEnglish ? 'Bonus' : 'مكافأة'}: +{selectedOpt?.points || 0} {isEnglish ? 'pts' : 'نقطة'}
                            </div>
                            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-5 py-2 rounded-xl font-black shadow-lg flex items-center gap-2">
                                <Sparkles className="w-4 h-4" /> {isEnglish ? selectedOpt?.labelEn : selectedOpt?.label}
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-8 rounded-3xl mb-8 border-2 border-emerald-200 shadow-xl relative">
                            <HelpCircle className="w-14 h-14 text-emerald-500 mx-auto mb-4 animate-bounce" />
                            <h3 className={`text-2xl font-black text-emerald-900 leading-relaxed ${isEnglish ? 'text-left' : 'text-right'}`}>
                                {bonusQuestion.question}
                            </h3>
                            <div className="flex flex-wrap justify-center gap-2 mt-4">
                                {bonusQuestion.source === 'ai' && (
                                    <p className="text-xs text-emerald-400 flex items-center justify-center gap-1 bg-emerald-50 px-3 py-1 rounded-full">
                                        <Sparkles className="w-3 h-3" /> {isEnglish ? 'Generated by' : 'تم توليده بواسطة'} {bonusQuestion.provider}
                                    </p>
                                )}
                                {bonusQuestion.source === 'local' && (
                                    <p className="text-xs text-amber-600 flex items-center justify-center gap-1 bg-amber-50 px-3 py-1 rounded-full">
                                        <AlertCircle className="w-3 h-3" /> {isEnglish ? 'From local question bank' : 'من بنك الأسئلة المحلي'}
                                    </p>
                                )}
                                <p className="text-xs text-gray-400 flex items-center justify-center gap-1 bg-gray-100 px-3 py-1 rounded-full">
                                    <Globe className="w-3 h-3" />
                                    {isEnglish ? 'Medical English' : 'العربية'}
                                </p>
                            </div>
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
                                    className="bg-white border-2 border-gray-200 p-5 rounded-2xl font-bold text-gray-800 hover:border-emerald-500 hover:bg-emerald-50 hover:scale-105 transition-all active:scale-95 shadow-md hover:shadow-xl text-lg text-right"
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* مودال عرض الإجابة الصحيحة */}
                    {showAnswerModal && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" dir={isEnglish ? 'ltr' : 'rtl'}>
                            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-xl font-black text-gray-800">
                                        {isEnglish ? 'Correct Answer' : 'الإجابة الصحيحة'}
                                    </h3>
                                    <button onClick={closeModalAndReset} className="p-1 hover:bg-gray-100 rounded-full transition">
                                        <X className="w-5 h-5 text-gray-500" />
                                    </button>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl mb-4">
                                    <p className="text-sm font-bold text-gray-500 mb-1">
                                        {isEnglish ? 'Question:' : 'السؤال:'}
                                    </p>
                                    <p className="text-gray-800 font-medium mb-3">{bonusQuestion?.question}</p>
                                    <p className="text-sm font-bold text-green-600 mb-1">
                                        {isEnglish ? 'Correct Answer:' : 'الإجابة الصحيحة:'}
                                    </p>
                                    <p className="text-green-700 font-bold text-lg">{bonusQuestion?.correct_answer}</p>
                                    {bonusQuestion?.explanation && (
                                        <>
                                            <p className="text-sm font-bold text-gray-500 mt-3 mb-1">
                                                {isEnglish ? 'Explanation:' : 'التفسير:'}
                                            </p>
                                            <p className="text-gray-600 text-sm">{bonusQuestion.explanation}</p>
                                        </>
                                    )}
                                </div>
                                <button
                                    onClick={closeModalAndReset}
                                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-black hover:scale-105 transition-all"
                                >
                                    {isEnglish ? 'Close' : 'إغلاق'}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            );
        }
    }

    return null;
}