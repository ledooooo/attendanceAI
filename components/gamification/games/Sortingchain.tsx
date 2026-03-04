import React, { useState, useEffect } from 'react';
import { ArrowUpDown, Timer, CheckCircle, XCircle, RotateCcw, Info } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

interface SortPuzzle {
    id: number;
    title: string;
    instruction: string;
    items: string[];
    solution: string[];
    hint: string;
    rule: string;
}

// ── 30+ ألغاز ترتيب متنوعة ────────────────────────────────────────────────────
const PUZZLES: SortPuzzle[] = [
    // أرقام تصاعدي
    { id:1, title:'رتب تصاعدياً', instruction:'من الأصغر للأكبر', items:['7','3','9','1','5'], solution:['1','3','5','7','9'], hint:'ابدأ من الأصغر', rule:'↑ تصاعدي' },
    { id:2, title:'رتب تنازلياً', instruction:'من الأكبر للأصغر', items:['2','8','4','6','10'], solution:['10','8','6','4','2'], hint:'ابدأ من الأكبر', rule:'↓ تنازلي' },
    { id:3, title:'رتب الكسور', instruction:'من الأصغر للأكبر', items:['1/2','1/4','3/4','1/3','2/3'], solution:['1/4','1/3','1/2','2/3','3/4'], hint:'احسب القيمة الفعلية لكل كسر', rule:'قيم كسرية تصاعدية' },
    // أحجام
    { id:4, title:'رتب حسب الحجم', instruction:'من الأصغر للأكبر', items:['🐘','🐁','🐕','🐋','🐈'], solution:['🐁','🐈','🐕','🐘','🐋'], hint:'قارن أحجام الحيوانات الحقيقية', rule:'من الأصغر للأكبر' },
    { id:5, title:'رتب حسب السرعة', instruction:'من الأبطأ للأسرع', items:['🐢','🐇','🐆','🐌','🦅'], solution:['🐌','🐢','🐇','🐆','🦅'], hint:'من يتحرك أبطأ؟ من أسرع؟', rule:'سرعة متصاعدة' },
    // تسلسل زمني
    { id:6, title:'رتب دورة الحياة', instruction:'من البداية للنهاية', items:['🦋','🐛','🥚','🫘'], solution:['🥚','🫘','🐛','🦋'], hint:'من أين تبدأ حياة الفراشة؟', rule:'دورة حياة' },
    { id:7, title:'رتب مراحل القمر', instruction:'من الجديد للبدر', items:['🌔','🌑','🌓','🌒','🌕'], solution:['🌑','🌒','🌓','🌔','🌕'], hint:'القمر يبدأ جديداً ثم يكتمل', rule:'مراحل القمر' },
    { id:8, title:'رتب فصول السنة', instruction:'بدءاً من الربيع', items:['❄️','🌸','☀️','🍂'], solution:['🌸','☀️','🍂','❄️'], hint:'ربيع → صيف → خريف → شتاء', rule:'الفصول الأربعة' },
    // رياضيات
    { id:9, title:'رتب النتائج', instruction:'احسب ثم رتب تصاعدياً', items:['3×3','2+3','10-4','8÷2','1+1'], solution:['1+1','2+3','8÷2','10-4','3×3'], hint:'احسب كل عملية: 2,5,4,6,9', rule:'نتائج العمليات' },
    { id:10, title:'رتب القوى', instruction:'من الأصغر للأكبر', items:['2³','3²','1⁴','2²','4¹'], solution:['1⁴','2²','4¹','2³','3²'], hint:'1,4,4,8,9 — احسب كل قوة', rule:'القوى والأسس' },
    // ألوان الطيف
    { id:11, title:'رتب ألوان قوس قزح', instruction:'بالترتيب الصحيح', items:['🟡','🔵','🟢','🔴','🟠'], solution:['🔴','🟠','🟡','🟢','🔵'], hint:'أحمر برتقالي أصفر أخضر أزرق', rule:'ألوان الطيف' },
    // وزن
    { id:12, title:'رتب حسب الوزن', instruction:'من الأخف للأثقل', items:['🧲','🪶','🗿','💎','🪨'], solution:['🪶','💎','🧲','🪨','🗿'], hint:'الريشة أخف شيء. الصخرة ثقيلة', rule:'وزن متصاعد' },
    // درجات حرارة
    { id:13, title:'رتب درجات الحرارة', instruction:'من الأبرد للأحر', items:['100°','0°','37°','-10°','20°'], solution:['-10°','0°','20°','37°','100°'], hint:'الصفر تجمد، 37 درجة جسم الإنسان', rule:'حرارة تصاعدية' },
    // حروف
    { id:14, title:'رتب هجائياً', instruction:'بالترتيب الأبجدي', items:['ز','أ','م','ب','ت'], solution:['أ','ب','ت','ز','م'], hint:'أ ب ت ث ج... كيف يأتي كل حرف؟', rule:'ترتيب أبجدي' },
    // طعام
    { id:15, title:'رتب من الأصغر للأكبر كمياً', instruction:'حسب السعرات الحرارية', items:['🥦','🍫','🍎','🍞','🥑'], solution:['🥦','🍎','🥑','🍞','🍫'], hint:'الخضار أقل سعرات، الشوكولاتة أعلى', rule:'سعرات حرارية' },
    // أعداد بالكلمات
    { id:16, title:'رتب الأعداد', instruction:'من الأصغر للأكبر', items:['عشرة','خمسة','خمسة عشر','واحد','اثنا عشر'], solution:['واحد','خمسة','عشرة','اثنا عشر','خمسة عشر'], hint:'1, 5, 10, 12, 15', rule:'أعداد بالكلمات' },
    // سرعة الأصوات
    { id:17, title:'رتب حسب التردد', instruction:'من الأخفض للأعلى', items:['🥁','🎸','🎹','🎺','🎻'], solution:['🥁','🎸','🎻','🎹','🎺'], hint:'الطبول لها أدنى تردد', rule:'تردد صوتي' },
    // أرقام رومانية
    { id:18, title:'رتب الأرقام الرومانية', instruction:'من الأصغر للأكبر', items:['V','X','I','III','VII'], solution:['I','III','V','VII','X'], hint:'I=1, III=3, V=5, VII=7, X=10', rule:'أرقام رومانية' },
    // الكواكب
    { id:19, title:'رتب الكواكب من الشمس', instruction:'من الأقرب للأبعد', items:['🌍','♂️','☿','♀️','♃'], solution:['☿','♀️','🌍','♂️','♃'], hint:'عطارد الزهرة الأرض المريخ المشتري', rule:'النظام الشمسي' },
    // الأعداد الزوجية والفردية
    { id:20, title:'رتب: فردي أولاً', instruction:'الأفراد أولاً ثم الأزواج', items:['4','7','2','9','3'], solution:['3','7','9','2','4'], hint:'الفردية: 3,7,9 | الزوجية: 2,4', rule:'فردي ثم زوجي تصاعدي' },
    // المسافات
    { id:21, title:'رتب المسافات', instruction:'من الأقصر للأطول', items:['1km','100m','1m','50km','500m'], solution:['1m','100m','500m','1km','50km'], hint:'1م → 100م → 500م → 1كم → 50كم', rule:'مسافات متصاعدة' },
    { id:22, title:'رتب الكسور المئوية', instruction:'من الأصغر للأكبر', items:['75%','25%','10%','50%','90%'], solution:['10%','25%','50%','75%','90%'], hint:'النسب المئوية التصاعدية', rule:'نسب مئوية' },
    { id:23, title:'رتب الأوزان', instruction:'من الأخف للأثقل', items:['500g','2kg','100g','1.5kg','250g'], solution:['100g','250g','500g','1.5kg','2kg'], hint:'100 → 250 → 500جم → 1.5 → 2كجم', rule:'أوزان تصاعدية' },
];

