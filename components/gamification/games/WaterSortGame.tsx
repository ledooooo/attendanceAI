import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Droplet, CheckCircle, XCircle, Globe, Volume2, VolumeX, Loader2, ArrowRight, Star, Clock, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { Employee } from '../../../types';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
    employee?: Employee;
}

// ─── الألوان المتاحة للسوائل مع تدرجات واقعية ────────────────────────────────
const COLORS = [
    'from-red-500 to-red-700',      // أحمر
    'from-blue-500 to-blue-700',    // أزرق
    'from-emerald-400 to-emerald-600', // أخضر
    'from-amber-400 to-orange-500', // برتقالي/أصفر
    'from-purple-500 to-purple-700',// بنفسجي
    'from-cyan-400 to-cyan-600'     // سماوي
];

// ─── المستويات (تم تقليل التايمر وتخفيض النقاط) ──────────────────────────────
const LEVELS = [
    { id: 'easy', label: 'سهل', colors: 3, empty: 2, time: 60, points: 10 },
    { id: 'medium', label: 'متوسط', colors: 4, empty: 2, time: 90, points: 15 },
    { id: 'hard', label: 'صعب', colors: 5, empty: 2, time: 120, points: 20 },
    { id: 'expert', label: 'خبير', colors: 6, empty: 2, time: 150, points: 25 }
];

// أقصى بونص = 15. أقصى مجموع (خبير + بونص صعب) = 25 + 15 = 40 نقطة
const BONUS_LEVELS = [
    { id: 'سهل', points: 5, time: 15 },
    { id: 'متوسط', points: 10, time: 20 },
    { id: 'صعب', points: 15, time: 30 }
];

