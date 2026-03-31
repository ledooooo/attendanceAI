import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Dices, HelpCircle, Clock, Star, Sparkles, CheckCircle, XCircle, BrainCircuit } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { Employee } from '../../../types';
import { DiffProfile } from '../../../features/staff/components/arcade/types';

interface Props {
    employee: Employee;
    diffProfile: DiffProfile;
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

// 🎯 إعدادات العجلة (9 خيارات كما طلبت)
const WHEEL_OPTIONS = [
    { id: 0, label: 'سؤال سهل', points: 5, difficulty: 'سهل', color: '#10B981' },
    { id: 1, label: 'سؤال سهل', points: 10, difficulty: 'سهل', color: '#34D399' },
    { id: 2, label: 'سؤال سهل', points: 15, difficulty: 'سهل', color: '#059669' },
    { id: 3, label: 'سؤال متوسط', points: 20, difficulty: 'متوسط', color: '#3B82F6' },
    { id: 4, label: 'سؤال متوسط', points: 25, difficulty: 'متوسط', color: '#60A5FA' },
    { id: 5, label: 'سؤال متوسط', points: 30, difficulty: 'متوسط', color: '#2563EB' },
    { id: 6, label: 'سؤال صعب', points: 25, difficulty: 'صعب', color: '#EF4444' },
    { id: 7, label: 'سؤال صعب', points: 40, difficulty: 'صعب', color: '#F87171' },
    { id: 8, label: 'سؤال صعب', points: 50, difficulty: 'صعب', color: '#DC2626' },
];

export default function SpinAndAnswerGame({ employee, diffProfile, onStart, onComplete }: Props) {
    const [phase, setPhase] = useState<'spin' | 'loading_question' | 'question' | 'feedback'>('spin');
    const [selectedSlice, setSelectedSlice] = useState<typeof WHEEL_OPTIONS[0] | null>(null);
    const [wheelRotation, setWheelRotation] = useState(0);
    const [spinning, setSpinning] = useState(false);
    
    const [question, setQuestion] = useState<any>(null);
    const [timeLeft, setTimeLeft] = useState(20);
    const [starting, setStarting] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

    // بناء الـ CSS الخاص بألوان العجلة
    const conicGradient = WHEEL_OPTIONS.map((opt, i) => {
        const sliceAngle = 360 / WHEEL_OPTIONS.length;
        return `${opt.color} ${i * sliceAngle}deg ${(i + 1) * sliceAngle}deg`;
    }).join(', ');

    // لغة الأسئلة
    const isMedicalEnglishSpecialty = ['بشر', 'أسنان', 'صيدل', 'اسره'].some(s => 
        (employee.job_title || '').includes(s) || (employee.specialty || '').includes(s)
    );

    const startSpin = async () => {
        if (spinning || starting) return;
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        
        // 1. تحديد الخيار الفائز فوراً
        const winningIndex = Math.floor(Math.random() * WHEEL_OPTIONS.length);
        const result = WHEEL_OPTIONS[winningIndex];
        setSelectedSlice(result);
        
        // 2. حساب الزاوية المطلوبة لتقف العجلة بالضبط عند السهم (بالأعلى 0deg)
        const sliceAngle = 360 / WHEEL_OPTIONS.length;
        const sliceCenter = (winningIndex * sliceAngle) + (sliceAngle / 2);
        // نطلب منها اللف 5 مرات كاملة (1800 درجة) ثم الوقوف عند السهم
        const targetRotation = 360 * 5 + (360 - sliceCenter);
        setWheelRotation(targetRotation);

        // 3. تشغيل تأثيرات اللف
        setSpinning(true);
        try { new Audio('/spin.mp3').play(); } catch(e) {}

        // 4. الحيلة الذكية: جلب سؤال الذكاء الاصطناعي "أثناء" دوران العجلة لكي لا نضيع وقت اللاعب!
        const fetchPromise = supabase.functions.invoke('generate-smart-quiz', {
            body: {
                specialty: employee.job_title || 'طبيب بشرى',
                domain: 'طبي وعلمي',
                difficulty: result.difficulty,
                length: 'قصير',
                language: isMedicalEnglishSpecialty ? 'English (Professional Medical Terminology)' : 'ar',
                include_hint: false,
                game_type: 'mcq',
                question_count: 1
            }
        });

        // ننتظر انتهاء لفة العجلة (3 ثواني)
        await new Promise(resolve => setTimeout(resolve, 3000));
        setSpinning(false);
        
        toast.success(`حصلت على تحدي ${result.difficulty} بـ ${result.points} نقطة! 🎯`);
        setPhase('loading_question');

        // ننتظر سؤال الـ AI إذا كان متأخراً
        const { data, error } = await fetchPromise;

        if (error || !data || data.length === 0) {
            toast.error('تعذر جلب السؤال من السيرفر.');
            onComplete(0, false);
            return;
        }

        const q = data[0];
        const charToIndex: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
        
        setQuestion({
            question_text: q.question_text,
            options: [q.option_a, q.option_b, q.option_c, q.option_d],
            correct_index: charToIndex[q.correct_option?.toUpperCase()] ?? 0,
            explanation: q.explanation
        });

        setPhase('question');
        setTimeLeft(20);
    };

    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (phase === 'question' && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (phase === 'question' && timeLeft === 0) {
            handleAnswer(-1); // انتهى الوقت
        }
        return () => clearInterval(timer);
    }, [phase, timeLeft]);

