import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Trophy, Users, Timer, BrainCircuit, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const GRID        = 5;
const TOTAL_CARDS = GRID * GRID;  // 25
const PAIRS       = TOTAL_CARDS / 2;  // 12 pairs + 1 wildcard (25 is odd)
const ROUND_SECS  = 180;          // 3 minutes total
const MOVE_SECS   = 5;            // 5s per move per player
const REWARD_SECS = 20;

// ─── Card emojis — 13 pairs (26 but we use 12 pairs + 1 wild for 25) ─────────
// We use 12 unique symbols = 24 cards + 1 "star" wildcard = 25
const SYMBOLS = ['🦁','🐯','🦊','🐺','🦋','🐸','🦜','🐙','🦄','🐲','🌺','🍄'];
// Wildcard (unpaired) — automatically matches with itself on second click same card = bonus
const WILDCARD = '⭐';

function makeShuffledDeck(): { id: number; symbol: string; paired: boolean }[] {
    // 12 pairs = 24 + 1 wildcard = 25
    const base = [...SYMBOLS, ...SYMBOLS, WILDCARD];
    // Fisher-Yates
    for (let i = base.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [base[i], base[j]] = [base[j], base[i]];
    }
    return base.map((symbol, id) => ({ id, symbol, paired: false }));
}

// ─── Question helpers ─────────────────────────────────────────────────────────
const normalizeQuestion = (rawQ: any) => {
    let questionText = rawQ.question || rawQ.question_text || '';
    if (rawQ.scenario) questionText = `${rawQ.scenario} - ${questionText}`;
    let opts: string[] = [], correctAns = '';
    if (rawQ.source === 'standard_quiz') {
        try {
            let p = rawQ.options;
            if (typeof p === 'string') { if (p.startsWith('"')) p = JSON.parse(p); if (typeof p === 'string') p = JSON.parse(p); }
            opts = Array.isArray(p) ? p : [];
        } catch { opts = []; }
        correctAns = rawQ.correct_answer;
    } else {
        opts = [rawQ.option_a, rawQ.option_b, rawQ.option_c, rawQ.option_d]
            .filter(o => o && String(o).trim() !== '' && o !== 'null');
        if (rawQ.correct_index !== undefined && rawQ.correct_index !== null) correctAns = opts[rawQ.correct_index];
        else {
            const letter = String(rawQ.correct_option || rawQ.correct_answer || '').trim().toLowerCase();
            correctAns = ['a','b','c','d'].includes(letter) ? rawQ[`option_${letter}`] : letter;
        }
    }
    if (!correctAns || opts.length < 2) return null;
    return { questionText, options: opts, correctAnswer: String(correctAns).trim().toLowerCase() };
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
    return useCallback((type: 'flip' | 'match' | 'miss' | 'win' | 'tick' | 'bonus') => {
        try {
            const ac = get(), now = ac.currentTime;
            if (type === 'flip') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.setValueAtTime(600, now);
                o.frequency.exponentialRampToValueAtTime(400, now + 0.08);
                g.gain.setValueAtTime(0.12, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                o.start(now); o.stop(now + 0.1);
            }
            if (type === 'match') {
                [523, 659, 784].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'triangle'; o.frequency.value = f;
                    const t = now + i * 0.1;
                    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                    o.start(t); o.stop(t + 0.25);
                });
            }
            if (type === 'bonus') {
                [784, 1047, 1319].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'triangle'; o.frequency.value = f;
                    const t = now + i * 0.08;
                    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
                    o.start(t); o.stop(t + 0.22);
                });
            }
            if (type === 'miss') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sawtooth'; o.frequency.value = 200;
                g.gain.setValueAtTime(0.15, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                o.start(now); o.stop(now + 0.18);
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
            if (type === 'tick') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.value = 1000;
                g.gain.setValueAtTime(0.1, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                o.start(now); o.stop(now + 0.05);
            }
        } catch (_) {}
    }, []);
}

