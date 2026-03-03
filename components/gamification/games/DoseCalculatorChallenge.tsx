import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Calculator, CheckCircle, XCircle, AlertCircle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';
import { DiffProfile, DoseScenario, applyMultiplier, pickDifficultySet } from '../../../features/staff/components/arcade/types';

interface Props {
    employee: Employee;
    diffProfile: DiffProfile;
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

export default function DoseCalculatorChallenge({ employee, diffProfile, onStart, onComplete }: Props) {
    const [currentCase, setCurrentCase] = useState(0);
    const [score, setScore] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [cases, setCases] = useState<DoseScenario[]>([]);

    const { data: allScenarios = [], isLoading: loadingScenarios } = useQuery({
        queryKey: ['arcade_dose_scenarios', employee.specialty],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('arcade_dose_scenarios')
                .select('id, scenario, question, option_a, option_b, option_c, option_d, correct_index, explanation, difficulty, specialty')
                .eq('is_active', true);
            if (error) throw error;
            return ((data || []).filter((s: any) =>
                !s.specialty || s.specialty.includes('الكل') || s.specialty.includes(employee.specialty)
            )) as DoseScenario[];
        },
        staleTime: 600000,
    });

    const startGame = async () => {
        if (allScenarios.length < 3) { toast.error('لا توجد سيناريوهات كافية حالياً'); return; }
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        const diffSet = pickDifficultySet(diffProfile, 3);
        const selected: DoseScenario[] = [];
        for (const diff of diffSet) {
            const pool = allScenarios.filter(s => s.difficulty === diff && !selected.find(x => x.id === s.id));
            const fallback = allScenarios.filter(s => !selected.find(x => x.id === s.id));
            const source = pool.length > 0 ? pool : fallback;
            if (source.length > 0) selected.push(source[Math.floor(Math.random() * source.length)]);
        }
        if (selected.length < 3) {
            const remaining = allScenarios.filter(s => !selected.find(x => x.id === s.id)).sort(() => Math.random() - 0.5);
            selected.push(...remaining.slice(0, 3 - selected.length));
        }
        setCases(selected.sort(() => Math.random() - 0.5));
        setCurrentCase(0);
        setScore(0);
        setSelectedAnswer(null);
        setShowFeedback(false);
        setIsActive(true);
        setStarting(false);
    };

    const handleAnswer = (answerIndex: number) => {
        if (showFeedback) return;
        setSelectedAnswer(answerIndex);
        setShowFeedback(true);
        const isCorrect = answerIndex === cases[currentCase].correct_index;
        if (isCorrect) { setScore(prev => prev + 1); toast.success('إجابة صحيحة! 🎯', { duration: 1500 }); }
        else toast.error('خطأ! راجع الحساب 💔', { duration: 1500 });
        setTimeout(() => {
            if (currentCase < cases.length - 1) {
                setCurrentCase(prev => prev + 1);
                setSelectedAnswer(null);
                setShowFeedback(false);
            } else {
                setIsActive(false);
                const finalScore = score + (isCorrect ? 1 : 0);
                if (finalScore === cases.length) {
                    toast.success('مثالي! جميع الحسابات صحيحة! 🏆');
                    onComplete(applyMultiplier(30, diffProfile), true);
                } else if (finalScore >= 2) {
                    toast.success(`جيد! ${finalScore}/${cases.length} صحيحة 👍`);
                    onComplete(applyMultiplier(10, diffProfile), true);
                } else {
                    toast.error('تحتاج لمزيد من التدريب 💪');
                    onComplete(0, false);
                }
            }
        }, 3000);
    };

