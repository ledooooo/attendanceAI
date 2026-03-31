import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { FlaskConical, CheckCircle, XCircle, Globe, Volume2, VolumeX, Sparkles, Loader2, ArrowRight, Star, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { Employee } from '../../../types';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
    employee?: Employee;
}

// 🧪 إعدادات الزجاجات والهدف
const BOTTLE_COLORS = [
    { id: 'yellow', colorClass: 'bg-yellow-400', label: 'أصفر' },
    { id: 'red', colorClass: 'bg-red-500', label: 'أحمر' },
    { id: 'blue', colorClass: 'bg-blue-500', label: 'أزرق' },
    { id: 'green', colorClass: 'bg-emerald-500', label: 'أخضر' },
    { id: 'black', colorClass: 'bg-gray-900', label: 'أسود' }
];

const TARGET_ORDER = ['yellow', 'red', 'blue', 'green', 'black'];

const MAX_ATTEMPTS = 15; // 👈 تم زيادة المحاولات إلى 15
const BASE_POINTS = 20;

const BONUS_LEVELS = [
    { id: 'سهل', points: 10, time: 20 },
    { id: 'متوسط', points: 20, time: 20 },
    { id: 'صعب', points: 30, time: 30 }
];

export default function BottleSortGame({ onStart, onComplete, employee }: Props) {
    const [phase, setPhase] = useState<'setup' | 'playing' | 'puzzle_solved' | 'loading_quiz' | 'quiz' | 'summary'>('setup');
    const [starting, setStarting] = useState(false);
    
    // Bottle Logic
    const [bottles, setBottles] = useState<string[]>([]);
    const [selectedBottle, setSelectedBottle] = useState<number | null>(null);
    
    // 👈 تحديث History ليحفظ ترتيب الألوان في كل محاولة
    const [history, setHistory] = useState<{ attempt: number, correctCount: number, arrangement: string[] }[]>([]);
    
    // Quiz & Settings
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [language, setLanguage] = useState<'auto' | 'ar' | 'en'>('auto');
    const [totalScore, setTotalScore] = useState(0);
    const [quizQuestion, setQuizQuestion] = useState<any>(null);
    const [selectedBonus, setSelectedBonus] = useState<typeof BONUS_LEVELS[0] | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);

    const isMedicalEnglishSpecialty = ['بشر', 'أسنان', 'صيدل', 'اسره', 'معمل', 'تمريض'].some(s => 
        (employee?.job_title || '').includes(s) || (employee?.specialty || '').includes(s)
    );

    const getEffectiveLanguage = useCallback((): 'ar' | 'en' => {
        if (language === 'ar') return 'ar';
        if (language === 'en') return 'en';
        return isMedicalEnglishSpecialty ? 'en' : 'ar';
    }, [language, isMedicalEnglishSpecialty]);

    const isEn = getEffectiveLanguage() === 'en';

    const playSound = useCallback((type: 'win' | 'lose') => {
        if (!soundEnabled) return;
        try {
            const audio = new Audio(type === 'win' ? '/applause.mp3' : '/fail.mp3');
            audio.volume = 0.6;
            audio.play().catch(() => {});
        } catch {}
    }, [soundEnabled]);

    // ─── 1. بدء اللعبة ──────────────────────────────────────────────────────────
    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        
        let shuffled = [...TARGET_ORDER].sort(() => 0.5 - Math.random());
        while (shuffled.every((v, i) => v === TARGET_ORDER[i])) {
            shuffled = [...TARGET_ORDER].sort(() => 0.5 - Math.random());
        }

        setBottles(shuffled);
        setHistory([]);
        setSelectedBottle(null);
        setTotalScore(0);
        setPhase('playing');
        setStarting(false);
    };

    // ─── 2. تحريك الزجاجات والفحص ────────────────────────────────────────────────
    const handleBottleClick = (idx: number) => {
        if (selectedBottle === null) {
            setSelectedBottle(idx);
        } else {
            if (selectedBottle !== idx) {
                const newBottles = [...bottles];
                const temp = newBottles[selectedBottle];
                newBottles[selectedBottle] = newBottles[idx];
                newBottles[idx] = temp;
                setBottles(newBottles);
            }
            setSelectedBottle(null);
        }
    };

    const checkOrder = () => {
        if (selectedBottle !== null) setSelectedBottle(null);

        let correctCount = 0;
        bottles.forEach((b, i) => {
            if (b === TARGET_ORDER[i]) correctCount++;
        });

        const currentAttempt = history.length + 1;
        // حفظ ترتيب الألوان في السجل
        const newHistory = [{ attempt: currentAttempt, correctCount, arrangement: [...bottles] }, ...history];
        setHistory(newHistory);

        if (correctCount === 5) {
            playSound('win');
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            setTotalScore(BASE_POINTS);
            toast.success(isEn ? 'Genius! Correct order!' : 'رائع! ترتيب صحيح 100%');
            setTimeout(() => setPhase('puzzle_solved'), 1500);
        } else if (currentAttempt >= MAX_ATTEMPTS) {
            playSound('lose');
            toast.error(isEn ? 'Out of attempts!' : 'انتهت المحاولات للأسف!');
            setTimeout(() => onComplete(0, false), 2500);
        }
    };

    // ─── 3. جلب الأسئلة من الذكاء الاصطناعي (معالج آمن للأخطاء) ───────────────────────
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
                    question_count: 5 // توليد 5 لإثراء القاعدة
                }
            });

            if (error || !data) throw new Error('Fetch failed');

            // استخراج السؤال الأول بشكل آمن جداً مهما كان شكل الرد (مصفوفة أو كائن)
            let qArray = [];
            if (Array.isArray(data)) qArray = data;
            else if (data.questions && Array.isArray(data.questions)) qArray = data.questions;
            else if (typeof data === 'object') qArray = [data];

            if (qArray.length === 0) throw new Error('No questions returned');

            const q = qArray[0]; 
            const charToIndex: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
            
            setQuizQuestion({
                question_text: q.question_text || q.question,
                options: [q.option_a, q.option_b, q.option_c, q.option_d],
                correct_index: charToIndex[q.correct_option || q.correct_answer] ?? 0,
                explanation: q.explanation
            });
            
            setTimeLeft(bonus.time);
            setPhase('quiz');
        } catch (err) {
            console.error("AI Error: ", err);
            toast.error(isEn ? 'AI server busy. You secured base points!' : 'السيرفر مشغول. حصلت على نقاطك الأساسية!');
            onComplete(totalScore, true);
        }
    };

    // ─── 4. مؤقت السؤال وحله ──────────────────────────────────────────────────
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (phase === 'quiz' && timeLeft > 0 && selectedAnswer === null) {
            timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (phase === 'quiz' && timeLeft === 0 && selectedAnswer === null) {
            handleQuizAnswer(-1);
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
    // واجهات المستخدم (محسنة للموبايل - تقليل الـ Scroll)
    // =======================================================================

    if (phase === 'setup') {
        return (
            <div className="text-center py-6 px-4 animate-in zoom-in-95">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-700 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
                    <FlaskConical className="w-10 h-10 text-white animate-pulse" />
                </div>
                <h3 className="text-2xl font-black text-gray-800 mb-2">{isEn ? 'Bottle Sort 🧪' : 'ترتيب الزجاجات 🧪'}</h3>
                <p className="text-xs font-bold text-gray-500 mb-6 max-w-xs mx-auto leading-relaxed">
                    {isEn ? 'Swap the 5 bottles to find the correct secret order. You have 15 attempts!' : 'قم بتبديل الزجاجات الخمس للوصول للترتيب السري الصحيح. لديك 15 محاولة!'}
                </p>
                <div className="flex justify-center gap-2 mb-6">
                    <button onClick={() => setLanguage(l => l==='ar'?'en':(l==='en'?'auto':'ar'))} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-black border border-indigo-200">
                        <Globe className="w-4 h-4" /> {isEn ? 'English' : 'عربي'}
                    </button>
                    <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-xl hover:bg-gray-100 bg-gray-50 border border-gray-200">
                        {soundEnabled ? <Volume2 className="w-4 h-4 text-gray-600" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                    </button>
                </div>
                <button onClick={startGame} disabled={starting} className="w-full max-w-sm mx-auto bg-gradient-to-r from-indigo-500 to-purple-700 text-white py-3 rounded-2xl font-black text-base shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 block">
                    {starting ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : (isEn ? '🧪 Start Sorting' : '🧪 ابدأ الترتيب')}
                </button>
            </div>
        );
    }

    if (phase === 'playing') {
        const remainingAttempts = MAX_ATTEMPTS - history.length;
        
        return (
            <div className="max-w-md mx-auto py-2 px-2 animate-in slide-in-from-bottom text-center flex flex-col h-[85vh]">
                {/* Header Compact */}
                <div className="flex justify-between items-center mb-4 px-2">
                    <div className="bg-indigo-50 text-indigo-800 px-3 py-1.5 rounded-xl font-black text-[10px] md:text-xs border border-indigo-200">
                        {isEn ? 'Base:' : 'نقاط:'} +{BASE_POINTS}
                    </div>
                    <div className={`px-3 py-1.5 rounded-xl font-black text-[10px] md:text-xs border shadow-sm ${remainingAttempts <= 3 ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-white text-gray-700 border-gray-200'}`}>
                        {isEn ? 'Attempts:' : 'محاولات:'} {remainingAttempts}
                    </div>
                </div>

                {/* منصة الزجاجات (تصميم مدمج للموبايل) */}
                <div className="bg-gradient-to-br from-slate-100 to-gray-200 p-4 rounded-3xl shadow-inner border-4 border-gray-300 mb-4 shrink-0">
                    <div className="flex justify-center gap-2 items-end h-24">
                        {bottles.map((bottleColor, idx) => {
                            const colorData = BOTTLE_COLORS.find(c => c.id === bottleColor);
                            const isSelected = selectedBottle === idx;
                            return (
                                <div key={idx} onClick={() => handleBottleClick(idx)}
                                    className={`flex flex-col items-center cursor-pointer transition-all duration-300 ${isSelected ? '-translate-y-3 scale-110 drop-shadow-xl' : 'hover:-translate-y-1 drop-shadow-md'}`}>
                                    <div className="w-3 h-2 bg-gray-400 rounded-t-sm border border-gray-500"></div>
                                    <div className="w-4 h-3 bg-white/40 border-x border-white/50 z-10"></div>
                                    <div className={`w-10 h-16 md:w-12 md:h-20 ${colorData?.colorClass} rounded-b-lg rounded-t-sm relative border-2 border-white/30 shadow-inner`}>
                                        <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent"></div>
                                        <div className="absolute top-1 left-1 w-1.5 h-10 bg-white/30 rounded-full blur-[1px]"></div>
                                    </div>
                                    {isSelected && <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce"></div>}
                                </div>
                            );
                        })}
                    </div>
                    <div className="w-full h-3 bg-gray-400 rounded-full mt-1 shadow-lg border-b-2 border-gray-500"></div>
                </div>

                <button onClick={checkOrder} disabled={remainingAttempts === 0}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 rounded-2xl font-black text-sm shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2 mb-4 shrink-0">
                    <Target className="w-5 h-5" /> {isEn ? 'Check Order' : 'فحص الترتيب'}
                </button>

                {/* سجل المحاولات مع عرض الألوان (Scrollable Box) */}
                <div className="flex-1 bg-white rounded-2xl p-3 shadow-sm border border-gray-100 overflow-y-auto">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2 sticky top-0 bg-white pb-1">{isEn ? 'History' : 'سجل المحاولات'}</h4>
                    <div className="space-y-1.5">
                        {history.map((h, i) => (
                            <div key={i} className="flex justify-between items-center text-[10px] font-bold p-2 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-gray-400 w-12 text-right">{h.attempt}#</span>
                                {/* عرض الألوان المصغرة */}
                                <div className="flex gap-1">
                                    {h.arrangement.map((c, cIdx) => {
                                        const cClass = BOTTLE_COLORS.find(bc => bc.id === c)?.colorClass;
                                        return <div key={cIdx} className={`w-3 h-3 rounded-full ${cClass} shadow-sm border border-black/10`} />
                                    })}
                                </div>
                                <span className={`${h.correctCount === 5 ? 'text-emerald-600 bg-emerald-100' : h.correctCount > 0 ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 bg-gray-200'} px-2 py-0.5 rounded-md min-w-[40px] text-center`}>
                                    {h.correctCount} صح
                                </span>
                            </div>
                        ))}
                        {history.length === 0 && <p className="text-[10px] text-gray-400 mt-4">{isEn ? 'No attempts yet' : 'لم تقم بأي فحص بعد'}</p>}
                    </div>
                </div>
            </div>
        );
    }

    if (phase === 'puzzle_solved') {
        return (
            <div className="text-center py-8 px-4 animate-in slide-in-from-bottom">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-black text-gray-800 mb-2">{isEn ? 'Solved! 🧪' : 'عبقري! 🧪'}</h3>
                <p className="text-sm font-bold text-gray-600 mb-6">
                    {isEn ? `Secured ${BASE_POINTS} pts. Double it with an AI question!` : `ضمنت ${BASE_POINTS} نقطة. اختر صعوبة سؤال AI لتضاعفها!`}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-w-xl mx-auto">
                    {BONUS_LEVELS.map(bonus => (
                        <button key={bonus.id} onClick={() => fetchAIQuestion(bonus)}
                            className="bg-white border-2 border-emerald-200 p-3 rounded-xl hover:bg-emerald-50 transition-all active:scale-95 shadow-sm flex flex-col items-center">
                            <span className="font-black text-base text-gray-800">{isEn ? `Lvl ${bonus.id}` : `مستوى ${bonus.id}`}</span>
                            <span className="text-emerald-600 font-bold bg-emerald-100 px-2 py-0.5 rounded-lg text-xs mt-1">+{bonus.points} {isEn ? 'pts' : 'نقطة'}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (phase === 'loading_quiz') {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-emerald-600 animate-pulse text-center">
                <Loader2 className="w-12 h-12 mb-4 animate-spin mx-auto" />
                <p className="font-black text-lg">{isEn ? 'Preparing AI Quiz...' : 'جاري سحب سؤال AI...'}</p>
            </div>
        );
    }

    if (phase === 'quiz' || phase === 'summary') {
        const isEnglishQ = /^[A-Za-z]/.test(quizQuestion?.question_text || '');
        return (
            <div className="max-w-xl mx-auto w-full animate-in zoom-in-95 duration-300 py-4 px-2">
                {phase === 'summary' && (
                    <div className="text-center mb-4 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                        <h2 className="text-lg font-black text-gray-800 mb-1">{isEn ? 'Total Points' : 'إجمالي النقاط'}</h2>
                        <span className="text-4xl font-black text-emerald-500">{totalScore}</span>
                        <button onClick={() => onComplete(totalScore, true)} className="block w-full mt-4 bg-gray-800 text-white py-3 rounded-xl font-bold active:scale-95 transition-all text-sm">
                            {isEn ? 'Finish' : 'إنهاء'} <ArrowRight className="inline w-4 h-4 ml-1" />
                        </button>
                    </div>
                )}

                <div className="flex justify-between items-center mb-4 px-2">
                    <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-black text-xs flex items-center gap-1 border border-emerald-200">
                        <Star className="w-3 h-3"/> +{selectedBonus?.points}
                    </div>
                    {phase === 'quiz' && (
                        <div className={`px-3 py-1.5 rounded-lg font-black text-xs flex items-center gap-1 ${timeLeft <= 5 ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-700'}`}>
                            <Clock className="w-3 h-3" /> {timeLeft}s
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-3xl p-5 shadow-lg border-t-4 border-emerald-500">
                    <h3 className={`text-base md:text-lg font-black text-gray-800 leading-relaxed mb-5 ${isEnglishQ ? 'text-left' : 'text-right'}`} dir={isEnglishQ ? 'ltr' : 'rtl'}>
                        {quizQuestion?.question_text}
                    </h3>

                    <div className="grid grid-cols-1 gap-2" dir={isEnglishQ ? 'ltr' : 'rtl'}>
                        {quizQuestion?.options.map((option: string, idx: number) => {
                            let btnClass = 'bg-white border-2 border-gray-100 text-gray-700 hover:border-emerald-300';
                            if (phase === 'summary') {
                                if (idx === quizQuestion.correct_index) btnClass = 'bg-emerald-500 border-emerald-600 text-white shadow-md';
                                else if (idx === selectedAnswer) btnClass = 'bg-red-500 border-red-600 text-white shadow-md';
                                else btnClass = 'bg-gray-50 border-gray-100 text-gray-400 opacity-50';
                            }
                            return (
                                <button key={idx} onClick={() => handleQuizAnswer(idx)} disabled={phase === 'summary'}
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
                            <span className="block mb-1 opacity-70">📚 {isEnglishQ ? 'Explanation:' : 'الشرح:'}</span>
                            {quizQuestion.explanation}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null;
}
