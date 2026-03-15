import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Trophy, Users, Timer, CheckCircle, BrainCircuit } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const BOTTLE_COUNT  = 5;
const ROUND_SECS    = 60;
const MAX_ATTEMPTS  = 8;
const REWARD_SECS   = 20;

// ─── Vivid contrasting colors (5 only) ───────────────────────────────────────
const COLORS = [
    { id: 'red',    label: 'أحمر',   bg: '#ef4444', light: '#fca5a5', dark: '#991b1b', glow: '#fbbf24' },
    { id: 'blue',   label: 'أزرق',   bg: '#3b82f6', light: '#93c5fd', dark: '#1e3a8a', glow: '#60a5fa' },
    { id: 'green',  label: 'أخضر',   bg: '#22c55e', light: '#86efac', dark: '#14532d', glow: '#4ade80' },
    { id: 'yellow', label: 'أصفر',   bg: '#eab308', light: '#fde047', dark: '#713f12', glow: '#fbbf24' },
    { id: 'purple', label: 'بنفسجي', bg: '#a855f7', light: '#d8b4fe', dark: '#4c1d95', glow: '#c084fc' },
];

type ColorId = typeof COLORS[number]['id'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function makeSecret(): ColorId[] {
    return shuffle(COLORS.map(c => c.id)) as ColorId[];
}

function makeScrambled(secret: ColorId[]): ColorId[] {
    // Guarantee it's different from secret
    let s = shuffle([...secret]) as ColorId[];
    while (s.every((c, i) => c === secret[i])) s = shuffle([...secret]) as ColorId[];
    return s;
}

function countCorrect(attempt: ColorId[], secret: ColorId[]): number {
    return attempt.filter((c, i) => c === secret[i]).length;
}

// ─── Question helpers (same pattern as other games) ──────────────────────────
const normalizeQuestion = (rawQ: any) => {
    let questionText = rawQ.question || rawQ.question_text || '';
    if (rawQ.scenario) questionText = `${rawQ.scenario} - ${questionText}`;
    let opts: string[] = [];
    let correctAns = '';
    if (rawQ.source === 'standard_quiz') {
        try {
            let parsed = rawQ.options;
            if (typeof parsed === 'string') {
                if (parsed.startsWith('"')) parsed = JSON.parse(parsed);
                if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            }
            opts = Array.isArray(parsed) ? parsed : [];
        } catch { opts = []; }
        correctAns = rawQ.correct_answer;
    } else {
        opts = [rawQ.option_a, rawQ.option_b, rawQ.option_c, rawQ.option_d]
            .filter(o => o && String(o).trim() !== '' && o !== 'null');
        if (rawQ.correct_index !== undefined && rawQ.correct_index !== null)
            correctAns = opts[rawQ.correct_index];
        else {
            const letter = String(rawQ.correct_option || rawQ.correct_answer || '').trim().toLowerCase();
            correctAns = ['a','b','c','d'].includes(letter) ? rawQ[`option_${letter}`] : letter;
        }
    }
    if (!correctAns || opts.length < 2) return null;
    return { id: rawQ.id, questionText, options: opts, correctAnswer: String(correctAns).trim().toLowerCase() };
};

const fetchQuestion = async (employee: Employee) => {
    const spec = employee.specialty || '';
    const s = spec.toLowerCase();
    let vars = [spec, 'الكل'];
    if (s.includes('بشر') || s.includes('عام')) vars = ['بشري', 'طبيب بشرى', 'طبيب عام'];
    else if (s.includes('سنان') || s.includes('أسنان')) vars = ['أسنان', 'اسنان', 'طبيب أسنان'];
    else if (s.includes('تمريض') || s.includes('ممرض')) vars = ['تمريض', 'ممرض', 'ممرضة'];
    else if (s.includes('صيدل')) vars = ['صيدلة', 'صيدلي'];
    else if (s.includes('معمل') || s.includes('مختبر')) vars = ['معمل', 'فني معمل'];
    const orFilter = vars.map(v => `specialty.ilike.%${v}%`).join(',');
    let pool: any[] = [];
    const [r1, r2, r3] = await Promise.all([
        supabase.from('arcade_quiz_questions').select('*').or(orFilter),
        supabase.from('arcade_dose_scenarios').select('*').or(orFilter),
        supabase.from('quiz_questions').select('*').or(orFilter),
    ]);
    if (r1.data) pool.push(...r1.data.map((q: any) => ({ ...q, source: 'arcade_quiz' })));
    if (r2.data) pool.push(...r2.data.map((q: any) => ({ ...q, source: 'arcade_dose' })));
    if (r3.data) pool.push(...r3.data.map((q: any) => ({ ...q, source: 'standard_quiz' })));
    if (pool.length === 0) {
        const { data } = await supabase.from('arcade_quiz_questions').select('*').limit(30);
        if (data) pool = data.map((q: any) => ({ ...q, source: 'arcade_quiz' }));
    }
    for (let i = 0; i < 8; i++) {
        const n = normalizeQuestion(pool[Math.floor(Math.random() * pool.length)]);
        if (n) return n;
    }
    return null;
};

// ─── Sound ────────────────────────────────────────────────────────────────────
function useSound() {
    const ctx = useRef<AudioContext | null>(null);
    const get = () => {
        if (!ctx.current) ctx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return ctx.current;
    };
    return useCallback((type: 'swap' | 'correct' | 'wrong' | 'win' | 'tick' | 'perfect') => {
        try {
            const ac = get(), now = ac.currentTime;
            if (type === 'swap') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.setValueAtTime(500, now);
                o.frequency.exponentialRampToValueAtTime(350, now + 0.08);
                g.gain.setValueAtTime(0.12, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                o.start(now); o.stop(now + 0.1);
            }
            if (type === 'correct') {
                [523, 659].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'sine'; o.frequency.value = f;
                    const t = now + i * 0.1;
                    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
                    o.start(t); o.stop(t + 0.14);
                });
            }
            if (type === 'perfect') {
                [523, 659, 784, 1047].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'triangle'; o.frequency.value = f;
                    const t = now + i * 0.11;
                    g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
                    o.start(t); o.stop(t + 0.3);
                });
            }
            if (type === 'win') {
                [523, 659, 784, 1047, 1319].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'triangle'; o.frequency.value = f;
                    const t = now + i * 0.1;
                    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
                    o.start(t); o.stop(t + 0.28);
                });
            }
            if (type === 'wrong') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sawtooth'; o.frequency.value = 160;
                g.gain.setValueAtTime(0.18, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                o.start(now); o.stop(now + 0.18);
            }
            if (type === 'tick') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.value = 880;
                g.gain.setValueAtTime(0.08, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                o.start(now); o.stop(now + 0.06);
            }
        } catch (_) {}
    }, []);
}

