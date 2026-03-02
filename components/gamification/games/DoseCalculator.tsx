import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Calculator, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    difficulty: string;
    points: number;
    onWin: (points: number, diffLabel: string) => void;
    onLose: () => void;
    onBack: () => void;
}

export default function DoseCalculator({ difficulty, points, onWin, onLose, onBack }: Props) {
    const [scenario, setScenario] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState(45);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

    useEffect(() => {
        const fetchScenario = async () => {
            const { data } = await supabase.from('arcade_dose_scenarios').select('*').eq('difficulty', difficulty);
            if (data && data.length > 0) {
                setScenario(data[Math.floor(Math.random() * data.length)]);
            } else {
                toast.error('لا توجد سيناريوهات متاحة لهذا المستوى.');
                onBack();
            }
            setLoading(false);
        };
        fetchScenario();
    }, [difficulty]);

    useEffect(() => {
        if (!scenario || selectedAnswer !== null || timeLeft <= 0) {
            if (timeLeft <= 0 && selectedAnswer === null) handleAnswer(-1);
            return;
        }
        const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, scenario, selectedAnswer]);

    const handleAnswer = (index: number) => {
        setSelectedAnswer(index);
        setTimeout(() => {
            if (index === scenario.correct_index) onWin(points, difficulty);
            else onLose();
        }, 3000); // إظهار التفسير لمدة 3 ثواني قبل الانتقال
    };

    if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-teal-500" /></div>;
    if (!scenario) return null;

    return (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border space-y-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-4">
                <h3 className="font-black text-xl text-teal-700 flex items-center gap-2"><Calculator /> حساب الجرعات</h3>
                <div className={`font-black text-xl px-4 py-1 rounded-xl ${timeLeft <= 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-700'}`}>{timeLeft}ث</div>
            </div>
            <div className="bg-slate-800 text-white p-6 rounded-2xl shadow-inner font-mono text-right relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-emerald-500"></div>
                <p className="text-sm text-teal-300 font-bold mb-2 uppercase tracking-widest">Case Scenario:</p>
                <p className="text-lg md:text-xl font-black leading-relaxed">{scenario.scenario}</p>
                <div className="mt-4 pt-4 border-t border-slate-700">
                    <p className="text-yellow-400 font-bold">❓ {scenario.question}</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[scenario.option_a, scenario.option_b, scenario.option_c, scenario.option_d].map((opt, idx) => {
                    if (!opt) return null;
                    const isSelected = selectedAnswer === idx;
                    const isCorrect = scenario.correct_index === idx;
                    let btnClass = 'bg-white border-gray-200 text-gray-700 hover:border-teal-400 hover:bg-teal-50';
                    if (selectedAnswer !== null) {
                        if (isCorrect) btnClass = 'bg-green-500 text-white border-green-600 shadow-lg';
                        else if (isSelected) btnClass = 'bg-red-500 text-white border-red-600 shadow-lg';
                        else btnClass = 'bg-gray-50 border-gray-100 opacity-50';
                    }
                    return (
                        <button key={idx} onClick={() => handleAnswer(idx)} disabled={selectedAnswer !== null} className={`p-4 rounded-2xl border-2 font-black text-lg transition-all active:scale-95 ${btnClass}`}>
                            <div className="flex items-center justify-between">
                                <span>{opt}</span>
                                {selectedAnswer !== null && isCorrect && <CheckCircle className="w-6 h-6"/>}
                                {selectedAnswer !== null && isSelected && !isCorrect && <XCircle className="w-6 h-6"/>}
                            </div>
                        </button>
                    );
                })}
            </div>
            {selectedAnswer !== null && (
                <div className="bg-cyan-50 p-4 rounded-2xl border border-cyan-200 animate-in slide-in-from-bottom">
                    <h4 className="text-sm font-bold text-cyan-800 mb-1 flex items-center gap-1"><AlertCircle size={16}/> التفسير:</h4>
                    <p className="font-black text-gray-800">{scenario.explanation}</p>
                </div>
            )}
        </div>
    );
}
