import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Dices, HelpCircle, Clock, Star, Sparkles, Loader2, AlertCircle, Volume2, VolumeX, RotateCw, CheckCircle, XCircle, X, Globe } from 'lucide-react';
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

// خيارات العجلة - تم رفع المدد الزمنية (دقيقة كحد أدنى، 3 دقائق كحد أقصى)
const WHEEL_SEGMENTS = [
    { label: 'سهل', points: 5, difficulty: 'easy', time: 60 },      // 1 دقيقة
    { label: 'سهل', points: 10, difficulty: 'easy', time: 60 },
    { label: 'سهل', points: 15, difficulty: 'easy', time: 60 },
    { label: 'وسط', points: 10, difficulty: 'medium', time: 90 },    // 1.5 دقيقة
    { label: 'وسط', points: 15, difficulty: 'medium', time: 90 },
    { label: 'وسط', points: 20, difficulty: 'medium', time: 90 },
    { label: 'صعب', points: 20, difficulty: 'hard', time: 120 },      // 2 دقيقة
    { label: 'صعب', points: 25, difficulty: 'hard', time: 120 },
    { label: 'صعب', points: 30, difficulty: 'hard', time: 120 },
    { label: 'صعب جداً', points: 50, difficulty: 'expert', time: 180 }, // 3 دقائق
    { label: 'سؤال عشوائي', points: 0, difficulty: 'random', time: 90 }, // 1.5 دقيقة
];

const SEGMENT_COLORS = [
    '#fca5a5', '#fcd34d', '#86efac', '#93c5fd', '#c4b5fd', '#f9a8d4',
    '#a5f3fc', '#fdba74', '#bef264', '#d9f99d', '#fed7aa'
];

