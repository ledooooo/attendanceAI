import React, { useState, useEffect, useRef } from 'react';
import { Scale, Timer, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

interface Puzzle {
    instruction: string;
    leftFixed: number[];    // أرقام ثابتة في الكفة اليسرى
    rightFixed: number[];   // أرقام ثابتة في الكفة اليمنى
    available: number[];    // الأرقام المتاحة للسحب
    solution: { left: number[]; right: number[] }; // الحل المقبول
    hint: string;
    leftTarget?: number;    // مجموع الهدف للكفة اليسرى
    rightTarget?: number;
}

// نولد ألغازاً ديناميكياً + ثابتة
const STATIC_PUZZLES: Puzzle[] = [
    {
        instruction: 'اجعل الكفتين متساويتين',
        leftFixed: [7, 3], rightFixed: [5], available: [5, 8, 2, 4],
        solution: { left: [7,3], right: [5,5] },
        hint: '7+3=10 → أضف إلى اليمين ما يساوي 10',
    },
    {
        instruction: 'ضع أرقاماً حتى تتوازن الكفتان',
        leftFixed: [6], rightFixed: [2, 3], available: [1, 4, 5, 7],
        solution: { left: [6], right: [2,3,1] },
        hint: '6 = 2+3+? → الناقص هو 1',
    },
    {
        instruction: 'الكفة اليسرى يجب أن تساوي 12',
        leftFixed: [4], rightFixed: [12], available: [8, 6, 3, 5],
        solution: { left: [4,8], right: [12] },
        hint: '4 + ? = 12 → الناقص 8',
    },
    {
        instruction: 'وازن الميزان بإضافة رقمين من المتاح',
        leftFixed: [3, 4, 2], rightFixed: [1], available: [8, 9, 6, 7],
        solution: { left: [3,4,2], right: [1,8] },
        hint: '3+4+2=9 → 1+?=9 → أضف 8',
    },
    {
        instruction: 'أضف للكفة اليمنى حتى تكافئ اليسرى',
        leftFixed: [5, 5, 5], rightFixed: [3], available: [12, 10, 11, 15],
        solution: { left: [5,5,5], right: [3,12] },
        hint: '5+5+5=15 → 3+?=15',
    },
    {
        instruction: 'استخدم رقمين فقط لتوازن 20',
        leftFixed: [20], rightFixed: [], available: [9, 11, 8, 12, 7],
        solution: { left: [20], right: [9,11] },
        hint: '20 = ? + ? من الأرقام المتاحة',
    },
    {
        instruction: 'الكفتان يجب أن تساوي كل منهما 10',
        leftFixed: [6], rightFixed: [3], available: [4, 7, 2, 5],
        solution: { left: [6,4], right: [3,7] },
        hint: '6+?=10 و 3+?=10',
    },
    {
        instruction: 'أضف رقماً واحداً فقط لأي كفة',
        leftFixed: [8, 3], rightFixed: [6, 4], available: [1, 2, 3, 4],
        solution: { left: [8,3], right: [6,4,1] },
        hint: '8+3=11 | 6+4=10 → أضف 1 لليمين',
    },
    {
        instruction: 'وازن الميزان: اليسار = اليمين × 2',
        leftFixed: [10], rightFixed: [3, 2], available: [5, 4, 6, 1],
        solution: { left: [10], right: [3,2,5] },
        hint: 'اليمين يجب أن = 10 → 3+2+?=10',
    },
    {
        instruction: 'الفرق بين الكفتين = صفر',
        leftFixed: [7, 2], rightFixed: [4], available: [5, 3, 8, 6],
        solution: { left: [7,2], right: [4,5] },
        hint: '7+2=9 | 4+?=9 → ?=5',
    },
];

function generateDynamicPuzzle(): Puzzle {
    const a = Math.floor(Math.random() * 8) + 2;
    const b = Math.floor(Math.random() * 8) + 2;
    const target = a + b;
    const c = Math.floor(Math.random() * (target - 2)) + 1;
    const needed = target - c;
    const distractors = [needed + 1, needed - 1, needed + 2, needed * 2]
        .filter(v => v > 0 && v !== needed)
        .slice(0, 3);
    const available = [...distractors, needed].sort(() => Math.random() - 0.5);
    return {
        instruction: 'وازن الكفتين بإضافة رقم للكفة اليمنى',
        leftFixed: [a, b],
        rightFixed: [c],
        available,
        solution: { left: [a,b], right: [c, needed] },
        hint: `${a}+${b}=${target} → ${c}+?=${target}`,
    };
}

const TIME_LIMIT = 40;

export default function MathBalance({ onStart, onComplete }: Props) {
    const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
    const [leftPan, setLeftPan] = useState<number[]>([]);
    const [rightPan, setRightPan] = useState<number[]>([]);
    const [remaining, setRemaining] = useState<number[]>([]);
    const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const [answered, setAnswered] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [tilt, setTilt] = useState(0); // -1 left heavier, 0 balanced, 1 right heavier
    const [usedCount, setUsedCount] = useState(0);
    const [dragItem, setDragItem] = useState<number | null>(null);
    const [dragFrom, setDragFrom] = useState<'left'|'right'|'pool'|null>(null);

    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        const useStatic = usedCount < STATIC_PUZZLES.length;
        const p = useStatic ? STATIC_PUZZLES[usedCount] : generateDynamicPuzzle();
        setUsedCount(c => c + 1);
        setPuzzle(p);
        setLeftPan([...p.leftFixed]);
        setRightPan([...p.rightFixed]);
        setRemaining([...p.available]);
        setTimeLeft(TIME_LIMIT);
        setAnswered(false);
        setIsCorrect(false);
        setTilt(0);
        setIsActive(true);
        setStarting(false);
    };

    useEffect(() => {
        if (!isActive || answered) return;
        if (timeLeft <= 0) { handleTimeout(); return; }
        const t = setInterval(() => setTimeLeft(p => p - 1), 1000);
        return () => clearInterval(t);
    }, [isActive, timeLeft, answered]);

    // Update tilt
    useEffect(() => {
        const lSum = leftPan.reduce((a,b) => a+b, 0);
        const rSum = rightPan.reduce((a,b) => a+b, 0);
        if (lSum === rSum) setTilt(0);
        else if (lSum > rSum) setTilt(-1);
        else setTilt(1);
    }, [leftPan, rightPan]);

    const handleTimeout = () => {
        setIsActive(false); setAnswered(true); setIsCorrect(false);
        setTimeout(() => { toast.error('⏰ انتهى الوقت!'); onComplete(0, false); }, 300);
    };

    const addToPan = (n: number, pan: 'left'|'right') => {
        if (answered) return;
        setRemaining(r => {
            const idx = r.indexOf(n);
            if (idx === -1) return r;
            const next = [...r]; next.splice(idx, 1); return next;
        });
        if (pan === 'left') setLeftPan(p => [...p, n]);
        else setRightPan(p => [...p, n]);
    };

    const removeFromPan = (n: number, pan: 'left'|'right') => {
        if (answered) return;
        const fixed = pan === 'left' ? puzzle!.leftFixed : puzzle!.rightFixed;
        if (fixed.includes(n)) return; // لا تزيل الثوابت
        if (pan === 'left') setLeftPan(p => { const i = p.indexOf(n); const next=[...p]; next.splice(i,1); return next; });
        else setRightPan(p => { const i = p.indexOf(n); const next=[...p]; next.splice(i,1); return next; });
        setRemaining(r => [...r, n].sort((a,b) => a-b));
    };

    const checkAnswer = () => {
        if (!puzzle) return;
        const lSum = leftPan.reduce((a,b)=>a+b,0);
        const rSum = rightPan.reduce((a,b)=>a+b,0);
        const balanced = lSum === rSum;
        const usedAll = remaining.length === 0 || balanced;
        const correct = balanced;

        setAnswered(true); setIsCorrect(correct); setIsActive(false);
        const pts = correct ? Math.max(15, Math.floor(timeLeft * 0.9)) : 0;
        setTimeout(() => {
            if (correct) { toast.success(`⚖️ توازن تام! +${pts} نقطة`); onComplete(pts, true); }
            else { toast.error('❌ الميزان غير متوازن!'); onComplete(0, false); }
        }, 600);
    };

    const reset = () => {
        if (!puzzle) return;
        setLeftPan([...puzzle.leftFixed]);
        setRightPan([...puzzle.rightFixed]);
        setRemaining([...puzzle.available]);
    };

    const lSum = leftPan.reduce((a,b)=>a+b,0);
    const rSum = rightPan.reduce((a,b)=>a+b,0);

    // ── IDLE ──
    if (!isActive && !answered) return (
        <div className="text-center py-8 px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
                <Scale className="w-12 h-12 text-white"/>
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">ميزان الأرقام ⚖️</h3>
            <p className="text-sm font-bold text-gray-500 mb-6 max-w-sm mx-auto">
                اضغط على الأرقام لإضافتها للكفة اليسرى أو اليمنى حتى يتوازن الميزان!
            </p>
            <button onClick={startGame} disabled={starting}
                className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg">
                {starting ? '⏳ جاري البدء...' : '⚖️ ابدأ التحدي'}
            </button>
        </div>
    );

    if (!puzzle) return null;

    const tiltDeg = tilt * 12;

    return (
        <div className="max-w-lg mx-auto py-4 px-2 animate-in zoom-in-95 space-y-3" dir="rtl">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h3 className="font-black text-gray-700 flex items-center gap-2 text-sm">
                    <Scale className="w-4 h-4 text-emerald-500"/> {puzzle.instruction}
                </h3>
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-sm ${timeLeft <= 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-emerald-100 text-emerald-700'}`}>
                    <Timer className="w-4 h-4"/> {timeLeft}
                </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
                <p className="text-xs font-bold text-emerald-700">💡 {puzzle.hint}</p>
            </div>

            {/* Scale visual */}
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-4 border-2 border-emerald-200 relative">
                {/* Balance status */}
                <div className={`text-center mb-2 text-xs font-black ${tilt === 0 ? 'text-emerald-600' : 'text-orange-500'}`}>
                    {tilt === 0 ? '✅ متوازن!' : tilt < 0 ? `⬅️ اليسار أثقل (${lSum} vs ${rSum})` : `➡️ اليمين أثقل (${rSum} vs ${lSum})`}
                </div>

                {/* Beam */}
                <div className="relative flex items-end justify-center" style={{ height: 90 }}>
                    {/* Fulcrum */}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0 h-0"
                        style={{ borderLeft: '12px solid transparent', borderRight: '12px solid transparent', borderBottom: '20px solid #6ee7b7' }}/>
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-3 h-6 bg-emerald-400 rounded-sm"/>

                    {/* Rotating beam */}
                    <div className="absolute w-[88%] h-2 bg-emerald-500 rounded-full top-6 left-1/2 -translate-x-1/2 origin-center shadow-md"
                        style={{ transform: `translateX(-50%) rotate(${tiltDeg}deg)`, transition: 'transform 0.5s ease' }}>

                        {/* Left pan */}
                        <div className="absolute right-0 top-2 flex flex-col items-center"
                            style={{ transform: `rotate(${-tiltDeg}deg)`, transition: 'transform 0.5s ease' }}>
                            <div className="w-1 h-8 bg-emerald-400"/>
                            <div
                                className={`min-w-[80px] min-h-[44px] bg-white border-2 rounded-xl px-2 py-1.5 flex flex-wrap gap-1 items-center justify-center shadow-md cursor-pointer transition-all ${answered ? '' : 'hover:border-emerald-400'} ${tilt < 0 ? 'border-emerald-500' : 'border-gray-200'}`}
                                onClick={() => {/* handled per chip */}}>
                                {leftPan.map((n, i) => {
                                    const isFixed = puzzle.leftFixed.includes(n);
                                    return (
                                        <span key={i}
                                            onClick={(e) => { e.stopPropagation(); removeFromPan(n, 'left'); }}
                                            className={`text-xs font-black px-1.5 py-0.5 rounded-lg cursor-pointer transition-all ${isFixed ? 'bg-gray-100 text-gray-600 cursor-default' : 'bg-emerald-100 text-emerald-700 hover:bg-red-100 hover:text-red-600'}`}>
                                            {n}
                                        </span>
                                    );
                                })}
                                {leftPan.length === 0 && <span className="text-gray-300 text-xs font-bold">فارغ</span>}
                            </div>
                            <p className="text-[10px] font-black text-emerald-600 mt-1">= {lSum}</p>
                        </div>

                        {/* Right pan */}
                        <div className="absolute left-0 top-2 flex flex-col items-center"
                            style={{ transform: `rotate(${-tiltDeg}deg)`, transition: 'transform 0.5s ease' }}>
                            <div className="w-1 h-8 bg-emerald-400"/>
                            <div
                                className={`min-w-[80px] min-h-[44px] bg-white border-2 rounded-xl px-2 py-1.5 flex flex-wrap gap-1 items-center justify-center shadow-md cursor-pointer transition-all ${answered ? '' : 'hover:border-emerald-400'} ${tilt > 0 ? 'border-emerald-500' : 'border-gray-200'}`}>
                                {rightPan.map((n, i) => {
                                    const isFixed = puzzle.rightFixed.includes(n);
                                    return (
                                        <span key={i}
                                            onClick={(e) => { e.stopPropagation(); removeFromPan(n, 'right'); }}
                                            className={`text-xs font-black px-1.5 py-0.5 rounded-lg cursor-pointer transition-all ${isFixed ? 'bg-gray-100 text-gray-600 cursor-default' : 'bg-blue-100 text-blue-700 hover:bg-red-100 hover:text-red-600'}`}>
                                            {n}
                                        </span>
                                    );
                                })}
                                {rightPan.length === 0 && <span className="text-gray-300 text-xs font-bold">فارغ</span>}
                            </div>
                            <p className="text-[10px] font-black text-blue-600 mt-1">= {rSum}</p>
                        </div>
                    </div>
                </div>

                {/* Pan labels */}
                <div className="flex justify-between px-6 mt-2 text-[10px] font-bold text-gray-500">
                    <span>← اضغط رقم للإزالة</span>
                    <span>اضغط رقم للإزالة →</span>
                </div>
            </div>

            {/* Available numbers */}
            {!answered && remaining.length > 0 && (
                <div>
                    <p className="text-xs font-bold text-gray-500 mb-2">أرقام متاحة — اضغط لاختيار الكفة:</p>
                    <div className="flex flex-wrap gap-2">
                        {remaining.map((n, i) => (
                            <div key={i} className="flex gap-1">
                                <button onClick={() => addToPan(n, 'left')}
                                    className="w-10 h-10 bg-emerald-500 text-white rounded-xl font-black text-sm hover:bg-emerald-600 active:scale-90 transition-all shadow-md flex flex-col items-center justify-center leading-none">
                                    <span className="text-[8px]">←</span>
                                    <span>{n}</span>
                                </button>
                                <button onClick={() => addToPan(n, 'right')}
                                    className="w-10 h-10 bg-blue-500 text-white rounded-xl font-black text-sm hover:bg-blue-600 active:scale-90 transition-all shadow-md flex flex-col items-center justify-center leading-none">
                                    <span>{n}</span>
                                    <span className="text-[8px]">→</span>
                                </button>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">الزر الأخضر يضيف لليسار، الأزرق لليمين</p>
                </div>
            )}

            {/* Result */}
            {answered && (
                <div className={`rounded-2xl p-4 text-center font-black ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {isCorrect ? <><CheckCircle className="inline w-5 h-5 ml-1"/> توازن رائع! 🎉</>
                        : <><XCircle className="inline w-5 h-5 ml-1"/> {lSum} ≠ {rSum} — الميزان غير متوازن!</>}
                </div>
            )}

            {/* Actions */}
            {!answered && (
                <div className="flex gap-2">
                    <button onClick={reset}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all">
                        <RotateCcw className="w-4 h-4"/> إعادة
                    </button>
                    <button onClick={checkAnswer}
                        className={`flex-1 py-2.5 rounded-xl font-black text-sm shadow-lg transition-all ${tilt === 0 ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:scale-105 active:scale-95' : 'bg-gray-200 text-gray-500'}`}>
                        {tilt === 0 ? '✅ تأكيد التوازن' : '⚖️ وازن أولاً'}
                    </button>
                </div>
            )}
        </div>
    );
}
