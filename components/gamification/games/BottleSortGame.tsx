import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Beaker, FlaskConical, CheckCircle, XCircle, RotateCcw, Globe, Volume2, VolumeX, Sparkles, Loader2, ArrowRight, Star, Target } from 'lucide-react';
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

// الهدف المطلوب كما حددته
const TARGET_ORDER = ['yellow', 'red', 'blue', 'green', 'black'];

const MAX_ATTEMPTS = 10;
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
    const [history, setHistory] = useState<{ attempt: number, correctCount: number }[]>([]);
    
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
        
        // خلط الزجاجات بحيث لا تكون مطابقة للهدف بالصدفة في البداية
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
            setSelectedBottle(idx); // اختيار الزجاجة الأولى
        } else {
            if (selectedBottle !== idx) {
                // تبديل الأماكن
                const newBottles = [...bottles];
                const temp = newBottles[selectedBottle];
                newBottles[selectedBottle] = newBottles[idx];
                newBottles[idx] = temp;
                setBottles(newBottles);
            }
            setSelectedBottle(null); // إلغاء التحديد
        }
    };

    const checkOrder = () => {
        if (selectedBottle !== null) setSelectedBottle(null);

        let correctCount = 0;
        bottles.forEach((b, i) => {
            if (b === TARGET_ORDER[i]) correctCount++;
        });

        const currentAttempt = history.length + 1;
        const newHistory = [{ attempt: currentAttempt, correctCount }, ...history];
        setHistory(newHistory);

        if (correctCount === 5) {
            // فاز!
            playSound('win');
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            setTotalScore(BASE_POINTS);
            toast.success(isEn ? 'Genius! Correct order!' : 'رائع! ترتيب صحيح 100%');
            setTimeout(() => setPhase('puzzle_solved'), 1500);
        } else if (currentAttempt >= MAX_ATTEMPTS) {
            // خسر (استنفد 10 محاولات)
            playSound('lose');
            toast.error(isEn ? 'Out of attempts!' : 'انتهت المحاولات للأسف!');
            setTimeout(() => onComplete(0, false), 2500);
        } else {
            toast(isEn ? `${correctCount} bottles in correct position` : `${correctCount} زجاجات في مكانها الصحيح`, { icon: '🔍' });
        }
    };

    // ─── 3. جلب الأسئلة من الذكاء الاصطناعي (جلب 5، عرض 1) ───────────────────────
    const fetchAIQuestion = async (bonus: typeof BONUS_LEVELS[0]) => {
        setSelectedBonus(bonus);
        setPhase('loading_quiz');

        try {
            // نطلب 5 أسئلة لإثراء قاعدة البيانات كما طلبت
            const { data, error } = await supabase.functions.invoke('generate-smart-quiz', {
                body: {
                    specialty: employee?.job_title || employee?.specialty || 'طبيب بشرى',
                    domain: 'طبي وعلمي',
                    difficulty: bonus.id,
                    length: 'قصير',
                    language: isEn ? 'English (Professional Medical Terminology)' : 'ar',
                    include_hint: false,
                    game_type: 'mcq',
                    question_count: 5 // 👈 طلب 5 أسئلة للحفظ في القاعدة
                }
            });

            if (error || !data || data.length === 0) throw new Error('Fetch failed');

            // نأخذ السؤال الأول فقط لنعرضه للاعب
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
            toast.error(isEn ? 'Failed to fetch AI question. You get base points!' : 'تعذر جلب السؤال الإضافي. احتفظت بالنقاط الأساسية!');
            onComplete(totalScore, true);
        }
    };

    // ─── 4. مؤقت السؤال وحله ──────────────────────────────────────────────────
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (phase === 'quiz' && timeLeft > 0 && selectedAnswer === null) {
            timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (phase === 'quiz' && timeLeft === 0 && selectedAnswer === null) {
            handleQuizAnswer(-1); // الوقت انتهى
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

    if (phase === 'setup') {
        return (
            <div className="text-center py-8 px-4 animate-in zoom-in-95">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <FlaskConical className="w-12 h-12 text-white animate-pulse" />
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">{isEn ? 'Bottle Sort 🧪' : 'ترتيب الزجاجات 🧪'}</h3>
                <p className="text-sm font-bold text-gray-500 mb-6 max-w-sm mx-auto leading-relaxed">
                    {isEn ? 'Swap the 5 bottles to find the correct secret order. You have 10 attempts! ' : 'قم بتبديل الزجاجات الخمس للوصول للترتيب السري الصحيح. لديك 10 محاولات للفحص!'}
                </p>
                <div className="flex justify-center gap-3 mb-6">
                    <button onClick={() => setLanguage(l => l==='ar'?'en':(l==='en'?'auto':'ar'))} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-black border border-indigo-200">
                        <Globe className="w-4 h-4" /> {isEn ? 'English' : 'عربي'}
                    </button>
                    <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-xl hover:bg-gray-100 bg-gray-50 border border-gray-200">
                        {soundEnabled ? <Volume2 className="w-5 h-5 text-gray-600" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
                    </button>
                </div>
                <button onClick={startGame} disabled={starting} className="w-full max-w-sm mx-auto bg-gradient-to-r from-indigo-500 to-purple-700 text-white px-8 py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 block">
                    {starting ? (isEn ? 'Starting...' : 'جاري البدء...') : (isEn ? '🧪 Start Sorting' : '🧪 ابدأ الترتيب')}
                </button>
            </div>
        );
    }

    if (phase === 'playing') {
        const remainingAttempts = MAX_ATTEMPTS - history.length;
        
        return (
            <div className="max-w-lg mx-auto py-6 px-2 animate-in slide-in-from-bottom text-center">
                <div className="flex justify-between items-center mb-6 px-4">
                    <div className="bg-indigo-50 text-indigo-800 px-4 py-2 rounded-xl font-black text-xs border border-indigo-200 shadow-sm">
                        {isEn ? 'Points:' : 'النقاط:'} +{BASE_POINTS}
                    </div>
                    <div className={`px-4 py-2 rounded-xl font-black text-sm border shadow-sm ${remainingAttempts <= 3 ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-white text-gray-700 border-gray-200'}`}>
                        {isEn ? 'Attempts:' : 'المحاولات:'} {remainingAttempts}
                    </div>
                </div>

                {/* منصة الزجاجات */}
                <div className="bg-gradient-to-br from-slate-100 to-gray-200 p-6 rounded-[2.5rem] shadow-inner border-4 border-gray-300 mb-8 relative">
                    <div className="flex justify-center gap-2 md:gap-4 items-end h-32">
                        {bottles.map((bottleColor, idx) => {
                            const colorData = BOTTLE_COLORS.find(c => c.id === bottleColor);
                            const isSelected = selectedBottle === idx;
                            
                            return (
                                <div 
                                    key={idx} 
                                    onClick={() => handleBottleClick(idx)}
                                    className={`flex flex-col items-center cursor-pointer transition-all duration-300 ${isSelected ? '-translate-y-4 scale-110 drop-shadow-2xl' : 'hover:-translate-y-1 hover:scale-105 drop-shadow-md'}`}
                                >
                                    {/* غطاء الزجاجة */}
                                    <div className="w-4 h-3 bg-gray-400 rounded-t-md border border-gray-500 shadow-inner"></div>
                                    {/* عنق الزجاجة */}
                                    <div className="w-5 h-5 bg-white/40 backdrop-blur-sm border-x border-white/50 z-10"></div>
                                    {/* جسم الزجاجة */}
                                    <div className={`w-12 h-20 md:w-16 md:h-24 ${colorData?.colorClass} rounded-b-xl rounded-t-sm relative overflow-hidden border-2 border-white/30 shadow-[inset_0_-10px_20px_rgba(0,0,0,0.3)]`}>
                                        <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent"></div>
                                        <div className="absolute top-2 left-1 w-2 h-12 bg-white/30 rounded-full blur-[1px]"></div>
                                    </div>
                                    {isSelected && <div className="mt-2 w-2 h-2 rounded-full bg-indigo-500 animate-bounce"></div>}
                                </div>
                            );
                        })}
                    </div>
                    {/* الرف السفلي */}
                    <div className="w-full h-4 bg-gray-400 rounded-full mt-2 shadow-lg border-b-2 border-gray-500"></div>
                </div>

                <button 
                    onClick={checkOrder}
                    disabled={remainingAttempts === 0}
                    className="w-full max-w-xs mx-auto bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2 mb-6"
                >
                    <Target className="w-6 h-6" /> {isEn ? 'Check Order' : 'فحص الترتيب'}
                </button>

                {/* سجل المحاولات */}
                {history.length > 0 && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 max-h-40 overflow-y-auto">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">{isEn ? 'History' : 'سجل الفحص'}</h4>
                        <div className="space-y-2">
                            {history.map((h, i) => (
                                <div key={i} className="flex justify-between items-center text-sm font-bold p-2 bg-gray-50 rounded-xl">
                                    <span className="text-gray-500">{isEn ? `Attempt ${h.attempt}` : `محاولة ${h.attempt}`}</span>
                                    <span className={`${h.correctCount > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-gray-600 bg-gray-200'} px-3 py-1 rounded-lg`}>
                                        {h.correctCount} / 5 {isEn ? 'Correct' : 'صحيح'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (phase === 'puzzle_solved') {
        return (
            <div className="text-center py-10 animate-in slide-in-from-bottom" dir={isEn ? 'ltr' : 'rtl'}>
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-12 h-12 text-emerald-600" />
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">{isEn ? 'Puzzle Solved! 🧪' : 'عبقري! رتبتها صح 🧪'}</h3>
                <p className="text-lg font-bold text-gray-600 mb-8">
                    {isEn ? `You secured ${BASE_POINTS} points. Now choose a bonus question difficulty to double your reward!` : `لقد ضمنت ${BASE_POINTS} نقطة. اختر مستوى صعوبة سؤال إضافي لمضاعفة نقاطك!`}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl mx-auto px-4">
                    {BONUS_LEVELS.map(bonus => (
                        <button key={bonus.id} onClick={() => fetchAIQuestion(bonus)}
                            className="bg-white border-2 border-emerald-200 p-5 rounded-2xl hover:bg-emerald-50 transition-all hover:scale-105 shadow-md flex flex-col items-center"
                        >
                            <span className="font-black text-lg text-gray-800 mb-1">{isEn ? `Level ${bonus.id}` : `مستوى ${bonus.id}`}</span>
                            <span className="text-emerald-600 font-bold bg-emerald-100 px-3 py-1 rounded-full text-sm">+{bonus.points} {isEn ? 'Points' : 'نقطة إضافية'}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (phase === 'loading_quiz') {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-emerald-600 animate-pulse text-center">
                <Loader2 className="w-16 h-16 mb-4 animate-spin mx-auto" />
                <p className="font-black text-xl">{isEn ? 'Generating Bonus Challenge...' : 'جاري تجهيز سؤال الذكاء الاصطناعي...'}</p>
                <p className="text-sm font-bold text-gray-500 mt-2">{isEn ? '5 questions generated for the bank, 1 chosen for you!' : 'تم توليد 5 أسئلة لبنك المعرفة، واخترنا واحداً لك!'}</p>
            </div>
        );
    }

    if (phase === 'quiz' || phase === 'summary') {
        const isEnglishQ = /^[A-Za-z]/.test(quizQuestion.question_text);
        return (
            <div className="max-w-2xl mx-auto w-full animate-in zoom-in-95 duration-300 py-6">
                {phase === 'summary' && (
                    <div className="text-center mb-8 bg-gray-50 p-6 rounded-3xl border border-gray-200">
                        <h2 className="text-2xl font-black text-gray-800 mb-2">{isEn ? 'Total Points Earned' : 'إجمالي النقاط المكتسبة'}</h2>
                        <span className="text-5xl font-black text-emerald-500">{totalScore}</span>
                        <button onClick={() => onComplete(totalScore, true)} className="block w-full mt-6 bg-gray-800 text-white py-4 rounded-xl font-bold hover:bg-gray-900 transition-all">
                            {isEn ? 'Collect Points & Finish' : 'إنهاء وجمع النقاط'} <ArrowRight className="inline w-5 h-5 ml-2" />
                        </button>
                    </div>
                )}

                <div className="flex justify-between items-center mb-6 px-4">
                    <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl font-black text-sm flex items-center gap-2 border border-emerald-200">
                        <Star className="w-4 h-4"/> {isEn ? 'Bonus' : 'مكافأة'}: +{selectedBonus?.points}
                    </div>
                    {phase === 'quiz' && (
                        <div className={`px-4 py-2 rounded-xl font-black flex items-center gap-2 ${timeLeft <= 5 ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-700'}`}>
                            <Clock className="w-4 h-4" /> {timeLeft}s
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-xl border-t-8 border-emerald-500">
                    <h3 className={`text-lg md:text-2xl font-black text-gray-800 leading-relaxed mb-6 ${isEnglishQ ? 'text-left' : 'text-right'}`} dir={isEnglishQ ? 'ltr' : 'rtl'}>
                        {quizQuestion.question_text}
                    </h3>

                    <div className="grid grid-cols-1 gap-3" dir={isEnglishQ ? 'ltr' : 'rtl'}>
                        {quizQuestion.options.map((option: string, idx: number) => {
                            let btnClass = 'bg-white border-2 border-gray-100 text-gray-700 hover:border-emerald-400 hover:bg-emerald-50';
                            if (phase === 'summary') {
                                if (idx === quizQuestion.correct_index) btnClass = 'bg-emerald-500 border-emerald-600 text-white shadow-lg';
                                else if (idx === selectedAnswer) btnClass = 'bg-red-500 border-red-600 text-white shadow-lg';
                                else btnClass = 'bg-gray-50 border-gray-100 text-gray-400 opacity-50';
                            }
                            return (
                                <button key={idx} onClick={() => handleQuizAnswer(idx)} disabled={phase === 'summary'}
                                    className={`${btnClass} p-4 rounded-2xl font-bold text-sm md:text-lg transition-all flex items-center justify-between ${isEnglishQ ? 'text-left' : 'text-right'}`}
                                >
                                    <span className="flex-1 leading-snug">{option}</span>
                                    {phase === 'summary' && idx === quizQuestion.correct_index && <CheckCircle className="w-5 h-5 flex-shrink-0 ml-2"/>}
                                    {phase === 'summary' && idx === selectedAnswer && idx !== quizQuestion.correct_index && <XCircle className="w-5 h-5 flex-shrink-0 ml-2"/>}
                                </button>
                            );
                        })}
                    </div>

                    {phase === 'summary' && quizQuestion.explanation && (
                        <div className="mt-6 p-4 rounded-xl text-sm font-bold bg-blue-50 text-blue-800 border border-blue-200" dir={isEnglishQ ? 'ltr' : 'rtl'}>
                            <span className="block mb-1 opacity-70">📚 {isEnglishQ ? 'Explanation:' : 'المراجعة التعليمية:'}</span>
                            {quizQuestion.explanation}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null;
}
