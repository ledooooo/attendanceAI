import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Trophy, Timer, BrainCircuit, Users, Sun, Moon, Zap, Target, Crown, Play, RotateCcw, CheckCircle, XCircle, Volume2, VolumeX } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';
import confetti from 'canvas-confetti';

// ─── Difficulty Levels ──────────────────────────────────────────────────────────
const DIFFICULTIES = [
    {
        key: 'easy',
        label: 'سهل',
        emoji: '🟢',
        colors: 4,
        initialSequence: 3,
        showSpeed: 1200,
        inputSpeed: 0,
        timePerRound: 60,
        roundsToWin: 5,
        color: 'from-green-400 to-emerald-500',
        bgGradient: 'from-green-600 to-emerald-700',
        borderGlow: 'rgba(34, 197, 94, 0.5)',
    },
    {
        key: 'medium',
        label: 'متوسط',
        emoji: '🟡',
        colors: 6,
        initialSequence: 4,
        showSpeed: 900,
        inputSpeed: 0,
        timePerRound: 45,
        roundsToWin: 7,
        color: 'from-amber-400 to-orange-500',
        bgGradient: 'from-amber-600 to-orange-700',
        borderGlow: 'rgba(251, 191, 36, 0.5)',
    },
    {
        key: 'hard',
        label: 'صعب',
        emoji: '🔴',
        colors: 8,
        initialSequence: 5,
        showSpeed: 600,
        inputSpeed: 0,
        timePerRound: 30,
        roundsToWin: 10,
        color: 'from-red-500 to-rose-600',
        bgGradient: 'from-red-600 to-rose-700',
        borderGlow: 'rgba(244, 63, 94, 0.5)',
    },
];

// ─── Color Sets ────────────────────────────────────────────────────────────────
const COLOR_SETS = {
    classic: ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500'],
    neon: ['bg-fuchsia-500', 'bg-lime-400', 'bg-cyan-400', 'bg-rose-400', 'bg-amber-400', 'bg-emerald-400', 'bg-violet-500', 'bg-sky-400'],
    pastel: ['bg-rose-300', 'bg-sky-300', 'bg-emerald-300', 'bg-amber-300', 'bg-violet-300', 'bg-cyan-300', 'bg-pink-300', 'bg-teal-300'],
    shapes: ['⬛', '⬜', '🔺', '🔷', '⭐', '💎', '🌟', '🎯'],
};

const COLOR_NAMES = ['أحمر', 'أزرق', 'أخضر', 'أصفر', 'بنفسجي', 'برتقالي', 'وردي', 'سماوي'];

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

    const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
        try {
            const ac = get();
            const o = ac.createOscillator();
            const g = ac.createGain();
            o.connect(g);
            g.connect(ac.destination);
            o.type = type;
            o.frequency.value = frequency;
            const now = ac.currentTime;
            g.gain.setValueAtTime(0.3, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + duration);
            o.start(now);
            o.stop(now + duration);
        } catch (_) {}
    };

    return useCallback((type: 'show' | 'correct' | 'wrong' | 'win' | 'gameStart' | 'click', colorIndex?: number) => {
        const frequencies = [262, 330, 392, 523, 659, 784, 880, 1047];
        const freq = colorIndex !== undefined ? frequencies[colorIndex % frequencies.length] : 440;

        if (type === 'show') {
            playTone(freq, 0.3, 'sine');
        }
        if (type === 'correct') {
            [523, 659, 784].forEach((f, i) => {
                setTimeout(() => playTone(f, 0.2, 'triangle'), i * 100);
            });
        }
        if (type === 'wrong') {
            playTone(200, 0.4, 'sawtooth');
        }
        if (type === 'win') {
            [523, 659, 784, 1047, 1319].forEach((f, i) => {
                setTimeout(() => playTone(f, 0.3, 'triangle'), i * 120);
            });
        }
        if (type === 'gameStart') {
            playTone(400, 0.15, 'sine');
            setTimeout(() => playTone(600, 0.15, 'sine'), 100);
            setTimeout(() => playTone(800, 0.2, 'sine'), 200);
        }
        if (type === 'click') {
            playTone(freq, 0.1, 'square');
        }
    }, []);
}