// ─── Bottle SVG ───────────────────────────────────────────────────────────────
function Bottle({ colorId, selected, index, onClick, shake }: {
    colorId: ColorId; selected: boolean; index: number;
    onClick: () => void; shake: boolean;
}) {
    const color = COLORS.find(c => c.id === colorId)!;
    return (
        <button
            onClick={onClick}
            className={`relative flex flex-col items-center gap-1 transition-all duration-200 select-none
                ${selected ? 'scale-110 -translate-y-2' : 'hover:scale-105 hover:-translate-y-1'}
                ${shake ? 'animate-[wiggle_0.3s_ease-in-out]' : ''}
                active:scale-95
            `}
            style={{ animationDelay: `${index * 0.05}s` }}
        >
            {/* Selection ring */}
            {selected && (
                <div className="absolute -inset-2 rounded-2xl border-3 border-dashed border-white/80 animate-pulse"
                    style={{ borderWidth: 3 }}/>
            )}
            {/* Bottle SVG */}
            <svg viewBox="0 0 44 90" className="w-10 h-20 drop-shadow-lg" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id={`fill-${colorId}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor={color.dark}/>
                        <stop offset="35%"  stopColor={color.bg}/>
                        <stop offset="65%"  stopColor={color.light}/>
                        <stop offset="100%" stopColor={color.bg}/>
                    </linearGradient>
                    <linearGradient id={`glass-${colorId}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor={color.dark} stopOpacity="0.7"/>
                        <stop offset="40%"  stopColor={color.bg}   stopOpacity="0.85"/>
                        <stop offset="70%"  stopColor={color.light} stopOpacity="0.5"/>
                        <stop offset="100%" stopColor={color.bg}   stopOpacity="0.7"/>
                    </linearGradient>
                    {selected && (
                        <filter id={`glow-${colorId}`}>
                            <feGaussianBlur stdDeviation="3" result="blur"/>
                            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                        </filter>
                    )}
                </defs>

                {/* Bottle neck */}
                <rect x="15" y="4" width="14" height="18" rx="3"
                    fill={`url(#fill-${colorId})`} stroke={color.dark} strokeWidth="1.2"/>
                {/* Cap */}
                <rect x="13" y="1" width="18" height="7" rx="3"
                    fill={color.dark} stroke={color.dark} strokeWidth="0.8"/>
                {/* Bottle body */}
                <path d="M8 22 Q6 26 6 32 L6 76 Q6 84 14 84 L30 84 Q38 84 38 76 L38 32 Q38 26 36 22 Z"
                    fill={`url(#glass-${colorId})`}
                    stroke={color.dark} strokeWidth="1.2"
                    filter={selected ? `url(#glow-${colorId})` : undefined}/>
                {/* Liquid fill */}
                <clipPath id={`clip-${colorId}-${index}`}>
                    <path d="M8 22 Q6 26 6 32 L6 76 Q6 84 14 84 L30 84 Q38 84 38 76 L38 32 Q38 26 36 22 Z"/>
                </clipPath>
                <rect x="6" y="35" width="32" height="49"
                    fill={`url(#fill-${colorId})`} opacity="0.9"
                    clipPath={`url(#clip-${colorId}-${index})`}/>
                {/* Shine */}
                <ellipse cx="15" cy="45" rx="3" ry="12" fill="white" opacity="0.25"/>
                <ellipse cx="14" cy="31" rx="2" ry="4" fill="white" opacity="0.35"/>
            </svg>

            {/* Color label */}
            <span className="text-[9px] font-black text-white/80 tracking-tight">
                {color.label}
            </span>
        </button>
    );
}

// ─── Attempt History Row ──────────────────────────────────────────────────────
function AttemptRow({ attempt, secret, num }: { attempt: ColorId[]; secret: ColorId[]; num: number }) {
    const correct = countCorrect(attempt, secret);
    return (
        <div className="flex items-center gap-2 bg-white/10 rounded-xl px-2 py-1.5">
            <span className="text-[10px] font-black text-white/60 w-4">{num}</span>
            <div className="flex gap-1 flex-1">
                {attempt.map((cid, i) => {
                    const color = COLORS.find(c => c.id === cid)!;
                    const isCorrect = cid === secret[i];
                    return (
                        <div key={i} className={`w-5 h-5 rounded-full border-2 ${isCorrect ? 'border-green-300 scale-110' : 'border-white/20'}`}
                            style={{ background: color.bg }}/>
                    );
                })}
            </div>
            <div className={`text-xs font-black px-2 py-0.5 rounded-full ${
                correct === BOTTLE_COUNT ? 'bg-green-400 text-white' :
                correct >= 4 ? 'bg-yellow-400 text-gray-900' :
                'bg-white/20 text-white'
            }`}>
                {correct}/{BOTTLE_COUNT}
            </div>
        </div>
    );
}

// ─── Question Screen ──────────────────────────────────────────────────────────
function QuestionScreen({ question, onAnswer, timeLeft, answered, isCorrect, loading }: {
    question: any; onAnswer: (opt: string) => void;
    timeLeft: number; answered: boolean; isCorrect: boolean | null; loading: boolean;
}) {
    return (
        <div className="bg-white rounded-2xl border-2 border-indigo-200 p-4 space-y-3 shadow-xl animate-in zoom-in duration-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-indigo-600"/>
                    <span className="text-xs font-black text-indigo-700">سؤال المكافأة 🎯</span>
                </div>
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-black text-xs border-2 ${
                    timeLeft <= 5 ? 'bg-red-100 border-red-400 text-red-700 animate-pulse' :
                    'bg-indigo-50 border-indigo-300 text-indigo-700'
                }`}>
                    <Timer className="w-3 h-3"/> {timeLeft}ث
                </div>
            </div>
            <p className="text-sm font-bold text-gray-800 leading-relaxed">{question.questionText}</p>
            {!answered ? (
                <div className="space-y-2">
                    {question.options.map((opt: string, i: number) => (
                        <button key={i} onClick={() => onAnswer(opt)} disabled={loading}
                            className="w-full bg-white border-2 border-gray-100 p-3 rounded-xl font-bold text-gray-700 hover:border-indigo-400 hover:bg-indigo-50 active:scale-95 transition-all text-sm text-right">
                            {opt}
                        </button>
                    ))}
                </div>
            ) : (
                <div className={`text-center py-3 rounded-xl font-black text-sm ${
                    isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
                }`}>
                    {isCorrect ? '✅ إجابة صحيحة! +15 نقطة 🎉' : '❌ إجابة خاطئة — حظ أوفر'}
                </div>
            )}
        </div>
    );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
    match:       any;
    employee:    Employee;
    onExit:      () => void;
    grantPoints: (pts: number) => Promise<void>;
}

// ─── Player state in game ─────────────────────────────────────────────────────
interface PlayerGS {
    id:         string;
    name:       string;
    order:      ColorId[];     // current arrangement
    attempts:   ColorId[][];   // history of checked attempts
    solved:     boolean;
    eliminated: boolean;       // used all attempts without solving
    solvedAt:   number | null;
}

interface BottleGS {
    secret:    ColorId[];
    players:   PlayerGS[];
    startedAt: number;
    winnerId:  string | null;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BottleMatchGame({ match, employee, onExit, grantPoints }: Props) {
    const play   = useSound();
    const myId   = employee.employee_id;
    const isHost = match.players?.[0]?.id === myId;

    const gs: BottleGS      = match.game_state ?? {};
    const secret: ColorId[] = gs.secret ?? [];
    const players: PlayerGS[] = gs.players ?? [];
    const status: string    = match.status ?? 'waiting';

    const myPS = players.find(p => p.id === myId);
    const myOrder: ColorId[]      = myPS?.order      ?? [];
    const myAttempts: ColorId[][] = myPS?.attempts   ?? [];
    const mySolved     = myPS?.solved     ?? false;
    const myEliminated = myPS?.eliminated ?? false;
    const attemptsLeft = MAX_ATTEMPTS - myAttempts.length;

    // ── Local UI state ────────────────────────────────────────────────────────
    const [selected, setSelected]     = useState<number | null>(null);
    const [shakeIdx, setShakeIdx]     = useState<number | null>(null);
    const [timeLeft, setTimeLeft]     = useState(ROUND_SECS);
    const [checking, setChecking]     = useState(false);
    const [lastResult, setLastResult] = useState<number | null>(null);
    // localOrder: instant UI update — synced from DB on mount/change
    const [localOrder, setLocalOrder] = useState<ColorId[]>([]);

    // Sync localOrder when DB order changes (on join or new game)
    useEffect(() => {
        if (myPS?.order && myPS.order.length > 0) {
            setLocalOrder(myPS.order);
        }
    }, [myPS?.order?.join(','), status]);

    // Reset lastResult when new game starts
    useEffect(() => {
        if (status === 'playing') setLastResult(null);
    }, [gs.startedAt]);

    // Reward question state
    const [question, setQuestion]   = useState<any>(null);
    const [qTime, setQTime]         = useState(REWARD_SECS);
    const [qAnswered, setQAnswered] = useState(false);
    const [qCorrect, setQCorrect]   = useState<boolean | null>(null);
    const [qLoading, setQLoading]   = useState(false);
    const amIWinner = match.winner_id === myId;
    const rewardDoneRef = useRef(false);

    const prevTickRef = useRef(ROUND_SECS);

    // ── Timer ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'playing' || !gs.startedAt) return;
        const tick = () => {
            const left = Math.max(0, ROUND_SECS - Math.floor((Date.now() - gs.startedAt) / 1000));
            setTimeLeft(left);
            if ([20, 10, 5, 4, 3, 2, 1].includes(left) && left !== prevTickRef.current) {
                prevTickRef.current = left;
                play('tick');
            }
            if (left === 0 && isHost && status === 'playing') {
                // Time's up → find winner by most correct in last attempt
                const best = [...players].sort((a, b) => {
                    const aLast = a.attempts.at(-1) ?? [];
                    const bLast = b.attempts.at(-1) ?? [];
                    return countCorrect(bLast, secret) - countCorrect(aLast, secret);
                });
                supabase.from('live_matches').update({
                    status: 'reward_time',
                    winner_id: best[0]?.id ?? null,
                    game_state: { ...gs, winnerId: best[0]?.id ?? null },
                }).eq('id', match.id);
            }
        };
        tick();
        const iv = setInterval(tick, 500);
        return () => clearInterval(iv);
    }, [status, gs.startedAt]);

    // ── Fetch reward question for winner ──────────────────────────────────────
    useEffect(() => {
        if (status !== 'reward_time' || !amIWinner || rewardDoneRef.current) return;
        rewardDoneRef.current = true;
        play('win');
        setQLoading(true);
        fetchQuestion(employee).then(q => {
            setQLoading(false);
            if (q) { setQuestion(q); setQTime(REWARD_SECS); }
            else {
                grantPoints(15).then(() => toast.success('فزت! +15 نقطة 🏆'));
                setQAnswered(true);
                supabase.from('live_matches').update({ status: 'finished' }).eq('id', match.id);
            }
        });
    }, [status, amIWinner]);

    // ── Question timer ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!question || qAnswered) return;
        if (qTime <= 0) { handleQAnswer('__timeout__'); return; }
        const iv = setInterval(() => setQTime(p => p - 1), 1000);
        return () => clearInterval(iv);
    }, [question, qTime, qAnswered]);

    // ── Handle answer ─────────────────────────────────────────────────────────
    const handleQAnswer = async (ans: string) => {
        if (qAnswered) return;
        setQAnswered(true); setQTime(0);
        const correct = question?.correctAnswer ?? '';
        const sel = ans.trim().toLowerCase();
        const ok = ans !== '__timeout__' && (correct === sel || correct.includes(sel) || sel.includes(correct));
        setQCorrect(ok);
        play(ok ? 'win' : 'wrong');
        if (ok) await grantPoints(15);
        else toast.error('إجابة خاطئة — حظ أوفر 😅');
        await supabase.from('live_matches').update({ status: 'finished' }).eq('id', match.id);
    };

    // ── Swap two bottles ──────────────────────────────────────────────────────
    const handleBottleClick = (idx: number) => {
        if (mySolved || status !== 'playing') return;
        if (selected === null) { setSelected(idx); return; }
        if (selected === idx)  { setSelected(null); return; }
        const newOrder = [...localOrder];
        [newOrder[selected], newOrder[idx]] = [newOrder[idx], newOrder[selected]];
        play('swap');
        setSelected(null);
        setLocalOrder(newOrder);   // instant UI
        updateMyOrder(newOrder);   // async DB
    };

    const updateMyOrder = async (newOrder: ColorId[]) => {
        const updatedPlayers = players.map(p =>
            p.id === myId ? { ...p, order: newOrder } : p
        );
        await supabase.from('live_matches').update({
            game_state: { ...gs, players: updatedPlayers },
        }).eq('id', match.id);
    };

    // ── Check attempt ─────────────────────────────────────────────────────────
    const handleCheck = async () => {
        if (checking || mySolved || myEliminated || status !== 'playing') return;
        setChecking(true);
        const correct = countCorrect(localOrder, secret);
        setLastResult(correct);
        const newAttempts = [...myAttempts, [...localOrder]];
        const isLastAttempt = newAttempts.length >= MAX_ATTEMPTS;

        if (correct === BOTTLE_COUNT) {
            // Solved!
            play('perfect');
            const updatedPlayers = players.map(p =>
                p.id === myId
                    ? { ...p, attempts: newAttempts, solved: true, eliminated: false, solvedAt: Date.now() }
                    : p
            );
            const firstSolver = !gs.winnerId;
            const winnerId = firstSolver ? myId : gs.winnerId;
            const allDone = updatedPlayers.every(p => p.solved || p.eliminated);
            await supabase.from('live_matches').update({
                status: firstSolver ? 'reward_time' : allDone ? 'reward_time' : 'playing',
                winner_id: winnerId,
                game_state: { ...gs, players: updatedPlayers, winnerId },
            }).eq('id', match.id);
        } else if (isLastAttempt) {
            // Used all attempts without solving → eliminated
            play('wrong');
            const updatedPlayers = players.map(p =>
                p.id === myId
                    ? { ...p, attempts: newAttempts, eliminated: true }
                    : p
            );
            // Check if all done (solved or eliminated)
            const allDone = updatedPlayers.every(p => p.solved || p.eliminated);
            let winnerId = gs.winnerId;
            let newStatus = 'playing';
            if (allDone && !winnerId) {
                // Nobody solved → winner is best score in last attempt
                const best = [...updatedPlayers]
                    .filter(p => !p.eliminated)
                    .sort((a, b) => (a.solvedAt ?? 0) - (b.solvedAt ?? 0));
                winnerId = best[0]?.id ?? null;
                newStatus = 'reward_time';
            } else if (allDone) {
                newStatus = 'reward_time';
            }
            await supabase.from('live_matches').update({
                status: newStatus,
                winner_id: winnerId,
                game_state: { ...gs, players: updatedPlayers, winnerId },
            }).eq('id', match.id);
        } else {
            // Normal wrong attempt
            play(correct > 0 ? 'correct' : 'wrong');
            const updatedPlayers = players.map(p =>
                p.id === myId ? { ...p, attempts: newAttempts } : p
            );
            await supabase.from('live_matches').update({
                game_state: { ...gs, players: updatedPlayers },
            }).eq('id', match.id);
            // Shake wrong bottles
            localOrder.forEach((cid, i) => {
                if (cid !== secret[i]) {
                    setTimeout(() => setShakeIdx(i), i * 60);
                    setTimeout(() => setShakeIdx(null), i * 60 + 350);
                }
            });
        }
        setChecking(false);
    };

    // ── Host starts ───────────────────────────────────────────────────────────
    const handleStart = async () => {
        const secretOrder = makeSecret();
        const matchPlayers: PlayerGS[] = match.players.map((p: any) => ({
            id: p.id, name: p.name,
            order:      makeScrambled(secretOrder),
            attempts:   [],
            solved:     false,
            eliminated: false,
            solvedAt:   null,
        }));
        await supabase.from('live_matches').update({
            status: 'playing',
            game_state: {
                secret:    secretOrder,
                players:   matchPlayers,
                startedAt: Date.now(),
                winnerId:  null,
            },
        }).eq('id', match.id);
    };

    const timerPct  = timeLeft / ROUND_SECS;
    const timerColor = timerPct < 0.25 ? '#ef4444' : timerPct < 0.5 ? '#f97316' : '#22c55e';

    // ── Sorted players ────────────────────────────────────────────────────────
    const sortedPlayers = useMemo(() => [...players].sort((a, b) => {
        if (a.solved && !b.solved) return -1;
        if (!a.solved && b.solved) return 1;
        if (a.solved && b.solved) return (a.solvedAt ?? 0) - (b.solvedAt ?? 0);
        if (a.eliminated && !b.eliminated) return 1;
        if (!a.eliminated && b.eliminated) return -1;
        const aScore = countCorrect(a.attempts.at(-1) ?? [], secret);
        const bScore = countCorrect(b.attempts.at(-1) ?? [], secret);
        return bScore - aScore;
    }), [players, secret]);

    // ─────────────────────────────────────────────────────────────────────────
    // WAITING
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className="text-center py-8 px-4" dir="rtl">
            <div className="flex justify-center gap-1.5 mb-5">
                {COLORS.map((c, i) => (
                    <div key={c.id} className="w-7 h-14 rounded-full shadow-lg border-2 border-white/30"
                        style={{ background: c.bg, animationDelay: `${i*0.1}s` }}/>
                ))}
            </div>
            <h3 className="text-xl font-black text-gray-800 mb-1">ترتيب الزجاجات 🍾</h3>
            <p className="text-sm font-bold text-gray-400 mb-2">{match.players?.length ?? 0} لاعب في الغرفة</p>
            <p className="text-xs text-gray-400 mb-5">رتّب الزجاجات الملونة كما في الترتيب السري خلال {ROUND_SECS} ثانية!</p>
            <div className="flex flex-wrap gap-2 justify-center mb-6">
                {match.players?.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full">
                        <span className="text-xs font-bold text-indigo-700">{p.name}</span>
                        {p.id === myId && <span className="text-[10px] text-indigo-400">(أنت)</span>}
                    </div>
                ))}
            </div>
            {isHost ? (
                <div className="flex flex-col items-center gap-2">
                    <button onClick={handleStart}
                        disabled={match.players?.length < 2}
                        className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                        🎮 ابدأ اللعبة
                    </button>
                    {match.players?.length < 2 && (
                        <p className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                            ⏳ في انتظار لاعب آخر للانضمام...
                        </p>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 justify-center text-sm font-bold text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin"/> في انتظار المضيف...
                </div>
            )}
            <button onClick={onExit} className="mt-4 text-sm font-bold text-gray-400 hover:text-gray-600 block mx-auto">
                ← العودة
            </button>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // PLAYING
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'playing') return (
        <div className="flex flex-col gap-3 py-2 px-3" dir="rtl">

            {/* Header */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-3 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0">
                        {/* Attempts dots */}
                        <div className="flex items-center gap-1.5 mb-1">
                            {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                                <div key={i} className={`rounded-full transition-all ${
                                    i < myAttempts.length
                                        ? (myAttempts[i] && countCorrect(myAttempts[i], secret) === BOTTLE_COUNT
                                            ? 'w-3 h-3 bg-green-400'
                                            : 'w-2.5 h-2.5 bg-white/40')
                                        : i === myAttempts.length
                                            ? 'w-3 h-3 bg-yellow-300 animate-pulse'
                                            : 'w-2.5 h-2.5 bg-white/20'
                                }`}/>
                            ))}
                            <span className="text-[10px] font-black text-indigo-200 mr-1">
                                {attemptsLeft} متبقية
                            </span>
                        </div>
                        {lastResult !== null && (
                            <p className={`text-sm font-black ${
                                lastResult === BOTTLE_COUNT ? 'text-green-300' :
                                lastResult >= 4 ? 'text-yellow-300' : 'text-red-300'
                            }`}>
                                {lastResult === BOTTLE_COUNT ? '🎉 مثالي!' :
                                 lastResult > 0 ? `✅ ${lastResult} من ${BOTTLE_COUNT} في مكانها` :
                                 '❌ لا شيء في مكانه'}
                            </p>
                        )}
                    </div>
                    {/* Timer ring */}
                    <div className="relative w-14 h-14 flex-shrink-0">
                        <svg width={56} height={56} viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
                            <circle cx={28} cy={28} r={24} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={4}/>
                            <circle cx={28} cy={28} r={24} fill="none"
                                stroke={timerColor} strokeWidth={4}
                                strokeDasharray={2 * Math.PI * 24}
                                strokeDashoffset={2 * Math.PI * 24 * (1 - timerPct)}
                                strokeLinecap="round"
                                style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.4s' }}/>
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-white">
                            {timeLeft}
                        </span>
                    </div>
                </div>

                {/* Opponents progress */}
                {players.length > 1 && (
                    <div className="flex gap-2 flex-wrap">
                        {sortedPlayers.filter(p => p.id !== myId).map(p => {
                            const lastAttempt = p.attempts.at(-1) ?? [];
                            const score = countCorrect(lastAttempt, secret);
                            return (
                                <div key={p.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                    p.solved     ? 'bg-green-400/30 text-green-200' :
                                    p.eliminated ? 'bg-red-400/30 text-red-300' :
                                    'bg-white/15 text-white/80'
                                }`}>
                                    {p.solved ? '✓' : p.eliminated ? '✗' : `${score}/${BOTTLE_COUNT}`} {p.name}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* My bottles */}
            {!mySolved && !myEliminated ? (
                <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-4 shadow-xl">
                    <p className="text-[10px] font-black text-center mb-3 text-gray-400">
                        {selected !== null
                            ? 'اختر الزجاجة الثانية للتبديل'
                            : 'اضغط زجاجة ثم اضغط الثانية لتبديلهما'}
                    </p>
                    <div className="flex justify-center gap-2 mb-4">
                        {localOrder.map((cid, i) => (
                            <Bottle
                                key={i} colorId={cid} index={i}
                                selected={selected === i}
                                shake={shakeIdx === i}
                                onClick={() => handleBottleClick(i)}
                            />
                        ))}
                    </div>
                    {/* Position numbers — always neutral */}
                    <div className="flex justify-center gap-2 mb-4 px-2">
                        {localOrder.map((_, i) => (
                            <div key={i} className="w-10 text-center text-[10px] font-black text-gray-500">
                                {i + 1}
                            </div>
                        ))}
                    </div>
                    <button onClick={handleCheck} disabled={checking || attemptsLeft <= 0}
                        className={`w-full text-white py-3.5 rounded-xl font-black text-base shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2 ${
                            attemptsLeft === 1
                                ? 'bg-gradient-to-r from-red-500 to-rose-600'
                                : attemptsLeft <= 3
                                    ? 'bg-gradient-to-r from-orange-500 to-amber-500'
                                    : 'bg-gradient-to-r from-indigo-500 to-violet-600'
                        }`}>
                        {checking
                            ? <Loader2 className="w-5 h-5 animate-spin"/>
                            : <><CheckCircle className="w-5 h-5"/>
                                {attemptsLeft === 1 ? '⚠️ آخر محاولة! تحقق' : `تحقق (${attemptsLeft} محاولة متبقية)`}
                              </>}
                    </button>
                </div>
            ) : mySolved ? (
                <div className="bg-green-900/80 rounded-2xl p-4 text-center border-2 border-green-400">
                    <Trophy className="w-10 h-10 text-yellow-300 mx-auto mb-2 animate-bounce"/>
                    <p className="font-black text-white text-lg">رتّبتها! 🎉</p>
                    <p className="text-green-300 text-xs mt-1">في انتظار باقي اللاعبين...</p>
                </div>
            ) : (
                <div className="bg-red-900/80 rounded-2xl p-4 text-center border-2 border-red-400">
                    <p className="text-4xl mb-2">😞</p>
                    <p className="font-black text-white text-lg">انتهت محاولاتك!</p>
                    <p className="text-red-300 text-xs mt-1">استنفدت الـ {MAX_ATTEMPTS} محاولات</p>
                </div>
            )}

            {/* Attempt history */}
            {myAttempts.length > 0 && (
                <div className="bg-gray-800/60 rounded-2xl p-3 space-y-1.5">
                    <p className="text-[10px] font-black text-gray-400 mb-2">سجل المحاولات:</p>
                    {myAttempts.map((att, i) => (
                        <AttemptRow key={i} attempt={att} secret={secret} num={i + 1}/>
                    ))}
                </div>
            )}

            <button onClick={onExit} className="text-xs font-bold text-gray-400 hover:text-gray-600 py-1 text-center">
                ← العودة
            </button>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // REWARD TIME (winner answers question)
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'reward_time') return (
        <div className="flex flex-col gap-3 py-2 px-3" dir="rtl">
            {amIWinner ? (
                <>
                    <div className="bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl p-4 text-center shadow-xl">
                        <Trophy className="w-12 h-12 text-white mx-auto mb-2 animate-bounce drop-shadow-xl"/>
                        <h3 className="text-xl font-black text-white">أنت الفائز! 🎉</h3>
                        <p className="text-yellow-100 text-xs mt-1">أجب على السؤال لتكسب النقاط</p>
                    </div>
                    {/* Reveal secret */}
                    <div className="bg-gray-800 rounded-2xl p-3">
                        <p className="text-[10px] font-black text-gray-400 text-center mb-2">الترتيب السري كان:</p>
                        <div className="flex justify-center gap-2">
                            {secret.map((cid, i) => {
                                const color = COLORS.find(c => c.id === cid)!;
                                return <div key={i} className="w-8 h-16 rounded-full border-2 border-white/20 shadow-lg"
                                    style={{ background: color.bg }}/>;
                            })}
                        </div>
                    </div>
                    {qLoading ? (
                        <div className="text-center py-6">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-2"/>
                            <p className="text-xs font-bold text-gray-400">جاري تحضير السؤال...</p>
                        </div>
                    ) : question && !qAnswered ? (
                        <QuestionScreen question={question} onAnswer={handleQAnswer}
                            timeLeft={qTime} answered={qAnswered} isCorrect={qCorrect} loading={false}/>
                    ) : qAnswered && (
                        <div className={`rounded-xl p-4 text-center font-black ${
                            qCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
                        }`}>
                            {qCorrect ? '✅ أجبت صح! +15 نقطة 🎉' : '❌ إجابة خاطئة — حظ أوفر'}
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-10">
                    <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin"/>
                    </div>
                    <h3 className="text-lg font-black text-gray-800">الفائز يجيب على سؤاله...</h3>
                    <p className="text-sm text-gray-400 mt-1">{players.find(p => p.id === match.winner_id)?.name}</p>
                    {/* Show secret */}
                    <div className="flex justify-center gap-2 mt-6">
                        {secret.map((cid, i) => {
                            const color = COLORS.find(c => c.id === cid)!;
                            return <div key={i} className="w-8 h-16 rounded-full border-2 border-gray-200 shadow"
                                style={{ background: color.bg }}/>;
                        })}
                    </div>
                </div>
            )}
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // FINISHED
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'finished') return (
        <div className="flex flex-col gap-3 py-2 px-3 animate-in fade-in duration-400" dir="rtl">
            <div className={`rounded-2xl p-5 text-center text-white shadow-xl ${
                amIWinner ? 'bg-gradient-to-br from-yellow-400 to-amber-500' : 'bg-gradient-to-br from-gray-600 to-gray-800'
            }`}>
                {amIWinner
                    ? <><Trophy className="w-14 h-14 mx-auto mb-2 animate-bounce"/><h3 className="text-2xl font-black">فزت! 🏆</h3></>
                    : <><div className="text-5xl mb-2">🍾</div><h3 className="text-xl font-black">انتهت اللعبة</h3></>
                }
            </div>
            {/* Secret reveal */}
            <div className="bg-gray-800 rounded-2xl p-4">
                <p className="text-[10px] font-black text-gray-400 text-center mb-3">الترتيب السري كان:</p>
                <div className="flex justify-center gap-3">
                    {secret.map((cid, i) => {
                        const color = COLORS.find(c => c.id === cid)!;
                        return (
                            <div key={i} className="flex flex-col items-center gap-1">
                                <div className="w-9 h-18 rounded-full border-2 border-white/20 shadow-lg"
                                    style={{ background: color.bg, height: 70 }}/>
                                <span className="text-[9px] text-gray-400 font-bold">{i + 1}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
            {/* Rankings */}
            <div className="space-y-2">
                {sortedPlayers.map((p, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
                    const lastScore = countCorrect(p.attempts.at(-1) ?? [], secret);
                    return (
                        <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
                            p.id === myId ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 bg-white'
                        }`}>
                            <span className="text-lg w-8 text-center">{medal}</span>
                            <p className="flex-1 font-black text-sm text-gray-800">{p.name}{p.id === myId && ' (أنت)'}</p>
                            {p.solved
                                ? <span className="text-xs font-black text-green-600 bg-green-100 px-2 py-0.5 rounded-full">✓ حلّها</span>
                                : p.eliminated
                                    ? <span className="text-xs font-black text-red-500 bg-red-100 px-2 py-0.5 rounded-full">✗ انتهت</span>
                                    : <span className="text-xs font-black text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{lastScore}/{BOTTLE_COUNT}</span>
                            }
                        </div>
                    );
                })}
            </div>
            <button onClick={onExit}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-700 text-white py-3.5 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all">
                العودة للصالة
            </button>
        </div>
    );

    return null;
}
