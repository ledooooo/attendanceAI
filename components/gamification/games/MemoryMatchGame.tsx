import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Gamepad2, Globe, Volume2, VolumeX, Loader2, HelpCircle, Clock, Star, Sparkles, CheckCircle, XCircle, X, RotateCw, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
    employee: any; // لتحديد التخصص وجلب الأسئلة المناسبة
}

// ─── مجموعة أيقونات أكبر لتناسب الأحجام المختلفة ─────────────────────────────
const BASE_ICONS = ['🚑', '💊', '💉', '🔬', '🩺', '🦷', '🧬', '🩸', '🧪', '🧫', '🫀', '🧠'];

// ─── جلب السؤال من AI (نفس الدالة المستخدمة في الألعاب الأخرى) ──────────────
async function fetchQuestionWithAI(specialty: string, language?: string): Promise<any> {
    const level = 6; // مستوى متوسط
    try {
        const { data, error } = await supabase.functions.invoke('generate-beast-question', {
            body: { specialty, level, usedTopics: [], language },
        });
        if (error || !data) throw new Error('AI request failed');
        if (data.error) throw new Error(data.error);
        if (!data.question || !data.options || data.correct === undefined) throw new Error('Invalid format');
        const correctAnswer = data.options[data.correct];
        return {
            source: 'ai',
            provider: data.provider || 'AI',
            language: data.language || language || 'ar',
            question: data.question,
            options: data.options,
            correct_answer: correctAnswer,
            explanation: data.explanation,
        };
    } catch (err) {
        console.warn('AI fallback:', err);
        const { data: localQuestions } = await supabase
            .from('quiz_questions')
            .select('*')
            .or(`specialty.ilike.%${specialty}%,specialty.ilike.%الكل%`)
            .limit(30);
        if (!localQuestions?.length) throw new Error('No questions available');
        const random = localQuestions[Math.floor(Math.random() * localQuestions.length)];
        let options: string[] = [];
        if (random.options) {
            if (Array.isArray(random.options)) options = random.options;
            else try { options = JSON.parse(random.options); } catch { options = random.options.split(',').map(s => s.trim()); }
        }
        return {
            source: 'local',
            language: 'ar',
            question: random.question_text,
            options,
            correct_answer: random.correct_answer,
        };
    }
}

