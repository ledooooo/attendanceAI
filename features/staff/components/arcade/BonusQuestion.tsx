import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient';
import { BrainCircuit, Timer, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../../types';

interface Props {
    employee: Employee;
    bonusPoints: number;
    onFinish: (earned: number) => void;
}

interface NormalizedQ {
    text: string;
    options: string[];
    correctAnswer: string;
}

const TIME_LIMIT = 15;

async function fetchBonusQuestion(employee: Employee): Promise<NormalizedQ | null> {
    const specialty = employee.specialty || '';

    // جلب من كلا الجدولين بالتوازي
    const [r1, r2] = await Promise.all([
        supabase.from('quiz_questions').select('*').limit(60),
        supabase.from('arcade_quiz_questions').select('*').eq('is_active', true).limit(60),
    ]);

    const pool: any[] = [];

    // quiz_questions — options هي JSON array + correct_answer نص
    if (r1.data) {
        r1.data.forEach(q => {
            if (!q.options || !q.correct_answer) return;
            let opts: string[] = [];
            try {
                opts = Array.isArray(q.options) ? q.options : JSON.parse(q.options);
            } catch { return; }
            if (opts.length < 2) return;
            pool.push({ source: 'quiz', q });
        });
    }

    // arcade_quiz_questions — option_a/b/c/d + correct_index
    if (r2.data) {
        r2.data.forEach(q => {
            const opts = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean);
            if (opts.length < 2 || q.correct_index == null) return;
            pool.push({ source: 'arcade', q });
        });
    }

    if (pool.length === 0) return null;

    // اختر عشوائياً مع تفضيل تخصص الموظف
    const preferred = pool.filter(({ source, q }) =>
        source === 'quiz'
            ? q.specialty?.includes('الكل') || q.specialty?.includes(specialty)
            : !q.specialty || q.specialty.includes('الكل') || q.specialty.includes(specialty)
    );
    const source = preferred.length > 0 ? preferred : pool;
    const { source: src, q } = source[Math.floor(Math.random() * source.length)];

    if (src === 'quiz') {
        let opts: string[] = [];
        try { opts = Array.isArray(q.options) ? q.options : JSON.parse(q.options); } catch { return null; }
        return {
            text: q.question_text || q.question || '',
            options: opts,
            correctAnswer: String(q.correct_answer).trim().toLowerCase(),
        };
    } else {
        const opts = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean);
        return {
            text: q.question || '',
            options: opts,
            correctAnswer: String(opts[q.correct_index] ?? '').trim().toLowerCase(),
        };
    }
}

export default function BonusQuestion({ employee, bonusPoints, onFinish }: Props) {
    const [q, setQ] = useState<NormalizedQ | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
    const [selected, setSelected] = useState<string | null>(null);
    const [answered, setAnswered] = useState(false);

    useEffect(() => {
        fetchBonusQuestion(employee).then(res => { setQ(res); setLoading(false); });
    }, []);

    useEffect(() => {
        if (loading || answered) return;
        if (timeLeft <= 0) { handleAnswer('__timeout__'); return; }
        const t = setInterval(() => setTimeLeft(p => p - 1), 1000);
        return () => clearInterval(t);
    }, [timeLeft, loading, answered]);

    const handleAnswer = (opt: string) => {
        if (answered) return;
        setAnswered(true);
        setSelected(opt);
        const isCorrect = q ? opt.trim().toLowerCase() === q.correctAnswer : false;
        setTimeout(() => {
            if (isCorrect) {
                toast.success(`🎉 إجابة صحيحة! +${bonusPoints} نقطة مكافأة`);
                onFinish(bonusPoints);
            } else {
                toast.error(opt === '__timeout__' ? '⏰ انتهى الوقت!' : '❌ إجابة خاطئة!');
                onFinish(0);
            }
        }, 1200);
    };

    if (loading) return (
        <div className="text-center py-10">
            <BrainCircuit className="w-12 h-12 text-indigo-400 animate-pulse mx-auto mb-3"/>
            <p className="font-black text-gray-600">جاري تحميل سؤال المكافأة...</p>
        </div>
    );

    if (!q) {
        setTimeout(() => onFinish(0), 500);
        return null;
    }

    return (
        <div className="animate-in zoom-in-95 space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-400 to-yellow-500 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="w-6 h-6 text-white"/>
                    <div>
                        <p className="text-white font-black text-sm">سؤال المكافأة 🎁</p>
                        <p className="text-yellow-100 text-xs font-bold">أجب صح واكسب +{bonusPoints} نقطة!</p>
                    </div>
                </div>
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-lg ${timeLeft <= 5 ? 'bg-red-500 text-white animate-pulse' : 'bg-white/30 text-white'}`}>
                    <Timer className="w-4 h-4"/> {timeLeft}
                </div>
            </div>

            {/* Question */}
            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-5">
                <p className="font-black text-gray-800 text-base leading-relaxed">{q.text}</p>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 gap-2">
                {q.options.map((opt, i) => {
                    const isCorrect = opt.trim().toLowerCase() === q.correctAnswer;
                    const isSelected = selected === opt;
                    let cls = 'bg-white border-2 border-gray-200 text-gray-700 hover:border-indigo-400 hover:bg-indigo-50';
                    if (answered) {
                        if (isCorrect) cls = 'bg-emerald-500 border-emerald-500 text-white';
                        else if (isSelected) cls = 'bg-red-500 border-red-500 text-white';
                        else cls = 'bg-gray-100 border-gray-200 text-gray-400 opacity-50';
                    }
                    return (
                        <button
                            key={i}
                            onClick={() => handleAnswer(opt)}
                            disabled={answered}
                            className={`${cls} p-3 rounded-xl font-bold text-sm transition-all active:scale-95 text-right flex items-center justify-between`}
                        >
                            <span>{opt}</span>
                            {answered && isCorrect && <CheckCircle className="w-5 h-5 shrink-0"/>}
                            {answered && isSelected && !isCorrect && <XCircle className="w-5 h-5 shrink-0"/>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
