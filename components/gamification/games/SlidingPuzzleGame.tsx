import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Grip, CheckCircle, XCircle, Globe, Volume2, VolumeX, Sparkles, Loader2, ArrowRight, Star, Clock } from 'lucide-react';
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
    { id: 'easy', label: 'سهل (3×4)', rows: 4, cols: 3, time: 90, points: 20, color: 'from-emerald-500 to-teal-500' },
    { id: 'medium', label: 'وسط (4×4)', rows: 4, cols: 4, time: 150, points: 30, color: 'from-blue-500 to-indigo-500' },
    { id: 'hard', label: 'صعب (4×5)', rows: 5, cols: 4, time: 240, points: 40, color: 'from-orange-500 to-red-500' }
];

const BONUS_LEVELS = [
    { id: 'سهل', points: 10, time: 20 },
    { id: 'متوسط', points: 20, time: 20 },
    { id: 'صعب', points: 30, time: 30 }
];

export default function SlidingPuzzleGame({ onStart, onComplete, employee }: Props) {
    const [phase, setPhase] = useState<'setup' | 'playing' | 'puzzle_solved' | 'loading_quiz' | 'quiz' | 'summary'>('setup');
    const [starting, setStarting] = useState(false);
    
    // Puzzle Logic
    const [level, setLevel] = useState<typeof LEVELS[0]>(LEVELS[0]);
    const [board, setBoard] = useState<number[]>([]);
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

    const playSound = useCallback((type: 'win' | 'lose' | 'slide') => {
        if (!soundEnabled) return;
        try {
            let audio;
            if (type === 'slide') audio = new Audio('https://raw.githubusercontent.com/ledooooo/attendanceAI/main/public/click.mp3'); // افتراضي لو مفيش صوت، يمكن حذفه
            else audio = new Audio(type === 'win' ? '/applause.mp3' : '/fail.mp3');
            
            if (audio) {
                audio.volume = type === 'slide' ? 0.2 : 0.6;
                audio.play().catch(() => {});
            }
        } catch {}
    }, [soundEnabled]);

    // ─── خوارزمية ترتيب اللغز المضمونة للحل ─────────────────────────────────────
    const getValidMoves = (emptyIdx: number, r: number, c: number) => {
        const valid = [];
        const row = Math.floor(emptyIdx / c);
        const col = emptyIdx % c;
        if (row > 0) valid.push(emptyIdx - c); // أعلى
        if (row < r - 1) valid.push(emptyIdx + c); // أسفل
        if (col > 0) valid.push(emptyIdx - 1); // يسار
        if (col < c - 1) valid.push(emptyIdx + 1); // يمين
        return valid;
    };

    const generateSolvableBoard = (r: number, c: number) => {
        let b = Array.from({ length: r * c - 1 }, (_, i) => i + 1);
        b.push(0); // 0 يمثل الفراغ
        
        let emptyIdx = r * c - 1;
        let prevMove = -1;
        
        // خلط اللوحة بإجراء تحركات عشوائية صالحة (لضمان قابلية الحل رياضياً)
        for (let i = 0; i < 200; i++) {
            const possibleMoves = getValidMoves(emptyIdx, r, c).filter(m => m !== prevMove);
            const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
            b[emptyIdx] = b[move];
            b[move] = 0;
            prevMove = emptyIdx;
            emptyIdx = move;
        }
        return b;
    };

    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        
        setBoard(generateSolvableBoard(level.rows, level.cols));
        setMoves(0);
        setTotalScore(0);
        setTimeLeft(level.time);
        setPhase('playing');
        setStarting(false);
    };

    // ─── حركة البلاطات ────────────────────────────────────────────────────────
    const handleTileClick = (index: number) => {
        if (board[index] === 0) return; // الفراغ لا يتحرك

        const emptyIdx = board.indexOf(0);
        const validMoves = getValidMoves(emptyIdx, level.rows, level.cols);

        if (validMoves.includes(index)) {
            // تبديل الأماكن
            const newBoard = [...board];
            newBoard[emptyIdx] = newBoard[index];
            newBoard[index] = 0;
            
            setBoard(newBoard);
            setMoves(m => m + 1);
            playSound('slide');

            // التحقق من الفوز
            const isWin = newBoard.every((val, i) => i === newBoard.length - 1 ? val === 0 : val === i + 1);
            if (isWin) {
                playSound('win');
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                setTotalScore(level.points);
                toast.success(isEn ? 'Brilliant! You solved it!' : 'عبقري! لقد قمت بترتيب الأرقام!');
                setTimeout(() => setPhase('puzzle_solved'), 1500);
            }
        }
    };

    // مؤقت اللغز
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (phase === 'playing' && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (phase === 'playing' && timeLeft === 0) {
            playSound('lose');
            toast.error(isEn ? 'Time is up!' : 'انتهى الوقت للأسف!');
            setTimeout(() => onComplete(0, false), 2500);
        }
        return () => clearInterval(timer);
    }, [phase, timeLeft]);


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
            const charToIndex: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
            const safeOptions = Array.isArray(q.options) && q.options.length >= 4 
                ? q.options 
                : [q.option_a, q.option_b, q.option_c, q.option_d];

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
            playSound('win');
            confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 } });
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
            <div className="text-center py-4 px-2 animate-in zoom-in-95 flex flex-col h-[85vh] overflow-y-auto pb-10">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-800 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shrink-0">
                    <Grip className="w-10 h-10 text-white animate-pulse" />
                </div>
                <h3 className="text-2xl font-black text-gray-800 mb-2">{isEn ? 'Number Slider' : 'ترتيب الأرقام'}</h3>
                <p className="text-xs font-bold text-gray-500 mb-6 max-w-sm mx-auto leading-relaxed">
                    {isEn ? 'Slide the tiles to put the numbers in numerical order before time runs out!' : 'حرك المربعات لترتيب الأرقام تصاعدياً من 1 حتى النهاية قبل انتهاء الوقت!'}
                </p>

                <h4 className="text-sm font-black text-indigo-800 mb-2 text-right">اختر المستوى:</h4>
                <div className="grid grid-cols-1 gap-3 mb-6">
                    {LEVELS.map(lvl => (
                        <button key={lvl.id} onClick={() => setLevel(lvl)}
                            className={`p-4 rounded-2xl border-2 transition-all flex justify-between items-center ${level.id === lvl.id ? 'bg-indigo-50 border-indigo-500 shadow-md' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                            <div className="text-right">
                                <span className={`text-transparent bg-clip-text bg-gradient-to-r ${lvl.color} font-black text-lg block`}>{lvl.label}</span>
                                <span className="text-[10px] text-gray-500 font-bold">{lvl.time} ثانية | {lvl.points} نقطة</span>
                            </div>
                            <Grip className={`w-6 h-6 ${level.id === lvl.id ? 'text-indigo-600' : 'text-gray-300'}`} />
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

                <button onClick={startGame} disabled={starting} className="w-full max-w-sm mx-auto mt-auto bg-gradient-to-r from-indigo-600 to-purple-800 text-white py-4 rounded-2xl font-black text-base shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2 shrink-0">
                    {starting ? <Loader2 className="w-6 h-6 animate-spin"/> : '🎮 ابدأ الترتيب الآن'}
                </button>
            </div>
        );
    }

    if (phase === 'playing') {
        return (
            <div className="max-w-md mx-auto flex flex-col h-[85vh] animate-in slide-in-from-bottom" dir="rtl">
                {/* Header Stats */}
                <div className="flex justify-between items-center mb-4 px-2 shrink-0">
                    <div className="bg-indigo-50 text-indigo-800 px-3 py-2 rounded-xl font-black text-xs border border-indigo-200">
                        التحركات: {moves}
                    </div>
                    <div className={`px-4 py-2 rounded-xl font-black flex items-center gap-1 text-sm border shadow-sm ${timeLeft <= 15 ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-white text-gray-700 border-gray-200'}`}>
                        <Clock className="w-4 h-4" /> {timeLeft} ث
                    </div>
                </div>

                {/* Game Grid */}
                <div className="flex-1 flex flex-col items-center justify-center p-2">
                    <div className="bg-gray-100 p-3 rounded-[2rem] shadow-inner border-4 border-gray-200 w-full max-w-sm">
                        <div 
                            className="w-full grid gap-1.5 md:gap-2"
                            style={{ gridTemplateColumns: `repeat(${level.cols}, minmax(0, 1fr))` }}
                            dir="ltr" // نثبت اتجاه الشبكة لليسار لليمين دائماً لترتيب الأرقام
                        >
                            {board.map((tile, index) => {
                                const isEmpty = tile === 0;
                                return (
                                    <button
                                        key={index}
                                        onClick={() => handleTileClick(index)}
                                        className={`
                                            aspect-square rounded-xl md:rounded-2xl font-black text-xl md:text-3xl flex items-center justify-center transition-all duration-150 select-none
                                            ${isEmpty 
                                                ? 'bg-transparent shadow-inner border-2 border-gray-200/50' 
                                                : `bg-gradient-to-br ${level.color} text-white shadow-[0_4px_0_rgba(0,0,0,0.2)] active:translate-y-1 active:shadow-none hover:brightness-110`
                                            }
                                        `}
                                    >
                                        {!isEmpty && tile}
                                    </button>
                                );
                            })}
                        </div>
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
                <h3 className="text-2xl font-black text-gray-800 mb-2">سرعة مذهلة! 🎉</h3>
                <p className="text-sm font-bold text-gray-600 mb-6">
                    رتبتها في {moves} خطوة فقط.<br/><br/>
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
            <div className="flex flex-col items-center justify-center py-20 text-indigo-600 animate-pulse text-center">
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

                <div className="bg-white rounded-3xl p-5 shadow-lg border-t-4 border-indigo-500">
                    <div className="flex justify-between items-center mb-4">
                        <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-black text-xs">مكافأة: +{selectedBonus?.points}</span>
                        {phase === 'quiz' && <span className="bg-gray-100 px-3 py-1.5 rounded-lg font-black text-xs text-red-500 animate-pulse flex items-center gap-1"><Clock className="w-3 h-3"/> {timeLeft}ث</span>}
                    </div>

                    <h3 className={`text-base font-black text-gray-800 leading-relaxed mb-5 ${isEnglishQ ? 'text-left' : 'text-right'}`} dir={isEnglishQ ? 'ltr' : 'rtl'}>
                        {quizQuestion?.question_text}
                    </h3>

                    <div className="grid grid-cols-1 gap-2" dir={isEnglishQ ? 'ltr' : 'rtl'}>
                        {quizQuestion?.options.map((option: string, idx: number) => {
                            let btnClass = 'bg-white border-2 border-gray-100 text-gray-700 hover:border-indigo-300';
                            if (phase === 'summary') {
                                if (idx === quizQuestion.correct_index) btnClass = 'bg-emerald-500 border-emerald-600 text-white shadow-sm';
                                else if (idx === selectedAnswer) btnClass = 'bg-red-500 border-red-600 text-white shadow-sm';
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
