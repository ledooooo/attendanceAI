import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Trophy, Users, Timer, BrainCircuit, Star, Sun, Moon, Zap, Target, Crown } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';
import confetti from 'canvas-confetti';

// ─── Constants ────────────────────────────────────────────────────────────────
const REWARD_SECS = 20;

// ─── Difficulty Levels ────────────────────────────────────────────────────────
const DIFFICULTIES = [
    {
        key: 'easy',
        label: 'سهل',
        emoji: '🟢',
        grid: 4,
        pairs: 8,
        roundSecs: 240,
        moveSecs: 8,
        color: 'from-green-400 to-emerald-500',
        bgGradient: 'from-green-600 to-emerald-700',
        borderGlow: 'rgba(34, 197, 94, 0.5)',
    },
    {
        key: 'medium',
        label: 'متوسط',
        emoji: '🟡',
        grid: 5,
        pairs: 12,
        roundSecs: 180,
        moveSecs: 5,
        color: 'from-amber-400 to-orange-500',
        bgGradient: 'from-amber-600 to-orange-700',
        borderGlow: 'rgba(251, 191, 36, 0.5)',
    },
    {
        key: 'hard',
        label: 'صعب',
        emoji: '🔴',
        grid: 4,
        pairs: 12,
        roundSecs: 120,
        moveSecs: 3,
        color: 'from-red-500 to-rose-600',
        bgGradient: 'from-red-600 to-rose-700',
        borderGlow: 'rgba(244, 63, 94, 0.5)',
    },
];

// ─── Extended Symbols Pool ───────────────────────────────────────────────────
const SYMBOL_POOL = [
    '🦁','🐯','🦊','🐺','🦋','🐸','🦜','🐙','🦄','🐲',
    '🌺','🍄','🌸','🌻','🌵','🍀','🌈','⭐','🌙','☀️',
    '🔥','💎','💫','🎯','🎪','🎭','🎨','🎬','🎮','🎲',
    '⚽','🏀','🎾','⚾','🏐','🎱','🏓','🏸','🥊','⛳',
    '🚗','✈️','🚀','🛸','🚢','🚂','🏎️','🛵','🚲','🏍️',
    '🎁','🎀','🎈','🎉','🎊','🎋','🎍','🎎','🎏','🎐',
    '🍕','🍔','🍟','🌮','🍜','🍣','🍦','🍩','🍪','🍰',
    '🐶','🐱','🐭','🐹','🐰','🦔','🐻','🐼','🐨','🐯',
    '🍎','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🍑',
    '💜','💙','💚','💛','🧡','❤️','🖤','🤍','🤎','💖',
];

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

// ─── Sound ───────────────────────────────────────────────────────────────────
function useSound() {
    const ctx = useRef<AudioContext | null>(null);
    const get = () => {
        if (!ctx.current) ctx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return ctx.current;
    };
    return useCallback((type: 'flip' | 'match' | 'miss' | 'win' | 'tick' | 'bonus' | 'gameStart' | 'wrong') => {
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
            if (type === 'miss' || type === 'wrong') {
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
            if (type === 'gameStart') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.setValueAtTime(400, now);
                o.frequency.exponentialRampToValueAtTime(800, now + 0.15);
                g.gain.setValueAtTime(0.2, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                o.start(now); o.stop(now + 0.2);
            }
        } catch (_) {}
    }, []);
}

// ─── Confetti helpers ─────────────────────────────────────────────────────────
const triggerConfetti = () => {
    const colors = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

    // First burst
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: colors,
    });

    // Second burst
    setTimeout(() => {
        confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: colors,
        });
    }, 150);

    // Third burst
    setTimeout(() => {
        confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: colors,
        });
    }, 300);
};

const triggerWinConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
        confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#fbbf24', '#f59e0b', '#d97706'],
        });
        confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#fbbf24', '#f59e0b', '#d97706'],
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    };
    frame();
};