    if (!isActive) {
        return (
            <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-br from-rose-500 to-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <Calculator className="w-14 h-14 text-white"/>
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">تحدي حساب الجرعات 💊</h3>
                <p className="text-base font-bold text-gray-600 mb-4 max-w-md mx-auto">3 حالات طبية واقعية. احسب الجرعة الصحيحة واثبت كفاءتك!</p>
                <p className="text-sm font-bold text-rose-600 mb-6 flex items-center justify-center gap-1">
                    <Sparkles className="w-4 h-4"/> مستواك {diffProfile.emoji}: حالات مخصصة ×{diffProfile.multiplier.toFixed(1)} نقاط
                </p>
                {loadingScenarios
                    ? <p className="text-gray-400 font-bold mb-4">⏳ جاري تحميل الحالات...</p>
                    : allScenarios.length < 3
                        ? <p className="text-red-400 font-bold mb-4">⚠️ لا توجد حالات كافية حالياً</p>
                        : null
                }
                <button
                    onClick={startGame}
                    disabled={starting || loadingScenarios || allScenarios.length < 3}
                    className="bg-gradient-to-r from-rose-600 to-red-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg"
                >
                    {loadingScenarios ? '⏳ جاري التحميل...' : starting ? '⏳ جاري البدء...' : '🚀 ابدأ التحدي'}
                </button>
            </div>
        );
    }

    const s = cases[currentCase];
    const opts = [s.option_a, s.option_b, s.option_c, s.option_d];

    return (
        <div className="max-w-3xl mx-auto py-8 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8 px-4">
                <div className="bg-white px-6 py-3 rounded-2xl font-black shadow-lg border-2 border-rose-200">
                    <span className="text-rose-600">الحالة {currentCase + 1}</span><span className="text-gray-400"> / {cases.length}</span>
                </div>
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5"/> {score} صحيحة
                </div>
            </div>
            <div className="w-full bg-gray-200 h-3 rounded-full mb-8 overflow-hidden shadow-inner">
                <div className="h-full bg-gradient-to-r from-rose-500 to-red-600 transition-all duration-300 rounded-full" style={{ width: `${((currentCase + 1) / cases.length) * 100}%` }}></div>
            </div>
            <div className="bg-gradient-to-br from-rose-50 to-red-50 p-8 rounded-3xl mb-6 border-2 border-rose-200 shadow-xl">
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                        <Calculator className="w-8 h-8 text-white"/>
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-bold text-rose-600 mb-2">الحالة الطبية:</h4>
                        <p className="text-xl font-black text-gray-900 leading-relaxed">{s.scenario}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border-2 border-rose-200 shadow-md">
                    <AlertCircle className="w-6 h-6 text-rose-600 mb-2"/>
                    <h4 className="text-lg font-black text-gray-900">{s.question}</h4>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {opts.map((option, idx) => {
                    let btnClass = 'bg-white border-2 border-gray-200 hover:border-rose-400 hover:bg-rose-50 text-gray-800';
                    if (showFeedback) {
                        if (idx === s.correct_index) btnClass = 'bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-600 text-white';
                        else if (idx === selectedAnswer) btnClass = 'bg-gradient-to-br from-red-400 to-red-600 border-red-600 text-white';
                        else btnClass = 'bg-gray-100 border-gray-200 text-gray-400';
                    }
                    return (
                        <button
                            key={idx}
                            onClick={() => handleAnswer(idx)}
                            disabled={showFeedback}
                            className={`${btnClass} p-6 rounded-2xl font-bold text-xl transition-all hover:scale-105 active:scale-95 shadow-md hover:shadow-xl disabled:cursor-not-allowed text-center`}
                        >
                            <div className="flex items-center justify-center gap-3">
                                <span>{option}</span>
                                {showFeedback && idx === s.correct_index && <CheckCircle className="w-7 h-7"/>}
                                {showFeedback && idx === selectedAnswer && idx !== s.correct_index && <XCircle className="w-7 h-7"/>}
                            </div>
                        </button>
                    );
                })}
            </div>
            {showFeedback && (
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-3xl border-2 border-blue-200 shadow-xl animate-in slide-in-from-bottom">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                            <AlertCircle className="w-6 h-6 text-white"/>
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-blue-700 mb-2">التفسير:</h4>
                            <p className="text-lg font-black text-gray-900">{s.explanation}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