// ─── Simon Button Component ────────────────────────────────────────────────────
function SimonButton({
    index,
    color,
    isActive,
    isDisabled,
    onClick,
    size,
    difficulty,
    isDarkMode
}: {
    index: number;
    color: string;
    isActive: boolean;
    isDisabled: boolean;
    onClick: () => void;
    size: number;
    difficulty: typeof DIFFICULTIES[number];
    isDarkMode: boolean;
}) {
    const [isHovered, setIsHovered] = useState(false);

    const colorClasses: Record<string, { bg: string; light: string; dark: string; glow: string }> = {
        'bg-red-500': { bg: 'bg-red-500', light: 'bg-red-300', dark: 'bg-red-700', glow: 'rgba(239, 68, 68, 0.6)' },
        'bg-blue-500': { bg: 'bg-blue-500', light: 'bg-blue-300', dark: 'bg-blue-700', glow: 'rgba(59, 130, 246, 0.6)' },
        'bg-green-500': { bg: 'bg-green-500', light: 'bg-green-300', dark: 'bg-green-700', glow: 'rgba(34, 197, 94, 0.6)' },
        'bg-yellow-500': { bg: 'bg-yellow-500', light: 'bg-yellow-300', dark: 'bg-yellow-700', glow: 'rgba(250, 204, 21, 0.6)' },
        'bg-purple-500': { bg: 'bg-purple-500', light: 'bg-purple-300', dark: 'bg-purple-700', glow: 'rgba(168, 85, 247, 0.6)' },
        'bg-orange-500': { bg: 'bg-orange-500', light: 'bg-orange-300', dark: 'bg-orange-700', glow: 'rgba(249, 115, 22, 0.6)' },
        'bg-pink-500': { bg: 'bg-pink-500', light: 'bg-pink-300', dark: 'bg-pink-700', glow: 'rgba(236, 72, 153, 0.6)' },
        'bg-cyan-500': { bg: 'bg-cyan-500', light: 'bg-cyan-300', dark: 'bg-cyan-700', glow: 'rgba(6, 182, 212, 0.6)' },
    };

    const colorClass = colorClasses[color] || colorClasses['bg-blue-500'];

    // Calculate position based on index and grid size
    const gridSize = Math.ceil(Math.sqrt(difficulty.colors));
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;
    const isLastRow = row === gridSize - 1;
    const isLastCol = col === gridSize - 1;

    return (
        <button
            onClick={onClick}
            disabled={isDisabled}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`
                relative rounded-2xl transition-all duration-150
                ${isActive ? colorClass.bg : isDarkMode ? colorClass.dark : colorClass.light}
                ${!isDisabled && !isActive ? 'hover:scale-105 cursor-pointer' : ''}
                ${isDisabled ? 'cursor-not-allowed opacity-60' : ''}
            `}
            style={{
                width: `${size}px`,
                height: `${size}px`,
                boxShadow: isActive
                    ? `0 0 30px ${colorClass.glow}, 0 0 60px ${colorClass.glow}, inset 0 0 30px rgba(255,255,255,0.3)`
                    : isHovered && !isDisabled
                        ? `0 0 15px ${colorClass.glow}, 0 4px 12px rgba(0,0,0,0.3)`
                        : `0 4px 8px rgba(0,0,0,0.3), inset 0 -4px 8px rgba(0,0,0,0.2), inset 0 4px 8px rgba(255,255,255,0.2)`,
                transform: isActive ? 'scale(0.95)' : 'scale(1)',
                borderRadius: isLastRow && isLastCol ? '50%' : '1rem',
            }}
        >
            {/* Shine effect */}
            <div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                    background: isActive
                        ? 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)'
                        : 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%)',
                    borderRadius: isLastRow && isLastCol ? '50%' : '1rem',
                }}
            />

            {/* Number label */}
            <span
                className="absolute inset-0 flex items-center justify-center font-black text-white drop-shadow-lg"
                style={{
                    fontSize: `${Math.max(16, size / 3)}px`,
                    textShadow: '0 2px 4px rgba(0,0,0,0.5), 0 0 10px rgba(0,0,0,0.3)',
                }}
            >
                {index + 1}
            </span>
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
                : 'bg-white border-indigo-200'
        }`} dir="rtl">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BrainCircuit className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-indigo-600'}`}/>
                    <span className={`text-xs font-black ${isDarkMode ? 'text-purple-400' : 'text-indigo-700'}`}>
                        سؤال المكافأة 🎯
                    </span>
                </div>
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-black text-xs border-2 transition-all ${
                    timeLeft <= 5
                        ? 'bg-red-100 border-red-400 text-red-700 animate-pulse'
                        : isDarkMode
                            ? 'bg-slate-700 border-slate-500 text-white'
                            : 'bg-indigo-50 border-indigo-300 text-indigo-700'
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
                                    : 'bg-white border-2 border-gray-100 text-gray-700 hover:border-indigo-400 hover:bg-indigo-50'
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
    id: string;
    name: string;
    currentRound: number;
    isOut: boolean;
    eliminatedAt: number | null;
    sequence: number[];
    playerInput: number[];
    lastCorrect: boolean | null;
}