// ─── Card component ───────────────────────────────────────────────────────────
function Card({ card, flipped, matched, isMyTurn, onClick, owner, difficulty, isDarkMode }: {
    card: { id: number; symbol: string };
    flipped: boolean;
    matched: boolean;
    isMyTurn: boolean;
    onClick: () => void;
    owner?: 'p1' | 'p2' | null;
    difficulty: typeof DIFFICULTIES[number];
    isDarkMode: boolean;
}) {
    const ownerColors = {
        p1: { bg: 'bg-blue-500', border: 'border-blue-400', glow: '#3b82f6', gradient: 'from-blue-500/20 to-blue-600/40' },
        p2: { bg: 'bg-rose-500', border: 'border-rose-400', glow: '#f43f5e', gradient: 'from-rose-500/20 to-rose-600/40' },
    };

    const ownerColor = owner ? ownerColors[owner] : null;

    return (
        <button
            onClick={onClick}
            disabled={flipped || matched || !isMyTurn}
            className={`relative w-full aspect-square select-none focus:outline-none transform transition-all duration-200 ${
                isMyTurn && !flipped && !matched ? 'hover:scale-105 active:scale-95' : ''
            } ${matched ? 'scale-95' : ''}`}
            style={{ perspective: '400px' }}
        >
            <div
                className="w-full h-full relative transition-all"
                style={{
                    transformStyle: 'preserve-3d',
                    transform: flipped || matched ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                {/* Back face */}
                <div
                    className={`absolute inset-0 rounded-xl flex items-center justify-center border-2 transition-all duration-200
                        ${isMyTurn && !flipped && !matched
                            ? `border-2 ${difficulty.borderGlow.includes('green') ? 'border-green-400 hover:border-green-300' :
                               difficulty.borderGlow.includes('amber') ? 'border-amber-400 hover:border-amber-300' :
                               'border-red-400 hover:border-red-300'} shadow-lg`
                            : isDarkMode ? 'border-slate-600' : 'border-slate-300'
                        }
                    `}
                    style={{
                        backfaceVisibility: 'hidden',
                        background: isDarkMode
                            ? 'linear-gradient(145deg, #1e293b, #0f172a)'
                            : 'linear-gradient(145deg, #f1f5f9, #e2e8f0)',
                        boxShadow: isMyTurn && !flipped && !matched
                            ? `0 0 20px ${difficulty.borderGlow}, 0 4px 12px rgba(0,0,0,0.3)`
                            : isDarkMode
                                ? '0 2px 6px rgba(0,0,0,0.5)'
                                : '0 2px 6px rgba(0,0,0,0.1)',
                    }}
                >
                    {/* Card back pattern */}
                    <div
                        className={`w-full h-full rounded-xl overflow-hidden absolute inset-0 ${
                            isDarkMode ? 'opacity-20' : 'opacity-30'
                        }`}
                        style={{
                            backgroundImage: `radial-gradient(circle at 25% 25%, ${difficulty.borderGlow} 2px, transparent 2px),
                                radial-gradient(circle at 75% 75%, ${difficulty.borderGlow} 2px, transparent 2px)`,
                            backgroundSize: '16px 16px',
                        }}
                    />
                    <span className={`relative z-10 text-lg font-black ${
                        isDarkMode ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                        ?
                    </span>
                </div>

                {/* Front face */}
                <div
                    className={`absolute inset-0 rounded-xl flex items-center justify-center border-2 transition-all duration-200 ${
                        matched && ownerColor ? ownerColor.border :
                        matched ? 'border-green-400' :
                        isDarkMode ? 'border-slate-500' : 'border-slate-300'
                    }`}
                    style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                        background: matched && ownerColor
                            ? `linear-gradient(145deg, ${ownerColor.glow}22, ${ownerColor.glow}44)`
                            : matched
                                ? 'linear-gradient(145deg, #14532d, #166534)'
                                : isDarkMode
                                    ? 'linear-gradient(145deg, #334155, #475569)'
                                    : 'linear-gradient(145deg, #ffffff, #f8fafc)',
                        boxShadow: matched && ownerColor
                            ? `0 0 20px ${ownerColor.glow}60, 0 4px 12px rgba(0,0,0,0.4)`
                            : matched
                                ? '0 0 15px rgba(34, 197, 94, 0.4), 0 2px 8px rgba(0,0,0,0.2)'
                                : isDarkMode
                                    ? '0 2px 8px rgba(0,0,0,0.4)'
                                    : '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                >
                    <span
                        className={`transform transition-all duration-200 ${matched ? 'scale-110' : ''}`}
                        style={{ fontSize: 'clamp(14px, 5vw, 28px)' }}
                    >
                        {card.symbol}
                    </span>
                    {matched && ownerColor && (
                        <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full ${ownerColor.bg} flex items-center justify-center shadow-lg animate-pulse`}>
                            <span className="text-[8px] text-white font-black">✓</span>
                        </div>
                    )}
                    {matched && !ownerColor && (
                        <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shadow-lg animate-pulse">
                            <span className="text-[8px] text-white font-black">✓</span>
                        </div>
                    )}
                </div>
            </div>
        </button>
    );
}

