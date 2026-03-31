import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Flame, Timer, CheckCircle, XCircle, RotateCcw, Globe, Volume2, VolumeX, Sparkles, Loader2, BrainCircuit, Star, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
    employee?: Employee;
}

// ─── Layout constants ─────────────────────────────────────────
const DW = 72, DH = 118, OP_W = 40;
const SNAP_R = 26;
const TIME_LIMIT = 90;
const SW = 10;
const BASE_POINTS = 20; // النقاط الأساسية لفك اللغز

const STICK_BODY = '#78350f';
const STICK_HI = '#d97706';
const STICK_DRAG = '#b45309';
const TIP_COL = '#b91c1c';
const TIP_IN = '#fecaca';

const BONUS_LEVELS = [
    { id: 'سهل', points: 10, time: 20 },
    { id: 'متوسط', points: 20, time: 20 },
    { id: 'صعب', points: 30, time: 30 }
];

// ─── 7-segment slot geometry ──────────────────────────────────
function digitSlots(ox: number, oy: number) {
    const p = 9;
    const hh = DH / 2;
    return [
        { x1: ox + p, y1: oy + p * 0.5, x2: ox + DW - p, y2: oy + p * 0.5 },
        { x1: ox + p * 0.5, y1: oy + p, x2: ox + p * 0.5, y2: oy + hh - p },
        { x1: ox + DW - p * 0.5, y1: oy + p, x2: ox + DW - p * 0.5, y2: oy + hh - p },
        { x1: ox + p, y1: oy + hh, x2: ox + DW - p, y2: oy + hh },
        { x1: ox + p * 0.5, y1: oy + hh + p, x2: ox + p * 0.5, y2: oy + DH - p },
        { x1: ox + DW - p * 0.5, y1: oy + hh + p, x2: ox + DW - p * 0.5, y2: oy + DH - p },
        { x1: ox + p, y1: oy + DH - p * 0.5, x2: ox + DW - p, y2: oy + DH - p * 0.5 },
    ];
}

const DIGIT_ON: Record<number, number[]> = {
    0: [0, 1, 2, 4, 5, 6], 1: [2, 5], 2: [0, 2, 3, 4, 6], 3: [0, 2, 3, 5, 6],
    4: [1, 2, 3, 5], 5: [0, 1, 3, 5, 6], 6: [0, 1, 3, 4, 5, 6], 7: [0, 2, 5],
    8: [0, 1, 2, 3, 4, 5, 6], 9: [0, 1, 2, 3, 5, 6],
};

function opSlots(ox: number, oy: number) {
    const cx = ox + OP_W / 2, cy = oy + DH / 2;
    return [{ x1: cx - 15, y1: cy, x2: cx + 15, y2: cy }, { x1: cx, y1: cy - 15, x2: cx, y2: cy + 15 }];
}

function eqSlots(ox: number, oy: number) {
    const cx = ox + OP_W / 2, cy = oy + DH / 2;
    return [{ x1: cx - 14, y1: cy - 10, x2: cx + 14, y2: cy - 10 }, { x1: cx - 14, y1: cy + 10, x2: cx + 14, y2: cy + 10 }];
}

interface Token { type: 'digit' | 'op' | 'eq'; value: number | string; ox: number; oy: number }
function buildLayout(eq: (number | string)[]): { tokens: Token[]; totalW: number } {
    let x = 10;
    const tokens: Token[] = [];
    eq.forEach(tok => {
        if (typeof tok === 'number') { tokens.push({ type: 'digit', value: tok, ox: x, oy: 10 }); x += DW + 14; }
        else if (tok === '=') { tokens.push({ type: 'eq', value: '=', ox: x, oy: 10 }); x += OP_W + 14; }
        else { tokens.push({ type: 'op', value: tok, ox: x, oy: 10 }); x += OP_W + 14; }
    });
    return { tokens, totalW: x + 8 };
}

interface Stick { id: string; tokenIdx: number; slotIdx: number; active: boolean; draggable: boolean; x1: number; y1: number; x2: number; y2: number }

