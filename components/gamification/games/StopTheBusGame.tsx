import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, CheckCircle, XCircle, Flag, Users, Trophy, Medal, BrainCircuit, Timer, Save, Copy, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const TIMER_SECS = 120;

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

type EvaluationStatus = 'pending' | 'correct' | 'duplicate' | 'wrong';

type EvaluationItem = {
    status: EvaluationStatus;
    points: number;
};

type Evaluations = Record<string, Record<string, EvaluationItem>>;

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

// ─── Mobile-Friendly Comparison Cards (instead of horizontal table) ───────────
function ComparisonCards({ records, letter, myId, players }: {
    records: PlayerRecord[];
    letter: string;
    myId: string;
    players: any[];
}) {
    const getPlayerName = (playerId: string) => {
        if (playerId === myId) return 'أنت';
        const player = players.find(p => p.id === playerId);
        return player?.name || records.find(r => r.playerId === playerId)?.playerName || 'لاعب';
    };

    // Sort so current user is first
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
                    <div key={rec.playerId} className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-all ${
                        isMe ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200'
                    }`}>
                        {/* Player Header */}
                        <div className={`px-4 py-3 ${isMe ? 'bg-indigo-100/50' : 'bg-gradient-to-r from-violet-50 to-purple-50'} border-b border-gray-200`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-base">{isMe ? '👤' : '🎮'}</span>
                                    <span className={`font-black text-base ${isMe ? 'text-indigo-700' : 'text-gray-800'}`}>
                                        {playerName}
                                    </span>
                                    {isMe && <span className="text-[10px] bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full">أنت</span>}
                                </div>
                                {rec.stopped && (
                                    <span className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full font-black">
                                        <Flag className="w-3 h-3" /> أنهى أولاً
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Answers Grid - 2 columns on mobile, 3 on tablet, 4 on desktop */}
                        <div className="p-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {CATEGORIES.map(cat => {
                                    const answer = rec.answers[cat.key]?.trim() || '';
                                    const isValid = answer.startsWith(letter) && answer.length > 1;

                                    return (
                                        <div key={cat.key} className={`flex items-center gap-2 p-2 rounded-xl border ${
                                            isValid ? 'bg-green-50 border-green-200' : 
                                            answer ? 'bg-red-50 border-red-200' : 
                                            'bg-gray-50 border-gray-200'
                                        }`}>
                                            <span className="text-lg flex-shrink-0">{cat.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-bold text-gray-500">{cat.label}</p>
                                                <p className={`text-sm font-bold truncate ${
                                                    isValid ? 'text-green-700' : 
                                                    answer ? 'text-red-500 line-through' : 
                                                    'text-gray-400'
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
                        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                            <span className="text-[11px] font-bold text-gray-500">الإجابات الصحيحة:</span>
                            <span className="text-sm font-black text-green-600">
                                {correctCount} / {CATEGORIES.length}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Enhanced Evaluation Panel with auto‑detect duplicates ───────────────────
function EvaluationPanel({
    records,
    letter,
    players,
    myId,
    onSaveEvaluation,
    evaluations: initialEvaluations,
    isHost,
    matchId,
}: {
    records: PlayerRecord[];
    letter: string;
    players: any[];
    myId: string;
    onSaveEvaluation: (evaluations: Evaluations, finalize: boolean) => Promise<void>;
    evaluations: Evaluations | null;
    isHost: boolean;
    matchId: string;
}) {
    const [localEvals, setLocalEvals] = useState<Evaluations>(() => {
        if (initialEvaluations && Object.keys(initialEvaluations).length > 0) {
            return initialEvaluations;
        }
        const init: Evaluations = {};
        records.forEach(rec => {
            init[rec.playerId] = {};
            Object.keys(rec.answers).forEach(cat => {
                init[rec.playerId][cat] = { status: 'pending', points: 0 };
            });
        });
        return init;
    });
    const [saving, setSaving] = useState(false);
    const [savingPlayer, setSavingPlayer] = useState<string | null>(null);
    const [completedPlayers, setCompletedPlayers] = useState<Set<string>>(new Set());

    // Auto-detect duplicate answers across players
    const findDuplicates = (): Array<{ category: string; players: string[]; answer: string }> => {
        const duplicates: Array<{ category: string; players: string[]; answer: string }> = [];
        for (const cat of CATEGORIES) {
            const answersMap = new Map<string, string[]>();
            for (const rec of records) {
                const ans = rec.answers[cat.key]?.trim().toLowerCase();
                if (ans && ans.length > 0 && ans.startsWith(letter.toLowerCase())) {
                    if (!answersMap.has(ans)) answersMap.set(ans, []);
                    answersMap.get(ans)!.push(rec.playerId);
                }
            }
            for (const [answer, playerIds] of answersMap.entries()) {
                if (playerIds.length > 1) {
                    duplicates.push({ category: cat.key, players: playerIds, answer });
                }
            }
        }
        return duplicates;
    };

    const autoMarkDuplicates = () => {
        const duplicates = findDuplicates();
        if (duplicates.length === 0) {
            toast('لا توجد إجابات مكررة', { icon: '🔍' });
            return;
        }
        setLocalEvals(prev => {
            const updated = { ...prev };
            for (const dup of duplicates) {
                for (const playerId of dup.players) {
                    if (updated[playerId] && updated[playerId][dup.category]) {
                        updated[playerId][dup.category] = { status: 'duplicate', points: 5 };
                    }
                }
            }
            return updated;
        });
        toast.success(`تم وضع علامة "مكرر" على ${duplicates.length} فئة`, { icon: '🔄' });
    };

    const updatePlayerCategory = (playerId: string, category: string, status: EvaluationStatus) => {
        const points = status === 'correct' ? 10 : status === 'duplicate' ? 5 : 0;
        setLocalEvals(prev => ({
            ...prev,
            [playerId]: {
                ...prev[playerId],
                [category]: { status, points },
            },
        }));
    };

    const savePlayerEvaluation = async (playerId: string) => {
        if (savingPlayer) return;
        setSavingPlayer(playerId);
        // Save only this player's evaluations to DB
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
        setSavingPlayer(null);
        setCompletedPlayers(prev => new Set(prev).add(playerId));
        toast.success(`تم حفظ تقييم ${players.find(p => p.id === playerId)?.name || 'اللاعب'}`, { icon: '💾' });
    };

    const finalizeEvaluation = async () => {
        setSaving(true);
        await onSaveEvaluation(localEvals, true);
        setSaving(false);
    };

    const allPlayersEvaluated = records.length > 0 && records.every(rec => {
        const ev = localEvals[rec.playerId];
        return ev && Object.keys(ev).length === CATEGORIES.length && Object.values(ev).every(v => v.status !== 'pending');
    });

    if (!isHost) {
        // Real-time updates for non-host players
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
                <div className="bg-gray-50 rounded-2xl p-4 text-center">
                    <p className="text-sm font-bold text-gray-500">جاري انتظار تقييم المضيف...</p>
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto mt-2" />
                </div>
            );
        }

        // Show ongoing evaluation progress
        const evaluatedCount = records.filter(rec => {
            const ev = liveEvals[rec.playerId];
            return ev && Object.values(ev).some(v => v.status !== 'pending');
        }).length;
        return (
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-gray-700">تقدم التقييم</p>
                    <span className="text-xs font-bold text-indigo-600">{evaluatedCount}/{records.length} لاعب</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500" style={{ width: `${(evaluatedCount / records.length) * 100}%` }} />
                </div>
                <p className="text-xs text-gray-400 text-center">المضيف يقوم بتقييم الإجابات...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-3 text-center">
                <p className="font-black text-yellow-800">أنت الحكم! قيم إجابات كل لاعب.</p>
                <p className="text-xs text-yellow-700 mt-1">صحيح = 10 نقاط | مكرر = 5 نقاط | خطأ = 0</p>
                <button
                    onClick={autoMarkDuplicates}
                    className="mt-2 text-xs bg-yellow-200 hover:bg-yellow-300 text-yellow-800 px-3 py-1 rounded-full font-black transition-all inline-flex items-center gap-1"
                >
                    <Copy className="w-3 h-3" /> تقييم تلقائي للمكررات
                </button>
            </div>

            {records.map(rec => {
                const player = players.find(p => p.id === rec.playerId);
                const playerName = player?.name || rec.playerName;
                const isMe = rec.playerId === myId;
                const playerEval = localEvals[rec.playerId];
                const evaluatedCount = playerEval ? Object.values(playerEval).filter(v => v.status !== 'pending').length : 0;
                const isCompleted = evaluatedCount === CATEGORIES.length;

                return (
                    <div key={rec.playerId} className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden shadow-sm transition-all">
                        <div className={`px-4 py-2 ${isMe ? 'bg-blue-50' : 'bg-gray-50'} border-b border-gray-200 flex items-center justify-between`}>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black">{playerName}</span>
                                {isMe && <span className="text-[10px] bg-blue-200 text-blue-700 px-2 py-0.5 rounded-full">أنت</span>}
                                {rec.stopped && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">🏁 أنهى</span>}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-400">{evaluatedCount}/{CATEGORIES.length}</span>
                                {isCompleted && <CheckCircle className="w-4 h-4 text-green-500" />}
                            </div>
                        </div>

                        {CATEGORIES.map(cat => {
                            const answer = rec.answers[cat.key]?.trim() || '';
                            const isValid = answer.startsWith(letter) && answer.length > 1;
                            const current = playerEval?.[cat.key]?.status || 'pending';
                            const points = playerEval?.[cat.key]?.points || 0;

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
                                            onClick={() => updatePlayerCategory(rec.playerId, cat.key, 'correct')}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                                                current === 'correct'
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                            }`}
                                        >
                                            10 ✓
                                        </button>
                                        <button
                                            onClick={() => updatePlayerCategory(rec.playerId, cat.key, 'duplicate')}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                                                current === 'duplicate'
                                                    ? 'bg-orange-600 text-white'
                                                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                            }`}
                                        >
                                            5 🔁
                                        </button>
                                        <button
                                            onClick={() => updatePlayerCategory(rec.playerId, cat.key, 'wrong')}
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

                        {!isCompleted && (
                            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex justify-end">
                                <button
                                    onClick={() => savePlayerEvaluation(rec.playerId)}
                                    disabled={savingPlayer === rec.playerId}
                                    className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-black hover:bg-indigo-200 transition-all flex items-center gap-1"
                                >
                                    {savingPlayer === rec.playerId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                    حفظ هذا اللاعب
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}

            {allPlayersEvaluated && (
                <button
                    onClick={finalizeEvaluation}
                    disabled={saving}
                    className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-3 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <>إنهاء التقييم وإعلان النتائج 🏆</>}
                </button>
            )}
        </div>
    );
}

// ─── Enhanced Results Panel with detailed breakdown ──────────────────────────
function ResultsPanel({
    evaluations,
    records,
    players,
    myId,
    onExit,
}: {
    evaluations: Evaluations;
    records: PlayerRecord[];
    players: any[];
    myId: string;
    onExit: () => void;
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
    }, [evaluations, records, players, myId]);

    const isWinner = winner?.id === myId;

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
                <p className="text-indigo-200 text-sm mt-1">إجمالي النقاط: {winner?.points || 0}</p>
            </div>

            <div className="space-y-3">
                {totals.map((p, idx) => (
                    <div key={p.id} className={`bg-white rounded-xl border-2 p-3 ${p.isMe ? 'border-indigo-300 bg-indigo-50/50' : 'border-gray-100'}`}>
                        <div className="flex items-center justify-between mb-2">
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
                        <div className="grid grid-cols-4 gap-1 text-[10px] font-bold text-gray-500">
                            {CATEGORIES.map(cat => (
                                <div key={cat.key} className="flex items-center gap-1">
                                    <span>{cat.emoji}</span>
                                    <span>{p.details[cat.key] || 0}</span>
                                </div>
                            ))}
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
    const evaluations: Evaluations | null = gs.evaluations ?? null;

    // ── Local state ───────────────────────────────────────────────────────────
    const [answers, setAnswers]       = useState<Answers>(emptyAnswers);
    const [timeLeft, setTimeLeft]     = useState(TIMER_SECS);
    const [stopped, setStopped]       = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Evaluation phase
    const [evaluationPhase, setEvaluationPhase] = useState<'waiting' | 'comparison' | 'evaluating' | 'results'>('waiting');
    const [finalized, setFinalized] = useState(false);
    const [awarded, setAwarded] = useState(false);

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
            if (evaluations) {
                setEvaluationPhase('results');
            } else {
                // Show comparison cards first, then evaluation
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

    // ── Move from comparison to evaluation ────────────────────────────────────
    const startEvaluation = () => {
        setEvaluationPhase('evaluating');
    };

    // ── Save evaluations and award points ─────────────────────────────────────
    const handleSaveEvaluation = async (evals: Evaluations, finalize: boolean) => {
        if (awarded) return;

        // Save evaluations to DB
        await supabase
            .from('live_matches')
            .update({
                game_state: { ...gs, evaluations: evals, evaluation_completed: finalize },
            })
            .eq('id', match.id);

        if (!finalize) return; // only award when finalize is true

        // Calculate points per player
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

        // Award points
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
    // FINISHED – Comparison / Evaluation / Results
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'finished') {
        // Step 1: Show comparison cards (mobile-friendly)
        if (evaluationPhase === 'comparison') {
            return (
                <div className="flex flex-col gap-3 py-2 px-3 animate-in fade-in duration-400" dir="rtl">
                    {/* Header */}
                    <div className="bg-gradient-to-br from-violet-500 to-purple-700 text-white rounded-2xl p-4 text-center">
                        <div className="text-3xl mb-1">🚌</div>
                        <h3 className="font-black text-lg">انتهت الجولة!</h3>
                        <p className="text-purple-100 text-xs mt-0.5">
                            حرف الجولة: <span className="text-2xl font-black text-white mx-1">{letter}</span>
                        </p>
                        <p className="text-purple-200 text-[11px] mt-2">
                            🎯 الإجابة الصحيحة: تبدأ بـ "{letter}"
                        </p>
                    </div>

                    {/* Stats Summary */}
                    <div className="bg-white rounded-2xl p-3 border-2 border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-500">عدد اللاعبين</span>
                            <span className="text-lg font-black text-violet-600">{records.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-500">أول من أنهى</span>
                            <span className="text-sm font-bold text-green-600">
                                {records.find(r => r.stopped)?.playerName || '—'}
                            </span>
                        </div>
                    </div>

                    {/* Mobile-Friendly Comparison Cards */}
                    <div className="bg-white rounded-2xl p-3">
                        <p className="text-sm font-black text-gray-700 mb-3 flex items-center gap-2">
                            <Users className="w-4 h-4 text-violet-500" />
                            إجابات جميع اللاعبين
                        </p>
                        <ComparisonCards records={records} letter={letter} myId={myId} players={players} />
                    </div>

                    {/* Action Buttons */}
                    {isHost ? (
                        <button
                            onClick={startEvaluation}
                            className="w-full bg-gradient-to-r from-indigo-600 to-violet-700 text-white py-4 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <BrainCircuit className="w-5 h-5" />
                            بدء التقييم
                        </button>
                    ) : (
                        <div className="bg-gray-50 rounded-2xl p-4 text-center border-2 border-gray-200">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto mb-2" />
                            <p className="text-sm font-bold text-gray-600">جاري انتظار المضيف لبدء التقييم...</p>
                            <p className="text-[10px] text-gray-400 mt-1">يمكنك مراجعة إجابات اللاعبين أعلاه</p>
                        </div>
                    )}

                    <button onClick={onExit} className="text-xs font-bold text-gray-400 hover:text-gray-600 py-2 text-center transition-all">
                        ← العودة إلى الصالة
                    </button>
                </div>
            );
        }

        // Step 2: Evaluation phase (host evaluates, others watch realtime)
        if (evaluationPhase === 'evaluating') {
            return (
                <div className="flex flex-col gap-3 py-2 px-3 animate-in fade-in duration-400" dir="rtl">
                    <div className="bg-gradient-to-br from-violet-500 to-purple-700 text-white rounded-2xl p-4 text-center">
                        <div className="text-3xl mb-1">🚌</div>
                        <h3 className="font-black text-lg">تقييم الإجابات</h3>
                        <p className="text-purple-100 text-xs mt-0.5">حرف الجولة: {letter}</p>
                    </div>

                    <EvaluationPanel
                        records={records}
                        letter={letter}
                        players={players}
                        myId={myId}
                        onSaveEvaluation={handleSaveEvaluation}
                        evaluations={evaluations}
                        isHost={isHost}
                        matchId={match.id}
                    />

                    {!isHost && (
                        <button onClick={onExit} className="text-xs font-bold text-gray-400 hover:text-gray-600 py-1 text-center">
                            ← العودة إلى الصالة
                        </button>
                    )}
                </div>
            );
        }

        // Step 3: Show final results
        if (evaluationPhase === 'results') {
            return (
                <div className="flex flex-col gap-3 py-2 px-3" dir="rtl">
                    <div className="bg-gradient-to-br from-violet-500 to-purple-700 text-white rounded-2xl p-4 text-center">
                        <div className="text-3xl mb-1">🚌</div>
                        <h3 className="font-black text-lg">نتائج الجولة</h3>
                        <p className="text-purple-100 text-xs mt-0.5">حرف الجولة: {letter}</p>
                    </div>
                    <ResultsPanel
                        evaluations={evaluations!}
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