import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Flame, Timer, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

// ── Matchstick segment IDs per digit (7-segment style) ──────────────────────
// Segments: top=0, top-left=1, top-right=2, middle=3, bot-left=4, bot-right=5, bottom=6
const DIGIT_SEGMENTS: Record<number, number[]> = {
    0: [0,1,2,4,5,6],
    1: [2,5],
    2: [0,2,3,4,6],
    3: [0,2,3,5,6],
    4: [1,2,3,5],
    5: [0,1,3,5,6],
    6: [0,1,3,4,5,6],
    7: [0,2,5],
    8: [0,1,2,3,4,5,6],
    9: [0,1,2,3,5,6],
};

const SEG_COUNT = Object.values(DIGIT_SEGMENTS).map(s => s.length);

// ── Puzzle definitions ────────────────────────────────────────────────────────
interface Puzzle {
    id: number;
    equation: string;           // نص وصفي للعرض
    digits: number[];            // الأرقام في المعادلة (بما فيها العمليات: 10=+, 11=-, 12==)
    movesAllowed: number;
    hint: string;
    solutions: number[][];       // كل حل: digits بعد التعديل
    description: string;
}

// نمثل العمليات: 10=+, 11=-, 12==, نعرضها كـ symbols
const OP_SYMBOLS: Record<number, string> = { 10: '+', 11: '-', 12: '=' };

const PUZZLES: Puzzle[] = [
    {
        id: 1, equation: '6 + 4 = 4', digits: [6,10,4,12,4], movesAllowed: 1,
        hint: 'غير العملية من جمع إلى طرح',
        solutions: [[6,11,4,12,2]], description: '6 - 4 = 2'
    },
    {
        id: 2, equation: '5 + 5 = 8', digits: [5,10,5,12,8], movesAllowed: 1,
        hint: 'الناتج خاطئ بعود واحد — 8 يصبح 9 أو 0',
        solutions: [[5,10,5,12,9],[5,10,4,12,9]], description: '5 + 5 = 9 أو 5 + 4 = 9'
    },
    {
        id: 3, equation: '8 - 3 = 6', digits: [8,11,3,12,6], movesAllowed: 1,
        hint: 'الناتج 6 يصبح 5 بإزالة عود',
        solutions: [[8,11,3,12,5]], description: '8 - 3 = 5'
    },
    {
        id: 4, equation: '3 × 3 = 6', digits: [3,10,3,12,6], movesAllowed: 1,
        hint: 'ناتج الضرب 9 لا 6 — غير الناتج',
        solutions: [[3,10,3,12,9]], description: '3 + 3 = 6 ← صحيح أيضاً! أو غير 6 إلى 9'
    },
    {
        id: 5, equation: '9 - 5 = 5', digits: [9,11,5,12,5], movesAllowed: 1,
        hint: 'الناتج يجب أن يكون 4',
        solutions: [[9,11,5,12,4]], description: '9 - 5 = 4'
    },
    {
        id: 6, equation: '1 + 1 = 3', digits: [1,10,1,12,3], movesAllowed: 1,
        hint: '3 يصبح 2 بإزالة عود واحد',
        solutions: [[1,10,1,12,2]], description: '1 + 1 = 2'
    },
    {
        id: 7, equation: '2 + 3 = 8', digits: [2,10,3,12,8], movesAllowed: 2,
        hint: 'حرك عودَين: غير 2 إلى 3 و 8 إلى 6',
        solutions: [[3,10,3,12,6]], description: '3 + 3 = 6'
    },
    {
        id: 8, equation: '6 - 1 = 9', digits: [6,11,1,12,9], movesAllowed: 2,
        hint: 'غير العملية والأرقام بعودَين',
        solutions: [[6,10,1,12,7],[5,11,1,12,4]], description: '6 + 1 = 7'
    },
    {
        id: 9, equation: '4 + 4 = 0', digits: [4,10,4,12,0], movesAllowed: 2,
        hint: '0 يصبح 8 بعودَين إضافيَين',
        solutions: [[4,10,4,12,8]], description: '4 + 4 = 8'
    },
    {
        id: 10, equation: '7 + 7 = 1', digits: [7,10,7,12,1], movesAllowed: 2,
        hint: 'غير 7 إلى 1 والناتج 1 إلى 2',
        solutions: [[1,10,1,12,2]], description: '1 + 1 = 2'
    },
    {
        id: 11, equation: '5 - 6 = 1', digits: [5,11,6,12,1], movesAllowed: 2,
        hint: 'جرب تغيير 5 إلى 7 والعملية لجمع',
        solutions: [[7,10,6,12,13],[6,11,5,12,1]], description: 'طرق متعددة'
    },
    {
        id: 12, equation: '8 + 1 = 6', digits: [8,10,1,12,6], movesAllowed: 2,
        hint: '8 يصبح 0 و 6 يصبح 7',
        solutions: [[0,10,7,12,7]], description: '0 + 7 = 7'
    },
];