// ─── مكون عرض الإجابة الصحيحة (مشترك) ──────────────────────────────────────
function WrongAnswerReveal({
    question,
    reason,
    isEnglish,
    onClose,
}: {
    question: any;
    reason: 'wrong' | 'timeout';
    isEnglish: boolean;
    onClose: () => void;
}) {
    const isTimeout = reason === 'timeout';
    const correctAnswer = question.correct_answer;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
            dir={isEnglish ? 'ltr' : 'rtl'}
        >
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                <div className={`px-5 py-4 flex items-center justify-between ${isTimeout ? 'bg-orange-500' : 'bg-red-500'}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white/25 rounded-xl flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-white font-black text-sm leading-tight">
                                {isTimeout ? '⏰ انتهى الوقت!' : '❌ إجابة خاطئة'}
                            </p>
                            <p className="text-white/80 text-xs">لحظة تعلّم 📚</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition">
                        <X className="w-4 h-4 text-white" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1.5">
                            السؤال
                        </p>
                        <p className="text-gray-800 font-semibold text-sm leading-relaxed">
                            {question.question}
                        </p>
                    </div>
                    <div className="bg-emerald-50 rounded-2xl p-4 border-2 border-emerald-300">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                            <p className="text-[11px] font-black text-emerald-600 uppercase tracking-wider">
                                الإجابة الصحيحة
                            </p>
                        </div>
                        <p className="text-emerald-800 font-black text-lg leading-snug">
                            {correctAnswer}
                        </p>
                    </div>
                    {question.explanation && (
                        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                            <div className="flex items-center gap-2 mb-1.5">
                                <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                <p className="text-[11px] font-black text-amber-600 uppercase tracking-wider">
                                    الشرح
                                </p>
                            </div>
                            <p className="text-amber-900 text-sm leading-relaxed">
                                {question.explanation}
                            </p>
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white py-3.5 rounded-2xl font-black text-sm shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <RotateCw className="w-4 h-4" />
                        {isEnglish ? 'Continue' : 'استمرار'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── اللعبة الرئيسية ─────────────────────────────────────────────────────────
export default function MemoryMatchGame({ onStart, onComplete, employee }: Props) {
    // خيارات الشبكة (عدد الأعمدة × عدد الصفوف)
    const GRID_OPTIONS = [
        { rows: 3, cols: 4, label: '3×4', pairs: 6 },
        { rows: 4, cols: 4, label: '4×4', pairs: 8 },
        { rows: 5, cols: 4, label: '5×4', pairs: 10 },
    ];

    const [selectedGrid, setSelectedGrid] = useState(GRID_OPTIONS[0]);
    const [cards, setCards] = useState<any[]>([]);
    const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
    const [matches, setMatches] = useState(0);
    const [timeLeft, setTimeLeft] = useState(45);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const [gameEnded, setGameEnded] = useState(false);
    const [gameWin, setGameWin] = useState(false);
    const [gamePoints, setGamePoints] = useState(0);

    // حالة السؤال الإضافي
    const [phase, setPhase] = useState<'game' | 'question' | 'loading'>('game');
    const [bonusQuestion, setBonusQuestion] = useState<any>(null);
    const [timeLeftQ, setTimeLeftQ] = useState(15);
    const [feedbackQ, setFeedbackQ] = useState<{ message: string; isCorrect: boolean } | null>(null);
    const [showWrongReveal, setShowWrongReveal] = useState(false);
    const [wrongRevealReason, setWrongRevealReason] = useState<'wrong' | 'timeout'>('wrong');
    const [loadingQuestion, setLoadingQuestion] = useState(false);

    // إعدادات الصوت واللغة
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [language, setLanguage] = useState<'auto' | 'ar' | 'en'>('auto');

    // تحديد التخصصات التي تحتاج إنجليزية طبية
    const needsMedicalEnglish = useCallback(() => {
        const specialty = employee.specialty?.toLowerCase() || '';
        const medicalTerms = [
            'بشر', 'بشري', 'طبيب', 'طب', 'صيدلة', 'صيدلي', 'pharmacy',
            'أسنان', 'اسنان', 'dentistry', 'dental', 'معمل', 'مختبر',
            'laboratory', 'lab', 'أشعة', 'radiology', 'تخدير', 'anesthesia',
            'علاج طبيعي', 'physical therapy', 'تمريض', 'nursing',
        ];
        return medicalTerms.some(term => specialty.includes(term));
    }, [employee.specialty]);

    const getEffectiveLanguage = useCallback((): 'ar' | 'en' => {
        if (language === 'ar') return 'ar';
        if (language === 'en') return 'en';
        return needsMedicalEnglish() ? 'en' : 'ar';
    }, [language, needsMedicalEnglish]);

    const playSound = useCallback((type: 'win' | 'lose') => {
        if (!soundEnabled) return;
        try {
            const audio = new Audio(type === 'win' ? '/applause.mp3' : '/fail.mp3');
            audio.volume = 0.6;
            audio.play().catch(() => {});
        } catch {}
    }, [soundEnabled]);

    // تهيئة البطاقات حسب الشبكة المختارة
    const initializeCards = (grid: typeof GRID_OPTIONS[0]) => {
        const pairs = grid.pairs;
        const neededIcons = BASE_ICONS.slice(0, pairs);
        const deck = [...neededIcons, ...neededIcons];
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck.map((icon, idx) => ({
            id: idx,
            icon,
            isFlipped: false,
            isMatched: false,
        }));
    };

    const startGame = async () => {
        setStarting(true);
        try {
            await onStart();
        } catch {
            setStarting(false);
            return;
        }
        setCards(initializeCards(selectedGrid));
        setMatches(0);
        setFlippedIndices([]);
        setTimeLeft(45);
        setIsActive(true);
        setGameEnded(false);
        setGameWin(false);
        setPhase('game');
        setStarting(false);
    };

    // مؤقت اللعبة
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (isActive && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (isActive && timeLeft === 0 && !gameEnded) {
            // انتهاء الوقت في لعبة الذاكرة → خسارة
            setIsActive(false);
            setGameEnded(true);
            setGameWin(false);
            setGamePoints(0);
            playSound('lose');
            toast.error('⏰ انتهى الوقت!');
            // الانتقال لجلب السؤال الإضافي
            loadBonusQuestion();
        }
        return () => clearInterval(timer);
    }, [isActive, timeLeft, gameEnded]);

    const handleCardClick = (index: number) => {
        if (!isActive || cards[index].isFlipped || cards[index].isMatched || flippedIndices.length === 2) return;
        const newCards = [...cards];
        newCards[index].isFlipped = true;
        setCards(newCards);
        const newFlipped = [...flippedIndices, index];
        setFlippedIndices(newFlipped);
        if (newFlipped.length === 2) {
            const [first, second] = newFlipped;
            if (newCards[first].icon === newCards[second].icon) {
                // تطابق صحيح
                setTimeout(() => {
                    const matchedCards = [...newCards];
                    matchedCards[first].isMatched = true;
                    matchedCards[second].isMatched = true;
                    setCards(matchedCards);
                    setFlippedIndices([]);
                    setMatches(prev => {
                        const newMatches = prev + 1;
                        if (newMatches === selectedGrid.pairs) {
                            // فوز
                            setIsActive(false);
                            setGameEnded(true);
                            setGameWin(true);
                            setGamePoints(20);
                            playSound('win');
                            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#f59e0b', '#d97706', '#b91c1c'] });
                            toast.success('🎉 مبروك! أنهيت اللعبة!');
                            // الانتقال لجلب السؤال الإضافي
                            loadBonusQuestion();
                        }
                        return newMatches;
                    });
                }, 500);
            } else {
                setTimeout(() => {
                    const resetCards = [...newCards];
                    resetCards[first].isFlipped = false;
                    resetCards[second].isFlipped = false;
                    setCards(resetCards);
                    setFlippedIndices([]);
                }, 1000);
            }
        }
    };

    const loadBonusQuestion = async () => {
        setPhase('loading');
        setLoadingQuestion(true);
        try {
            const effectiveLang = getEffectiveLanguage();
            const q = await fetchQuestionWithAI(employee.specialty, effectiveLang);
            setBonusQuestion(q);
            setTimeLeftQ(15);
            setPhase('question');
        } catch (err) {
            console.error('Failed to load bonus question:', err);
            toast.error(getEffectiveLanguage() === 'en' ? 'Failed to load bonus question' : 'فشل تحميل سؤال المكافأة');
            // إذا فشل، ننهي اللعبة بدون سؤال
            onComplete(gamePoints, gameWin);
            resetAfterGame();
        } finally {
            setLoadingQuestion(false);
        }
    };

    // مؤقت السؤال
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (phase === 'question' && timeLeftQ > 0 && bonusQuestion && !showWrongReveal) {
            timer = setInterval(() => setTimeLeftQ(prev => prev - 1), 1000);
        } else if (phase === 'question' && timeLeftQ === 0 && bonusQuestion && !showWrongReveal) {
            handleQuestionTimeout();
        }
        return () => clearInterval(timer);
    }, [phase, timeLeftQ, bonusQuestion, showWrongReveal]);

    const handleQuestionTimeout = () => {
        setFeedbackQ({ message: getEffectiveLanguage() === 'en' ? '⌛ Time\'s up!' : '⌛ انتهى الوقت!', isCorrect: false });
        setShowWrongReveal(true);
        setWrongRevealReason('timeout');
        // لا نضيف نقاط
        onComplete(gamePoints, gameWin);
    };

    const handleBonusAnswer = (answer: string) => {
        if (phase !== 'question' || !bonusQuestion || showWrongReveal) return;
        const isCorrect = answer.trim().toLowerCase() === bonusQuestion.correct_answer.trim().toLowerCase();
        const bonusPoints = isCorrect ? 10 : 0;
        const totalPoints = gamePoints + bonusPoints;

        if (isCorrect) {
            playSound('win');
            confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 }, colors: ['#10b981', '#f59e0b'] });
            setFeedbackQ({ message: getEffectiveLanguage() === 'en' ? `✅ Correct! +${bonusPoints} bonus points` : `✅ إجابة صحيحة! +${bonusPoints} نقطة إضافية`, isCorrect: true });
            setTimeout(() => {
                setFeedbackQ(null);
                onComplete(totalPoints, gameWin);
                resetAfterGame();
            }, 1800);
        } else {
            playSound('lose');
            setFeedbackQ({ message: getEffectiveLanguage() === 'en' ? '❌ Wrong answer!' : '❌ إجابة خاطئة!', isCorrect: false });
            setShowWrongReveal(true);
            setWrongRevealReason('wrong');
            onComplete(totalPoints, gameWin);
        }
    };

    const closeWrongReveal = () => {
        setShowWrongReveal(false);
        resetAfterGame();
    };

    const resetAfterGame = () => {
        setPhase('game');
        setBonusQuestion(null);
        setFeedbackQ(null);
        setShowWrongReveal(false);
        setGameEnded(false);
        setIsActive(false);
    };

    const getLanguageDisplay = () => {
        if (language === 'ar') return '🇸🇦 عربي';
        if (language === 'en') return '🇬🇧 English';
        return needsMedicalEnglish() ? '🇬🇧 English (تلقائي)' : '🇸🇦 عربي (تلقائي)';
    };

    const cycleLanguage = () => {
        const options: ('auto' | 'ar' | 'en')[] = ['auto', 'ar', 'en'];
        const currentIndex = options.indexOf(language);
        const next = options[(currentIndex + 1) % options.length];
        setLanguage(next);
        const langMsg = next === 'auto' ? (needsMedicalEnglish() ? 'English (Auto)' : 'عربي (تلقائي)') : next === 'ar' ? 'عربي' : 'English Medical';
        toast.success(`Language: ${langMsg}`, { icon: '🌐' });
    };

    const isEn = getEffectiveLanguage() === 'en';
    const isEnglishQuestion = bonusQuestion?.language === 'en';

    // شاشة البداية (اختيار الشبكة)
    if (!isActive && phase === 'game' && !gameEnded) {
        return (
            <div className="text-center py-6 px-3">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Gamepad2 className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-black text-gray-800 mb-2">
                    {isEn ? 'Memory Match 🧠' : 'تطابق الذاكرة 🧠'}
                </h3>
                <p className="text-xs font-bold text-gray-500 mb-4 max-w-xs mx-auto">
                    {isEn
                        ? 'Match all pairs before time runs out!'
                        : 'طابق جميع الأزواج قبل انتهاء الوقت!'}
                </p>

                {/* اختيار حجم الشبكة */}
                <div className="bg-white rounded-2xl p-3 mb-5 shadow-md border border-gray-100 max-w-xs mx-auto">
                    <p className="text-xs font-bold text-gray-600 mb-2 flex items-center justify-center gap-1">
                        {isEn ? 'Select Grid Size' : 'اختر حجم الشبكة'}
                    </p>
                    <div className="flex justify-center gap-3">
                        {GRID_OPTIONS.map(opt => (
                            <button
                                key={opt.label}
                                onClick={() => setSelectedGrid(opt)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                    selectedGrid.label === opt.label
                                        ? 'bg-orange-600 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-3 rounded-2xl max-w-xs mx-auto mb-4 border border-orange-200">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-white p-2 rounded-lg"><p className="text-orange-600 font-bold">{isEn ? 'Time' : 'الوقت'}</p><p className="text-lg font-black">45s</p></div>
                        <div className="bg-white p-2 rounded-lg"><p className="text-orange-600 font-bold">{isEn ? 'Pairs' : 'أزواج'}</p><p className="text-lg font-black">{selectedGrid.pairs}</p></div>
                        <div className="bg-white p-2 rounded-lg col-span-2"><p className="text-orange-600 font-bold">{isEn ? 'Bonus Question' : 'سؤال إضافي'}</p><p className="text-base font-black">+{isEn ? '10 points' : '10 نقاط'}</p></div>
                    </div>
                </div>

                <div className="flex justify-center gap-2 mb-4">
                    <button onClick={cycleLanguage} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-black">
                        <Globe className="w-3 h-3" />
                        {getLanguageDisplay()}
                    </button>
                    <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-lg hover:bg-gray-100">
                        {soundEnabled ? <Volume2 className="w-4 h-4 text-gray-600" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                    </button>
                </div>

                <button
                    onClick={startGame}
                    disabled={starting}
                    className="bg-gradient-to-r from-orange-500 to-amber-600 text-white px-6 py-3 rounded-xl font-black shadow-lg hover:scale-105 transition-all disabled:opacity-50 text-sm"
                >
                    {starting ? (isEn ? 'Starting...' : 'جاري البدء...') : (isEn ? '🎮 Start Game' : '🎮 ابدأ اللعب')}
                </button>
            </div>
        );
    }

    // شاشة اللعب
    if (phase === 'game' && isActive && cards.length > 0) {
        const rows = selectedGrid.rows;
        const cols = selectedGrid.cols;
        const gridTemplate = `grid-cols-${cols}`;
        // Tailwind لا يدعم grid-cols-* ديناميكياً، نستخدم inline style
        return (
            <div className="max-w-2xl mx-auto py-4 px-3 text-center animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-5">
                    <div className={`px-4 py-2 rounded-xl font-black text-sm shadow-md ${timeLeft > 15 ? 'bg-orange-500 text-white' : 'bg-red-500 text-white animate-pulse'}`}>
                        ⏰ {timeLeft}s
                    </div>
                    <div className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-4 py-2 rounded-xl font-black shadow-md text-sm">
                        ✅ {matches} / {selectedGrid.pairs}
                    </div>
                </div>
                <div
                    className="grid gap-2 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-3 border border-orange-200 shadow-lg"
                    style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                >
                    {cards.map((card, idx) => (
                        <div
                            key={card.id}
                            onClick={() => handleCardClick(idx)}
                            className={`aspect-square rounded-xl cursor-pointer transition-all duration-300 transform flex items-center justify-center text-2xl md:text-3xl shadow-md ${
                                card.isFlipped || card.isMatched
                                    ? 'bg-white border border-orange-300'
                                    : 'bg-gradient-to-br from-gray-700 to-gray-900 hover:from-gray-600 hover:to-gray-800'
                            } ${card.isMatched ? 'opacity-50 scale-95' : 'hover:scale-105'}`}
                        >
                            {(card.isFlipped || card.isMatched) ? card.icon : <span className="text-white/30 text-lg font-black">?</span>}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // شاشة التحميل (جلب السؤال)
    if (phase === 'loading') {
        return (
            <div className="text-center py-16">
                <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-3" />
                <p className="text-sm font-bold text-gray-600">
                    {isEn ? 'Preparing bonus question...' : 'جاري تحضير سؤال المكافأة...'}
                </p>
            </div>
        );
    }

    // شاشة السؤال الإضافي
    if (phase === 'question' && bonusQuestion && !showWrongReveal) {
        const options = Array.isArray(bonusQuestion.options) ? bonusQuestion.options : [];
        return (
            <div className="text-center py-4 animate-in slide-in-from-right max-w-3xl mx-auto" dir={isEnglishQuestion ? 'ltr' : 'rtl'}>
                <div className="flex justify-between items-center mb-6 px-4 flex-wrap gap-2">
                    <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-5 py-2 rounded-xl font-black shadow-lg flex items-center gap-2">
                        <Clock className="w-4 h-4 animate-pulse" /> {timeLeftQ}s
                    </div>
                    <div className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-5 py-2 rounded-xl font-black shadow-lg flex items-center gap-2">
                        <Star className="w-4 h-4" /> {isEn ? 'Bonus: +10 pts' : 'مكافأة: +10 نقاط'}
                    </div>
                    <div className="bg-gradient-to-r from-orange-500 to-amber-600 text-white px-5 py-2 rounded-xl font-black shadow-lg flex items-center gap-2">
                        <Sparkles className="w-4 h-4" /> {isEn ? 'Bonus Question' : 'سؤال إضافي'}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-8 rounded-3xl mb-8 border-2 border-orange-200 shadow-xl relative">
                    <HelpCircle className="w-14 h-14 text-orange-500 mx-auto mb-4 animate-bounce" />
                    <h3 className={`text-2xl font-black text-orange-900 leading-relaxed ${isEnglishQuestion ? 'text-left' : 'text-right'}`}>
                        {bonusQuestion.question}
                    </h3>
                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                        {bonusQuestion.source === 'ai' && (
                            <p className="text-xs text-orange-400 flex items-center justify-center gap-1 bg-orange-50 px-3 py-1 rounded-full">
                                <Sparkles className="w-3 h-3" /> {isEn ? 'Generated by' : 'بواسطة'} {bonusQuestion.provider}
                            </p>
                        )}
                        {bonusQuestion.source === 'local' && (
                            <p className="text-xs text-amber-500 flex items-center justify-center gap-1 bg-amber-50 px-3 py-1 rounded-full">
                                <AlertCircle className="w-3 h-3" /> {isEn ? 'From local bank' : 'من بنك الأسئلة المحلي'}
                            </p>
                        )}
                    </div>
                    {feedbackQ && (
                        <div className={`absolute inset-0 flex items-center justify-center rounded-3xl backdrop-blur-sm animate-in fade-in zoom-in duration-200 ${
                            feedbackQ.isCorrect ? 'bg-green-100/90' : 'bg-red-100/90'
                        }`}>
                            <div className="text-center p-4 rounded-2xl bg-white shadow-xl">
                                {feedbackQ.isCorrect ? (
                                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                                ) : (
                                    <XCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                                )}
                                <p className={`text-xl font-black ${feedbackQ.isCorrect ? 'text-green-700' : 'text-red-700'}`}>{feedbackQ.message}</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {options.map((opt: string, idx: number) => (
                        <button
                            key={idx}
                            onClick={() => handleBonusAnswer(opt)}
                            disabled={!!feedbackQ}
                            className="bg-white border-2 border-gray-200 p-5 rounded-2xl font-bold text-gray-800 hover:border-orange-400 hover:bg-orange-50 hover:scale-105 transition-all active:scale-95 shadow-md hover:shadow-xl text-lg text-right disabled:opacity-60"
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // عرض الشاشة التعليمية (إجابة خاطئة أو انتهاء وقت السؤال)
    if (showWrongReveal && bonusQuestion) {
        return (
            <WrongAnswerReveal
                question={bonusQuestion}
                reason={wrongRevealReason}
                isEnglish={isEnglishQuestion}
                onClose={closeWrongReveal}
            />
        );
    }

    return null;
}