function buildSticks(eq: (number | string)[]): Stick[] {
    const { tokens } = buildLayout(eq);
    const out: Stick[] = [];
    tokens.forEach((tok, ti) => {
        if (tok.type === 'digit') {
            const slots = digitSlots(tok.ox, tok.oy);
            const on = DIGIT_ON[tok.value as number] ?? [];
            slots.forEach((sl, si) => out.push({ id: `t${ti}_s${si}`, tokenIdx: ti, slotIdx: si, active: on.includes(si), draggable: true, ...sl }));
        } else if (tok.type === 'op') {
            const slots = opSlots(tok.ox, tok.oy);
            const isPlus = tok.value === '+';
            slots.forEach((sl, si) => out.push({ id: `t${ti}_s${si}`, tokenIdx: ti, slotIdx: si, active: si === 0 || (isPlus && si === 1), draggable: true, ...sl }));
        } else {
            eqSlots(tok.ox, tok.oy).forEach((sl, si) => out.push({ id: `t${ti}_s${si}`, tokenIdx: ti, slotIdx: si, active: true, draggable: false, ...sl }));
        }
    });
    return out;
}

function readEq(sticks: Stick[], eq: (number | string)[]): (number | string)[] | null {
    const { tokens } = buildLayout(eq);
    const res: (number | string)[] = [];
    for (let ti = 0; ti < tokens.length; ti++) {
        const tok = tokens[ti];
        const ts = sticks.filter(s => s.tokenIdx === ti && s.active);
        if (tok.type === 'eq') { res.push('='); continue; }
        if (tok.type === 'op') {
            const h = ts.some(s => s.slotIdx === 0), v = ts.some(s => s.slotIdx === 1);
            if (h && v) res.push('+'); else if (h && !v) res.push('-'); else return null;
            continue;
        }
        const segs = [...ts.map(s => s.slotIdx)].sort((a, b) => a - b);
        let d = -1;
        for (let n = 0; n <= 9; n++) {
            const s = [...DIGIT_ON[n]].sort((a, b) => a - b);
            if (s.length === segs.length && s.every((v, i) => v === segs[i])) { d = n; break; }
        }
        if (d === -1) return null;
        res.push(d);
    }
    return res;
}

function isValid(eq: (number | string)[]): boolean {
    const ei = eq.indexOf('='); if (ei < 0) return false;
    const calc = (side: (number | string)[]): number | null => {
        let v = typeof side[0] === 'number' ? side[0] : null; if (v === null) return null;
        for (let i = 1; i < side.length; i += 2) {
            const op = side[i], n = side[i + 1]; if (typeof n !== 'number') return null;
            if (op === '+') v += n; else if (op === '-') v -= n; else return null;
        }
        return v;
    };
    const lv = calc(eq.slice(0, ei)), rv = calc(eq.slice(ei + 1));
    return lv !== null && rv !== null && lv === rv && rv >= 0;
}

const PUZZLES = [
    { id: 1, eq: [5, '+', 4, '=', 5], sol: '9-4=5' },
    { id: 2, eq: [3, '+', 2, '=', 6], sol: '3+3=6' },
    { id: 3, eq: [8, '-', 3, '=', 3], sol: '0+3=3' },
    { id: 4, eq: [6, '+', 4, '=', 4], sol: '0+4=4' },
    { id: 5, eq: [9, '-', 5, '=', 8], sol: '3+5=8' },
    { id: 6, eq: [5, '+', 5, '=', 8], sol: '3+5=8' },
    { id: 7, eq: [6, '+', 4, '=', 3], sol: '5+4=9' },
    { id: 8, eq: [0, '+', 7, '=', 1], sol: '8-7=1' },
    { id: 9, eq: [2, '+', 6, '=', 9], sol: '3+6=9' },
    { id: 10, eq: [0, '+', 3, '=', 9], sol: '6+3=9' },
    { id: 11, eq: [8, '-', 7, '=', 7], sol: '0+7=7' },
    { id: 12, eq: [9, '+', 5, '=', 0], sol: '9-9=0' },
    { id: 13, eq: [4, '+', 3, '=', 9], sol: '4+5=9' },
    { id: 14, eq: [9, '-', 7, '=', 6], sol: '9-1=8' },
    { id: 15, eq: [1, '-', 1, '=', 8], sol: '7-1=6' },
];