// ── 7-segment SVG renderer ────────────────────────────────────────────────────
function SevenSeg({ digit, size = 48, highlighted = false, dimmed = false }: {
    digit: number; size?: number; highlighted?: boolean; dimmed?: boolean;
}) {
    const isOp = digit >= 10;
    const symbol = isOp ? OP_SYMBOLS[digit] : null;
    const w = size; const h = size * 1.6;
    const t = size * 0.09; // thickness
    const segs = isOp ? [] : DIGIT_SEGMENTS[digit] || [];

    const activeColor = highlighted ? '#f59e0b' : '#f97316';
    const offColor = '#2a1500';

    const segPaths = [
        // 0: top
        `M${t*1.5},${t} L${w-t*1.5},${t} L${w-t*2},${t*2} L${t*2},${t*2} Z`,
        // 1: top-left
        `M${t},${t*1.5} L${t*2},${t*2.5} L${t*2},${h/2-t} L${t},${h/2} Z`,
        // 2: top-right
        `M${w-t},${t*1.5} L${w-t*2},${t*2.5} L${w-t*2},${h/2-t} L${w-t},${h/2} Z`,
        // 3: middle
        `M${t*2},${h/2-t/2} L${w-t*2},${h/2-t/2} L${w-t*1.5},${h/2} L${w-t*2},${h/2+t/2} L${t*2},${h/2+t/2} L${t*1.5},${h/2} Z`,
        // 4: bot-left
        `M${t},${h/2} L${t*2},${h/2+t} L${t*2},${h-t*2.5} L${t},${h-t*1.5} Z`,
        // 5: bot-right
        `M${w-t},${h/2} L${w-t*2},${h/2+t} L${w-t*2},${h-t*2.5} L${w-t},${h-t*1.5} Z`,
        // 6: bottom
        `M${t*1.5},${h-t} L${w-t*1.5},${h-t} L${w-t*2},${h-t*2} L${t*2},${h-t*2} Z`,
    ];

    if (isOp) {
        return (
            <div style={{ width: w*0.6, height: h, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize: size*0.7, fontWeight:900, color: dimmed ? '#555' : '#fb923c', fontFamily:'monospace' }}>{symbol}</span>
            </div>
        );
    }

    return (
        <svg width={w} height={h} style={{ opacity: dimmed ? 0.35 : 1 }}>
            {segPaths.map((d, i) => (
                <path key={i} d={d}
                    fill={segs.includes(i) ? activeColor : offColor}
                    style={{ transition: 'fill 0.25s ease' }}
                />
            ))}
        </svg>
    );
}

// ── Main Game ─────────────────────────────────────────────────────────────────
const TIME_LIMIT = 60;

