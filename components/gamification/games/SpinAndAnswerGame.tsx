import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import {
    Dices, HelpCircle, Clock, Star, Sparkles, Loader2, AlertCircle,
    Volume2, VolumeX, RotateCw, CheckCircle, XCircle, X, Globe,
    BookOpen, Flame, TrendingUp, Award
} from 'lucide-react';
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

// ─── Timing map: difficulty → seconds ────────────────────────────────────────
// مدة معقولة لكل مستوى صعوبة
const DIFFICULTY_TIME: Record<string, number> = {
    easy:   45,   // سهل: 45 ثانية
    medium: 75,   // وسط: 75 ثانية (1:15)
    hard:   120,  // صعب: دقيقتان
    expert: 180,  // خبير: 3 دقائق
    random: 90,   // عشوائي: 90 ثانية افتراضية
};

const WHEEL_SEGMENTS = [
    { label: 'سهل',          points: 5,  difficulty: 'easy'   },
    { label: 'سهل',          points: 10, difficulty: 'easy'   },
    { label: 'سهل',          points: 15, difficulty: 'easy'   },
    { label: 'وسط',          points: 10, difficulty: 'medium' },
    { label: 'وسط',          points: 15, difficulty: 'medium' },
    { label: 'وسط',          points: 20, difficulty: 'medium' },
    { label: 'صعب',          points: 20, difficulty: 'hard'   },
    { label: 'صعب',          points: 25, difficulty: 'hard'   },
    { label: 'صعب',          points: 30, difficulty: 'hard'   },
    { label: 'صعب جداً',     points: 50, difficulty: 'expert' },
    { label: 'سؤال عشوائي', points: 0,  difficulty: 'random' },
];

const SEGMENT_COLORS = [
    '#86efac','#86efac','#86efac',   // easy → green
    '#93c5fd','#93c5fd','#93c5fd',   // medium → blue
    '#fcd34d','#fcd34d','#fcd34d',   // hard → amber
    '#f87171',                        // expert → red
    '#c4b5fd',                        // random → purple
];

// ─── Session stats ────────────────────────────────────────────────────────────
interface SessionStats {
    total:   number;
    correct: number;
    streak:  number;
    bestStreak: number;
}

// ─── AI question fetcher ──────────────────────────────────────────────────────
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
        if (error || !data)          throw new Error('AI request failed');
        if (data.error)              throw new Error(data.error);
        if (!data.question || !data.options || data.correct === undefined)
            throw new Error('Invalid format');
        const correctAnswer = data.options[data.correct];
        return {
            source: 'ai',
            provider: data.provider || 'AI',
            language: data.language || language || 'ar',
            question: data.question,
            options:  data.options,
            correct_answer: correctAnswer,
            explanation:    data.explanation,
            topic: data.topic,
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
            else try { options = JSON.parse(random.options); }
                 catch { options = random.options.split(',').map((s: string) => s.trim()); }
        }
        return {
            source: 'local', language: 'ar',
            question:       random.question_text,
            options,
            correct_answer: random.correct_answer,
        };
    }
}

// ─── Timer Ring ───────────────────────────────────────────────────────────────
function TimerRing({ seconds, total }: { seconds: number; total: number }) {
    const pct    = seconds / total;
    const radius = 28;
    const circ   = 2 * Math.PI * radius;
    const color  = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f97316' : '#ef4444';
    const mins   = Math.floor(seconds / 60);
    const secs   = seconds % 60;
    const label  = mins > 0
        ? `${mins}:${String(secs).padStart(2, '0')}`
        : `${seconds}`;

    return (
        <div className="relative flex items-center justify-center w-16 h-16 flex-shrink-0">
            <svg width={64} height={64} viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={32} cy={32} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={5} />
                <circle
                    cx={32} cy={32} r={radius} fill="none"
                    stroke={color} strokeWidth={5}
                    strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - pct)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s' }}
                />
            </svg>
            <span className={`absolute text-xs font-black tabular-nums ${
                pct <= 0.25 ? 'text-red-600 animate-pulse' :
                pct <= 0.5  ? 'text-orange-500' : 'text-green-600'
            }`}>
                {label}
            </span>
        </div>
    );
}