export default function MoveTheMatch({ onStart, onComplete, employee }: Props) {
    const [phase, setPhase] = useState<'setup' | 'playing' | 'choose_difficulty' | 'loading_quiz' | 'quiz' | 'summary'>('setup');
    const [puzzle, setPuzzle] = useState<typeof PUZZLES[0] | null>(null);
    const [sticks, setSticks] = useState<Stick[]>([]);
    const [origSticks, setOrigSticks] = useState<Stick[]>([]);
    const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
    const [starting, setStarting] = useState(false);
    const [answered, setAnswered] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    
    // Drag Logic
    const [dragging, setDragging] = useState<string | null>(null);
    const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
    const [snapTarget, setSnapTarget] = useState<string | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    // Settings
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [language, setLanguage] = useState<'auto' | 'ar' | 'en'>('auto');

    // Quiz States
    const [quizQuestion, setQuizQuestion] = useState<any>(null);
    const [selectedBonus, setSelectedBonus] = useState<typeof BONUS_LEVELS[0] | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [totalScore, setTotalScore] = useState(0);

    const isMedicalEnglishSpecialty = ['بشر', 'أسنان', 'صيدل', 'اسره'].some(s => 
        (employee?.job_title || '').includes(s) || (employee?.specialty || '').includes(s)
    );

    const getEffectiveLanguage = useCallback((): 'ar' | 'en' => {
        if (language === 'ar') return 'ar';
        if (language === 'en') return 'en';
        return isMedicalEnglishSpecialty ? 'en' : 'ar';
    }, [language, isMedicalEnglishSpecialty]);

    const playSound = useCallback((type: 'win' | 'lose') => {
        if (!soundEnabled) return;
        try {
            const audio = new Audio(type === 'win' ? '/applause.mp3' : '/fail.mp3');
            audio.volume = 0.6;
            audio.play().catch(() => {});
        } catch {}
    }, [soundEnabled]);

    // ─── Start Game ───────────────────────────────────────────────────────────
    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        
        const p = PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
        setPuzzle(p);
        const s = buildSticks(p.eq);
        setSticks(s); 
        setOrigSticks(s.map(x => ({ ...x })));
        setTimeLeft(TIME_LIMIT);
        setAnswered(false); 
        setIsCorrect(false);
        setTotalScore(0);
        setPhase('playing');
        setStarting(false);
    };

    // ─── Matchstick Timer ─────────────────────────────────────────────────────
    useEffect(() => {
        if (phase !== 'playing' || answered) return;
        if (timeLeft <= 0) { doTimeout(); return; }
        const t = setInterval(() => setTimeLeft(p => p - 1), 1000);
        return () => clearInterval(t);
    }, [phase, timeLeft, answered]);

    const doTimeout = () => {
        setAnswered(true); 
        setIsCorrect(false);
        playSound('lose');
        toast.error(getEffectiveLanguage() === 'en' ? '⏰ Time\'s up!' : '⏰ انتهى الوقت!');
        setTimeout(() => onComplete(0, false), 2000);
    };

    // ─── Drag & Drop Handlers ────────────────────────────────────────────────
    const toSVG = (cx: number, cy: number) => {
        const svg = svgRef.current; if (!svg) return { x: 0, y: 0 };
        const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
        return { x: (cx - r.left) * vb.width / r.width, y: (cy - r.top) * vb.height / r.height };
    };

    const findSnap = (x: number, y: number, excl: string): string | null => {
        if (!puzzle) return null;
        const { tokens } = buildLayout(puzzle.eq);
        let best: string | null = null, bestD = SNAP_R;
        tokens.forEach((tok, ti) => {
            if (tok.type === 'eq') return;
            const slots = tok.type === 'digit' ? digitSlots(tok.ox, tok.oy) : opSlots(tok.ox, tok.oy);
            slots.forEach((sl, si) => {
                const cx = (sl.x1 + sl.x2) / 2, cy = (sl.y1 + sl.y2) / 2;
                const d = Math.hypot(x - cx, y - cy);
                const id = `t${ti}_s${si}`;
                const occ = sticks.find(s => s.id === id && s.active);
                if (d < bestD && (!occ || id === excl)) { bestD = d; best = id; }
            });
        });
        return best;
    };

    const onPDown = (e: React.PointerEvent, sid: string) => {
        if (answered || phase !== 'playing' || dragging) return;
        const st = sticks.find(s => s.id === sid);
        if (!st || !st.active || !st.draggable) return;
        e.preventDefault();
        (e.target as Element).setPointerCapture(e.pointerId);
        setDragging(sid);
        setDragPos(toSVG(e.clientX, e.clientY));
        setSticks(prev => prev.map(s => s.id === sid ? { ...s, active: false } : s));
    };

    const onPMove = (e: React.PointerEvent) => {
        if (!dragging) return;
        e.preventDefault();
        const pt = toSVG(e.clientX, e.clientY);
        setDragPos(pt);
        setSnapTarget(findSnap(pt.x, pt.y, dragging));
    };

    const onPUp = (e: React.PointerEvent) => {
        if (!dragging || !puzzle) return;
        e.preventDefault();
        const pt = toSVG(e.clientX, e.clientY);
        const snap = findSnap(pt.x, pt.y, dragging);

        if (snap && snap !== dragging) {
            const { tokens } = buildLayout(puzzle.eq);
            const [tStr, sStr] = snap.split('_s');
            const ti = parseInt(tStr.replace('t', ''));
            const si = parseInt(sStr);
            const slots = tokens[ti].type === 'digit' ? digitSlots(tokens[ti].ox, tokens[ti].oy) : opSlots(tokens[ti].ox, tokens[ti].oy);
            const sl = slots[si];

            setSticks(prev => {
                const next = prev.map(s => s.id === snap ? { ...s, active: true, x1: sl.x1, y1: sl.y1, x2: sl.x2, y2: sl.y2, tokenIdx: ti, slotIdx: si } : s);
                setTimeout(() => {
                    setSticks(cur => {
                        const ev = readEq(cur, puzzle.eq);
                        if (ev && isValid(ev)) {
                            setAnswered(true); setIsCorrect(true);
                            playSound('win');
                            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                            setTotalScore(BASE_POINTS);
                            toast.success(getEffectiveLanguage() === 'en' ? `🔥 Genius! +${BASE_POINTS} points` : `🔥 عبقري! +${BASE_POINTS} نقطة`);
                            setTimeout(() => setPhase('choose_difficulty'), 2000);
                        }
                        return cur;
                    });
                }, 60);
                return next;
            });
        } else {
            const orig = origSticks.find(s => s.id === dragging);
            if (orig) setSticks(prev => prev.map(s => s.id === dragging ? { ...orig } : s));
        }
        setDragging(null); setDragPos(null); setSnapTarget(null);
    };

    const reset = () => {
        if (!puzzle) return;
        setSticks(origSticks.map(x => ({ ...x })));
        setDragging(null); setDragPos(null); setSnapTarget(null);
    };

    // ─── Bonus AI Question ───────────────────────────────────────────────────
    const fetchAIQuestion = async (bonus: typeof BONUS_LEVELS[0]) => {
        setSelectedBonus(bonus);
        setPhase('loading_quiz');

        try {
            const { data, error } = await supabase.functions.invoke('generate-smart-quiz', {
                body: {
                    specialty: employee?.job_title || employee?.specialty || 'طبيب بشرى',
                    domain: 'طبي وعلمي',
                    difficulty: bonus.id,
                    length: 'قصير',
                    language: isMedicalEnglishSpecialty ? 'English (Professional Medical Terminology)' : 'ar',
                    include_hint: false,
                    game_type: 'mcq',
                    question_count: 1
                }
            });

            if (error || !data || data.length === 0) throw new Error('Fetch failed');

            const q = data[0];
            const charToIndex: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
            
            setQuizQuestion({
                question_text: q.question_text,
                options: [q.option_a, q.option_b, q.option_c, q.option_d],
                correct_index: charToIndex[q.correct_option?.toUpperCase()] ?? 0,
                explanation: q.explanation
            });
            
            setTimeLeft(bonus.time);
            setPhase('quiz');
        } catch (err) {
            toast.error('تعذر جلب السؤال الإضافي. سنكتفي بنقاط اللغز الأساسية!');
            onComplete(totalScore, true);
        }
    };

    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (phase === 'quiz' && timeLeft > 0 && selectedAnswer === null) {
            timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (phase === 'quiz' && timeLeft === 0 && selectedAnswer === null) {
            handleQuizAnswer(-1); // Time out
        }
        return () => clearInterval(timer);
    }, [phase, timeLeft, selectedAnswer]);

    const handleQuizAnswer = (idx: number) => {
        if (selectedAnswer !== null) return;
        setSelectedAnswer(idx);
        
        const isCorrect = idx === quizQuestion.correct_index;
        
        if (isCorrect) {
            playSound('win');
            confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 } });
            setTotalScore(prev => prev + selectedBonus!.points);
            toast.success(`إجابة صحيحة! +${selectedBonus!.points} نقطة`);
        } else {
            playSound('lose');
            toast.error('إجابة خاطئة!');
        }

        setPhase('summary');
    };

    const isEn = getEffectiveLanguage() === 'en';

    // ─── UIs ─────────────────────────────────────────────────────────────────

    if (phase === 'setup') {
        return (
            <div className="text-center py-8 px-4 animate-in zoom-in-95">
                <div className="w-24 h-24 bg-gradient-to-br from-amber-500 to-orange-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <Flame className="w-12 h-12 text-white animate-pulse" />
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">{isEn ? 'Move The Match 🔥' : 'حرك عود ثقاب! 🔥'}</h3>
                <p className="text-sm font-bold text-gray-500 mb-8 max-w-sm mx-auto">
                    {isEn ? 'Move ONE matchstick to make the equation correct. Earn base points, then double them with a bonus question!' : 'حرك عود ثقاب واحد فقط لتصبح المعادلة صحيحة. اضمن نقاط اللغز ثم ضاعفها بسؤال الذكاء الاصطناعي!'}
                </p>
                <div className="flex justify-center gap-3 mb-6">
                    <button onClick={cycleLanguage} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-black border border-amber-200">
                        <Globe className="w-4 h-4" /> {getLanguageDisplay()}
                    </button>
                    <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-xl hover:bg-gray-100 bg-gray-50 border border-gray-200">
                        {soundEnabled ? <Volume2 className="w-5 h-5 text-gray-600" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
                    </button>
                </div>
                <button onClick={startGame} disabled={starting} className="w-full max-w-sm mx-auto bg-gradient-to-r from-amber-500 to-orange-700 text-white px-8 py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 block">
                    {starting ? (isEn ? 'Starting...' : 'جاري البدء...') : (isEn ? '🔥 Start Challenge' : '🔥 ابدأ التحدي الآن')}
                </button>
            </div>
        );
    }

    if (phase === 'choose_difficulty') {
        return (
            <div className="text-center py-10 animate-in slide-in-from-bottom" dir={isEn ? 'ltr' : 'rtl'}>
                <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <BrainCircuit className="w-12 h-12 text-amber-600" />
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">{isEn ? 'Puzzle Solved! 🧠' : 'عبقري! حليت اللغز 🧠'}</h3>
                <p className="text-lg font-bold text-gray-600 mb-8">
                    {isEn ? `You secured ${BASE_POINTS} points. Now choose a bonus question difficulty to double your reward!` : `لقد ضمنت ${BASE_POINTS} نقطة. اختر مستوى صعوبة سؤال إضافي لمضاعفة نقاطك!`}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl mx-auto px-4">
                    {BONUS_LEVELS.map(bonus => (
                        <button key={bonus.id} onClick={() => fetchAIQuestion(bonus)}
                            className="bg-white border-2 border-amber-200 p-5 rounded-2xl hover:bg-amber-50 transition-all hover:scale-105 shadow-md flex flex-col items-center"
                        >
                            <span className="font-black text-lg text-gray-800 mb-1">{isEn ? `Level ${bonus.id}` : `مستوى ${bonus.id}`}</span>
                            <span className="text-amber-600 font-bold bg-amber-100 px-3 py-1 rounded-full text-sm">+{bonus.points} {isEn ? 'Points' : 'نقطة إضافية'}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (phase === 'loading_quiz') {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-amber-600 animate-pulse text-center">
                <Loader2 className="w-16 h-16 mb-4 animate-spin mx-auto" />
                <p className="font-black text-xl">{isEn ? 'Generating AI Challenge...' : 'جاري تجهيز سؤال الذكاء الاصطناعي...'}</p>
            </div>
        );
    }

    if (phase === 'quiz' || phase === 'summary') {
        const isEnglishQ = /^[A-Za-z]/.test(quizQuestion.question_text);
        return (
            <div className="max-w-2xl mx-auto w-full animate-in zoom-in-95 duration-300 py-6">
                {phase === 'summary' && (
                    <div className="text-center mb-8 bg-gray-50 p-6 rounded-3xl border border-gray-200">
                        <h2 className="text-2xl font-black text-gray-800 mb-2">{isEn ? 'Total Points Earned' : 'إجمالي النقاط المكتسبة'}</h2>
                        <span className="text-5xl font-black text-amber-500">{totalScore}</span>
                        <button onClick={() => onComplete(totalScore, true)} className="block w-full mt-6 bg-gray-800 text-white py-4 rounded-xl font-bold hover:bg-gray-900 transition-all">
                            {isEn ? 'Collect Points & Finish' : 'إنهاء وجمع النقاط'} <ArrowRight className="inline w-5 h-5 ml-2" />
                        </button>
                    </div>
                )}

                <div className="flex justify-between items-center mb-6 px-4">
                    <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl font-black text-sm flex items-center gap-2 border border-amber-200">
                        <Star className="w-4 h-4"/> {isEn ? 'Bonus' : 'مكافأة'}: +{selectedBonus?.points}
                    </div>
                    {phase === 'quiz' && (
                        <div className={`px-4 py-2 rounded-xl font-black flex items-center gap-2 ${timeLeft <= 5 ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-700'}`}>
                            <Clock className="w-4 h-4" /> {timeLeft}s
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-xl border-t-8 border-amber-500">
                    <h3 className={`text-lg md:text-2xl font-black text-gray-800 leading-relaxed mb-6 ${isEnglishQ ? 'text-left' : 'text-right'}`} dir={isEnglishQ ? 'ltr' : 'rtl'}>
                        {quizQuestion.question_text}
                    </h3>

                    <div className="grid grid-cols-1 gap-3" dir={isEnglishQ ? 'ltr' : 'rtl'}>
                        {quizQuestion.options.map((option: string, idx: number) => {
                            let btnClass = 'bg-white border-2 border-gray-100 text-gray-700 hover:border-amber-400 hover:bg-amber-50';
                            if (phase === 'summary') {
                                if (idx === quizQuestion.correct_index) btnClass = 'bg-emerald-500 border-emerald-600 text-white shadow-lg';
                                else if (idx === selectedAnswer) btnClass = 'bg-red-500 border-red-600 text-white shadow-lg';
                                else btnClass = 'bg-gray-50 border-gray-100 text-gray-400 opacity-50';
                            }
                            return (
                                <button key={idx} onClick={() => handleQuizAnswer(idx)} disabled={phase === 'summary'}
                                    className={`${btnClass} p-4 rounded-2xl font-bold text-sm md:text-lg transition-all flex items-center justify-between ${isEnglishQ ? 'text-left' : 'text-right'}`}
                                >
                                    <span className="flex-1 leading-snug">{option}</span>
                                    {phase === 'summary' && idx === quizQuestion.correct_index && <CheckCircle className="w-5 h-5 flex-shrink-0 ml-2"/>}
                                    {phase === 'summary' && idx === selectedAnswer && idx !== quizQuestion.correct_index && <XCircle className="w-5 h-5 flex-shrink-0 ml-2"/>}
                                </button>
                            );
                        })}
                    </div>

                    {phase === 'summary' && quizQuestion.explanation && (
                        <div className="mt-6 p-4 rounded-xl text-sm font-bold bg-blue-50 text-blue-800 border border-blue-200" dir={isEnglishQ ? 'ltr' : 'rtl'}>
                            <span className="block mb-1 opacity-70">📚 {isEnglishQ ? 'Explanation:' : 'المراجعة التعليمية:'}</span>
                            {quizQuestion.explanation}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ─── Matchstick Playing Phase ────────────────────────────────────────────
    if (!puzzle) return null;
    const { tokens, totalW } = buildLayout(puzzle.eq);
    const SVG_W = Math.max(totalW, 300);
    const SVG_H = 138;
    const dragOrig = dragging ? origSticks.find(s => s.id === dragging) : null;

    return (
        <div className="max-w-lg mx-auto py-4 px-2 space-y-4 select-none animate-in fade-in" dir={isEn ? 'ltr' : 'rtl'}>
            <div className="flex justify-between items-center px-2">
                <div className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-xl font-black text-xs border border-amber-200">
                    {isEn ? 'Base Points' : 'النقاط الأساسية'}: +{BASE_POINTS}
                </div>
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-sm border shadow-sm ${timeLeft <= 15 ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-white text-gray-700 border-gray-200'}`}>
                    <Timer className="w-4 h-4" /> {timeLeft}s
                </div>
            </div>

            <div className="rounded-[2rem] overflow-hidden shadow-2xl border-4 border-amber-500 bg-amber-50 relative" style={{ touchAction: 'none', backgroundColor: '#fef3c7' }}>
                <svg ref={svgRef} viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none' }}
                    onPointerMove={onPMove} onPointerUp={onPUp} onPointerCancel={onPUp}>
                    <rect width={SVG_W} height={SVG_H} fill="#fef3c7" rx="24" />

                    {/* Guides */}
                    {tokens.map((tok, ti) => {
                        if (tok.type === 'eq') return null;
                        const slots = tok.type === 'digit' ? digitSlots(tok.ox, tok.oy) : opSlots(tok.ox, tok.oy);
                        return slots.map((sl, si) => {
                            const id = `t${ti}_s${si}`;
                            const isSnap = snapTarget === id;
                            if (sticks.find(s => s.id === id && s.active)) return null;
                            return <line key={id} x1={sl.x1} y1={sl.y1} x2={sl.x2} y2={sl.y2} stroke={isSnap ? '#d97706' : '#92400e'} strokeWidth={isSnap ? SW + 2 : SW - 4} strokeLinecap="round" opacity={isSnap ? 0.85 : 0.16} strokeDasharray={isSnap ? 'none' : '6,5'} />;
                        });
                    })}

                    {/* = sign */}
                    {tokens.filter(t => t.type === 'eq').map((tok, i) =>
                        eqSlots(tok.ox, tok.oy).map((sl, si) => (
                            <g key={`eq${i}${si}`}>
                                <line x1={sl.x1 + 2} y1={sl.y1 + 2} x2={sl.x2 + 2} y2={sl.y2 + 2} stroke="#292524" strokeWidth={SW + 3} strokeLinecap="round" opacity={0.2} />
                                <line x1={sl.x1} y1={sl.y1} x2={sl.x2} y2={sl.y2} stroke={STICK_BODY} strokeWidth={SW + 1} strokeLinecap="round" />
                                <line x1={sl.x1} y1={sl.y1} x2={sl.x2} y2={sl.y2} stroke={STICK_HI} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
                            </g>
                        ))
                    )}

                    {/* Active sticks */}
                    {sticks.filter(s => s.active).map(s => (
                        <g key={s.id} onPointerDown={e => onPDown(e, s.id)} style={{ cursor: s.draggable && phase === 'playing' ? 'grab' : 'default' }}>
                            <line x1={s.x1 + 2.5} y1={s.y1 + 2.5} x2={s.x2 + 2.5} y2={s.y2 + 2.5} stroke="#292524" strokeWidth={SW + 4} strokeLinecap="round" opacity={0.18} />
                            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={answered ? (isCorrect ? '#15803d' : '#dc2626') : STICK_BODY} strokeWidth={SW + 2} strokeLinecap="round" />
                            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={answered ? (isCorrect ? '#4ade80' : '#fca5a5') : STICK_HI} strokeWidth={3.5} strokeLinecap="round" opacity={0.5} />
                            {s.draggable && phase === 'playing' && (
                                <><circle cx={s.x1} cy={s.y1} r={6.5} fill={TIP_COL} /><circle cx={s.x1} cy={s.y1} r={3} fill={TIP_IN} /></>
                            )}
                        </g>
                    ))}

                    {/* Floating dragged stick */}
                    {dragging && dragPos && dragOrig && (() => {
                        const isH = Math.abs(dragOrig.x2 - dragOrig.x1) > Math.abs(dragOrig.y2 - dragOrig.y1);
                        const hl = isH ? (dragOrig.x2 - dragOrig.x1) / 2 : 0;
                        const vl = !isH ? (dragOrig.y2 - dragOrig.y1) / 2 : 0;
                        const x1 = dragPos.x - hl, y1 = dragPos.y - vl, x2 = dragPos.x + hl, y2 = dragPos.y + vl;
                        return (
                            <g style={{ pointerEvents: 'none' }}>
                                <line x1={x1 + 2} y1={y1 + 2} x2={x2 + 2} y2={y2 + 2} stroke="#292524" strokeWidth={SW + 6} strokeLinecap="round" opacity={0.2} />
                                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={STICK_DRAG} strokeWidth={SW + 4} strokeLinecap="round" />
                                <circle cx={x1} cy={y1} r={7} fill={TIP_COL} />
                                <circle cx={x1} cy={y1} r={3} fill={TIP_IN} />
                            </g>
                        );
                    })()}
                </svg>
            </div>

            {answered && (
                <div className={`rounded-2xl p-3 text-center font-black text-sm border-2 shadow-sm ${isCorrect ? 'bg-emerald-50 text-emerald-900 border-emerald-400' : 'bg-red-50 text-red-800 border-red-400'}`}>
                    {isCorrect
                        ? <><CheckCircle className="inline w-5 h-5 mx-2" />{isEn ? 'Correct! Preparing Bonus...' : 'صحيح! جاري تجهيز المكافأة...'}</>
                        : <><XCircle className="inline w-5 h-5 mx-2" />{isEn ? 'Correct answer: ' : 'الإجابة الصحيحة: '}<span className="font-mono bg-white px-2 py-1 rounded border ml-2">{puzzle.sol}</span></>}
                </div>
            )}

            {!answered && (
                <button onClick={reset} className="w-full flex items-center justify-center gap-2 py-4 bg-white text-gray-700 rounded-2xl font-black text-sm hover:bg-gray-50 active:scale-95 transition-all border-2 border-gray-200 shadow-sm">
                    <RotateCcw className="w-5 h-5" /> {isEn ? 'Reset Matches' : 'إعادة الوضع الأصلي'}
                </button>
            )}
        </div>
    );
}
