import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Trophy, Users, Timer, CheckCircle, BrainCircuit, Zap, Target, RotateCcw, Moon, Sun, Settings, Star, Award, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { Employee } from '../../../types';

// ─── Difficulty Levels ─────────────────────────────────────────────────────────
const DIFFICULTIES = [
    { key: 'easy',   label: 'سهل',      emoji: '🟢', bottles: 4, attempts: 8,  time: 180, color: 'from-green-400 to-emerald-500'   },
    { key: 'medium', label: 'متوسط',     emoji: '🟡', bottles: 5, attempts: 10, time: 120, color: 'from-amber-400 to-orange-500'   },
    { key: 'hard',   label: 'صعب',      emoji: '🔴', bottles: 6, attempts: 8,  time: 90,  color: 'from-red-500 to-rose-600'      },
];

// ─── Colors (Extended) ────────────────────────────────────────────────────────
const COLORS_PALETTE = [
    { id: 'red',    label: 'أحمر',       bg: '#dc2626', light: '#fca5a5', dark: '#7f1d1d', glow: '#f87171' },
    { id: 'blue',   label: 'أزرق',       bg: '#2563eb', light: '#93c5fd', dark: '#1e3a8a', glow: '#60a5fa' },
    { id: 'green',  label: 'أخضر',       bg: '#16a34a', light: '#86efac', dark: '#14532d', glow: '#4ade80' },
    { id: 'yellow', label: 'أصفر',       bg: '#ca8a04', light: '#fde68a', dark: '#713f12', glow: '#fde047' },
    { id: 'purple', label: 'بنفسجي',     bg: '#9333ea', light: '#d8b4fe', dark: '#581c87', glow: '#c084fc' },
    { id: 'orange', label: 'برتقالي',     bg: '#ea580c', light: '#fdba74', dark: '#7c2d12', glow: '#fb923c' },
    { id: 'pink',   label: 'وردي',       bg: '#ec4899', light: '#f9a8d4', dark: '#831843', glow: '#f472b6' },
    { id: 'cyan',   label: 'سماوي',      bg: '#0891b2', light: '#67e8f9', dark: '#164e63', glow: '#22d3ee' },
];

type ColorId = string;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function makeSecret(count: number): ColorId[] {
    const shuffled = shuffle([...COLORS_PALETTE]);
    return shuffled.slice(0, count).map(c => c.id);
}

function makeScrambled(secret: ColorId[]): ColorId[] {
    let s = shuffle([...secret]) as ColorId[];
    while (s.every((c, i) => c === secret[i])) s = shuffle([...secret]) as ColorId[];
    return s;
}

function countCorrect(attempt: ColorId[], secret: ColorId[]): number {
    return attempt.filter((c, i) => c === secret[i]).length;
}