export default function WaterSortGame({ onStart, onComplete, employee }: Props) {
    const [phase, setPhase] = useState<'setup' | 'playing' | 'puzzle_solved' | 'loading_quiz' | 'quiz' | 'summary'>('setup');
    const [starting, setStarting] = useState(false);
    
    // Water Sort Logic
    const [level, setLevel] = useState<typeof LEVELS[0]>(LEVELS[0]);
    const [tubes, setTubes] = useState<string[][]>([]);
    const [initialTubes, setInitialTubes] = useState<string[][]>([]); // للريست
    const [selectedTube, setSelectedTube] = useState<number | null>(null);
    const [moves, setMoves] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    
    // Quiz & Settings
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [language, setLanguage] = useState<'auto' | 'ar' | 'en'>('auto');
    const [totalScore, setTotalScore] = useState(0);
    const [quizQuestion, setQuizQuestion] = useState<any>(null);
    const [selectedBonus, setSelectedBonus] = useState<typeof BONUS_LEVELS[0] | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

    const handleQuizAnswerRef = useRef<(idx: number) => void>();
    
    // ─── مرجع للصوتيات السريعة لتجنب التهنيج ──────────────────────────────────
    const pourAudioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        pourAudioRef.current = new Audio('/click.mp3'); // يفضل رفع صوت ماء (water-pour.mp3)
    }, []);

    const playPourSound = () => {
        if (!soundEnabled || !pourAudioRef.current) return;
        pourAudioRef.current.currentTime = 0;
        pourAudioRef.current.volume = 0.3;
        pourAudioRef.current.play().catch(() => {});
    };

    const playSystemSound = useCallback((type: 'win' | 'lose') => {
        if (!soundEnabled) return;
        try {
            const audio = new Audio(type === 'win' ? '/applause.mp3' : '/fail.mp3');
            audio.volume = 0.6;
            audio.play().catch(() => {});
        } catch {}
    }, [soundEnabled]);

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

    // ─── توليد اللغز العشوائي ──────────────────────────────────────────────────
    const generatePuzzle = (numColors: number, numEmpty: number) => {
        let allLiquid: string[] = [];
        for (let i = 0; i < numColors; i++) {
            for (let j = 0; j < 4; j++) allLiquid.push(COLORS[i]);
        }
        
        allLiquid.sort(() => Math.random() - 0.5); // خلط السوائل
        
        let newTubes: string[][] = [];
        for (let i = 0; i < numColors; i++) {
            newTubes.push(allLiquid.slice(i * 4, (i + 1) * 4));
        }
        for (let i = 0; i < numEmpty; i++) newTubes.push([]);
        
        return newTubes;
    };

    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        
        const initial = generatePuzzle(level.colors, level.empty);
        setTubes(initial);
        setInitialTubes(initial); 
        setMoves(0);
        setTotalScore(0);
        setTimeLeft(level.time);
        setSelectedTube(null);
        setPhase('playing');
        setStarting(false);
    };

    const restartLevel = () => {
        setTubes(initialTubes.map(tube => [...tube]));
        setSelectedTube(null);
        setMoves(0);
    };

    // ─── منطق سكب السوائل ───────────────────────────────────────────────────
    const handleTubeClick = (index: number) => {
        if (selectedTube === null) {
            if (tubes[index].length > 0) {
                const isComplete = tubes[index].length === 4 && new Set(tubes[index]).size === 1;
                if (!isComplete) setSelectedTube(index);
            }
        } else {
            if (selectedTube === index) {
                setSelectedTube(null); 
            } else {
                pourLiquid(selectedTube, index);
            }
        }
    };

    const pourLiquid = (from: number, to: number) => {
        const source = [...tubes[from]];
        const dest = [...tubes[to]];
        
        if (dest.length === 4) {
            setSelectedTube(null); 
            return; 
        }
        
        const colorToMove = source[source.length - 1];
        if (dest.length > 0 && dest[dest.length - 1] !== colorToMove) {
            setSelectedTube(null); 
            return;
        }

        let count = 0;
        for (let i = source.length - 1; i >= 0; i--) {
            if (source[i] === colorToMove) count++;
            else break;
        }

        const spaceLeft = 4 - dest.length;
        const amountToMove = Math.min(count, spaceLeft);

        for (let i = 0; i < amountToMove; i++) {
            dest.push(source.pop()!);
        }

        const newTubes = [...tubes];
        newTubes[from] = source;
        newTubes[to] = dest;
        setTubes(newTubes);
        setSelectedTube(null);
        setMoves(m => m + 1);
        playPourSound(); // تشغيل صوت النقلة السريع

        const isWin = newTubes.every(tube => tube.length === 0 || (tube.length === 4 && new Set(tube).size === 1));
        if (isWin) {
            playSystemSound('win');
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            setTotalScore(level.points);
            toast.success(isEn ? 'Brilliant!' : 'عمل رائع!');
            setTimeout(() => setPhase('puzzle_solved'), 1500);
        }
    };

    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (phase === 'playing' && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (phase === 'playing' && timeLeft === 0) {
            playSystemSound('lose');
            toast.error(isEn ? 'Time is up!' : 'انتهى الوقت للأسف!');
            setTimeout(() => onComplete(0, false), 2500);
        }
        return () => clearInterval(timer);
    }, [phase, timeLeft, playSystemSound]);

    // ─── جلب سؤال الذكاء الاصطناعي الإضافي ──────────────────────────────────
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
                <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl shrink-0">
                    <Droplet className="w-10 h-10 text-white animate-bounce" />
                </div>
                <h3 className="text-2xl font-black text-gray-800 mb-2">{isEn ? 'Water Sort' : 'فرز السوائل'}</h3>
                <p className="text-xs font-bold text-gray-500 mb-6 max-w-xs mx-auto leading-relaxed">
                    {isEn ? 'Pour liquids between tubes until each tube contains only one color!' : 'قم بسكب السوائل بين الأنابيب حتى يصبح كل أنبوب بلون واحد فقط!'}
                </p>

                <h4 className="text-sm font-black text-cyan-800 mb-2 text-right">اختر المستوى:</h4>
                <div className="grid grid-cols-2 gap-2 mb-6">
                    {LEVELS.map(lvl => (
                        <button key={lvl.id} onClick={() => setLevel(lvl)}
                            className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center ${level.id === lvl.id ? 'bg-cyan-50 border-cyan-500 shadow-md scale-105' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                            <span className="font-black text-gray-800 text-sm mb-1">{lvl.label}</span>
                            <span className="text-[10px] text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded-md">{lvl.colors} ألوان | {lvl.points} نقطة</span>
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

                <button onClick={startGame} disabled={starting} className="w-full max-w-sm mx-auto mt-auto bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-4 rounded-2xl font-black text-base shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2 shrink-0">
                    {starting ? <Loader2 className="w-6 h-6 animate-spin"/> : '🎮 العب الآن'}
                </button>
            </div>
        );
    }

    if (phase === 'playing') {
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        
        return (
            <div className="max-w-md mx-auto flex flex-col h-[85vh] animate-in slide-in-from-bottom" dir="rtl">
                {/* Header */}
                <div className="flex justify-between items-center mb-4 px-2 shrink-0">
                    <button onClick={restartLevel} className="bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-2 rounded-xl font-black text-xs border border-gray-200 flex items-center gap-1 shadow-sm transition-all active:scale-95">
                        <RotateCcw className="w-3.5 h-3.5" /> {isEn ? 'Restart' : 'إعادة'}
                    </button>
                    <div className="bg-cyan-50 text-cyan-800 px-3 py-2 rounded-xl font-black text-xs border border-cyan-200 shadow-sm">
                        التحركات: {moves}
                    </div>
                    <div className={`px-3 py-2 rounded-xl font-black flex items-center gap-1 text-sm border shadow-sm ${timeLeft <= 20 ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-white text-gray-700 border-gray-200'}`}>
                        <Clock className="w-4 h-4" /> {m}:{s < 10 ? '0'+s : s}
                    </div>
                </div>

                {/* Tubes Area (Modern Glass Design) */}
                <div className="flex-1 flex flex-wrap items-center justify-center gap-3 md:gap-5 p-4 bg-gradient-to-br from-gray-800 to-gray-900 rounded-[2.5rem] border-[6px] border-gray-700 shadow-inner overflow-hidden relative">
                    
                    {/* إضاءة خلفية للزجاج */}
                    <div className="absolute top-10 left-1/2 -translate-x-1/2 w-3/4 h-3/4 bg-cyan-500/10 blur-3xl pointer-events-none"></div>

                    {tubes.map((tube, index) => {
                        const isSelected = selectedTube === index;
                        const isComplete = tube.length === 4 && new Set(tube).size === 1;

                        return (
                            <div 
                                key={index} 
                                onClick={() => handleTubeClick(index)}
                                className={`
                                    relative w-12 md:w-14 h-40 md:h-48 flex flex-col-reverse rounded-b-full border-x-4 border-b-4 
                                    border-white/60 bg-white/10 backdrop-blur-sm shadow-xl cursor-pointer 
                                    transition-all duration-300 ease-out overflow-hidden z-10
                                    ${isSelected ? '-translate-y-6 scale-105 ring-4 ring-cyan-300 ring-offset-2 ring-offset-gray-800 shadow-[0_20px_30px_-10px_rgba(34,211,238,0.4)]' : 'hover:-translate-y-2'}
                                `}
                            >
                                {/* اللمعة الزجاجية الواقعية على اليسار */}
                                <div className="absolute top-2 left-1.5 w-2 h-[85%] bg-gradient-to-b from-white/70 to-transparent rounded-full pointer-events-none z-20"></div>

                                {/* السائل الداخلي */}
                                {tube.map((colorClass, i) => (
                                    <div 
                                        key={i} 
                                        className={`w-full h-1/4 bg-gradient-to-b ${colorClass} opacity-95 transition-all duration-300 border-t border-white/20`}
                                    />
                                ))}

                                {/* غطاء الأنبوب عند الاكتمال */}
                                {isComplete && (
                                    <div className="absolute top-0 left-0 w-full h-3 bg-white/80 rounded-t-sm shadow-sm z-30"></div>
                                )}
                            </div>
                        );
                    })}
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
                <h3 className="text-2xl font-black text-gray-800 mb-2">فرز عبقري! 🎉</h3>
                <p className="text-sm font-bold text-gray-600 mb-6">
                    رتبتها في {moves} خطوة.<br/><br/>
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
            <div className="flex flex-col items-center justify-center py-20 text-cyan-600 animate-pulse text-center">
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

                <div className="bg-white rounded-3xl p-5 shadow-lg border-t-4 border-cyan-500">
                    <div className="flex justify-between items-center mb-4">
                        <span className="bg-cyan-50 text-cyan-700 px-3 py-1.5 rounded-lg font-black text-xs">مكافأة: +{selectedBonus?.points}</span>
                        {phase === 'quiz' && <span className="bg-gray-100 px-3 py-1.5 rounded-lg font-black text-xs text-red-500 animate-pulse flex items-center gap-1"><Clock className="w-3 h-3"/> {timeLeft}ث</span>}
                    </div>

                    <h3 className={`text-base font-black text-gray-800 leading-relaxed mb-5 ${isEnglishQ ? 'text-left' : 'text-right'}`} dir={isEnglishQ ? 'ltr' : 'rtl'}>
                        {quizQuestion?.question_text}
                    </h3>

                    <div className="grid grid-cols-1 gap-2" dir={isEnglishQ ? 'ltr' : 'rtl'}>
                        {quizQuestion?.options.map((option: string, idx: number) => {
                            let btnClass = 'bg-white border-2 border-gray-100 text-gray-700 hover:border-cyan-300 hover:bg-cyan-50';
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
