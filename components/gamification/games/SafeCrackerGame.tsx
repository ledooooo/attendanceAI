import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Lock, HelpCircle, Clock, Star, Loader2, CheckCircle, XCircle, Sparkles, BrainCircuit, Delete, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { Employee } from '../../../types';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
    employee?: Employee;
}

// 🎛️ مستويات الخزنة
const SAFE_LEVELS = [
    { id: 'easy', label: 'خزنة بسيطة', digits: 3, attempts: 6, basePoints: 15, color: 'from-emerald-500 to-teal-600' },
    { id: 'medium', label: 'خزنة معقدة', digits: 4, attempts: 6, basePoints: 25, color: 'from-blue-500 to-indigo-600' },
    { id: 'hard', label: 'خزنة بنكية', digits: 4, attempts: 5, basePoints: 40, color: 'from-purple-600 to-violet-800' }
];

// 🎛️ مستويات سؤال الذكاء الاصطناعي (البونص)
const BONUS_LEVELS = [
    { id: 'سهل', points: 10, time: 20 },
    { id: 'متوسط', points: 20, time: 20 },
    { id: 'صعب', points: 30, time: 30 }
];

export default function SafeCrackerGame({ onStart, onComplete, employee }: Props) {
    // Game States
    const [phase, setPhase] = useState<'setup_safe' | 'playing_safe' | 'safe_cracked' | 'loading_quiz' | 'quiz' | 'summary'>('setup_safe');
    const [safeLevel, setSafeLevel] = useState<typeof SAFE_LEVELS[0] | null>(null);
    const [starting, setStarting] = useState(false);

    // Safe Mechanics
    const [secretCode, setSecretCode] = useState('');
    const [guesses, setGuesses] = useState<{ guess: string; feedback: string[] }[]>([]);
    const [currentGuess, setCurrentGuess] = useState('');

    // Quiz Mechanics
    const [quizQuestion, setQuizQuestion] = useState<any>(null);
    const [selectedBonus, setSelectedBonus] = useState<typeof BONUS_LEVELS[0] | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [totalScore, setTotalScore] = useState(0);

    const playSound = (type: 'win' | 'lose') => {
        try {
            const audio = new Audio(type === 'win' ? '/applause.mp3' : '/fail.mp3');
            audio.play();
        } catch (e) {}
    };

    const isMedicalEnglishSpecialty = ['بشر', 'أسنان', 'صيدل', 'اسره'].some(s => 
        (employee?.job_title || '').includes(s) || (employee?.specialty || '').includes(s)
    );

    // ─── 1. إعداد الخزنة ──────────────────────────────────
    const startSafe = async (level: typeof SAFE_LEVELS[0]) => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }

        let code = '';
        while (code.length < level.digits) {
            const r = Math.floor(Math.random() * 10); // أرقام من 0 لـ 9
            if (!code.includes(r.toString())) code += r; // بدون تكرار
        }
        
        setSafeLevel(level);
        setSecretCode(code);
        setGuesses([]);
        setCurrentGuess('');
        setTotalScore(0);
        setPhase('playing_safe');
        setStarting(false);
    };

    // ─── 2. منطق لوحة الأرقام للخزنة ──────────────────────
    const handleKeypad = (num: string) => {
        if (currentGuess.length < safeLevel!.digits) {
            setCurrentGuess(prev => prev + num);
        }
    };
    
    const handleDelete = () => setCurrentGuess(prev => prev.slice(0, -1));

    const submitGuess = () => {
        if (currentGuess.length !== safeLevel!.digits) {
            toast.error(`يجب إدخال ${safeLevel!.digits} أرقام!`);
            return;
        }
        
        const feedbackArr: string[] = [];
        for (let i = 0; i < safeLevel!.digits; i++) {
            if (currentGuess[i] === secretCode[i]) feedbackArr.push('green');
            else if (secretCode.includes(currentGuess[i])) feedbackArr.push('yellow');
            else feedbackArr.push('gray');
        }
        
        const newGuesses = [...guesses, { guess: currentGuess, feedback: feedbackArr }];
        setGuesses(newGuesses);
        setCurrentGuess('');

        if (currentGuess === secretCode) {
            playSound('win');
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            toast.success('🎉 الخزنة فُتحت بنجاح!');
            setTotalScore(safeLevel!.basePoints);
            setTimeout(() => setPhase('safe_cracked'), 1500);
        } else if (newGuesses.length >= safeLevel!.attempts) {
            playSound('lose');
            toast.error(`💔 الكود الصحيح كان: ${secretCode}`);
            setTimeout(() => onComplete(0, false), 2500);
        }
    };

    // ─── 3. جلب سؤال الذكاء الاصطناعي ──────────────────────
    const fetchAIQuestion = async (bonus: typeof BONUS_LEVELS[0]) => {
        setSelectedBonus(bonus);
        setPhase('loading_quiz');

        try {
            const { data, error } = await supabase.functions.invoke('generate-smart-quiz', {
                body: {
                    specialty: employee?.job_title || employee?.specialty || 'طبيب بشرى',
                    domain: 'طبي وعلمي',
                    difficulty: bonus.id,
                    length: 'قصير',
                    language: isMedicalEnglishSpecialty ? 'English (Professional Medical Terminology)' : 'ar',
                    include_hint: false,
                    game_type: 'mcq',
                    question_count: 1
                }
            });

            if (error || !data || data.length === 0) throw new Error('Fetch failed');

            const q = data[0];
            const charToIndex: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
            
            setQuizQuestion({
                question_text: q.question_text,
                options: [q.option_a, q.option_b, q.option_c, q.option_d],
                correct_index: charToIndex[q.correct_option?.toUpperCase()] ?? 0,
                explanation: q.explanation
            });
            
            setTimeLeft(bonus.time);
            setPhase('quiz');
        } catch (err) {
            toast.error('تعذر جلب السؤال الإضافي. سنكتفي بنقاط الخزنة!');
            onComplete(totalScore, true);
        }
    };

    // ─── 4. مؤقت السؤال وحله ───────────────────────────────
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (phase === 'quiz' && timeLeft > 0 && selectedAnswer === null) {
            timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (phase === 'quiz' && timeLeft === 0 && selectedAnswer === null) {
            handleQuizAnswer(-1); // انتهى الوقت
        }
        return () => clearInterval(timer);
    }, [phase, timeLeft, selectedAnswer]);

    const handleQuizAnswer = (idx: number) => {
        if (selectedAnswer !== null) return;
        setSelectedAnswer(idx);
        
        const isCorrect = idx === quizQuestion.correct_index;
        
        if (isCorrect) {
            playSound('win');
            confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 } });
            setTotalScore(prev => prev + selectedBonus!.points);
            toast.success(`إجابة صحيحة! +${selectedBonus!.points} نقطة`);
        } else {
            playSound('lose');
            toast.error('إجابة خاطئة!');
        }

        setPhase('summary');
    };

    // =======================================================================
    // واجهات المستخدم للعبة (Screens)
    // =======================================================================

    if (phase === 'setup_safe') {
        return (
            <div className="text-center py-10 animate-in zoom-in-95 px-4">
                <div className="w-24 h-24 bg-gradient-to-br from-gray-800 to-black rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <Lock className="w-12 h-12 text-gray-300" />
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">الخزنة السرية</h3>
                <p className="text-sm font-bold text-gray-500 mb-8 max-w-sm mx-auto">اختر مستوى الخزنة. كود من 3 أو 4 أرقام (بدون تكرار) يجب فكه في محاولات محددة.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                    {SAFE_LEVELS.map(lvl => (
                        <button
                            key={lvl.id}
                            onClick={() => startSafe(lvl)}
                            disabled={starting}
                            className={`bg-gradient-to-br ${lvl.color} text-white p-6 rounded-3xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50`}
                        >
                            <span className="block text-2xl mb-2">{lvl.label}</span>
                            <span className="block text-sm bg-white/20 px-3 py-1 rounded-full mb-1">🔢 {lvl.digits} أرقام | 🎯 {lvl.attempts} محاولات</span>
                            <span className="block mt-2">الجائزة الأساسية: {lvl.basePoints} نقطة</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (phase === 'playing_safe' && safeLevel) {
        return (
            <div className="max-w-md mx-auto py-6 px-4 animate-in slide-in-from-bottom text-center">
                <div className="flex justify-between items-center mb-6">
                    <div className="bg-gray-100 rounded-xl px-4 py-2 font-black text-gray-700">
                        محاولات: <span className="text-emerald-600">{safeLevel.attempts - guesses.length}</span>
                    </div>
                    <div className="flex gap-2 text-[10px] font-bold bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded"></span> صح</div>
                        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-500 rounded"></span> مكان خطأ</div>
                        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-400 rounded"></span> خطأ</div>
                    </div>
                </div>

                {/* شبكة التخمين */}
                <div className="space-y-3 mb-8">
                    {guesses.map((g, i) => (
                        <div key={i} className="flex justify-center gap-3" dir="ltr">
                            {g.guess.split('').map((num, idx) => (
                                <div key={idx} className={`w-12 h-12 flex items-center justify-center text-xl font-black text-white rounded-xl shadow-md ${
                                        g.feedback[idx] === 'green' ? 'bg-emerald-500' : g.feedback[idx] === 'yellow' ? 'bg-amber-500' : 'bg-gray-400'
                                }`}>
                                    {num}
                                </div>
                            ))}
                        </div>
                    ))}
                    {guesses.length < safeLevel.attempts && (
                        <div className="flex justify-center gap-3 animate-pulse" dir="ltr">
                            {[...Array(safeLevel.digits)].map((_, idx) => (
                                <div key={idx} className={`w-12 h-12 flex items-center justify-center text-2xl font-black rounded-xl border-4 ${
                                    currentGuess.length > idx ? 'border-gray-800 text-gray-800' : 'border-gray-200 text-transparent'
                                }`}>
                                    {currentGuess[idx] || '_'}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* لوحة الأرقام التفاعلية (Keypad) */}
                <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto mb-4" dir="ltr">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button key={num} onClick={() => handleKeypad(num.toString())}
                            className="bg-white border-2 border-gray-200 h-14 rounded-xl text-2xl font-black text-gray-700 hover:bg-gray-50 active:scale-90 shadow-sm transition-all"
                        >{num}</button>
                    ))}
                    <button onClick={handleDelete} className="bg-red-50 border-2 border-red-200 text-red-600 h-14 rounded-xl flex items-center justify-center hover:bg-red-100 active:scale-90 transition-all">
                        <Delete className="w-6 h-6" />
                    </button>
                    <button onClick={() => handleKeypad('0')} className="bg-white border-2 border-gray-200 h-14 rounded-xl text-2xl font-black text-gray-700 hover:bg-gray-50 active:scale-90 shadow-sm transition-all">
                        0
                    </button>
                    <button onClick={submitGuess} className="bg-emerald-500 text-white border-2 border-emerald-600 h-14 rounded-xl flex items-center justify-center hover:bg-emerald-600 active:scale-90 shadow-md transition-all">
                        <Check className="w-8 h-8" />
                    </button>
                </div>
            </div>
        );
    }

    if (phase === 'safe_cracked') {
        return (
            <div className="text-center py-10 animate-in slide-in-from-bottom">
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Lock className="w-12 h-12 text-emerald-600" />
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">عمل رائع! فُتحت الخزنة 💰</h3>
                <p className="text-lg font-bold text-gray-600 mb-8">لقد ضمنت <span className="text-emerald-600">{safeLevel?.basePoints} نقطة</span>. وجدنا بداخل الخزنة وثيقة سرية (سؤال ذكاء اصطناعي). اختر مستوى صعوبته لمضاعفة نقاطك!</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl mx-auto px-4">
                    {BONUS_LEVELS.map(bonus => (
                        <button key={bonus.id} onClick={() => fetchAIQuestion(bonus)}
                            className="bg-white border-2 border-emerald-200 p-5 rounded-2xl hover:bg-emerald-50 transition-all hover:scale-105 shadow-md flex flex-col items-center"
                        >
                            <span className="font-black text-lg text-gray-800 mb-1">مستوى {bonus.id}</span>
                            <span className="text-emerald-600 font-bold bg-emerald-100 px-3 py-1 rounded-full text-sm">+{bonus.points} نقطة إضافية</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (phase === 'loading_quiz') {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-emerald-600 animate-pulse text-center">
                <BrainCircuit className="w-16 h-16 mb-4 animate-bounce mx-auto" />
                <p className="font-black text-xl">جاري استخراج الوثيقة السرية...</p>
                <p className="text-sm font-bold text-gray-500 mt-2">يتم إعداد سؤال الـ AI لك الآن</p>
            </div>
        );
    }

    if (phase === 'quiz' || phase === 'summary') {
        const isEnglish = /^[A-Za-z]/.test(quizQuestion.question_text);
        return (
            <div className="max-w-2xl mx-auto w-full animate-in zoom-in-95 duration-300 py-6">
                {phase === 'summary' && (
                    <div className="text-center mb-8 bg-gray-50 p-6 rounded-3xl border border-gray-200">
                        <h2 className="text-2xl font-black text-gray-800 mb-2">إجمالي النقاط المكتسبة</h2>
                        <span className="text-4xl font-black text-emerald-500">{totalScore}</span>
                        <button onClick={() => onComplete(totalScore, true)} className="block w-full mt-6 bg-gray-800 text-white py-3 rounded-xl font-bold hover:bg-gray-900 transition-all">
                            إنهاء وجمع النقاط
                        </button>
                    </div>
                )}

                <div className="flex justify-between items-center mb-6 px-4">
                    <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl font-black text-sm flex items-center gap-2">
                        <Star className="w-4 h-4"/> مكافأة: +{selectedBonus?.points}
                    </div>
                    {phase === 'quiz' && (
                        <div className={`px-4 py-2 rounded-xl font-black flex items-center gap-2 ${timeLeft <= 5 ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-700'}`}>
                            <Clock className="w-4 h-4" /> {timeLeft} ث
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-[2rem] p-6 shadow-xl border-t-8 border-emerald-500">
                    <h3 className={`text-lg md:text-xl font-black text-gray-800 leading-relaxed mb-6 ${isEnglish ? 'text-left' : 'text-right'}`} dir={isEnglish ? 'ltr' : 'rtl'}>
                        {quizQuestion.question_text}
                    </h3>

                    <div className="grid grid-cols-1 gap-3" dir={isEnglish ? 'ltr' : 'rtl'}>
                        {quizQuestion.options.map((option: string, idx: number) => {
                            let btnClass = 'bg-white border-2 border-gray-100 text-gray-700 hover:border-emerald-300 hover:bg-emerald-50';
                            if (phase === 'summary') {
                                if (idx === quizQuestion.correct_index) btnClass = 'bg-emerald-500 border-emerald-600 text-white shadow-lg';
                                else if (idx === selectedAnswer) btnClass = 'bg-red-500 border-red-600 text-white shadow-lg';
                                else btnClass = 'bg-gray-50 border-gray-100 text-gray-400 opacity-50';
                            }
                            return (
                                <button key={idx} onClick={() => handleQuizAnswer(idx)} disabled={phase === 'summary'}
                                    className={`${btnClass} p-4 rounded-2xl font-bold text-sm md:text-base transition-all flex items-center justify-between ${isEnglish ? 'text-left' : 'text-right'}`}
                                >
                                    <span>{option}</span>
                                    {phase === 'summary' && idx === quizQuestion.correct_index && <CheckCircle className="w-5 h-5 flex-shrink-0 ml-2"/>}
                                    {phase === 'summary' && idx === selectedAnswer && idx !== quizQuestion.correct_index && <XCircle className="w-5 h-5 flex-shrink-0 ml-2"/>}
                                </button>
                            );
                        })}
                    </div>

                    {phase === 'summary' && quizQuestion.explanation && (
                        <div className="mt-6 p-4 rounded-xl text-sm font-bold bg-blue-50 text-blue-800 border border-blue-200" dir={isEnglish ? 'ltr' : 'rtl'}>
                            <span className="block mb-1 opacity-70">📚 {isEnglish ? 'Explanation:' : 'المراجعة التعليمية:'}</span>
                            {quizQuestion.explanation}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null;
}