const TIME_LIMIT = 45;

export default function SortingChain({ onStart, onComplete }: Props) {
    const [puzzle, setPuzzle] = useState<SortPuzzle | null>(null);
    const [order, setOrder] = useState<string[]>([]);
    const [selected, setSelected] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const [answered, setAnswered] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [usedIds, setUsedIds] = useState<number[]>([]);
    const [wrongPositions, setWrongPositions] = useState<number[]>([]);

    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        const available = PUZZLES.filter(p => !usedIds.includes(p.id));
        const pool = available.length > 0 ? available : PUZZLES;
        const p = pool[Math.floor(Math.random() * pool.length)];
        setUsedIds(prev => [...prev, p.id]);
        setPuzzle(p);
        // Shuffle
        const shuffled = [...p.items].sort(() => Math.random() - 0.5);
        // Make sure it's not already solved
        const alreadySolved = shuffled.every((v,i) => v === p.solution[i]);
        if (alreadySolved && shuffled.length > 1) {
            [shuffled[0], shuffled[shuffled.length-1]] = [shuffled[shuffled.length-1], shuffled[0]];
        }
        setOrder(shuffled);
        setSelected(null);
        setTimeLeft(TIME_LIMIT);
        setAnswered(false);
        setIsCorrect(false);
        setWrongPositions([]);
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

    const handleItemClick = (idx: number) => {
        if (answered) return;
        if (selected === null) {
            setSelected(idx);
        } else if (selected === idx) {
            setSelected(null);
        } else {
            // Swap
            const next = [...order];
            [next[selected], next[idx]] = [next[idx], next[selected]];
            setOrder(next);
            setSelected(null);
            setWrongPositions([]);
        }
    };

    const checkAnswer = () => {
        if (!puzzle) return;
        const wrong = order.map((v,i) => v !== puzzle.solution[i] ? i : -1).filter(i => i >= 0);
        if (wrong.length === 0) {
            setIsCorrect(true); setAnswered(true); setIsActive(false);
            const pts = Math.max(15, Math.floor(timeLeft * 0.9));
            setTimeout(() => { toast.success(`🎯 ترتيب صحيح! +${pts} نقطة`); onComplete(pts, true); }, 400);
        } else {
            setWrongPositions(wrong);
            toast.error(`${wrong.length} عنصر في مكان خاطئ — مُميزة باللون الأحمر`);
        }
    };

    const reset = () => {
        if (!puzzle) return;
        const shuffled = [...puzzle.items].sort(() => Math.random() - 0.5);
        setOrder(shuffled);
        setSelected(null);
        setWrongPositions([]);
    };

    // ── IDLE ──
    if (!isActive && !answered) return (
        <div className="text-center py-8 px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-rose-500 to-pink-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
                <ArrowUpDown className="w-12 h-12 text-white"/>
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">سلسلة الترتيب 🔗</h3>
            <p className="text-sm font-bold text-gray-500 mb-4 max-w-sm mx-auto">
                اضغط على عنصرَين لتبادل مواضعهما، ورتب السلسلة بالترتيب الصحيح!
            </p>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-6 text-xs text-rose-700 font-bold max-w-xs mx-auto">
                اضغط أي عنصر ثم اضغط مكانه الصحيح لتبادل الموضعين
            </div>
            <button onClick={startGame} disabled={starting}
                className="bg-gradient-to-r from-rose-500 to-pink-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg">
                {starting ? '⏳ جاري البدء...' : '🔗 ابدأ التحدي'}
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
                        <ArrowUpDown className="w-4 h-4 text-rose-500"/> {puzzle.title}
                    </h3>
                    <p className="text-[11px] text-rose-600 font-bold">📋 {puzzle.instruction}</p>
                </div>
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-sm ${timeLeft <= 12 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-rose-100 text-rose-700'}`}>
                    <Timer className="w-4 h-4"/> {timeLeft}
                </div>
            </div>

            {/* Hint */}
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5">
                <p className="text-xs font-bold text-rose-700">💡 {puzzle.hint}</p>
                <p className="text-[10px] text-rose-500 mt-0.5">القاعدة: {puzzle.rule}</p>
            </div>

            {/* Instruction */}
            {selected !== null && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-2 text-center">
                    <p className="text-xs font-black text-amber-700">
                        ✅ تم اختيار «{order[selected]}» — اضغط على العنصر الذي تريد التبادل معه
                    </p>
                </div>
            )}

            {/* Items grid */}
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(order.length, 5)}, 1fr)` }}>
                {order.map((item, i) => {
                    const isSelected = selected === i;
                    const isWrong = wrongPositions.includes(i);
                    const isCorrectPos = answered && isCorrect;

                    let cls = 'rounded-2xl p-3 font-black text-center transition-all cursor-pointer select-none border-2 shadow-sm min-h-[60px] flex items-center justify-center ';
                    if (isCorrectPos) cls += 'bg-emerald-100 text-emerald-700 border-emerald-300';
                    else if (isWrong) cls += 'bg-red-100 text-red-600 border-red-400 animate-pulse';
                    else if (isSelected) cls += 'bg-rose-500 text-white border-rose-600 scale-110 shadow-lg';
                    else cls += 'bg-white text-gray-800 border-gray-200 hover:border-rose-400 hover:bg-rose-50 hover:scale-105 active:scale-95';

                    return (
                        <button key={i} className={cls} onClick={() => !answered && handleItemClick(i)}>
                            <div>
                                <div className="text-lg leading-none">{item}</div>
                                {answered && !isCorrect && (
                                    <div className="text-[9px] mt-1 text-emerald-700 font-black">→{puzzle.solution[i]}</div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Position indicators */}
            {!answered && (
                <div className="flex justify-between px-1">
                    {order.map((_, i) => (
                        <div key={i} className="text-[10px] text-gray-400 font-bold text-center flex-1">
                            {i+1}
                        </div>
                    ))}
                </div>
            )}

            {/* Result */}
            {answered && (
                <div className={`rounded-2xl p-4 text-center font-black ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {isCorrect
                        ? <><CheckCircle className="inline w-5 h-5 ml-1"/> ترتيب مثالي! 🎉</>
                        : <><XCircle className="inline w-5 h-5 ml-1"/> الترتيب الصحيح موضح بالأسهم</>}
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
                        className="flex-1 bg-gradient-to-r from-rose-500 to-pink-600 text-white py-2.5 rounded-xl font-black text-sm shadow-lg hover:scale-105 active:scale-95 transition-all">
                        ✅ تحقق من الترتيب
                    </button>
                </div>
            )}
        </div>
    );
}
