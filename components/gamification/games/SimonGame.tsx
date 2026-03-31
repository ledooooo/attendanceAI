import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Brain, CheckCircle, XCircle, Globe, Volume2, VolumeX, Sparkles, Loader2, ArrowRight, Star, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { Employee } from '../../../types';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
    employee?: Employee;
}

// ─── إعدادات اللعبة ─────────────────────────────────────────────────────────────
const LEVELS = [
    { id: 'easy', label: 'سهل', rounds: 6, points: 20, color: 'from-emerald-500 to-teal-500' },
    { id: 'medium', label: 'متوسط', rounds: 10, points: 30, color: 'from-blue-500 to-indigo-500' },
    { id: 'hard', label: 'صعب', rounds: 14, points: 40, color: 'from-orange-500 to-red-500' }
];

const BONUS_LEVELS = [
    { id: 'سهل', points: 10, time: 20 },
    { id: 'متوسط', points: 20, time: 20 },
    { id: 'صعب', points: 30, time: 30 }
];

// ألوان سيمون الأصلية وترددات الأصوات
const SIMON_BUTTONS = [
    { id: 0, normal: 'bg-emerald-500', active: 'bg-emerald-300 brightness-125 shadow-[0_0_30px_rgba(16,185,129,0.8)]', freq: 415.3, shape: 'rounded-tl-full' }, // أخضر
    { id: 1, normal: 'bg-rose-500', active: 'bg-rose-300 brightness-125 shadow-[0_0_30px_rgba(244,63,94,0.8)]', freq: 311.1, shape: 'rounded-tr-full' }, // أحمر
    { id: 2, normal: 'bg-amber-400', active: 'bg-amber-200 brightness-125 shadow-[0_0_30px_rgba(251,191,36,0.8)]', freq: 254.0, shape: 'rounded-bl-full' }, // أصفر
    { id: 3, normal: 'bg-blue-500', active: 'bg-blue-300 brightness-125 shadow-[0_0_30px_rgba(59,130,246,0.8)]', freq: 207.6, shape: 'rounded-br-full' }, // أزرق
];

