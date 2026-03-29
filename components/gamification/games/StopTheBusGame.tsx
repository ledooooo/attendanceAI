import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, CheckCircle, XCircle, Flag, Users, Trophy, Medal, BrainCircuit, Timer, Save, Copy, RefreshCw, ChevronDown, ChevronUp, Sun, Moon, Zap, Target, Crown } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';
import confetti from 'canvas-confetti';

// ─── Difficulty Levels ──────────────────────────────────────────────────────────
const DIFFICULTIES = [
    {
        key: 'easy',
        label: 'سهل',
        emoji: '🟢',
        timerSecs: 180,
        correctPoints: 10,
        duplicatePoints: 5,
        color: 'from-green-400 to-emerald-500',
        bgGradient: 'from-green-600 to-emerald-700',
        borderGlow: 'rgba(34, 197, 94, 0.5)',
        busColor: 'from-green-500 to-emerald-600',
    },
    {
        key: 'medium',
        label: 'متوسط',
        emoji: '🟡',
        timerSecs: 120,
        correctPoints: 10,
        duplicatePoints: 5,
        color: 'from-amber-400 to-orange-500',
        bgGradient: 'from-amber-600 to-orange-700',
        borderGlow: 'rgba(251, 191, 36, 0.5)',
        busColor: 'from-amber-500 to-orange-600',
    },
    {
        key: 'hard',
        label: 'صعب',
        emoji: '🔴',
        timerSecs: 90,
        correctPoints: 15,
        duplicatePoints: 8,
        color: 'from-red-500 to-rose-600',
        bgGradient: 'from-red-600 to-rose-700',
        borderGlow: 'rgba(244, 63, 94, 0.5)',
        busColor: 'from-red-500 to-rose-600',
    },
];

// ─── Extended Categories ───────────────────────────────────────────────────────
const CATEGORIES = [
    { key: 'male',    label: 'اسم ذكر',      emoji: '👨' },
    { key: 'female',  label: 'اسم أنثى',    emoji: '👩' },
    { key: 'plant',   label: 'نبات',         emoji: '🌿' },
    { key: 'food',    label: 'أكلة',         emoji: '🍽️' },
    { key: 'object',  label: 'جماد',         emoji: '📦' },
    { key: 'animal',  label: 'حيوان',        emoji: '🐾' },
    { key: 'country', label: 'بلد',          emoji: '🌍' },
    { key: 'famous',  label: 'مشهور',        emoji: '⭐' },
    { key: 'color',   label: 'لون',          emoji: '🎨' },
    { key: 'sport',   label: 'رياضة',        emoji: '⚽' },
];

const ARABIC_LETTERS = [
    'أ','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش',
    'ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي',
];

type Answers = Record<string, string>;

type PlayerRecord = {
    playerId:   string;
    playerName: string;
    answers:    Answers;
    stopped:    boolean;
};

type EvaluationStatus = 'pending' | 'correct' | 'duplicate' | 'wrong';

type EvaluationItem = {
    status: EvaluationStatus;
    points: number;
};

type Evaluations = Record<string, Record<string, EvaluationItem>>;

