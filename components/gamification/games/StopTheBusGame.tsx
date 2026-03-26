import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, CheckCircle, XCircle, Flag, Users, Trophy, Medal, BrainCircuit, Timer } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const TIMER_SECS = 120;
const MAX_VOTE_ROUNDS = 3; // not used in new flow but kept for compatibility

const ARABIC_LETTERS = [
    'أ','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش',
    'ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي',
];

const CATEGORIES = [
    { key: 'male',    label: 'اسم ذكر',  emoji: '👨' },
    { key: 'female',  label: 'اسم أنثى', emoji: '👩' },
    { key: 'plant',   label: 'نبات',      emoji: '🌿' },
    { key: 'food',    label: 'أكلة',      emoji: '🍽️' },
    { key: 'object',  label: 'جماد',      emoji: '📦' },
    { key: 'animal',  label: 'حيوان',     emoji: '🐾' },
    { key: 'country', label: 'بلد',       emoji: '🌍' },
    { key: 'famous',  label: 'مشهور',     emoji: '⭐' },
];

type Answers = Record<string, string>;

type PlayerRecord = {
    playerId:   string;
    playerName: string;
    answers:    Answers;
    stopped:    boolean;
};

// ─── Question helpers (unchanged) ─────────────────────────────────────────────
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
    return useCallback((type: 'tick' | 'stop' | 'win' | 'lose' | 'timeout') => {
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
            if (type === 'win') {
                [523, 659, 784, 1047].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'triangle'; o.frequency.value = f;
                    const t = now + i * 0.13;
                    g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
                    o.start(t); o.stop(t + 0.32);
                });
            }
            if (type === 'lose' || type === 'timeout') {
                [330, 220].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'sine'; o.frequency.value = f;
                    const t = now + i * 0.2;
                    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                    o.start(t); o.stop(t + 0.25);
                });
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
function TimerRing({ seconds, total }: { seconds: number; total: number }) {
    const r = 26, circ = 2 * Math.PI * r;
    const color = seconds <= 20 ? '#ef4444' : seconds <= 45 ? '#f97316' : '#22c55e';
    return (
        <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
            <svg width={56} height={56} viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={28} cy={28} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4.5}/>
                <circle cx={28} cy={28} r={r} fill="none" stroke={color} strokeWidth={4.5}
                    strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - seconds / total)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s' }}/>
            </svg>
            <span className={`absolute text-xs font-black ${seconds <= 20 ? 'text-red-600 animate-pulse' : seconds <= 45 ? 'text-orange-600' : 'text-green-700'}`}>
                {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
            </span>
        </div>
    );
}

