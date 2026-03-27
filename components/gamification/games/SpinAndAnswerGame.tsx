import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Dices, HelpCircle, Clock, Star, Sparkles, Loader2, AlertCircle, Volume2, VolumeX, RotateCw, CheckCircle, XCircle, X, Globe, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { Employee } from '../../../types';
import { DiffProfile, applyMultiplier } from '../../../features/staff/components/arcade/types';

interface Props {
    employee: Employee;
    diffProfile: DiffProfile;
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

const WHEEL_SEGMENTS = [
    { label: 'سهل',          points: 5,  difficulty: 'easy',   time: 60  },
    { label: 'سهل',          points: 10, difficulty: 'easy',   time: 60  },
    { label: 'سهل',          points: 15, difficulty: 'easy',   time: 60  },
    { label: 'وسط',          points: 10, difficulty: 'medium', time: 90  },
    { label: 'وسط',          points: 15, difficulty: 'medium', time: 90  },
    { label: 'وسط',          points: 20, difficulty: 'medium', time: 90  },
    { label: 'صعب',          points: 20, difficulty: 'hard',   time: 120 },
    { label: 'صعب',          points: 25, difficulty: 'hard',   time: 120 },
    { label: 'صعب',          points: 30, difficulty: 'hard',   time: 120 },
    { label: 'صعب جداً',     points: 50, difficulty: 'expert', time: 180 },
    { label: 'سؤال عشوائي', points: 0,  difficulty: 'random', time: 90  },
];

const SEGMENT_COLORS = [
    '#fca5a5', '#fcd34d', '#86efac', '#93c5fd', '#c4b5fd', '#f9a8d4',
    '#a5f3fc', '#fdba74', '#bef264', '#d9f99d', '#fed7aa'
];

async function fetchQuestionWithAI(
    employeeSpecialty: string,
    difficulty: string,
    language?: string,
    contextSpecialty?: string
): Promise<any> {
    let level = 3;
    switch (difficulty) {
        case 'easy':   level = 3;  break;
        case 'medium': level = 6;  break;
        case 'hard':   level = 10; break;
        case 'expert': level = 14; break;
        default:       level = 6;
    }
    const specialtyForAI = contextSpecialty || employeeSpecialty;
    try {
        const { data, error } = await supabase.functions.invoke('generate-beast-question', {
            body: { specialty: specialtyForAI, level, usedTopics: [], language },
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
            .or(`specialty.ilike.%${employeeSpecialty}%,specialty.ilike.%الكل%`)
            .limit(30);
        if (!localQuestions?.length) throw new Error('No questions available');
        const random = localQuestions[Math.floor(Math.random() * localQuestions.length)];
        let options: string[] = [];
        if (random.options) {
            if (Array.isArray(random.options)) options = random.options;
            else try { options = JSON.parse(random.options); } catch { options = random.options.split(',').map((s: string) => s.trim()); }
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

// ─── مكون عرض الإجابة الصحيحة بعد الخطأ أو انتهاء الوقت ────────────────────
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

                {/* شريط العنوان */}
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
                    <button
                        onClick={onClose}
                        className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition"
                    >
                        <X className="w-4 h-4 text-white" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* السؤال */}
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1.5">
                            السؤال
                        </p>
                        <p className="text-gray-800 font-semibold text-sm leading-relaxed">
                            {question.question}
                        </p>
                    </div>

                    {/* الإجابة الصحيحة */}
                    <div className="bg-emerald-50 rounded-2xl p-4 border-2 border-emerald-300">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                            <p className="text-[11px] font-black text-emerald-600 uppercase tracking-wider">
                                الإجابة الصحيحة
                            </p>
                        </div>
                        <p className="text-emerald-800 font-black text-lg leading-snug">
                            {question.correct_answer}
                        </p>
                    </div>

                    {/* الشرح لو موجود */}
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

                    {/* زر الاستمرار */}
                    <button
                        onClick={onClose}
                        className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white py-3.5 rounded-2xl font-black text-sm shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <RotateCw className="w-4 h-4" />
                        العب تاني 🎡
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── المكون الرئيسي ───────────────────────────────────────────────────────────
export default function SpinAndAnswerGame({ employee, diffProfile, onStart, onComplete }: Props) {
    const [phase, setPhase] = useState<'wheel' | 'loading' | 'question'>('wheel');
    const [spinning, setSpinning] = useState(false);
    const [resultSegment, setResultSegment] = useState<typeof WHEEL_SEGMENTS[0] | null>(null);
    const [question, setQuestion] = useState<any>(null);
    const [pointsWon, setPointsWon] = useState(0);
    const [timeLeft, setTimeLeft] = useState(12);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [feedback, setFeedback] = useState<{ message: string; isCorrect: boolean } | null>(null);
    const [language, setLanguage] = useState<'auto' | 'ar' | 'en'>('auto');

    // حالة عرض الإجابة الصحيحة
    const [showWrongReveal, setShowWrongReveal] = useState(false);
    const [wrongRevealReason, setWrongRevealReason] = useState<'wrong' | 'timeout'>('wrong');

    const canvasRef       = useRef<HTMLCanvasElement>(null);
    const animationRef    = useRef<number>();
    const spinAngle       = useRef(0);
    const spinStartTime   = useRef(0);
    const spinDuration    = 3000;
    const spinTarget      = useRef(0);

    const needsMedicalEnglish = useCallback(() => {
        const specialty = employee.specialty?.toLowerCase() || '';
        return ['بشر','بشري','طبيب','طب','صيدلة','صيدلي','pharmacy',
                'أسنان','اسنان','dentistry','dental','معمل','مختبر',
                'laboratory','lab','أشعة','radiology','تخدير','anesthesia',
                'جراحة','surgery','قلب','cardiology','أعصاب','neurology',
        ].some(s => specialty.includes(s));
    }, [employee.specialty]);

    const getEffectiveLanguage = useCallback((): 'ar' | 'en' => {
        if (language === 'ar') return 'ar';
        if (language === 'en') return 'en';
        return needsMedicalEnglish() ? 'en' : 'ar';
    }, [language, needsMedicalEnglish]);

    const playSound = useCallback((type: 'spin' | 'win' | 'lose') => {
        if (!soundEnabled) return;
        try {
            const audio = new Audio(type === 'spin' ? '/spin.mp3' : type === 'win' ? '/applause.mp3' : '/fail.mp3');
            audio.volume = 0.6;
            audio.play().catch(() => {});
        } catch {}
    }, [soundEnabled]);

    const drawWheel = useCallback((angle: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const width = canvas.width, height = canvas.height;
        const centerX = width / 2, centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 10;
        ctx.clearRect(0, 0, width, height);
        const segmentAngle = (Math.PI * 2) / WHEEL_SEGMENTS.length;
        for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
            const start = i * segmentAngle + angle;
            const end   = (i + 1) * segmentAngle + angle;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, start, end);
            ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
            ctx.fill();
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(start + segmentAngle / 2);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#1f2937';
            ctx.font = 'bold 12px "Cairo"';
            ctx.fillText(
                WHEEL_SEGMENTS[i].label + '\n' + (WHEEL_SEGMENTS[i].points > 0 ? WHEEL_SEGMENTS[i].points + 'p' : '?'),
                radius * 0.65, 5
            );
            ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.stroke();
    }, []);

    useEffect(() => {
        if (phase !== 'wheel') return;
        drawWheel(spinAngle.current);
    }, [phase, drawWheel, spinAngle.current]);

    const animateSpin = (timestamp: number) => {
        if (!spinStartTime.current) spinStartTime.current = timestamp;
        const elapsed  = timestamp - spinStartTime.current;
        const progress = Math.min(1, elapsed / spinDuration);
        const easeOut  = 1 - Math.pow(1 - progress, 3);
        spinAngle.current = spinTarget.current * easeOut;
        drawWheel(spinAngle.current);
        if (progress < 1) {
            animationRef.current = requestAnimationFrame(animateSpin);
        } else {
            setSpinning(false);
            const fixedAngle   = spinAngle.current % (Math.PI * 2);
            const segmentAngle = (Math.PI * 2) / WHEEL_SEGMENTS.length;
            let index = Math.floor((fixedAngle + Math.PI) / segmentAngle) % WHEEL_SEGMENTS.length;
            if (index < 0) index += WHEEL_SEGMENTS.length;
            const selected = WHEEL_SEGMENTS[index];
            setResultSegment(selected);
            setTimeout(() => { setPhase('loading'); loadQuestion(selected); }, 500);
        }
    };

    const startSpin = async () => {
        if (spinning || phase !== 'wheel') return;
        setError(null);
        try { await onStart(); } catch { setError('لا توجد محاولات كافية'); return; }
        playSound('spin');
        setSpinning(true);
        spinTarget.current    = (8 + Math.random() * 8) * Math.PI * 2 + Math.random() * Math.PI * 2;
        spinAngle.current     = 0;
        spinStartTime.current = 0;
        animationRef.current  = requestAnimationFrame(animateSpin);
    };

    const loadQuestion = async (segment: typeof WHEEL_SEGMENTS[0]) => {
        setLoading(true);
        try {
            let difficulty = segment.difficulty;
            if (difficulty === 'random') {
                const rand = Math.random();
                difficulty = rand < 0.33 ? 'easy' : rand < 0.66 ? 'medium' : 'hard';
            }
            const effectiveLang = getEffectiveLanguage();
            const q = await fetchQuestionWithAI(
                employee.specialty,
                difficulty,
                effectiveLang,
                effectiveLang === 'en' ? 'Primary Care' : 'الرعاية الأساسية'
            );
            setQuestion(q);
            setPointsWon(segment.points);
            setTimeLeft(segment.time);
            setPhase('question');
        } catch (err: any) {
            setError(err.message || 'فشل تحميل السؤال');
            toast.error('فشل تحميل السؤال، حاول مرة أخرى');
            setPhase('wheel');
        } finally { setLoading(false); }
    };

    // ── المؤقت ────────────────────────────────────────────────────────────────
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (phase === 'question' && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (phase === 'question' && timeLeft === 0) {
            handleTimeout();
        }
        return () => clearInterval(timer);
    }, [phase, timeLeft]);

    const handleTimeout = () => {
        playSound('lose');
        setFeedback({ message: '⌛ انتهى الوقت!', isCorrect: false });
        onComplete(0, false);
        setTimeout(() => {
            setFeedback(null);
            setWrongRevealReason('timeout');
            setShowWrongReveal(true);      // ← عرض الإجابة الصحيحة
        }, 1200);
    };

    const handleAnswer = async (answer: string) => {
        if (phase !== 'question' || !!feedback) return;
        const isCorrect   = answer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase();
        const finalPoints = isCorrect ? applyMultiplier(pointsWon, diffProfile) : 0;

        if (isCorrect) {
            playSound('win');
            confetti({ particleCount: 200, spread: 80, origin: { y: 0.6 }, colors: ['#8b5cf6', '#ec4899', '#f59e0b'] });
            setFeedback({ message: `✅ إجابة صحيحة! +${finalPoints} نقطة`, isCorrect: true });
            onComplete(finalPoints, true);
            setTimeout(() => { setFeedback(null); resetToWheel(); }, 2000);
        } else {
            playSound('lose');
            setFeedback({ message: '❌ إجابة خاطئة!', isCorrect: false });
            onComplete(0, false);
            setTimeout(() => {
                setFeedback(null);
                setWrongRevealReason('wrong');
                setShowWrongReveal(true);  // ← عرض الإجابة الصحيحة
            }, 1200);
        }
    };

    const resetToWheel = () => {
        setPhase('wheel');
        setResultSegment(null);
        setQuestion(null);
        setTimeLeft(12);
        setPointsWon(0);
        setError(null);
        setFeedback(null);
        setShowWrongReveal(false);
    };

    useEffect(() => {
        return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
    }, []);

    useEffect(() => {
        if (phase === 'wheel' && !spinning) drawWheel(spinAngle.current);
    }, [phase, spinning, drawWheel]);

    const getLanguageDisplay = () => {
        if (language === 'ar') return '🇸🇦 عربي';
        if (language === 'en') return '🇬🇧 English';
        return needsMedicalEnglish() ? '🇬🇧 English (تلقائي)' : '🇸🇦 عربي (تلقائي)';
    };

    const formatTime = (seconds: number) => {
        if (seconds >= 60) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        return `${seconds} ث`;
    };

    // ──────────────────────────────────────────────────────────────────────────
    // WHEEL
    // ──────────────────────────────────────────────────────────────────────────
    if (phase === 'wheel') return (
        <div className="text-center py-4 animate-in fade-in duration-300" dir="rtl">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg mx-auto">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-2">
                        <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-full hover:bg-gray-100 transition">
                            {soundEnabled ? <Volume2 className="w-5 h-5 text-gray-600" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
                        </button>
                        <button
                            onClick={() => {
                                const options: ('auto' | 'ar' | 'en')[] = ['auto', 'ar', 'en'];
                                const next = options[(options.indexOf(language) + 1) % options.length];
                                setLanguage(next);
                                toast.success(`اللغة: ${next === 'auto' ? 'تلقائي' : next === 'ar' ? 'عربي' : 'English'}`, { icon: '🌐' });
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-100 text-indigo-700 text-xs font-black hover:bg-indigo-200 transition"
                        >
                            <Globe className="w-3 h-3" />
                            {getLanguageDisplay()}
                        </button>
                    </div>
                    <div className="bg-indigo-50 rounded-xl px-4 py-2 text-center">
                        <p className="text-xs font-bold text-indigo-700">مضاعف {diffProfile.emoji}</p>
                        <p className="text-xl font-black text-indigo-800">×{diffProfile.multiplier.toFixed(1)}</p>
                    </div>
                </div>
                <div className="relative flex justify-center mb-6">
                    <canvas ref={canvasRef} width={400} height={400} className="w-full max-w-[300px] md:max-w-[400px] h-auto rounded-full shadow-2xl" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 border-l-[15px] border-r-[15px] border-t-[25px] border-l-transparent border-r-transparent border-t-red-600 drop-shadow-md" />
                </div>
                <button onClick={startSpin} disabled={spinning} className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white py-4 rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {spinning ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCw className="w-5 h-5" />}
                    {spinning ? 'جاري اللف...' : 'لف العجلة'}
                </button>
                {error && <div className="mt-4 text-red-500 text-sm flex items-center justify-center gap-1"><AlertCircle className="w-4 h-4" /> {error}</div>}
            </div>
        </div>
    );

    // ──────────────────────────────────────────────────────────────────────────
    // LOADING
    // ──────────────────────────────────────────────────────────────────────────
    if (phase === 'loading') return (
        <div className="text-center py-16 animate-in fade-in duration-300">
            <Loader2 className="w-16 h-16 text-violet-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 font-bold">
                {getEffectiveLanguage() === 'en' ? 'Preparing your question...' : 'جاري تحضير السؤال...'}
            </p>
        </div>
    );

    // ──────────────────────────────────────────────────────────────────────────
    // QUESTION
    // ──────────────────────────────────────────────────────────────────────────
    if (phase === 'question' && question) {
        const options       = Array.isArray(question.options) ? question.options : [];
        const finalPoints   = applyMultiplier(pointsWon, diffProfile);
        const isRandom      = resultSegment?.difficulty === 'random';
        const displayPoints = isRandom ? 0 : finalPoints;
        const isEnglish     = question.language === 'en';
        const timeDisplay   = formatTime(timeLeft);

        return (
            <>
                <div className="text-center py-4 animate-in slide-in-from-right max-w-3xl mx-auto" dir={isEnglish ? 'ltr' : 'rtl'}>
                    {/* رأس المعلومات */}
                    <div className="flex justify-between items-center mb-6 px-4 flex-wrap gap-2">
                        <div className={`bg-gradient-to-r from-red-500 to-orange-500 text-white px-5 py-2 rounded-xl font-black shadow-lg flex items-center gap-2 ${timeLeft <= 10 ? 'animate-pulse' : ''}`}>
                            <Clock className="w-4 h-4 animate-pulse" /> {timeDisplay}
                        </div>
                        <div className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-5 py-2 rounded-xl font-black shadow-lg flex items-center gap-2">
                            <Star className="w-4 h-4" /> الجائزة: {displayPoints} نقطة
                        </div>
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-5 py-2 rounded-xl font-black shadow-lg flex items-center gap-2">
                            <Sparkles className="w-4 h-4" /> {resultSegment?.label || 'سؤال'}
                        </div>
                    </div>

                    {/* بطاقة السؤال */}
                    <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 p-8 rounded-3xl mb-8 border-2 border-violet-200 shadow-xl relative">
                        <HelpCircle className="w-14 h-14 text-violet-500 mx-auto mb-4 animate-bounce" />
                        <h3 className={`text-2xl font-black text-violet-900 leading-relaxed ${isEnglish ? 'text-left' : 'text-right'}`}>
                            {question.question}
                        </h3>
                        <div className="flex flex-wrap justify-center gap-2 mt-4">
                            {question.source === 'ai' && (
                                <p className="text-xs text-violet-400 flex items-center justify-center gap-1 bg-violet-50 px-3 py-1 rounded-full">
                                    <Sparkles className="w-3 h-3" /> {isEnglish ? 'Generated by' : 'بواسطة'} {question.provider}
                                </p>
                            )}
                            {question.source === 'local' && (
                                <p className="text-xs text-amber-600 flex items-center justify-center gap-1 bg-amber-50 px-3 py-1 rounded-full">
                                    <AlertCircle className="w-3 h-3" /> من بنك الأسئلة المحلي
                                </p>
                            )}
                        </div>

                        {/* Feedback overlay */}
                        {feedback && (
                            <div className={`absolute inset-0 flex items-center justify-center rounded-3xl backdrop-blur-sm animate-in fade-in zoom-in duration-200 ${feedback.isCorrect ? 'bg-green-100/90' : 'bg-red-100/90'}`}>
                                <div className="text-center p-4 rounded-2xl bg-white shadow-xl">
                                    {feedback.isCorrect
                                        ? <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                                        : <XCircle    className="w-12 h-12 text-red-500 mx-auto mb-2" />}
                                    <p className={`text-xl font-black ${feedback.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                                        {feedback.message}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* خيارات الإجابة */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {options.map((opt: string, idx: number) => (
                            <button
                                key={idx}
                                onClick={() => handleAnswer(opt)}
                                disabled={!!feedback}
                                className="bg-white border-2 border-gray-200 p-5 rounded-2xl font-bold text-gray-800 hover:border-violet-500 hover:bg-violet-50 hover:scale-105 transition-all active:scale-95 shadow-md hover:shadow-xl text-lg text-right disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>

                {/* عرض الإجابة الصحيحة بعد الخطأ أو انتهاء الوقت */}
                {showWrongReveal && (
                    <WrongAnswerReveal
                        question={question}
                        reason={wrongRevealReason}
                        isEnglish={isEnglish}
                        onClose={resetToWheel}
                    />
                )}
            </>
        );
    }

    return null;
}