// ─── Move timer ring ──────────────────────────────────────────────────────────
function MoveTimer({ seconds, maxSeconds, isMyTurn, isDarkMode, difficulty }: {
    seconds: number;
    maxSeconds: number;
    isMyTurn: boolean;
    isDarkMode: boolean;
    difficulty: typeof DIFFICULTIES[number];
}) {
    const r = 16, circ = 2 * Math.PI * r;
    const pct = seconds / maxSeconds;
    const color = pct <= 0.25 ? '#ef4444' : pct <= 0.5 ? '#f97316' : isMyTurn ? '#22c55e' : '#64748b';

    return (
        <div className="relative w-9 h-9 flex items-center justify-center flex-shrink-0">
            <svg width={36} height={36} viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                <circle
                    cx={18} cy={18} r={r}
                    fill="none"
                    stroke={isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
                    strokeWidth={3}
                />
                <circle
                    cx={18} cy={18} r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={3}
                    strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - pct)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
                />
            </svg>
            <span className={`absolute text-[10px] font-black ${
                pct <= 0.25
                    ? 'text-red-400 animate-pulse'
                    : isDarkMode ? 'text-white' : 'text-gray-800'
            }`}>
                {seconds}
            </span>
        </div>
    );
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface CardState {
    id:     number;
    symbol: string;
}

interface MemoryGS {
    difficulty: string;
    deck:         CardState[];
    flipped:      number[];
    matched:      number[];
    matchOwner:   Record<number, 'p1' | 'p2'>;
    currentTurn:  string;
    scores:       Record<string, number>;
    startedAt:    number;
    moveStartedAt: number;
    winnerId:     string | null;
    lastMatchBy:  string | null;
}

interface Props {
    match:       any;
    employee:    Employee;
    onExit:      () => void;
    grantPoints: (pts: number) => Promise<void>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MemoryGame({ match, employee, onExit, grantPoints }: Props) {
    const play     = useSound();
    const myId     = employee.employee_id;
    const isHost   = match.players?.[0]?.id === myId;

    const gs: MemoryGS      = match.game_state ?? {};
    const difficultyKey    = gs.difficulty || 'medium';
    const difficulty       = DIFFICULTIES.find(d => d.key === difficultyKey) || DIFFICULTIES[1];
    const deck             = gs.deck ?? [];
    const flipped          = gs.flipped ?? [];
    const matched          = gs.matched ?? [];
    const matchOwner       = gs.matchOwner ?? {};
    const scores           = gs.scores ?? {};
    const status: string   = match.status ?? 'waiting';
    const isMyTurn         = gs.currentTurn === myId;
    const amIWinner        = match.winner_id === myId;

    // Dark mode state
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return true;
    });

    // Player labels: p1 = first player, p2 = second
    const p1 = match.players?.[0];
    const p2 = match.players?.[1];
    const getLabel = (id: string): 'p1' | 'p2' => id === p1?.id ? 'p1' : 'p2';

    // ── Local state ───────────────────────────────────────────────────────────
    const [roundTime, setRoundTime] = useState(difficulty.roundSecs);
    const [moveTime, setMoveTime]   = useState(difficulty.moveSecs);
    const [processing, setProcessing] = useState(false);
    const [question, setQuestion]   = useState<any>(null);
    const [qTime, setQTime]         = useState(REWARD_SECS);
    const [qAnswered, setQAnswered] = useState(false);
    const [qCorrect, setQCorrect]   = useState<boolean | null>(null);
    const [qLoading, setQLoading]   = useState(false);
    const [selectedDifficulty, setSelectedDifficulty] = useState(difficultyKey);
    const [showDifficultyModal, setShowDifficultyModal] = useState(false);

    const prevRoundTickRef = useRef(difficulty.roundSecs);
    const rewardDoneRef    = useRef(false);
    const processingRef    = useRef(false);
    const roundTimeRef     = useRef(difficulty.roundSecs);
    const moveTimeRef      = useRef(difficulty.moveSecs);

    // Update refs when difficulty changes
    useEffect(() => {
        roundTimeRef.current = difficulty.roundSecs;
        moveTimeRef.current = difficulty.moveSecs;
    }, [difficulty]);

    // ── Round timer ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'playing' || !gs.startedAt) return;
        const tick = () => {
            const left = Math.max(0, difficulty.roundSecs - Math.floor((Date.now() - gs.startedAt) / 1000));
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
    }, [status, gs.startedAt, difficulty]);

    // ── Move timer ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'playing' || !gs.moveStartedAt) return;
        const iv = setInterval(() => {
            const elapsed = Math.floor((Date.now() - gs.moveStartedAt) / 1000);
            const left = Math.max(0, difficulty.moveSecs - elapsed);
            setMoveTime(left);
            if (left === 0 && isMyTurn && !processingRef.current) {
                // Timeout — pass turn
                play('miss');
                handleTimeout();
            }
        }, 500);
        return () => clearInterval(iv);
    }, [status, gs.moveStartedAt, gs.currentTurn, difficulty]);

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
        triggerWinConfetti();
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
        if (ok) {
            triggerConfetti();
            await grantPoints(15);
        }
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

        // Show both cards briefly
        await supabase.from('live_matches').update({
            game_state: { ...gs, flipped: newFlipped, moveStartedAt: Date.now() },
        }).eq('id', match.id);

        await new Promise(r => setTimeout(r, 900));

        const totalCards = difficulty.grid * difficulty.grid;
        const wildCard = totalCards % 2 !== 0;

        if (isMatch) {
            // Match!
            play('match');
            triggerConfetti();
            const newMatched = [...matched, first, second];
            const newOwner   = { ...matchOwner, [first]: getLabel(myId), [second]: getLabel(myId) };
            const newScores  = { ...scores, [myId]: (scores[myId] ?? 0) + 1 };

            // Check if game is over
            const gameOver = wildCard
                ? newMatched.length >= totalCards - 1
                : newMatched.length >= totalCards;

            const winner = gameOver
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
        // Generate deck based on selected difficulty
        const gridSize = difficulty.grid;
        const totalCards = gridSize * gridSize;
        const pairs = totalCards / 2;
        const hasWildCard = totalCards % 2 !== 0;

        // Shuffle and pick random symbols
        const shuffledPool = [...SYMBOL_POOL].sort(() => Math.random() - 0.5);
        const selectedSymbols = shuffledPool.slice(0, pairs);

        // Create deck: pairs + optional wild card
        let deckSymbols = [...selectedSymbols, ...selectedSymbols];
        if (hasWildCard) {
            deckSymbols.push('🌟'); // Wild card star
        }

        // Fisher-Yates shuffle
        for (let i = deckSymbols.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deckSymbols[i], deckSymbols[j]] = [deckSymbols[j], deckSymbols[i]];
        }

        const deck = deckSymbols.map((symbol, id) => ({ id, symbol, paired: false }));

        const initScores: Record<string, number> = {};
        match.players?.forEach((p: any) => { initScores[p.id] = 0; });

        play('gameStart');
        triggerConfetti();

        await supabase.from('live_matches').update({
            status: 'playing',
            game_state: {
                difficulty: selectedDifficulty,
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

        setShowDifficultyModal(false);
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const myScore  = scores[myId] ?? 0;
    const oppId    = match.players?.find((p: any) => p.id !== myId)?.id;
    const oppName  = match.players?.find((p: any) => p.id !== myId)?.name ?? 'المنافس';
    const oppScore = scores[oppId ?? ''] ?? 0;
    const roundPct = roundTime / difficulty.roundSecs;

    // ─────────────────────────────────────────────────────────────────────────
    // WAITING
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className={`py-6 px-4 flex flex-col items-center gap-4 ${isDarkMode ? 'bg-slate-900' : 'bg-gradient-to-b from-slate-50 to-slate-100'} min-h-screen`} dir="rtl">
            {/* Header with Dark Mode Toggle */}
            <div className="w-full flex items-center justify-between px-2">
                <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`p-2 rounded-full transition-all duration-300 ${
                        isDarkMode
                            ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700'
                            : 'bg-white text-slate-600 hover:bg-slate-200 shadow-md'
                    }`}
                >
                    {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <h2 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>لعبة الذاكرة</h2>
                <div className="w-9" /> {/* Spacer for alignment */}
            </div>

            {/* Game Icon */}
            <div className={`text-6xl mb-2 animate-bounce ${isDarkMode ? 'filter drop-shadow-lg' : ''}`}>
                🧠
            </div>

            <div className="text-center">
                <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    لعبة الذاكرة
                </h3>
                <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    اقلب بطاقتين — لو متطابقتين تكسب نقطة وتكمل
                </p>
            </div>

            {/* Difficulty Selection */}
            {isHost && (
                <div className={`w-full max-w-sm rounded-2xl p-4 ${isDarkMode ? 'bg-slate-800/50' : 'bg-white'} shadow-lg border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-3">
                        <Target className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                        <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>اختر المستوى</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {DIFFICULTIES.map((diff) => (
                            <button
                                key={diff.key}
                                onClick={() => setSelectedDifficulty(diff.key)}
                                className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-200 ${
                                    selectedDifficulty === diff.key
                                        ? `bg-gradient-to-br ${diff.bgGradient} text-white shadow-lg scale-105`
                                        : isDarkMode
                                            ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                <span className="text-2xl">{diff.emoji}</span>
                                <span className="text-xs font-black">{diff.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Selected difficulty details */}
                    {(() => {
                        const selected = DIFFICULTIES.find(d => d.key === selectedDifficulty)!;
                        return (
                            <div className={`mt-3 p-3 rounded-xl ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-50'} border ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div>
                                        <p className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{selected.grid}×{selected.grid}</p>
                                        <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>شبكة</p>
                                    </div>
                                    <div>
                                        <p className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{selected.pairs}</p>
                                        <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>أزواج</p>
                                    </div>
                                    <div>
                                        <p className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{selected.moveSecs}s</p>
                                        <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>للدور</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Players */}
            <div className="flex flex-wrap gap-2 justify-center">
                {match.players?.map((p: any) => (
                    <div
                        key={p.id}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full border-2 transition-all ${
                            isDarkMode
                                ? 'bg-slate-800 border-slate-600'
                                : 'bg-indigo-50 border-indigo-200'
                        }`}
                    >
                        <div className={`w-2 h-2 rounded-full ${p.id === myId ? 'bg-green-400' : 'bg-slate-400'}`} />
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-indigo-700'}`}>{p.name}</span>
                        {p.id === myId && (
                            <span className={`text-[10px] ${isDarkMode ? 'text-green-400' : 'text-indigo-400'}`}>(أنت)</span>
                        )}
                    </div>
                ))}
            </div>

            {isHost ? (
                <div className="flex flex-col items-center gap-2 w-full max-w-xs">
                    <button
                        onClick={handleStart}
                        disabled={match.players?.length < 2}
                        className={`w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2`}
                    >
                        <BrainCircuit className="w-6 h-6" />
                        ابدأ اللعبة
                    </button>
                    {match.players?.length < 2 && (
                        <div className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl ${
                            isDarkMode ? 'bg-amber-900/30 text-amber-400 border border-amber-700' : 'bg-amber-50 border border-amber-200 text-amber-700'
                        }`}>
                            <Loader2 className="w-4 h-4 animate-spin"/>
                            في انتظار لاعب آخر...
                        </div>
                    )}
                </div>
            ) : (
                <div className={`flex items-center gap-2 text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`}>
                    <Loader2 className="w-4 h-4 animate-spin"/> في انتظار المضيف...
                </div>
            )}

            <button
                onClick={onExit}
                className={`text-sm font-bold transition-colors ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}
            >
                ← العودة
            </button>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // PLAYING
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'playing') return (
        <div className={`flex flex-col gap-2 py-2 px-2 ${isDarkMode ? 'bg-slate-900' : 'bg-gradient-to-b from-slate-100 to-slate-200'} min-h-screen`} dir="rtl">
            {/* Scoreboard */}
            <div className={`rounded-2xl p-3 text-white shadow-lg ${
                isDarkMode ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700' : 'bg-gradient-to-br from-indigo-600 to-violet-700'
            }`}>
                <div className="flex items-center justify-between mb-2">
                    {/* Player 1 */}
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
                        isMyTurn
                            ? `border-blue-400 bg-blue-500/20 scale-105 ${isDarkMode ? 'shadow-lg shadow-blue-500/30' : ''}`
                            : isDarkMode ? 'border-slate-600 opacity-70' : 'border-white/10 opacity-70'
                    }`}>
                        <div className="w-3 h-3 rounded-full bg-blue-400 flex-shrink-0 animate-pulse" />
                        <div>
                            <p className="text-xs font-black text-white">أنت</p>
                            <p className="text-xl font-black text-blue-300">{myScore}</p>
                        </div>
                        {isMyTurn && <MoveTimer seconds={moveTime} maxSeconds={difficulty.moveSecs} isMyTurn={true} isDarkMode={isDarkMode} difficulty={difficulty}/>}
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
                            {matched.length / 2}/{difficulty.pairs} زوج
                        </p>
                        {/* Difficulty Badge */}
                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold ${
                            difficulty.key === 'easy' ? 'bg-green-500/30 text-green-300' :
                            difficulty.key === 'hard' ? 'bg-red-500/30 text-red-300' :
                            'bg-amber-500/30 text-amber-300'
                        }`}>
                            {difficulty.emoji} {difficulty.label}
                        </span>
                    </div>

                    {/* Player 2 */}
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all flex-row-reverse ${
                        !isMyTurn
                            ? `border-rose-400 bg-rose-500/20 scale-105 ${isDarkMode ? 'shadow-lg shadow-rose-500/30' : ''}`
                            : isDarkMode ? 'border-slate-600 opacity-70' : 'border-white/10 opacity-70'
                    }`}>
                        <div className="w-3 h-3 rounded-full bg-rose-400 flex-shrink-0 animate-pulse" />
                        <div className="text-left">
                            <p className="text-xs font-black text-white truncate max-w-[60px]">{oppName}</p>
                            <p className="text-xl font-black text-rose-300">{oppScore}</p>
                        </div>
                        {!isMyTurn && <MoveTimer seconds={moveTime} maxSeconds={difficulty.moveSecs} isMyTurn={false} isDarkMode={isDarkMode} difficulty={difficulty}/>}
                    </div>
                </div>

                {/* Turn indicator */}
                <div className={`text-center text-xs font-black py-2 rounded-lg transition-all ${
                    isMyTurn
                        ? 'bg-blue-500/30 text-blue-200 animate-pulse'
                        : 'bg-rose-500/20 text-rose-200'
                }`}>
                    {isMyTurn
                        ? `← دورك! ${flipped.length === 1 ? 'اقلب بطاقة ثانية' : 'اقلب بطاقة'}`
                        : `⏳ دور ${oppName}...`}
                </div>
            </div>

            {/* Grid */}
            <div className={`rounded-2xl p-2 shadow-2xl ${
                isDarkMode
                    ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700'
                    : 'bg-gradient-to-br from-slate-800 to-slate-900'
            }`}>
                <div className="grid gap-1.5"
                    style={{ gridTemplateColumns: `repeat(${difficulty.grid}, 1fr)` }}>
                    {deck.map((card, i) => (
                        <Card
                            key={card.id}
                            card={card}
                            flipped={flipped.includes(i)}
                            matched={matched.includes(i)}
                            isMyTurn={isMyTurn && !processing}
                            onClick={() => handleCardClick(i)}
                            owner={matchOwner[i] as 'p1' | 'p2' | null}
                            difficulty={difficulty}
                            isDarkMode={isDarkMode}
                        />
                    ))}
                </div>
            </div>

            {/* Dark Mode Toggle */}
            <div className="flex justify-center">
                <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`p-2 rounded-full transition-all duration-300 ${
                        isDarkMode
                            ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700 border border-slate-700'
                            : 'bg-white text-slate-600 hover:bg-slate-200 shadow-md border border-slate-200'
                    }`}
                >
                    {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
            </div>

            <button
                onClick={onExit}
                className={`text-xs font-bold py-1 text-center transition-colors ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}
            >
                ← العودة
            </button>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // REWARD TIME
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'reward_time') return (
        <div className={`flex flex-col gap-3 py-2 px-3 ${isDarkMode ? 'bg-slate-900' : 'bg-gradient-to-b from-slate-100 to-slate-200')} min-h-screen`} dir="rtl">
            {amIWinner ? (
                <>
                    <div className={`rounded-2xl p-6 text-center text-white shadow-xl ${
                        isDarkMode
                            ? 'bg-gradient-to-br from-purple-600 to-indigo-700 border border-purple-500'
                            : 'bg-gradient-to-br from-indigo-600 to-violet-700'
                    }`}>
                        <Trophy className="w-16 h-16 mx-auto mb-3 text-yellow-300 animate-bounce drop-shadow-xl"/>
                        <h3 className="text-2xl font-black">🎉 فزت!</h3>
                        <p className={`mt-1 ${isDarkMode ? 'text-purple-200' : 'text-indigo-200'}`}>
                            {myScore} زوج مقابل {oppScore}
                        </p>
                        <p className={`text-xs mt-2 ${isDarkMode ? 'text-purple-300' : 'text-indigo-300'}`}>
                            {difficulty.emoji} {difficulty.label}
                        </p>
                    </div>
                    {qLoading ? (
                        <div className="text-center py-6">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-2"/>
                            <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`}>جاري تحضير السؤال...</p>
                        </div>
                    ) : question && !qAnswered ? (
                        <div className={`rounded-2xl border-2 p-4 space-y-3 shadow-xl ${
                            isDarkMode
                                ? 'bg-slate-800 border-slate-700'
                                : 'bg-white border-indigo-200'
                        }`} dir="rtl">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <BrainCircuit className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-indigo-600'}`}/>
                                    <span className={`text-xs font-black ${isDarkMode ? 'text-purple-400' : 'text-indigo-700'}`}>سؤال المكافأة 🎯</span>
                                </div>
                                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-black text-xs border-2 transition-all ${
                                    qTime <= 5
                                        ? 'bg-red-100 border-red-400 text-red-700 animate-pulse'
                                        : isDarkMode
                                            ? 'bg-slate-700 border-slate-600 text-white'
                                            : 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                }`}>
                                    <Timer className="w-3 h-3"/> {qTime}ث
                                </div>
                            </div>
                            <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{question.questionText}</p>
                            <div className="space-y-2">
                                {question.options.map((opt: string, i: number) => (
                                    <button
                                        key={i}
                                        onClick={() => handleQAnswer(opt)}
                                        className={`w-full p-3 rounded-xl font-bold transition-all active:scale-95 text-right ${
                                            isDarkMode
                                                ? 'bg-slate-700 border border-slate-600 text-white hover:border-purple-400 hover:bg-slate-600'
                                                : 'bg-white border-2 border-gray-100 text-gray-700 hover:border-indigo-400 hover:bg-indigo-50'
                                        }`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : qAnswered && (
                        <div className={`rounded-xl p-4 text-center font-black ${
                            qCorrect
                                ? `${isDarkMode ? 'bg-green-900/50 text-green-400 border border-green-700' : 'bg-green-100 text-green-800'}`
                                : `${isDarkMode ? 'bg-red-900/50 text-red-400 border border-red-700' : 'bg-red-100 text-red-700'}`
                        }`}>
                            {qCorrect ? '✅ أجبت صح! +15 نقطة 🎉' : '❌ إجابة خاطئة'}
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-10">
                    <div className={`text-6xl mb-4 ${isDarkMode ? 'filter drop-shadow-lg' : ''}`}>🧠</div>
                    <h3 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                        {match.players?.find((p: any) => p.id === match.winner_id)?.name} يجيب على السؤال...
                    </h3>
                    <div className="mt-4 flex justify-center gap-8">
                        <div className="text-center">
                            <p className={`text-3xl font-black ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{myScore}</p>
                            <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-gray-400'} font-bold`}>نقاطك</p>
                        </div>
                        <div className="text-center">
                            <p className={`text-3xl font-black ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>{oppScore}</p>
                            <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-gray-400'} font-bold`}>{oppName}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Dark Mode Toggle */}
            <div className="flex justify-center mt-auto pt-4">
                <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`p-2 rounded-full transition-all duration-300 ${
                        isDarkMode
                            ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700 border border-slate-700'
                            : 'bg-white text-slate-600 hover:bg-slate-200 shadow-md border border-slate-200'
                    }`}
                >
                    {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // FINISHED
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'finished') return (
        <div className={`flex flex-col gap-3 py-2 px-3 min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gradient-to-b from-slate-100 to-slate-200'}`} dir="rtl">
            <div className={`rounded-2xl p-6 text-center text-white shadow-xl ${
                amIWinner
                    ? isDarkMode
                        ? 'bg-gradient-to-br from-purple-600 to-indigo-700 border border-purple-500'
                        : 'bg-gradient-to-br from-indigo-600 to-violet-700'
                    : isDarkMode
                        ? 'bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600'
                        : 'bg-gradient-to-br from-gray-600 to-gray-800'
            }`}>
                {amIWinner ? (
                    <>
                        <Trophy className="w-16 h-16 mx-auto mb-3 text-yellow-300 animate-bounce"/>
                        <h3 className="text-2xl font-black">فزت! 🏆</h3>
                        <p className={`mt-2 text-sm ${isDarkMode ? 'text-purple-200' : 'text-indigo-200'}`}>
                            {difficulty.emoji} {difficulty.label}
                        </p>
                    </>
                ) : (
                    <>
                        <div className={`text-5xl mb-3 ${isDarkMode ? 'filter drop-shadow-lg' : ''}`}>🧠</div>
                        <h3 className="text-xl font-black">انتهت اللعبة</h3>
                        <p className={`text-sm mt-2 ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`}>
                            {oppName} فاز!
                        </p>
                    </>
                )}
            </div>

            <div className="flex gap-3">
                {[
                    { id: myId,    name: 'أنت',   score: myScore,  color: 'border-blue-300', bg: 'bg-blue-50', text: 'text-blue-700', darkBg: 'bg-blue-900/30', darkText: 'text-blue-400' },
                    { id: oppId,   name: oppName,  score: oppScore, color: 'border-rose-300', bg: 'bg-rose-50',  text: 'text-rose-700', darkBg: 'bg-rose-900/30', darkText: 'text-rose-400' },
                ].sort((a,b) => b.score - a.score).map((p, i) => (
                    <div
                        key={p.id}
                        className={`flex-1 rounded-2xl border-2 p-4 text-center transition-all ${
                            i === 0
                                ? `${p.color} ${isDarkMode ? p.darkBg : p.bg} ${isDarkMode ? p.darkText : p.text} shadow-lg`
                                : `${isDarkMode ? 'border-slate-600 bg-slate-800 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`
                        }`}
                    >
                        <p className={`text-[10px] font-black ${i === 0 ? '' : isDarkMode ? 'text-slate-500' : 'text-gray-400'} mb-1`}>
                            {i === 0 ? '🥇' : '🥈'}
                        </p>
                        <p className={`text-sm font-black`}>{p.name}</p>
                        <p className={`text-3xl font-black`}>{p.score}</p>
                        <p className={`text-[10px]`}>أزواج</p>
                    </div>
                ))}
            </div>

            {/* Difficulty Badge */}
            <div className={`text-center py-2 px-4 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-white'} border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    المستوى: {difficulty.emoji} {difficulty.label}
                </span>
            </div>

            <button
                onClick={onExit}
                className={`w-full py-3.5 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all ${
                    isDarkMode
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                        : 'bg-gradient-to-r from-indigo-600 to-violet-700 text-white'
                }`}
            >
                العودة للصالة
            </button>

            {/* Dark Mode Toggle */}
            <div className="flex justify-center pt-2">
                <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`p-2 rounded-full transition-all duration-300 ${
                        isDarkMode
                            ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700 border border-slate-700'
                            : 'bg-white text-slate-600 hover:bg-slate-200 shadow-md border border-slate-200'
                    }`}
                >
                    {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );

    return null;
}
