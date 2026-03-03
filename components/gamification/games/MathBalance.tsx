import React, { useState, useEffect } from 'react';
import { Scale, Timer, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

interface Puzzle {
    left: string;     // الجانب الأيسر من الميزان
    right: string;    // الجانب الأيمن (مع ?)
    options: number[];
    answer: number;
    hint: string;
    leftVal: number;
    rightExpr: string;
}

function generateBalancePuzzle(): Puzzle {
    const a = Math.floor(Math.random() * 8) + 2;
    const b = Math.floor(Math.random() * 8) + 2;
    const c = Math.floor(Math.random() * 5) + 1;

    const templates = [
        // a + b = c + ?
        {
            left: `${a} + ${b}`,
            right: `${c} + ?`,
            leftVal: a + b,
            rightExpr: `${c} + ?`,
            answer: a + b - c,
            hint: `الجانبان متساويان: ${a}+${b} = ${c}+?`,
        },
        // a × b = ? + c
        {
            left: `${a} × ${b}`,
            right: `? + ${c}`,
            leftVal: a * b,
            rightExpr: `? + ${c}`,
            answer: a * b - c,
            hint: `${a}×${b} = ?+${c}`,
        },
        // a + b + c = ? + a
        {
            left: `${a} + ${b} + ${c}`,
            right: `? + ${a}`,
            leftVal: a + b + c,
            rightExpr: `? + ${a}`,
            answer: b + c,
            hint: `الميزان متوازن: ${a}+${b}+${c} = ?+${a}`,
        },
    ];

    const t = templates[Math.floor(Math.random() * templates.length)];
    if (t.answer <= 0) return generateBalancePuzzle(); // تجنب سالب

    const opts = new Set<number>([t.answer]);
    while (opts.size < 4) {
        const d = Math.floor(Math.random() * 6) - 3;
        const o = t.answer + d;
        if (o !== t.answer && o > 0) opts.add(o);
    }

    return {
        left: t.left,
        right: t.right,
        leftVal: t.leftVal,
        rightExpr: t.rightExpr,
        answer: t.answer,
        hint: t.hint,
        options: [...opts].sort(() => Math.random() - 0.5),
    };
}

const TIME_LIMIT = 25;

export default function MathBalance({ onStart, onComplete }: Props) {
    const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
    const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
    const [selected, setSelected] = useState<number | null>(null);
    const [answered, setAnswered] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);

    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        setPuzzle(generateBalancePuzzle());
        setTimeLeft(TIME_LIMIT);
        setSelected(null);
        setAnswered(false);
        setIsActive(true);
        setStarting(false);
    };

    useEffect(() => {
        if (!isActive || answered) return;
        if (timeLeft <= 0) { handleAnswer(-9999); return; }
        const t = setInterval(() => setTimeLeft(p => p - 1), 1000);
        return () => clearInterval(t);
    }, [isActive, timeLeft, answered]);

    const handleAnswer = (val: number) => {
        if (answered) return;
        setAnswered(true);
        setSelected(val);
        setIsActive(false);
        const isCorrect = val === puzzle?.answer;
        setTimeout(() => {
            if (isCorrect) { toast.success('⚖️ الميزان متوازن! إجابة صحيحة!'); onComplete(25, true); }
            else { toast.error(val === -9999 ? '⏰ انتهى الوقت!' : '❌ الميزان غير متوازن!'); onComplete(0, false); }
        }, 800);
    };

    if (!isActive) return (
        <div className="text-center py-8 px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
                <Scale className="w-12 h-12 text-white"/>
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">ميزان الأرقام ⚖️</h3>
            <p className="text-sm font-bold text-gray-500 mb-6 max-w-sm mx-auto">اجعل الميزان متوازناً — الجانبان يجب أن يكونا متساويَين!</p>
            <button onClick={startGame} disabled={starting}
                className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg">
                {starting ? '⏳ جاري البدء...' : '⚖️ ابدأ التحدي'}
            </button>
        </div>
    );

    return (
        <div className="max-w-lg mx-auto py-4 px-2 animate-in zoom-in-95 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-black text-gray-700 flex items-center gap-2"><Scale className="w-5 h-5 text-emerald-500"/> وازن الأرقام</h3>
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black ${timeLeft <= 8 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-emerald-100 text-emerald-700'}`}>
                    <Timer className="w-4 h-4"/> {timeLeft}
                </div>
            </div>

            {/* Balance visual */}
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-5 border-2 border-emerald-200">
                <div className="flex items-end justify-center gap-4">
                    {/* Left pan */}
                    <div className="flex flex-col items-center gap-2">
                        <div className="bg-white border-2 border-emerald-300 rounded-xl px-5 py-3 font-black text-xl text-emerald-700 shadow-md min-w-[80px] text-center">
                            {puzzle!.left}
                        </div>
                        <div className="w-1 h-6 bg-emerald-400"></div>
                        <div className="w-16 h-2 bg-emerald-500 rounded-full"></div>
                    </div>

                    {/* Scale beam */}
                    <div className="flex flex-col items-center mb-2">
                        <div className="text-4xl">⚖️</div>
                        <div className="text-xs font-bold text-emerald-600">=</div>
                    </div>

                    {/* Right pan */}
                    <div className="flex flex-col items-center gap-2">
                        <div className="bg-amber-50 border-2 border-amber-400 rounded-xl px-5 py-3 font-black text-xl text-amber-700 shadow-md min-w-[80px] text-center">
                            {puzzle!.right}
                        </div>
                        <div className="w-1 h-6 bg-emerald-400"></div>
                        <div className="w-16 h-2 bg-emerald-500 rounded-full"></div>
                    </div>
                </div>
                <p className="text-xs font-bold text-gray-500 text-center mt-3">💡 {puzzle!.hint}</p>
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 gap-3">
                {puzzle!.options.map((opt, i) => {
                    const isCorrect = opt === puzzle!.answer;
                    const isSelected = selected === opt;
                    let cls = 'bg-white border-2 border-gray-200 text-gray-800 hover:border-emerald-400 hover:bg-emerald-50';
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
