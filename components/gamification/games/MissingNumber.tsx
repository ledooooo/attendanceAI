import React, { useState, useEffect, useMemo } from 'react';
import { Hash, Timer, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

interface Puzzle {
    sequence: (number | null)[];   // null = الفراغ
    answer: number;
    hint: string;
    label: string;
}

function generatePuzzle(): Puzzle {
    const types = ['arithmetic', 'geometric', 'fibonacci', 'squares', 'evens', 'odds'];
    const type = types[Math.floor(Math.random() * types.length)];
    const missingIdx = Math.floor(Math.random() * 3) + 2; // دائماً في المنتصف أو قريباً

    let full: number[] = [];
    let hint = '';
    let label = '';

    switch (type) {
        case 'arithmetic': {
            const start = Math.floor(Math.random() * 10) + 1;
            const step  = Math.floor(Math.random() * 5)  + 2;
            full = Array.from({ length: 6 }, (_, i) => start + i * step);
            hint = `كل رقم يزيد بـ ${step}`;
            label = 'متتالية حسابية';
            break;
        }
        case 'geometric': {
            const start = Math.floor(Math.random() * 3) + 1;
            const ratio = Math.floor(Math.random() * 2) + 2;
            full = Array.from({ length: 5 }, (_, i) => start * Math.pow(ratio, i));
            hint = `كل رقم يُضرب في ${ratio}`;
            label = 'متتالية هندسية';
            break;
        }
        case 'fibonacci': {
            const a = Math.floor(Math.random() * 3) + 1;
            const b = Math.floor(Math.random() * 3) + 1;
            full = [a, b];
            for (let i = 2; i < 7; i++) full.push(full[i-1] + full[i-2]);
            hint = 'كل رقم = مجموع السابقَين';
            label = 'متتالية فيبوناتشي';
            break;
        }
        case 'squares': {
            const offset = Math.floor(Math.random() * 3);
            full = Array.from({ length: 6 }, (_, i) => (i + 1 + offset) ** 2);
            hint = 'مربعات الأعداد الصحيحة';
            label = 'مربعات';
            break;
        }
        case 'evens': {
            const start = (Math.floor(Math.random() * 5) + 1) * 2;
            full = Array.from({ length: 6 }, (_, i) => start + i * 2);
            hint = 'الأعداد الزوجية المتتالية';
            label = 'أعداد زوجية';
            break;
        }
        default: { // odds
            const start = (Math.floor(Math.random() * 5)) * 2 + 1;
            full = Array.from({ length: 6 }, (_, i) => start + i * 2);
            hint = 'الأعداد الفردية المتتالية';
            label = 'أعداد فردية';
        }
    }

    const safeIdx = Math.min(missingIdx, full.length - 1);
    const answer = full[safeIdx];
    const sequence: (number | null)[] = full.map((n, i) => i === safeIdx ? null : n);

    return { sequence, answer, hint, label };
}

function generateOptions(answer: number): number[] {
    const opts = new Set<number>([answer]);
    while (opts.size < 4) {
        const delta = Math.floor(Math.random() * 8) - 4;
        const o = answer + delta;
        if (o !== answer && o > 0) opts.add(o);
    }
    return [...opts].sort(() => Math.random() - 0.5);
}

const TIME_LIMIT = 20;

export default function MissingNumber({ onStart, onComplete }: Props) {
    const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
    const [options, setOptions] = useState<number[]>([]);
    const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
    const [selected, setSelected] = useState<number | null>(null);
    const [answered, setAnswered] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);

    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        const p = generatePuzzle();
        setPuzzle(p);
        setOptions(generateOptions(p.answer));
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
        const pts = isCorrect ? Math.max(10, Math.floor(timeLeft * 1.2)) : 0;
        setTimeout(() => {
            if (isCorrect) { toast.success(`🎯 صحيح! +${pts} نقطة`); onComplete(pts, true); }
            else { toast.error(val === -9999 ? '⏰ انتهى الوقت!' : '❌ إجابة خاطئة!'); onComplete(0, false); }
        }, 800);
    };

    if (!isActive) return (
        <div className="text-center py-8 px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
                <Hash className="w-12 h-12 text-white"/>
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">الرقم الناقص 🔢</h3>
            <p className="text-sm font-bold text-gray-500 mb-6 max-w-sm mx-auto">اكتشف النمط وأكمل المتتالية باختيار الرقم الناقص!</p>
            <button onClick={startGame} disabled={starting}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg">
                {starting ? '⏳ جاري البدء...' : '🔢 ابدأ التحدي'}
            </button>
        </div>
    );

    return (
        <div className="max-w-lg mx-auto py-4 px-2 animate-in zoom-in-95 space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="font-black text-gray-700 flex items-center gap-2"><Hash className="w-5 h-5 text-cyan-500"/> {puzzle!.label}</h3>
                    <p className="text-xs text-gray-400 font-bold">💡 {puzzle!.hint}</p>
                </div>
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black ${timeLeft <= 8 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-cyan-100 text-cyan-700'}`}>
                    <Timer className="w-4 h-4"/> {timeLeft}
                </div>
            </div>

            {/* Sequence */}
            <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-4 border-2 border-cyan-200">
                <p className="text-xs font-bold text-center text-cyan-700 mb-3">اكتشف الرقم الناقص (؟)</p>
                <div className="flex flex-wrap justify-center gap-2">
                    {puzzle!.sequence.map((n, i) => (
                        <div key={i}
                            className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shadow-md ${n === null ? 'bg-amber-400 text-white border-2 border-amber-500 animate-pulse text-2xl' : 'bg-white text-gray-800 border-2 border-cyan-200'}`}>
                            {n === null ? '?' : n}
                        </div>
                    ))}
                </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 gap-3">
                {options.map((opt, i) => {
                    const isCorrect = opt === puzzle!.answer;
                    const isSelected = selected === opt;
                    let cls = 'bg-white border-2 border-gray-200 text-gray-800 hover:border-cyan-400 hover:bg-cyan-50';
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
