import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Trophy, Timer, BrainCircuit, Users, Sun, Moon, Zap, Target, Crown, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';
import confetti from 'canvas-confetti';

// ─── Difficulty Levels ──────────────────────────────────────────────────────────
const DIFFICULTIES = [
    {
        key: 'easy',
        label: 'سهل',
        emoji: '🟢',
        grid: 3,
        time: 120,
        color: 'from-green-400 to-emerald-500',
        bgGradient: 'from-green-600 to-emerald-700',
        boardBg: 'from-green-700 to-emerald-800',
        borderColor: '#059669',
        tileGradient: [
            'linear-gradient(145deg, #86efac, #4ade80)',
            'linear-gradient(145deg, #6ee7b7, #34d399)',
            'linear-gradient(145deg, #a7f3d0, #6ee7b7)',
        ],
        tileBorder: ['#16a34a', '#059669', '#047857'],
        tileText: '#14532d',
    },
    {
        key: 'medium',
        label: 'متوسط',
        emoji: '🟡',
        grid: 4,
        time: 90,
        color: 'from-amber-400 to-orange-500',
        bgGradient: 'from-amber-600 to-orange-700',
        boardBg: 'from-amber-700 to-orange-800',
        borderColor: '#d97706',
        tileGradient: [
            'linear-gradient(145deg, #fde68a, #fbbf24)',
            'linear-gradient(145deg, #fcd34d, #f59e0b)',
            'linear-gradient(145deg, #fde047, #d97706)',
        ],
        tileBorder: ['#ca8a04', '#b45309', '#92400e'],
        tileText: '#78350f',
    },
    {
        key: 'hard',
        label: 'صعب',
        emoji: '🔴',
        grid: 5,
        time: 120,
        color: 'from-red-500 to-rose-600',
        bgGradient: 'from-red-600 to-rose-700',
        boardBg: 'from-red-700 to-rose-800',
        borderColor: '#dc2626',
        tileGradient: [
            'linear-gradient(145deg, #fca5a5, #f87171)',
            'linear-gradient(145deg, #f87171, #ef4444)',
            'linear-gradient(145deg, #fecaca, #dc2626)',
        ],
        tileBorder: ['#b91c1c', '#991b1b', '#7f1d1d'],
        tileText: '#450a0a',
    },
];

const REWARD_SECS = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function solvedBoard(gridSize: number): number[] {
    const tiles = gridSize * gridSize;
    return [...Array.from({ length: tiles - 1 }, (_, i) => i + 1), 0];
}

function isSolved(board: number[]): boolean {
    return board.every((v, i) => v === (i < board.length - 1 ? i + 1 : 0));
}

// Count inversions to check solvability
function isSolvable(board: number[]): boolean {
    const gridSize = Math.sqrt(board.length);
    const arr = board.filter(x => x !== 0);
    let inv = 0;
    for (let i = 0; i < arr.length; i++)
        for (let j = i + 1; j < arr.length; j++)
            if (arr[i] > arr[j]) inv++;
    const blankRow = Math.floor(board.indexOf(0) / gridSize);
    const blankFromBottom = gridSize - blankRow;
    if (gridSize % 2 === 1) return inv % 2 === 0;
    if (blankFromBottom % 2 === 0) return inv % 2 === 1;
    return inv % 2 === 0;
}

function shuffleBoard(gridSize: number): number[] {
    let board: number[];
    const tiles = gridSize * gridSize;
    do {
        board = [...Array.from({ length: tiles - 1 }, (_, i) => i + 1), 0];
        for (let i = board.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [board[i], board[j]] = [board[j], board[i]];
        }
    } while (!isSolvable(board) || isSolved(board));
    return board;
}

// Returns new board after sliding tile at `idx` into empty space (if adjacent)
function slideTile(board: number[], idx: number): number[] | null {
    const gridSize = Math.sqrt(board.length);
    const emptyIdx = board.indexOf(0);
    const row = Math.floor(idx / gridSize), col = idx % gridSize;
    const eRow = Math.floor(emptyIdx / gridSize), eCol = emptyIdx % gridSize;
    const adjacent =
        (Math.abs(row - eRow) === 1 && col === eCol) ||
        (Math.abs(col - eCol) === 1 && row === eRow);
    if (!adjacent) return null;
    const nb = [...board];
    [nb[idx], nb[emptyIdx]] = [nb[emptyIdx], nb[idx]];
    return nb;
}