    const handleAnswer = (idx: number) => {
        if (selectedAnswer !== null || !selectedSlice) return;
        
        setSelectedAnswer(idx);
        const correct = idx === question.correct_index;
        
        if (correct) {
            try { new Audio('/applause.mp3').play(); } catch(e) {}
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            toast.success('إجابة رائعة! 🎉');
        } else {
            try { new Audio('/fail.mp3').play(); } catch(e) {}
            toast.error('إجابة خاطئة أو انتهى الوقت!');
        }
        
        setPhase('feedback');
        
        // إعطاء اللاعب فرصة لقراءة التفسير قبل الإنهاء
        setTimeout(() => {
            onComplete(correct ? selectedSlice.points : 0, correct);
        }, 5000);
    };

    // ─── 1. واجهة العجلة (Spin) ──────────────────────────────
    if (phase === 'spin') {
        return (
            <div className="text-center py-8 animate-in zoom-in-95">
                <h3 className="text-3xl font-black text-gray-800 mb-2 flex items-center justify-center gap-2">
                    <Dices className="w-8 h-8 text-fuchsia-600"/> عجلة التحديات!
                </h3>
                <p className="text-sm font-bold text-gray-500 mb-8">لف العجلة لتحديد مستوى صعوبة السؤال وجائزتك 🎁</p>
                
                {/* 🎯 تصميم العجلة الاحترافي */}
                <div className="relative w-64 h-64 mx-auto mb-10 drop-shadow-2xl">
                    {/* مؤشر الوقوف (السهم) */}
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 text-3xl drop-shadow-md">
                        🔽
                    </div>
                    
                    {/* جسم العجلة */}
                    <div 
                        className="w-full h-full rounded-full border-[8px] border-white shadow-2xl overflow-hidden"
                        style={{
                            background: `conic-gradient(from 0deg, ${conicGradient})`,
                            transform: `rotate(${wheelRotation}deg)`,
                            transition: spinning ? 'transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)' : 'none'
                        }}
                    ></div>

                    {/* مركز العجلة */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-gray-100 z-10">
                        <Star className="text-yellow-400 w-8 h-8 fill-current" />
                    </div>
                </div>

                <button
                    onClick={startSpin}
                    disabled={spinning || starting}
                    className="w-full max-w-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-12 py-4 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 text-lg flex items-center justify-center gap-2 mx-auto"
                >
                    {spinning ? '🎲 العجلة تدور...' : starting ? '⏳ جاري البدء...' : '✨ ابدأ اللف الآن'}
                </button>
            </div>
        );
    }

    // ─── 2. واجهة التحميل (لو تأخر الـ AI) ──────────────────────────────
    if (phase === 'loading_question') {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-indigo-600 animate-pulse text-center">
                <BrainCircuit className="w-16 h-16 mb-4 animate-bounce mx-auto" />
                <p className="font-black text-xl">جاري توليد التحدي بالذكاء الاصطناعي...</p>
                <p className="text-sm font-bold text-gray-500 mt-2">نحضر لك سؤالاً بـ {selectedSlice?.points} نقطة</p>
            </div>
        );
    }

