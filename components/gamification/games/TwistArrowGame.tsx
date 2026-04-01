import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Target, CheckCircle, XCircle, Globe, Volume2, VolumeX, Loader2, ArrowRight, Star, Clock, Activity, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { Employee } from '../../../types';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
    employee?: Employee;
}

const LEVELS = [
    { id: 'easy', label: 'مبتدئ', pins: 10, speed: 2.2, points: 15, color: 'from-emerald-400 to-teal-500', reverse: false },
    { id: 'medium', label: 'مُتمرس', pins: 14, speed: 3.5, points: 25, color: 'from-blue-500 to-indigo-600', reverse: false },
    { id: 'hard', label: 'خبير ذكاء', pins: 18, speed: 4.5, points: 35, color: 'from-rose-500 to-red-600', reverse: true }
];

const BONUS_LEVELS = [{ id: 'سهل', points: 5, time: 15 }, { id: 'متوسط', points: 10, time: 20 }, { id: 'صعب', points: 15, time: 30 }];

export default function TwistArrowGame({ onStart, onComplete, employee }: Props) {
    const [phase, setPhase] = useState<'setup' | 'playing' | 'puzzle_solved' | 'loading_quiz' | 'quiz' | 'summary'>('setup');
    const [starting, setStarting] = useState(false);
    
    // Game Logic
    const [level, setLevel] = useState<typeof LEVELS[0]>(LEVELS[0]);
    const [rotation, setRotation] = useState(0);
    const [attachedPins, setAttachedPins] = useState<number[]>([]); 
    const [remainingPins, setRemainingPins] = useState(0);
    const [isGameOver, setIsGameOver] = useState(false);
    const [isVibrating, setIsVibrating] = useState(false);

    // Audio & Bonus
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [language, setLanguage] = useState<'auto' | 'ar' | 'en'>('auto');
    const [totalScore, setTotalScore] = useState(0);
    const [quizQuestion, setQuizQuestion] = useState<any>(null);
    const [selectedBonus, setSelectedBonus] = useState<typeof BONUS_LEVELS[0] | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);

    const requestRef = useRef<number>();
    const hitSoundRef = useRef<HTMLAudioElement | null>(null);
    const handleQuizAnswerRef = useRef<(idx: number) => void>();

    // ─── Preload Audio ────────────────────────────────────────────────────────
    useEffect(() => {
        hitSoundRef.current = new Audio('/click.mp3');
        hitSoundRef.current.volume = 0.4;
    }, []);

    const playSound = (type: 'win' | 'lose' | 'hit') => {
        if (!soundEnabled) return;
        try {
            if (type === 'hit' && hitSoundRef.current) {
                hitSoundRef.current.currentTime = 0;
                hitSoundRef.current.play().catch(() => {});
            } else {
                const audio = new Audio(type === 'win' ? '/applause.mp3' : '/fail.mp3');
                audio.play().catch(() => {});
            }
        } catch {}
    };

    const isMedical = ['بشر', 'أسنان', 'صيدل', 'اسره'].some(s => (employee?.job_title || '').includes(s) || (employee?.specialty || '').includes(s));
    const isEn = language === 'auto' ? isMedical : language === 'en';

    // ─── Game Engine ──────────────────────────────────────────────────────────
    const animate = useCallback(() => {
        if (phase === 'playing' && !isGameOver) {
            setRotation(prev => {
                let speed = level.speed;
                if (level.reverse) {
                    const cycle = Math.sin(Date.now() / 1500);
                    speed = level.speed * (cycle > 0.5 ? 1.5 : cycle < -0.5 ? -1.5 : 1);
                }
                return (prev + speed) % 360;
            });
            requestRef.current = requestAnimationFrame(animate);
        }
    }, [phase, isGameOver, level]);

    useEffect(() => {
        if (phase === 'playing') requestRef.current = requestAnimationFrame(animate);
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [phase, animate]);

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

    const shootPin = (e: React.PointerEvent | React.MouseEvent) => {
        if (isGameOver || remainingPins <= 0 || phase !== 'playing') return;

        // زاوية الارتطام هي 90 درجة (الأسفل) ناقص زاوية دوران الخلية
        const hitAngle = (90 - rotation + 360) % 360;

        const isCollision = attachedPins.some(pinAngle => {
            const diff = Math.abs(pinAngle - hitAngle);
            return diff < 14 || diff > 346; // مسافة الأمان بين الإبر
        });

        if (isCollision) {
            handleLose();
        } else {
            playSound('hit');
            setAttachedPins(prev => [...prev, hitAngle]);
            setRemainingPins(prev => prev - 1);
            if (remainingPins === 1) handleWin();
        }
    };

    const handleWin = () => {
        setIsGameOver(true);
        playSound('win');
        confetti({ particleCount: 200, spread: 80, origin: { y: 0.7 } });
        setTotalScore(level.points);
        setTimeout(() => setPhase('puzzle_solved'), 1200);
    };

    const handleLose = () => {
        setIsGameOver(true);
        setIsVibrating(true);
        playSound('lose');
        if (navigator.vibrate) navigator.vibrate(200);
        toast.error(isEn ? 'Contamination! Needle collision!' : 'تلوث! الإبر اصطدمت ببعضها');
        setTimeout(() => {
            setIsVibrating(false);
            onComplete(0, false);
        }, 1500);
    };

    // ─── Bonus AI Logic (Same as before but with safe parsing) ───────────────
    const fetchAIQuestion = async (bonus: typeof BONUS_LEVELS[0]) => {
        setSelectedBonus(bonus);
        setPhase('loading_quiz');
        try {
            const { data } = await supabase.functions.invoke('generate-smart-quiz', {
                body: {
                    specialty: employee?.job_title || employee?.specialty || 'طبيب بشرى',
                    domain: 'طبي وعلمي', difficulty: bonus.id,
                    length: 'قصير', language: isEn ? 'English (Professional Medical Terminology)' : 'ar',
                    question_count: 5
                }
            });
            const q = Array.isArray(data) ? data[0] : (data.questions ? data.questions[0] : data);
            const charToIndex: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
            setQuizQuestion({
                question_text: q.question_text || q.question,
                options: q.options || [q.option_a, q.option_b, q.option_c, q.option_d],
                correct_index: charToIndex[q.correct_option || q.correct_answer] ?? 0,
                explanation: q.explanation
            });
            setTimeLeft(bonus.time);
            setPhase('quiz');
        } catch (err) { onComplete(totalScore, true); }
    };

    const handleQuizAnswer = useCallback((idx: number) => {
        if (selectedAnswer !== null) return;
        setSelectedAnswer(idx);
        if (idx === quizQuestion?.correct_index) {
            playSound('win');
            setTotalScore(prev => prev + selectedBonus!.points);
        } else playSound('lose');
        setPhase('summary');
    }, [selectedAnswer, quizQuestion, selectedBonus]);

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
    // واجهات اللعبة (Screens)
    // =======================================================================

    if (phase === 'setup') {
        return (
            <div className="text-center py-6 px-4 animate-in zoom-in-95 flex flex-col h-[85vh] bg-slate-50/50 rounded-[2.5rem]">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-800 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl rotate-12">
                    <Activity className="w-12 h-12 text-white animate-pulse" />
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-2">{isEn ? 'Cell Injector' : 'حقنة الخلية'}</h3>
                <p className="text-sm font-bold text-gray-500 mb-8 max-w-xs mx-auto leading-relaxed">
                    {isEn ? 'Sterilize the cell by injecting all vials. Precision is everything!' : 'قم بتطهير الخلية عن طريق حقن جميع الإبر. الدقة هي كل شيء!'}
                </p>

                <div className="grid grid-cols-1 gap-3 mb-8">
                    {LEVELS.map(lvl => (
                        <button key={lvl.id} onClick={() => setLevel(lvl)}
                            className={`p-5 rounded-2xl border-2 transition-all flex justify-between items-center ${level.id === lvl.id ? 'bg-white border-indigo-500 shadow-xl scale-105' : 'bg-white/50 border-gray-100 hover:border-indigo-200'}`}>
                            <div className="text-right">
                                <span className={`text-transparent bg-clip-text bg-gradient-to-r ${lvl.color} font-black text-xl block`}>{lvl.label}</span>
                                <span className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">{lvl.pins} VIALS | {lvl.points} PTS</span>
                            </div>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${level.id === lvl.id ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                                <Zap className={`w-5 h-5 ${level.id === lvl.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                            </div>
                        </button>
                    ))}
                </div>

                <div className="mt-auto flex flex-col gap-4">
                    <div className="flex justify-center gap-3">
                        <button onClick={() => setLanguage(l => l==='ar'?'en':(l==='en'?'auto':'ar'))} className="px-5 py-2 rounded-xl bg-white text-gray-700 text-xs font-black border border-gray-200 shadow-sm">
                            <Globe className="w-4 h-4 inline ml-1"/> {language.toUpperCase()}
                        </button>
                        <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2.5 rounded-xl bg-white border border-gray-200 shadow-sm">
                            {soundEnabled ? <Volume2 className="w-5 h-5 text-indigo-600" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
                        </button>
                    </div>
                    <button onClick={startGame} disabled={starting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-xl shadow-lg shadow-indigo-200 active:scale-95 transition-all">
                        {starting ? <Loader2 className="w-6 h-6 animate-spin mx-auto"/> : (isEn ? 'START MISSION' : 'ابدأ المهمة')}
                    </button>
                </div>
            </div>
        );
    }

    if (phase === 'playing') {
        return (
            <div 
                className={`max-w-md mx-auto flex flex-col h-[85vh] select-none touch-none transition-all ${isVibrating ? 'animate-shake' : ''}`} 
                onPointerDown={shootPin}
            >
                <div className="flex justify-between items-center p-6 shrink-0 z-50">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{isEn ? 'Remaining' : 'المتبقي'}</span>
                        <span className="text-4xl font-black text-indigo-600 tabular-nums">{remainingPins}</span>
                    </div>
                    <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                        <span className="text-xs font-black text-gray-600 uppercase tracking-widest">{level.label}</span>
                    </div>
                </div>

                {/* ساحة المعركة */}
                <div className="flex-1 relative flex items-center justify-center">
                    {/* الخلية المركزية (تصميم عضوي) */}
                    <div className="relative w-40 h-40 md:w-48 md:h-48 rounded-full z-20 flex items-center justify-center"
                         style={{ transform: `rotate(${rotation}deg)` }}>
                        
                        {/* جسم الخلية */}
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-800 rounded-full shadow-[inset_0_-10px_20px_rgba(0,0,0,0.4),0_20px_50px_rgba(79,70,229,0.3)] border-4 border-white/20 flex items-center justify-center overflow-hidden">
                            <div className="absolute w-20 h-20 bg-white/10 rounded-full blur-xl animate-pulse"></div>
                            <span className="text-white/20 font-black text-3xl italic tracking-tighter">CELL-X</span>
                        </div>
                        
                        {/* الإبر الملتصقة */}
                        {attachedPins.map((angle, i) => (
                            <div key={i} className="absolute w-1 h-36 md:h-44 origin-bottom"
                                 style={{ transform: `rotate(${angle}deg) translateY(-50%)`, bottom: '50%' }}>
                                {/* جسم الإبرة */}
                                <div className="w-1.5 h-20 md:h-24 bg-gradient-to-b from-gray-300 to-gray-500 rounded-full mx-auto relative">
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-4 bg-indigo-500/80 rounded-sm"></div>
                                </div>
                                {/* رأس الإبرة */}
                                <div className="w-3 h-3 bg-white border-2 border-indigo-600 rounded-full mx-auto -mt-1 shadow-md"></div>
                            </div>
                        ))}
                    </div>

                    {/* الإبرة المستعدة بالأسفل (Syringe Graphic) */}
                    {!isGameOver && remainingPins > 0 && (
                        <div className="absolute bottom-10 flex flex-col items-center animate-in slide-in-from-bottom-10 duration-300">
                             <div className="w-1 h-16 bg-gradient-to-t from-gray-400 to-gray-600 rounded-full mb-1"></div>
                             <div className="w-4 h-10 bg-indigo-500/20 border-2 border-indigo-500/50 rounded-lg flex flex-col items-center p-1 shadow-lg">
                                 <div className="w-full h-1 bg-indigo-500 rounded-full mb-1"></div>
                                 <div className="w-full h-1 bg-indigo-500 rounded-full opacity-50"></div>
                             </div>
                             <div className="w-6 h-2 bg-gray-800 rounded-full mt-1"></div>
                        </div>
                    )}
                </div>

                <div className="p-12 text-center">
                    <p className="text-gray-400 font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">
                        {isEn ? 'Tap anywhere to inject' : 'انقر في أي مكان للإطلاق'}
                    </p>
                </div>
            </div>
        );
    }

    if (phase === 'puzzle_solved') {
        return (
            <div className="text-center py-10 px-4 animate-in slide-in-from-bottom" dir="rtl">
                <div className="w-24 h-24 bg-emerald-100 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner rotate-12">
                    <CheckCircle className="w-12 h-12 text-emerald-600" />
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">{isEn ? 'Perfect Sterilization!' : 'تطهير كامل! 🎉'}</h3>
                <p className="text-lg font-bold text-gray-600 mb-8 leading-relaxed">
                    دقة مثالية في حقن الخلايا.<br/>
                    كسبت <span className="text-indigo-600">{level.points} نقطة</span>. ضاعفها الآن!
                </p>
                <div className="grid grid-cols-1 gap-3 max-w-sm mx-auto">
                    {BONUS_LEVELS.map(bonus => (
                        <button key={bonus.id} onClick={() => fetchAIQuestion(bonus)}
                            className="bg-white border-2 border-gray-100 p-5 rounded-2xl hover:border-indigo-500 hover:shadow-xl transition-all active:scale-95 flex justify-between items-center shadow-sm">
                            <span className="font-black text-gray-800">مكافأة {bonus.id}</span>
                            <span className="bg-indigo-50 text-indigo-700 font-black px-4 py-1.5 rounded-xl text-xs flex items-center gap-1">
                                <Star className="w-3.5 h-3.5 fill-current"/> +{bonus.points}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (phase === 'loading_quiz' || phase === 'quiz' || phase === 'summary') {
        // ... (نفس منطق الأسئلة السابق الموثوق)
        if (phase === 'loading_quiz') return (
            <div className="flex flex-col items-center justify-center py-32 text-indigo-600 animate-pulse text-center">
                <Loader2 className="w-16 h-16 mb-4 animate-spin mx-auto" />
                <p className="font-black text-xl tracking-tighter">جاري سحب عينة الأسئلة من المختبر...</p>
            </div>
        );

        const isEnglishQ = /^[A-Za-z]/.test(quizQuestion?.question_text || '');
        return (
            <div className="max-w-xl mx-auto w-full animate-in zoom-in-95 py-6 px-4" dir="rtl">
                {phase === 'summary' && (
                    <div className="text-center mb-8 bg-white p-8 rounded-[2.5rem] shadow-2xl border border-indigo-50">
                        <p className="text-gray-400 font-black text-xs uppercase mb-1">الرصيد المكتسب</p>
                        <h2 className="text-6xl font-black text-indigo-600 mb-6 tracking-tighter">{totalScore}</h2>
                        <button onClick={() => onComplete(totalScore, true)} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                            تحصيل النقاط <ArrowRight className="w-6 h-6" />
                        </button>
                    </div>
                )}
                
                {quizQuestion && (
                    <div className="bg-white rounded-[2rem] p-6 shadow-xl border-t-[12px] border-indigo-600">
                        <div className="flex justify-between items-center mb-6">
                            <span className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2">
                                <Star className="w-4 h-4 fill-current"/> +{selectedBonus?.points}
                            </span>
                            {phase === 'quiz' && (
                                <div className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 ${timeLeft <= 5 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-500'}`}>
                                    <Clock className="w-4 h-4"/> {timeLeft}s
                                </div>
                            )}
                        </div>

                        <h3 className={`text-xl font-black text-gray-800 leading-tight mb-8 ${isEnglishQ ? 'text-left' : 'text-right'}`} dir={isEnglishQ ? 'ltr' : 'rtl'}>
                            {quizQuestion.question_text}
                        </h3>

                        <div className="grid grid-cols-1 gap-3">
                            {quizQuestion.options.map((option: string, idx: number) => {
                                let btnClass = 'bg-slate-50 border-2 border-transparent text-gray-700 hover:bg-white hover:border-indigo-100';
                                if (phase === 'summary') {
                                    if (idx === quizQuestion.correct_index) btnClass = 'bg-emerald-500 border-emerald-600 text-white shadow-lg z-10 scale-105';
                                    else if (idx === selectedAnswer) btnClass = 'bg-red-500 border-red-600 text-white shadow-lg opacity-80';
                                    else btnClass = 'bg-gray-50 border-gray-100 opacity-40';
                                }
                                return (
                                    <button key={idx} onClick={() => handleQuizAnswerRef.current?.(idx)} disabled={phase === 'summary'}
                                        className={`${btnClass} p-5 rounded-2xl font-bold text-base transition-all flex items-center justify-between ${isEnglishQ ? 'text-left' : 'text-right'}`}>
                                        <span className="flex-1">{option}</span>
                                        {phase === 'summary' && idx === quizQuestion.correct_index && <CheckCircle className="w-6 h-6 ml-2"/>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return null;
}
