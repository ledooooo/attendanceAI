import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Trophy, Timer, BrainCircuit, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const SIZE        = 4;          // 4×4 grid
const TILES       = SIZE * SIZE; // 16 cells, tile 0 = empty
const ROUND_SECS  = 90;
const REWARD_SECS = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Solved state: [1,2,3,...,15,0]
function solvedBoard(): number[] {
    return [...Array.from({ length: TILES - 1 }, (_, i) => i + 1), 0];
}

function isSolved(board: number[]): boolean {
    return board.every((v, i) => v === (i < TILES - 1 ? i + 1 : 0));
}

// Count inversions to check solvability
function isSolvable(board: number[]): boolean {
    const arr = board.filter(x => x !== 0);
    let inv = 0;
    for (let i = 0; i < arr.length; i++)
        for (let j = i + 1; j < arr.length; j++)
            if (arr[i] > arr[j]) inv++;
    const blankRow = Math.floor(board.indexOf(0) / SIZE); // 0-indexed from top
    const blankFromBottom = SIZE - blankRow;
    if (SIZE % 2 === 1) return inv % 2 === 0;
    if (blankFromBottom % 2 === 0) return inv % 2 === 1;
    return inv % 2 === 0;
}

function shuffleBoard(): number[] {
    let board: number[];
    do {
        board = [...Array.from({ length: TILES - 1 }, (_, i) => i + 1), 0];
        for (let i = board.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [board[i], board[j]] = [board[j], board[i]];
        }
    } while (!isSolvable(board) || isSolved(board));
    return board;
}

// Returns new board after sliding tile at `idx` into empty space (if adjacent)
function slideTile(board: number[], idx: number): number[] | null {
    const emptyIdx = board.indexOf(0);
    const row = Math.floor(idx / SIZE), col = idx % SIZE;
    const eRow = Math.floor(emptyIdx / SIZE), eCol = emptyIdx % SIZE;
    const adjacent =
        (Math.abs(row - eRow) === 1 && col === eCol) ||
        (Math.abs(col - eCol) === 1 && row === eRow);
    if (!adjacent) return null;
    const nb = [...board];
    [nb[idx], nb[emptyIdx]] = [nb[emptyIdx], nb[idx]];
    return nb;
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
    return useCallback((type: 'slide' | 'win' | 'wrong' | 'tick') => {
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
            if (type === 'win') {
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
        } catch (_) {}
    }, []);
}

// ─── Tile component ───────────────────────────────────────────────────────────
function Tile({ value, canSlide, onClick, justMoved }: {
    value: number; canSlide: boolean; onClick: () => void; justMoved: boolean;
}) {
    if (value === 0) {
        return (
            <div className="rounded-xl"
                style={{ background: 'rgba(0,0,0,0.35)', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)' }}/>
        );
    }

    // Color tiers for numbers
    const tier = value <= 5 ? 0 : value <= 10 ? 1 : 2;
    const gradients = [
        'linear-gradient(145deg, #f5deb3, #daa520)',   // warm wood 1-5
        'linear-gradient(145deg, #e8c898, #c8922a)',   // darker wood 6-10
        'linear-gradient(145deg, #d4a96a, #b8722a)',   // deep wood 11-15
    ];
    const borderColors = ['#8B6914', '#7a5a10', '#6b4c0e'];

    return (
        <button
            onClick={onClick}
            className="rounded-xl font-black flex items-center justify-center relative overflow-hidden select-none focus:outline-none"
            style={{
                background: gradients[tier],
                border: `2px solid ${borderColors[tier]}`,
                boxShadow: justMoved
                    ? `0 0 0 3px #fbbf24, 0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.4)`
                    : `0 4px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.2)`,
                transform: canSlide ? 'translateY(0)' : undefined,
                cursor: canSlide ? 'pointer' : 'default',
                transition: 'box-shadow 0.15s, transform 0.1s',
                fontSize: 'clamp(16px, 5vw, 26px)',
            }}
            onMouseDown={e => canSlide && (e.currentTarget.style.transform = 'scale(0.93)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
            {/* Wood grain lines */}
            <div className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                    backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(139,69,19,0.3) 6px, rgba(139,69,19,0.3) 7px)',
                }}/>
            {/* Number */}
            <span className="relative z-10 font-black"
                style={{
                    color: '#7f1d1d',
                    textShadow: '0 1px 0 rgba(255,255,255,0.5), 0 -1px 0 rgba(0,0,0,0.3)',
                    WebkitTextStroke: '0.5px rgba(139,0,0,0.4)',
                }}>
                {value}
            </span>
            {/* Shine */}
            <div className="absolute top-0.5 left-1 right-1 h-2 rounded-full opacity-30 pointer-events-none"
                style={{ background: 'linear-gradient(white, transparent)' }}/>
        </button>
    );
}

