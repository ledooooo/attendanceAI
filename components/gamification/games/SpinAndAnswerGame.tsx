import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Dices, HelpCircle, Clock, Star, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';
import { DiffProfile, applyMultiplier } from '../../../features/staff/components/arcade/types';

interface Props {
    employee: Employee;
    diffProfile: DiffProfile;
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

export default function SpinAndAnswerGame({ employee, diffProfile, onStart, onComplete }: Props) {
    const [phase, setPhase] = useState<'spin' | 'question'>('spin');
    const [pointsWon, setPointsWon] = useState(0);
    const [spinning, setSpinning] = useState(false);
    const [question, setQuestion] = useState<any>(null);
    const [timeLeft, setTimeLeft] = useState(15);
    const [starting, setStarting] = useState(false);

    const { data: questions } = useQuery({
        queryKey: ['arcade_question', employee.specialty],
        queryFn: async () => {
            const { data } = await supabase.from('quiz_questions').select('*');
            if (!data) return [];
            return data.filter((q: any) =>
                q.specialty?.includes('الكل') || q.specialty?.includes(employee.specialty)
            );
        }
    });

    const startSpin = async () => {
        if (spinning || starting) return;
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        setSpinning(true);
        const options = [5, 10, 15, 20, 25, 30];
        const rawResult = options[Math.floor(Math.random() * options.length)];
        setTimeout(() => {
            const finalResult = applyMultiplier(rawResult, diffProfile);
            setPointsWon(finalResult);
            setSpinning(false);
            if (questions && questions.length > 0) {
                setQuestion(questions[Math.floor(Math.random() * questions.length)]);
                setPhase('question');
            } else {
                toast.success('ربحت مباشرة!');
                onComplete(finalResult, true);
            }
        }, 3000);
    };

    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (phase === 'question' && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (phase === 'question' && timeLeft === 0) {
            onComplete(0, false);
        }
        return () => clearInterval(timer);
    }, [phase, timeLeft, onComplete]);

    const handleAnswer = (opt: string) => {
        if (opt.trim() === question.correct_answer.trim()) onComplete(pointsWon, true);
        else onComplete(0, false);
    };

    if (phase === 'spin') {
        return (
            <div className="text-center py-12 animate-in zoom-in-95">
                <h3 className="text-3xl font-black text-gray-800 mb-3 flex items-center justify-center gap-2">
                    <Dices className="w-8 h-8 text-fuchsia-600"/> لف العجلة!
                </h3>
                <p className="text-base font-bold text-gray-500 mb-2">سيتم خصم المحاولة بمجرد بدء اللف</p>
                <p className="text-sm font-bold text-violet-600 mb-8 flex items-center justify-center gap-1">
                    <Sparkles className="w-4 h-4"/> مضاعف {diffProfile.emoji} {diffProfile.label}: ×{diffProfile.multiplier.toFixed(1)}
                </p>
                <div
                    className={`w-64 h-64 mx-auto rounded-full border-[12px] border-violet-200 flex items-center justify-center text-5xl shadow-2xl transition-all duration-[3000ms] ${spinning ? 'rotate-[1440deg] blur-sm scale-105' : ''}`}
                    style={{ background: 'conic-gradient(#fca5a5 0% 20%, #fcd34d 20% 40%, #86efac 40% 60%, #93c5fd 60% 80%, #c4b5fd 80% 100%)' }}
                >
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl z-10 font-black text-violet-700 border-4 border-violet-100">
                        {spinning ? '🎰' : '🎁'}
                    </div>
                </div>
                <button
                    onClick={startSpin}
                    disabled={spinning || starting}
                    className="mt-10 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-12 py-5 rounded-2xl font-black shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 text-lg"
                >
                    {spinning ? '🎲 جاري اللف...' : starting ? '⏳ جاري البدء...' : '✨ اضغط للّف (خصم محاولة)'}
                </button>
            </div>
        );
    }

    let parsedOptions: string[] = [];
    if (question?.options) {
        if (Array.isArray(question.options)) parsedOptions = question.options;
        else { try { parsedOptions = JSON.parse(question.options); } catch { parsedOptions = question.options.split(',').map((s: string) => s.trim()); } }
    }

    return (
        <div className="text-center py-10 animate-in slide-in-from-right max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-8 px-6">
                <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-6 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2">
                    <Clock className="w-5 h-5 animate-pulse"/> {timeLeft} ثانية
                </div>
                <div className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-6 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2">
                    <Star className="w-5 h-5"/> الجائزة: {pointsWon} نقطة
                </div>
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 p-8 rounded-3xl mb-8 border-2 border-violet-200 shadow-xl">
                <HelpCircle className="w-14 h-14 text-violet-500 mx-auto mb-4 animate-bounce"/>
                <h3 className="text-2xl font-black text-violet-900 leading-relaxed">{question.question_text}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {parsedOptions.map((opt: string, i: number) => (
                    <button
                        key={i}
                        onClick={() => handleAnswer(opt)}
                        className="bg-white border-2 border-gray-200 p-5 rounded-2xl font-bold text-gray-800 hover:border-violet-500 hover:bg-violet-50 hover:scale-105 transition-all active:scale-95 shadow-md hover:shadow-xl text-lg"
                    >
                        {opt}
                    </button>
                ))}
            </div>
        </div>
    );
}
