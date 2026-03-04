import React, { useState, useEffect } from 'react';
import { KeyRound, Timer, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

interface CipherPuzzle {
    id: number;
    title: string;
    type: 'shift' | 'mirror' | 'position' | 'emoji' | 'math';
    encoded: string;
    decoded: string;
    clue: string;
    hint: string;
    options: string[];
}

// ── 30+ ألغاز متنوعة ──────────────────────────────────────────────────────────
const PUZZLES: CipherPuzzle[] = [
    // Shift cipher (أزح كل رقم +1)
    { id:1, title:'شفرة الإزاحة', type:'shift', encoded:'2 3 4', decoded:'1 2 3', clue:'كل رقم = الأصل + 1', hint:'اطرح 1 من كل رقم', options:['1 2 3','3 4 5','0 1 2','2 3 4'] },
    { id:2, title:'شفرة الإزاحة', type:'shift', encoded:'5 7 9', decoded:'4 6 8', clue:'كل رقم = الأصل + 1', hint:'اطرح 1 من كل رقم', options:['4 6 8','6 8 10','3 5 7','5 7 9'] },
    { id:3, title:'شفرة الإزاحة ×2', type:'shift', encoded:'4 6 8', decoded:'2 3 4', clue:'كل رقم = الأصل × 2', hint:'اقسم كل رقم على 2', options:['2 3 4','8 12 16','3 5 7','1 2 3'] },
    { id:4, title:'شفرة الإزاحة -3', type:'shift', encoded:'10 13 16', decoded:'7 10 13', clue:'كل رقم = الأصل + 3', hint:'اطرح 3 من كل رقم', options:['7 10 13','13 16 19','6 9 12','8 11 14'] },
    // Mirror (عكس الترتيب)
    { id:5, title:'شفرة العكس', type:'mirror', encoded:'9 6 3', decoded:'3 6 9', clue:'الأرقام مقلوبة الترتيب', hint:'اقرأها من اليمين لليسار', options:['3 6 9','9 6 3','6 9 3','3 9 6'] },
    { id:6, title:'شفرة العكس', type:'mirror', encoded:'🌙 ⭐ ☀️', decoded:'☀️ ⭐ 🌙', clue:'الرموز مقلوبة', hint:'اعكس الترتيب', options:['☀️ ⭐ 🌙','🌙 ⭐ ☀️','⭐ ☀️ 🌙','☀️ 🌙 ⭐'] },
    { id:7, title:'شفرة العكس', type:'mirror', encoded:'C B A', decoded:'A B C', clue:'الحروف مقلوبة', hint:'اعكس الترتيب', options:['A B C','C B A','B A C','A C B'] },
    // Position (موضع الحرف في الأبجدية)
    { id:8, title:'شفرة الموضع', type:'position', encoded:'1 2 3', decoded:'أ ب ج', clue:'كل رقم = موضع الحرف في الأبجدية', hint:'1=أ, 2=ب, 3=ج', options:['أ ب ج','ب ج د','أ ج ب','1 2 3'] },
    { id:9, title:'شفرة الموضع', type:'position', encoded:'4 1 3', decoded:'د أ ج', clue:'1=أ, 2=ب, 3=ج, 4=د', hint:'حوّل الأرقام إلى حروف', options:['د أ ج','أ د ج','ج أ د','د ج أ'] },
    // Emoji patterns
    { id:10, title:'شفرة الرموز', type:'emoji', encoded:'🔴🔴🔵', decoded:'2R 1B', clue:'عدّ تكرار كل رمز', hint:'كم مرة يتكرر كل رمز؟', options:['2R 1B','1R 2B','3R 0B','0R 3B'] },
    { id:11, title:'شفرة الرموز', type:'emoji', encoded:'⭐⭐⭐🌙🌙', decoded:'3⭐2🌙', clue:'عدّ التكرار', hint:'نجوم × قمر ×', options:['3⭐2🌙','2⭐3🌙','5⭐0🌙','1⭐4🌙'] },
    { id:12, title:'شفرة الرموز', type:'emoji', encoded:'🟩🟥🟩🟥🟩', decoded:'3🟩 2🟥', clue:'عدّ كل لون', hint:'الخضراء كام؟ الحمراء كام؟', options:['3🟩 2🟥','2🟩 3🟥','5🟩 0🟥','1🟩 4🟥'] },
    // Math cipher (ناتج = مفتاح الشفرة)
    { id:13, title:'شفرة الحساب', type:'math', encoded:'[3+4] [8-2] [2×3]', decoded:'7 6 6', clue:'احسب قيمة كل قوس', hint:'3+4=? | 8-2=? | 2×3=?', options:['7 6 6','7 6 5','6 7 6','7 5 6'] },
    { id:14, title:'شفرة الحساب', type:'math', encoded:'[10÷2] [3²] [4+1]', decoded:'5 9 5', clue:'احسب كل عملية', hint:'10÷2=? | 3²=? | 4+1=?', options:['5 9 5','5 8 5','5 9 4','6 9 5'] },
    { id:15, title:'شفرة الحساب', type:'math', encoded:'[√16] [5!÷24] [2⁴]', decoded:'4 5 16', clue:'جذر + مضروب + قوة', hint:'√16=4 | 5!/24=5 | 2⁴=16', options:['4 5 16','4 5 8','3 5 16','4 4 16'] },
    // Advanced shift
    { id:16, title:'شفرة الفيبوناتشي', type:'shift', encoded:'3 5 9 15', decoded:'2 3 6 9', clue:'كل رقم × معامل مختلف', hint:'1×2, 1×3, 1×2... أو النمط؟', options:['2 3 6 9','1 2 3 4','3 5 9 15','4 6 10 16'] },
    { id:17, title:'شفرة التضاعف', type:'shift', encoded:'2 4 8 16', decoded:'1 2 4 8', clue:'كل رقم = الأصل × 2', hint:'اقسم كل رقم على 2', options:['1 2 4 8','2 4 8 16','0 2 4 8','1 3 5 7'] },
    { id:18, title:'شفرة الجمع التراكمي', type:'shift', encoded:'1 3 6 10', decoded:'1 2 3 4', clue:'المجموع التراكمي', hint:'1, 1+2=3, 3+3=6, 6+4=10', options:['1 2 3 4','1 2 4 8','2 3 4 5','1 3 5 7'] },
    { id:19, title:'شفرة المربعات', type:'shift', encoded:'1 4 9 16', decoded:'1 2 3 4', clue:'أرقام مربعة', hint:'كل رقم = N²، ما قيمة N؟', options:['1 2 3 4','2 4 6 8','1 3 5 7','0 1 2 3'] },
    { id:20, title:'شفرة التبادل', type:'mirror', encoded:'🐱🐶🐱🐶', decoded:'🐶🐱🐶🐱', clue:'تبادل كل رمزين متجاورين', hint:'قلب كل زوج من الرموز', options:['🐶🐱🐶🐱','🐱🐶🐱🐶','🐶🐶🐱🐱','🐱🐱🐶🐶'] },
    { id:21, title:'شفرة البناء', type:'math', encoded:'[1+1] [2+2] [3+3] [4+4]', decoded:'2 4 6 8', clue:'احسب كل قوس', hint:'جمع بسيط في تتابع', options:['2 4 6 8','2 4 8 16','1 2 3 4','3 5 7 9'] },
    { id:22, title:'شفرة الأضداد', type:'mirror', encoded:'⬆️⬇️⬆️⬇️', decoded:'⬇️⬆️⬇️⬆️', clue:'اعكس كل اتجاه', hint:'أعلى يصبح أسفل والعكس', options:['⬇️⬆️⬇️⬆️','⬆️⬇️⬆️⬇️','⬇️⬇️⬆️⬆️','⬆️⬆️⬇️⬇️'] },
    { id:23, title:'شفرة الفرق', type:'shift', encoded:'10 8 6 4', decoded:'2 2 2 2', clue:'الفرق بين كل رقمين متتاليين', hint:'10-8=? | 8-6=? | 6-4=?', options:['2 2 2 2','1 2 3 4','3 3 3 3','2 3 4 5'] },
    { id:24, title:'شفرة الخريطة', type:'position', encoded:'3 1 4 1 5', decoded:'ج أ د أ ه', clue:'1=أ, 2=ب, 3=ج, 4=د, 5=ه', hint:'حول كل رقم لحرف', options:['ج أ د أ ه','أ ب ج د ه','ج ب د ب ه','د أ ج أ ه'] },
    { id:25, title:'شفرة التكرار', type:'emoji', encoded:'🔥🔥💧🔥💧💧', decoded:'3🔥 3💧', clue:'عدّ كل عنصر', hint:'نار كام؟ ماء كام؟', options:['3🔥 3💧','4🔥 2💧','2🔥 4💧','3🔥 2💧'] },
];

const TIME_LIMIT = 25;

export default function CipherDecode({ onStart, onComplete }: Props) {
    const [puzzle, setPuzzle] = useState<CipherPuzzle | null>(null);
    const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
    const [selected, setSelected] = useState<string | null>(null);
    const [answered, setAnswered] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const [usedIds, setUsedIds] = useState<number[]>([]);

    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        const available = PUZZLES.filter(p => !usedIds.includes(p.id));
        const pool = available.length > 0 ? available : PUZZLES;
        const p = pool[Math.floor(Math.random() * pool.length)];
        setUsedIds(prev => [...prev, p.id]);
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
        const isCorrect = opt === puzzle?.decoded;
        const pts = isCorrect ? Math.max(10, Math.floor(timeLeft * 1.2)) : 0;
        setTimeout(() => {
            if (isCorrect) { toast.success(`🔓 فككت الشفرة! +${pts} نقطة`); onComplete(pts, true); }
            else { toast.error(opt === '__timeout__' ? '⏰ انتهى الوقت!' : '❌ شفرة خاطئة!'); onComplete(0, false); }
        }, 700);
    };

    // ── IDLE ──
    if (!isActive && !answered) return (
        <div className="text-center py-8 px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
                <KeyRound className="w-12 h-12 text-white"/>
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">فك الشفرة 🔐</h3>
            <p className="text-sm font-bold text-gray-500 mb-6 max-w-sm mx-auto">
                اكتشف قاعدة الشفرة واختر الرسالة الصحيحة بعد فكها!
            </p>
            <button onClick={startGame} disabled={starting}
                className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg">
                {starting ? '⏳ جاري البدء...' : '🔐 ابدأ التحدي'}
            </button>
        </div>
    );

    if (!puzzle) return null;

    return (
        <div className="max-w-lg mx-auto py-4 px-2 animate-in zoom-in-95 space-y-4" dir="rtl">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="font-black text-gray-700 flex items-center gap-2 text-sm">
                        <KeyRound className="w-4 h-4 text-indigo-500"/> {puzzle.title}
                    </h3>
                </div>
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-sm ${timeLeft <= 8 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-indigo-100 text-indigo-700'}`}>
                    <Timer className="w-4 h-4"/> {timeLeft}
                </div>
            </div>

            {/* Encoded message */}
            <div className="bg-gray-900 rounded-2xl p-5 text-center shadow-xl">
                <p className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest">رسالة مشفرة</p>
                <div className="font-black text-2xl text-green-400 tracking-widest mb-3 font-mono"
                    style={{ textShadow: '0 0 20px #4ade80', letterSpacing: '0.15em' }}>
                    {puzzle.encoded}
                </div>
                <div className="bg-gray-800 rounded-xl px-4 py-2 inline-block">
                    <p className="text-xs font-bold text-yellow-400">🔑 القاعدة: {puzzle.clue}</p>
                </div>
            </div>

            {/* Hint */}
            <div className="bg-indigo-50 border-2 border-indigo-100 rounded-xl p-3">
                <p className="text-xs font-bold text-indigo-700">💡 تلميح: {puzzle.hint}</p>
            </div>

            {/* Options */}
            <div>
                <p className="text-xs font-bold text-gray-500 mb-2">اختر الرسالة الأصلية بعد فك الشفرة:</p>
                <div className="grid grid-cols-2 gap-3">
                    {puzzle.options.map((opt, i) => {
                        const isCorrect = opt === puzzle.decoded;
                        const isSel = selected === opt;
                        let cls = 'bg-white border-2 border-gray-200 text-gray-800 hover:border-indigo-400 hover:bg-indigo-50';
                        if (answered) {
                            if (isCorrect) cls = 'bg-emerald-500 border-emerald-500 text-white';
                            else if (isSel) cls = 'bg-red-500 border-red-500 text-white';
                            else cls = 'bg-gray-100 border-gray-100 text-gray-400 opacity-50';
                        }
                        return (
                            <button key={i} onClick={() => handleAnswer(opt)} disabled={answered}
                                className={`${cls} p-4 rounded-xl font-black text-base transition-all active:scale-95 flex items-center justify-center gap-2 min-h-[60px]`}>
                                <span className="font-mono">{opt}</span>
                                {answered && isCorrect && <CheckCircle className="w-5 h-5 shrink-0"/>}
                                {answered && isSel && !isCorrect && <XCircle className="w-5 h-5 shrink-0"/>}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