// ─── Question Screen ──────────────────────────────────────────────────────────
function QuestionScreen({ question, onAnswer, timeLeft, answered, isCorrect }: {
    question: any; onAnswer: (opt: string) => void;
    timeLeft: number; answered: boolean; isCorrect: boolean | null;
}) {
    return (
        <div className="bg-white rounded-2xl border-2 border-amber-300 p-4 space-y-3 shadow-xl animate-in zoom-in duration-300" dir="rtl">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-amber-600"/>
                    <span className="text-xs font-black text-amber-700">سؤال المكافأة 🎯</span>
                </div>
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-black text-xs border-2 ${
                    timeLeft <= 5 ? 'bg-red-100 border-red-400 text-red-700 animate-pulse' :
                    'bg-amber-50 border-amber-300 text-amber-700'
                }`}>
                    <Timer className="w-3 h-3"/> {timeLeft}ث
                </div>
            </div>
            <p className="text-sm font-bold text-gray-800 leading-relaxed">{question.questionText}</p>
            {!answered ? (
                <div className="space-y-2">
                    {question.options.map((opt: string, i: number) => (
                        <button key={i} onClick={() => onAnswer(opt)}
                            className="w-full bg-white border-2 border-gray-100 p-3 rounded-xl font-bold text-gray-700 hover:border-amber-400 hover:bg-amber-50 active:scale-95 transition-all text-sm text-right">
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
    players:   PlayerGS[];
    startedAt: number;
    winnerId:  string | null;
}

interface Props {
    match:       any;
    employee:    Employee;
    onExit:      () => void;
    grantPoints: (pts: number) => Promise<void>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PuzzleGame({ match, employee, onExit, grantPoints }: Props) {
    const play   = useSound();
    const myId   = employee.employee_id;
    const isHost = match.players?.[0]?.id === myId;

    const gs: PuzzleGS        = match.game_state ?? {};
    const players: PlayerGS[] = gs.players ?? [];
    const status: string      = match.status ?? 'waiting';

    const myPS     = players.find(p => p.id === myId);
    const myBoard  = myPS?.board  ?? [];
    const myMoves  = myPS?.moves  ?? 0;
    const mySolved = myPS?.solved ?? false;
    const amIWinner = match.winner_id === myId;

    // ── Local state ───────────────────────────────────────────────────────────
    const [timeLeft, setTimeLeft]   = useState(ROUND_SECS);
    const [lastMoved, setLastMoved] = useState<number | null>(null);
    const [question, setQuestion]   = useState<any>(null);
    const [qTime, setQTime]         = useState(REWARD_SECS);
    const [qAnswered, setQAnswered] = useState(false);
    const [qCorrect, setQCorrect]   = useState<boolean | null>(null);
    const [qLoading, setQLoading]   = useState(false);

    const prevTickRef   = useRef(ROUND_SECS);
    const rewardDoneRef = useRef(false);

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
                // Time's up — best score wins
                const best = [...players].filter(p => !p.solved)
                    .sort((a, b) => {
                        const aEmpty = a.board.indexOf(0);
                        const bEmpty = b.board.indexOf(0);
                        // Closest to solved = fewer misplaced tiles
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
    }, [status, gs.startedAt]);

    // ── Fetch reward question ─────────────────────────────────────────────────
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

    // ── Move tile ─────────────────────────────────────────────────────────────
    const handleTileClick = async (idx: number) => {
        if (mySolved || status !== 'playing') return;
        const newBoard = slideTile(myBoard, idx);
        if (!newBoard) return;
        play('slide');
        setLastMoved(myBoard[idx]); // animate the tile that moved
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

        if (solved) play('win');

        await supabase.from('live_matches').update({
            game_state: { ...gs, players: updatedPlayers, winnerId },
            status:     firstSolver || allSolved ? 'reward_time' : 'playing',
            winner_id:  winnerId,
        }).eq('id', match.id);
    };

    // ── Host starts ───────────────────────────────────────────────────────────
    const handleStart = async () => {
        // All players get the SAME scrambled board for fairness
        const sharedBoard = shuffleBoard();
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
                players:   matchPlayers,
                startedAt: Date.now(),
                winnerId:  null,
            },
        }).eq('id', match.id);
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const timerPct   = timeLeft / ROUND_SECS;
    const timerColor = timerPct < 0.2 ? '#ef4444' : timerPct < 0.4 ? '#f97316' : '#22c55e';
    const sortedPlayers = [...players].sort((a, b) => {
        if (a.solved && !b.solved) return -1;
        if (!a.solved && b.solved) return 1;
        if (a.solved && b.solved) return (a.solvedAt ?? 0) - (b.solvedAt ?? 0);
        return a.moves - b.moves;
    });

    // Adjacent to empty = can slide
    const emptyIdx  = myBoard.indexOf(0);
    const canSlide  = (idx: number): boolean => !!slideTile(myBoard, idx);

    // ─────────────────────────────────────────────────────────────────────────
    // WAITING
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className="py-8 px-4 flex flex-col items-center gap-4" dir="rtl">
            {/* Preview mini board */}
            <div className="rounded-2xl p-3 shadow-2xl"
                style={{ background: 'linear-gradient(145deg, #92400e, #78350f)' }}>
                <div className="grid gap-1 mb-0"
                    style={{ gridTemplateColumns: `repeat(4, 1fr)`, width: 160, height: 160 }}>
                    {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,0].map((v, i) => (
                        <div key={i} className="rounded-lg flex items-center justify-center text-sm font-black"
                            style={{
                                background: v === 0
                                    ? 'rgba(0,0,0,0.4)'
                                    : 'linear-gradient(145deg, #f5deb3, #daa520)',
                                border: v === 0 ? 'none' : '1.5px solid #8B6914',
                                color: '#7f1d1d',
                                boxShadow: v === 0 ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.3)',
                            }}>
                            {v !== 0 && v}
                        </div>
                    ))}
                </div>
            </div>

            <div className="text-center">
                <h3 className="text-xl font-black text-gray-800 mb-1">لعبة الأرقام 🔢</h3>
                <p className="text-sm font-bold text-gray-400 mb-1">رتّب الأرقام من 1 إلى 15</p>
                <p className="text-xs text-gray-400">{match.players?.length ?? 0} لاعب — {ROUND_SECS} ثانية</p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
                {match.players?.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
                        <span className="text-xs font-bold text-amber-800">{p.name}</span>
                        {p.id === myId && <span className="text-[10px] text-amber-500">(أنت)</span>}
                    </div>
                ))}
            </div>

            {isHost ? (
                <div className="flex flex-col items-center gap-2 w-full max-w-xs">
                    <button onClick={handleStart}
                        disabled={match.players?.length < 2}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100">
                        🎮 ابدأ اللعبة
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
        <div className="flex flex-col gap-3 py-2 px-3" dir="rtl">

            {/* Header */}
            <div className="rounded-2xl p-3 text-white shadow-lg"
                style={{ background: 'linear-gradient(135deg, #92400e, #b45309, #78350f)' }}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-black text-amber-200">حركات: {myMoves}</span>
                            {mySolved && (
                                <span className="text-[10px] font-black bg-green-500 text-white px-2 py-0.5 rounded-full">✓ حللتها!</span>
                            )}
                        </div>
                        {/* Opponents */}
                        {players.length > 1 && (
                            <div className="flex gap-1.5 flex-wrap">
                                {sortedPlayers.filter(p => p.id !== myId).map(p => (
                                    <div key={p.id} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        p.solved ? 'bg-green-500/30 text-green-200' : 'bg-white/15 text-white/80'
                                    }`}>
                                        {p.solved ? '✓' : `${p.moves}🔀`} {p.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Timer */}
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

            {/* Board */}
            <div className="rounded-2xl p-3 shadow-2xl mx-auto w-full max-w-sm"
                style={{ background: 'linear-gradient(145deg, #92400e, #78350f)', border: '3px solid #a16207' }}>
                {/* Inner frame */}
                <div className="rounded-xl p-2"
                    style={{ background: 'linear-gradient(145deg, #7c3c0e, #5c2d0a)', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)' }}>
                    <div className="grid gap-1.5"
                        style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, aspectRatio: '1' }}>
                        {myBoard.map((val, i) => (
                            <Tile
                                key={i}
                                value={val}
                                canSlide={canSlide(i)}
                                onClick={() => handleTileClick(i)}
                                justMoved={val !== 0 && val === lastMoved}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {mySolved && (
                <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-3 text-center">
                    <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-1"/>
                    <p className="text-sm font-black text-green-800">رتّبتها في {myMoves} حركة! 🎉</p>
                    <p className="text-xs text-green-600 mt-1">في انتظار باقي اللاعبين...</p>
                </div>
            )}

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
                    <div className="rounded-2xl p-5 text-center text-white shadow-xl"
                        style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b, #b45309)' }}>
                        <Trophy className="w-14 h-14 mx-auto mb-2 drop-shadow-xl animate-bounce"/>
                        <h3 className="text-2xl font-black">🎉 أنت الأسرع!</h3>
                        <p className="text-amber-100 text-sm mt-1">رتّبتها أولاً! أجب على السؤال لتكسب النقاط</p>
                    </div>
                    {qLoading ? (
                        <div className="text-center py-6">
                            <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto mb-2"/>
                            <p className="text-xs font-bold text-gray-400">جاري تحضير السؤال...</p>
                        </div>
                    ) : question && !qAnswered ? (
                        <QuestionScreen question={question} onAnswer={handleQAnswer}
                            timeLeft={qTime} answered={qAnswered} isCorrect={qCorrect}/>
                    ) : qAnswered && (
                        <div className={`rounded-xl p-4 text-center font-black ${
                            qCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
                        }`}>
                            {qCorrect ? '✅ أجبت صح! +15 نقطة 🎉' : '❌ إجابة خاطئة'}
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-10 px-4">
                    <Loader2 className="w-10 h-10 text-amber-300 animate-spin mx-auto mb-4"/>
                    <h3 className="text-lg font-black text-gray-800">
                        {players.find(p => p.id === match.winner_id)?.name} يجيب على السؤال...
                    </h3>
                    {/* Show final board state */}
                    {myBoard.length > 0 && (
                        <div className="mt-4 rounded-xl p-2 mx-auto inline-block"
                            style={{ background: 'linear-gradient(145deg, #92400e, #78350f)' }}>
                            <div className="grid gap-1 rounded-lg p-1"
                                style={{ gridTemplateColumns: `repeat(4,1fr)`, width: 120, background: '#5c2d0a' }}>
                                {myBoard.map((v, i) => (
                                    <div key={i} className="rounded flex items-center justify-center text-xs font-black"
                                        style={{
                                            height: 26,
                                            background: v === 0 ? 'rgba(0,0,0,0.4)' : 'linear-gradient(145deg,#f5deb3,#daa520)',
                                            color: '#7f1d1d',
                                            border: v === 0 ? 'none' : '1px solid #8B6914',
                                        }}>
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
        <div className="flex flex-col gap-3 py-2 px-3 animate-in fade-in duration-400" dir="rtl">
            <div className={`rounded-2xl p-5 text-center text-white shadow-xl ${
                amIWinner
                    ? 'bg-gradient-to-br from-yellow-400 to-amber-500'
                    : 'bg-gradient-to-br from-gray-500 to-gray-700'
            }`}>
                {amIWinner
                    ? <><Trophy className="w-14 h-14 mx-auto mb-2 animate-bounce"/><h3 className="text-2xl font-black">فزت! 🏆</h3><p className="text-amber-100 text-sm mt-1">{myMoves} حركة</p></>
                    : <><div className="text-5xl mb-2">🔢</div><h3 className="text-xl font-black">انتهت اللعبة</h3></>
                }
            </div>

            {/* Rankings */}
            <div className="space-y-2">
                <p className="text-xs font-black text-gray-500 px-1">الترتيب النهائي:</p>
                {sortedPlayers.map((p, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
                    return (
                        <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
                            p.id === myId ? 'border-amber-300 bg-amber-50' : 'border-gray-100 bg-white'
                        }`}>
                            <span className="text-lg w-8 text-center">{medal}</span>
                            <div className="flex-1">
                                <p className="text-sm font-black text-gray-800">{p.name}{p.id === myId && ' (أنت)'}</p>
                                <p className="text-xs text-gray-400">{p.moves} حركة</p>
                            </div>
                            {p.solved
                                ? <span className="text-xs font-black text-green-600 bg-green-100 px-2 py-0.5 rounded-full">✓ حلّها</span>
                                : <span className="text-xs font-black text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">لم يكمل</span>
                            }
                        </div>
                    );
                })}
            </div>

            <button onClick={onExit}
                className="w-full text-white py-3.5 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}>
                العودة للصالة
            </button>
        </div>
    );

    return null;
}