    // ─── 3. واجهة السؤال والإجابة ──────────────────────────────
    return (
        <div className="max-w-2xl mx-auto w-full animate-in slide-in-from-bottom-8 duration-300">
            <div className="flex justify-between items-center mb-6">
                <div className="bg-white px-5 py-3 rounded-2xl font-black shadow-sm flex items-center gap-2 text-indigo-700 border border-indigo-100">
                    <Star className="w-5 h-5"/> الجائزة: {selectedSlice?.points} نقطة
                </div>
                <div className={`px-5 py-3 rounded-2xl font-black shadow-sm flex items-center gap-2 ${timeLeft <= 5 ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-red-500 border border-red-100'}`}>
                    <Clock className="w-5 h-5" /> {timeLeft} ث
                </div>
            </div>

            <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-xl border-t-8 border-indigo-500 mb-6">
                <div className="flex items-start gap-4 mb-6 md:mb-8" dir={isMedicalEnglishSpecialty ? 'ltr' : 'rtl'}>
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-base md:text-lg">
                        <HelpCircle className="w-6 h-6" />
                    </div>
                    <h3 className={`text-lg md:text-2xl font-black text-gray-800 leading-relaxed mt-1 ${isMedicalEnglishSpecialty ? 'text-left' : 'text-right'}`}>
                        {question.question_text}
                    </h3>
                </div>

                <div className="grid grid-cols-1 gap-3" dir={isMedicalEnglishSpecialty ? 'ltr' : 'rtl'}>
                    {question.options.map((option: string, idx: number) => {
                        let btnClass = 'bg-white border-2 border-gray-100 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50';
                        if (phase === 'feedback') {
                            if (idx === question.correct_index) btnClass = 'bg-emerald-500 border-emerald-600 text-white shadow-lg';
                            else if (idx === selectedAnswer) btnClass = 'bg-red-500 border-red-600 text-white shadow-lg';
                            else btnClass = 'bg-gray-50 border-gray-100 text-gray-400 opacity-50';
                        }
                        return (
                            <button
                                key={idx}
                                onClick={() => handleAnswer(idx)}
                                disabled={phase === 'feedback'}
                                className={`${btnClass} p-4 md:p-5 rounded-2xl font-bold text-sm md:text-lg transition-all active:scale-95 flex items-center justify-between ${isMedicalEnglishSpecialty ? 'text-left' : 'text-right'}`}
                            >
                                <span className="flex-1 leading-snug">{option}</span>
                                {phase === 'feedback' && idx === question.correct_index && <CheckCircle className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0 ml-2"/>}
                                {phase === 'feedback' && idx === selectedAnswer && idx !== question.correct_index && <XCircle className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0 ml-2"/>}
                            </button>
                        );
                    })}
                </div>

                {/* 💡 عرض التفسير العلمي بعد الإجابة */}
                {phase === 'feedback' && question.explanation && (
                    <div className="mt-6 p-4 rounded-xl text-sm font-bold animate-in slide-in-from-bottom-4 bg-blue-50 text-blue-800 border border-blue-200">
                        <span className="block mb-1 opacity-70">📚 {isMedicalEnglishSpecialty ? 'Explanation:' : 'المراجعة التعليمية:'}</span>
                        {question.explanation}
                    </div>
                )}
            </div>
        </div>
    );
}