// دالة جلب السؤال باستخدام generate-beast-question مع دعم اللغة ومجال الرعاية الأساسية
async function fetchQuestionWithAI(
    employeeSpecialty: string, 
    difficulty: string, 
    language?: string,
    contextSpecialty?: string
): Promise<any> {
    let level = 3;
    switch (difficulty) {
        case 'easy': level = 3; break;
        case 'medium': level = 6; break;
        case 'hard': level = 10; break;
        case 'expert': level = 14; break;
        default: level = 6;
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
    const [showAnswerModal, setShowAnswerModal] = useState(false);
    const [language, setLanguage] = useState<'auto' | 'ar' | 'en'>('auto');
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();
    const spinAngle = useRef(0);
    const spinStartTime = useRef(0);
    const spinDuration = 3000;
    const spinTarget = useRef(0);

    // تحديد التخصصات التي تحتاج إنجليزية طبية
    const needsMedicalEnglish = useCallback(() => {
        const specialty = employee.specialty?.toLowerCase() || '';
        const medicalEnglishSpecialties = [
            'بشر', 'بشري', 'طبيب', 'طب',
            'صيدلة', 'صيدلي', 'pharmacy',
            'أسنان', 'اسنان', 'dentistry', 'dental',
            'معمل', 'مختبر', 'laboratory', 'lab',
            'أشعة', 'radiology',
            'تخدير', 'anesthesia',
            'جراحة', 'surgery',
            'قلب', 'cardiology',
            'أعصاب', 'neurology',
        ];
        return medicalEnglishSpecialties.some(s => specialty.includes(s));
    }, [employee.specialty]);

    // الحصول على اللغة الفعلية المستخدمة
    const getEffectiveLanguage = useCallback((): 'ar' | 'en' => {
        if (language === 'ar') return 'ar';
        if (language === 'en') return 'en';
        return needsMedicalEnglish() ? 'en' : 'ar';
    }, [language, needsMedicalEnglish]);

    // تشغيل الصوت
    const playSound = useCallback((type: 'spin' | 'win' | 'lose') => {
        if (!soundEnabled) return;
        try {
            let audio: HTMLAudioElement;
            if (type === 'spin') audio = new Audio('/spin.mp3');
            else if (type === 'win') audio = new Audio('/applause.mp3');
            else if (type === 'lose') audio = new Audio('/fail.mp3');
            else return;
            audio.volume = 0.6;
            audio.play().catch(() => {});
        } catch {}
    }, [soundEnabled]);

    // رسم العجلة
    const drawWheel = useCallback((angle: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 10;
        ctx.clearRect(0, 0, width, height);
        
        const segmentAngle = (Math.PI * 2) / WHEEL_SEGMENTS.length;
        for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
            const start = i * segmentAngle + angle;
            const end = (i + 1) * segmentAngle + angle;
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
            ctx.shadowBlur = 0;
            const text = WHEEL_SEGMENTS[i].label + '\n' + (WHEEL_SEGMENTS[i].points > 0 ? WHEEL_SEGMENTS[i].points + 'p' : '?');
            ctx.fillText(text, radius * 0.65, 5);
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
        const elapsed = timestamp - spinStartTime.current;
        const progress = Math.min(1, elapsed / spinDuration);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentAngle = spinTarget.current * easeOut;
        spinAngle.current = currentAngle;
        drawWheel(spinAngle.current);
        if (progress < 1) {
            animationRef.current = requestAnimationFrame(animateSpin);
        } else {
            setSpinning(false);
            const fixedAngle = spinAngle.current % (Math.PI * 2);
            const segmentAngle = (Math.PI * 2) / WHEEL_SEGMENTS.length;
            let index = Math.floor((fixedAngle + Math.PI) / segmentAngle) % WHEEL_SEGMENTS.length;
            if (index < 0) index += WHEEL_SEGMENTS.length;
            const selected = WHEEL_SEGMENTS[index];
            setResultSegment(selected);
            setTimeout(() => {
                setPhase('loading');
                loadQuestion(selected);
            }, 500);
        }
    };

    const startSpin = async () => {
        if (spinning || phase !== 'wheel') return;
        setError(null);
        try {
            await onStart();
        } catch {
            setError('لا توجد محاولات كافية');
            return;
        }
        playSound('spin');
        setSpinning(true);
        const extraRotations = 8 + Math.random() * 8;
        const randomAngle = Math.random() * Math.PI * 2;
        const targetAngle = (extraRotations * Math.PI * 2) + randomAngle;
        spinTarget.current = targetAngle;
        spinAngle.current = 0;
        spinStartTime.current = 0;
        animationRef.current = requestAnimationFrame(animateSpin);
    };

    const loadQuestion = async (segment: typeof WHEEL_SEGMENTS[0]) => {
        setLoading(true);
        try {
            let difficulty = segment.difficulty;
            if (difficulty === 'random') {
                const rand = Math.random();
                if (rand < 0.33) difficulty = 'easy';
                else if (rand < 0.66) difficulty = 'medium';
                else difficulty = 'hard';
            }
            const effectiveLang = getEffectiveLanguage();
            const primaryCareContext = effectiveLang === 'en' ? 'Primary Care' : 'الرعاية الأساسية';
            const q = await fetchQuestionWithAI(employee.specialty, difficulty, effectiveLang, primaryCareContext);
            setQuestion(q);
            setPointsWon(segment.points);
            setTimeLeft(segment.time);
            setPhase('question');
        } catch (err: any) {
            setError(err.message || 'فشل تحميل السؤال');
            toast.error('فشل تحميل السؤال، حاول مرة أخرى');
            setPhase('wheel');
        } finally {
            setLoading(false);
        }
    };

    // المؤقت
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
        setTimeout(() => {
            setFeedback(null);
            setShowAnswerModal(true);
        }, 1500);
        onComplete(0, false);
    };

    const handleAnswer = async (answer: string) => {
        if (phase !== 'question') return;
        const isCorrect = answer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase();
        const finalPoints = isCorrect ? applyMultiplier(pointsWon, diffProfile) : 0;
        
        if (isCorrect) {
            playSound('win');
            confetti({ particleCount: 200, spread: 80, origin: { y: 0.6 }, colors: ['#8b5cf6', '#ec4899', '#f59e0b'] });
            setFeedback({ message: `✅ إجابة صحيحة! +${finalPoints} نقطة`, isCorrect: true });
        } else {
            playSound('lose');
            setFeedback({ message: '❌ إجابة خاطئة!', isCorrect: false });
        }
        
        setTimeout(() => {
            setFeedback(null);
            setShowAnswerModal(true);
        }, 1800);
        
        onComplete(finalPoints, isCorrect);
    };

    const closeModalAndReset = () => {
        setShowAnswerModal(false);
        resetToWheel();
    };

    const resetToWheel = () => {
        setPhase('wheel');
        setResultSegment(null);
        setQuestion(null);
        setTimeLeft(12);
        setPointsWon(0);
        setError(null);
    };

    useEffect(() => {
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, []);

    useEffect(() => {
        if (phase === 'wheel' && !spinning) {
            drawWheel(spinAngle.current);
        }
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

    const getSpinResultMessage = () => {
        if (!resultSegment) return '';
        const pointsText = resultSegment.points > 0 ? `${resultSegment.points} نقطة` : 'بدون نقاط';
        const isEn = getEffectiveLanguage() === 'en';
        if (isEn) {
            return `🎉 Lucky you! ${resultSegment.label} question worth ${pointsText}`;
        }
        return `🎉 مبروك حظك! سؤال ${resultSegment.label} بـ ${pointsText}`;
    };

    // شاشة العجلة
    if (phase === 'wheel') {
        return (
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
                                    const currentIndex = options.indexOf(language);
                                    const next = options[(currentIndex + 1) % options.length];
                                    setLanguage(next);
                                    toast.success(`اللغة: ${next === 'auto' ? 'تلقائي حسب التخصص' : next === 'ar' ? 'عربي' : 'English Medical'}`, { icon: '🌐' });
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
    }

    // شاشة التحميل
    if (phase === 'loading') {
        return (
            <div className="text-center py-16 animate-in fade-in duration-300">
                <div className="flex flex-col items-center justify-center">
                    <Loader2 className="w-16 h-16 text-violet-500 animate-spin mb-4" />
                    <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-lg mb-4 max-w-xs mx-auto">
                        <p className="text-base font-black text-gray-800">
                            {getSpinResultMessage()}
                        </p>
                    </div>
                    <p className="text-gray-600 font-bold">{getEffectiveLanguage() === 'en' ? 'Preparing your question...' : 'جاري تحضير السؤال...'}</p>
                    <p className="text-xs text-gray-400 mt-2">
                        {getEffectiveLanguage() === 'en' ? 'Using AI to generate a primary care question' : 'نستخدم الذكاء الاصطناعي لتوليد سؤال من الرعاية الأساسية'}
                    </p>
                </div>
            </div>
        );
    }

    // شاشة السؤال
    if (phase === 'question' && question) {
        const options = Array.isArray(question.options) ? question.options : [];
        const finalPoints = applyMultiplier(pointsWon, diffProfile);
        const isRandom = resultSegment?.difficulty === 'random';
        const displayPoints = isRandom ? 0 : finalPoints;
        const isEnglish = question.language === 'en';
        const timeDisplay = timeLeft >= 60 ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : `${timeLeft} ث`;

        return (
            <>
                <div className="text-center py-4 animate-in slide-in-from-right max-w-3xl mx-auto" dir={isEnglish ? 'ltr' : 'rtl'}>
                    {/* رأس المعلومات */}
                    <div className="flex justify-between items-center mb-6 px-4 flex-wrap gap-2">
                        <div className={`bg-gradient-to-r ${timeLeft <= 20 ? 'from-red-500 to-orange-500 animate-pulse' : 'from-red-500 to-orange-500'} text-white px-5 py-2 rounded-xl font-black shadow-lg flex items-center gap-2`}>
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
                                    <Sparkles className="w-3 h-3" /> {isEnglish ? 'Generated by' : 'تم توليده بواسطة'} {question.provider}
                                </p>
                            )}
                            {question.source === 'local' && (
                                <p className="text-xs text-amber-600 flex items-center justify-center gap-1 bg-amber-50 px-3 py-1 rounded-full">
                                    <AlertCircle className="w-3 h-3" /> {isEnglish ? 'From local question bank' : 'من بنك الأسئلة المحلي'}
                                </p>
                            )}
                            <p className="text-xs text-gray-400 flex items-center justify-center gap-1 bg-gray-100 px-3 py-1 rounded-full">
                                <Globe className="w-3 h-3" />
                                {isEnglish ? 'Medical English' : 'العربية'}
                            </p>
                        </div>
                        {/* رسالة التغذية الراجعة */}
                        {feedback && (
                            <div className={`absolute inset-0 flex items-center justify-center rounded-3xl backdrop-blur-sm animate-in fade-in zoom-in duration-200 ${
                                feedback.isCorrect ? 'bg-green-100/90' : 'bg-red-100/90'
                            }`}>
                                <div className="text-center p-4 rounded-2xl bg-white shadow-xl">
                                    {feedback.isCorrect ? (
                                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                                    ) : (
                                        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                                    )}
                                    <p className={`text-xl font-black ${feedback.isCorrect ? 'text-green-700' : 'text-red-700'}`}>{feedback.message}</p>
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
                                className="bg-white border-2 border-gray-200 p-5 rounded-2xl font-bold text-gray-800 hover:border-violet-500 hover:bg-violet-50 hover:scale-105 transition-all active:scale-95 shadow-md hover:shadow-xl text-lg text-right"
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>

                {/* المودال الذي يعرض السؤال والإجابة الصحيحة (بعد الخطأ أو انتهاء الوقت) */}
                {showAnswerModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" dir="rtl">
                        <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-black text-gray-800">
                                    {isEnglish ? 'Correct Answer' : 'الإجابة الصحيحة'}
                                </h3>
                                <button onClick={closeModalAndReset} className="p-1 hover:bg-gray-100 rounded-full transition">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-xl mb-4">
                                <p className="text-sm font-bold text-gray-500 mb-1">
                                    {isEnglish ? 'Question:' : 'السؤال:'}
                                </p>
                                <p className="text-gray-800 font-medium mb-3">{question?.question}</p>
                                <p className="text-sm font-bold text-green-600 mb-1">
                                    {isEnglish ? 'Correct Answer:' : 'الإجابة الصحيحة:'}
                                </p>
                                <p className="text-green-700 font-bold text-lg">{question?.correct_answer}</p>
                                {question?.explanation && (
                                    <>
                                        <p className="text-sm font-bold text-gray-500 mt-3 mb-1">
                                            {isEnglish ? 'Explanation:' : 'التفسير:'}
                                        </p>
                                        <p className="text-gray-600 text-sm">{question.explanation}</p>
                                    </>
                                )}
                            </div>
                            <button
                                onClick={closeModalAndReset}
                                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white py-3 rounded-xl font-black hover:scale-105 transition-all"
                            >
                                {isEnglish ? 'Close' : 'إغلاق'}
                            </button>
                        </div>
                    </div>
                )}
            </>
        );
    }

    return null;
}
