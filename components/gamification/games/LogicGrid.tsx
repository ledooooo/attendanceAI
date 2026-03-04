import React, { useState, useEffect } from 'react';
import { Grid3x3, Timer, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

interface Puzzle {
    title: string;
    grid: (number | null)[][];   // 3×3, null = فراغ قابل للتعديل
    locked: boolean[][];          // true = ثابت، false = قابل للتعديل
    solution: number[][];
    hint: string;
    rule: string;
}

// ── 20+ ألغاز متنوعة ──────────────────────────────────────────────────────────
const PUZZLES: Puzzle[] = [
    {
        title: 'مجموع كل صف = 15',
        rule: 'المجموع السحري: كل صف وعمود وقطر = 15',
        grid: [[2,null,6],[null,5,null],[8,null,4]],
        locked: [[true,false,true],[false,true,false],[true,false,true]],
        solution: [[2,7,6],[9,5,1],[4,3,8]],
        hint: 'هذا هو مربع السحر الشهير! كل صف وعمود = 15'
    },
    {
        title: 'إكمال الشبكة التضاعفية',
        rule: 'كل صف: الرقم الثالث = الأول × الثاني',
        grid: [[2,3,null],[4,null,20],[null,6,18]],
        locked: [[true,true,false],[true,false,true],[false,true,true]],
        solution: [[2,3,6],[4,5,20],[3,6,18]],
        hint: '2×3=? | 4×?=20 | ?×6=18'
    },
    {
        title: 'الأرقام الناقصة 1-9',
        rule: 'استخدم كل رقم من 1 إلى 9 مرة واحدة فقط',
        grid: [[1,null,3],[null,5,null],[7,null,9]],
        locked: [[true,false,true],[false,true,false],[true,false,true]],
        solution: [[1,2,3],[4,5,6],[7,8,9]],
        hint: 'الأرقام المتتالية 1 إلى 9'
    },
    {
        title: 'مجموع الصفوف',
        rule: 'مجموع كل صف يساوي المجموع الموجود في العمود الأخير',
        grid: [[3,5,null],[null,4,7],[6,null,10]],
        locked: [[true,true,false],[false,true,true],[true,false,true]],
        solution: [[3,5,8],[3,4,7],[6,4,10]],
        hint: 'صف1: 3+5=? | صف2: ?+4=7 | صف3: 6+?=10'
    },
    {
        title: 'مربع التضاعف',
        rule: 'كل عنصر = المنتج من الصف والعمود',
        grid: [[1,2,null],[3,null,6],[null,4,8]],
        locked: [[true,true,false],[true,false,true],[false,true,true]],
        solution: [[1,2,2],[3,3,6],[2,4,8]],
        hint: 'مضروب رقم الصف × رقم العمود'
    },
    {
        title: 'الفرق المتسلسل',
        rule: 'في كل صف: الثالث - الثاني = الفرق الثابت',
        grid: [[10,8,null],[15,null,9],[null,16,12]],
        locked: [[true,true,false],[true,false,true],[false,true,true]],
        solution: [[10,8,6],[15,12,9],[20,16,12]],
        hint: 'الفرق = 2 لكل صف'
    },
    {
        title: 'الأعداد الأولية',
        rule: 'الخلايا الفارغة أعداد أولية',
        grid: [[2,null,7],[null,5,null],[11,null,13]],
        locked: [[true,false,true],[false,true,false],[true,false,true]],
        solution: [[2,3,7],[2,5,11],[11,7,13]],
        hint: 'الأعداد الأولية: 2,3,5,7,11,13...'
    },
    {
        title: 'مجموع القطرَين = 15',
        rule: 'القطر الرئيسي والفرعي مجموعهما 15',
        grid: [[null,2,3],[4,null,6],[7,8,null]],
        locked: [[false,true,true],[true,false,true],[true,true,false]],
        solution: [[5,2,3],[4,5,6],[7,8,5]],
        hint: 'القطر الرئيسي: ?+?+? = 15، وكذلك الفرعي'
    },
    {
        title: 'مربع الجمع',
        rule: 'كل عنصر = مجموع رقمه الصفي ورقمه العمودي',
        grid: [[2,3,null],[null,7,8],[6,null,10]],
        locked: [[true,true,false],[false,true,true],[true,false,true]],
        solution: [[2,3,5],[4,7,8],[6,7,10]],
        hint: 'اجمع رقم الصف ورقم العمود'
    },
    {
        title: 'الأعداد المتناظرة',
        rule: 'كل صف تصاعدي والأرقام في المنتصف متناظرة',
        grid: [[1,null,9],[2,5,null],[3,null,7]],
        locked: [[true,false,true],[true,true,false],[true,false,true]],
        solution: [[1,5,9],[2,5,8],[3,5,7]],
        hint: 'العمود الأوسط ثابت! ما الرقم؟'
    },
    {
        title: 'التسلسل الهندسي',
        rule: 'كل صف: كل رقم = السابق × نفس المعامل',
        grid: [[1,2,null],[1,3,null],[1,null,25]],
        locked: [[true,true,false],[true,true,false],[true,false,true]],
        solution: [[1,2,4],[1,3,9],[1,5,25]],
        hint: '×2 في الصف الأول، ×3 في الثاني، ×? في الثالث'
    },
    {
        title: 'مجموع الأقطار = 12',
        rule: 'مجموع كل قطر = 12، ومجموع كل عمود = 12',
        grid: [[null,4,3],[5,null,2],[1,6,null]],
        locked: [[false,true,true],[true,false,true],[true,true,false]],
        solution: [[5,4,3],[5,5,2],[1,6,5]],
        hint: 'القطر الرئيسي: ?+?+? = 12'
    },
];

const TIME_LIMIT = 50;

export default function LogicGrid({ onStart, onComplete }: Props) {
    const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
    const [userGrid, setUserGrid] = useState<(number | null)[][]>([]);
    const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const [answered, setAnswered] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [selectedCell, setSelectedCell] = useState<[number,number] | null>(null);
    const [usedPuzzles, setUsedPuzzles] = useState<number[]>([]);
    const [wrongCells, setWrongCells] = useState<string[]>([]);

    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        const available = PUZZLES.filter((_, i) => !usedPuzzles.includes(i));
        const pool = available.length > 0 ? available : PUZZLES;
        const idx = Math.floor(Math.random() * pool.length);
        const p = pool[idx];
        setUsedPuzzles(prev => [...prev, idx]);
        setPuzzle(p);
        setUserGrid(p.grid.map(row => [...row]));
        setTimeLeft(TIME_LIMIT);
        setAnswered(false);
        setIsCorrect(false);
        setSelectedCell(null);
        setWrongCells([]);
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
        setIsActive(false); setAnswered(true); setIsCorrect(false);
        setTimeout(() => { toast.error('⏰ انتهى الوقت!'); onComplete(0, false); }, 300);
    };

    const handleCellClick = (r: number, c: number) => {
        if (!puzzle || answered || puzzle.locked[r][c]) return;
        setSelectedCell([r, c]);
    };

    const handleNumberInput = (n: number) => {
        if (!selectedCell || !puzzle || answered) return;
        const [r, c] = selectedCell;
        if (puzzle.locked[r][c]) return;
        const next = userGrid.map(row => [...row]);
        next[r][c] = n;
        setUserGrid(next);
        setWrongCells([]);
    };

    const handleClear = () => {
        if (!selectedCell || !puzzle || answered) return;
        const [r, c] = selectedCell;
        if (puzzle.locked[r][c]) return;
        const next = userGrid.map(row => [...row]);
        next[r][c] = null;
        setUserGrid(next);
    };

    const checkAnswer = () => {
        if (!puzzle) return;
        // Check all cells filled
        const allFilled = userGrid.every(row => row.every(v => v !== null));
        if (!allFilled) { toast.error('أكمل جميع الخلايا أولاً!'); return; }

        const wrong: string[] = [];
        userGrid.forEach((row, r) => row.forEach((v, c) => {
            if (v !== puzzle.solution[r][c]) wrong.push(`${r}-${c}`);
        }));

        if (wrong.length === 0) {
            setIsCorrect(true); setAnswered(true); setIsActive(false);
            const pts = Math.max(20, Math.floor(timeLeft * 0.9));
            setTimeout(() => { toast.success(`🧠 عقل رياضي! +${pts} نقطة`); onComplete(pts, true); }, 400);
        } else {
            setWrongCells(wrong);
            toast.error(`${wrong.length} خلية خاطئة — تحقق من الملونة بالأحمر`);
        }
    };

    const resetPuzzle = () => {
        if (!puzzle) return;
        setUserGrid(puzzle.grid.map(row => [...row]));
        setWrongCells([]); setSelectedCell(null);
    };

    // ── IDLE ──
    if (!isActive && !answered) return (
        <div className="text-center py-8 px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
                <Grid3x3 className="w-12 h-12 text-white"/>
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">شبكة المنطق 🧩</h3>
            <p className="text-sm font-bold text-gray-500 mb-4 max-w-sm mx-auto">
                اضغط على الخلية الفارغة ثم اختر الرقم المناسب لإكمال الشبكة!
            </p>
            <button onClick={startGame} disabled={starting}
                className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg">
                {starting ? '⏳ جاري البدء...' : '🧩 ابدأ التحدي'}
            </button>
        </div>
    );

    if (!puzzle) return null;

    return (
        <div className="max-w-lg mx-auto py-4 px-2 animate-in zoom-in-95 space-y-3" dir="rtl">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="font-black text-gray-700 flex items-center gap-2 text-sm">
                        <Grid3x3 className="w-4 h-4 text-violet-500"/> {puzzle.title}
                    </h3>
                    <p className="text-[11px] text-violet-600 font-bold">📏 {puzzle.rule}</p>
                </div>
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-sm ${timeLeft <= 12 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-violet-100 text-violet-700'}`}>
                    <Timer className="w-4 h-4"/> {timeLeft}
                </div>
            </div>

            {/* Hint */}
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-2.5">
                <p className="text-xs font-bold text-violet-700">💡 {puzzle.hint}</p>
            </div>

            {/* Grid */}
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-4 border-2 border-violet-200">
                <div className="grid grid-cols-3 gap-2 max-w-[210px] mx-auto">
                    {userGrid.map((row, r) => row.map((cell, c) => {
                        const isLocked = puzzle.locked[r][c];
                        const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c;
                        const isWrong = wrongCells.includes(`${r}-${c}`);
                        const isSolved = answered && isCorrect;

                        let cls = 'aspect-square rounded-xl flex items-center justify-center font-black text-xl shadow-sm border-2 transition-all select-none ';
                        if (isLocked) cls += 'bg-white text-gray-800 border-violet-200 cursor-default';
                        else if (isWrong) cls += 'bg-red-100 text-red-600 border-red-400 animate-pulse';
                        else if (isSelected) cls += 'bg-violet-600 text-white border-violet-700 scale-110 cursor-pointer';
                        else if (isSolved) cls += 'bg-emerald-100 text-emerald-700 border-emerald-300';
                        else if (cell !== null) cls += 'bg-amber-50 text-amber-700 border-amber-300 cursor-pointer hover:bg-amber-100';
                        else cls += 'bg-gray-50 text-gray-300 border-dashed border-gray-300 cursor-pointer hover:bg-violet-50 hover:border-violet-300';

                        return (
                            <div key={`${r}-${c}`} className={cls}
                                onClick={() => handleCellClick(r, c)}>
                                {cell !== null ? cell : (isSelected ? '✏️' : '?')}
                            </div>
                        );
                    }))}
                </div>
            </div>

            {/* Number pad */}
            {!answered && (
                <div className="grid grid-cols-5 gap-2">
                    {[1,2,3,4,5,6,7,8,9].map(n => (
                        <button key={n} onClick={() => handleNumberInput(n)}
                            disabled={!selectedCell}
                            className={`py-3 rounded-xl font-black text-lg transition-all active:scale-90 ${selectedCell ? 'bg-violet-100 text-violet-800 hover:bg-violet-200 shadow-sm' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}>
                            {n}
                        </button>
                    ))}
                    <button onClick={handleClear} disabled={!selectedCell}
                        className={`py-3 rounded-xl font-black text-sm transition-all active:scale-90 col-span-1 ${selectedCell ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}>
                        ✕
                    </button>
                    {/* Larger numbers if needed */}
                    {[10,11,12,13,14,15].map(n => (
                        <button key={n} onClick={() => handleNumberInput(n)}
                            disabled={!selectedCell}
                            className={`py-2 rounded-xl font-black text-sm transition-all active:scale-90 ${selectedCell ? 'bg-violet-50 text-violet-700 hover:bg-violet-100 shadow-sm border border-violet-200' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}>
                            {n}
                        </button>
                    ))}
                </div>
            )}

            {/* Actions */}
            {!answered ? (
                <div className="flex gap-2">
                    <button onClick={resetPuzzle}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all">
                        <RotateCcw className="w-4 h-4"/> إعادة
                    </button>
                    <button onClick={checkAnswer}
                        className="flex-1 bg-gradient-to-r from-violet-500 to-purple-600 text-white py-2.5 rounded-xl font-black text-sm shadow-lg hover:scale-105 active:scale-95 transition-all">
                        ✅ تحقق من الإجابة
                    </button>
                </div>
            ) : (
                <div className={`rounded-2xl p-4 text-center font-black ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {isCorrect
                        ? <><CheckCircle className="inline w-5 h-5 ml-1"/> رائع! حللت الشبكة! 🎉</>
                        : <><XCircle className="inline w-5 h-5 ml-1"/> انتهى الوقت! الحل موضح بالأخضر</>}
                </div>
            )}
        </div>
    );
}