// ─── Confetti helpers ─────────────────────────────────────────────────────────
const triggerConfetti = () => {
    const colors = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#fbbf24'];

    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: colors,
    });

    setTimeout(() => {
        confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: colors,
        });
    }, 150);

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

const triggerBigWinConfetti = () => {
    confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#ffd700', '#ff6b6b', '#4ecdc4', '#a855f7'],
    });

    setTimeout(() => {
        confetti({
            particleCount: 100,
            spread: 120,
            origin: { y: 0.6 },
            colors: ['#fbbf24', '#f59e0b', '#d97706'],
        });
    }, 200);

    setTimeout(() => {
        confetti({
            particleCount: 80,
            spread: 80,
            origin: { y: 0.4 },
            colors: ['#ec4899', '#8b5cf6', '#06b6d4'],
        });
    }, 400);
};

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
        opts = [rawQ.option_a, rawQ.option_b, rawQ.option_c, rawQ.option_d].filter(o => o && String(o).trim() !== '' && o !== 'null');
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
    return useCallback((type: 'slide' | 'win' | 'wrong' | 'tick' | 'gameStart' | 'solve') => {
        try {
            const ac = get(), now = ac.currentTime;
            if (type === 'slide') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine';
                o.frequency.setValueAtTime(520, now);
                o.frequency.exponentialRampToValueAtTime(380, now + 0.07);
                g.gain.setValueAtTime(0.12, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
                o.start(now); o.stop(now + 0.09);
            }
            if (type === 'win' || type === 'solve') {
                [523, 659, 784, 1047].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'triangle'; o.frequency.value = f;
                    const t = now + i * 0.12;
                    g.gain.setValueAtTime(0.25, t);
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
                    o.start(t); o.stop(t + 0.3);
                });
            }
            if (type === 'wrong') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sawtooth'; o.frequency.value = 180;
                g.gain.setValueAtTime(0.18, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                o.start(now); o.stop(now + 0.2);
            }
            if (type === 'tick') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.value = 880;
                g.gain.setValueAtTime(0.08, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                o.start(now); o.stop(now + 0.06);
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

// ─── Tile component ───────────────────────────────────────────────────────────
function Tile({ value, canSlide, onClick, justMoved, difficulty, isDarkMode }: {
    value: number; canSlide: boolean; onClick: () => void; justMoved: boolean;
    difficulty: typeof DIFFICULTIES[number]; isDarkMode: boolean;
}) {
    if (value === 0) {
        return (
            <div
                className={`rounded-xl ${canSlide ? 'ring-2 ring-white/50' : ''}`}
                style={{
                    background: isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.35)',
                    boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)',
                }}
            />
        );
    }

    // Color tiers based on value
    const tiers = difficulty.tileGradient.length;
    const tierIndex = Math.floor((value - 1) / Math.ceil(15 / tiers)) % tiers;

    return (
        <button
            onClick={onClick}
            className={`rounded-xl font-black flex items-center justify-center relative overflow-hidden select-none focus:outline-none transform transition-all duration-150 ${
                canSlide ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-default'
            }`}
            style={{
                background: difficulty.tileGradient[tierIndex],
                border: `2px solid ${difficulty.tileBorder[tierIndex]}`,
                boxShadow: justMoved
                    ? `0 0 0 3px ${difficulty.color.includes('green') ? '#fbbf24' : difficulty.color.includes('amber') ? '#fbbf24' : '#fbbf24'}, 0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.4)`
                    : `0 4px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.2)`,
                transition: 'box-shadow 0.15s, transform 0.1s',
                fontSize: 'clamp(14px, 5vw, 24px)',
            }}
            onMouseDown={e => canSlide && (e.currentTarget.style.transform = 'scale(0.93)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
            {/* Wood grain lines */}
            <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                    backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(0,0,0,0.15) 6px, rgba(0,0,0,0.15) 7px)',
                }}
            />
            {/* Number */}
            <span
                className="relative z-10 font-black"
                style={{
                    color: difficulty.tileText,
                    textShadow: '0 1px 0 rgba(255,255,255,0.5), 0 -1px 0 rgba(0,0,0,0.3)',
                    WebkitTextStroke: '0.5px rgba(0,0,0,0.2)',
                }}
            >
                {value}
            </span>
            {/* Shine */}
            <div
                className="absolute top-0.5 left-1 right-1 h-2 rounded-full opacity-30 pointer-events-none"
                style={{ background: 'linear-gradient(white, transparent)' }}
            />
        </button>
    );
}

