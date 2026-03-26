import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, CheckCircle, XCircle, Flag, Users, Trophy, Medal, BrainCircuit, Timer, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const TIMER_SECS = 120;
const MAX_VOTE_ROUNDS = 3; // kept for compatibility, but not used in new flow

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
    // evaluation fields
    evaluationCompleted?: boolean; // whether judge evaluated this player
    evaluationScores?: Record<string, { correct: boolean; points: number }>;
    totalPoints?: number;
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

// ─── Evaluation Panel (only for host) ─────────────────────────────────────────
function EvaluationPanel({ records, letter, myId, isHost, onEvaluationComplete }: {
    records: PlayerRecord[];
    letter: string;
    myId: string;
    isHost: boolean;
    onEvaluationComplete: () => void;
}) {
    const [evaluation, setEvaluation] = useState<Record<string, Record<string, boolean>>>(() => {
        const initial: Record<string, Record<string, boolean>> = {};
        records.forEach(r => {
            initial[r.playerId] = {};
            CATEGORIES.forEach(cat => {
                const ans = r.answers[cat.key]?.trim() || '';
                const isValid = ans.startsWith(letter) && ans.length > 1;
                initial[r.playerId][cat.key] = isValid; // default to true if answer matches letter
            });
        });
        return initial;
    });
    const [evaluated, setEvaluated] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const toggleCorrect = (playerId: string, categoryKey: string) => {
        if (!isHost) return;
        setEvaluation(prev => ({
            ...prev,
            [playerId]: {
                ...prev[playerId],
                [categoryKey]: !prev[playerId]?.[categoryKey]
            }
        }));
    };

    const submitEvaluation = async () => {
        if (!isHost || submitting) return;
        setSubmitting(true);

        // Build points per player per category based on evaluation and uniqueness
        const playersEval = records.map(p => ({
            playerId: p.playerId,
            playerName: p.playerName,
            answers: p.answers,
            correctMap: evaluation[p.playerId] || {}
        }));

        // First, collect all answers marked as correct
        const correctAnswers: Record<string, { playerId: string; answer: string }[]> = {};
        playersEval.forEach(p => {
            CATEGORIES.forEach(cat => {
                if (p.correctMap[cat.key]) {
                    const ans = p.answers[cat.key]?.trim() || '';
                    if (ans) {
                        if (!correctAnswers[cat.key]) correctAnswers[cat.key] = [];
                        correctAnswers[cat.key].push({ playerId: p.playerId, answer: ans });
                    }
                }
            });
        });

        // Determine uniqueness per category
        const uniqueMap: Record<string, Record<string, boolean>> = {};
        Object.entries(correctAnswers).forEach(([catKey, answers]) => {
            uniqueMap[catKey] = {};
            const counts: Record<string, number> = {};
            answers.forEach(a => { counts[a.answer] = (counts[a.answer] || 0) + 1; });
            answers.forEach(a => { uniqueMap[catKey][a.playerId] = counts[a.answer] === 1; });
        });

        // Calculate points for each player
        const pointsPerPlayer: Record<string, number> = {};
        records.forEach(p => { pointsPerPlayer[p.playerId] = 0; });

        playersEval.forEach(p => {
            CATEGORIES.forEach(cat => {
                const isCorrect = p.correctMap[cat.key];
                if (!isCorrect) return;
                const isUnique = uniqueMap[cat.key]?.[p.playerId] || false;
                const points = isUnique ? 10 : 5;
                pointsPerPlayer[p.playerId] += points;
            });
        });

        // Update game_state with evaluation results and points
        const updatedRecords = records.map(r => ({
            ...r,
            evaluationCompleted: true,
            totalPoints: pointsPerPlayer[r.playerId] || 0
        }));

        // Also store the evaluation details for display
        const evaluationDetails = Object.fromEntries(
            records.map(r => [
                r.playerId,
                Object.fromEntries(CATEGORIES.map(cat => [
                    cat.key,
                    { correct: evaluation[r.playerId]?.[cat.key] || false, points: 0 } // points will be recalculated later
                ]))
            ])
        );

        // Add points to each category for display
        for (const p of playersEval) {
            for (const cat of CATEGORIES) {
                if (evaluation[p.playerId]?.[cat.key]) {
                    const isUnique = uniqueMap[cat.key]?.[p.playerId] || false;
                    evaluationDetails[p.playerId][cat.key].points = isUnique ? 10 : 5;
                }
            }
        }

        await supabase.from('live_matches').update({
            game_state: {
                ...gs,
                records: updatedRecords,
                evaluation: evaluationDetails,
                evaluationCompleted: true,
                finalPoints: pointsPerPlayer
            },
            status: 'results' // new state to show results
        }).eq('id', matchId);

        setEvaluated(true);
        onEvaluationComplete();
        setSubmitting(false);
    };

    if (!isHost) return null;

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border-2 border-indigo-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <UserCheck className="w-5 h-5 text-indigo-600"/>
                    <span className="font-black text-indigo-800 text-sm">تقييم الحكم</span>
                </div>
                {records.map(player => (
                    <div key={player.playerId} className="mb-6 border-b border-gray-100 pb-4 last:border-0">
                        <h4 className="font-black text-gray-700 mb-2 flex items-center gap-2">
                            {player.playerId === myId ? 'أنت' : player.playerName}
                            {player.playerId === myId && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 rounded-full">(أنت)</span>}
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {CATEGORIES.map(cat => {
                                const answer = player.answers[cat.key]?.trim() || '';
                                const isValid = answer.startsWith(letter) && answer.length > 1;
                                const isCorrect = evaluation[player.playerId]?.[cat.key] ?? isValid;
                                return (
                                    <button
                                        key={cat.key}
                                        onClick={() => toggleCorrect(player.playerId, cat.key)}
                                        disabled={!isHost}
                                        className={`flex flex-col items-start p-2 rounded-xl border-2 transition-all ${
                                            isCorrect ? 'border-green-400 bg-green-50' : 'border-red-200 bg-red-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-1 w-full">
                                            <span className="text-sm">{cat.emoji}</span>
                                            <span className="text-xs font-bold text-gray-600">{cat.label}</span>
                                        </div>
                                        <p className="text-sm font-bold mt-1 text-right w-full break-words">
                                            {answer || '—'}
                                        </p>
                                        <div className="mt-1 text-[10px] font-black">
                                            {isCorrect ? '✓ صحيح' : '✗ خطأ'}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
            {!evaluated && (
                <button
                    onClick={submitEvaluation}
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-indigo-600 to-violet-700 text-white py-3 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-60"
                >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : 'إنهاء التقييم وحساب النقاط 🎯'}
                </button>
            )}
        </div>
    );
}

// ─── Results Panel (after evaluation) ─────────────────────────────────────────
function ResultsPanel({ records, finalPoints, winnerId, onExit }: {
    records: PlayerRecord[];
    finalPoints: Record<string, number>;
    winnerId: string | null;
    onExit: () => void;
}) {
    const sorted = [...records].sort((a,b) => (finalPoints[b.playerId] || 0) - (finalPoints[a.playerId] || 0));
    return (
        <div className="space-y-4">
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-2xl p-4 text-center">
                <Trophy className="w-10 h-10 mx-auto mb-2"/>
                <h3 className="font-black text-xl">نتائج الجولة</h3>
                {winnerId && (
                    <p className="text-sm font-bold mt-1">
                        🏆 الفائز: {records.find(r => r.playerId === winnerId)?.playerName}
                    </p>
                )}
            </div>
            <div className="space-y-2">
                {sorted.map((player, idx) => {
                    const points = finalPoints[player.playerId] || 0;
                    const isWinner = player.playerId === winnerId;
                    return (
                        <div key={player.playerId} className={`bg-white rounded-xl border-2 p-3 flex items-center justify-between ${isWinner ? 'border-amber-400 bg-amber-50' : 'border-gray-100'}`}>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-gray-500">#{idx+1}</span>
                                <span className="font-black">{player.playerName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-black text-green-600">{points}</span>
                                <span className="text-xs text-gray-400">نقطة</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            <button onClick={onExit} className="w-full bg-gradient-to-r from-indigo-600 to-violet-700 text-white py-3 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all">
                العودة إلى الصالة 🏠
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
    const finalPoints: Record<string, number> = gs.finalPoints ?? {};
    const winnerId = (() => {
        if (gs.winnerId) return gs.winnerId;
        if (finalPoints && Object.keys(finalPoints).length > 0) {
            let max = -Infinity, winner = null;
            for (const [id, pts] of Object.entries(finalPoints)) {
                if (pts > max) { max = pts; winner = id; }
            }
            return winner;
        }
        return null;
    })();

    // ── Local state ───────────────────────────────────────────────────────────
    const [answers, setAnswers]       = useState<Answers>(emptyAnswers);
    const [timeLeft, setTimeLeft]     = useState(TIMER_SECS);
    const [stopped, setStopped]       = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [evaluationCompleted, setEvaluationCompleted] = useState(gs.evaluationCompleted || false);
    const [showResults, setShowResults] = useState(status === 'results');

    // Question phase (kept for compatibility, but not used in new flow)
    const [question, setQuestion]     = useState<any>(null);
    const [qTime, setQTime]           = useState(20);
    const [qAnswered, setQAnswered]   = useState(false);
    const [qCorrect, setQCorrect]     = useState<boolean | null>(null);
    const [qLoading, setQLoading]     = useState(false);

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

    // Host: first player in sorted order (to ensure consistency)
    const sortedPlayers = [...(match.players ?? [])].sort((a: any, b: any) => a.id.localeCompare(b.id));
    const isHost = sortedPlayers.length > 0 && sortedPlayers[0]?.id === myId;

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
        if (iAmStopper) update.status = 'finished'; // move to evaluation phase

        await supabase.from('live_matches').update(update).eq('id', match.id);
        setSubmitting(false);
    };

    // ── "خلصت" button ────────────────────────────────────────────────────────
    const handleStop = async () => {
        if (submitting || iStopped) return;
        if (!soundedStop.current) { soundedStop.current = true; play('stop'); }
        await saveMyAnswers(true);
    };

    // ── Start game ────────────────────────────────────────────────────────────
    const handleStart = async () => {
        await supabase.from('live_matches').update({
            status:     'playing',
            game_state: { letter: pickLetter(), startedAt: Date.now(), records: [], evaluationCompleted: false },
        }).eq('id', match.id);
    };

    // ── After evaluation is done (called by EvaluationPanel) ──────────────────
    const handleEvaluationComplete = async () => {
        // Fetch latest match to get points
        const { data: updatedMatch } = await supabase.from('live_matches').select('*').eq('id', match.id).single();
        if (!updatedMatch) return;

        const newGs = updatedMatch.game_state;
        const pointsMap = newGs.finalPoints || {};
        const playersList = updatedMatch.players || [];

        // Add points to each player's total using grantPoints (this will update employees.points and play effects)
        for (const [pid, pts] of Object.entries(pointsMap)) {
            if (pts > 0) {
                await grantPoints(pts as number);
            }
        }

        // Determine winner (highest points)
        let winnerId = null;
        let maxPoints = -1;
        for (const [pid, pts] of Object.entries(pointsMap)) {
            if (pts > maxPoints) {
                maxPoints = pts;
                winnerId = pid;
            }
        }

        // Give extra 100 points to winner
        if (winnerId) {
            await grantPoints(100);
            // Show toast for extra prize
            toast.success(`🏆 ${newGs.records?.find((r: any) => r.playerId === winnerId)?.playerName} حصل على 100 نقطة إضافية كجائزة الفوز!`, { duration: 4000 });
        }

        // Update match with winner and final status
        await supabase.from('live_matches').update({
            status: 'results',
            game_state: { ...newGs, winnerId, extraPrizeGiven: true }
        }).eq('id', match.id);

        setEvaluationCompleted(true);
        setShowResults(true);
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
    // FINISHED (ready for evaluation)
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'finished') {
        // If evaluation already done (should not happen, but handle)
        if (evaluationCompleted) {
            return (
                <div className="flex flex-col gap-3 py-2 px-3">
                    <div className="bg-green-100 border-2 border-green-300 rounded-2xl p-4 text-center">
                        <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-2"/>
                        <p className="font-black text-green-800">تم التقييم بنجاح!</p>
                    </div>
                    <button onClick={onExit} className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-black">العودة</button>
                </div>
            );
        }

        // Show evaluation panel for host, waiting for others
        if (isHost) {
            return (
                <div className="flex flex-col gap-3 py-2 px-3">
                    <div className="bg-gradient-to-br from-violet-500 to-purple-700 text-white rounded-2xl p-4 text-center">
                        <h3 className="font-black text-lg">تقييم الإجابات</h3>
                        <p className="text-purple-100 text-xs mt-1">قم بتحديد صحة كل إجابة (صح/خطأ)</p>
                    </div>
                    <EvaluationPanel
                        records={records}
                        letter={letter}
                        myId={myId}
                        isHost={isHost}
                        onEvaluationComplete={handleEvaluationComplete}
                    />
                    <button onClick={onExit} className="text-xs font-bold text-gray-400 hover:text-gray-600 py-1 text-center">
                        ← العودة إلى الصالة (سيتم إلغاء التقييم)
                    </button>
                </div>
            );
        } else {
            // Non-host players wait for host evaluation
            return (
                <div className="flex flex-col gap-3 py-2 px-3 text-center">
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6">
                        <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-3"/>
                        <p className="font-black text-amber-800">في انتظار تقييم المضيف...</p>
                        <p className="text-xs text-amber-600 mt-2">سيتم احتساب النقاط بعد انتهاء التقييم</p>
                    </div>
                    <button onClick={onExit} className="text-xs font-bold text-gray-400 hover:text-gray-600 py-1">
                        ← العودة إلى الصالة
                    </button>
                </div>
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RESULTS (after evaluation completed)
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'results' || showResults) {
        return (
            <div className="flex flex-col gap-3 py-2 px-3">
                <ResultsPanel
                    records={records}
                    finalPoints={finalPoints}
                    winnerId={winnerId}
                    onExit={onExit}
                />
            </div>
        );
    }

    return null;
}
