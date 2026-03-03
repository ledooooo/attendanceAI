import React, { useState, useEffect } from 'react';
import { Flame, Timer, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

// كل سؤال: صورة SVG للمعادلة الخاطئة + الإجابة الصحيحة كخيارات
interface Puzzle {
    id: number;
    wrongEq: string;        // عرض المعادلة الخاطئة نصياً
    visual: string;         // وصف بصري للعيدان
    hint: string;
    options: string[];      // الإجابة الصحيحة + خطأ
    correct: string;
}

const PUZZLES: Puzzle[] = [
    {
        id: 1,
        wrongEq: '6 + 4 = 4',
        visual: 'VI + IV = IV',
        hint: 'حرك عوداً واحداً من الجمع ليصبح طرحاً',
        options: ['6 - 4 = 2 ❌', '6 + 4 = 10 ✅', '6 + 1 = 4 ❌', '5 + 4 = 4 ❌'],
        correct: '6 + 4 = 10 ✅',
    },
    {
        id: 2,
        wrongEq: '5 + 5 = 8',
        visual: '5 + 5 = 8',
        hint: 'المجموع خاطئ — حرك عوداً من الرقم 8',
        options: ['5 + 5 = 9 ❌', '5 + 5 = 10 ✅', '5 + 3 = 8 ❌', '5 - 5 = 8 ❌'],
        correct: '5 + 5 = 10 ✅',
    },
    {
        id: 3,
        wrongEq: '8 - 3 = 6',
        visual: '8 - 3 = 6',
        hint: 'الناتج خاطئ — عدّل رقماً بعود واحد',
        options: ['8 - 3 = 5 ✅', '8 - 3 = 4 ❌', '8 + 3 = 6 ❌', '9 - 3 = 6 ✅ أيضاً'],
        correct: '8 - 3 = 5 ✅',
    },
    {
        id: 4,
        wrongEq: '3 × 3 = 6',
        visual: '3 × 3 = 6',
        hint: 'حاصل الضرب خاطئ — حرك عوداً من 6',
        options: ['3 × 3 = 9 ✅', '3 × 2 = 6 ✅ أيضاً', '3 × 3 = 8 ❌', '2 × 3 = 9 ❌'],
        correct: '3 × 3 = 9 ✅',
    },
    {
        id: 5,
        wrongEq: '9 - 5 = 5',
        visual: '9 - 5 = 5',
        hint: 'الناتج يزيد بعود واحد أو انقص من المطروح',
        options: ['9 - 5 = 4 ✅', '9 - 4 = 5 ✅ أيضاً', '9 - 5 = 6 ❌', '8 - 5 = 5 ❌'],
        correct: '9 - 5 = 4 ✅',
    },
    {
        id: 6,
        wrongEq: '1 + 1 = 3',
        visual: '1 + 1 = 3',
        hint: 'الناتج خاطئ — عدّل 3 بعود واحد',
        options: ['1 + 1 = 2 ✅', '1 + 1 = 7 ❌', '1 - 1 = 3 ❌', '1 + 4 = 3 ❌'],
        correct: '1 + 1 = 2 ✅',
    },
];

const TIME_LIMIT = 30;

// رسم مطابق العود بـ SVG بسيط
function EquationVisual({ eq }: { eq: string }) {
    return (
        <div className="bg-amber-950 rounded-2xl p-5 flex items-center justify-center shadow-inner border-2 border-amber-800">
            <div className="flex items-center gap-1">
                {eq.split('').map((ch, i) => {
                    const isOp = ['+', '-', '×', '='].includes(ch);
                    return (
                        <span key={i} className={`font-black text-2xl md:text-4xl select-none ${isOp ? 'text-amber-400 mx-1' : 'text-orange-200'}`}
                            style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                            {ch === ' ' ? '\u00A0' : ch}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}

export default function MoveTheMatch({ onStart, onComplete }: Props) {
    const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
    const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
    const [selected, setSelected] = useState<string | null>(null);
    const [answered, setAnswered] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);

    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        const p = PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
        setPuzzle(p);
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

    const handleAnswer = (opt: string) => {
        if (answered) return;
        setAnswered(true);
        setSelected(opt);
        setIsActive(false);
        const isCorrect = opt === puzzle?.correct;
        setTimeout(() => {
            if (isCorrect) { toast.success('🔥 ممتاز! وجدت الحركة الصحيحة!'); onComplete(25, true); }
            else { toast.error(opt === '__timeout__' ? '⏰ انتهى الوقت!' : '❌ ليست الحركة الصحيحة!'); onComplete(0, false); }
        }, 800);
    };

    if (!isActive) return (
        <div className="text-center py-8 px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
                <Flame className="w-12 h-12 text-white"/>
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">حرك عود ثقاب! 🔥</h3>
            <p className="text-sm font-bold text-gray-500 mb-6 max-w-sm mx-auto">حرك عوداً واحداً فقط لتصحيح المعادلة. فكر قبل أن تختار!</p>
            <button onClick={startGame} disabled={starting}
                className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg">
                {starting ? '⏳ جاري البدء...' : '🔥 ابدأ التحدي'}
            </button>
        </div>
    );

    return (
        <div className="max-w-lg mx-auto py-4 px-2 animate-in zoom-in-95 space-y-4">
            {/* Timer */}
            <div className="flex justify-between items-center">
                <h3 className="font-black text-gray-700 flex items-center gap-2"><Flame className="w-5 h-5 text-amber-500"/> حرك عود ثقاب</h3>
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black ${timeLeft <= 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-amber-100 text-amber-700'}`}>
                    <Timer className="w-4 h-4"/> {timeLeft}
                </div>
            </div>

            {/* Equation */}
            <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 text-center">المعادلة الخاطئة — حرك عوداً واحداً لتصحيحها:</p>
                <EquationVisual eq={puzzle!.wrongEq}/>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm font-bold text-amber-800">
                    💡 {puzzle!.hint}
                </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 gap-2">
                {puzzle!.options.map((opt, i) => {
                    const isCorrect = opt === puzzle!.correct;
                    const isSelected = selected === opt;
                    let cls = 'bg-white border-2 border-gray-200 text-gray-700 hover:border-amber-400 hover:bg-amber-50';
                    if (answered) {
                        if (isCorrect) cls = 'bg-emerald-500 border-emerald-500 text-white';
                        else if (isSelected) cls = 'bg-red-500 border-red-500 text-white';
                        else cls = 'bg-gray-50 border-gray-100 text-gray-400 opacity-50';
                    }
                    return (
                        <button key={i} onClick={() => handleAnswer(opt)} disabled={answered}
                            className={`${cls} p-3 rounded-xl font-bold text-sm transition-all active:scale-95 text-right flex items-center justify-between`}>
                            <span>{opt}</span>
                            {answered && isCorrect && <CheckCircle className="w-5 h-5 shrink-0"/>}
                            {answered && isSelected && !isCorrect && <XCircle className="w-5 h-5 shrink-0"/>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
