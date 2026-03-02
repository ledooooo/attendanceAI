import React, { useState, useEffect } from 'react';
import { Lightbulb, Send } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    difficulty: string;
    points: number;
    onWin: (points: number, diffLabel: string) => void;
    onLose: () => void;
    onBack: () => void;
}

const RIDDLES = [
    { q: "عضو يضخ الدم لجميع أنحاء الجسم، ولا يتوقف أبدًا.. ما هو؟", a: "القلب" },
    { q: "فيتامين نقصه يسبب الكساح ولين العظام، ونأخذه من الشمس.. ما هو؟", a: "فيتامين د" },
    { q: "مادة تفرز من البنكرياس لضبط السكر في الدم، ما هي؟", a: "الانسولين" },
    { q: "أكبر عضو في جسم الإنسان ويعتبر خط الدفاع الأول.. ما هو؟", a: "الجلد" },
];

export default function MedicalRiddles({ difficulty, points, onWin, onLose, onBack }: Props) {
    const [riddle, setRiddle] = useState<any>(null);
    const [guess, setGuess] = useState('');
    const [timeLeft, setTimeLeft] = useState(25);

    useEffect(() => {
        setRiddle(RIDDLES[Math.floor(Math.random() * RIDDLES.length)]);
    }, []);

    useEffect(() => {
        if (!riddle || timeLeft <= 0) {
            if (timeLeft <= 0) onLose();
            return;
        }
        const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, riddle]);

    const handleSubmit = () => {
        if (guess.trim().toLowerCase().includes(riddle.a.trim().toLowerCase())) {
            onWin(points, difficulty);
        } else {
            toast.error('إجابة خاطئة! فكر مرة أخرى');
            setGuess('');
        }
    };

    if (!riddle) return null;

    return (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border space-y-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-4">
                <h3 className="font-black text-xl text-yellow-600 flex items-center gap-2"><Lightbulb /> فزورة طبية</h3>
                <div className={`font-black text-xl px-4 py-1 rounded-xl ${timeLeft <= 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-700'}`}>{timeLeft}ث</div>
            </div>
            <div className="text-center py-6">
                <p className="text-xl md:text-2xl font-black text-gray-800 leading-relaxed bg-yellow-50 p-6 rounded-2xl mb-6 border border-yellow-100">
                    "{riddle.q}"
                </p>
                <input 
                    type="text" value={guess} onChange={(e) => setGuess(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    className="w-full text-center text-lg font-bold p-4 border-2 border-gray-200 rounded-2xl outline-none focus:border-yellow-500 mb-4"
                    placeholder="اكتب الإجابة هنا..."
                />
                <button onClick={handleSubmit} className="w-full bg-yellow-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-yellow-600 transition-colors flex items-center justify-center gap-2 shadow-md">
                    <Send className="w-5 h-5" /> تحقق من الإجابة
                </button>
            </div>
        </div>
    );
}