// ─── Card component ───────────────────────────────────────────────────────────
function Card({ card, flipped, matched, isMyTurn, onClick, owner }: {
    card: { id: number; symbol: string };
    flipped: boolean;
    matched: boolean;
    isMyTurn: boolean;
    onClick: () => void;
    owner?: 'p1' | 'p2' | null;
}) {
    const ownerColor = owner === 'p1'
        ? { bg: 'bg-blue-500',   border: 'border-blue-400',   glow: '#3b82f6' }
        : owner === 'p2'
            ? { bg: 'bg-rose-500',   border: 'border-rose-400',   glow: '#f43f5e' }
            : null;

    return (
        <button
            onClick={onClick}
            disabled={flipped || matched || !isMyTurn}
            className="relative w-full aspect-square select-none focus:outline-none"
            style={{ perspective: '300px' }}
        >
            <div
                className="w-full h-full relative transition-all"
                style={{
                    transformStyle: 'preserve-3d',
                    transform: flipped || matched ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                {/* Back face */}
                <div
                    className={`absolute inset-0 rounded-xl flex items-center justify-center border-2
                        ${isMyTurn && !flipped && !matched
                            ? 'border-indigo-400 hover:border-indigo-300 hover:scale-105 cursor-pointer'
                            : 'border-slate-600'}
                    `}
                    style={{
                        backfaceVisibility: 'hidden',
                        background: 'linear-gradient(145deg, #1e293b, #0f172a)',
                        boxShadow: isMyTurn && !flipped && !matched
                            ? '0 4px 12px rgba(99,102,241,0.3)'
                            : '0 2px 6px rgba(0,0,0,0.4)',
                        transition: 'all 0.15s',
                    }}
                >
                    {/* Card back pattern */}
                    <div className="w-full h-full rounded-xl overflow-hidden opacity-30"
                        style={{
                            backgroundImage: 'repeating-linear-gradient(45deg, #334155 0px, #334155 1px, transparent 1px, transparent 8px)',
                        }}/>
                    <span className="absolute text-slate-600 text-lg font-black">?</span>
                </div>

                {/* Front face */}
                <div
                    className={`absolute inset-0 rounded-xl flex items-center justify-center border-2 ${
                        matched && ownerColor ? ownerColor.border : matched ? 'border-green-400' : 'border-slate-500'
                    }`}
                    style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                        background: matched && ownerColor
                            ? `linear-gradient(145deg, ${ownerColor.glow}22, ${ownerColor.glow}44)`
                            : matched
                                ? 'linear-gradient(145deg, #14532d, #166534)'
                                : 'linear-gradient(145deg, #1e293b, #334155)',
                        boxShadow: matched && ownerColor
                            ? `0 0 12px ${ownerColor.glow}60, 0 2px 8px rgba(0,0,0,0.4)`
                            : '0 2px 6px rgba(0,0,0,0.4)',
                    }}
                >
                    <span style={{ fontSize: 'clamp(14px, 6vw, 28px)' }}>
                        {card.symbol}
                    </span>
                    {matched && ownerColor && (
                        <div className={`absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full ${ownerColor.bg} flex items-center justify-center`}>
                            <span className="text-[6px] text-white font-black">✓</span>
                        </div>
                    )}
                </div>
            </div>
        </button>
    );
}

