import React, { useState, useEffect, useCallback } from 'react';
import { Gamepad2, Globe, Volume2, VolumeX, Loader2, BookOpen, RotateCw, CheckCircle, XCircle, Sparkles, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { DiffProfile, applyMultiplier } from '../../../features/staff/components/arcade/types';

interface Props {
    employee: Employee;
    diffProfile: DiffProfile;
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

type GridSize = '3x4' | '4x4' | '5x4';
const GRID_OPTIONS: { value: GridSize; label: string; labelEn: string; pairs: number; cols: number; rows: number }[] = [
    { value: '3x4', label: '3×4', labelEn: '3×4', pairs: 6, cols: 4, rows: 3 },
    { value: '4x4', label: '4×4', labelEn: '4×4', pairs: 8, cols: 4, rows: 4 },
    { value: '5x4', label: '5×4', labelEn: '5×4', pairs: 10, cols: 4, rows: 5 },
];

// أيقونات طبية (ممكن إضافتها حسب عدد الأزواج)
const MEDICAL_ICONS = [
    '🚑', '💊', '💉', '🔬', '🩺', '🦷', '🫀', '🧠', '🦴', '🩸',
    '🧪', '🩻', '💉', '🩺', '🦷', '🫀', '🧠', '🦴', '🩸', '🧪'
];

// ─── جلب السؤال من AI ────────────────────────────────────────────────────────
async function fetchBonusQuestion(
    specialty: string,
    language?: string
): Promise<any> {
    const level = 6;
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

// ─── مكون عرض الإجابة الصحيحة ────────────────────────────────────────────────
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
                            {isEnglish ? 'Question' : 'السؤال'}
                        </p>
                        <p className="text-gray-800 font-semibold text-sm leading-relaxed">
                            {question.question}
                        </p>
                    </div>
                    <div className="bg-emerald-50 rounded-2xl p-4 border-2 border-emerald-300">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                            <p className="text-[11px] font-black text-emerald-600 uppercase tracking-wider">
                                {isEnglish ? 'Correct Answer' : 'الإجابة الصحيحة'}
                            </p>
                        </div>
                        <p className="text-emerald-800 font-black text-lg leading-snug">
                            {question.correct_answer}
                        </p>
                    </div>
                    {question.explanation && (
                        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                            <div className="flex items-center gap-2 mb-1.5">
                                <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                <p className="text-[11px] font-black text-amber-600 uppercase tracking-wider">
                                    {isEnglish ? 'Explanation' : 'الشرح'}
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

// ─── المكون الرئيسي ───────────────────────────────────────────────────────────
export default function MemoryMatchGame({ employee, diffProfile, onStart, onComplete }: Props) {
    const [gridSize, setGridSize] = useState<GridSize>('4x4');
    const [cards, setCards] = useState<{ id: number; icon: string; isFlipped: boolean; isMatched: boolean }[]>([]);
    const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
    const [matches, setMatches] = useState(0);
    const [timeLeft, setTimeLeft] = useState(45);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const [phase, setPhase] = useState<'setup' | 'game' | 'bonus' >('setup');
    const [bonusQuestion, setBonusQuestion] = useState<any>(null);
    const [bonusTimeLeft, setBonusTimeLeft] = useState(15);
    const [bonusFeedback, setBonusFeedback] = useState<{ message: string; isCorrect: boolean } | null>(null);
    const [showWrongReveal, setShowWrongReveal] = useState(false);
    const [wrongRevealReason, setWrongRevealReason] = useState<'wrong' | 'timeout'>('wrong');
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [language, setLanguage] = useState<'auto' | 'ar' | 'en'>('auto');
    const [gameResult, setGameResult] = useState<{ win: boolean; basePoints: number } | null>(null);
    const [loadingBonus, setLoadingBonus] = useState(false);

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
            audio.volume = 0.5;
            audio.play().catch(() => {});
        } catch {}
    }, [soundEnabled]);

    const startGame = async () => {
        setStarting(true);
        try {
            await onStart();
        } catch {
            setStarting(false);
            return;
        }
        const selected = GRID_OPTIONS.find(g => g.value === gridSize)!;
        const totalPairs = selected.pairs;
        const icons = MEDICAL_ICONS.slice(0, totalPairs);
        const deck = [...icons, ...icons]
            .sort(() => 0.5 - Math.random())
            .map((icon, idx) => ({ id: idx, icon, isFlipped: false, isMatched: false }));
        setCards(deck);
        setMatches(0);
        setFlippedIndices([]);
        setTimeLeft(45);
        setIsActive(true);
        setPhase('game');
        setStarting(false);
    };

    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (phase === 'game' && isActive && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (phase === 'game' && isActive && timeLeft === 0) {
            handleGameEnd(false, 0);
        }
        return () => clearInterval(timer);
    }, [phase, isActive, timeLeft]);

    const handleGameEnd = (win: boolean, basePoints: number) => {
        setIsActive(false);
        setGameResult({ win, basePoints });
        if (win) {
            playSound('win');
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#f97316', '#ea580c', '#f59e0b'] });
            toast.success(getEffectiveLanguage() === 'en' ? '🎉 You completed the game!' : '🎉 مبروك! أنهيت اللعبة!');
        } else {
            playSound('lose');
            toast.error(getEffectiveLanguage() === 'en' ? '⏰ Time\'s up!' : '⏰ انتهى الوقت!');
        }
        // جلب السؤال الإضافي
        loadBonusQuestion(basePoints);
    };

    const loadBonusQuestion = async (basePoints: number) => {
        setLoadingBonus(true);
        try {
            const effectiveLang = getEffectiveLanguage();
            const q = await fetchBonusQuestion(employee.specialty, effectiveLang);
            setBonusQuestion(q);
            setBonusTimeLeft(15);
            setPhase('bonus');
        } catch (err) {
            console.error('Failed to load bonus question:', err);
            onComplete(basePoints, gameResult?.win || false);
        } finally {
            setLoadingBonus(false);
        }
    };

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
                setTimeout(() => {
                    const matchedCards = [...newCards];
                    matchedCards[first].isMatched = true;
                    matchedCards[second].isMatched = true;
                    setCards(matchedCards);
                    setFlippedIndices([]);
                    setMatches(prev => {
                        const nm = prev + 1;
                        const totalPairs = GRID_OPTIONS.find(g => g.value === gridSize)!.pairs;
                        if (nm === totalPairs) {
                            handleGameEnd(true, 20); // 20 نقطة أساسية
                        }
                        return nm;
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

    const handleBonusAnswer = (answer: string) => {
        if (phase !== 'bonus' || bonusFeedback) return;
        const isCorrect = answer.trim().toLowerCase() === bonusQuestion.correct_answer.trim().toLowerCase();
        const bonusPoints = isCorrect ? 15 : 0;
        const totalPoints = (gameResult?.basePoints || 0) + bonusPoints;

        if (isCorrect) {
            playSound('win');
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#f97316', '#ea580c', '#f59e0b'] });
            setBonusFeedback({ message: `✅ ${getEffectiveLanguage() === 'en' ? `Correct! +${bonusPoints} bonus points` : `إجابة صحيحة! +${bonusPoints} نقطة إضافية`}`, isCorrect: true });
            onComplete(totalPoints, true);
        } else {
            playSound('lose');
            setBonusFeedback({ message: getEffectiveLanguage() === 'en' ? '❌ Wrong answer!' : '❌ إجابة خاطئة!', isCorrect: false });
            onComplete(totalPoints, gameResult?.win || false);
            setShowWrongReveal(true);
            setWrongRevealReason('wrong');
        }
        setTimeout(() => {
            if (!isCorrect) {
                setShowWrongReveal(true);
            } else {
                // انتظر 1.5 ثانية ثم أغلق اللعبة
                setTimeout(() => {
                    // اللعبة انتهت
                }, 1500);
            }
        }, 500);
    };

    const closeWrongReveal = () => {
        setShowWrongReveal(false);
        // بعد عرض الإجابة الصحيحة، ننهي اللعبة
    };

    // مؤقت السؤال الإضافي
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (phase === 'bonus' && bonusTimeLeft > 0 && !bonusFeedback) {
            timer = setInterval(() => setBonusTimeLeft(prev => prev - 1), 1000);
        } else if (phase === 'bonus' && bonusTimeLeft === 0 && !bonusFeedback) {
            handleBonusTimeout();
        }
        return () => clearInterval(timer);
    }, [phase, bonusTimeLeft, bonusFeedback]);

    const handleBonusTimeout = () => {
        playSound('lose');
        setBonusFeedback({ message: getEffectiveLanguage() === 'en' ? '⌛ Time\'s up!' : '⌛ انتهى الوقت!', isCorrect: false });
        onComplete(gameResult?.basePoints || 0, gameResult?.win || false);
        setShowWrongReveal(true);
        setWrongRevealReason('timeout');
    };

    const getLanguageDisplay = () => {
        if (language === 'ar') return '🇸🇦 عربي';
        if (language === 'en') return '🇬🇧 English';
        return needsMedicalEnglish() ? '🇬🇧 English (Auto)' : '🇸🇦 عربي (Auto)';
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
    const selectedGrid = GRID_OPTIONS.find(g => g.value === gridSize)!;
    const gridCols = selectedGrid.cols;
    const gridRows = selectedGrid.rows;

    // شاشة إعدادات اللعبة
    if (phase === 'setup') {
        return (
            <div className="text-center py-6 px-3">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Gamepad2 className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-black text-gray-800 mb-2">
                    {isEn ? 'Memory Match! 🧠' : 'تطابق الذاكرة! 🧠'}
                </h3>
                <p className="text-xs font-bold text-gray-500 mb-4 max-w-xs mx-auto">
                    {isEn
                        ? 'Choose grid size, then match all pairs within 45 seconds!'
                        : 'اختر حجم الشبكة، ثم طابق جميع الأزواج في 45 ثانية!'}
                </p>
                <div className="bg-white rounded-2xl p-4 mb-5 shadow-md border border-gray-100 max-w-xs mx-auto">
                    <p className="text-xs font-bold text-gray-600 mb-2 flex items-center justify-center gap-1">
                        <Gamepad2 className="w-3 h-3" /> {isEn ? 'Grid Size' : 'حجم الشبكة'}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                        {GRID_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setGridSize(opt.value)}
                                className={`px-2 py-1.5 rounded-lg text-xs font-black transition-all ${
                                    gridSize === opt.value
                                        ? 'bg-orange-600 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                {isEn ? opt.labelEn : opt.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-3 rounded-2xl max-w-xs mx-auto mb-4 border border-orange-200">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-white p-2 rounded-lg"><p className="text-orange-600 font-bold">{isEn ? 'Pairs' : 'أزواج'}</p><p className="text-lg font-black">{selectedGrid.pairs}</p></div>
                        <div className="bg-white p-2 rounded-lg"><p className="text-orange-600 font-bold">{isEn ? 'Time' : 'الوقت'}</p><p className="text-lg font-black">45s</p></div>
                        <div className="bg-white p-2 rounded-lg col-span-2"><p className="text-orange-600 font-bold">{isEn ? 'Bonus' : 'مكافأة'}</p><p className="text-base font-black">+15 {isEn ? 'points for correct answer' : 'نقطة للإجابة الصحيحة'}</p></div>
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
                    {starting ? (isEn ? '⏳ Starting...' : '⏳ جاري البدء...') : (isEn ? '🎮 Start Game' : '🎮 ابدأ اللعب')}
                </button>
            </div>
        );
    }

    // مرحلة اللعب
    if (phase === 'game' && cards.length > 0) {
        const totalPairs = selectedGrid.pairs;
        return (
            <div className="max-w-2xl mx-auto py-4 px-3 text-center animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-4">
                    <div className={`px-3 py-1.5 rounded-xl font-black text-sm shadow-md ${timeLeft > 15 ? 'bg-orange-500 text-white' : 'bg-red-500 text-white animate-pulse'}`}>
                        ⏱️ {timeLeft}s
                    </div>
                    <div className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-3 py-1.5 rounded-xl font-black text-sm shadow-md">
                        ✅ {matches} / {totalPairs}
                    </div>
                </div>
                <div
                    className="grid gap-2 p-2 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-200 shadow-md"
                    style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
                    dir="ltr"
                >
                    {cards.map((card, idx) => (
                        <div
                            key={card.id}
                            onClick={() => handleCardClick(idx)}
                            className={`aspect-square rounded-xl cursor-pointer transition-all duration-300 transform flex items-center justify-center text-2xl md:text-3xl shadow-md ${
                                card.isFlipped || card.isMatched
                                    ? 'bg-white border-2 border-orange-300'
                                    : 'bg-gradient-to-br from-gray-700 to-gray-900 hover:from-gray-600 hover:to-gray-800'
                            } ${card.isMatched ? 'opacity-50 scale-95' : 'hover:scale-105'}`}
                        >
                            {(card.isFlipped || card.isMatched)
                                ? card.icon
                                : <span className="text-white/30 text-sm font-black">?</span>
                            }
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // مرحلة السؤال الإضافي
    if (phase === 'bonus' && bonusQuestion && !showWrongReveal) {
        const options = Array.isArray(bonusQuestion.options) ? bonusQuestion.options : [];
        const isEnglishQuestion = bonusQuestion.language === 'en';
        return (
            <div className="text-center py-3 animate-in slide-in-from-right max-w-3xl mx-auto" dir={isEnglishQuestion ? 'ltr' : 'rtl'}>
                <div className="flex justify-between items-center mb-4 px-3 flex-wrap gap-1">
                    <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-1.5 rounded-xl font-black text-xs shadow-lg flex items-center gap-1">
                        <Clock className="w-3 h-3 animate-pulse" /> {bonusTimeLeft}s
                    </div>
                    <div className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-3 py-1.5 rounded-xl font-black text-xs shadow-lg flex items-center gap-1">
                        <Star className="w-3 h-3" /> +15 {isEn ? 'pts' : 'نقطة'}
                    </div>
                    <div className="bg-gradient-to-r from-orange-500 to-amber-600 text-white px-3 py-1.5 rounded-xl font-black text-xs shadow-lg flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> {isEn ? 'Bonus Question' : 'سؤال إضافي'}
                    </div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-5 rounded-2xl mb-6 border border-orange-200 shadow-sm relative">
                    <HelpCircle className="w-10 h-10 text-orange-500 mx-auto mb-3 animate-bounce" />
                    <h3 className={`text-base font-black text-gray-800 leading-relaxed ${isEnglishQuestion ? 'text-left' : 'text-right'}`}>
                        {bonusQuestion.question}
                    </h3>
                    <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                        {bonusQuestion.source === 'ai' && (
                            <span className="text-[9px] text-orange-400 bg-orange-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                <Sparkles className="w-2.5 h-2.5" /> AI
                            </span>
                        )}
                        {bonusQuestion.source === 'local' && (
                            <span className="text-[9px] text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">
                                <AlertCircle className="w-2.5 h-2.5" /> {isEn ? 'Local' : 'محلي'}
                            </span>
                        )}
                    </div>
                    {bonusFeedback && (
                        <div className={`absolute inset-0 flex items-center justify-center rounded-2xl backdrop-blur-sm animate-in fade-in zoom-in duration-200 ${
                            bonusFeedback.isCorrect ? 'bg-green-100/90' : 'bg-red-100/90'
                        }`}>
                            <div className="text-center p-3 rounded-xl bg-white shadow">
                                {bonusFeedback.isCorrect ? <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-1" /> : <XCircle className="w-8 h-8 text-red-500 mx-auto mb-1" />}
                                <p className={`text-sm font-black ${bonusFeedback.isCorrect ? 'text-green-700' : 'text-red-700'}`}>{bonusFeedback.message}</p>
                            </div>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-1 gap-2">
                    {options.map((opt: string, idx: number) => (
                        <button
                            key={idx}
                            onClick={() => handleBonusAnswer(opt)}
                            disabled={!!bonusFeedback}
                            className="bg-white border border-gray-200 p-3 rounded-xl font-bold text-sm text-gray-800 hover:border-orange-400 hover:bg-orange-50 hover:scale-105 transition-all active:scale-95 shadow-sm text-right"
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // عرض الشاشة التعليمية
    if (showWrongReveal && bonusQuestion) {
        return (
            <WrongAnswerReveal
                question={bonusQuestion}
                reason={wrongRevealReason}
                isEnglish={bonusQuestion.language === 'en'}
                onClose={() => {
                    setShowWrongReveal(false);
                    // بعد إغلاق المودال، ننهي اللعبة
                    onComplete(gameResult?.basePoints || 0, gameResult?.win || false);
                }}
            />
        );
    }

    return null;
}