interface SimonGS {
    difficulty: string;
    players: PlayerGS[];
    currentPlayerIndex: number;
    showingSequence: boolean;
    sequence: number[];
    gamePhase: 'waiting' | 'playing' | 'showing' | 'input' | 'elimination' | 'reward_time' | 'finished';
    startedAt: number;
    winnerId: string | null;
    firstEliminated: string | null;
}

interface Props {
    match: any;
    employee: Employee;
    onExit: () => void;
    grantPoints: (pts: number) => Promise<void>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SimonSaysGame({ match, employee, onExit, grantPoints }: Props) {
    const play = useSound();
    const myId = employee.employee_id;
    const isHost = match.players?.[0]?.id === myId;

    // Dark mode state
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return true;
    });

    // Sound toggle
    const [soundEnabled, setSoundEnabled] = useState(true);
    const playSound = (type: Parameters<typeof play>[0], colorIndex?: number) => {
        if (soundEnabled) {
            play(type, colorIndex);
        }
    };

    // ── Derived from match ────────────────────────────────────────────────────
    const gs: SimonGS = match.game_state ?? {};
    const difficultyKey: string = gs.difficulty || 'medium';
    const difficulty = DIFFICULTIES.find(d => d.key === difficultyKey) || DIFFICULTIES[1];
    const players: PlayerGS[] = gs.players ?? [];
    const status: string = match.status ?? 'waiting';
    const [selectedDifficulty, setSelectedDifficulty] = useState(difficultyKey);
    const [selectedColorSet, setSelectedColorSet] = useState<keyof typeof COLOR_SETS>('classic');

    // ── Local state ───────────────────────────────────────────────────────────
    const [activeButton, setActiveButton] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState(difficulty.timePerRound);
    const [roundTimeLeft, setRoundTimeLeft] = useState(difficulty.timePerRound);
    const [question, setQuestion] = useState<any>(null);
    const [qTime, setQTime] = useState(20);
    const [qAnswered, setQAnswered] = useState(false);
    const [qCorrect, setQCorrect] = useState<boolean | null>(null);
    const [qLoading, setQLoading] = useState(false);

    const prevTickRef = useRef(difficulty.timePerRound);
    const rewardDoneRef = useRef(false);
    const showingRef = useRef(false);

    // My player state
    const myPlayer = players.find(p => p.id === myId);
    const amIWinner = match.winner_id === myId;
    const amIOut = myPlayer?.isOut ?? false;

    // Get current player's turn
    const currentPlayer = players[gs.currentPlayerIndex ?? 0];
    const isMyTurn = currentPlayer?.id === myId;

    // ── Timer ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'playing' || !gs.startedAt) return;

        const tick = () => {
            const elapsed = Math.floor((Date.now() - gs.startedAt) / 1000);
            const left = Math.max(0, difficulty.roundsToWin * difficulty.timePerRound - elapsed);
            setTimeLeft(left);

            if ([30, 20, 10, 5, 4, 3, 2, 1].includes(left) && left !== prevTickRef.current) {
                prevTickRef.current = left;
                playSound('click');
            }

            if (left === 0 && isHost && status === 'playing') {
                handleGameEnd();
            }
        };

        tick();
        const iv = setInterval(tick, 500);
        return () => clearInterval(iv);
    }, [status, gs.startedAt, difficulty, isHost]);

    // Round timer
    useEffect(() => {
        if (status !== 'playing' || gs.gamePhase === 'showing') return;

        const iv = setInterval(() => {
            setRoundTimeLeft(prev => {
                if (prev <= 1) {
                    if (isMyTurn && gs.gamePhase === 'input') {
                        handleTimeout();
                    }
                    return difficulty.timePerRound;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(iv);
    }, [status, gs.gamePhase, isMyTurn, difficulty]);

    const handleTimeout = async () => {
        if (amIOut) return;

        playSound('wrong');
        await supabase.from('live_matches').update({
            game_state: {
                ...gs,
                players: gs.players.map(p =>
                    p.id === myId ? { ...p, isOut: true, eliminatedAt: Date.now(), lastCorrect: false } : p
                ),
            },
        }).eq('id', match.id);
    };

    const handleGameEnd = async () => {
        const activePlayers = players.filter(p => !p.isOut);
        const winner = activePlayers.sort((a, b) => b.currentRound - a.currentRound)[0];

        await supabase.from('live_matches').update({
            status: 'reward_time',
            winner_id: winner?.id ?? null,
            game_state: { ...gs, winnerId: winner?.id ?? null, gamePhase: 'reward_time' },
        }).eq('id', match.id);
    };

    // ── Fetch reward question ─────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'reward_time' || !amIWinner || rewardDoneRef.current) return;
        rewardDoneRef.current = true;
        playSound('win');
        triggerBigWinConfetti();
        setQLoading(true);
        fetchQuestion(employee).then(q => {
            setQLoading(false);
            if (q) { setQuestion(q); setQTime(20); }
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
        playSound(ok ? 'win' : 'wrong');
        if (ok) {
            triggerConfetti();
            await grantPoints(15);
        }
        else toast.error('إجابة خاطئة — حظ أوفر 😅');
        await supabase.from('live_matches').update({ status: 'finished' }).eq('id', match.id);
    };

    // ── Show sequence ─────────────────────────────────────────────────────────
    const showSequence = async (sequence: number[]) => {
        showingRef.current = true;

        for (let i = 0; i < sequence.length; i++) {
            await new Promise(r => setTimeout(r, 300));
            setActiveButton(sequence[i]);
            playSound('show', sequence[i]);
            await new Promise(r => setTimeout(r, difficulty.showSpeed));
            setActiveButton(null);
            await new Promise(r => setTimeout(r, 200));
        }

        showingRef.current = false;

        // Update to input phase
        await supabase.from('live_matches').update({
            game_state: { ...gs, gamePhase: 'input' },
        }).eq('id', match.id);
    };

    // ── Handle player input ──────────────────────────────────────────────────
    const handleButtonClick = async (index: number) => {
        if (!isMyTurn || amIOut || gs.gamePhase !== 'input' || showingRef.current) return;

        playSound('click', index);
        setActiveButton(index);
        setTimeout(() => setActiveButton(null), 200);

        const myPlayerData = myPlayer!;
        const expectedIndex = myPlayerData.playerInput.length;
        const expected = gs.sequence[expectedIndex];

        if (index === expected) {
            // Correct!
            const newInput = [...myPlayerData.playerInput, index];
            const updatedPlayers = gs.players.map(p =>
                p.id === myId ? { ...p, playerInput: newInput, lastCorrect: true } : p
            );

            if (newInput.length === gs.sequence.length) {
                // Completed the sequence!
                playSound('correct');
                triggerConfetti();

                const newRound = myPlayerData.currentRound + 1;

                if (newRound >= difficulty.roundsToWin) {
                    // Winner!
                    await supabase.from('live_matches').update({
                        status: 'reward_time',
                        winner_id: myId,
                        game_state: {
                            ...gs,
                            players: updatedPlayers.map(p =>
                                p.id === myId ? { ...p, currentRound: newRound } : p
                            ),
                            winnerId: myId,
                            gamePhase: 'reward_time',
                        },
                    }).eq('id', match.id);
                } else {
                    // Next round
                    const newSequence = [...gs.sequence, Math.floor(Math.random() * difficulty.colors)];

                    await supabase.from('live_matches').update({
                        game_state: {
                            ...gs,
                            sequence: newSequence,
                            players: updatedPlayers.map(p =>
                                p.id === myId ? { ...p, currentRound: newRound, playerInput: [] } : p
                            ),
                            gamePhase: 'showing',
                        },
                    }).eq('id', match.id);

                    setTimeout(() => showSequence(newSequence), 500);
                }
            } else {
                await supabase.from('live_matches').update({
                    game_state: { ...gs, players: updatedPlayers },
                }).eq('id', match.id);
            }
        } else {
            // Wrong!
            playSound('wrong');

            const updatedPlayers = gs.players.map(p =>
                p.id === myId ? { ...p, isOut: true, eliminatedAt: Date.now(), lastCorrect: false } : p
            );

            await supabase.from('live_matches').update({
                game_state: {
                    ...gs,
                    players: updatedPlayers,
                    firstEliminated: gs.firstEliminated || myId,
                },
            }).eq('id', match.id);
        }
    };

    // ── Start game ──────────────────────────────────────────────────────────
    const handleStart = async () => {
        playSound('gameStart');
        triggerConfetti();

        const initialSequence: number[] = [];
        for (let i = 0; i < difficulty.initialSequence; i++) {
            initialSequence.push(Math.floor(Math.random() * difficulty.colors));
        }

        const matchPlayers: PlayerGS[] = match.players.map((p: any, idx: number) => ({
            id: p.id,
            name: p.name,
            currentRound: 0,
            isOut: false,
            eliminatedAt: null,
            sequence: initialSequence,
            playerInput: [],
            lastCorrect: null,
        }));

        await supabase.from('live_matches').update({
            status: 'playing',
            started_at: new Date().toISOString(),
            game_state: {
                difficulty: selectedDifficulty,
                players: matchPlayers,
                currentPlayerIndex: 0,
                showingSequence: false,
                sequence: initialSequence,
                gamePhase: 'showing',
                startedAt: Date.now(),
                winnerId: null,
                firstEliminated: null,
            },
        }).eq('id', match.id);

        // Show sequence after a short delay
        setTimeout(() => showSequence(initialSequence), 1000);
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const activePlayers = players.filter(p => !p.isOut);
    const eliminatedPlayers = players.filter(p => p.isOut);

    // ─────────────────────────────────────────────────────────────────────────
    // WAITING
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className={`py-8 px-4 flex flex-col items-center gap-4 min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gradient-to-b from-slate-50 to-slate-100'}`} dir="rtl">
            {/* Header */}
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
                <h2 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Simon Says</h2>
                <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`p-2 rounded-full transition-all duration-300 ${
                        isDarkMode
                            ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                            : 'bg-white text-slate-600 hover:bg-slate-200 shadow-md border border-slate-200'
                    }`}
                >
                    {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>
            </div>

            {/* Game Icon */}
            <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl bg-gradient-to-br ${difficulty.bgGradient} ${isDarkMode ? 'shadow-purple-500/20' : ''}`}>
                <span className="text-5xl">🧠</span>
            </div>

            <div className="text-center">
                <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    سيمون سيز | تذكر التسلسل
                </h3>
                <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    تذكر التسلسل وأعد إنتاجه!
                </p>
            </div>

            {/* Difficulty Selection (Host Only) */}
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
                                <div className="grid grid-cols-2 gap-2 text-center">
                                    <div>
                                        <p className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                            {selected.colors}
                                        </p>
                                        <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>ألوان</p>
                                    </div>
                                    <div>
                                        <p className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                            {selected.roundsToWin}
                                        </p>
                                        <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>جولات للفوز</p>
                                    </div>
                                    <div>
                                        <p className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                            {selected.showSpeed / 1000}s
                                        </p>
                                        <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>سرعة العرض</p>
                                    </div>
                                    <div>
                                        <p className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                            {selected.initialSequence}
                                        </p>
                                        <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>للتسلسل الأول</p>
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
                                : 'bg-purple-50 border-purple-200'
                        }`}
                    >
                        <div className={`w-2 h-2 rounded-full ${p.id === myId ? 'bg-green-400' : 'bg-slate-400'}`} />
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-purple-700'}`}>{p.name}</span>
                        {p.id === myId && (
                            <span className={`text-[10px] ${isDarkMode ? 'text-green-400' : 'text-purple-400'}`}>(أنت)</span>
                        )}
                    </div>
                ))}
            </div>

            {isHost ? (
                <div className="flex flex-col items-center gap-2 w-full max-w-xs">
                    <button
                        onClick={handleStart}
                        disabled={match.players?.length < 1}
                        className={`w-full bg-gradient-to-r from-purple-500 to-violet-700 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
                    >
                        <Play className="w-6 h-6" />
                        ابدأ اللعبة
                    </button>
                </div>
            ) : (
                <div className={`flex items-center gap-2 justify-center text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`}>
                    <Loader2 className="w-4 h-4 animate-spin"/>
                    في انتظار المضيف...
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
                    {/* Round Info */}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-black text-white/80">
                                الجولة: <span className="text-xl text-white">{myPlayer?.currentRound ?? 0}/{difficulty.roundsToWin}</span>
                            </span>
                            {amIOut && (
                                <span className="text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full">
                                    OUT
                                </span>
                            )}
                        </div>
                        {/* Sequence progress */}
                        <div className="flex gap-1">
                            {gs.sequence.map((_, i) => {
                                const myProgress = myPlayer?.playerInput?.length ?? 0;
                                const isCompleted = i < myProgress;
                                return (
                                    <div
                                        key={i}
                                        className={`w-4 h-4 rounded-full transition-all ${
                                            isCompleted
                                                ? difficulty.color.includes('green') ? 'bg-green-400' :
                                                  difficulty.color.includes('amber') ? 'bg-amber-400' : 'bg-red-400'
                                                : isDarkMode ? 'bg-white/20' : 'bg-white/30'
                                        }`}
                                    />
                                );
                            })}
                        </div>
                    </div>

                    {/* Timer & Difficulty */}
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold bg-white/20`}>
                            {difficulty.emoji}
                        </span>
                        <div className="relative w-12 h-12">
                            <svg width={48} height={48} viewBox="0 0 48 48" style={{ transform: 'rotate(-90deg)' }}>
                                <circle cx={24} cy={24} r={20} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={3}/>
                                <circle cx={24} cy={24} r={20} fill="none"
                                    stroke={timeLeft <= 10 ? '#ef4444' : timeLeft <= 30 ? '#f97316' : '#22c55e'}
                                    strokeWidth={3}
                                    strokeDasharray={2 * Math.PI * 20}
                                    strokeDashoffset={2 * Math.PI * 20 * (1 - timeLeft / (difficulty.roundsToWin * difficulty.timePerRound))}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 0.5s linear' }}/>
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-white">
                                {timeLeft}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Current status */}
                <div className={`text-center text-xs font-black py-1.5 rounded-lg ${
                    gs.gamePhase === 'showing'
                        ? 'bg-white/20 animate-pulse'
                        : isMyTurn
                            ? 'bg-green-500/30 text-green-200'
                            : 'bg-white/10 text-white/80'
                }`}>
                    {gs.gamePhase === 'showing'
                        ? '👀 شاهد التسلسل...'
                        : isMyTurn
                            ? `دورك! أدخل التسلسل (${myPlayer?.playerInput?.length ?? 0}/${gs.sequence.length})`
                            : `⏳ دور ${currentPlayer?.name}...`
                    }
                </div>
            </div>

            {/* Active Players */}
            {activePlayers.length > 0 && (
                <div className={`rounded-xl p-2 ${isDarkMode ? 'bg-slate-800/50' : 'bg-white'} border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                    <p className={`text-[10px] font-bold mb-1 ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`}>اللاعبين النشطين</p>
                    <div className="flex gap-1 flex-wrap">
                        {activePlayers.map(p => (
                            <span
                                key={p.id}
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    p.id === myId
                                        ? difficulty.color.includes('green') ? 'bg-green-900/50 text-green-300' :
                                          difficulty.color.includes('amber') ? 'bg-amber-900/50 text-amber-300' : 'bg-red-900/50 text-red-300'
                                        : isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                                }`}
                            >
                                {p.name} (ج{p.currentRound})
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Eliminated Players */}
            {eliminatedPlayers.length > 0 && (
                <div className={`rounded-xl p-2 ${isDarkMode ? 'bg-red-900/20' : 'bg-red-50'} border ${isDarkMode ? 'border-red-800' : 'border-red-200'}`}>
                    <p className={`text-[10px] font-bold mb-1 text-red-600`}>اللاعبين الخارجين ({eliminatedPlayers.length})</p>
                    <div className="flex gap-1 flex-wrap">
                        {eliminatedPlayers.map(p => (
                            <span
                                key={p.id}
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold line-through ${
                                    isDarkMode ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-500'
                                }`}
                            >
                                {p.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Game Board */}
            <div className={`rounded-2xl p-4 shadow-2xl mx-auto ${
                isDarkMode
                    ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-slate-700'
                    : 'bg-gradient-to-br from-slate-800 to-slate-900'
            }`}>
                <div
                    className="grid gap-2"
                    style={{
                        gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(difficulty.colors))}, 1fr)`,
                        maxWidth: '320px',
                    }}
                >
                    {COLOR_SETS.classic.slice(0, difficulty.colors).map((color, index) => (
                        <SimonButton
                            key={index}
                            index={index}
                            color={color}
                            isActive={activeButton === index}
                            isDisabled={!isMyTurn || amIOut || gs.gamePhase !== 'input'}
                            onClick={() => handleButtonClick(index)}
                            size={Math.min(150, Math.floor(320 / Math.ceil(Math.sqrt(difficulty.colors)))))}
                            difficulty={difficulty}
                            isDarkMode={isDarkMode}
                        />
                    ))}
                </div>
            </div>

            {/* Round Timer */}
            {gs.gamePhase === 'input' && (
                <div className={`text-center ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                    <span className="text-lg font-black">{roundTimeLeft}</span>
                    <span className="text-xs"> ثانية متبقية للجولة</span>
                </div>
            )}

            {/* Instructions */}
            <div className={`text-center text-xs ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                {gs.gamePhase === 'showing'
                    ? 'شاهد التسلسل بعناية!'
                    : isMyTurn
                        ? 'أعد إنتاج التسلسل بالترتيب الصحيح!'
                        : 'انتظر دورك...'
                }
            </div>

            {/* Toggles */}
            <div className="flex justify-center gap-2">
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
                <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`p-2 rounded-full transition-all duration-300 ${
                        isDarkMode
                            ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                            : 'bg-white text-slate-600 hover:bg-slate-200 shadow-md border border-slate-200'
                    }`}
                >
                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
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
        <div className={`flex flex-col gap-3 py-2 px-3 min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gradient-to-b from-slate-100 to-slate-200'}`} dir="rtl">
            {amIWinner ? (
                <>
                    <div className={`rounded-2xl p-5 text-center text-white shadow-xl bg-gradient-to-br ${difficulty.bgGradient}`}>
                        <Trophy className="w-16 h-16 mx-auto mb-3 drop-shadow-xl animate-bounce"/>
                        <h3 className="text-2xl font-black">🎉 فزت!</h3>
                        <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-200' : 'text-white/80'}`}>
                            أتممت {difficulty.roundsToWin} جولة بنجاح!
                        </p>
                        <p className={`text-xs mt-2 ${isDarkMode ? 'text-slate-300' : 'text-white/60'}`}>
                            {difficulty.emoji} {difficulty.label}
                        </p>
                    </div>
                    {qLoading ? (
                        <div className="text-center py-6">
                            <Loader2 className={`w-8 h-8 animate-spin mx-auto mb-2 ${isDarkMode ? 'text-purple-400' : 'text-indigo-400'}`}/>
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
                    <Loader2 className={`w-12 h-12 animate-spin mx-auto mb-4 ${isDarkMode ? 'text-purple-400' : 'text-indigo-400'}`}/>
                    <h3 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                        {players.find(p => p.id === match.winner_id)?.name} يجيب على السؤال...
                    </h3>
                    <p className={`text-sm mt-2 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                        {myPlayer?.currentRound ?? 0} جولات مكتملة
                    </p>
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
                            {difficulty.roundsToWin} جولات | {difficulty.emoji} {difficulty.label}
                        </p>
                    </>
                ) : (
                    <>
                        <div className="text-5xl mb-3">🧠</div>
                        <h3 className="text-xl font-black">انتهت اللعبة</h3>
                        <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`}>
                            {players.find(p => p.id === match.winner_id)?.name} فاز!
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
                    {[...players].sort((a, b) => {
                        if (a.isOut && !b.isOut) return 1;
                        if (!a.isOut && b.isOut) return -1;
                        return b.currentRound - a.currentRound;
                    }).map((p, i) => {
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
                                        {p.isOut ? 'خرج' : `${p.currentRound} جولة`}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
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

            {/* Toggles */}
            <div className="flex justify-center gap-2 pt-2">
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