// ─── Move timer ring ──────────────────────────────────────────────────────────
function MoveTimer({ seconds, isMyTurn }: { seconds: number; isMyTurn: boolean }) {
    const r = 16, circ = 2 * Math.PI * r;
    const color = seconds <= 2 ? '#ef4444' : seconds <= 3 ? '#f97316' : isMyTurn ? '#22c55e' : '#64748b';
    return (
        <div className="relative w-9 h-9 flex items-center justify-center flex-shrink-0">
            <svg width={36} height={36} viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={18} cy={18} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={3}/>
                <circle cx={18} cy={18} r={r} fill="none" stroke={color} strokeWidth={3}
                    strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - seconds / MOVE_SECS)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}/>
            </svg>
            <span className={`absolute text-[10px] font-black ${seconds <= 2 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                {seconds}
            </span>
        </div>
    );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface CardState {
    id:     number;
    symbol: string;
}

interface MemoryGS {
    deck:         CardState[];        // 25 cards
    flipped:      number[];           // indices currently face-up (max 2)
    matched:      number[];           // indices permanently matched
    matchOwner:   Record<number, 'p1' | 'p2'>; // which player matched which index
    currentTurn:  string;             // player id
    scores:       Record<string, number>;
    startedAt:    number;
    moveStartedAt: number;            // when current player's move started
    winnerId:     string | null;
    lastMatchBy:  string | null;      // who just matched (for consecutive turn)
}

interface Props {
    match:       any;
    employee:    Employee;
    onExit:      () => void;
    grantPoints: (pts: number) => Promise<void>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MemoryGame({ match, employee, onExit, grantPoints }: Props) {
    const play   = useSound();
    const myId   = employee.employee_id;
    const isHost = match.players?.[0]?.id === myId;

    const gs: MemoryGS     = match.game_state ?? {};
    const deck             = gs.deck ?? [];
    const flipped          = gs.flipped ?? [];
    const matched          = gs.matched ?? [];
    const matchOwner       = gs.matchOwner ?? {};
    const scores           = gs.scores ?? {};
    const status: string   = match.status ?? 'waiting';
    const isMyTurn         = gs.currentTurn === myId;
    const amIWinner        = match.winner_id === myId;

    // Player labels: p1 = first player, p2 = second
    const p1 = match.players?.[0];
    const p2 = match.players?.[1];
    const getLabel = (id: string): 'p1' | 'p2' => id === p1?.id ? 'p1' : 'p2';

    // ── Local state ───────────────────────────────────────────────────────────
    const [roundTime, setRoundTime] = useState(ROUND_SECS);
    const [moveTime, setMoveTime]   = useState(MOVE_SECS);
    const [processing, setProcessing] = useState(false);
    const [question, setQuestion]   = useState<any>(null);
    const [qTime, setQTime]         = useState(REWARD_SECS);
    const [qAnswered, setQAnswered] = useState(false);
    const [qCorrect, setQCorrect]   = useState<boolean | null>(null);
    const [qLoading, setQLoading]   = useState(false);

    const prevRoundTickRef = useRef(ROUND_SECS);
    const rewardDoneRef    = useRef(false);
    const processingRef    = useRef(false);

    // ── Round timer ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'playing' || !gs.startedAt) return;
        const tick = () => {
            const left = Math.max(0, ROUND_SECS - Math.floor((Date.now() - gs.startedAt) / 1000));
            setRoundTime(left);
            if ([30, 20, 10, 5, 4, 3, 2, 1].includes(left) && left !== prevRoundTickRef.current) {
                prevRoundTickRef.current = left;
                play('tick');
            }
            if (left === 0 && isHost && status === 'playing') {
                // Time's up — highest score wins
                const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
                supabase.from('live_matches').update({
                    status: 'reward_time',
                    winner_id: winner?.[0] ?? null,
                    game_state: { ...gs, winnerId: winner?.[0] ?? null },
                }).eq('id', match.id);
            }
        };
        tick();
        const iv = setInterval(tick, 500);
        return () => clearInterval(iv);
    }, [status, gs.startedAt]);

    // ── Move timer ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'playing' || !gs.moveStartedAt) return;
        const iv = setInterval(() => {
            const elapsed = Math.floor((Date.now() - gs.moveStartedAt) / 1000);
            const left = Math.max(0, MOVE_SECS - elapsed);
            setMoveTime(left);
            if (left === 0 && isMyTurn && !processingRef.current) {
                // Timeout — pass turn
                play('miss');
                handleTimeout();
            }
        }, 500);
        return () => clearInterval(iv);
    }, [status, gs.moveStartedAt, gs.currentTurn]);

    const handleTimeout = async () => {
        if (processingRef.current) return;
        processingRef.current = true;
        const nextPlayer = match.players?.find((p: any) => p.id !== myId)?.id ?? myId;
        await supabase.from('live_matches').update({
            game_state: {
                ...gs,
                flipped: [],
                currentTurn: nextPlayer,
                moveStartedAt: Date.now(),
            },
        }).eq('id', match.id);
        processingRef.current = false;
    };

    // ── Reward ────────────────────────────────────────────────────────────────
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

    useEffect(() => {
        if (!question || qAnswered) return;
        if (qTime <= 0) { handleQAnswer('__timeout__'); return; }
        const iv = setInterval(() => setQTime(p => p - 1), 1000);
        return () => clearInterval(iv);
    }, [question, qTime, qAnswered]);

    const handleQAnswer = async (ans: string) => {
        if (qAnswered) return;
        setQAnswered(true); setQTime(0);
        const correct = question?.correctAnswer ?? '';
        const sel = ans.trim().toLowerCase();
        const ok = ans !== '__timeout__' && (correct === sel || correct.includes(sel) || sel.includes(correct));
        setQCorrect(ok);
        play(ok ? 'win' : 'miss');
        if (ok) await grantPoints(15);
        else toast.error('إجابة خاطئة — حظ أوفر 😅');
        await supabase.from('live_matches').update({ status: 'finished' }).eq('id', match.id);
    };

    // ── Card click ────────────────────────────────────────────────────────────
    const handleCardClick = async (idx: number) => {
        if (!isMyTurn || status !== 'playing') return;
        if (flipped.includes(idx) || matched.includes(idx)) return;
        if (processingRef.current) return;
        if (flipped.length >= 2) return;

        play('flip');

        const newFlipped = [...flipped, idx];

        // First flip
        if (newFlipped.length === 1) {
            await supabase.from('live_matches').update({
                game_state: { ...gs, flipped: newFlipped, moveStartedAt: Date.now() },
            }).eq('id', match.id);
            return;
        }

        // Second flip
        processingRef.current = true;
        setProcessing(true);

        const [first, second] = newFlipped;
        const sym1 = deck[first]?.symbol;
        const sym2 = deck[second]?.symbol;
        const isMatch = sym1 === sym2;
        const isWild  = sym1 === WILDCARD; // wildcard always matches itself? No — wildcard is unpaired, no match

        // Show both cards briefly
        await supabase.from('live_matches').update({
            game_state: { ...gs, flipped: newFlipped, moveStartedAt: Date.now() },
        }).eq('id', match.id);

        await new Promise(r => setTimeout(r, 900));

        if (isMatch && !isWild) {
            // Match!
            play('match');
            const newMatched = [...matched, first, second];
            const newOwner   = { ...matchOwner, [first]: getLabel(myId), [second]: getLabel(myId) };
            const newScores  = { ...scores, [myId]: (scores[myId] ?? 0) + 1 };
            const allMatched = newMatched.length >= TOTAL_CARDS - 1; // -1 for wildcard
            const opponent   = match.players?.find((p: any) => p.id !== myId)?.id ?? myId;

            // Check winner on time's up logic — here check if all pairs found
            const gameOver = newMatched.length >= (TOTAL_CARDS - 1); // 24 matched, 1 wildcard remains
            const winner   = gameOver
                ? Object.entries(newScores).sort((a, b) => b[1] - a[1])[0]?.[0]
                : null;

            await supabase.from('live_matches').update({
                status:    gameOver ? 'reward_time' : 'playing',
                winner_id: winner ?? null,
                game_state: {
                    ...gs,
                    flipped:      [],
                    matched:      newMatched,
                    matchOwner:   newOwner,
                    scores:       newScores,
                    currentTurn:  myId,          // match = keep turn
                    moveStartedAt: Date.now(),
                    winnerId:     winner ?? null,
                },
            }).eq('id', match.id);
        } else {
            // Miss — pass turn
            play('miss');
            const opponent = match.players?.find((p: any) => p.id !== myId)?.id ?? myId;
            await supabase.from('live_matches').update({
                game_state: {
                    ...gs,
                    flipped:      [],
                    currentTurn:  opponent,
                    moveStartedAt: Date.now(),
                },
            }).eq('id', match.id);
        }

        processingRef.current = false;
        setProcessing(false);
    };

    // ── Host starts ───────────────────────────────────────────────────────────
    const handleStart = async () => {
        const deck = makeShuffledDeck();
        const initScores: Record<string, number> = {};
        match.players?.forEach((p: any) => { initScores[p.id] = 0; });
        await supabase.from('live_matches').update({
            status: 'playing',
            game_state: {
                deck,
                flipped:      [],
                matched:      [],
                matchOwner:   {},
                currentTurn:  match.players?.[0]?.id,
                scores:       initScores,
                startedAt:    Date.now(),
                moveStartedAt: Date.now(),
                winnerId:     null,
                lastMatchBy:  null,
            },
        }).eq('id', match.id);
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const myScore  = scores[myId] ?? 0;
    const oppId    = match.players?.find((p: any) => p.id !== myId)?.id;
    const oppName  = match.players?.find((p: any) => p.id !== myId)?.name ?? 'المنافس';
    const oppScore = scores[oppId ?? ''] ?? 0;
    const roundPct = roundTime / ROUND_SECS;

    // ─────────────────────────────────────────────────────────────────────────
    // WAITING
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className="py-6 px-4 flex flex-col items-center gap-4" dir="rtl">
            <div className="text-5xl mb-1">🧠</div>
            <div className="text-center">
                <h3 className="text-xl font-black text-gray-800 mb-1">لعبة الذاكرة</h3>
                <p className="text-sm text-gray-500 font-bold">اقلب بطاقتين — لو متطابقتين تكسب نقطة وتكمل</p>
                <p className="text-xs text-gray-400 mt-1">{GRID}×{GRID} بطاقة — {ROUND_SECS / 60} دقائق</p>
            </div>

            {/* Preview mini grid */}
            <div className="grid gap-1 p-2 rounded-2xl"
                style={{ gridTemplateColumns: `repeat(5,1fr)`, background: '#0f172a', width: 150 }}>
                {SYMBOLS.slice(0, 10).flatMap(s => [s, s]).concat([WILDCARD]).slice(0, 25).map((s, i) => (
                    <div key={i} className="aspect-square rounded-lg flex items-center justify-center text-base"
                        style={{ background: 'linear-gradient(145deg,#1e293b,#334155)', fontSize: 14 }}>
                        {i % 3 === 0 ? s : ''}
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
                {match.players?.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full">
                        <span className="text-xs font-bold text-indigo-700">{p.name}</span>
                        {p.id === myId && <span className="text-[10px] text-indigo-400">(أنت)</span>}
                    </div>
                ))}
            </div>

            {isHost ? (
                <div className="flex flex-col items-center gap-2 w-full max-w-xs">
                    <button onClick={handleStart}
                        disabled={match.players?.length < 2}
                        className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100">
                        🧠 ابدأ اللعبة
                    </button>
                    {match.players?.length < 2 && (
                        <p className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                            ⏳ في انتظار لاعب آخر للانضمام...
                        </p>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 text-sm font-bold text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin"/> في انتظار المضيف...
                </div>
            )}
            <button onClick={onExit} className="text-sm font-bold text-gray-400 hover:text-gray-600">← العودة</button>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // PLAYING
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'playing') return (
        <div className="flex flex-col gap-2 py-2 px-2" dir="rtl">

            {/* Scoreboard */}
            <div className="rounded-2xl p-3 text-white shadow-lg"
                style={{ background: 'linear-gradient(135deg, #312e81, #1e1b4b)' }}>
                <div className="flex items-center justify-between mb-2">
                    {/* Player 1 */}
                    <div className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border-2 transition-all ${
                        isMyTurn ? 'border-blue-400 bg-blue-500/20 scale-105' : 'border-white/10 opacity-70'
                    }`}>
                        <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0"/>
                        <div>
                            <p className="text-xs font-black text-white">أنت</p>
                            <p className="text-lg font-black text-blue-300">{myScore}</p>
                        </div>
                        {isMyTurn && <MoveTimer seconds={moveTime} isMyTurn={true}/>}
                    </div>

                    {/* Round timer center */}
                    <div className="flex flex-col items-center gap-0.5">
                        <div className="relative w-12 h-12">
                            <svg width={48} height={48} viewBox="0 0 48 48" style={{ transform: 'rotate(-90deg)' }}>
                                <circle cx={24} cy={24} r={20} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={3.5}/>
                                <circle cx={24} cy={24} r={20} fill="none"
                                    stroke={roundPct < 0.2 ? '#ef4444' : roundPct < 0.4 ? '#f97316' : '#22c55e'}
                                    strokeWidth={3.5}
                                    strokeDasharray={2 * Math.PI * 20}
                                    strokeDashoffset={2 * Math.PI * 20 * (1 - roundPct)}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.4s' }}/>
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-white">
                                {roundTime < 60 ? roundTime : `${Math.floor(roundTime/60)}:${String(roundTime%60).padStart(2,'0')}`}
                            </span>
                        </div>
                        <p className="text-[9px] text-white/40 font-bold">
                            {matched.length / 2}/{TOTAL_CARDS >> 1} زوج
                        </p>
                    </div>

                    {/* Player 2 */}
                    <div className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border-2 transition-all flex-row-reverse ${
                        !isMyTurn ? 'border-rose-400 bg-rose-500/20 scale-105' : 'border-white/10 opacity-70'
                    }`}>
                        <div className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0"/>
                        <div className="text-left">
                            <p className="text-xs font-black text-white truncate max-w-[56px]">{oppName}</p>
                            <p className="text-lg font-black text-rose-300">{oppScore}</p>
                        </div>
                        {!isMyTurn && <MoveTimer seconds={moveTime} isMyTurn={false}/>}
                    </div>
                </div>

                {/* Turn indicator */}
                <div className={`text-center text-xs font-black py-1 rounded-lg ${
                    isMyTurn ? 'bg-blue-500/30 text-blue-200' : 'bg-rose-500/20 text-rose-200'
                }`}>
                    {isMyTurn
                        ? `← دورك! ${flipped.length === 1 ? 'اقلب بطاقة ثانية' : 'اقلب بطاقة'}`
                        : `⏳ دور ${oppName}...`}
                </div>
            </div>

            {/* Grid */}
            <div className="rounded-2xl p-2 shadow-2xl"
                style={{ background: 'linear-gradient(145deg, #0f172a, #1e293b)' }}>
                <div className="grid gap-1.5"
                    style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)` }}>
                    {deck.map((card, i) => (
                        <Card
                            key={card.id}
                            card={card}
                            flipped={flipped.includes(i)}
                            matched={matched.includes(i)}
                            isMyTurn={isMyTurn && !processing}
                            onClick={() => handleCardClick(i)}
                            owner={matchOwner[i] as 'p1' | 'p2' | null}
                        />
                    ))}
                </div>
            </div>

            <button onClick={onExit} className="text-xs font-bold text-gray-400 hover:text-gray-600 py-1 text-center">← العودة</button>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // REWARD TIME
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'reward_time') return (
        <div className="flex flex-col gap-3 py-2 px-3" dir="rtl">
            {amIWinner ? (
                <>
                    <div className="rounded-2xl p-5 text-center text-white shadow-xl bg-gradient-to-br from-indigo-600 to-violet-700">
                        <Trophy className="w-14 h-14 mx-auto mb-2 text-yellow-300 animate-bounce drop-shadow-xl"/>
                        <h3 className="text-2xl font-black">🎉 فزت!</h3>
                        <p className="text-indigo-200 text-sm mt-1">{myScore} زوج مقابل {oppScore}</p>
                    </div>
                    {qLoading ? (
                        <div className="text-center py-6">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-2"/>
                            <p className="text-xs font-bold text-gray-400">جاري تحضير السؤال...</p>
                        </div>
                    ) : question && !qAnswered ? (
                        <div className="bg-white rounded-2xl border-2 border-indigo-200 p-4 space-y-3 shadow-xl" dir="rtl">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <BrainCircuit className="w-5 h-5 text-indigo-600"/>
                                    <span className="text-xs font-black text-indigo-700">سؤال المكافأة 🎯</span>
                                </div>
                                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-black text-xs border-2 ${
                                    qTime <= 5 ? 'bg-red-100 border-red-400 text-red-700 animate-pulse' : 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                }`}>
                                    <Timer className="w-3 h-3"/> {qTime}ث
                                </div>
                            </div>
                            <p className="text-sm font-bold text-gray-800">{question.questionText}</p>
                            <div className="space-y-2">
                                {question.options.map((opt: string, i: number) => (
                                    <button key={i} onClick={() => handleQAnswer(opt)}
                                        className="w-full bg-white border-2 border-gray-100 p-3 rounded-xl font-bold text-gray-700 hover:border-indigo-400 hover:bg-indigo-50 active:scale-95 transition-all text-sm text-right">
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : qAnswered && (
                        <div className={`rounded-xl p-4 text-center font-black ${qCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                            {qCorrect ? '✅ أجبت صح! +15 نقطة 🎉' : '❌ إجابة خاطئة'}
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-10">
                    <div className="text-6xl mb-4">🧠</div>
                    <h3 className="text-lg font-black text-gray-800">{match.players?.find((p: any) => p.id === match.winner_id)?.name} يجيب على السؤال...</h3>
                    <div className="mt-4 flex justify-center gap-8">
                        <div className="text-center">
                            <p className="text-3xl font-black text-blue-600">{myScore}</p>
                            <p className="text-xs text-gray-400 font-bold">نقاطك</p>
                        </div>
                        <div className="text-center">
                            <p className="text-3xl font-black text-rose-600">{oppScore}</p>
                            <p className="text-xs text-gray-400 font-bold">{oppName}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // FINISHED
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'finished') return (
        <div className="flex flex-col gap-3 py-2 px-3 animate-in fade-in" dir="rtl">
            <div className={`rounded-2xl p-5 text-center text-white shadow-xl ${
                amIWinner ? 'bg-gradient-to-br from-indigo-600 to-violet-700' : 'bg-gradient-to-br from-gray-600 to-gray-800'
            }`}>
                {amIWinner
                    ? <><Trophy className="w-14 h-14 mx-auto mb-2 text-yellow-300 animate-bounce"/><h3 className="text-2xl font-black">فزت! 🏆</h3></>
                    : <><div className="text-5xl mb-2">🧠</div><h3 className="text-xl font-black">انتهت اللعبة</h3></>
                }
            </div>
            <div className="flex gap-3">
                {[
                    { id: myId,    name: 'أنت',   score: myScore,  color: 'border-blue-300 bg-blue-50', text: 'text-blue-700' },
                    { id: oppId,   name: oppName,  score: oppScore, color: 'border-rose-300 bg-rose-50',  text: 'text-rose-700' },
                ].sort((a,b) => b.score - a.score).map((p, i) => (
                    <div key={p.id} className={`flex-1 rounded-2xl border-2 p-4 text-center ${p.color}`}>
                        <p className="text-[10px] font-black text-gray-500 mb-1">{i === 0 ? '🥇' : '🥈'}</p>
                        <p className={`text-sm font-black ${p.text}`}>{p.name}</p>
                        <p className={`text-3xl font-black ${p.text}`}>{p.score}</p>
                        <p className="text-[10px] text-gray-400">أزواج</p>
                    </div>
                ))}
            </div>
            <button onClick={onExit}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-700 text-white py-3.5 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all">
                العودة للصالة
            </button>
        </div>
    );

    return null;
}