// ─── Confetti helpers ─────────────────────────────────────────────────────────
const triggerConfetti = () => {
    const colors = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

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
    // First wave
    confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#ffd700', '#ff6b6b', '#4ecdc4', '#a855f7'],
    });

    // Second wave
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
    let opts: string[] = [];
    let correctAns = '';
    if (rawQ.source === 'standard_quiz') {
        try {
            let parsed = rawQ.options;
            if (typeof parsed === 'string') { if (parsed.startsWith('"')) parsed = JSON.parse(parsed); if (typeof parsed === 'string') parsed = JSON.parse(parsed); }
            opts = Array.isArray(parsed) ? parsed : [];
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

// ─── Audio ────────────────────────────────────────────────────────────────────
function useSound() {
    const ctx = useRef<AudioContext | null>(null);
    const get = () => {
        if (!ctx.current) ctx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return ctx.current;
    };
    return useCallback((type: 'tick' | 'stop' | 'win' | 'lose' | 'timeout' | 'correct' | 'wrong' | 'gameStart') => {
        try {
            const ac = get(), now = ac.currentTime;
            if (type === 'tick') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.value = 880;
                g.gain.setValueAtTime(0.13, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
                o.start(now); o.stop(now + 0.07);
            }
            if (type === 'stop') {
                [659, 784, 1047].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'square'; o.frequency.value = f;
                    const t = now + i * 0.09;
                    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                    o.start(t); o.stop(t + 0.25);
                });
            }
            if (type === 'win' || type === 'correct') {
                [523, 659, 784, 1047].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'triangle'; o.frequency.value = f;
                    const t = now + i * 0.13;
                    g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
                    o.start(t); o.stop(t + 0.32);
                });
            }
            if (type === 'lose' || type === 'timeout' || type === 'wrong') {
                [330, 220].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'sine'; o.frequency.value = f;
                    const t = now + i * 0.2;
                    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                    o.start(t); o.stop(t + 0.25);
                });
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pickLetter() {
    return ARABIC_LETTERS[Math.floor(Math.random() * ARABIC_LETTERS.length)];
}
function emptyAnswers(): Answers {
    return Object.fromEntries(CATEGORIES.map(c => [c.key, '']));
}
function validCount(answers: Answers, letter: string) {
    return Object.values(answers).filter(v => v.trim().startsWith(letter) && v.trim().length > 1).length;
}

// ─── Timer Ring ───────────────────────────────────────────────────────────────
function TimerRing({ seconds, total, isDarkMode, difficulty }: {
    seconds: number;
    total: number;
    isDarkMode: boolean;
    difficulty: typeof DIFFICULTIES[number];
}) {
    const r = 26, circ = 2 * Math.PI * r;
    const color = seconds <= 20 ? '#ef4444' : seconds <= 45 ? '#f97316' : '#22c55e';
    return (
        <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
            <svg width={56} height={56} viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
                <circle
                    cx={28} cy={28} r={r}
                    fill="none"
                    stroke={isDarkMode ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}
                    strokeWidth={4.5}
                />
                <circle
                    cx={28} cy={28} r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={4.5}
                    strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - seconds / total)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s' }}
                />
            </svg>
            <span className={`absolute text-xs font-black ${
                seconds <= 20
                    ? 'text-red-400 animate-pulse'
                    : seconds <= 45
                        ? isDarkMode ? 'text-orange-400' : 'text-orange-600'
                        : isDarkMode ? 'text-green-400' : 'text-green-700'
            }`}>
                {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
            </span>
        </div>
    );
}

// ─── Answer Form ──────────────────────────────────────────────────────────────
function AnswerForm({ letter, answers, onChange, disabled, isDarkMode, difficulty }: {
    letter: string;
    answers: Answers;
    onChange: (key: string, val: string) => void;
    disabled: boolean;
    isDarkMode: boolean;
    difficulty: typeof DIFFICULTIES[number];
}) {
    const filled = validCount(answers, letter);

    return (
        <div className="space-y-1.5">
            {CATEGORIES.map(cat => {
                const val   = answers[cat.key] ?? '';
                const valid = val.trim().startsWith(letter) && val.trim().length > 1;
                const has   = val.trim().length > 0;

                return (
                    <div
                        key={cat.key}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all duration-200 ${
                            valid
                                ? isDarkMode
                                    ? 'border-green-400 bg-green-900/30 shadow-lg shadow-green-500/20'
                                    : 'border-green-400 bg-green-50 shadow-sm'
                                : has
                                    ? isDarkMode
                                        ? 'border-orange-400 bg-orange-900/30'
                                        : 'border-orange-300 bg-orange-50'
                                    : isDarkMode
                                        ? 'border-slate-600 bg-slate-800'
                                        : 'border-gray-200 bg-white'
                        }`}
                    >
                        <span className="text-lg flex-shrink-0">{cat.emoji}</span>
                        <span className={`text-[11px] font-black w-14 flex-shrink-0 ${
                            isDarkMode ? 'text-slate-400' : 'text-gray-500'
                        }`}>{cat.label}</span>
                        <input
                            type="text"
                            value={val}
                            onChange={e => onChange(cat.key, e.target.value)}
                            disabled={disabled}
                            placeholder={`يبدأ بـ "${letter}"`}
                            dir="rtl"
                            className={`flex-1 text-sm font-bold bg-transparent outline-none min-w-0 transition-all ${
                                isDarkMode
                                    ? 'text-white placeholder:text-slate-600'
                                    : 'text-gray-800 placeholder:text-gray-300'
                            } disabled:opacity-50`}
                        />
                        {valid && (
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 animate-bounce" />
                        )}
                        {!valid && has && (
                            <XCircle className="w-5 h-5 text-orange-400 flex-shrink-0" />
                        )}
                    </div>
                );
            })}
            <div className="flex items-center justify-between px-1 pt-1">
                <span className={`text-[11px] font-bold ${
                    isDarkMode ? 'text-slate-500' : 'text-gray-400'
                }`}>
                    {filled}/{CATEGORIES.length} صحيح
                </span>
                <div className="flex gap-1">
                    {CATEGORIES.map((_, i) => (
                        <div
                            key={i}
                            className={`w-2.5 h-2.5 rounded-full transition-all ${
                                i < filled
                                    ? difficulty.key === 'easy'
                                        ? 'bg-green-400'
                                        : difficulty.key === 'hard'
                                            ? 'bg-red-400'
                                            : 'bg-amber-400'
                                    : isDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                            }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Mobile-Friendly Comparison Cards ────────────────────────────────────────
function ComparisonCards({ records, letter, myId, players, isDarkMode, difficulty }: {
    records: PlayerRecord[];
    letter: string;
    myId: string;
    players: any[];
    isDarkMode: boolean;
    difficulty: typeof DIFFICULTIES[number];
}) {
    const getPlayerName = (playerId: string) => {
        if (playerId === myId) return 'أنت';
        const player = players.find(p => p.id === playerId);
        return player?.name || records.find(r => r.playerId === playerId)?.playerName || 'لاعب';
    };

    const sortedRecords = [...records].sort((a, b) => {
        if (a.playerId === myId) return -1;
        if (b.playerId === myId) return 1;
        return 0;
    });

    return (
        <div className="space-y-4">
            {sortedRecords.map(rec => {
                const playerName = getPlayerName(rec.playerId);
                const isMe = rec.playerId === myId;
                const correctCount = CATEGORIES.filter(cat => {
                    const ans = rec.answers[cat.key]?.trim() || '';
                    return ans.startsWith(letter) && ans.length > 1;
                }).length;

                return (
                    <div
                        key={rec.playerId}
                        className={`rounded-2xl border-2 overflow-hidden shadow-sm transition-all ${
                            isMe
                                ? isDarkMode
                                    ? 'border-purple-500 bg-purple-900/20'
                                    : 'border-indigo-300 bg-indigo-50/30'
                                : isDarkMode
                                    ? 'border-slate-700 bg-slate-800/50'
                                    : 'border-gray-200'
                        }`}
                    >
                        {/* Player Header */}
                        <div
                            className={`px-4 py-3 border-b ${
                                isMe
                                    ? isDarkMode ? 'bg-purple-900/30 border-purple-700' : 'bg-indigo-100/50 border-indigo-200'
                                    : isDarkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-gradient-to-r from-violet-50 to-purple-50 border-gray-200'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-base">{isMe ? '👤' : '🎮'}</span>
                                    <span className={`font-black text-base ${
                                        isMe
                                            ? isDarkMode ? 'text-purple-300' : 'text-indigo-700'
                                            : isDarkMode ? 'text-white' : 'text-gray-800'
                                    }`}>
                                        {playerName}
                                    </span>
                                    {isMe && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                            isDarkMode ? 'bg-purple-700 text-purple-200' : 'bg-indigo-200 text-indigo-700'
                                        }`}>
                                            أنت
                                        </span>
                                    )}
                                </div>
                                {rec.stopped && (
                                    <span className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-black ${
                                        isDarkMode ? 'bg-green-900/50 text-green-400 border border-green-700' : 'bg-green-100 text-green-700 border border-green-200'
                                    }`}>
                                        <Flag className="w-3 h-3" /> أنهى أولاً 🏁
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Answers Grid */}
                        <div className="p-3">
                            <div className="grid grid-cols-2 gap-2">
                                {CATEGORIES.map(cat => {
                                    const answer = rec.answers[cat.key]?.trim() || '';
                                    const isValid = answer.startsWith(letter) && answer.length > 1;

                                    return (
                                        <div
                                            key={cat.key}
                                            className={`flex items-center gap-2 p-2 rounded-xl border ${
                                                isValid
                                                    ? isDarkMode ? 'bg-green-900/30 border-green-700' : 'bg-green-50 border-green-200'
                                                    : answer
                                                        ? isDarkMode ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200'
                                                        : isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-gray-50 border-gray-200'
                                            }`}
                                        >
                                            <span className="text-lg flex-shrink-0">{cat.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[10px] font-bold ${
                                                    isDarkMode ? 'text-slate-500' : 'text-gray-500'
                                                }`}>{cat.label}</p>
                                                <p className={`text-sm font-bold truncate ${
                                                    isValid
                                                        ? isDarkMode ? 'text-green-400' : 'text-green-700'
                                                        : answer
                                                            ? isDarkMode ? 'text-red-400 line-through' : 'text-red-500 line-through'
                                                            : isDarkMode ? 'text-slate-600' : 'text-gray-400'
                                                }`}>
                                                    {answer || '—'}
                                                </p>
                                            </div>
                                            {isValid && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                                            {!isValid && answer && <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Summary Badge */}
                        <div className={`px-4 py-2 border-t flex justify-between items-center ${
                            isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-100'
                        }`}>
                            <span className={`text-[11px] font-bold ${
                                isDarkMode ? 'text-slate-500' : 'text-gray-500'
                            }`}>الإجابات الصحيحة:</span>
                            <span className={`text-sm font-black ${
                                isDarkMode ? 'text-green-400' : 'text-green-600'
                            }`}>
                                {correctCount} / {CATEGORIES.length}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Category-Based Evaluation Panel ─────────────────────────────────────────
function CategoryEvaluationPanel({
    records,
    letter,
    players,
    myId,
    onSaveEvaluation,
    evaluations: initialEvaluations,
    isHost,
    matchId,
    isDarkMode,
    difficulty,
}: {
    records: PlayerRecord[];
    letter: string;
    players: any[];
    myId: string;
    onSaveEvaluation: (evaluations: Evaluations, finalize: boolean) => Promise<void>;
    evaluations: Evaluations | null;
    isHost: boolean;
    matchId: string;
    isDarkMode: boolean;
    difficulty: typeof DIFFICULTIES[number];
}) {
    const [localEvals, setLocalEvals] = useState<Evaluations>(() => {
        if (initialEvaluations && Object.keys(initialEvaluations).length > 0) {
            return initialEvaluations;
        }
        const init: Evaluations = {};
        records.forEach(rec => {
            init[rec.playerId] = {};
            CATEGORIES.forEach(cat => {
                init[rec.playerId][cat.key] = { status: 'pending', points: 0 };
            });
        });
        return init;
    });
    const [saving, setSaving] = useState(false);
    const [savingCategory, setSavingCategory] = useState<string | null>(null);
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

    const getPlayerName = (playerId: string) => {
        if (playerId === myId) return 'أنت';
        const player = players.find(p => p.id === playerId);
        return player?.name || records.find(r => r.playerId === playerId)?.playerName || 'لاعب';
    };

    const findDuplicatesInCategory = (categoryKey: string): Array<{ playerId: string; answer: string }> => {
        const answersMap = new Map<string, string[]>();
        records.forEach(rec => {
            const ans = rec.answers[categoryKey]?.trim().toLowerCase();
            if (ans && ans.length > 0 && ans.startsWith(letter.toLowerCase())) {
                if (!answersMap.has(ans)) answersMap.set(ans, []);
                answersMap.get(ans)!.push(rec.playerId);
            }
        });

        const duplicates: Array<{ playerId: string; answer: string }> = [];
        for (const [answer, playerIds] of answersMap.entries()) {
            if (playerIds.length > 1) {
                playerIds.forEach(playerId => {
                    duplicates.push({ playerId, answer });
                });
            }
        }
        return duplicates;
    };

    const autoMarkDuplicatesForCategory = (categoryKey: string) => {
        const duplicates = findDuplicatesInCategory(categoryKey);
        if (duplicates.length === 0) {
            toast(`لا توجد إجابات مكررة في ${CATEGORIES.find(c => c.key === categoryKey)?.label}`, { icon: '🔍' });
            return;
        }

        setLocalEvals(prev => {
            const updated = { ...prev };
            duplicates.forEach(dup => {
                if (updated[dup.playerId] && updated[dup.playerId][categoryKey]) {
                    updated[dup.playerId][categoryKey] = { status: 'duplicate', points: difficulty.duplicatePoints };
                }
            });
            return updated;
        });
        toast.success(`تم وضع علامة "مكرر" على ${duplicates.length} إجابة`, { icon: '🔄' });
    };

    const updateAnswerEvaluation = (playerId: string, categoryKey: string, status: EvaluationStatus) => {
        const points = status === 'correct' ? difficulty.correctPoints : status === 'duplicate' ? difficulty.duplicatePoints : 0;
        setLocalEvals(prev => ({
            ...prev,
            [playerId]: {
                ...prev[playerId],
                [categoryKey]: { status, points },
            },
        }));
    };

    const saveCategoryEvaluation = async (categoryKey: string) => {
        if (savingCategory) return;
        setSavingCategory(categoryKey);

        const { data: currentMatch } = await supabase
            .from('live_matches')
            .select('game_state')
            .eq('id', matchId)
            .single();

        await supabase
            .from('live_matches')
            .update({
                game_state: {
                    ...currentMatch?.game_state,
                    evaluations: localEvals,
                },
            })
            .eq('id', matchId);

        setSavingCategory(null);
        toast.success(`تم حفظ تقييم ${CATEGORIES.find(c => c.key === categoryKey)?.label}`, { icon: '💾' });
    };

    const finalizeEvaluation = async () => {
        setSaving(true);
        triggerBigWinConfetti();
        await onSaveEvaluation(localEvals, true);
        setSaving(false);
    };

    const toggleCategory = (categoryKey: string) => {
        setCollapsedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryKey)) {
                newSet.delete(categoryKey);
            } else {
                newSet.add(categoryKey);
            }
            return newSet;
        });
    };

    const getCategoryProgress = (categoryKey: string) => {
        let evaluated = 0;
        records.forEach(rec => {
            const ev = localEvals[rec.playerId]?.[categoryKey];
            if (ev && ev.status !== 'pending') evaluated++;
        });
        return { evaluated, total: records.length };
    };

    const allCategoriesEvaluated = CATEGORIES.every(cat => {
        const progress = getCategoryProgress(cat.key);
        return progress.evaluated === progress.total;
    });

    if (!isHost) {
        const [liveEvals, setLiveEvals] = useState<Evaluations | null>(initialEvaluations);
        useEffect(() => {
            const channel = supabase.channel(`stopthebus-eval-${matchId}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'live_matches',
                    filter: `id=eq.${matchId}`,
                }, (payload) => {
                    const newEvals = payload.new?.game_state?.evaluations;
                    if (newEvals) setLiveEvals(newEvals);
                })
                .subscribe();
            return () => { supabase.removeChannel(channel); };
        }, [matchId]);

        if (!liveEvals) {
            return (
                <div className={`rounded-2xl p-4 text-center ${
                    isDarkMode ? 'bg-slate-800' : 'bg-gray-50'
                }`}>
                    <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>جاري انتظار تقييم المضيف...</p>
                    <Loader2 className={`w-6 h-6 animate-spin mx-auto mt-2 ${isDarkMode ? 'text-purple-400' : 'text-indigo-400'}`} />
                </div>
            );
        }

        let totalEvaluated = 0;
        let totalAnswers = records.length * CATEGORIES.length;
        records.forEach(rec => {
            CATEGORIES.forEach(cat => {
                const ev = liveEvals[rec.playerId]?.[cat.key];
                if (ev && ev.status !== 'pending') totalEvaluated++;
            });
        });

        return (
            <div className={`rounded-2xl border-2 p-4 space-y-3 ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
            }`}>
                <div className="flex items-center justify-between">
                    <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>تقدم التقييم</p>
                    <span className={`text-xs font-bold ${isDarkMode ? 'text-purple-400' : 'text-indigo-600'}`}>
                        {totalEvaluated}/{totalAnswers} إجابة
                    </span>
                </div>
                <div className={`w-full rounded-full h-2 ${isDarkMode ? 'bg-slate-700' : 'bg-gray-200'}`}>
                    <div
                        className="h-2 rounded-full transition-all duration-500 bg-gradient-to-r from-purple-500 to-indigo-500"
                        style={{ width: `${(totalEvaluated / totalAnswers) * 100}%` }}
                    />
                </div>
                <p className={`text-xs text-center ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>المضيف يقوم بتقييم الإجابات...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className={`rounded-2xl p-3 text-center border-2 ${
                isDarkMode
                    ? 'bg-yellow-900/30 border-yellow-600'
                    : 'bg-yellow-50 border-yellow-300'
            }`}>
                <p className={`font-black ${isDarkMode ? 'text-yellow-400' : 'text-yellow-800'}`}>
                    🎯 أنت الحكم! قيم إجابات كل فئة.
                </p>
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-yellow-500' : 'text-yellow-700'}`}>
                    صحيح = {difficulty.correctPoints} نقاط | مكرر = {difficulty.duplicatePoints} نقاط | خطأ = 0
                </p>
            </div>

            {CATEGORIES.map(cat => {
                const progress = getCategoryProgress(cat.key);
                const isCollapsed = collapsedCategories.has(cat.key);
                const isCompleted = progress.evaluated === progress.total;

                return (
                    <div
                        key={cat.key}
                        className={`rounded-2xl border-2 overflow-hidden shadow-sm ${
                            isDarkMode ? 'border-slate-700' : 'border-gray-200'
                        }`}
                    >
                        {/* Category Header */}
                        <button
                            onClick={() => toggleCategory(cat.key)}
                            className={`w-full px-4 py-3 border-b flex items-center justify-between hover:opacity-90 transition-all ${
                                isDarkMode
                                    ? 'bg-slate-800 border-slate-700'
                                    : 'bg-gradient-to-r from-violet-100 to-purple-100 border-gray-200'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{cat.emoji}</span>
                                <span className={`font-black ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{cat.label}</span>
                                {isCompleted && <CheckCircle className="w-5 h-5 text-green-500" />}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                    isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-gray-600'
                                }`}>
                                    {progress.evaluated}/{progress.total}
                                </span>
                                {isCollapsed
                                    ? <ChevronDown className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`} />
                                    : <ChevronUp className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`} />
                                }
                            </div>
                        </button>

                        {/* Category Content */}
                        {!isCollapsed && (
                            <div className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-gray-100'}`}>
                                {records.map(rec => {
                                    const playerName = getPlayerName(rec.playerId);
                                    const isMe = rec.playerId === myId;
                                    const answer = rec.answers[cat.key]?.trim() || '';
                                    const isValid = answer.startsWith(letter) && answer.length > 1;
                                    const currentEval = localEvals[rec.playerId]?.[cat.key];
                                    const currentStatus = currentEval?.status || 'pending';
                                    const currentPoints = currentEval?.points || 0;

                                    return (
                                        <div
                                            key={rec.playerId}
                                            className={`px-4 py-3 flex items-center gap-3 ${
                                                isMe
                                                    ? isDarkMode ? 'bg-purple-900/20' : 'bg-indigo-50/30'
                                                    : ''
                                            }`}
                                        >
                                            {/* Player Info */}
                                            <div className="w-24 flex-shrink-0">
                                                <p className={`text-sm font-bold truncate ${
                                                    isMe
                                                        ? isDarkMode ? 'text-purple-300' : 'text-indigo-700'
                                                        : isDarkMode ? 'text-white' : 'text-gray-700'
                                                }`}>
                                                    {playerName}
                                                    {isMe && <span className={`text-[10px] mr-1 ${isDarkMode ? 'text-purple-500' : 'text-indigo-500'}`}>(أنت)</span>}
                                                </p>
                                                {rec.stopped && (
                                                    <span className="text-[9px] text-green-600">🏁 أنهى</span>
                                                )}
                                            </div>

                                            {/* Answer */}
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold ${
                                                    isValid
                                                        ? isDarkMode ? 'text-green-400' : 'text-gray-800'
                                                        : answer
                                                            ? isDarkMode ? 'text-red-400 line-through' : 'text-red-500 line-through'
                                                            : isDarkMode ? 'text-slate-600' : 'text-gray-400'
                                                }`}>
                                                    {answer || '—'}
                                                </p>
                                            </div>

                                            {/* Evaluation Buttons */}
                                            <div className="flex-shrink-0 flex gap-1">
                                                <button
                                                    onClick={() => updateAnswerEvaluation(rec.playerId, cat.key, 'correct')}
                                                    className={`px-2 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                                                        currentStatus === 'correct'
                                                            ? 'bg-green-600 text-white'
                                                            : isDarkMode
                                                                ? 'bg-green-900/50 text-green-400 hover:bg-green-800'
                                                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                                                    }`}
                                                >
                                                    {difficulty.correctPoints} ✓
                                                </button>
                                                <button
                                                    onClick={() => updateAnswerEvaluation(rec.playerId, cat.key, 'duplicate')}
                                                    className={`px-2 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                                                        currentStatus === 'duplicate'
                                                            ? 'bg-orange-600 text-white'
                                                            : isDarkMode
                                                                ? 'bg-orange-900/50 text-orange-400 hover:bg-orange-800'
                                                                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                                    }`}
                                                >
                                                    {difficulty.duplicatePoints} 🔁
                                                </button>
                                                <button
                                                    onClick={() => updateAnswerEvaluation(rec.playerId, cat.key, 'wrong')}
                                                    className={`px-2 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                                                        currentStatus === 'wrong'
                                                            ? 'bg-red-600 text-white'
                                                            : isDarkMode
                                                                ? 'bg-red-900/50 text-red-400 hover:bg-red-800'
                                                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                                                    }`}
                                                >
                                                    0 ✗
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Category Footer */}
                        {!isCollapsed && (
                            <div className={`px-4 py-2 border-t flex justify-between items-center ${
                                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'
                            }`}>
                                <button
                                    onClick={() => autoMarkDuplicatesForCategory(cat.key)}
                                    className={`text-xs px-3 py-1.5 rounded-full font-black transition-all flex items-center gap-1 ${
                                        isDarkMode
                                            ? 'bg-yellow-900/50 text-yellow-400 hover:bg-yellow-800'
                                            : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                    }`}
                                >
                                    <Copy className="w-3 h-3" />
                                    تقييم المكررات تلقائياً
                                </button>
                                <button
                                    onClick={() => saveCategoryEvaluation(cat.key)}
                                    disabled={savingCategory === cat.key}
                                    className={`text-xs px-3 py-1.5 rounded-full font-black transition-all flex items-center gap-1 ${
                                        isDarkMode
                                            ? 'bg-purple-900/50 text-purple-400 hover:bg-purple-800'
                                            : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                    }`}
                                >
                                    {savingCategory === cat.key
                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                        : <Save className="w-3 h-3" />
                                    }
                                    حفظ الفئة
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}

            {allCategoriesEvaluated && (
                <button
                    onClick={finalizeEvaluation}
                    disabled={saving}
                    className={`w-full py-4 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 sticky bottom-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white`}
                >
                    {saving
                        ? <Loader2 className="w-5 h-5 animate-spin" />
                        : <>إنهاء التقييم وإعلان النتائج 🏆</>
                    }
                </button>
            )}
        </div>
    );
}

// ─── Results Panel ─────────────────────────────────────────────────────────────
function ResultsPanel({
    evaluations,
    records,
    players,
    myId,
    onExit,
    isDarkMode,
    difficulty,
}: {
    evaluations: Evaluations;
    records: PlayerRecord[];
    players: any[];
    myId: string;
    onExit: () => void;
    isDarkMode: boolean;
    difficulty: typeof DIFFICULTIES[number];
}) {
    const [totals, setTotals] = useState<Array<{ id: string; name: string; points: number; isMe: boolean; details: Record<string, number> }>>([]);
    const [winner, setWinner] = useState<{ id: string; name: string; points: number } | null>(null);

    useEffect(() => {
        const computed: typeof totals = [];
        records.forEach(rec => {
            const player = players.find(p => p.id === rec.playerId);
            const name = player?.name || rec.playerName;
            let total = 0;
            const details: Record<string, number> = {};
            const playerEval = evaluations?.[rec.playerId];
            if (playerEval) {
                CATEGORIES.forEach(cat => {
                    const pts = playerEval[cat.key]?.points || 0;
                    total += pts;
                    details[cat.key] = pts;
                });
            }
            computed.push({
                id: rec.playerId,
                name,
                points: total,
                isMe: rec.playerId === myId,
                details,
            });
        });
        computed.sort((a, b) => b.points - a.points);
        setTotals(computed);
        if (computed.length > 0) {
            setWinner({ id: computed[0].id, name: computed[0].name, points: computed[0].points });
        }

        // Trigger confetti for the winner
        if (computed.length > 0 && computed[0].isMe) {
            triggerWinConfetti();
        }
    }, [evaluations, records, players, myId]);

    const isWinner = winner?.id === myId;

    return (
        <div className="space-y-4 animate-in fade-in duration-400">
            {/* Winner Banner */}
            <div className={`rounded-2xl p-5 text-center text-white shadow-xl ${
                isWinner
                    ? isDarkMode
                        ? 'bg-gradient-to-br from-yellow-600 to-amber-700 border border-yellow-500'
                        : 'bg-gradient-to-br from-yellow-500 to-amber-600'
                    : isDarkMode
                        ? 'bg-gradient-to-br from-slate-600 to-slate-700 border border-slate-500'
                        : 'bg-gradient-to-br from-indigo-600 to-violet-700'
            }`}>
                <div className="text-4xl mb-2">
                    {isWinner ? '🏆' : '🎯'}
                </div>
                <h3 className="text-xl font-black">
                    {isWinner ? 'فزت! 🎉' : 'انتهت الجولة'}
                </h3>
                {winner && (
                    <p className="text-lg font-black mt-2">
                        🥇 {winner.name}
                    </p>
                )}
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-300' : 'text-indigo-200'}`}>
                    {difficulty.emoji} {difficulty.label} | أعلى نقطة: {winner?.points || 0}
                </p>
            </div>

            {/* Score Cards */}
            <div className="space-y-3">
                {totals.map((p, idx) => (
                    <div
                        key={p.id}
                        className={`rounded-xl border-2 p-3 transition-all ${
                            p.isMe
                                ? isDarkMode
                                    ? 'border-purple-500 bg-purple-900/20'
                                    : 'border-indigo-300 bg-indigo-50/50'
                                : isDarkMode
                                    ? 'border-slate-700 bg-slate-800/50'
                                    : 'border-gray-100'
                        } ${idx === 0 ? 'ring-2 ring-yellow-400 ring-offset-2' : ''}`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-black ${
                                    idx === 0
                                        ? 'bg-yellow-400 text-yellow-900'
                                        : idx === 1
                                            ? 'bg-gray-300 text-gray-700'
                                            : isDarkMode
                                                ? 'bg-slate-600 text-slate-300'
                                                : 'bg-gray-200 text-gray-600'
                                }`}>
                                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx + 1}
                                </span>
                                <span className={`font-black ${
                                    p.isMe
                                        ? isDarkMode ? 'text-purple-300' : 'text-indigo-700'
                                        : isDarkMode ? 'text-white' : 'text-gray-800'
                                }`}>
                                    {p.name} {p.isMe && <span className={`text-[10px] ${isDarkMode ? 'text-purple-500' : 'text-indigo-500'}`}>(أنت)</span>}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-lg font-black ${
                                    isWinner && p.isMe
                                        ? 'text-yellow-500'
                                        : isDarkMode ? 'text-white' : 'text-indigo-600'
                                }`}>{p.points}</span>
                                <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>نقطة</span>
                            </div>
                        </div>

                        {/* Category breakdown */}
                        <div className={`grid grid-cols-5 gap-1 text-[10px] font-bold ${
                            isDarkMode ? 'text-slate-500' : 'text-gray-500'
                        }`}>
                            {CATEGORIES.map(cat => (
                                <div key={cat.key} className="flex items-center gap-0.5">
                                    <span>{cat.emoji}</span>
                                    <span className={p.details[cat.key] > 0
                                        ? isDarkMode ? 'text-green-400' : 'text-green-600'
                                        : ''
                                    }>
                                        {p.details[cat.key] || 0}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Exit Button */}
            <button
                onClick={onExit}
                className={`w-full py-3.5 rounded-2xl font-black hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 ${
                    isDarkMode
                        ? 'bg-purple-600 text-white hover:bg-purple-500'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
                <Users className="w-5 h-5" />
                العودة إلى الصالة
            </button>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
    match:       any;
    employee:    Employee;
    onExit:      () => void;
    grantPoints: (pts: number) => Promise<void>;
}

export default function StopTheBusGame({ match, employee, onExit, grantPoints }: Props) {
    const play    = useSound();
    const myId    = employee.employee_id;
    const myName  = employee.name?.split(' ')[0] || 'أنت';

    // Dark mode state
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return true;
    });

    // ── Derived from match ────────────────────────────────────────────────────
    const gs:      any            = match.game_state ?? {};
    const difficultyKey: string   = gs.difficulty || 'medium';
    const difficulty = DIFFICULTIES.find(d => d.key === difficultyKey) || DIFFICULTIES[1];
    const letter:  string         = gs.letter    ?? '';
    const startedAt: number       = gs.startedAt ?? 0;
    const records: PlayerRecord[] = gs.records   ?? [];
    const status:  string         = match.status  ?? 'waiting';
    const players: any[]          = match.players ?? [];
    const evaluations: Evaluations | null = gs.evaluations ?? null;
    const [selectedDifficulty, setSelectedDifficulty] = useState(difficultyKey);

    // ── Local state ───────────────────────────────────────────────────────────
    const [answers, setAnswers]       = useState<Answers>(emptyAnswers);
    const [timeLeft, setTimeLeft]     = useState(difficulty.timerSecs);
    const [stopped, setStopped]       = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Evaluation phase
    const [evaluationPhase, setEvaluationPhase] = useState<'waiting' | 'comparison' | 'evaluating' | 'results'>('waiting');
    const [finalized, setFinalized] = useState(false);
    const [awarded, setAwarded] = useState(false);

    const prevTickRef   = useRef(difficulty.timerSecs);
    const soundedStop   = useRef(false);
    const savedOnStop   = useRef(false);
    const timeLeftRef   = useRef(difficulty.timerSecs);

    // Update refs when difficulty changes
    useEffect(() => {
        timeLeftRef.current = difficulty.timerSecs;
    }, [difficulty]);

    // ── My DB record ──────────────────────────────────────────────────────────
    const myRecord  = records.find(r => r.playerId === myId);
    const iStopped  = stopped || !!myRecord;
    const stopper   = records.find(r => r.stopped);

    // My player info from match
    const myPlayerInfo = players.find((p: any) => p.id === myId);
    const myDisplayName = myPlayerInfo?.name || myName;

    // Check if current user is the host
    const isHost = match.created_by === employee.employee_id;

    // When someone else stops → save my answers
    useEffect(() => {
        if (!stopper) return;
        if (stopper.playerId === myId) return;
        if (savedOnStop.current) return;
        if (iStopped) return;
        savedOnStop.current = true;
        if (!soundedStop.current) { soundedStop.current = true; play('stop'); triggerConfetti(); }
        saveMyAnswers(false);
    }, [stopper?.playerId]);

    // ── Timer ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'playing' || !startedAt) return;
        const tick = () => {
            const left = Math.max(0, difficulty.timerSecs - Math.floor((Date.now() - startedAt) / 1000));
            setTimeLeft(left);
            timeLeftRef.current = left;
            if ([30, 20, 10, 5, 4, 3, 2, 1].includes(left) && left !== prevTickRef.current) {
                prevTickRef.current = left;
                play('tick');
            }
            if (left === 0 && !savedOnStop.current && !iStopped) {
                savedOnStop.current = true;
                play('timeout');
                saveMyAnswers(false);
            }
        };
        tick();
        const t = setInterval(tick, 500);
        return () => clearInterval(t);
    }, [status, startedAt, difficulty]);

    // ── Phase transition ───────────────────────────────────────────────────────
    useEffect(() => {
        if (status === 'finished') {
            if (evaluations) {
                setEvaluationPhase('results');
            } else {
                setEvaluationPhase('comparison');
            }
        }
    }, [status, evaluations]);

    // ── Save my answers ───────────────────────────────────────────────────────
    const saveMyAnswers = async (iAmStopper: boolean) => {
        if (submitting) return;
        setSubmitting(true);
        setStopped(true);

        const rec: PlayerRecord = {
            playerId:   myId,
            playerName: myDisplayName,
            answers,
            stopped:    iAmStopper,
        };

        const updatedRecords = [...records.filter(r => r.playerId !== myId), rec];
        const update: any = { game_state: { ...gs, records: updatedRecords } };
        if (iAmStopper) update.status = 'finished';

        await supabase.from('live_matches').update(update).eq('id', match.id);
        setSubmitting(false);
    };

    // ── "خلصت" button ─────────────────────────────────────────────────────────
    const handleStop = async () => {
        if (submitting || iStopped) return;
        if (!soundedStop.current) { soundedStop.current = true; play('stop'); triggerConfetti(); }
        await saveMyAnswers(true);
    };

    // ── Host: start game ──────────────────────────────────────────────────────
    const handleStart = async () => {
        play('gameStart');
        triggerConfetti();

        await supabase.from('live_matches').update({
            status:     'playing',
            game_state: {
                difficulty: selectedDifficulty,
                letter: pickLetter(),
                startedAt: Date.now(),
                records: [],
            },
        }).eq('id', match.id);
    };

    // ── Move from comparison to evaluation ────────────────────────────────────
    const startEvaluation = () => {
        setEvaluationPhase('evaluating');
    };

    // ── Save evaluations and award points ─────────────────────────────────────
    const handleSaveEvaluation = async (evals: Evaluations, finalize: boolean) => {
        if (awarded) return;

        await supabase
            .from('live_matches')
            .update({
                game_state: { ...gs, evaluations: evals, evaluation_completed: finalize },
            })
            .eq('id', match.id);

        if (!finalize) return;

        const totals: Record<string, number> = {};
        records.forEach(rec => {
            let total = 0;
            const playerEval = evals[rec.playerId];
            if (playerEval) {
                Object.values(playerEval).forEach((item: EvaluationItem) => {
                    total += item.points;
                });
            }
            totals[rec.playerId] = total;
        });

        for (const [playerId, pts] of Object.entries(totals)) {
            if (pts > 0) {
                if (playerId === employee.employee_id) {
                    await grantPoints(pts);
                } else {
                    await supabase.rpc('increment_points', { emp_id: playerId, amount: pts });
                    await supabase.from('points_ledger').insert({
                        employee_id: playerId,
                        points: pts,
                        reason: `فوز في أتوبيس كومبليت 🚌`,
                    });
                }
            }
        }
        setAwarded(true);
        setEvaluationPhase('results');
        toast.success('تم منح النقاط للاعبين! 🎉');
    };

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
                <h2 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>أتوبيس كومبليت!</h2>
                <div className="w-9" />
            </div>

            {/* Bus Icon */}
            <div className={`w-24 h-24 bg-gradient-to-br ${difficulty.busColor} rounded-3xl flex items-center justify-center shadow-2xl ${isDarkMode ? 'shadow-purple-500/20' : ''}`}>
                <span className="text-5xl">🚌</span>
            </div>

            <div className="text-center">
                <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    أتوبيس كومبليت!
                </h3>
                <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {CATEGORIES.length} فئة | ابحث عن كلمات تبدأ بالحرف المحدد
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
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div>
                                        <p className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                            {Math.floor(selected.timerSecs / 60)}:{String(selected.timerSecs % 60).padStart(2, '0')}
                                        </p>
                                        <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>الوقت</p>
                                    </div>
                                    <div>
                                        <p className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                            {selected.correctPoints}pt
                                        </p>
                                        <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>صحيح</p>
                                    </div>
                                    <div>
                                        <p className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                            {selected.duplicatePoints}pt
                                        </p>
                                        <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>مكرر</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Players */}
            <div className="flex flex-wrap gap-2 justify-center">
                {players.map((p: any) => (
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
                        disabled={players.length < 2}
                        className={`w-full bg-gradient-to-r from-purple-500 to-violet-700 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                    >
                        <Zap className="w-6 h-6" />
                        ابدأ اللعبة
                    </button>
                    {players.length < 2 && (
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
                <div className={`flex items-center gap-2 justify-center text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`}>
                    <Loader2 className="w-4 h-4 animate-spin"/>
                    في انتظار المضيف...
                </div>
            )}

            <button
                onClick={onExit}
                className={`text-sm font-bold transition-colors ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}
            >
                ← العودة إلى الصالة
            </button>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // PLAYING
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'playing') return (
        <div className={`flex flex-col gap-2 py-2 px-3 min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gradient-to-b from-slate-100 to-slate-200'}`} dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                {/* Dark Mode Toggle */}
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

                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`w-14 h-14 bg-gradient-to-br ${difficulty.busColor} rounded-xl flex items-center justify-center shadow-lg flex-shrink-0`}>
                        <span className="text-3xl font-black text-white">{letter}</span>
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1">
                            <p className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>حرف الجولة</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                difficulty.key === 'easy'
                                    ? 'bg-green-100 text-green-700'
                                    : difficulty.key === 'hard'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-amber-100 text-amber-700'
                            }`}>
                                {difficulty.emoji}
                            </span>
                        </div>
                        <p className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-gray-400'} truncate`}>
                            {iStopped
                                ? '✅ إجاباتك محفوظة'
                                : `${validCount(answers, letter)}/${CATEGORIES.length} إجابة صحيحة`
                            }
                        </p>
                    </div>
                </div>
                <TimerRing seconds={timeLeft} total={difficulty.timerSecs} isDarkMode={isDarkMode} difficulty={difficulty}/>
            </div>

            {/* Stopper Alert */}
            {stopper && stopper.playerId !== myId && !iStopped && (
                <div className={`rounded-xl px-3 py-2 flex items-center gap-2 border-2 animate-pulse ${
                    isDarkMode
                        ? 'bg-red-900/30 border-red-700'
                        : 'bg-red-50 border-red-300'
                }`}>
                    <Flag className="w-4 h-4 text-red-500 flex-shrink-0"/>
                    <p className={`text-xs font-black ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>
                        🏁 {stopper.playerName} أوقف الأتوبيس!
                    </p>
                </div>
            )}

            {/* Answers or Waiting State */}
            {iStopped ? (
                <div className={`text-center py-6 rounded-2xl border-2 shadow-sm ${
                    isDarkMode
                        ? 'bg-green-900/20 border-green-700'
                        : 'bg-white border-green-200'
                }`}>
                    <CheckCircle className={`w-12 h-12 mx-auto mb-2 ${isDarkMode ? 'text-green-400' : 'text-green-500'}`}/>
                    <p className={`font-black text-sm ${isDarkMode ? 'text-green-400' : 'text-gray-700'}`}>
                        إجاباتك محفوظة! ✅
                    </p>
                    <p className={`text-xs mt-1 mb-3 ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`}>
                        في انتظار باقي اللاعبين...
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                        {players.map((p: any) => {
                            const saved = !!records.find(r => r.playerId === p.id);
                            return (
                                <div
                                    key={p.id}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                        saved
                                            ? isDarkMode
                                                ? 'bg-green-900/50 border-green-700 text-green-400'
                                                : 'bg-green-100 border-green-300 text-green-700'
                                            : isDarkMode
                                                ? 'bg-slate-700 border-slate-600 text-slate-400'
                                                : 'bg-gray-100 border-gray-200 text-gray-400'
                                    }`}
                                >
                                    {saved ? '✓' : '⏳'} {p.name}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <>
                    <AnswerForm
                        letter={letter}
                        answers={answers}
                        onChange={(k, v) => setAnswers(prev => ({ ...prev, [k]: v }))}
                        disabled={false}
                        isDarkMode={isDarkMode}
                        difficulty={difficulty}
                    />
                    <button
                        onClick={handleStop}
                        disabled={submitting}
                        className={`w-full py-4 rounded-2xl font-black text-base shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 bg-gradient-to-r from-purple-500 to-violet-700 text-white`}
                    >
                        {submitting
                            ? <Loader2 className="w-5 h-5 animate-spin"/>
                            : <><Flag className="w-5 h-5"/>🛑 خلصت! أوقف الأتوبيس</>
                        }
                    </button>
                </>
            )}

            <button
                onClick={onExit}
                className={`text-xs font-bold py-1 text-center transition-colors ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}
            >
                ← العودة إلى الصالة
            </button>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // FINISHED
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'finished') {
        // Step 1: Comparison
        if (evaluationPhase === 'comparison') {
            return (
                <div className={`flex flex-col gap-3 py-2 px-3 min-h-screen animate-in fade-in duration-400 ${isDarkMode ? 'bg-slate-900' : 'bg-gradient-to-b from-slate-100 to-slate-200'}`} dir="rtl">
                    {/* Header */}
                    <div className={`rounded-2xl p-4 text-center text-white shadow-xl bg-gradient-to-br ${difficulty.bgGradient}`}>
                        <div className="text-3xl mb-1">🚌</div>
                        <h3 className="font-black text-lg">انتهت الجولة!</h3>
                        <p className={`text-sm mt-1`}>
                            حرف الجولة: <span className="text-2xl font-black text-white mx-1">{letter}</span>
                        </p>
                        <p className={`text-xs mt-2 ${isDarkMode ? 'text-slate-300' : 'text-purple-200'}`}>
                            🎯 الإجابة الصحيحة: تبدأ بـ "{letter}"
                        </p>
                    </div>

                    {/* Stats */}
                    <div className={`rounded-2xl p-3 border-2 shadow-sm ${
                        isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
                    }`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`}>عدد اللاعبين</span>
                            <span className={`text-lg font-black ${isDarkMode ? 'text-purple-400' : 'text-violet-600'}`}>
                                {records.length}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`}>أول من أنهى</span>
                            <span className={`text-sm font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                                {records.find(r => r.stopped)?.playerName || '—'} 🏁
                            </span>
                        </div>
                    </div>

                    {/* Comparison Cards */}
                    <div className={`rounded-2xl p-3 ${
                        isDarkMode ? 'bg-slate-800/50' : 'bg-white'
                    }`}>
                        <p className={`text-sm font-black mb-3 flex items-center gap-2 ${
                            isDarkMode ? 'text-white' : 'text-gray-700'
                        }`}>
                            <Users className={`w-4 h-4 ${isDarkMode ? 'text-purple-400' : 'text-violet-500'}`} />
                            إجابات جميع اللاعبين
                        </p>
                        <ComparisonCards
                            records={records}
                            letter={letter}
                            myId={myId}
                            players={players}
                            isDarkMode={isDarkMode}
                            difficulty={difficulty}
                        />
                    </div>

                    {isHost ? (
                        <button
                            onClick={startEvaluation}
                            className={`w-full py-4 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-700 text-white`}
                        >
                            <BrainCircuit className="w-5 h-5" />
                            بدء التقييم
                        </button>
                    ) : (
                        <div className={`rounded-2xl p-4 text-center border-2 ${
                            isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'
                        }`}>
                            <Loader2 className={`w-6 h-6 animate-spin mx-auto mb-2 ${isDarkMode ? 'text-purple-400' : 'text-indigo-400'}`} />
                            <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                                جاري انتظار المضيف لبدء التقييم...
                            </p>
                        </div>
                    )}

                    <button
                        onClick={onExit}
                        className={`text-xs font-bold py-2 text-center transition-colors ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        ← العودة إلى الصالة
                    </button>
                </div>
            );
        }

        // Step 2: Evaluation
        if (evaluationPhase === 'evaluating') {
            return (
                <div className={`flex flex-col gap-3 py-2 px-3 min-h-screen animate-in fade-in duration-400 ${isDarkMode ? 'bg-slate-900' : 'bg-gradient-to-b from-slate-100 to-slate-200'}`} dir="rtl">
                    <div className={`rounded-2xl p-4 text-center text-white shadow-xl bg-gradient-to-br ${difficulty.bgGradient} sticky top-0 z-10`}>
                        <div className="text-3xl mb-1">🚌</div>
                        <h3 className="font-black text-lg">تقييم الإجابات</h3>
                        <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-300' : 'text-purple-200'}`}>
                            حرف الجولة: {letter} | {difficulty.emoji} {difficulty.label}
                        </p>
                    </div>

                    <CategoryEvaluationPanel
                        records={records}
                        letter={letter}
                        players={players}
                        myId={myId}
                        onSaveEvaluation={handleSaveEvaluation}
                        evaluations={evaluations}
                        isHost={isHost}
                        matchId={match.id}
                        isDarkMode={isDarkMode}
                        difficulty={difficulty}
                    />

                    {!isHost && (
                        <button
                            onClick={onExit}
                            className={`text-xs font-bold py-1 text-center transition-colors ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            ← العودة إلى الصالة
                        </button>
                    )}
                </div>
            );
        }

        // Step 3: Results
        if (evaluationPhase === 'results') {
            return (
                <div className={`flex flex-col gap-3 py-2 px-3 min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gradient-to-b from-slate-100 to-slate-200'}`} dir="rtl">
                    <ResultsPanel
                        evaluations={evaluations!}
                        records={records}
                        players={players}
                        myId={myId}
                        onExit={onExit}
                        isDarkMode={isDarkMode}
                        difficulty={difficulty}
                    />
                </div>
            );
        }
    }

    return null;
}
