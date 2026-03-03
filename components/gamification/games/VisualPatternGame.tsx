import React, { useState, useEffect } from 'react';
import { Eye, Timer, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

// كل لغز: متتالية من الرموز والألوان، والأنماط المتوقعة
interface Puzzle {
    title: string;
    sequence: string[];   // الرموز الظاهرة
    options: string[];    // الخيارات
    answer: string;
    hint: string;
}

const EMOJI_PUZZLES: Puzzle[] = [
    {
        title: 'ما الرمز التالي في المتتالية؟',
        sequence: ['🔴','🔵','🔴','🔵','🔴'],
        options: ['🔵','🔴','🟡','🟢'],
        answer: '🔵',
        hint: 'النمط: أحمر، أزرق، أحمر، أزرق...',
    },
    {
        title: 'ما الرمز التالي؟',
        sequence: ['⬆️','➡️','⬇️','⬅️','⬆️'],
        options: ['⬆️','⬇️','➡️','⬅️'],
        answer: '➡️',
        hint: 'دوران: أعلى ← يمين ← أسفل ← يسار ← ...',
    },
    {
        title: 'أكمل المتتالية',
        sequence: ['🌑','🌒','🌓','🌔'],
        options: ['🌕','🌑','🌒','🌗'],
        answer: '🌕',
        hint: 'مراحل القمر بالترتيب: من الجديد إلى البدر',
    },
    {
        title: 'ما التالي في النمط؟',
        sequence: ['🐣','🐤','🐔','🐣','🐤'],
        options: ['🐔','🥚','🐣','🐤'],
        answer: '🐔',
        hint: 'دورة حياة متكررة بنفس الترتيب',
    },
    {
        title: 'أكمل النمط',
        sequence: ['1️⃣','2️⃣','3️⃣','1️⃣','2️⃣'],
        options: ['3️⃣','4️⃣','1️⃣','2️⃣'],
        answer: '3️⃣',
        hint: 'تكرار: 1، 2، 3، 1، 2، ...',
    },
    {
        title: 'النمط العاطفي',
        sequence: ['😀','😐','😢','😀','😐'],
        options: ['😢','😀','😮','😡'],
        answer: '😢',
        hint: 'تكرار: سعيد، محايد، حزين...',
    },
    {
        title: 'نمط الأشكال',
        sequence: ['🔺','🔻','🔺','🔻','🔺'],
        options: ['🔻','🔺','🔶','🔷'],
        answer: '🔻',
        hint: 'مثلث لأعلى ثم لأسفل، تناوب',
    },
    {
        title: 'متتالية الطقس',
        sequence: ['☀️','🌤️','⛅','🌥️'],
        options: ['☁️','🌧️','☀️','🌩️'],
        answer: '☁️',
        hint: 'من المشمس إلى الغائم تدريجياً',
    },
];

const TIME_LIMIT = 20;

export default function VisualPatternGame({ onStart, onComplete }: Props) {
    const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
    const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
    const [selected, setSelected] = useState<string | null>(null);
    const [answered, setAnswered] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);

    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        setPuzzle(EMOJI_PUZZLES[Math.floor(Math.random() * EMOJI_PUZZLES.length)]);
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
        const isCorrect = opt === puzzle?.answer;
        setTimeout(() => {
            if (isCorrect) { toast.success('👁️ ملاحظة ممتازة!'); onComplete(20, true); }
            else { toast.error(opt === '__timeout__' ? '⏰ انتهى الوقت!' : '❌ لم تلاحظ النمط!'); onComplete(0, false); }
        }, 800);
    };

    if (!isActive) return (
        <div className="text-center py-8 px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
                <Eye className="w-12 h-12 text-white"/>
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">النمط البصري 👁️</h3>
            <p className="text-sm font-bold text-gray-500 mb-6 max-w-sm mx-auto">لاحظ النمط في المتتالية وأكملها بالرمز الصحيح!</p>
            <button onClick={startGame} disabled={starting}
                className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg">
                {starting ? '⏳ جاري البدء...' : '👁️ ابدأ التحدي'}
            </button>
        </div>
    );

    return (
        <div className="max-w-lg mx-auto py-4 px-2 animate-in zoom-in-95 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-black text-gray-700 flex items-center gap-2"><Eye className="w-5 h-5 text-teal-500"/> نمط بصري</h3>
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black ${timeLeft <= 7 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-teal-100 text-teal-700'}`}>
                    <Timer className="w-4 h-4"/> {timeLeft}
                </div>
            </div>

            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl p-5 border-2 border-teal-200 text-center space-y-3">
                <p className="text-sm font-black text-teal-700">{puzzle!.title}</p>
                {/* Sequence + blank */}
                <div className="flex flex-wrap justify-center items-center gap-2">
                    {puzzle!.sequence.map((sym, i) => (
                        <span key={i} className="text-4xl">{sym}</span>
                    ))}
                    <span className="w-12 h-12 bg-amber-400 rounded-xl flex items-center justify-center text-2xl font-black text-white border-2 border-amber-500 animate-pulse">?</span>
                </div>
                <p className="text-xs font-bold text-gray-500">💡 {puzzle!.hint}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {puzzle!.options.map((opt, i) => {
                    const isCorrect = opt === puzzle!.answer;
                    const isSelected = selected === opt;
                    let cls = 'bg-white border-2 border-gray-200 hover:border-teal-400 hover:bg-teal-50';
                    if (answered) {
                        if (isCorrect) cls = 'bg-emerald-500 border-emerald-500';
                        else if (isSelected) cls = 'bg-red-500 border-red-500';
                        else cls = 'bg-gray-100 border-gray-100 opacity-50';
                    }
                    return (
                        <button key={i} onClick={() => handleAnswer(opt)} disabled={answered}
                            className={`${cls} p-4 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2`}>
                            <span className="text-4xl">{opt}</span>
                            {answered && isCorrect && <CheckCircle className="w-5 h-5 text-white"/>}
                            {answered && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-white"/>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