// ─── Answer Form ──────────────────────────────────────────────────────────────
function AnswerForm({ letter, answers, onChange, disabled }: {
    letter: string; answers: Answers;
    onChange: (key: string, val: string) => void;
    disabled: boolean;
}) {
    const filled = validCount(answers, letter);
    return (
        <div className="space-y-1.5">
            {CATEGORIES.map(cat => {
                const val   = answers[cat.key] ?? '';
                const valid = val.trim().startsWith(letter) && val.trim().length > 1;
                const has   = val.trim().length > 0;
                return (
                    <div key={cat.key} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${valid ? 'border-green-400 bg-green-50' : has ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'}`}>
                        <span className="text-base flex-shrink-0">{cat.emoji}</span>
                        <span className="text-[11px] font-black text-gray-500 w-14 flex-shrink-0">{cat.label}</span>
                        <input type="text" value={val} onChange={e => onChange(cat.key, e.target.value)}
                            disabled={disabled} placeholder={`يبدأ بـ "${letter}"`} dir="rtl"
                            className="flex-1 text-sm font-bold bg-transparent outline-none text-gray-800 placeholder:text-gray-300 disabled:opacity-50 min-w-0"/>
                        {valid && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0"/>}
                        {!valid && has && <XCircle className="w-4 h-4 text-orange-400 flex-shrink-0"/>}
                    </div>
                );
            })}
            <div className="flex items-center justify-between px-1 pt-0.5">
                <span className="text-[11px] font-bold text-gray-400">{filled}/{CATEGORIES.length} صحيح</span>
                <div className="flex gap-1">{CATEGORIES.map((_, i) => (
                    <div key={i} className={`w-2 h-2 rounded-full ${i < filled ? 'bg-green-400' : 'bg-gray-200'}`}/>
                ))}</div>
            </div>
        </div>
    );
}

// ─── Answers Comparison Table (with alias reveal) ─────────────────────────────
function AnswersTable({ records, letter, myId }: {
    records: PlayerRecord[]; letter: string; myId: string;
}) {
    const getName = (p: PlayerRecord) => {
        if (p.playerId === myId) return 'أنت';
        return p.playerName;
    };
    return (
        <div className="space-y-2">
            <div className="px-1">
                <p className="text-xs font-black text-gray-500">إجابات اللاعبين:</p>
            </div>
            {CATEGORIES.map(cat => (
                <div key={cat.key} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="bg-gray-50 px-3 py-1.5 flex items-center gap-1.5 border-b border-gray-100">
                        <span className="text-base">{cat.emoji}</span>
                        <span className="text-xs font-black text-gray-600">{cat.label}</span>
                    </div>
                    {records.map(p => {
                        const val   = p.answers[cat.key]?.trim() ?? '';
                        const valid = val.startsWith(letter) && val.length > 1;
                        const isMe  = p.playerId === myId;
                        return (
                            <div key={p.playerId} className={`flex items-center gap-2 px-3 py-2 border-b border-gray-50 last:border-0 ${isMe ? 'bg-blue-50/60' : ''}`}>
                                <span className={`text-[10px] font-black flex-shrink-0 truncate ${isMe ? 'text-blue-600' : 'text-gray-400'}`}
                                    style={{ maxWidth: 80 }}>
                                    {getName(p)}
                                    {p.stopped && <span className="text-green-600"> 🏁</span>}
                                </span>
                                {val ? (
                                    <>
                                        <span className={`text-sm font-bold flex-1 ${valid ? 'text-gray-800' : 'text-red-400 line-through'}`}>{val}</span>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
                                            {valid ? '✓' : '✗'}
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-xs text-gray-300 flex-1 italic">لا يوجد</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

// ─── Evaluation Panel (only for host) ─────────────────────────────────────────
function EvaluationPanel({
    records,
    letter,
    players,
    myId,
    onSaveEvaluation,
    evaluations,
    isHost,
}: {
    records: PlayerRecord[];
    letter: string;
    players: any[];
    myId: string;
    onSaveEvaluation: (evaluations: any) => void;
    evaluations: any;
    isHost: boolean;
}) {
    const [localEvals, setLocalEvals] = useState<any>(evaluations || {});
    const [saving, setSaving] = useState(false);

    // Initialize evaluations if not present
    useEffect(() => {
        if (!localEvals || Object.keys(localEvals).length === 0) {
            const init: any = {};
            records.forEach(rec => {
                init[rec.playerId] = {};
                Object.keys(rec.answers).forEach(cat => {
                    init[rec.playerId][cat] = {
                        status: 'pending',
                        points: 0,
                    };
                });
            });
            setLocalEvals(init);
        }
    }, [records]);

    const handleStatusChange = (playerId: string, category: string, status: 'correct' | 'duplicate' | 'wrong') => {
        const points = status === 'correct' ? 10 : status === 'duplicate' ? 5 : 0;
        setLocalEvals(prev => ({
            ...prev,
            [playerId]: {
                ...prev[playerId],
                [category]: { status, points },
            },
        }));
    };

    const saveEvaluation = async () => {
        setSaving(true);
        await onSaveEvaluation(localEvals);
        setSaving(false);
    };

    if (!isHost) {
        return (
            <div className="bg-gray-50 rounded-2xl p-4 text-center">
                <p className="text-sm font-bold text-gray-500">جاري انتظار تقييم المضيف...</p>
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto mt-2" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-3 text-center">
                <p className="font-black text-yellow-800">أنت الحكم! قيم إجابات كل لاعب.</p>
                <p className="text-xs text-yellow-700 mt-1">صحيح = 10 نقاط | مكرر = 5 نقاط | خطأ = 0</p>
            </div>

            {records.map(rec => {
                const player = players.find(p => p.id === rec.playerId);
                const playerName = player?.name || rec.playerName;
                const isMe = rec.playerId === myId;

                return (
                    <div key={rec.playerId} className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden shadow-sm">
                        <div className={`px-4 py-2 ${isMe ? 'bg-blue-50' : 'bg-gray-50'} border-b border-gray-200`}>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black">{playerName}</span>
                                {isMe && <span className="text-[10px] bg-blue-200 text-blue-700 px-2 py-0.5 rounded-full">أنت</span>}
                                {rec.stopped && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">🏁 أنهى</span>}
                            </div>
                        </div>

                        {CATEGORIES.map(cat => {
                            const answer = rec.answers[cat.key]?.trim() || '';
                            const isValid = answer.startsWith(letter) && answer.length > 1;
                            const current = localEvals[rec.playerId]?.[cat.key]?.status || 'pending';
                            const points = localEvals[rec.playerId]?.[cat.key]?.points || 0;

                            return (
                                <div key={cat.key} className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 last:border-0">
                                    <div className="w-10 flex-shrink-0">
                                        <span className="text-base">{cat.emoji}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-gray-500">{cat.label}</p>
                                        <p className={`text-sm font-bold truncate ${isValid ? 'text-gray-800' : 'text-red-400 line-through'}`}>
                                            {answer || '—'}
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0 flex gap-1">
                                        <button
                                            onClick={() => handleStatusChange(rec.playerId, cat.key, 'correct')}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                                                current === 'correct'
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                            }`}
                                        >
                                            10 ✓
                                        </button>
                                        <button
                                            onClick={() => handleStatusChange(rec.playerId, cat.key, 'duplicate')}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                                                current === 'duplicate'
                                                    ? 'bg-orange-600 text-white'
                                                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                            }`}
                                        >
                                            5 🔁
                                        </button>
                                        <button
                                            onClick={() => handleStatusChange(rec.playerId, cat.key, 'wrong')}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                                                current === 'wrong'
                                                    ? 'bg-red-600 text-white'
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
                );
            })}

            <button
                onClick={saveEvaluation}
                disabled={saving}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-700 text-white py-3 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <>حفظ النتائج وإعلان الفائز 🏆</>}
            </button>
        </div>
    );
}

// ─── Results Panel (after evaluation) ─────────────────────────────────────────
function ResultsPanel({
    evaluations,
    records,
    players,
    myId,
    onExit,
}: {
    evaluations: any;
    records: PlayerRecord[];
    players: any[];
    myId: string;
    onExit: () => void;
}) {
    const totals: Record<string, { name: string; points: number; isMe: boolean }> = {};
    records.forEach(rec => {
        const player = players.find(p => p.id === rec.playerId);
        const name = player?.name || rec.playerName;
        let total = 0;
        const playerEval = evaluations?.[rec.playerId];
        if (playerEval) {
            Object.values(playerEval).forEach((cat: any) => {
                total += cat.points || 0;
            });
        }
        totals[rec.playerId] = { name, points: total, isMe: rec.playerId === myId };
    });

    const sorted = Object.entries(totals)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.points - a.points);
    const winner = sorted[0];
    const isWinner = winner.id === myId;

    return (
        <div className="space-y-4 animate-in fade-in duration-400">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-2xl p-5 text-center">
                <div className="text-4xl mb-2">🏆</div>
                <h3 className="text-xl font-black">نتيجة المباراة</h3>
                {winner && (
                    <p className="text-lg font-black mt-2">
                        {winner.name} {isWinner ? '(أنت)' : ''}
                    </p>
                )}
                <p className="text-indigo-200 text-sm mt-1">إجمالي النقاط: {winner.points}</p>
            </div>

            <div className="space-y-2">
                {sorted.map((p, idx) => (
                    <div
                        key={p.id}
                        className={`bg-white rounded-xl border-2 p-3 flex items-center justify-between ${
                            p.isMe ? 'border-indigo-300 bg-indigo-50/50' : 'border-gray-100'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 text-xs font-black">
                                {idx + 1}
                            </span>
                            <span className="font-black text-gray-800">
                                {p.name} {p.isMe && '(أنت)'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-indigo-600">{p.points}</span>
                            <span className="text-[10px] text-gray-400">نقطة</span>
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={onExit}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-2xl font-black hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
            >
                <Users className="w-5 h-5" /> العودة إلى الصالة
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
    const play   = useSound();
    const myId   = employee.employee_id;
    const myName = employee.name?.split(' ')[0] || 'أنت';

    // ── Derived from match ────────────────────────────────────────────────────
    const gs:      any            = match.game_state ?? {};
    const letter:  string         = gs.letter    ?? '';
    const startedAt: number       = gs.startedAt ?? 0;
    const records: PlayerRecord[] = gs.records   ?? [];
    const status:  string         = match.status  ?? 'waiting';
    const players: any[]          = match.players ?? [];

    // ── Local state ───────────────────────────────────────────────────────────
    const [answers, setAnswers]       = useState<Answers>(emptyAnswers);
    const [timeLeft, setTimeLeft]     = useState(TIMER_SECS);
    const [stopped, setStopped]       = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Evaluation phase
    const [evaluationPhase, setEvaluationPhase] = useState<'waiting' | 'evaluating' | 'results'>('waiting');
    const [evaluations, setEvaluations] = useState<any>(null);
    const [finalized, setFinalized] = useState(false);

    const prevTickRef   = useRef(TIMER_SECS);
    const soundedStop   = useRef(false);
    const savedOnStop   = useRef(false);

    // ── My DB record ──────────────────────────────────────────────────────────
    const myRecord  = records.find(r => r.playerId === myId);
    const iStopped  = stopped || !!myRecord;
    const stopper   = records.find(r => r.stopped);

    // My player info from match (includes alias if set)
    const myPlayerInfo = players.find((p: any) => p.id === myId);
    const myDisplayName = myPlayerInfo?.name || myName;
    const isAlias = myPlayerInfo?.isAlias ?? false;

    // Check if current user is the host (creator of the match)
    const isHost = match.created_by === employee.employee_id;

    // When someone else stops → save my answers
    useEffect(() => {
        if (!stopper) return;
        if (stopper.playerId === myId) return;
        if (savedOnStop.current) return;
        if (iStopped) return;
        savedOnStop.current = true;
        if (!soundedStop.current) { soundedStop.current = true; play('stop'); }
        saveMyAnswers(false);
    }, [stopper?.playerId]);

    // ── Timer ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'playing' || !startedAt) return;
        const tick = () => {
            const left = Math.max(0, TIMER_SECS - Math.floor((Date.now() - startedAt) / 1000));
            setTimeLeft(left);
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
    }, [status, startedAt]);

    // ── Phase transition when game finishes ───────────────────────────────────
    useEffect(() => {
        if (status === 'finished') {
            if (gs.evaluations) {
                setEvaluations(gs.evaluations);
                setEvaluationPhase('results');
            } else {
                setEvaluationPhase('evaluating');
            }
        }
    }, [status, gs.evaluations]);

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

    // ── "خلصت" button ────────────────────────────────────────────────────────
    const handleStop = async () => {
        if (submitting || iStopped) return;
        if (!soundedStop.current) { soundedStop.current = true; play('stop'); }
        await saveMyAnswers(true);
    };

    // ── Host: start game ──────────────────────────────────────────────────────
    const handleStart = async () => {
        await supabase.from('live_matches').update({
            status:     'playing',
            game_state: { letter: pickLetter(), startedAt: Date.now(), records: [] },
        }).eq('id', match.id);
    };

    // ── Save evaluations and award points ─────────────────────────────────────
    const handleSaveEvaluation = async (evals: any) => {
        // Save evaluations to game_state
        await supabase
            .from('live_matches')
            .update({
                game_state: { ...gs, evaluations: evals },
            })
            .eq('id', match.id);

        setEvaluations(evals);
        setEvaluationPhase('results');

        // Calculate points per player
        const totals: Record<string, number> = {};
        records.forEach(rec => {
            let total = 0;
            const playerEval = evals[rec.playerId];
            if (playerEval) {
                Object.values(playerEval).forEach((cat: any) => {
                    total += cat.points || 0;
                });
            }
            totals[rec.playerId] = total;
        });

        // Award points to each player (including current user via grantPoints)
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
        setFinalized(true);
        toast.success('تم منح النقاط للاعبين! 🎉');
    };

    // ─────────────────────────────────────────────────────────────────────────
    // WAITING
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className="text-center py-8 px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-700 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
                <span className="text-4xl">🚌</span>
            </div>
            <h3 className="text-xl font-black text-gray-800 mb-1">أتوبيس كومبليت!</h3>
            <p className="text-sm font-bold text-gray-400 mb-5">{players.length} لاعب في الغرفة</p>
            <div className="flex flex-wrap gap-2 justify-center mb-6">
                {players.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-full">
                        <span className="text-sm">{p.avatar?.startsWith('http') ? '👤' : (p.avatar || '👤')}</span>
                        <span className="text-xs font-bold text-purple-700">{p.name}</span>
                        {p.id === myId && <span className="text-[10px] text-purple-400">(أنت)</span>}
                        {p.isAlias && <span className="text-[10px] bg-purple-200 text-purple-600 px-1.5 rounded-full font-bold">🥷 مجهول</span>}
                    </div>
                ))}
            </div>
            {isHost ? (
                <div className="flex flex-col items-center gap-2">
                    <button onClick={handleStart}
                        disabled={players.length < 2}
                        className="bg-gradient-to-r from-violet-500 to-purple-700 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                        🎲 ابدأ اللعبة
                    </button>
                    {players.length < 2 && (
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
                ← العودة إلى الصالة
            </button>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // PLAYING
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'playing') return (
        <div className="flex flex-col gap-2 py-2 px-3" dir="rtl">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-700 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <span className="text-2xl font-black text-white">{letter}</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-black text-gray-700">حرف الجولة</p>
                        <p className="text-[11px] font-bold text-gray-400 truncate">
                            {iStopped ? '✅ إجاباتك محفوظة' : `${validCount(answers, letter)}/${CATEGORIES.length} إجابة صحيحة`}
                        </p>
                    </div>
                </div>
                <TimerRing seconds={timeLeft} total={TIMER_SECS}/>
            </div>

            {stopper && stopper.playerId !== myId && !iStopped && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl px-3 py-2 flex items-center gap-2">
                    <Flag className="w-4 h-4 text-red-500 flex-shrink-0"/>
                    <p className="text-xs font-black text-red-700">🏁 {stopper.playerName} أوقف الأتوبيس! جاري حفظ إجاباتك...</p>
                </div>
            )}

            {iStopped ? (
                <div className="text-center py-6 bg-white rounded-2xl border-2 border-green-200 shadow-sm">
                    <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2"/>
                    <p className="font-black text-gray-700 text-sm">إجاباتك محفوظة!</p>
                    <p className="text-xs text-gray-400 mt-1 mb-3">في انتظار باقي اللاعبين...</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                        {players.map((p: any) => {
                            const saved = !!records.find(r => r.playerId === p.id);
                            return (
                                <div key={p.id} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${saved ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                                    {saved ? '✓' : '⏳'} {p.name}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <>
                    <AnswerForm letter={letter} answers={answers}
                        onChange={(k, v) => setAnswers(prev => ({ ...prev, [k]: v }))}
                        disabled={false}/>
                    <button onClick={handleStop} disabled={submitting}
                        className="w-full bg-gradient-to-r from-violet-500 to-purple-700 text-white py-4 rounded-2xl font-black text-base shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-1">
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <><Flag className="w-5 h-5"/>🛑 خلصت! أوقف الأتوبيس</>}
                    </button>
                </>
            )}

            <button onClick={onExit} className="text-xs font-bold text-gray-400 hover:text-gray-600 py-1 text-center">
                ← العودة إلى الصالة
            </button>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // FINISHED – Evaluation / Results
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'finished') {
        if (evaluationPhase === 'evaluating') {
            return (
                <div className="flex flex-col gap-3 py-2 px-3 animate-in fade-in duration-400" dir="rtl">
                    <div className="bg-gradient-to-br from-violet-500 to-purple-700 text-white rounded-2xl p-4 text-center">
                        <div className="text-3xl mb-1">🚌</div>
                        <h3 className="font-black text-lg">انتهت الجولة!</h3>
                        <p className="text-purple-100 text-xs mt-0.5">حرف الجولة: {letter}</p>
                    </div>
                    <AnswersTable records={records} letter={letter} myId={myId} />
                    <EvaluationPanel
                        records={records}
                        letter={letter}
                        players={players}
                        myId={myId}
                        onSaveEvaluation={handleSaveEvaluation}
                        evaluations={evaluations}
                        isHost={isHost}
                    />
                    {!isHost && (
                        <button onClick={onExit} className="text-xs font-bold text-gray-400 hover:text-gray-600 py-1 text-center">
                            ← العودة إلى الصالة (لن تؤثر النقاط بعد)
                        </button>
                    )}
                </div>
            );
        }

        if (evaluationPhase === 'results') {
            return (
                <div className="flex flex-col gap-3 py-2 px-3" dir="rtl">
                    <div className="bg-gradient-to-br from-violet-500 to-purple-700 text-white rounded-2xl p-4 text-center">
                        <div className="text-3xl mb-1">🚌</div>
                        <h3 className="font-black text-lg">نتائج الجولة</h3>
                        <p className="text-purple-100 text-xs mt-0.5">حرف الجولة: {letter}</p>
                    </div>
                    <ResultsPanel
                        evaluations={evaluations}
                        records={records}
                        players={players}
                        myId={myId}
                        onExit={onExit}
                    />
                </div>
            );
        }
    }

    return null;
}
