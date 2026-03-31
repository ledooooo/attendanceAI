import React, { useState, useEffect } from 'react';
import { Gamepad2, BrainCircuit, Clock, CheckCircle, XCircle, Star, Brain, Target, ShieldQuestion } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { supabase } from '../../../supabaseClient';

interface Props {
    employee?: any; // أضفناها لتحديد تخصص اللاعب للذكاء الاصطناعي
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

// 🩺 أيقونات طبية محسنة وشاملة
const ALL_ICONS = ['🚑', '💊', '💉', '🔬', '🩺', '🦷', '🦴', '🧬', '🦠', '🧪', '🧠', '🫀'];

// 🎛️ إعدادات المستويات (Grid Size)
const LEVELS = [
    { id: 'easy', rows: 4, cols: 4, label: 'مبتدئ (4 × 4)', time: 45, pairs: 8, basePoints: 10, color: 'from-emerald-500 to-teal-600' },
    { id: 'medium', rows: 5, cols: 4, label: 'محترف (4 × 5)', time: 60, pairs: 10, basePoints: 15, color: 'from-blue-500 to-indigo-600' },
    { id: 'hard', rows: 6, cols: 4, label: 'خبير (4 × 6)', time: 90, pairs: 12, basePoints: 20, color: 'from-red-500 to-rose-600' }
];

// إعدادات نقاط سؤال الذكاء الاصطناعي
const QUIZ_BONUS: Record<string, number> = { 'سهل': 5, 'متوسط': 10, 'صعب': 20 };

export default function MemoryMatchGame({ employee, onStart, onComplete }: Props) {
    const [phase, setPhase] = useState<'setup' | 'playing' | 'choose_difficulty' | 'loading_quiz' | 'quiz' | 'feedback'>('setup');
    const [level, setLevel] = useState<typeof LEVELS[0] | null>(null);
    
    // Memory Game States
    const [cards, setCards] = useState<{ id: number; icon: string; isFlipped: boolean; isMatched: boolean }[]>([]);
    const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
    const [matches, setMatches] = useState(0);
    const [timeLeft, setTimeLeft] = useState(45);
    const [starting, setStarting] = useState(false);

    // Quiz States
    const [quizQuestion, setQuizQuestion] = useState<any>(null);
    const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

    const playSound = (path: string) => {
        try { new Audio(path).play(); } catch (e) {}
    };

    // ─── 1. بدء لعبة الذاكرة ────────────────────────────────────────────────
    const startGame = async (selectedLevel: typeof LEVELS[0]) => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        
        setLevel(selectedLevel);
        const selectedIcons = ALL_ICONS.slice(0, selectedLevel.pairs);
        const shuffled = [...selectedIcons, ...selectedIcons]
            .sort(() => 0.5 - Math.random())
            .map((icon, idx) => ({ id: idx, icon, isFlipped: false, isMatched: false }));
        
        setCards(shuffled);
        setMatches(0);
        setFlippedIndices([]);
        setTimeLeft(selectedLevel.time);
        setPhase('playing');
        setStarting(false);
    };

    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (phase === 'playing' && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (phase === 'playing' && timeLeft === 0) {
            playSound('/fail.mp3');
            toast.error('انتهى الوقت! 💔');
            setTimeout(() => onComplete(0, false), 1500);
        }
        return () => clearInterval(timer);
    }, [phase, timeLeft, onComplete]);

    const handleCardClick = (index: number) => {
        if (phase !== 'playing' || cards[index].isFlipped || cards[index].isMatched || flippedIndices.length === 2) return;
        
        const newCards = [...cards];
        newCards[index].isFlipped = true;
        setCards(newCards);
        
        const newFlipped = [...flippedIndices, index];
        setFlippedIndices(newFlipped);
        
        if (newFlipped.length === 2) {
            const [first, second] = newFlipped;
            if (newCards[first].icon === newCards[second].icon) {
                setTimeout(() => {
                    const matchedCards = [...newCards];
                    matchedCards[first].isMatched = true;
                    matchedCards[second].isMatched = true;
                    setCards(matchedCards);
                    setFlippedIndices([]);
                    
                    const newMatches = matches + 1;
                    setMatches(newMatches);
                    
                    if (newMatches === level!.pairs) {
                        handleMemoryWin();
                    }
                }, 500);
            } else {
                setTimeout(() => {
                    const resetCards = [...newCards];
                    resetCards[first].isFlipped = false;
                    resetCards[second].isFlipped = false;
                    setCards(resetCards);
                    setFlippedIndices([]);
                }, 800);
            }
        }
    };

    const handleMemoryWin = () => {
        playSound('/applause.mp3');
        confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 } });
        toast.success('🎉 ذاكرة فولاذية! استعد للسؤال الإضافي!');
        setTimeout(() => setPhase('choose_difficulty'), 2500); // الانتقال لاختيار صعوبة السؤال
    };

    // ─── 2. جلب سؤال الذكاء الاصطناعي ────────────────────────────────────────
    const fetchAIQuestion = async (difficulty: string) => {
        setSelectedDifficulty(difficulty);
        setPhase('loading_quiz');

        const isMedicalEnglishSpecialty = ['بشر', 'أسنان', 'صيدل', 'اسره'].some(s => 
            (employee?.job_title || '').includes(s) || (employee?.specialty || '').includes(s)
        );

        try {
            const { data, error } = await supabase.functions.invoke('generate-smart-quiz', {
                body: {
                    specialty: employee?.job_title || employee?.specialty || 'طبيب بشرى',
                    domain: 'طبي وعلمي',
                    difficulty: difficulty,
                    length: 'قصير',
                    language: isMedicalEnglishSpecialty ? 'English (Professional Medical Terminology)' : 'ar',
                    include_hint: false,
                    game_type: 'mcq',
                    question_count: 1 // سؤال واحد فقط كما طلبت
                }
            });

            if (error || !data || data.length === 0) throw new Error('Failed to fetch');

            const q = data[0];
            const charToIndex: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
            
            setQuizQuestion({
                question_text: q.question_text,
                options: [q.option_a, q.option_b, q.option_c, q.option_d],
                correct_index: charToIndex[q.correct_option?.toUpperCase()] ?? 0,
                explanation: q.explanation
            });
            setPhase('quiz');

        } catch (err) {
            toast.error('تعذر جلب السؤال الإضافي. سنكتفي بنقاطك الحالية!');
            onComplete(level!.basePoints, true); // إنهاء بنقاط لعبة الذاكرة الأساسية
        }
    };

    const handleQuizAnswer = (idx: number) => {
        if (selectedAnswer !== null) return;
        setSelectedAnswer(idx);
        
        const isCorrect = idx === quizQuestion.correct_index;
        const finalPoints = level!.basePoints + (isCorrect ? QUIZ_BONUS[selectedDifficulty] : 0);

        if (isCorrect) {
            playSound('/applause.mp3');
            confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 } });
            toast.success(`إجابة صحيحة! حصلت على ${QUIZ_BONUS[selectedDifficulty]} نقطة إضافية!`);
        } else {
            playSound('/fail.mp3');
            toast.error('إجابة خاطئة للأسف!');
        }

        setPhase('feedback');
        setTimeout(() => {
            onComplete(finalPoints, true); // في كل الأحوال سيعتبر فائزاً لأنها تجاوز لعبة الذاكرة
        }, 5000);
    };

    // ─── واجهات اللعبة المختلفة ────────────────────────────────────────────────

    if (phase === 'setup') {
        return (
            <div className="text-center py-12 animate-in zoom-in-95">
                <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <Brain className="w-14 h-14 text-white animate-bounce"/>
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">تطابق الذاكرة 🧠</h3>
                <p className="text-base font-bold text-gray-600 mb-8 max-w-lg mx-auto">اختر حجم الشبكة. كلما زادت الصعوبة زادت النقاط الأساسية!</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto px-4">
                    {LEVELS.map(lvl => (
                        <button
                            key={lvl.id}
                            onClick={() => startGame(lvl)}
                            disabled={starting}
                            className={`bg-gradient-to-br ${lvl.color} text-white p-6 rounded-3xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex flex-col items-center gap-3 disabled:opacity-50`}
                        >
                            <span className="text-2xl">{lvl.label}</span>
                            <span className="bg-white/20 px-4 py-1.5 rounded-full text-sm">⏱️ {lvl.time} ثانية</span>
                            <span className="text-sm">الجائزة: {lvl.basePoints} نقطة</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (phase === 'playing' && level) {
        return (
            <div className="max-w-2xl mx-auto py-6 text-center animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6 px-4">
                    <div className={`px-6 py-3 rounded-2xl font-black text-xl shadow-lg transition-all ${timeLeft > 15 ? 'bg-gray-800 text-white' : 'bg-red-500 text-white animate-pulse'}`}>
                        ⏰ {timeLeft} ث
                    </div>
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2">
                        <Target className="w-5 h-5"/> {matches} / {level.pairs}
                    </div>
                </div>
                <div className={`grid grid-cols-4 gap-2 md:gap-3 p-4 bg-gradient-to-br from-slate-100 to-gray-200 rounded-[2rem] border-4 border-gray-300 shadow-2xl mx-2`} dir="ltr">
                    {cards.map((card, idx) => (
                        <div
                            key={card.id}
                            onClick={() => handleCardClick(idx)}
                            className={`aspect-square rounded-2xl cursor-pointer transition-all duration-500 transform flex items-center justify-center text-3xl md:text-5xl shadow-md ${card.isFlipped || card.isMatched ? 'bg-white border-2 border-emerald-300 rotate-y-180' : 'bg-gradient-to-br from-indigo-500 to-purple-600 border-b-4 border-indigo-800'} ${card.isMatched ? 'opacity-40 scale-90' : 'hover:scale-105 active:scale-95'}`}
                        >
                            {(card.isFlipped || card.isMatched)
                                ? card.icon
                                : <span className="text-white/20 text-2xl font-black">?</span>
                            }
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (phase === 'choose_difficulty') {
        return (
            <div className="text-center py-12 animate-in slide-in-from-bottom-8">
                <ShieldQuestion className="w-20 h-20 text-indigo-500 mx-auto mb-6 animate-bounce" />
                <h3 className="text-3xl font-black text-gray-800 mb-2">ممتاز! أكملت المطابقة بنجاح 👏</h3>
                <p className="text-lg font-bold text-gray-500 mb-8">لقد ضمنت {level?.basePoints} نقطة. اختر صعوبة سؤال الذكاء الاصطناعي لزيادة رصيدك:</p>
                
                <div className="flex flex-col gap-3 max-w-sm mx-auto px-4">
                    {Object.entries(QUIZ_BONUS).map(([diff, points]) => (
                        <button
                            key={diff}
                            onClick={() => fetchAIQuestion(diff)}
                            className="bg-white border-2 border-indigo-100 p-5 rounded-2xl font-black text-indigo-800 hover:bg-indigo-50 hover:border-indigo-400 hover:scale-105 transition-all shadow-md flex justify-between items-center text-lg"
                        >
                            <span>مستوى {diff}</span>
                            <span className="bg-indigo-100 px-3 py-1 rounded-xl text-sm">+ {points} نقطة</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (phase === 'loading_quiz') {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-indigo-600 animate-pulse text-center">
                <BrainCircuit className="w-16 h-16 mb-4 animate-spin mx-auto" />
                <p className="font-black text-xl">جاري توليد سؤال {selectedDifficulty} بـ AI...</p>
                <p className="text-sm font-bold text-gray-500 mt-2">يتم حفظ السؤال في بنك الأسئلة الخاص بك</p>
            </div>
        );
    }

    if (phase === 'quiz' || phase === 'feedback') {
        const isEnglish = /^[A-Za-z]/.test(quizQuestion.question_text);
        return (
            <div className="max-w-2xl mx-auto w-full animate-in zoom-in-95 duration-300">
                <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-xl border-t-8 border-indigo-500 mb-6 mt-10">
                    <div className="flex justify-between items-center mb-6">
                        <span className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl font-bold text-sm">سؤال البونص</span>
                        <span className="bg-amber-100 text-amber-700 px-4 py-2 rounded-xl font-black text-sm flex items-center gap-1"><Star className="w-4 h-4"/> +{QUIZ_BONUS[selectedDifficulty]} نقطة</span>
                    </div>

                    <h3 className={`text-lg md:text-2xl font-black text-gray-800 leading-relaxed mb-8 ${isEnglish ? 'text-left' : 'text-right'}`} dir={isEnglish ? 'ltr' : 'rtl'}>
                        {quizQuestion.question_text}
                    </h3>

                    <div className="grid grid-cols-1 gap-3" dir={isEnglish ? 'ltr' : 'rtl'}>
                        {quizQuestion.options.map((option: string, idx: number) => {
                            let btnClass = 'bg-white border-2 border-gray-100 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50';
                            if (phase === 'feedback') {
                                if (idx === quizQuestion.correct_index) btnClass = 'bg-emerald-500 border-emerald-600 text-white shadow-lg';
                                else if (idx === selectedAnswer) btnClass = 'bg-red-500 border-red-600 text-white shadow-lg';
                                else btnClass = 'bg-gray-50 border-gray-100 text-gray-400 opacity-50';
                            }
                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleQuizAnswer(idx)}
                                    disabled={phase === 'feedback'}
                                    className={`${btnClass} p-4 md:p-5 rounded-2xl font-bold text-sm md:text-lg transition-all active:scale-95 flex items-center justify-between ${isEnglish ? 'text-left' : 'text-right'}`}
                                >
                                    <span className="flex-1 leading-snug">{option}</span>
                                    {phase === 'feedback' && idx === quizQuestion.correct_index && <CheckCircle className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0 ml-2"/>}
                                    {phase === 'feedback' && idx === selectedAnswer && idx !== quizQuestion.correct_index && <XCircle className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0 ml-2"/>}
                                </button>
                            );
                        })}
                    </div>

                    {phase === 'feedback' && quizQuestion.explanation && (
                        <div className="mt-6 p-4 rounded-xl text-sm font-bold animate-in slide-in-from-bottom-4 bg-blue-50 text-blue-800 border border-blue-200">
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
