import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Target, CheckCircle, XCircle, Globe, Volume2, VolumeX, Loader2, ArrowRight, Star, Clock, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { Employee } from '../../../types';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
    employee?: Employee;
}

// ─── إعدادات المستويات ──────────────────────────────────────────────────────────
const LEVELS = [
    { id: 'easy', label: 'سهل', pins: 10, speed: 2, points: 15, color: 'from-emerald-500 to-teal-500', behavior: 'linear' },
    { id: 'medium', label: 'وسط', pins: 14, speed: 3.5, points: 25, color: 'from-blue-500 to-indigo-500', behavior: 'linear' },
    { id: 'hard', label: 'صعب 🔥', pins: 18, speed: 5, points: 35, color: 'from-rose-500 to-red-600', behavior: 'variable' }
];

const BONUS_LEVELS = [
    { id: 'سهل', points: 5, time: 15 },
    { id: 'متوسط', points: 10, time: 20 },
    { id: 'صعب', points: 15, time: 30 }
];

export default function TwistArrowGame({ onStart, onComplete, employee }: Props) {
    const [phase, setPhase] = useState<'setup' | 'playing' | 'puzzle_solved' | 'loading_quiz' | 'quiz' | 'summary'>('setup');
    const [starting, setStarting] = useState(false);
    
    // Game Logic State
    const [level, setLevel] = useState<typeof LEVELS[0]>(LEVELS[0]);
    const [rotation, setRotation] = useState(0);
    const [attachedPins, setAttachedPins] = useState<number[]>([]); // زوايا الإبر الملتصقة
    const [remainingPins, setRemainingPins] = useState(0);
    const [isGameOver, setIsGameOver] = useState(false);

    // Settings & Quiz
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [language, setLanguage] = useState<'auto' | 'ar' | 'en'>('auto');
    const [totalScore, setTotalScore] = useState(0);
    const [quizQuestion, setQuizQuestion] = useState<any>(null);
    const [selectedBonus, setSelectedBonus] = useState<typeof BONUS_LEVELS[0] | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);

    const requestRef = useRef<number>();
    const handleQuizAnswerRef = useRef<(idx: number) => void>();

    // ─── إعدادات اللغة ─────────────────────────────────────────────────────────
    const isMedical = ['بشر', 'أسنان', 'صيدل', 'اسره'].some(s => 
        (employee?.job_title || '').includes(s) || (employee?.specialty || '').includes(s)
    );
    const getEffectiveLanguage = useCallback(() => language === 'auto' ? (isMedical ? 'en' : 'ar') : language, [language, isMedical]);
    const isEn = getEffectiveLanguage() === 'en';

    const playSound = useCallback((type: 'win' | 'lose' | 'hit') => {
        if (!soundEnabled) return;
        try {
            const audio = new Audio(type === 'win' ? '/applause.mp3' : type === 'lose' ? '/fail.mp3' : '/click.mp3');
            audio.volume = type === 'hit' ? 0.3 : 0.6;
            audio.play().catch(() => {});
        } catch {}
    }, [soundEnabled]);

    // ─── حلقة الحركة (Animation Loop) ──────────────────────────────────────────
    const animate = useCallback(() => {
        if (phase === 'playing' && !isGameOver) {
            setRotation(prev => {
                let speed = level.speed;
                if (level.behavior === 'variable') {
                    // في المستوى الصعب تتغير السرعة والاتجاه بناءً على الوقت
                    const time = Date.now() / 1000;
                    speed = level.speed * Math.sin(time);
                }
                return (prev + speed) % 360;
            });
            requestRef.current = requestAnimationFrame(animate);
        }
    }, [phase, isGameOver, level]);

    useEffect(() => {
        if (phase === 'playing') {
            requestRef.current = requestAnimationFrame(animate);
        }
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [phase, animate]);

    // ─── بدء اللعبة ──────────────────────────────────────────────────────────
    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        
        setAttachedPins([]);
        setRemainingPins(level.pins);
        setRotation(0);
        setIsGameOver(false);
        setTotalScore(0);
        setPhase('playing');
        setStarting(false);
    };

    // ─── منطق إطلاق الإبرة ────────────────────────────────────────────────────
    const shootPin = () => {
        if (isGameOver || remainingPins <= 0 || phase !== 'playing') return;

        // الزاوية عند نقطة الاصطدام (دائماً الأسفل، أي 90 درجة بالنسبة للشاشة)
        // لكننا نحسبها بالنسبة لزاوية دوران الخلية الحالية
        const hitAngle = (90 - rotation + 360) % 360;

        // التحقق من التصادم مع الإبر الأخرى (نسمح بفرق 12 درجة)
        const isCollision = attachedPins.some(pinAngle => {
            const diff = Math.abs(pinAngle - hitAngle);
            return diff < 12 || diff > 348;
        });

        if (isCollision) {
            handleLose();
        } else {
            const newPins = [...attachedPins, hitAngle];
            setAttachedPins(newPins);
            setRemainingPins(prev => prev - 1);
            playSound('hit');

            if (remainingPins === 1) {
                handleWin();
            }
        }
    };

    const handleWin = () => {
        setIsGameOver(true);
        playSound('win');
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        setTotalScore(level.points);
        setTimeout(() => setPhase('puzzle_solved'), 1200);
    };

    const handleLose = () => {
        setIsGameOver(true);
        playSound('lose');
        toast.error(isEn ? 'Oops! Needles hit each other!' : 'للأسف! الإبر خبطت في بعضها');
        setTimeout(() => onComplete(0, false), 2000);
    };

    // ─── جلب سؤال الذكاء الاصطناعي ──────────────────────────────────────────
    const fetchAIQuestion = async (bonus: typeof BONUS_LEVELS[0]) => {
        setSelectedBonus(bonus);
        setPhase('loading_quiz');
        try {
            const { data } = await supabase.functions.invoke('generate-smart-quiz', {
                body: {
                    specialty: employee?.job_title || employee?.specialty || 'طبيب بشرى',
                    domain: 'طبي وعلمي',
                    difficulty: bonus.id,
                    length: 'قصير',
                    language: isEn ? 'English (Professional Medical Terminology)' : 'ar',
                    question_count: 5
                }
            });
            const q = Array.isArray(data) ? data[0] : data.questions[0];
            const charToIndex: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
            setQuizQuestion({
                question_text: q.question_text || q.question,
                options: q.options || [q.option_a, q.option_b, q.option_c, q.option_d],
                correct_index: charToIndex[q.correct_option || q.correct_answer] ?? 0,
                explanation: q.explanation
            });
            setTimeLeft(bonus.time);
            setPhase('quiz');
        } catch (err) {
            onComplete(totalScore, true);
        }
    };

    const handleQuizAnswer = useCallback((idx: number) => {
        if (selectedAnswer !== null) return;
        setSelectedAnswer(idx);
        if (idx === quizQuestion?.correct_index) {
            playSound('win');
            setTotalScore(prev => prev + selectedBonus!.points);
        } else {
            playSound('lose');
        }
        setPhase('summary');
    }, [selectedAnswer, quizQuestion, selectedBonus, playSound]);

    useEffect(() => { handleQuizAnswerRef.current = handleQuizAnswer; }, [handleQuizAnswer]);

    useEffect(() => {
        if (phase !== 'quiz' || selectedAnswer !== null) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(timer); handleQuizAnswerRef.current?.(-1); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [phase, selectedAnswer]);

    // =======================================================================
    // واجهات اللعبة 
    // =======================================================================

    if (phase === 'setup') {
        return (
            <div className="text-center py-6 px-4 animate-in zoom-in-95 flex flex-col h-[85vh]">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-700 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <Target className="w-12 h-12 text-white animate-pulse" />
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-2">{isEn ? 'Injection Hit' : 'حقنة الخلية'}</h3>
                <p className="text-sm font-bold text-gray-500 mb-8 max-w-xs mx-auto leading-relaxed">
                    {isEn ? 'Inject all needles into the rotating cell without hitting other needles!' : 'أطلق جميع الإبر داخل الخلية الدوارة، احذر من لمس الإبر الأخرى!'}
                </p>

                <div className="grid grid-cols-1 gap-3 mb-8">
                    {LEVELS.map(lvl => (
                        <button key={lvl.id} onClick={() => setLevel(lvl)}
                            className={`p-5 rounded-2xl border-2 transition-all flex justify-between items-center ${level.id === lvl.id ? 'bg-indigo-50 border-indigo-500 shadow-md scale-105' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                            <div className="text-right">
                                <span className={`text-transparent bg-clip-text bg-gradient-to-r ${lvl.color} font-black text-xl block`}>{lvl.label}</span>
                                <span className="text-[11px] text-gray-500 font-bold">{lvl.pins} إبرة | {lvl.points} نقطة</span>
                            </div>
                            <Zap className={`w-6 h-6 ${level.id === lvl.id ? 'text-indigo-600' : 'text-gray-300'}`} />
                        </button>
                    ))}
                </div>

                <div className="mt-auto flex flex-col gap-4">
                    <div className="flex justify-center gap-3">
                        <button onClick={() => setLanguage(l => l==='ar'?'en':(l==='en'?'auto':'ar'))} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-black border border-gray-200">{isEn ? 'English' : 'عربي'}</button>
                        <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-xl bg-gray-100 border border-gray-200">{soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}</button>
                    </div>
                    <button onClick={startGame} disabled={starting} className="w-full bg-gradient-to-r from-gray-900 to-indigo-900 text-white py-4 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all">
                        {starting ? <Loader2 className="w-6 h-6 animate-spin mx-auto"/> : (isEn ? 'START' : 'ابدأ الآن')}
                    </button>
                </div>
            </div>
        );
    }

    if (phase === 'playing') {
        return (
            <div className="max-w-md mx-auto flex flex-col h-[85vh] select-none" onPointerDown={shootPin}>
                <div className="flex justify-between items-center p-4 shrink-0">
                    <div className="bg-indigo-600 text-white px-4 py-2 rounded-2xl font-black text-xl shadow-lg">
                        {remainingPins}
                    </div>
                    <div className="text-gray-500 font-black text-sm uppercase tracking-widest">
                        {level.label}
                    </div>
                </div>

                {/* ساحة اللعب */}
                <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                    {/* الخلية الدوارة */}
                    <div className="relative w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-indigo-500 to-purple-700 rounded-full shadow-[0_0_50px_rgba(79,70,229,0.4)] z-20 flex items-center justify-center border-4 border-white/20"
                         style={{ transform: `rotate(${rotation}deg)` }}>
                        <div className="text-white font-black text-2xl md:text-3xl opacity-20">CELL</div>
                        
                        {/* الإبر الملتصقة */}
                        {attachedPins.map((angle, i) => (
                            <div key={i} className="absolute w-1 h-32 md:h-40 origin-bottom"
                                 style={{ transform: `rotate(${angle}deg) translateY(-50%)`, bottom: '50%' }}>
                                <div className="w-1 h-20 md:h-24 bg-gray-800 rounded-full mx-auto"></div>
                                <div className="w-3 h-3 bg-indigo-400 rounded-full mx-auto -mt-1 shadow-sm"></div>
                            </div>
                        ))}
                    </div>

                    {/* الإبرة التالية (تظهر في وضع الاستعداد بالأسفل) */}
                    {!isGameOver && remainingPins > 0 && (
                        <div className="absolute bottom-10 w-1 h-24 bg-gray-800 rounded-full animate-bounce">
                            <div className="w-3 h-3 bg-indigo-400 rounded-full mx-auto -mt-1 shadow-sm"></div>
                        </div>
                    )}
                </div>

                <div className="p-10 text-center text-gray-400 font-bold text-xs uppercase tracking-widest animate-pulse">
                    {isEn ? 'Tap to Inject' : 'انقر للإطلاق'}
                </div>
            </div>
        );
    }

    if (phase === 'puzzle_solved') {
        return (
            <div className="text-center py-10 px-4 animate-in slide-in-from-bottom" dir="rtl">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-12 h-12 text-emerald-600" />
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">{isEn ? 'Perfect Timing!' : 'دقة مذهلة! 🎉'}</h3>
                <p className="text-lg font-bold text-gray-600 mb-8">
                    نجحت في حقن جميع الإبر.<br/>
                    ضمنت {level.points} نقطة. ضاعفها الآن بسؤال الذكاء الاصطناعي!
                </p>
                <div className="grid grid-cols-1 gap-2 max-w-sm mx-auto">
                    {BONUS_LEVELS.map(bonus => (
                        <button key={bonus.id} onClick={() => fetchAIQuestion(bonus)}
                            className="bg-white border-2 border-emerald-200 p-4 rounded-xl hover:bg-emerald-50 transition-all active:scale-95 flex justify-between items-center shadow-sm">
                            <span className="font-black text-sm text-gray-800">مستوى {bonus.id}</span>
                            <span className="text-emerald-600 font-bold bg-emerald-100 px-3 py-1 rounded-lg text-xs">+{bonus.points} نقطة</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (phase === 'loading_quiz') {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-indigo-600 animate-pulse text-center">
                <Loader2 className="w-12 h-12 mb-4 animate-spin mx-auto" />
                <p className="font-black text-lg">جاري تحضير وثيقة المكافأة...</p>
            </div>
        );
    }

    if (phase === 'quiz' || phase === 'summary') {
        if (!quizQuestion) return null;
        const isEnglishQ = /^[A-Za-z]/.test(quizQuestion?.question_text || '');
        return (
            <div className="max-w-xl mx-auto w-full animate-in zoom-in-95 duration-300 py-4 px-2" dir="rtl">
                {phase === 'summary' && (
                    <div className="text-center mb-4 bg-gray-50 p-6 rounded-3xl border border-gray-200 shadow-sm">
                        <h2 className="text-xl font-black text-gray-800 mb-1">النقاط الإجمالية</h2>
                        <span className="text-5xl font-black text-indigo-600">{totalScore}</span>
                        <button onClick={() => onComplete(totalScore, true)} className="block w-full mt-6 bg-gray-900 text-white py-4 rounded-2xl font-black active:scale-95 transition-all text-sm shadow-xl">
                            إنهاء وجمع النقاط <ArrowRight className="inline w-5 h-5 ml-2" />
                        </button>
                    </div>
                )}

                <div className="bg-white rounded-3xl p-5 shadow-xl border-t-4 border-indigo-500">
                    <div className="flex justify-between items-center mb-4">
                        <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-black text-xs">مكافأة: +{selectedBonus?.points}</span>
                        {phase === 'quiz' && <span className="bg-gray-100 px-3 py-1.5 rounded-lg font-black text-xs text-red-500 animate-pulse flex items-center gap-1"><Clock className="w-3 h-3"/> {timeLeft}ث</span>}
                    </div>

                    <h3 className={`text-base font-black text-gray-800 leading-relaxed mb-6 ${isEnglishQ ? 'text-left' : 'text-right'}`} dir={isEnglishQ ? 'ltr' : 'rtl'}>
                        {quizQuestion?.question_text}
                    </h3>

                    <div className="grid grid-cols-1 gap-3">
                        {quizQuestion?.options.map((option: string, idx: number) => {
                            let btnClass = 'bg-white border-2 border-gray-100 text-gray-700 hover:border-indigo-300';
                            if (phase === 'summary') {
                                if (idx === quizQuestion.correct_index) btnClass = 'bg-emerald-500 border-emerald-600 text-white shadow-md';
                                else if (idx === selectedAnswer) btnClass = 'bg-red-500 border-red-600 text-white shadow-md';
                                else btnClass = 'bg-gray-50 border-gray-100 opacity-50';
                            }
                            return (
                                <button key={idx} onClick={() => handleQuizAnswerRef.current?.(idx)} disabled={phase === 'summary'}
                                    className={`${btnClass} p-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-between ${isEnglishQ ? 'text-left' : 'text-right'}`}>
                                    <span className="flex-1">{option}</span>
                                    {phase === 'summary' && idx === quizQuestion.correct_index && <CheckCircle className="w-5 h-5 ml-2"/>}
                                    {phase === 'summary' && idx === selectedAnswer && idx !== quizQuestion.correct_index && <XCircle className="w-5 h-5 ml-2"/>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