// ─── Question Screen ──────────────────────────────────────────────────────────
function QuestionScreen({ question, onAnswer, timeLeft, answered, isCorrect, isDarkMode, difficulty }: {
    question: any; onAnswer: (opt: string) => void;
    timeLeft: number; answered: boolean; isCorrect: boolean | null;
    isDarkMode: boolean; difficulty: typeof DIFFICULTIES[number];
}) {
    return (
        <div className={`rounded-2xl border-2 p-4 space-y-3 shadow-xl animate-in zoom-in duration-300 ${
            isDarkMode
                ? 'bg-slate-800 border-slate-600'
                : 'bg-white border-amber-300'
        }`} dir="rtl">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BrainCircuit className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-amber-600'}`}/>
                    <span className={`text-xs font-black ${isDarkMode ? 'text-purple-400' : 'text-amber-700'}`}>
                        سؤال المكافأة 🎯 {difficulty.emoji}
                    </span>
                </div>
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-black text-xs border-2 transition-all ${
                    timeLeft <= 5
                        ? 'bg-red-100 border-red-400 text-red-700 animate-pulse'
                        : isDarkMode
                            ? 'bg-slate-700 border-slate-500 text-white'
                            : 'bg-amber-50 border-amber-300 text-amber-700'
                }`}>
                    <Timer className="w-3 h-3"/> {timeLeft}ث
                </div>
            </div>
            <p className={`text-sm font-bold leading-relaxed ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                {question.questionText}
            </p>
            {!answered ? (
                <div className="space-y-2">
                    {question.options.map((opt: string, i: number) => (
                        <button
                            key={i}
                            onClick={() => onAnswer(opt)}
                            className={`w-full p-3 rounded-xl font-bold transition-all active:scale-95 text-right ${
                                isDarkMode
                                    ? 'bg-slate-700 border border-slate-600 text-white hover:border-purple-400 hover:bg-slate-600'
                                    : 'bg-white border-2 border-gray-100 text-gray-700 hover:border-amber-400 hover:bg-amber-50'
                            }`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            ) : (
                <div className={`text-center py-3 rounded-xl font-black text-sm ${
                    isCorrect
                        ? isDarkMode ? 'bg-green-900/50 text-green-400 border border-green-700' : 'bg-green-100 text-green-800'
                        : isDarkMode ? 'bg-red-900/50 text-red-400 border border-red-700' : 'bg-red-100 text-red-700'
                }`}>
                    {isCorrect ? '✅ إجابة صحيحة! +15 نقطة 🎉' : '❌ إجابة خاطئة — حظ أوفر'}
                </div>
            )}
        </div>
    );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlayerGS {
    id:       string;
    name:     string;
    board:    number[];
    moves:    number;
    solved:   boolean;
    solvedAt: number | null;
}

interface PuzzleGS {
    difficulty: string;
    players:    PlayerGS[];
    startedAt:  number;
    winnerId:   string | null;
}

interface Props {
    match:       any;
    employee:    Employee;
    onExit:      () => void;
    grantPoints: (pts: number) => Promise<void>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PuzzleGame({ match, employee, onExit, grantPoints }: Props) {
    const play    = useSound();
    const myId    = employee.employee_id;
    const isHost  = match.players?.[0]?.id === myId;

    // Dark mode state
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return true;
    });

    // ── Derived from match ────────────────────────────────────────────────────
    const gs: PuzzleGS           = match.game_state ?? {};
    const difficultyKey: string   = gs.difficulty || 'medium';
    const difficulty             = DIFFICULTIES.find(d => d.key === difficultyKey) || DIFFICULTIES[1];
    const players: PlayerGS[]    = gs.players ?? [];
    const status: string         = match.status ?? 'waiting';
    const [selectedDifficulty, setSelectedDifficulty] = useState(difficultyKey);

    const myPS      = players.find(p => p.id === myId);
    const myBoard   = myPS?.board  ?? [];
    const myMoves   = myPS?.moves  ?? 0;
    const mySolved  = myPS?.solved ?? false;
    const amIWinner = match.winner_id === myId;

    // ── Local state ───────────────────────────────────────────────────────────
    const [timeLeft, setTimeLeft]   = useState(difficulty.time);
    const [lastMoved, setLastMoved] = useState<number | null>(null);
    const [question, setQuestion]     = useState<any>(null);
    const [qTime, setQTime]         = useState(REWARD_SECS);
    const [qAnswered, setQAnswered] = useState(false);
    const [qCorrect, setQCorrect]   = useState<boolean | null>(null);
    const [qLoading, setQLoading]   = useState(false);

    const prevTickRef    = useRef(difficulty.time);
    const rewardDoneRef  = useRef(false);
    const timeLeftRef   = useRef(difficulty.time);

    // Update refs when difficulty changes
    useEffect(() => {
        timeLeftRef.current = difficulty.time;
    }, [difficulty]);

    // ── Timer ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'playing' || !gs.startedAt) return;
        const tick = () => {
            const left = Math.max(0, difficulty.time - Math.floor((Date.now() - gs.startedAt) / 1000));
            setTimeLeft(left);
            timeLeftRef.current = left;
            if ([30, 20, 10, 5, 4, 3, 2, 1].includes(left) && left !== prevTickRef.current) {
                prevTickRef.current = left;
                play('tick');
            }
            if (left === 0 && isHost && status === 'playing') {
                // Time's up — best score wins
                const best = [...players].filter(p => !p.solved)
                    .sort((a, b) => {
                        const aScore = a.board.filter((v, i) => v !== 0 && v !== i + 1).length;
                        const bScore = b.board.filter((v, i) => v !== 0 && v !== i + 1).length;
                        return aScore - bScore;
                    });
                const winner = players.find(p => p.solved) ?? best[0];
                supabase.from('live_matches').update({
                    status: 'reward_time',
                    winner_id: winner?.id ?? null,
                    game_state: { ...gs, winnerId: winner?.id ?? null },
                }).eq('id', match.id);
            }
        };
        tick();
        const iv = setInterval(tick, 500);
        return () => clearInterval(iv);
    }, [status, gs.startedAt, difficulty, isHost]);

    // ── Fetch reward question ─────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'reward_time' || !amIWinner || rewardDoneRef.current) return;
        rewardDoneRef.current = true;
        play('win');
        triggerBigWinConfetti();
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

    const handleQAnswer = async (ans: string) => {
        if (qAnswered) return;
        setQAnswered(true); setQTime(0);
        const correct = question?.correctAnswer ?? '';
        const sel = ans.trim().toLowerCase();
        const ok = ans !== '__timeout__' && (correct === sel || correct.includes(sel) || sel.includes(correct));
        setQCorrect(ok);
        play(ok ? 'win' : 'wrong');
        if (ok) {
            triggerConfetti();
            await grantPoints(15);
        }
        else toast.error('إجابة خاطئة — حظ أوفر 😅');
        await supabase.from('live_matches').update({ status: 'finished' }).eq('id', match.id);
    };

    // ── Move tile ─────────────────────────────────────────────────────────────
    const handleTileClick = async (idx: number) => {
        if (mySolved || status !== 'playing') return;
        const newBoard = slideTile(myBoard, idx);
        if (!newBoard) return;
        play('slide');
        setLastMoved(myBoard[idx]);
        setTimeout(() => setLastMoved(null), 300);

        const solved = isSolved(newBoard);
        const updatedPlayers = players.map(p =>
            p.id === myId
                ? { ...p, board: newBoard, moves: myMoves + 1, solved, solvedAt: solved ? Date.now() : p.solvedAt }
                : p
        );
        const firstSolver = solved && !gs.winnerId;
        const winnerId    = firstSolver ? myId : gs.winnerId;
        const allSolved   = updatedPlayers.every(p => p.solved);

        if (solved) {
            play('win');
            triggerConfetti();
        }

        await supabase.from('live_matches').update({
            game_state: { ...gs, players: updatedPlayers, winnerId },
            status:     firstSolver || allSolved ? 'reward_time' : 'playing',
            winner_id:  winnerId,
        }).eq('id', match.id);
    };

    // ── Host starts ───────────────────────────────────────────────────────────
    const handleStart = async () => {
        play('gameStart');
        triggerConfetti();

        // All players get the SAME scrambled board for fairness
        const gridSize = difficulty.grid;
        const sharedBoard = shuffleBoard(gridSize);
        const matchPlayers: PlayerGS[] = match.players.map((p: any) => ({
            id: p.id, name: p.name,
            board:    [...sharedBoard],
            moves:    0,
            solved:   false,
            solvedAt: null,
        }));
        await supabase.from('live_matches').update({
            status: 'playing',
            game_state: {
                difficulty: selectedDifficulty,
                players:    matchPlayers,
                startedAt:  Date.now(),
                winnerId:   null,
            },
        }).eq('id', match.id);
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const timerPct    = timeLeft / difficulty.time;
    const timerColor  = timerPct < 0.2 ? '#ef4444' : timerPct < 0.4 ? '#f97316' : '#22c55e';
    const sortedPlayers = [...players].sort((a, b) => {
        if (a.solved && !b.solved) return -1;
        if (!a.solved && b.solved) return 1;
        if (a.solved && b.solved) return (a.solvedAt ?? 0) - (b.solvedAt ?? 0);
        return a.moves - b.moves;
    });

    // Adjacent to empty = can slide
    const canSlide = (idx: number): boolean => !!slideTile(myBoard, idx);

    // ─────────────────────────────────────────────────────────────────────────
    // WAITING
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className={`py-8 px-4 flex flex-col items-center gap-4 min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gradient-to-b from-slate-50 to-slate-100'}`} dir="rtl">
            {/* Header with Dark Mode Toggle */}
            <div className="w-full flex items-center justify-between px-2">
                <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`p-2 rounded-full transition-all duration-300 ${
                        isDarkMode
                            ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700 border border-slate-700'
                            : 'bg-white text-slate-600 hover:bg-slate-200 shadow-md border border-slate-200'
                    }`}
                >
                    {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <h2 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>لعبة الأرقام</h2>
                <div className="w-9" />
            </div>

            {/* Preview mini board */}
            <div className={`rounded-2xl p-4 shadow-2xl ${
                isDarkMode
                    ? 'bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600'
                    : 'bg-gradient-to-br from-amber-700 to-orange-800'
            }`}>
                <div
                    className="grid gap-1"
                    style={{ gridTemplateColumns: `repeat(4, 1fr)`, width: 160, height: 160 }}
                >
                    {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,0].map((v, i) => (
                        <div
                            key={i}
                            className="rounded-lg flex items-center justify-center text-sm font-black"
                            style={{
                                background: v === 0
                                    ? isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)'
                                    : isDarkMode
                                        ? 'linear-gradient(145deg, #334155, #475569)'
                                        : 'linear-gradient(145deg, #fde68a, #fbbf24)',
                                border: v === 0 ? 'none' : `1.5px solid ${isDarkMode ? '#475569' : '#ca8a04'}`,
                                color: v === 0 ? 'transparent' : isDarkMode ? '#e2e8f0' : '#78350f',
                                boxShadow: v === 0 ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.3)',
                            }}
                        >
                            {v !== 0 && v}
                        </div>
                    ))}
                </div>
            </div>

            <div className="text-center">
                <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    لعبة الأرقام 🔢
                </h3>
                <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1`}>
                    رتّب الأرقام من 1 إلى {difficulty.grid * difficulty.grid - 1}
                </p>
            </div>

            {/* Difficulty Selection (Host Only) */}
            {isHost && (
                <div className={`w-full max-w-sm rounded-2xl p-4 ${isDarkMode ? 'bg-slate-800/50' : 'bg-white'} shadow-lg border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-3">
                        <Target className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-amber-600'}`} />
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
                                <div className="grid grid-cols-2 gap-2 text-center">
                                    <div>
                                        <p className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                            {selected.grid}×{selected.grid}
                                        </p>
                                        <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>شبكة</p>
                                    </div>
                                    <div>
                                        <p className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                            {Math.floor(selected.time / 60)}:{String(selected.time % 60).padStart(2, '0')}
                                        </p>
                                        <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>وقت</p>
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
                                : 'bg-amber-50 border-amber-200'
                        }`}
                    >
                        <div className={`w-2 h-2 rounded-full ${p.id === myId ? 'bg-green-400' : 'bg-slate-400'}`} />
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-amber-800'}`}>{p.name}</span>
                        {p.id === myId && (
                            <span className={`text-[10px] ${isDarkMode ? 'text-green-400' : 'text-amber-500'}`}>(أنت)</span>
                        )}
                    </div>
                ))}
            </div>

            {isHost ? (
                <div className="flex flex-col items-center gap-2 w-full max-w-xs">
                    <button
                        onClick={handleStart}
                        disabled={match.players?.length < 2}
                        className={`w-full bg-gradient-to-r ${difficulty.bgGradient} text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
                    >
                        <Zap className="w-6 h-6" />
                        ابدأ اللعبة
                    </button>
                    {match.players?.length < 2 && (
                        <div className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl ${
                            isDarkMode
                                ? 'bg-amber-900/30 text-amber-400 border border-amber-700'
                                : 'bg-amber-50 border border-amber-200 text-amber-700'
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
        <div className={`flex flex-col gap-3 py-2 px-3 min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gradient-to-b from-slate-100 to-slate-200'}`} dir="rtl">
            {/* Header */}
            <div className={`rounded-2xl p-3 text-white shadow-lg bg-gradient-to-br ${difficulty.bgGradient}`}>
                <div className="flex items-center justify-between mb-2">
                    {/* Left: Moves */}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-black text-white/80">
                                حركاتك: <span className="text-xl text-white">{myMoves}</span>
                            </span>
                            {mySolved && (
                                <span className="text-[10px] font-black bg-green-500 text-white px-2 py-0.5 rounded-full animate-bounce">
                                    ✓ حللتها! 🎉
                                </span>
                            )}
                        </div>
                        {/* Opponents */}
                        {players.length > 1 && (
                            <div className="flex gap-1.5 flex-wrap">
                                {sortedPlayers.filter(p => p.id !== myId).map(p => (
                                    <div
                                        key={p.id}
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            p.solved
                                                ? 'bg-green-500/40 text-green-200'
                                                : isDarkMode
                                                    ? 'bg-white/15 text-white/80'
                                                    : 'bg-white/25 text-white/90'
                                        }`}
                                    >
                                        {p.solved ? '✓' : `${p.moves}🔀`} {p.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Timer + Difficulty */}
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold bg-white/20`}>
                            {difficulty.emoji} {difficulty.label}
                        </span>
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

            {/* Board */}
            <div className={`rounded-2xl p-3 shadow-2xl mx-auto w-full max-w-xs ${
                isDarkMode
                    ? 'bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-600'
                    : 'bg-gradient-to-br from-amber-700 to-orange-800'
            }`}>
                {/* Inner frame */}
                <div
                    className="rounded-xl p-2"
                    style={{
                        background: isDarkMode ? 'rgba(0,0,0,0.5)' : 'linear-gradient(145deg, #7c3c0e, #5c2d0a)',
                        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)',
                    }}
                >
                    <div
                        className="grid gap-1.5"
                        style={{
                            gridTemplateColumns: `repeat(${difficulty.grid}, 1fr)`,
                            aspectRatio: '1',
                        }}
                    >
                        {myBoard.map((val, i) => (
                            <Tile
                                key={i}
                                value={val}
                                canSlide={canSlide(i)}
                                onClick={() => handleTileClick(i)}
                                justMoved={val !== 0 && val === lastMoved}
                                difficulty={difficulty}
                                isDarkMode={isDarkMode}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Solved Message */}
            {mySolved && (
                <div className={`rounded-2xl p-4 text-center border-2 ${
                    isDarkMode
                        ? 'bg-green-900/30 border-green-600'
                        : 'bg-green-50 border-green-300'
                }`}>
                    <Trophy className={`w-10 h-10 mx-auto mb-2 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-400'}`}/>
                    <p className={`text-sm font-black ${isDarkMode ? 'text-green-400' : 'text-green-800'}`}>
                        🎉 رتّبتها في {myMoves} حركة!
                    </p>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-green-600'} mt-1`}>
                        في انتظار باقي اللاعبين...
                    </p>
                </div>
            )}

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
        <div className={`flex flex-col gap-3 py-2 px-3 min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gradient-to-b from-slate-100 to-slate-200'}`} dir="rtl">
            {amIWinner ? (
                <>
                    <div className={`rounded-2xl p-5 text-center text-white shadow-xl bg-gradient-to-br ${difficulty.bgGradient}`}>
                        <Trophy className="w-16 h-16 mx-auto mb-3 drop-shadow-xl animate-bounce"/>
                        <h3 className="text-2xl font-black">🎉 أنت الأسرع!</h3>
                        <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-200' : 'text-white/80'}`}>
                            رتّبتها أولاً! أجب على السؤال لتكسب النقاط
                        </p>
                        <p className={`text-xs mt-2 ${isDarkMode ? 'text-slate-300' : 'text-white/60'}`}>
                            {difficulty.emoji} {difficulty.label}
                        </p>
                    </div>
                    {qLoading ? (
                        <div className="text-center py-6">
                            <Loader2 className={`w-8 h-8 animate-spin mx-auto mb-2 ${isDarkMode ? 'text-purple-400' : 'text-amber-400'}`}/>
                            <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`}>جاري تحضير السؤال...</p>
                        </div>
                    ) : question && !qAnswered ? (
                        <QuestionScreen
                            question={question}
                            onAnswer={handleQAnswer}
                            timeLeft={qTime}
                            answered={qAnswered}
                            isCorrect={qCorrect}
                            isDarkMode={isDarkMode}
                            difficulty={difficulty}
                        />
                    ) : qAnswered && (
                        <div className={`rounded-xl p-4 text-center font-black ${
                            qCorrect
                                ? isDarkMode ? 'bg-green-900/50 text-green-400 border border-green-700' : 'bg-green-100 text-green-800'
                                : isDarkMode ? 'bg-red-900/50 text-red-400 border border-red-700' : 'bg-red-100 text-red-700'
                        }`}>
                            {qCorrect ? '✅ أجبت صح! +15 نقطة 🎉' : '❌ إجابة خاطئة'}
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-10 px-4">
                    <Loader2 className={`w-12 h-12 animate-spin mx-auto mb-4 ${isDarkMode ? 'text-purple-400' : 'text-amber-300'}`}/>
                    <h3 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                        {players.find(p => p.id === match.winner_id)?.name} يجيب على السؤال...
                    </h3>
                    {/* Show final board state */}
                    {myBoard.length > 0 && (
                        <div className={`mt-4 rounded-xl p-2 mx-auto inline-block ${
                            isDarkMode
                                ? 'bg-slate-800 border border-slate-600'
                                : 'bg-gradient-to-br from-amber-700 to-orange-800'
                        }`}>
                            <div
                                className="grid gap-1 rounded-lg p-1"
                                style={{
                                    gridTemplateColumns: `repeat(${difficulty.grid},1fr)`,
                                    width: 120,
                                    background: isDarkMode ? '#1e293b' : '#5c2d0a',
                                }}
                            >
                                {myBoard.map((v, i) => (
                                    <div
                                        key={i}
                                        className="rounded flex items-center justify-center text-xs font-black"
                                        style={{
                                            height: 24,
                                            background: v === 0
                                                ? isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)'
                                                : isDarkMode
                                                    ? 'linear-gradient(145deg, #334155, #475569)'
                                                    : 'linear-gradient(145deg,#fde68a,#fbbf24)',
                                            color: v === 0 ? 'transparent' : isDarkMode ? '#e2e8f0' : '#78350f',
                                            border: v === 0 ? 'none' : `1px solid ${isDarkMode ? '#475569' : '#ca8a04'}`,
                                        }}
                                    >
                                        {v !== 0 && v}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // FINISHED
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'finished') return (
        <div className={`flex flex-col gap-3 py-2 px-3 min-h-screen animate-in fade-in duration-400 ${isDarkMode ? 'bg-slate-900' : 'bg-gradient-to-b from-slate-100 to-slate-200'}`} dir="rtl">
            {/* Winner Banner */}
            <div className={`rounded-2xl p-5 text-center text-white shadow-xl ${
                amIWinner
                    ? `bg-gradient-to-br ${difficulty.bgGradient}`
                    : isDarkMode
                        ? 'bg-gradient-to-br from-slate-600 to-slate-700 border border-slate-500'
                        : 'bg-gradient-to-br from-gray-500 to-gray-700'
            }`}>
                {amIWinner ? (
                    <>
                        <Trophy className="w-16 h-16 mx-auto mb-3 animate-bounce"/>
                        <h3 className="text-2xl font-black">فزت! 🏆</h3>
                        <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-200' : 'text-white/80'}`}>
                            {myMoves} حركة | {difficulty.emoji} {difficulty.label}
                        </p>
                    </>
                ) : (
                    <>
                        <div className={`text-5xl mb-3 ${isDarkMode ? 'filter drop-shadow-lg' : ''}`}>🔢</div>
                        <h3 className="text-xl font-black">انتهت اللعبة</h3>
                        <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`}>
                            {sortedPlayers[0]?.name} فاز!
                        </p>
                    </>
                )}
            </div>

            {/* Rankings */}
            <div className={`rounded-2xl p-4 ${isDarkMode ? 'bg-slate-800/50' : 'bg-white'} border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                <p className={`text-sm font-black mb-3 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    🏅 الترتيب النهائي
                </p>
                <div className="space-y-2">
                    {sortedPlayers.map((p, i) => {
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
                        const isWinner = i === 0;
                        return (
                            <div
                                key={p.id}
                                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                                    p.id === myId
                                        ? isWinner
                                            ? isDarkMode ? 'border-yellow-500 bg-yellow-900/20' : 'border-yellow-300 bg-yellow-50'
                                            : isDarkMode ? 'border-purple-500 bg-purple-900/20' : 'border-indigo-300 bg-indigo-50'
                                        : isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-100 bg-white'
                                } ${isWinner ? 'ring-2 ring-yellow-400 ring-offset-2' : ''}`}
                            >
                                <span className="text-xl w-10 text-center">{medal}</span>
                                <div className="flex-1">
                                    <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                                        {p.name}
                                        {p.id === myId && (
                                            <span className={`text-[10px] mr-1 ${isDarkMode ? 'text-purple-400' : 'text-indigo-500'}`}>(أنت)</span>
                                        )}
                                    </p>
                                    <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                                        {p.moves} حركة
                                    </p>
                                </div>
                                {p.solved ? (
                                    <span className={`text-xs font-black px-2 py-1 rounded-full ${
                                        isDarkMode ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-700'
                                    }`}>
                                        ✓ حلّها
                                    </span>
                                ) : (
                                    <span className={`text-xs font-black px-2 py-1 rounded-full ${
                                        isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        لم يكمل
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
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
                        ? 'bg-purple-600 text-white hover:bg-purple-500'
                        : `bg-gradient-to-r ${difficulty.bgGradient} text-white`
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