export default function MoveTheMatch({ onStart, onComplete }: Props) {
    const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
    const [current, setCurrent] = useState<number[]>([]);  // current digit array
    const [original, setOriginal] = useState<number[]>([]);
    const [movesMade, setMovesMade] = useState(0);
    const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const [answered, setAnswered] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [selectedDigitIdx, setSelectedDigitIdx] = useState<number | null>(null);
    const [usedPuzzles, setUsedPuzzles] = useState<number[]>([]);

    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        const available = PUZZLES.filter(p => !usedPuzzles.includes(p.id));
        const pool = available.length > 0 ? available : PUZZLES;
        const p = pool[Math.floor(Math.random() * pool.length)];
        setUsedPuzzles(prev => [...prev, p.id]);
        setPuzzle(p);
        setCurrent([...p.digits]);
        setOriginal([...p.digits]);
        setMovesMade(0);
        setTimeLeft(TIME_LIMIT);
        setAnswered(false);
        setIsCorrect(false);
        setSelectedDigitIdx(null);
        setIsActive(true);
        setStarting(false);
    };

    useEffect(() => {
        if (!isActive || answered) return;
        if (timeLeft <= 0) { handleTimeout(); return; }
        const t = setInterval(() => setTimeLeft(p => p - 1), 1000);
        return () => clearInterval(t);
    }, [isActive, timeLeft, answered]);

    const handleTimeout = () => {
        setIsActive(false);
        setAnswered(true);
        setIsCorrect(false);
        setTimeout(() => { toast.error('⏰ انتهى الوقت!'); onComplete(0, false); }, 300);
    };

    const cycleDigit = (idx: number, dir: 1 | -1) => {
        if (!puzzle || answered) return;
        const d = current[idx];
        if (d >= 10) return; // don't cycle operators
        if (movesMade >= puzzle.movesAllowed) {
            toast.error(`يُسمح بـ ${puzzle.movesAllowed} حركة فقط!`);
            return;
        }
        const newD = ((d + dir + 10) % 10);
        const next = [...current]; next[idx] = newD;
        setCurrent(next);
        setMovesMade(m => m + 1);
        setSelectedDigitIdx(idx);
        setTimeout(() => setSelectedDigitIdx(null), 400);
    };

    const cycleOperator = (idx: number) => {
        if (!puzzle || answered) return;
        const d = current[idx];
        if (d < 10) return;
        if (movesMade >= puzzle.movesAllowed) {
            toast.error(`يُسمح بـ ${puzzle.movesAllowed} حركة فقط!`);
            return;
        }
        const ops = [10, 11]; // + -
        const nextOp = ops[(ops.indexOf(d) + 1) % ops.length];
        const next = [...current]; next[idx] = nextOp;
        setCurrent(next);
        setMovesMade(m => m + 1);
        setSelectedDigitIdx(idx);
        setTimeout(() => setSelectedDigitIdx(null), 400);
    };

    const reset = () => {
        if (!puzzle) return;
        setCurrent([...original]);
        setMovesMade(0);
        setSelectedDigitIdx(null);
    };

    const checkAnswer = () => {
        if (!puzzle || answered) return;
        // eval the equation
        const nums: number[] = [];
        const ops: number[] = [];
        let eqIdx = -1;
        current.forEach((d, i) => {
            if (d === 12) { eqIdx = i; }
            else if (d === 10 || d === 11) { ops.push(d); }
            else { nums.push(d); }
        });

        // Extract LHS and RHS digits
        const lhsDigits: number[] = [];
        const rhsDigits: number[] = [];
        const lhsOps: number[] = [];
        let passedEq = false;
        current.forEach(d => {
            if (d === 12) { passedEq = true; return; }
            if (!passedEq) {
                if (d === 10 || d === 11) lhsOps.push(d);
                else lhsDigits.push(d);
            } else {
                rhsDigits.push(d);
            }
        });

        // Calculate LHS
        let lhsVal = lhsDigits[0] ?? 0;
        lhsOps.forEach((op, i) => {
            if (op === 10) lhsVal += lhsDigits[i+1] ?? 0;
            if (op === 11) lhsVal -= lhsDigits[i+1] ?? 0;
        });
        const rhsVal = rhsDigits[0] ?? 0;

        const win = lhsVal === rhsVal && rhsVal >= 0;

        // Check against solutions
        const matchesSolution = puzzle.solutions.some(sol =>
            sol.every((v, i) => v === current[i])
        );

        const correct = win; // accept any valid equation
        setAnswered(true);
        setIsCorrect(correct);
        setIsActive(false);

        const pts = correct ? Math.max(15, Math.floor(timeLeft * 0.8)) : 0;
        setTimeout(() => {
            if (correct) { toast.success(`🔥 ممتاز! +${pts} نقطة!`); onComplete(pts, true); }
            else { toast.error('❌ المعادلة غير صحيحة!'); onComplete(0, false); }
        }, 600);
    };

    // ── IDLE screen ──
    if (!isActive && !answered) return (
        <div className="text-center py-8 px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
                <Flame className="w-12 h-12 text-white"/>
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">حرك عود ثقاب! 🔥</h3>
            <p className="text-sm font-bold text-gray-500 mb-2 max-w-sm mx-auto">
                اضغط على الأرقام للتغيير حتى تصحح المعادلة
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-xs text-amber-800 font-bold max-w-xs mx-auto">
                ⬆️ اضغط الرقم للأعلى — ⬇️ للأسفل — اضغط العملية لتغييرها
            </div>
            <button onClick={startGame} disabled={starting}
                className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg">
                {starting ? '⏳ جاري البدء...' : '🔥 ابدأ التحدي'}
            </button>
        </div>
    );

    if (!puzzle) return null;

    const movesLeft = puzzle.movesAllowed - movesMade;

    return (
        <div className="max-w-lg mx-auto py-4 px-2 animate-in zoom-in-95 space-y-4" dir="rtl">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-amber-500"/>
                    <span className="font-black text-gray-700">عود الثقاب</span>
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${movesLeft > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                        {movesLeft} حركة متبقية
                    </span>
                </div>
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black ${timeLeft <= 15 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-amber-100 text-amber-700'}`}>
                    <Timer className="w-4 h-4"/> {timeLeft}
                </div>
            </div>

            {/* Hint */}
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3">
                <p className="text-xs font-bold text-amber-800">💡 {puzzle.hint}</p>
                <p className="text-[11px] text-amber-600 mt-1">اضغط الرقم للأعلى/الأسفل لتغييره | اضغط العملية (+/-) لتبديلها</p>
            </div>

            {/* Equation Display — interactive */}
            <div className="bg-gray-900 rounded-3xl p-6 shadow-2xl border-4 border-amber-900/40">
                <div className="flex items-center justify-center gap-3 flex-wrap">
                    {current.map((d, i) => {
                        const isOp = d >= 10 && d !== 12;
                        const isEq = d === 12;
                        const isHighlighted = selectedDigitIdx === i;
                        const changed = d !== original[i];

                        if (isEq) return (
                            <div key={i} className="flex items-center justify-center px-1">
                                <span style={{ fontSize: 36, fontWeight: 900, color: '#fb923c', fontFamily: 'monospace' }}>=</span>
                            </div>
                        );

                        if (isOp) return (
                            <button key={i}
                                onClick={() => !answered && cycleOperator(i)}
                                disabled={answered}
                                className={`flex items-center justify-center rounded-xl transition-all active:scale-90 ${!answered ? 'hover:bg-amber-900/40 cursor-pointer' : ''} ${changed ? 'ring-2 ring-amber-400' : ''}`}
                                style={{ width: 36, height: 56 }}
                            >
                                <span style={{ fontSize: 30, fontWeight: 900, color: isHighlighted ? '#fbbf24' : '#fb923c', fontFamily: 'monospace' }}>
                                    {d === 10 ? '+' : '-'}
                                </span>
                            </button>
                        );

                        return (
                            <div key={i} className="flex flex-col items-center gap-1">
                                {/* Up arrow */}
                                {!answered && (
                                    <button onClick={() => cycleDigit(i, 1)}
                                        className="w-8 h-6 flex items-center justify-center text-amber-400 hover:text-amber-200 transition-colors text-lg font-black leading-none">
                                        ▲
                                    </button>
                                )}
                                <div className={`rounded-xl transition-all ${changed ? 'ring-2 ring-amber-400 bg-amber-900/20' : ''} ${isHighlighted ? 'scale-110' : ''}`}>
                                    <SevenSeg digit={d} size={40} highlighted={isHighlighted} dimmed={answered && !isCorrect}/>
                                </div>
                                {/* Down arrow */}
                                {!answered && (
                                    <button onClick={() => cycleDigit(i, -1)}
                                        className="w-8 h-6 flex items-center justify-center text-amber-400 hover:text-amber-200 transition-colors text-lg font-black leading-none">
                                        ▼
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Result overlay */}
            {answered && (
                <div className={`rounded-2xl p-4 text-center font-black text-lg ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {isCorrect ? <><CheckCircle className="inline w-6 h-6 ml-2"/>صحيح! 🎉</> : <><XCircle className="inline w-6 h-6 ml-2"/>خطأ! الحل: {puzzle.description}</>}
                </div>
            )}

            {/* Action buttons */}
            {!answered && (
                <div className="flex gap-2">
                    <button onClick={reset}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all">
                        <RotateCcw className="w-4 h-4"/> إعادة
                    </button>
                    <button onClick={checkAnswer}
                        disabled={movesMade === 0}
                        className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white py-2.5 rounded-xl font-black text-sm shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-40">
                        ✅ تحقق من الإجابة
                    </button>
                </div>
            )}
        </div>
    );
}
