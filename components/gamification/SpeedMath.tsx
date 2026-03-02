import React, { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    difficulty: string;
    points: number;
    onWin: (points: number, diffLabel: string) => void;
    onLose: () => void;
    onBack: () => void;
}

export default function SpeedMath({ difficulty, points, onWin, onLose, onBack }: Props) {
    const [problem, setProblem] = useState({ q: '', a: 0 });
    const [timeLeft, setTimeLeft] = useState(15);

    useEffect(() => {
        // توليد مسألة حسابية طبية سريعة
        const num1 = Math.floor(Math.random() * 5) + 2;
        const num2 = Math.floor(Math.random() * 5) + 2;
        setProblem({ 
            q: `مريض يحتاج ${num1} أمبولات يومياً، كم أمبول يحتاج في ${num2} أيام؟`, 
            a: num1 * num2 
        });
    }, []);

    useEffect(() => {
        if (timeLeft <= 0) {
            onLose();
            return;
        }
        const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    const handleAnswer = (val: number) => {
        if (val === problem.a) {
            onWin(points, difficulty);
        } else {
            onLose(); // الحساب السريع لا يقبل الخطأ!
        }
    };

    // توليد خيارات عشوائية
    const options = [problem.a, problem.a + 2, problem.a - 1, problem.a + 5].sort(() => 0.5 - Math.random());

    return (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border space-y-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-4">
                <h3 className="font-black text-xl text-orange-600 flex items-center gap-2"><Zap /> السرعة والحساب</h3>
                <div className={`font-black text-xl px-4 py-1 rounded-xl ${timeLeft <= 5 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-700'}`}>{timeLeft}ث</div>
            </div>
            <div className="text-center py-6">
                <p className="text-gray-500 font-bold mb-4">احسب بسرعة، لا مجال للخطأ!</p>
                <div className="text-2xl md:text-3xl font-black text-gray-800 mb-8 bg-orange-50 p-6 rounded-2xl border border-orange-100">
                    {problem.q}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {options.map((opt, idx) => (
                        <button 
                            key={idx} 
                            onClick={() => handleAnswer(opt)} 
                            className="bg-white border-2 border-gray-200 text-gray-800 hover:border-orange-500 hover:bg-orange-50 p-4 rounded-2xl font-black text-2xl transition-all active:scale-95"
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