// ─── Correct-Answer Reveal Panel ──────────────────────────────────────────────
function AnswerRevealPanel({
    question, isTimeout, onContinue, isEnglish
}: {
    question: any; isTimeout: boolean; onContinue: () => void; isEnglish: boolean;
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15,15,30,0.85)', backdropFilter: 'blur(8px)' }}
            dir={isEnglish ? 'ltr' : 'rtl'}
        >
            <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300">

                {/* Header bar */}
                <div className={`px-6 py-4 flex items-center gap-3 ${
                    isTimeout ? 'bg-orange-500' : 'bg-red-500'
                }`}>
                    <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-white font-black text-base leading-tight">
                            {isTimeout
                                ? (isEnglish ? '⏰ Time is up!' : '⏰ انتهى الوقت!')
                                : (isEnglish ? '❌ Wrong Answer' : '❌ إجابة خاطئة')}
                        </p>
                        <p className="text-white/80 text-xs font-bold">
                            {isEnglish ? 'Learning moment' : 'لحظة تعلّم 📚'}
                        </p>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    {/* Question recap */}
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">
                            {isEnglish ? 'Question' : 'السؤال'}
                        </p>
                        <p className="text-gray-800 font-semibold text-sm leading-relaxed">
                            {question?.question}
                        </p>
                        {question?.topic && (
                            <span className="inline-block mt-2 text-[10px] bg-indigo-100 text-indigo-600 font-black px-2 py-0.5 rounded-full">
                                {question.topic}
                            </span>
                        )}
                    </div>

                    {/* Correct answer — prominent */}
                    <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-4 border-2 border-emerald-300">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                            <p className="text-[11px] font-black text-emerald-600 uppercase tracking-wider">
                                {isEnglish ? 'Correct Answer' : 'الإجابة الصحيحة'}
                            </p>
                        </div>
                        <p className="text-emerald-800 font-black text-lg leading-snug">
                            {question?.correct_answer}
                        </p>
                    </div>

                    {/* Explanation (if available) */}
                    {question?.explanation && (
                        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                            <div className="flex items-center gap-2 mb-2">
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

                    {/* Source badge */}
                    {question?.source === 'ai' && (
                        <p className="text-[10px] text-gray-400 text-center font-bold">
                            ✨ {isEnglish ? 'Generated by' : 'بواسطة'} {question.provider}
                        </p>
                    )}

                    {/* Continue button */}
                    <button
                        onClick={onContinue}
                        className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white py-3.5 rounded-2xl font-black text-sm shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <RotateCw className="w-4 h-4" />
                        {isEnglish ? 'Spin Again' : 'ادور تاني 🎡'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Session Stats Bar ────────────────────────────────────────────────────────
function StatsBar({ stats }: { stats: SessionStats }) {
    const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    return (
        <div className="flex items-center gap-2 flex-wrap">
            {/* Accuracy */}
            <div className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-xl px-2.5 py-1 shadow-sm">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs font-black text-gray-700">{pct}%</span>
                <span className="text-[10px] text-gray-400 font-bold">{stats.correct}/{stats.total}</span>
            </div>
            {/* Streak */}
            {stats.streak > 0 && (
                <div className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 shadow-sm border ${
                    stats.streak >= 3
                        ? 'bg-orange-50 border-orange-200'
                        : 'bg-white border-gray-100'
                }`}>
                    <Flame className={`w-3.5 h-3.5 ${stats.streak >= 3 ? 'text-orange-500' : 'text-gray-400'}`} />
                    <span className={`text-xs font-black ${stats.streak >= 3 ? 'text-orange-700' : 'text-gray-600'}`}>
                        {stats.streak}
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold">streak</span>
                </div>
            )}
            {/* Best streak */}
            {stats.bestStreak >= 3 && (
                <div className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 rounded-xl px-2.5 py-1 shadow-sm">
                    <Award className="w-3.5 h-3.5 text-yellow-500" />
                    <span className="text-xs font-black text-yellow-700">{stats.bestStreak}</span>
                </div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SpinAndAnswerGame({ employee, diffProfile, onStart, onComplete }: Props) {
    const [phase, setPhase]               = useState<'wheel' | 'loading' | 'question'>('wheel');
    const [spinning, setSpinning]         = useState(false);
    const [resultSegment, setResultSegment] = useState<typeof WHEEL_SEGMENTS[0] | null>(null);
    const [question, setQuestion]         = useState<any>(null);
    const [pointsWon, setPointsWon]       = useState(0);
    const [totalTime, setTotalTime]       = useState(75);
    const [timeLeft, setTimeLeft]         = useState(75);
    const [loading, setLoading]           = useState(false);
    const [error, setError]               = useState<string | null>(null);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [language, setLanguage]         = useState<'auto' | 'ar' | 'en'>('auto');

    // answer state
    const [selectedAnswer, setSelectedAnswer]   = useState<string | null>(null);
    const [answerLocked, setAnswerLocked]       = useState(false);
    const [isCorrect, setIsCorrect]             = useState<boolean | null>(null);
    const [showReveal, setShowReveal]           = useState(false);
    const [isTimeout, setIsTimeout]             = useState(false);

    // session stats
    const [stats, setStats] = useState<SessionStats>({ total: 0, correct: 0, streak: 0, bestStreak: 0 });

    const canvasRef       = useRef<HTMLCanvasElement>(null);
    const animationRef    = useRef<number>();
    const spinAngle       = useRef(0);
    const spinStartTime   = useRef(0);
    const spinDuration    = 3200;
    const spinTarget      = useRef(0);
    const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Language helpers ──────────────────────────────────────────────────────
    const needsMedicalEnglish = useCallback(() => {
        const s = employee.specialty?.toLowerCase() || '';
        return ['بشر','بشري','طبيب','طب','صيدلة','صيدلي','أسنان','اسنان',
                'معمل','مختبر','أشعة','تخدير','جراحة','قلب','أعصاب'].some(k => s.includes(k));
    }, [employee.specialty]);

    const getEffectiveLanguage = useCallback((): 'ar' | 'en' => {
        if (language === 'ar') return 'ar';
        if (language === 'en') return 'en';
        return needsMedicalEnglish() ? 'en' : 'ar';
    }, [language, needsMedicalEnglish]);

    const getLanguageDisplay = () => {
        if (language === 'ar') return '🇸🇦 عربي';
        if (language === 'en') return '🇬🇧 English';
        return needsMedicalEnglish() ? '🇬🇧 English (تلقائي)' : '🇸🇦 عربي (تلقائي)';
    };

    // ── Sound ─────────────────────────────────────────────────────────────────
    const playSound = useCallback((type: 'spin' | 'win' | 'lose') => {
        if (!soundEnabled) return;
        try {
            const src = type === 'spin' ? '/spin.mp3' : type === 'win' ? '/applause.mp3' : '/fail.mp3';
            const a = new Audio(src);
            a.volume = 0.55;
            a.play().catch(() => {});
        } catch {}
    }, [soundEnabled]);

    // ── Wheel drawing ─────────────────────────────────────────────────────────
    const drawWheel = useCallback((angle: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx    = canvas.getContext('2d');
        if (!ctx)    return;
        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2;
        const R  = Math.min(w, h) / 2 - 12;
        ctx.clearRect(0, 0, w, h);
        const seg = (Math.PI * 2) / WHEEL_SEGMENTS.length;
        WHEEL_SEGMENTS.forEach((s, i) => {
            const a0 = i * seg + angle, a1 = a0 + seg;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, R, a0, a1);
            ctx.fillStyle = SEGMENT_COLORS[i];
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(a0 + seg / 2);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#1e1b4b';
            ctx.font = 'bold 11px Cairo, sans-serif';
            const pts = s.points > 0 ? `${s.points}p` : '?';
            ctx.fillText(`${s.label}  ${pts}`, R * 0.62, 4);
            ctx.restore();
        });
        // Centre cap
        ctx.beginPath();
        ctx.arc(cx, cy, 22, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#6d28d9';
        ctx.lineWidth = 4;
        ctx.stroke();
    }, []);

    useEffect(() => {
        if (phase === 'wheel') drawWheel(spinAngle.current);
    }, [phase, drawWheel]);

    // ── Spin animation ────────────────────────────────────────────────────────
    const animateSpin = useCallback((ts: number) => {
        if (!spinStartTime.current) spinStartTime.current = ts;
        const progress = Math.min(1, (ts - spinStartTime.current) / spinDuration);
        const ease     = 1 - Math.pow(1 - progress, 4);
        spinAngle.current = spinTarget.current * ease;
        drawWheel(spinAngle.current);
        if (progress < 1) {
            animationRef.current = requestAnimationFrame(animateSpin);
        } else {
            setSpinning(false);
            const fixed = spinAngle.current % (Math.PI * 2);
            const segAngle = (Math.PI * 2) / WHEEL_SEGMENTS.length;
            let idx = Math.floor((fixed + Math.PI) / segAngle) % WHEEL_SEGMENTS.length;
            if (idx < 0) idx += WHEEL_SEGMENTS.length;
            const selected = WHEEL_SEGMENTS[idx];
            setResultSegment(selected);
            setTimeout(() => { setPhase('loading'); loadQuestion(selected); }, 600);
        }
    }, [drawWheel]);

    const startSpin = async () => {
        if (spinning || phase !== 'wheel') return;
        setError(null);
        try { await onStart(); } catch { setError('لا توجد محاولات كافية'); return; }
        playSound('spin');
        setSpinning(true);
        const target = (10 + Math.random() * 6) * Math.PI * 2 + Math.random() * Math.PI * 2;
        spinTarget.current  = target;
        spinAngle.current   = 0;
        spinStartTime.current = 0;
        animationRef.current = requestAnimationFrame(animateSpin);
    };

    // ── Load question ─────────────────────────────────────────────────────────
    const loadQuestion = async (segment: typeof WHEEL_SEGMENTS[0]) => {
        setLoading(true);
        try {
            let diff = segment.difficulty;
            if (diff === 'random') {
                const r = Math.random();
                diff = r < 0.33 ? 'easy' : r < 0.66 ? 'medium' : 'hard';
            }
            const lang = getEffectiveLanguage();
            const ctx  = lang === 'en' ? 'Primary Care' : 'الرعاية الأساسية';
            const q    = await fetchQuestionWithAI(employee.specialty, diff, lang, ctx);

            // Set time based on difficulty
            const t = DIFFICULTY_TIME[diff] ?? 75;
            setQuestion(q);
            setPointsWon(segment.points);
            setTotalTime(t);
            setTimeLeft(t);
            setSelectedAnswer(null);
            setAnswerLocked(false);
            setIsCorrect(null);
            setIsTimeout(false);
            setShowReveal(false);
            setPhase('question');
        } catch (err: any) {
            setError(err.message || 'فشل تحميل السؤال');
            toast.error('فشل تحميل السؤال — حاول مرة أخرى');
            setPhase('wheel');
        } finally { setLoading(false); }
    };

    // ── Timer (runs in question phase, stops when answer locked) ─────────────
    useEffect(() => {
        if (phase !== 'question' || answerLocked) return;
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    handleTimeout();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [phase, answerLocked]);

    const handleTimeout = useCallback(() => {
        if (answerLocked) return;
        setAnswerLocked(true);
        setIsTimeout(true);
        playSound('lose');
        onComplete(0, false);
        setStats(prev => ({
            total:      prev.total + 1,
            correct:    prev.correct,
            streak:     0,
            bestStreak: prev.bestStreak,
        }));
        setTimeout(() => setShowReveal(true), 800);
    }, [answerLocked, playSound, onComplete]);

    // ── Answer handler ────────────────────────────────────────────────────────
    const handleAnswer = useCallback((answer: string) => {
        if (answerLocked || phase !== 'question') return;
        if (timerRef.current) clearInterval(timerRef.current);
        setAnswerLocked(true);
        setSelectedAnswer(answer);

        const correct = answer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase();
        setIsCorrect(correct);

        const finalPoints = correct ? applyMultiplier(pointsWon, diffProfile) : 0;
        onComplete(finalPoints, correct);

        setStats(prev => {
            const newStreak    = correct ? prev.streak + 1 : 0;
            const newBest      = Math.max(prev.bestStreak, newStreak);
            return { total: prev.total + 1, correct: prev.correct + (correct ? 1 : 0), streak: newStreak, bestStreak: newBest };
        });

        if (correct) {
            playSound('win');
            confetti({ particleCount: 220, spread: 90, origin: { y: 0.55 }, colors: ['#8b5cf6','#ec4899','#f59e0b','#10b981'] });
            // Short delay then back to wheel
            setTimeout(() => resetToWheel(), 2200);
        } else {
            playSound('lose');
            // Show reveal panel
            setTimeout(() => setShowReveal(true), 900);
        }
    }, [answerLocked, phase, question, pointsWon, diffProfile, onComplete, playSound]);

    // ── Reset ─────────────────────────────────────────────────────────────────
    const resetToWheel = () => {
        setPhase('wheel');
        setResultSegment(null);
        setQuestion(null);
        setTimeLeft(75);
        setTotalTime(75);
        setPointsWon(0);
        setError(null);
        setSelectedAnswer(null);
        setAnswerLocked(false);
        setIsCorrect(null);
        setShowReveal(false);
        setIsTimeout(false);
    };

    useEffect(() => () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        if (timerRef.current)     clearInterval(timerRef.current);
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // WHEEL PHASE
    // ─────────────────────────────────────────────────────────────────────────
    if (phase === 'wheel') return (
        <div className="text-center py-4 animate-in fade-in duration-300" dir="rtl">
            <div className="bg-white rounded-3xl shadow-xl p-6 max-w-lg mx-auto">

                {/* Top bar: session stats + controls */}
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <StatsBar stats={stats} />
                    <div className="flex gap-2 items-center">
                        <button onClick={() => setSoundEnabled(v => !v)}
                            className="p-2 rounded-xl hover:bg-gray-100 transition">
                            {soundEnabled
                                ? <Volume2 className="w-5 h-5 text-gray-500" />
                                : <VolumeX  className="w-5 h-5 text-gray-400" />}
                        </button>
                        <button
                            onClick={() => {
                                const opts: ('auto'|'ar'|'en')[] = ['auto','ar','en'];
                                const next = opts[(opts.indexOf(language) + 1) % 3];
                                setLanguage(next);
                                toast.success(`اللغة: ${next === 'auto' ? 'تلقائي' : next === 'ar' ? 'عربي' : 'English'}`, { icon: '🌐' });
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-black hover:bg-indigo-100 transition border border-indigo-100">
                            <Globe className="w-3 h-3" />{getLanguageDisplay()}
                        </button>
                    </div>
                </div>

                {/* Multiplier pill */}
                <div className="flex justify-center mb-4">
                    <div className="bg-gradient-to-r from-violet-100 to-fuchsia-100 rounded-2xl px-5 py-2 inline-flex items-center gap-2 border border-violet-200">
                        <Sparkles className="w-4 h-4 text-violet-600" />
                        <span className="text-xs font-black text-violet-700">مضاعف {diffProfile.emoji}</span>
                        <span className="text-xl font-black text-violet-900">×{diffProfile.multiplier.toFixed(1)}</span>
                    </div>
                </div>

                {/* Wheel canvas */}
                <div className="relative flex justify-center mb-6">
                    <canvas ref={canvasRef} width={400} height={400}
                        className="w-full max-w-[300px] md:max-w-[380px] h-auto rounded-full shadow-2xl" />
                    {/* Arrow pointer */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1"
                        style={{ width: 0, height: 0,
                            borderLeft: '14px solid transparent', borderRight: '14px solid transparent',
                            borderTop: '28px solid #7c3aed', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
                </div>

                {/* Spin button */}
                <button onClick={startSpin} disabled={spinning}
                    className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white py-4 rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-base">
                    {spinning
                        ? <><Loader2 className="w-5 h-5 animate-spin" />جاري اللف...</>
                        : <><RotateCw className="w-5 h-5" />لف العجلة 🎡</>}
                </button>

                {error && (
                    <div className="mt-4 text-red-500 text-sm flex items-center justify-center gap-1 bg-red-50 rounded-xl p-2">
                        <AlertCircle className="w-4 h-4" /> {error}
                    </div>
                )}

                {/* Difficulty timing legend */}
                <div className="mt-4 grid grid-cols-4 gap-1.5 text-center">
                    {[
                        { label: 'سهل',      time: '45ث',   color: 'bg-green-100 text-green-700'  },
                        { label: 'وسط',      time: '1:15',  color: 'bg-blue-100 text-blue-700'    },
                        { label: 'صعب',      time: '2:00',  color: 'bg-amber-100 text-amber-700'  },
                        { label: 'صعب جداً', time: '3:00',  color: 'bg-red-100 text-red-700'      },
                    ].map(d => (
                        <div key={d.label} className={`rounded-xl py-1.5 px-1 ${d.color}`}>
                            <p className="text-[10px] font-black">{d.label}</p>
                            <p className="text-[10px] font-bold opacity-80">{d.time}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // LOADING PHASE
    // ─────────────────────────────────────────────────────────────────────────
    if (phase === 'loading') return (
        <div className="text-center py-16 animate-in fade-in duration-300">
            <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-violet-100 flex items-center justify-center mb-5 animate-pulse">
                    <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
                </div>
                {resultSegment && (
                    <div className="bg-white rounded-2xl px-5 py-3 shadow-lg mb-4 inline-flex items-center gap-2 border border-violet-100">
                        <Star className="w-4 h-4 text-amber-400" />
                        <p className="font-black text-gray-800 text-sm">
                            {resultSegment.label}
                            {resultSegment.points > 0 && <span className="text-violet-600"> — {resultSegment.points} نقطة</span>}
                        </p>
                    </div>
                )}
                <p className="text-gray-600 font-bold text-sm">
                    {getEffectiveLanguage() === 'en' ? 'Preparing your question...' : 'جاري تحضير السؤال...'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                    {getEffectiveLanguage() === 'en'
                        ? 'AI is generating a tailored question'
                        : 'الذكاء الاصطناعي يولّد سؤالاً مخصصاً'}
                </p>
            </div>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // QUESTION PHASE
    // ─────────────────────────────────────────────────────────────────────────
    if (phase === 'question' && question) {
        const options    = Array.isArray(question.options) ? question.options : [];
        const finalPts   = applyMultiplier(pointsWon, diffProfile);
        const isEnglish  = question.language === 'en';
        const isRandom   = resultSegment?.difficulty === 'random';
        const displayPts = isRandom ? 0 : finalPts;

        return (
            <>
                <div
                    className="py-4 max-w-2xl mx-auto animate-in slide-in-from-right duration-400"
                    dir={isEnglish ? 'ltr' : 'rtl'}
                >
                    {/* ── Header row ── */}
                    <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                        {/* Timer ring */}
                        <TimerRing seconds={timeLeft} total={totalTime} />

                        {/* Centre meta */}
                        <div className="flex-1 flex flex-wrap gap-2 justify-center">
                            {displayPts > 0 && (
                                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                                    <Star className="w-4 h-4 text-amber-400" />
                                    <span className="text-xs font-black text-amber-700">+{displayPts} نقطة</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 rounded-xl px-3 py-1.5">
                                <Sparkles className="w-4 h-4 text-violet-500" />
                                <span className="text-xs font-black text-violet-700">{resultSegment?.label}</span>
                            </div>
                            {question.source === 'ai' && (
                                <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-xl px-2.5 py-1.5">
                                    <span className="text-[10px] font-bold text-gray-400">{question.provider}</span>
                                </div>
                            )}
                        </div>

                        {/* Session stats */}
                        <StatsBar stats={stats} />
                    </div>

                    {/* ── Question card ── */}
                    <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 p-6 rounded-3xl mb-5 border-2 border-violet-100 shadow-lg relative overflow-hidden">
                        {/* Background decoration */}
                        <div className="absolute top-2 right-3 text-7xl opacity-5 select-none font-black">?</div>
                        <HelpCircle className="w-10 h-10 text-violet-400 mb-3" />
                        <p className={`text-xl font-black text-violet-900 leading-relaxed ${isEnglish ? 'text-left' : 'text-right'}`}>
                            {question.question}
                        </p>
                        {question.topic && (
                            <span className="inline-block mt-3 text-[11px] bg-violet-100 text-violet-600 font-black px-2.5 py-0.5 rounded-full">
                                {question.topic}
                            </span>
                        )}
                    </div>

                    {/* ── Options grid ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {options.map((opt: string, idx: number) => {
                            const isSelected = selectedAnswer === opt;
                            const isCorrectOpt = opt.trim().toLowerCase() === question.correct_answer.trim().toLowerCase();

                            let btnClass = 'bg-white border-2 border-gray-100 text-gray-800 hover:border-violet-400 hover:bg-violet-50 hover:scale-[1.02] shadow-sm hover:shadow-md';

                            if (answerLocked) {
                                if (isCorrectOpt) {
                                    btnClass = 'bg-emerald-50 border-2 border-emerald-400 text-emerald-800 shadow-emerald-100 shadow-md scale-[1.01]';
                                } else if (isSelected && !isCorrect) {
                                    btnClass = 'bg-red-50 border-2 border-red-400 text-red-700 opacity-90';
                                } else {
                                    btnClass = 'bg-white border-2 border-gray-100 text-gray-400 opacity-60';
                                }
                            }

                            return (
                                <button key={idx}
                                    onClick={() => handleAnswer(opt)}
                                    disabled={answerLocked}
                                    className={`relative p-4 rounded-2xl font-bold text-base transition-all active:scale-95 disabled:cursor-default text-right ${btnClass}`}
                                >
                                    {/* Letter badge */}
                                    <span className="absolute top-3 left-3 w-6 h-6 rounded-lg bg-gray-100 text-gray-500 text-[10px] font-black flex items-center justify-center flex-shrink-0">
                                        {String.fromCharCode(65 + idx)}
                                    </span>
                                    <span className="block pr-1 pl-8">{opt}</span>

                                    {/* Tick/cross icon */}
                                    {answerLocked && isCorrectOpt && (
                                        <CheckCircle className="absolute top-3 right-3 w-5 h-5 text-emerald-500" />
                                    )}
                                    {answerLocked && isSelected && !isCorrect && (
                                        <XCircle className="absolute top-3 right-3 w-5 h-5 text-red-500" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Correct answer celebration ── */}
                    {answerLocked && isCorrect && (
                        <div className="mt-5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 text-center animate-in zoom-in-95 fade-in duration-300">
                            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                            <p className="text-emerald-800 font-black text-lg">
                                {isEnglish ? `🎉 Correct! +${displayPts} pts` : `🎉 إجابة صحيحة! +${displayPts} نقطة`}
                            </p>
                            {stats.streak >= 3 && (
                                <p className="text-orange-600 font-black text-sm mt-1">
                                    🔥 {stats.streak} على التوالي!
                                </p>
                            )}
                            <p className="text-emerald-600 text-xs font-bold mt-1 opacity-70">
                                {isEnglish ? 'Spinning again in a moment...' : 'العجلة بتدور تاني دلوقتي...'}
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Answer Reveal Panel (wrong / timeout) ── */}
                {showReveal && (
                    <AnswerRevealPanel
                        question={question}
                        isTimeout={isTimeout}
                        isEnglish={question.language === 'en'}
                        onContinue={resetToWheel}
                    />
                )}
            </>
        );
    }

    return null;
}
