import React, { useState, useEffect } from 'react';
import { Grid3x3, Timer, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

interface Puzzle {
    title: string;
    grid: (number | string | null)[][];  // 3×3، null = الفراغ
    missingPos: [number, number];
    options: (number | string)[];
    answer: number | string;
    hint: string;
}

const PUZZLES: Puzzle[] = [
    {
        title: 'اجمع كل صف وعمود',
        grid: [[1,2,3],[4,5,6],[7,8,null]],
        missingPos: [2,2],
        options: [9, 12, 6, 8],
        answer: 9,
        hint: 'الصف الأخير: 7+8+?=24، العمود الأخير: 3+6+?=18',
    },
    {
        title: 'نمط الأعداد في الشبكة',
        grid: [[2,4,8],[3,6,12],[5,10,null]],
        missingPos: [2,2],
        options: [20, 15, 25, 18],
        answer: 20,
        hint: 'كل صف: الرقم الثاني = الأول×2، الثالث = الأول×4',
    },
    {
        title: 'الفرق بين الأعداد',
        grid: [[10,8,6],[15,12,9],[20,16,null]],
        missingPos: [2,2],
        options: [12, 14, 10, 8],
        answer: 12,
        hint: 'الفرق في كل صف: 2 ثم 3. ما الفرق في الصف الثالث؟',
    },
    {
        title: 'مجموع المحيط = 20',
        grid: [[3,5,4],[6,null,2],[1,4,3]],
        missingPos: [1,1],
        options: [2, 4, 6, 8],
        answer: 2,
        hint: 'مجموع الصف الأوسط = مجموع الأعداد الأخرى - ?',
    },
    {
        title: 'التسلسل المضاعف',
        grid: [[1,2,4],[2,4,8],[3,6,null]],
        missingPos: [2,2],
        options: [12, 9, 10, 18],
        answer: 12,
        hint: 'كل عنصر في العمود × 2 = التالي في نفس الصف',
    },
];

const TIME_LIMIT = 35;

export default function LogicGrid({ onStart, onComplete }: Props) {
    const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
    const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
    const [selected, setSelected] = useState<number | string | null>(null);
    const [answered, setAnswered] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);

    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        setPuzzle(PUZZLES[Math.floor(Math.random() * PUZZLES.length)]);
        setTimeLeft(TIME_LIMIT);
        setSelected(null);
        setAnswered(false);
        setIsActive(true);
        setStarting(false);
    };

    useEffect(() => {
        if (!isActive || answered) return;
        if (timeLeft <= 0) { handleAnswer('__timeout__'); return; }
        const t = setInterval(() => setTimeLeft(p => p - 1), 1000);
        return () => clearInterval(t);
    }, [isActive, timeLeft, answered]);

    const handleAnswer = (opt: any) => {
        if (answered) return;
        setAnswered(true);
        setSelected(opt);
        setIsActive(false);
        const isCorrect = String(opt) === String(puzzle?.answer);
        setTimeout(() => {
            if (isCorrect) { toast.success('🧠 عقل خارق! إجابة صحيحة!'); onComplete(30, true); }
            else { toast.error(opt === '__timeout__' ? '⏰ انتهى الوقت!' : '❌ إجابة خاطئة!'); onComplete(0, false); }
        }, 800);
    };

    if (!isActive) return (
        <div className="text-center py-8 px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
                <Grid3x3 className="w-12 h-12 text-white"/>
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">شبكة المنطق 🧩</h3>
            <p className="text-sm font-bold text-gray-500 mb-6 max-w-sm mx-auto">اكتشف نمط الأرقام في الشبكة وأوجد الرقم الناقص!</p>
            <button onClick={startGame} disabled={starting}
                className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg">
                {starting ? '⏳ جاري البدء...' : '🧩 ابدأ التحدي'}
            </button>
        </div>
    );

    return (
        <div className="max-w-lg mx-auto py-4 px-2 animate-in zoom-in-95 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-black text-gray-700 flex items-center gap-2"><Grid3x3 className="w-5 h-5 text-violet-500"/> {puzzle!.title}</h3>
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black ${timeLeft <= 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-violet-100 text-violet-700'}`}>
                    <Timer className="w-4 h-4"/> {timeLeft}
                </div>
            </div>

            {/* Grid */}
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-4 border-2 border-violet-200">
                <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto">
                    {puzzle!.grid.flat().map((cell, i) => {
                        const isBlank = cell === null;
                        return (
                            <div key={i}
                                className={`aspect-square rounded-xl flex items-center justify-center font-black text-xl shadow-sm ${isBlank ? 'bg-amber-400 text-white border-2 border-amber-500 animate-pulse text-2xl' : 'bg-white text-gray-800 border-2 border-violet-200'}`}>
                                {isBlank ? '?' : cell}
                            </div>
                        );
                    })}
                </div>
                <p className="text-xs font-bold text-violet-600 text-center mt-3">💡 {puzzle!.hint}</p>
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 gap-3">
                {puzzle!.options.map((opt, i) => {
                    const isCorrect = String(opt) === String(puzzle!.answer);
                    const isSelected = String(selected) === String(opt);
                    let cls = 'bg-white border-2 border-gray-200 text-gray-800 hover:border-violet-400 hover:bg-violet-50';
                    if (answered) {
                        if (isCorrect) cls = 'bg-emerald-500 border-emerald-500 text-white';
                        else if (isSelected) cls = 'bg-red-500 border-red-500 text-white';
                        else cls = 'bg-gray-100 border-gray-100 text-gray-400 opacity-50';
                    }
                    return (
                        <button key={i} onClick={() => handleAnswer(opt)} disabled={answered}
                            className={`${cls} p-4 rounded-xl font-black text-2xl transition-all active:scale-95 flex items-center justify-center gap-2`}>
                            {opt}
                            {answered && isCorrect && <CheckCircle className="w-5 h-5"/>}
                            {answered && isSelected && !isCorrect && <XCircle className="w-5 h-5"/>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