// ─── Question helpers (SIMPLIFIED - No Hints) ─────────────────────────────────
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
    return useCallback((type: 'swap' | 'correct' | 'wrong' | 'win' | 'tick' | 'perfect' | 'select' | 'deselect') => {
        try {
            const ac = get(), now = ac.currentTime;
            if (type === 'swap') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.setValueAtTime(600, now);
                o.frequency.exponentialRampToValueAtTime(400, now + 0.1);
                g.gain.setValueAtTime(0.15, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                o.start(now); o.stop(now + 0.12);
            }
            if (type === 'select') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.value = 800;
                g.gain.setValueAtTime(0.1, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                o.start(now); o.stop(now + 0.08);
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
                o.type = 'sawtooth'; o.frequency.value = 140;
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

// ─── Confetti ─────────────────────────────────────────────────────────────────
const fireConfetti = (intensity: 'normal' | 'big' = 'normal') => {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;';
    document.body.appendChild(canvas);
    const myConfetti = confetti.create(canvas, { resize: true, useWorker: false });
    const colors = ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#f97316', '#fbbf24', '#ffffff', '#22d3ee'];
    const count = intensity === 'big' ? 150 : 80;
    myConfetti({ particleCount: count, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors, zIndex: 99999 });
    myConfetti({ particleCount: count, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors, zIndex: 99999 });
    if (intensity === 'big') {
        setTimeout(() => myConfetti({ particleCount: 200, angle: 90, spread: 160, origin: { x: 0.5, y: 0.2 }, colors, zIndex: 99999 }), 400);
    }
    setTimeout(() => canvas.remove(), 5000);
};

// ─── Bottle SVG (Improved) ────────────────────────────────────────────────────
function Bottle({ colorId, selected, index, onClick, shake, correct }: {
    colorId: ColorId; selected: boolean; index: number;
    onClick: () => void; shake: boolean; correct?: boolean;
}) {
    const color = COLORS_PALETTE.find(c => c.id === colorId)!;
    const uid = `${colorId}${index}`;

    return (
        <button
            onClick={onClick}
            className={`relative flex flex-col items-center gap-1 select-none focus:outline-none transition-all duration-200 ${
                correct ? 'scale-110' : selected ? 'scale-115 translate-y-[-12px]' : 'hover:scale-105'
            }`}
            style={{
                filter: selected || correct
                    ? `drop-shadow(0 0 15px ${color.glow}) drop-shadow(0 8px 16px rgba(0,0,0,0.5))`
                    : 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))',
                animation: shake ? 'wiggle 0.4s ease-in-out' : undefined,
            }}
        >
            <svg viewBox="0 0 48 100" className="w-14 h-28" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id={`b${uid}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor={color.dark}/>
                        <stop offset="30%"  stopColor={color.bg}/>
                        <stop offset="65%"  stopColor={color.light}/>
                        <stop offset="100%" stopColor={color.dark}/>
                    </linearGradient>
                    <linearGradient id={`l${uid}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={color.bg} stopOpacity="0.95"/>
                        <stop offset="100%" stopColor={color.dark} stopOpacity="0.98"/>
                    </linearGradient>
                    <radialGradient id={`g${uid}`} cx="35%" cy="30%" r="65%">
                        <stop offset="0%"   stopColor={color.light} stopOpacity="0.6"/>
                        <stop offset="100%" stopColor="transparent"/>
                    </radialGradient>
                    <clipPath id={`c${uid}`}>
                        <path d="M9 26 Q7 30 7 36 L7 82 Q7 90 16 90 L32 90 Q41 90 41 82 L41 36 Q41 30 39 26 Z"/>
                    </clipPath>
                    <filter id={`f${uid}`}>
                        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={color.dark} floodOpacity="0.5"/>
                    </filter>
                </defs>

                {/* Shadow */}
                <ellipse cx="24" cy="96" rx="14" ry="3" fill="black" opacity="0.3"/>

                {/* Neck */}
                <path d="M17 10 L17 26 L31 26 L31 10 Q31 6 28 6 L20 6 Q17 6 17 10 Z"
                    fill={`url(#b${uid})`} stroke={color.dark} strokeWidth="0.8"/>

                {/* Cap with groove */}
                <rect x="14" y="2" width="20" height="9" rx="4.5" fill={color.dark}/>
                <rect x="14" y="7" width="20" height="2" rx="0" fill="black" opacity="0.25"/>
                <rect x="16" y="3" width="9" height="3" rx="1.5" fill="white" opacity="0.3"/>

                {/* Body */}
                <path d="M9 26 Q7 30 7 36 L7 82 Q7 90 16 90 L32 90 Q41 90 41 82 L41 36 Q41 30 39 26 Z"
                    fill={`url(#l${uid})`} stroke={color.dark} strokeWidth="0.8"
                    filter={`url(#f${uid})`}/>

                {/* Liquid */}
                <rect x="7" y="40" width="34" height="52"
                    fill={`url(#b${uid})`} opacity="0.85"
                    clipPath={`url(#c${uid})`}/>

                {/* Liquid surface wave */}
                <path d="M8 40 Q18 36 28 40 Q36 43 41 40"
                    stroke={color.light} strokeWidth="1.5" fill="none" opacity="0.7"
                    clipPath={`url(#c${uid})`}/>

                {/* Glass highlight */}
                <path d="M9 30 Q7 50 7 70" stroke="white" strokeWidth="2.5"
                    opacity="0.15" fill="none" strokeLinecap="round"/>

                {/* Shine */}
                <ellipse cx="15" cy="52" rx="2" ry="14"
                    fill="white" opacity="0.28" clipPath={`url(#c${uid})`}/>

                {/* Neck shine */}
                <ellipse cx="21" cy="17" rx="2" ry="5" fill="white" opacity="0.35"/>

                {/* Selection glow */}
                {selected && (
                    <ellipse cx="24" cy="58" rx="20" ry="32"
                        fill={`url(#g${uid})`} clipPath={`url(#c${uid})`}/>
                )}

                {/* Correct indicator */}
                {correct && (
                    <circle cx="38" cy="15" r="8" fill="#22c55e" stroke="white" strokeWidth="2"/>
                )}
            </svg>

            <span className="text-[11px] font-black"
                style={{ color: color.glow, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                {color.label}
            </span>
        </button>
    );
}

// ─── Mini Bottle (for history) ───────────────────────────────────────────────
function MiniBottle({ colorId }: { colorId: ColorId }) {
    const color = COLORS_PALETTE.find(c => c.id === colorId)!;
    return (
        <div className="w-6 h-6 rounded-full border-2 border-white/30 shadow-md"
            style={{ background: `radial-gradient(circle at 35% 30%, ${color.light}, ${color.bg} 60%, ${color.dark})` }}
        />
    );
}

// ─── Attempt History Row ──────────────────────────────────────────────────────
function AttemptRow({ attempt, secret, num, isCorrect }: {
    attempt: ColorId[]; secret: ColorId[]; num: number; isCorrect: boolean;
}) {
    const correct = countCorrect(attempt, secret);
    return (
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-all ${
            isCorrect
                ? 'bg-green-500/20 border border-green-400/40'
                : 'bg-white/5 dark:bg-gray-800/50 border border-white/10 dark:border-gray-700'
        }`}>
            <span className={`text-[10px] font-black w-5 text-center ${
                isCorrect ? 'text-green-400' : 'text-white/50 dark:text-gray-400'
            }`}>
                {isCorrect ? '✓' : num}
            </span>
            <div className="flex gap-1.5 flex-1 justify-center">
                {attempt.map((cid, i) => {
                    const isInPlace = cid === secret[i];
                    return (
                        <div key={i} className={`relative`}>
                            <MiniBottle colorId={cid}/>
                            {isInPlace && (
                                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border border-white"/>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className={`text-xs font-black px-2 py-0.5 rounded-full ${
                correct === attempt.length
                    ? 'bg-green-500 text-white'
                    : correct >= attempt.length * 0.6
                        ? 'bg-yellow-500 text-gray-900'
                        : 'bg-white/20 text-white/80'
            }`}>
                {correct}/{attempt.length}
            </div>
        </div>
    );
}

// ─── Question Screen (Simplified) ─────────────────────────────────────────────
function QuestionScreen({ question, onAnswer, timeLeft, answered, isCorrect, loading }: {
    question: any; onAnswer: (opt: string) => void;
    timeLeft: number; answered: boolean; isCorrect: boolean | null; loading: boolean;
}) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-indigo-200 dark:border-indigo-700 p-5 space-y-4 shadow-xl animate-in zoom-in duration-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-indigo-600 dark:text-indigo-400"/>
                    <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">سؤال المكافأة 🎯</span>
                </div>
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full font-black text-xs border-2 transition-all ${
                    timeLeft <= 5
                        ? 'bg-red-100 dark:bg-red-900/30 border-red-400 text-red-700 dark:text-red-300 animate-pulse'
                        : 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300'
                }`}>
                    <Timer className="w-3.5 h-3.5"/> {timeLeft}ث
                </div>
            </div>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100 leading-relaxed text-right">{question.questionText}</p>
            {!answered ? (
                <div className="space-y-2">
                    {question.options.map((opt: string, i: number) => (
                        <button key={i} onClick={() => onAnswer(opt)} disabled={loading}
                            className="w-full bg-white dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 p-3 rounded-xl font-bold text-gray-700 dark:text-gray-200 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 active:scale-98 transition-all text-sm text-right">
                            {opt}
                        </button>
                    ))}
                </div>
            ) : (
                <div className={`text-center py-4 rounded-xl font-black text-base ${
                    isCorrect
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200'
                }`}>
                    {isCorrect ? '✅ إجابة صحيحة! +15 نقطة 🎉' : '❌ إجابة خاطئة — حظ أوفر'}
                </div>
            )}
        </div>
    );
}

// ─── Difficulty Selector ────────────────────────────────────────────────────────
function DifficultySelector({ selected, onSelect }: { selected: string; onSelect: (key: string) => void }) {
    return (
        <div className="grid grid-cols-3 gap-2">
            {DIFFICULTIES.map(diff => (
                <button
                    key={diff.key}
                    onClick={() => onSelect(diff.key)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 font-black text-sm transition-all ${
                        selected === diff.key
                            ? `bg-gradient-to-br ${diff.color} text-white border-transparent shadow-lg scale-105`
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                >
                    <span className="text-2xl">{diff.emoji}</span>
                    <span>{diff.label}</span>
                    <span className="text-[10px] opacity-70">{diff.bottles} زجاجة</span>
                </button>
            ))}
        </div>
    );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ current, max, label, color }: {
    current: number; max: number; label: string; color: string;
}) {
    const pct = (current / max) * 100;
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold">
                <span className="text-gray-500 dark:text-gray-400">{label}</span>
                <span className="text-gray-400">{current}/{max}</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: color }}
                />
            </div>
        </div>
    );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
    match: any;
    employee: Employee;
    onExit: () => void;
    grantPoints: (pts: number) => Promise<void>;
}

// ─── Player state ────────────────────────────────────────────────────────────
interface PlayerGS {
    id:         string;
    name:       string;
    order:      ColorId[];
    attempts:   ColorId[][];
    solved:     boolean;
    eliminated: boolean;
    solvedAt:   number | null;
}

interface BottleGS {
    secret:     ColorId[];
    difficulty: string;
    bottleCount: number;
    maxAttempts: number;
    timeLimit:  number;
    players:    PlayerGS[];
    startedAt:  number;
    winnerId:   string | null;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BottleMatchGame({ match, employee, onExit, grantPoints }: Props) {
    const play = useSound();
    const myId = employee.employee_id;
    const isHost = match.players?.[0]?.id === myId;

    const gs: BottleGS = match.game_state ?? {};
    const secret: ColorId[] = gs.secret ?? [];
    const players: PlayerGS[] = gs.players ?? [];
    const status: string = match.status ?? 'waiting';
    const difficulty = DIFFICULTIES.find(d => d.key === gs.difficulty) ?? DIFFICULTIES[1];
    const bottleCount = gs.bottleCount ?? difficulty.bottles;
    const maxAttempts = gs.maxAttempts ?? difficulty.attempts;
    const timeLimit = gs.timeLimit ?? difficulty.time;

    const myPS = players.find(p => p.id === myId);
    const myOrder: ColorId[] = myPS?.order ?? [];
    const myAttempts: ColorId[][] = myPS?.attempts ?? [];
    const mySolved = myPS?.solved ?? false;
    const myEliminated = myPS?.eliminated ?? false;
    const attemptsLeft = maxAttempts - myAttempts.length;

    // ── Local UI state ────────────────────────────────────────────────────────
    const [selected, setSelected] = useState<number | null>(null);
    const [shakeIdx, setShakeIdx] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState(timeLimit);
    const [checking, setChecking] = useState(false);
    const [lastResult, setLastResult] = useState<number | null>(null);
    const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
    const [isDarkMode, setIsDarkMode] = useState(false);

    // Question state
    const [question, setQuestion] = useState<any>(null);
    const [qTime, setQTime] = useState(20);
    const [qAnswered, setQAnswered] = useState(false);
    const [qCorrect, setQCorrect] = useState<boolean | null>(null);
    const [qLoading, setQLoading] = useState(false);

    const amIWinner = match.winner_id === myId;
    const rewardDoneRef = useRef(false);
    const prevTickRef = useRef(timeLimit);

    // ── Dark Mode ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    // Reset lastResult when new game starts
    useEffect(() => {
        if (status === 'playing') setLastResult(null);
    }, [gs.startedAt]);

    // ── Timer ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'playing' || !gs.startedAt) return;
        const tick = () => {
            const left = Math.max(0, timeLimit - Math.floor((Date.now() - gs.startedAt) / 1000));
            setTimeLeft(left);
            if ([30, 20, 10, 5, 4, 3, 2, 1].includes(left) && left !== prevTickRef.current) {
                prevTickRef.current = left;
                play('tick');
            }
            if (left === 0 && isHost && status === 'playing') {
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
    }, [status, gs.startedAt, timeLimit]);

    // ── Fetch reward question ──────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'reward_time' || !amIWinner || rewardDoneRef.current) return;
        rewardDoneRef.current = true;
        play('win');
        fireConfetti('normal');
        setQLoading(true);
        fetchQuestion(employee).then(q => {
            setQLoading(false);
            if (q) { setQuestion(q); setQTime(20); }
            else {
                grantPoints(15).then(() => {
                    fireConfetti('big');
                    toast.success('فزت! +15 نقطة 🏆');
                });
                setQAnswered(true);
                supabase.from('live_matches').update({ status: 'finished' }).eq('id', match.id);
            }
        });
    }, [status, amIWinner]);

    // ── Question timer ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!question || qAnswered) return;
        if (qTime <= 0) { handleQAnswer('__timeout__'); return; }
        const iv = setInterval(() => setQTime(p => p - 1), 1000);
        return () => clearInterval(iv);
    }, [question, qTime, qAnswered]);

    // ── Handle answer ──────────────────────────────────────────────────────────
    const handleQAnswer = async (ans: string) => {
        if (qAnswered) return;
        setQAnswered(true); setQTime(0);
        const correct = question?.correctAnswer ?? '';
        const sel = ans.trim().toLowerCase();
        const ok = ans !== '__timeout__' && (correct === sel || correct.includes(sel) || sel.includes(correct));
        setQCorrect(ok);
        play(ok ? 'win' : 'wrong');
        if (ok) {
            fireConfetti('big');
            await grantPoints(15);
        }
        else toast.error('إجابة خاطئة — حظ أوفر 😅');
        await supabase.from('live_matches').update({ status: 'finished' }).eq('id', match.id);
    };

    // ── Bottle click ───────────────────────────────────────────────────────────
    const handleBottleClick = (idx: number) => {
        if (mySolved || status !== 'playing') return;
        if (selected === null) {
            setSelected(idx);
            play('select');
            return;
        }
        if (selected === idx) {
            setSelected(null);
            play('deselect');
            return;
        }
        const newOrder = [...myOrder];
        [newOrder[selected], newOrder[idx]] = [newOrder[idx], newOrder[selected]];
        play('swap');
        setSelected(null);
        updateMyOrder(newOrder);
    };

    const updateMyOrder = async (newOrder: ColorId[]) => {
        const updatedPlayers = players.map(p =>
            p.id === myId ? { ...p, order: newOrder } : p
        );
        await supabase.from('live_matches').update({
            game_state: { ...gs, players: updatedPlayers },
        }).eq('id', match.id);
    };

    // ── Check attempt ──────────────────────────────────────────────────────────
    const handleCheck = async () => {
        if (checking || mySolved || myEliminated || status !== 'playing') return;
        setChecking(true);
        const correct = countCorrect(myOrder, secret);
        setLastResult(correct);
        const newAttempts = [...myAttempts, [...myOrder]];
        const isLastAttempt = newAttempts.length >= maxAttempts;

        if (correct === bottleCount) {
            play('perfect');
            fireConfetti('big');
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
            play('wrong');
            const updatedPlayers = players.map(p =>
                p.id === myId
                    ? { ...p, attempts: newAttempts, eliminated: true }
                    : p
            );
            const allDone = updatedPlayers.every(p => p.solved || p.eliminated);
            let winnerId = gs.winnerId;
            let newStatus = 'playing';
            if (allDone && !winnerId) {
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
            play(correct > 0 ? 'correct' : 'wrong');
            const updatedPlayers = players.map(p =>
                p.id === myId ? { ...p, attempts: newAttempts } : p
            );
            await supabase.from('live_matches').update({
                game_state: { ...gs, players: updatedPlayers },
            }).eq('id', match.id);
            // Shake wrong bottles
            myOrder.forEach((cid, i) => {
                if (cid !== secret[i]) {
                    setTimeout(() => setShakeIdx(i), i * 60);
                    setTimeout(() => setShakeIdx(null), i * 60 + 400);
                }
            });
        }
        setChecking(false);
    };

    // ── Host starts ────────────────────────────────────────────────────────────
    const handleStart = async () => {
        const diff = DIFFICULTIES.find(d => d.key === selectedDifficulty) ?? DIFFICULTIES[1];
        const secretOrder = makeSecret(diff.bottles);
        const matchPlayers: PlayerGS[] = match.players.map((p: any) => ({
            id: p.id, name: p.name,
            order: makeScrambled(secretOrder),
            attempts: [],
            solved: false,
            eliminated: false,
            solvedAt: null,
        }));
        await supabase.from('live_matches').update({
            status: 'playing',
            game_state: {
                secret: secretOrder,
                difficulty: diff.key,
                bottleCount: diff.bottles,
                maxAttempts: diff.attempts,
                timeLimit: diff.time,
                players: matchPlayers,
                startedAt: Date.now(),
                winnerId: null,
            },
        }).eq('id', match.id);
    };

    const timerPct = timeLeft / timeLimit;

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

    // ── WAITING ─────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className="text-center py-8 px-4" dir="rtl">
            {/* Dark Mode Toggle */}
            <button
                onClick={() => setIsDarkMode(p => !p)}
                className="absolute top-3 left-12 z-50 p-2 bg-white/10 hover:bg-white/20 dark:bg-gray-800/50 rounded-full text-gray-700 dark:text-gray-200 backdrop-blur-sm shadow-sm"
            >
                {isDarkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
            </button>

            {/* Header */}
            <div className="flex justify-center gap-2 mb-5">
                {DIFFICULTIES[1].bottles > 4
                    ? Array.from({ length: DIFFICULTIES[1].bottles }).map((_, i) => (
                        <div key={i} className="w-6 h-12 rounded-full shadow-lg border-2 border-white/30 animate-pulse"
                            style={{
                                background: COLORS_PALETTE[i % COLORS_PALETTE.length].bg,
                                animationDelay: `${i * 0.1}s`
                            }}/>
                    ))
                    : COLORS_PALETTE.slice(0, 4).map((c, i) => (
                        <div key={c.id} className="w-6 h-12 rounded-full shadow-lg border-2 border-white/30"
                            style={{ background: c.bg, animationDelay: `${i * 0.1}s` }}/>
                    ))
                }
            </div>

            <h3 className="text-xl font-black text-gray-800 dark:text-white mb-1">ترتيب الزجاجات 🍾</h3>
            <p className="text-sm font-bold text-gray-400 dark:text-gray-500 mb-2">{match.players?.length ?? 0} لاعب في الغرفة</p>

            {/* Players */}
            <div className="flex flex-wrap gap-2 justify-center mb-4">
                {match.players?.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 px-3 py-1.5 rounded-full">
                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{p.name}</span>
                        {p.id === myId && <span className="text-[10px] text-indigo-400">(أنت)</span>}
                    </div>
                ))}
            </div>

            {isHost ? (
                <>
                    {/* Difficulty Selection */}
                    <div className="mb-4">
                        <p className="text-xs font-black text-gray-600 dark:text-gray-300 mb-2 flex items-center justify-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500"/> اختر مستوى الصعوبة:
                        </p>
                        <DifficultySelector selected={selectedDifficulty} onSelect={setSelectedDifficulty}/>
                    </div>

                    {/* Difficulty Info */}
                    <div className={`bg-gradient-to-r ${DIFFICULTIES.find(d => d.key === selectedDifficulty)?.color} text-white rounded-xl px-4 py-2 mb-4 inline-block`}>
                        <p className="text-sm font-black">
                            {DIFFICULTIES.find(d => d.key === selectedDifficulty)?.bottles} زجاجة • {DIFFICULTIES.find(d => d.key === selectedDifficulty)?.attempts} محاولة • {Math.floor((DIFFICULTIES.find(d => d.key === selectedDifficulty)?.time ?? 120) / 60)}:{String((DIFFICULTIES.find(d => d.key === selectedDifficulty)?.time ?? 120) % 60).padStart(2, '0')} دقيقة
                        </p>
                    </div>

                    <button onClick={handleStart}
                        disabled={match.players?.length < 2}
                        className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 mx-auto">
                        <Star className="w-5 h-5"/> ابدأ اللعبة
                    </button>

                    {match.players?.length < 2 && (
                        <p className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 rounded-xl mt-3">
                            ⏳ في انتظار لاعب آخر للانضمام...
                        </p>
                    )}
                </>
            ) : (
                <div className="flex items-center gap-2 justify-center text-sm font-bold text-gray-400 dark:text-gray-500 py-6 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                    <Loader2 className="w-4 h-4 animate-spin"/> في انتظار المضيف...
                </div>
            )}

            <button onClick={onExit} className="mt-4 text-sm font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 block mx-auto transition-colors">
                ← العودة
            </button>
        </div>
    );

    // ── PLAYING ──────────────────────────────────────────────────────────────
    if (status === 'playing') return (
        <div className="flex flex-col gap-3 py-2 px-2" dir="rtl">

            {/* Header Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 dark:from-indigo-800 dark:to-violet-900 rounded-2xl p-4 text-white shadow-xl">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex-1 min-w-0">
                        {/* Attempts Progress */}
                        <ProgressBar
                            current={myAttempts.length}
                            max={maxAttempts}
                            label="المحاولات"
                            color="rgba(255,255,255,0.8)"
                        />

                        {/* Last Result */}
                        {lastResult !== null && (
                            <p className={`text-sm font-black mt-2 ${
                                lastResult === bottleCount ? 'text-green-300' :
                                lastResult >= bottleCount * 0.6 ? 'text-yellow-300' : 'text-red-300'
                            }`}>
                                {lastResult === bottleCount ? '🎉 مثالي!' :
                                 lastResult > 0 ? `✅ ${lastResult} من ${bottleCount} صحيحة` :
                                 '❌ لا شيء في مكانه'}
                            </p>
                        )}
                    </div>

                    {/* Timer */}
                    <div className="relative w-16 h-16 flex-shrink-0">
                        <svg width={64} height={64} viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
                            <circle cx={32} cy={32} r={28} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={4}/>
                            <circle cx={32} cy={32} r={28} fill="none"
                                stroke={timerPct < 0.2 ? '#ef4444' : timerPct < 0.4 ? '#f97316' : '#22c55e'}
                                strokeWidth={4}
                                strokeDasharray={2 * Math.PI * 28}
                                strokeDashoffset={2 * Math.PI * 28 * (1 - timerPct)}
                                strokeLinecap="round"
                                style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.4s' }}
                            />
                        </svg>
                        <div className={`absolute inset-0 flex items-center justify-center text-sm font-black ${
                            timerPct < 0.2 ? 'text-red-300' : timerPct < 0.4 ? 'text-orange-300' : 'text-white'
                        }`}>
                            {timeLeft}
                        </div>
                    </div>
                </div>

                {/* Opponents */}
                {players.length > 1 && (
                    <div className="flex gap-2 flex-wrap">
                        {sortedPlayers.filter(p => p.id !== myId).map(p => {
                            const lastAttempt = p.attempts.at(-1) ?? [];
                            const score = countCorrect(lastAttempt, secret);
                            return (
                                <div key={p.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                                    p.solved
                                        ? 'bg-green-400/30 text-green-200 border border-green-400/40'
                                        : p.eliminated
                                            ? 'bg-red-400/30 text-red-300 border border-red-400/40'
                                            : 'bg-white/15 text-white/90 border border-white/20'
                                }`}>
                                    {p.solved ? '✓' : p.eliminated ? '✗' : `${score}/${bottleCount}`}
                                    <span className="mr-1">{p.name}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* My Game Area */}
            {!mySolved && !myEliminated ? (
                <div className="rounded-2xl p-5 shadow-2xl relative overflow-hidden"
                    style={{ background: 'linear-gradient(145deg, #0f0c29 0%, #1a1040 50%, #0d1117 100%)' }}>
                    <style>{`@keyframes wiggle{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px) rotate(-5deg)}40%{transform:translateX(8px) rotate(5deg)}60%{transform:translateX(-5px) rotate(-3deg)}80%{transform:translateX(5px) rotate(3deg)}}`}</style>

                    {/* Glow Effects */}
                    <div className="absolute top-4 left-8 w-24 h-24 rounded-full opacity-10"
                        style={{ background: 'radial-gradient(circle, #818cf8, transparent)' }}/>
                    <div className="absolute bottom-4 right-8 w-20 h-20 rounded-full opacity-10"
                        style={{ background: 'radial-gradient(circle, #34d399, transparent)' }}/>

                    {/* Instructions */}
                    <p className="relative text-[11px] font-black text-center mb-5 text-white/40 tracking-wider">
                        {selected !== null ? '← اختر الزجاجة الثانية للتبديل' : 'اضغط زجاجتين لتبديلهما'}
                    </p>

                    {/* Bottles */}
                    <div className="relative flex justify-center gap-4 mb-4">
                        {myOrder.map((cid, i) => (
                            <Bottle
                                key={i} colorId={cid} index={i}
                                selected={selected === i}
                                shake={shakeIdx === i}
                                onClick={() => handleBottleClick(i)}
                            />
                        ))}
                    </div>

                    {/* Position Numbers */}
                    <div className="flex justify-center gap-4 mb-5 px-2">
                        {myOrder.map((_, i) => (
                            <div key={i} className="w-14 text-center text-[10px] font-black text-white/25">
                                {i + 1}
                            </div>
                        ))}
                    </div>

                    {/* Check Button */}
                    <button onClick={handleCheck} disabled={checking || attemptsLeft <= 0}
                        className={`w-full text-white py-4 rounded-xl font-black text-base shadow-lg hover:scale-102 active:scale-98 transition-all disabled:opacity-60 flex items-center justify-center gap-2 ${
                            attemptsLeft === 1
                                ? 'bg-gradient-to-r from-red-500 to-rose-600 animate-pulse'
                                : attemptsLeft <= 3
                                    ? 'bg-gradient-to-r from-orange-500 to-amber-500'
                                    : 'bg-gradient-to-r from-indigo-500 to-violet-600'
                        }`}>
                        {checking ? (
                            <Loader2 className="w-5 h-5 animate-spin"/>
                        ) : (
                            <>
                                <CheckCircle className="w-5 h-5"/>
                                {attemptsLeft === 1 ? '⚠️ آخر محاولة!' : `تحقق`}
                                <span className="opacity-70">({attemptsLeft} متبقية)</span>
                            </>
                        )}
                    </button>
                </div>
            ) : mySolved ? (
                <div className="bg-gradient-to-br from-green-500/90 to-emerald-600/90 rounded-2xl p-5 text-center border-2 border-green-400 shadow-xl">
                    <Trophy className="w-12 h-12 text-yellow-300 mx-auto mb-2 animate-bounce drop-shadow-lg"/>
                    <p className="font-black text-white text-xl">رتّبتها! 🎉</p>
                    <p className="text-green-200 text-xs mt-1">في انتظار باقي اللاعبين...</p>
                </div>
            ) : (
                <div className="bg-gradient-to-br from-red-500/90 to-rose-600/90 rounded-2xl p-5 text-center border-2 border-red-400 shadow-xl">
                    <p className="text-5xl mb-2">😞</p>
                    <p className="font-black text-white text-xl">انتهت محاولاتك!</p>
                    <p className="text-red-200 text-xs mt-1">استنفدت الـ {maxAttempts} محاولات</p>
                </div>
            )}

            {/* Attempt History */}
            {myAttempts.length > 0 && (
                <div className="bg-gray-800/60 dark:bg-gray-900/80 rounded-2xl p-3 space-y-1.5">
                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3"/> سجل المحاولات:
                    </p>
                    {myAttempts.map((att, i) => (
                        <AttemptRow
                            key={i}
                            attempt={att}
                            secret={secret}
                            num={i + 1}
                            isCorrect={countCorrect(att, secret) === bottleCount}
                        />
                    ))}
                </div>
            )}

            <button onClick={onExit} className="text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-1 text-center transition-colors">
                ← العودة
            </button>
        </div>
    );

    // ── REWARD TIME ───────────────────────────────────────────────────────────
    if (status === 'reward_time') return (
        <div className="flex flex-col gap-3 py-2 px-2" dir="rtl">

            {/* Dark Mode Toggle */}
            <button
                onClick={() => setIsDarkMode(p => !p)}
                className="absolute top-3 left-12 z-50 p-2 bg-white/10 hover:bg-white/20 dark:bg-gray-800/50 rounded-full text-gray-700 dark:text-gray-200 backdrop-blur-sm shadow-sm"
            >
                {isDarkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
            </button>

            {amIWinner ? (
                <>
                    {/* Winner Banner */}
                    <div className="bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl p-5 text-center shadow-xl">
                        <Trophy className="w-16 h-16 text-white mx-auto mb-2 animate-bounce drop-shadow-xl"/>
                        <h3 className="text-2xl font-black text-white">أنت الفائز! 🎉</h3>
                        <p className="text-yellow-100 text-sm mt-1">أجب على السؤال لتكسب النقاط</p>
                    </div>

                    {/* Secret Reveal */}
                    <div className="bg-gray-800 dark:bg-gray-900 rounded-2xl p-4">
                        <p className="text-[10px] font-black text-gray-400 text-center mb-3 flex items-center justify-center gap-1">
                            <Award className="w-3 h-3"/> الترتيب السري كان:
                        </p>
                        <div className="flex justify-center gap-3">
                            {secret.map((cid, i) => (
                                <div key={i} className="flex flex-col items-center gap-1">
                                    <div className="w-10 h-20 rounded-full border-2 border-white/20 shadow-lg"
                                        style={{ background: COLORS_PALETTE.find(c => c.id === cid)?.bg }}/>
                                    <span className="text-[9px] text-gray-500 font-bold">{i + 1}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Question */}
                    {qLoading ? (
                        <div className="text-center py-8">
                            <Loader2 className="w-10 h-10 animate-spin text-indigo-400 mx-auto mb-2"/>
                            <p className="text-sm font-bold text-gray-400">جاري تحضير السؤال...</p>
                        </div>
                    ) : question && !qAnswered ? (
                        <QuestionScreen question={question} onAnswer={handleQAnswer}
                            timeLeft={qTime} answered={qAnswered} isCorrect={qCorrect} loading={false}/>
                    ) : qAnswered && (
                        <div className={`rounded-2xl p-5 text-center font-black text-lg ${
                            qCorrect
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200'
                        }`}>
                            {qCorrect ? '✅ أجبت صح! +15 نقطة 🎉' : '❌ إجابة خاطئة — حظ أوفر'}
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-10">
                    <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin"/>
                    </div>
                    <h3 className="text-lg font-black text-gray-800 dark:text-white">الفائز يجيب على سؤاله...</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{players.find(p => p.id === match.winner_id)?.name}</p>

                    {/* Show Secret */}
                    <div className="flex justify-center gap-2 mt-6">
                        {secret.map((cid, i) => (
                            <div key={i} className="w-8 h-16 rounded-full border-2 border-gray-200 dark:border-gray-700 shadow"
                                style={{ background: COLORS_PALETTE.find(c => c.id === cid)?.bg }}/>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    // ── FINISHED ──────────────────────────────────────────────────────────────
    if (status === 'finished') return (
        <div className="flex flex-col gap-3 py-2 px-2 animate-in fade-in duration-400" dir="rtl">

            {/* Dark Mode Toggle */}
            <button
                onClick={() => setIsDarkMode(p => !p)}
                className="absolute top-3 left-12 z-50 p-2 bg-white/10 hover:bg-white/20 dark:bg-gray-800/50 rounded-full text-gray-700 dark:text-gray-200 backdrop-blur-sm shadow-sm"
            >
                {isDarkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
            </button>

            {/* Result Banner */}
            <div className={`rounded-2xl p-6 text-center text-white shadow-xl ${
                amIWinner
                    ? 'bg-gradient-to-br from-yellow-400 to-amber-500'
                    : 'bg-gradient-to-br from-gray-600 to-gray-800'
            }`}>
                {amIWinner ? (
                    <>
                        <Trophy className="w-16 h-16 mx-auto mb-2 animate-bounce drop-shadow-xl"/>
                        <h3 className="text-2xl font-black">فزت! 🏆</h3>
                    </>
                ) : (
                    <>
                        <div className="text-5xl mb-2">🍾</div>
                        <h3 className="text-xl font-black">انتهت اللعبة</h3>
                    </>
                )}
            </div>

            {/* Stats Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-lg">
                <p className="text-[10px] font-black text-gray-400 mb-3 flex items-center justify-center gap-1">
                    <Award className="w-3 h-3"/> الترتيب السري:
                </p>
                <div className="flex justify-center gap-3 mb-4">
                    {secret.map((cid, i) => {
                        const color = COLORS_PALETTE.find(c => c.id === cid)!;
                        return (
                            <div key={i} className="flex flex-col items-center gap-1">
                                <div className="w-10 h-20 rounded-full border-2 border-white/30 shadow-lg"
                                    style={{ background: `linear-gradient(135deg, ${color.light}, ${color.bg} 50%, ${color.dark})` }}/>
                                <span className="text-[9px] text-gray-400 font-bold">{i + 1}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Game Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-2">
                        <p className="text-lg font-black text-gray-800 dark:text-white">{myAttempts.length}</p>
                        <p className="text-[10px] text-gray-500">محاولة</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-2">
                        <p className="text-lg font-black text-gray-800 dark:text-white">
                            {myAttempts.length > 0 ? countCorrect(myAttempts[myAttempts.length - 1], secret) : 0}/{bottleCount}
                        </p>
                        <p className="text-[10px] text-gray-500">آخر نتيجة</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-2">
                        <p className="text-lg font-black text-gray-800 dark:text-white">
                            {difficulty.emoji}
                        </p>
                        <p className="text-[10px] text-gray-500">{difficulty.label}</p>
                    </div>
                </div>
            </div>

            {/* Rankings */}
            <div className="space-y-2">
                <p className="text-xs font-black text-gray-500 dark:text-gray-400 px-1 flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-500"/> الترتيب النهائي:
                </p>
                {sortedPlayers.map((p, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
                    const lastScore = countCorrect(p.attempts.at(-1) ?? [], secret);
                    return (
                        <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                            p.id === myId
                                ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                                : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'
                        }`}>
                            <span className={`text-lg w-8 text-center ${
                                i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-gray-400'
                            }`}>
                                {medal}
                            </span>
                            <p className="flex-1 font-black text-sm text-gray-800 dark:text-gray-100">
                                {p.name}{p.id === myId && ' (أنت)'}
                            </p>
                            {p.solved ? (
                                <span className="text-xs font-black text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3"/> حلّها
                                </span>
                            ) : p.eliminated ? (
                                <span className="text-xs font-black text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2.5 py-1 rounded-full">انتهت</span>
                            ) : (
                                <span className="text-xs font-black text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full">
                                    {lastScore}/{bottleCount}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            <button onClick={onExit}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-4 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">
                <RotateCcw className="w-5 h-5"/> العودة للصالة
            </button>
        </div>
    );

    return null;
}