export default function SimonGame({ onStart, onComplete, employee }: Props) {
    const [phase, setPhase] = useState<'setup' | 'playing' | 'puzzle_solved' | 'loading_quiz' | 'quiz' | 'summary'>('setup');
    const [starting, setStarting] = useState(false);
    
    // Simon State
    const [level, setLevel] = useState<typeof LEVELS[0]>(LEVELS[0]);
    const [sequence, setSequence] = useState<number[]>([]);
    const [playerSequence, setPlayerSequence] = useState<number[]>([]);
    const [isPlayerTurn, setIsPlayerTurn] = useState(false);
    const [activeButton, setActiveButton] = useState<number | null>(null);
    const [round, setRound] = useState(0);
    
    // Settings & Quiz
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [language, setLanguage] = useState<'auto' | 'ar' | 'en'>('auto');
    const [totalScore, setTotalScore] = useState(0);
    const [quizQuestion, setQuizQuestion] = useState<any>(null);
    const [selectedBonus, setSelectedBonus] = useState<typeof BONUS_LEVELS[0] | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);

    const handleQuizAnswerRef = useRef<(idx: number) => void>();
    const audioCtxRef = useRef<AudioContext | null>(null);

    // ─── إعدادات اللغة ─────────────────────────────────────────────────────────
    const isMedicalEnglishSpecialty = ['بشر', 'أسنان', 'صيدل', 'اسره', 'معمل', 'تمريض'].some(s => 
        (employee?.job_title || '').includes(s) || (employee?.specialty || '').includes(s)
    );

    const getEffectiveLanguage = useCallback((): 'ar' | 'en' => {
        if (language === 'ar') return 'ar';
        if (language === 'en') return 'en';
        return isMedicalEnglishSpecialty ? 'en' : 'ar';
    }, [language, isMedicalEnglishSpecialty]);

    const isEn = getEffectiveLanguage() === 'en';

    // ─── نظام الصوت (Web Audio API) ──────────────────────────────────────────
    const initAudio = () => {
        if (!audioCtxRef.current) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioCtxRef.current = new AudioContextClass();
        }
    };

    const playBeep = useCallback((freq: number, duration = 300) => {
        if (!soundEnabled) return;
        initAudio();
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = freq;
        gainNode.gain.setValueAtTime(1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + duration / 1000);
    }, [soundEnabled]);

    const playSystemSound = useCallback((type: 'win' | 'lose') => {
        if (!soundEnabled) return;
        try { new Audio(type === 'win' ? '/applause.mp3' : '/fail.mp3').play().catch(() => {}); } catch {}
    }, [soundEnabled]);

    // ─── منطق اللعبة ──────────────────────────────────────────────────────────
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    const startGame = async () => {
        setStarting(true);
        initAudio(); // تهيئة الصوت عند تفاعل المستخدم
        try { await onStart(); } catch { setStarting(false); return; }
        
        setSequence([]);
        setPlayerSequence([]);
        setRound(1);
        setTotalScore(0);
        setPhase('playing');
        setStarting(false);
    };

    // دور النظام في عرض التسلسل
    const playSequence = async (currentSeq: number[]) => {
        setIsPlayerTurn(false);
        await delay(800); // راحة قصيرة قبل بدء العرض
        
        for (let i = 0; i < currentSeq.length; i++) {
            const btnId = currentSeq[i];
            const btnObj = SIMON_BUTTONS.find(b => b.id === btnId);
            
            setActiveButton(btnId);
            if (btnObj) playBeep(btnObj.freq, 400);
            
            await delay(400); // مدة إضاءة الزر
            setActiveButton(null);
            await delay(250); // فاصل بين الأزرار
        }
        setIsPlayerTurn(true);
    };

    // إضافة زر جديد للتسلسل عند بداية كل جولة
    useEffect(() => {
        if (phase === 'playing' && round > 0 && sequence.length < round) {
            const nextButton = Math.floor(Math.random() * 4);
            const newSeq = [...sequence, nextButton];
            setSequence(newSeq);
            playSequence(newSeq);
        }
    }, [phase, round, sequence]);

    // ضغط اللاعب
    const handlePlayerClick = async (btnId: number) => {
        if (!isPlayerTurn) return;
        
        const btnObj = SIMON_BUTTONS.find(b => b.id === btnId);
        if (btnObj) playBeep(btnObj.freq, 300);
        
        setActiveButton(btnId);
        setTimeout(() => setActiveButton(null), 300);

        const newPlayerSeq = [...playerSequence, btnId];
        setPlayerSequence(newPlayerSeq);

        const currentIndex = newPlayerSeq.length - 1;

        // فحص الخطأ
        if (newPlayerSeq[currentIndex] !== sequence[currentIndex]) {
            setIsPlayerTurn(false);
            playSystemSound('lose');
            toast.error(isEn ? 'Wrong sequence!' : 'تسلسل خاطئ!');
            setTimeout(() => onComplete(0, false), 2500);
            return;
        }

        // فحص اكتمال الجولة بنجاح
        if (newPlayerSeq.length === sequence.length) {
            setIsPlayerTurn(false);
            if (round === level.rounds) {
                // الفوز باللعبة
                playSystemSound('win');
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                setTotalScore(level.points);
                toast.success(isEn ? 'Incredible Memory!' : 'ذاكرة فوتوغرافية مذهلة!');
                setTimeout(() => setPhase('puzzle_solved'), 1500);
            } else {
                // التقدم للجولة التالية
                setTimeout(() => {
                    setPlayerSequence([]);
                    setRound(r => r + 1);
                }, 1000);
            }
        }
    };

    // ─── 3. جلب سؤال الذكاء الاصطناعي الإضافي ──────────────────────────────────
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
                    language: isEn ? 'English (Professional Medical Terminology)' : 'ar',
                    include_hint: false,
                    game_type: 'mcq',
                    question_count: 5 
                }
            });

            if (error || !data) throw new Error('Fetch failed');

            let qArray = Array.isArray(data) ? data : data.questions || [data];
            if (qArray.length === 0) throw new Error('No questions returned');

            const q = qArray[0]; 
            const charToIndex: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
            const safeOptions = Array.isArray(q.options) && q.options.length >= 4 ? q.options : [q.option_a, q.option_b, q.option_c, q.option_d];

            setQuizQuestion({
                question_text: q.question_text || q.question,
                options: safeOptions,
                correct_index: charToIndex[q.correct_option || q.correct_answer] ?? 0,
                explanation: q.explanation
            });
            
            setTimeLeft(bonus.time);
            setPhase('quiz');
        } catch (err) {
            toast.error('تم الاحتفاظ بالنقاط الأساسية!');
            onComplete(totalScore, true);
        }
    };

    const handleQuizAnswer = useCallback((idx: number) => {
        if (selectedAnswer !== null) return;
        setSelectedAnswer(idx);
        
        if (idx === quizQuestion?.correct_index) {
            playSystemSound('win');
            confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 } });
            setTotalScore(prev => prev + selectedBonus!.points);
        } else {
            playSystemSound('lose');
        }
        setPhase('summary');
    }, [selectedAnswer, quizQuestion, selectedBonus, playSystemSound]);

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
            <div className="text-center py-4 px-2 animate-in zoom-in-95 flex flex-col h-[85vh] overflow-y-auto pb-10">
                <div className="w-20 h-20 bg-gradient-to-br from-gray-800 to-black rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shrink-0 border border-gray-700">
                    <Brain className="w-10 h-10 text-white animate-pulse" />
                </div>
                <h3 className="text-2xl font-black text-gray-800 mb-2">{isEn ? 'Simon Says' : 'الذاكرة التتابعية'}</h3>
                <p className="text-xs font-bold text-gray-500 mb-6 max-w-sm mx-auto leading-relaxed">
                    {isEn ? 'Watch the sequence of colors and repeat it. The pattern gets longer each round!' : 'راقب تسلسل الألوان وأعد تكراره بنفس الترتيب. النمط يزداد طولاً في كل جولة!'}
                </p>

                <h4 className="text-sm font-black text-gray-800 mb-2 text-right">اختر المستوى:</h4>
                <div className="grid grid-cols-1 gap-3 mb-6">
                    {LEVELS.map(lvl => (
                        <button key={lvl.id} onClick={() => setLevel(lvl)}
                            className={`p-4 rounded-2xl border-2 transition-all flex justify-between items-center ${level.id === lvl.id ? 'bg-gray-50 border-gray-800 shadow-md' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                            <div className="text-right">
                                <span className={`text-transparent bg-clip-text bg-gradient-to-r ${lvl.color} font-black text-lg block`}>{lvl.label}</span>
                                <span className="text-[10px] text-gray-500 font-bold">{lvl.rounds} جولات | {lvl.points} نقطة</span>
                            </div>
                            <Brain className={`w-6 h-6 ${level.id === lvl.id ? 'text-gray-800' : 'text-gray-300'}`} />
                        </button>
                    ))}
                </div>

                <div className="flex justify-center gap-2 mb-6">
                    <button onClick={() => setLanguage(l => l==='ar'?'en':(l==='en'?'auto':'ar'))} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-black border border-gray-200">
                        <Globe className="w-4 h-4" /> {isEn ? 'English' : 'عربي'}
                    </button>
                    <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-xl hover:bg-gray-100 bg-gray-50 border border-gray-200">
                        {soundEnabled ? <Volume2 className="w-4 h-4 text-gray-600" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                    </button>
                </div>

                <button onClick={startGame} disabled={starting} className="w-full max-w-sm mx-auto mt-auto bg-gray-900 text-white py-4 rounded-2xl font-black text-base shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2 shrink-0">
                    {starting ? <Loader2 className="w-6 h-6 animate-spin"/> : '🎮 ابدأ التحدي الآن'}
                </button>
            </div>
        );
    }

    if (phase === 'playing') {
        return (
            <div className="max-w-md mx-auto flex flex-col h-[85vh] animate-in slide-in-from-bottom" dir="rtl">
                
                <div className="text-center mb-10 mt-4 shrink-0">
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">{isEn ? 'Round' : 'الجولة'}</p>
                    <p className="text-4xl font-black text-gray-800">{round} <span className="text-lg text-gray-400">/ {level.rounds}</span></p>
                </div>

                {/* جهاز اللعبة الدائري */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="relative w-[280px] h-[280px] md:w-[320px] md:h-[320px] bg-gray-900 rounded-full p-3 md:p-4 shadow-[0_20px_50px_rgba(0,0,0,0.3)] grid grid-cols-2 gap-2 md:gap-3">
                        
                        {/* الشاشة المركزية */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-gray-800 rounded-full z-10 flex flex-col items-center justify-center shadow-inner border-[6px] border-gray-900">
                            <span className={`text-[10px] font-black uppercase transition-all duration-300 ${!isPlayerTurn ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`}>
                                {!isPlayerTurn ? (isEn ? 'WATCH' : 'راقب') : (isEn ? 'PLAY' : 'العب')}
                            </span>
                        </div>

                        {/* الأزرار الأربعة */}
                        {SIMON_BUTTONS.map((btn) => {
                            const isActive = activeButton === btn.id;
                            return (
                                <button
                                    key={btn.id}
                                    disabled={!isPlayerTurn}
                                    onPointerDown={() => handlePlayerClick(btn.id)}
                                    className={`w-full h-full ${btn.shape} transition-all duration-150 border-4 border-gray-900/50 
                                        ${isActive ? btn.active : btn.normal} 
                                        ${isPlayerTurn ? 'hover:brightness-110 active:scale-95' : 'cursor-not-allowed'}`}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    if (phase === 'puzzle_solved') {
        return (
            <div className="text-center py-8 px-4 animate-in slide-in-from-bottom" dir="rtl">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-black text-gray-800 mb-2">ذاكرة حديدية! 🎉</h3>
                <p className="text-sm font-bold text-gray-600 mb-6">
                    نجحت في إكمال {level.rounds} جولات معقدة.<br/><br/>
                    ضمنت {level.points} نقطة. ضاعفها الآن بسؤال ذكاء اصطناعي!
                </p>
                <div className="grid grid-cols-1 gap-2 max-w-sm mx-auto">
                    {BONUS_LEVELS.map(bonus => (
                        <button key={bonus.id} onClick={() => fetchAIQuestion(bonus)}
                            className="bg-white border-2 border-emerald-200 p-4 rounded-xl hover:bg-emerald-50 transition-all active:scale-95 flex justify-between items-center">
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
            <div className="flex flex-col items-center justify-center py-20 text-gray-800 animate-pulse text-center">
                <Loader2 className="w-12 h-12 mb-4 animate-spin mx-auto" />
                <p className="font-black text-lg">جاري سحب سؤال التحدي...</p>
            </div>
        );
    }

    if (phase === 'quiz' || phase === 'summary') {
        if (!quizQuestion) return null;
        const isEnglishQ = /^[A-Za-z]/.test(quizQuestion?.question_text || '');
        
        return (
            <div className="max-w-xl mx-auto w-full animate-in zoom-in-95 duration-300 py-4 px-2" dir="rtl">
                {phase === 'summary' && (
                    <div className="text-center mb-4 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                        <h2 className="text-lg font-black text-gray-800 mb-1">النقاط النهائية المكتسبة</h2>
                        <span className="text-4xl font-black text-emerald-500">{totalScore}</span>
                        <button onClick={() => onComplete(totalScore, true)} className="block w-full mt-4 bg-gray-800 text-white py-3 rounded-xl font-bold active:scale-95 transition-all text-sm">
                            إنهاء وجمع النقاط <ArrowRight className="inline w-4 h-4 ml-1" />
                        </button>
                    </div>
                )}

                <div className="bg-white rounded-3xl p-5 shadow-lg border-t-4 border-gray-800">
                    <div className="flex justify-between items-center mb-4">
                        <span className="bg-gray-100 text-gray-800 px-3 py-1.5 rounded-lg font-black text-xs">مكافأة: +{selectedBonus?.points}</span>
                        {phase === 'quiz' && <span className="bg-gray-100 px-3 py-1.5 rounded-lg font-black text-xs text-red-500 animate-pulse flex items-center gap-1"><Clock className="w-3 h-3"/> {timeLeft}ث</span>}
                    </div>

                    <h3 className={`text-base font-black text-gray-800 leading-relaxed mb-5 ${isEnglishQ ? 'text-left' : 'text-right'}`} dir={isEnglishQ ? 'ltr' : 'rtl'}>
                        {quizQuestion?.question_text}
                    </h3>

                    <div className="grid grid-cols-1 gap-2" dir={isEnglishQ ? 'ltr' : 'rtl'}>
                        {quizQuestion?.options.map((option: string, idx: number) => {
                            let btnClass = 'bg-white border-2 border-gray-100 text-gray-700 hover:border-gray-800 hover:bg-gray-50';
                            if (phase === 'summary') {
                                if (idx === quizQuestion.correct_index) btnClass = 'bg-emerald-500 border-emerald-600 text-white shadow-md';
                                else if (idx === selectedAnswer) btnClass = 'bg-red-500 border-red-600 text-white shadow-md';
                                else btnClass = 'bg-gray-50 border-gray-100 opacity-50';
                            }
                            return (
                                <button key={idx} onClick={() => handleQuizAnswerRef.current?.(idx)} disabled={phase === 'summary'}
                                    className={`${btnClass} p-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-between ${isEnglishQ ? 'text-left' : 'text-right'}`}>
                                    <span className="flex-1 leading-snug">{option}</span>
                                    {phase === 'summary' && idx === quizQuestion.correct_index && <CheckCircle className="w-4 h-4 flex-shrink-0 ml-2"/>}
                                    {phase === 'summary' && idx === selectedAnswer && idx !== quizQuestion.correct_index && <XCircle className="w-4 h-4 flex-shrink-0 ml-2"/>}
                                </button>
                            );
                        })}
                    </div>

                    {phase === 'summary' && quizQuestion?.explanation && (
                        <div className="mt-4 p-3 rounded-xl text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200" dir={isEnglishQ ? 'ltr' : 'rtl'}>
                            <span className="block mb-1 opacity-70">📚 التفسير:</span>
                            {quizQuestion.explanation}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null;
}
