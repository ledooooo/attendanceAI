import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, CheckCircle, XCircle, Flag, Users, Trophy, Star, Timer } from 'lucide-react';
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

// Score options the host can give
const SCORE_OPTIONS = [
    { value: 10, label: '10', color: 'bg-green-500 text-white',  hover: 'hover:bg-green-600' },
    { value: 5,  label: '5',  color: 'bg-yellow-400 text-gray-900', hover: 'hover:bg-yellow-500' },
    { value: 0,  label: '0',  color: 'bg-red-400 text-white',    hover: 'hover:bg-red-500'    },
];

type Answers = Record<string, string>;

// scores: { [playerId]: { [categoryKey]: 0|5|10 } }
type ScoreMap = Record<string, Record<string, number>>;

type PlayerRecord = {
    playerId:   string;
    playerName: string;
    answers:    Answers;
    stopped:    boolean;   // true = this player pressed خلصت
    totalScore: number;    // calculated after host scoring
};

interface GameState {
    letter:    string;
    startedAt: number;
    records:   PlayerRecord[];
    scores:    ScoreMap;        // host-assigned scores
    scoringDone: boolean;       // host finished scoring
    phase:     'playing' | 'finished';
}

interface Props {
    match:       any;
    employee:    Employee;
    onExit:      () => void;
    grantPoints: (pts: number) => Promise<void>;
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

// ─── Sound ────────────────────────────────────────────────────────────────────
function useSound() {
    const ctx = useRef<AudioContext | null>(null);
    const get = () => {
        if (!ctx.current) ctx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return ctx.current;
    };
    return useCallback((type: 'tick' | 'stop' | 'win' | 'timeout') => {
        try {
            const ac = get(), now = ac.currentTime;
            if (type === 'tick') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.value = 880;
                g.gain.setValueAtTime(0.1, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
                o.start(now); o.stop(now + 0.07);
            }
            if (type === 'stop') {
                [659, 784, 1047].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'square'; o.frequency.value = f;
                    const t = now + i * 0.09;
                    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
                    o.start(t); o.stop(t + 0.22);
                });
            }
            if (type === 'win') {
                [523, 659, 784, 1047].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'triangle'; o.frequency.value = f;
                    const t = now + i * 0.12;
                    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
                    o.start(t); o.stop(t + 0.3);
                });
            }
            if (type === 'timeout') {
                [330, 220].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'sine'; o.frequency.value = f;
                    const t = now + i * 0.18;
                    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
                    o.start(t); o.stop(t + 0.22);
                });
            }
        } catch (_) {}
    }, []);
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
            <span className={`absolute text-xs font-black ${
                seconds <= 20 ? 'text-red-600 animate-pulse' :
                seconds <= 45 ? 'text-orange-600' : 'text-green-700'
            }`}>
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
                    <div key={cat.key} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
                        valid ? 'border-green-400 bg-green-50' :
                        has   ? 'border-orange-300 bg-orange-50' :
                                'border-gray-200 bg-white'
                    }`}>
                        <span className="text-base flex-shrink-0">{cat.emoji}</span>
                        <span className="text-[11px] font-black text-gray-500 w-14 flex-shrink-0">{cat.label}</span>
                        <input
                            type="text" value={val}
                            onChange={e => onChange(cat.key, e.target.value)}
                            disabled={disabled}
                            placeholder={`يبدأ بـ "${letter}"`} dir="rtl"
                            className="flex-1 text-sm font-bold bg-transparent outline-none text-gray-800 placeholder:text-gray-300 disabled:opacity-50 min-w-0"
                        />
                        {valid && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0"/>}
                        {!valid && has && <XCircle className="w-4 h-4 text-orange-400 flex-shrink-0"/>}
                    </div>
                );
            })}
            <div className="flex items-center justify-between px-1 pt-0.5">
                <span className="text-[11px] font-bold text-gray-400">{filled}/{CATEGORIES.length} صحيح</span>
                <div className="flex gap-1">
                    {CATEGORIES.map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full ${i < filled ? 'bg-green-400' : 'bg-gray-200'}`}/>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Results Table ────────────────────────────────────────────────────────────
// Shown to ALL players after game ends
function ResultsTable({ records, letter, scores, scoringDone }: {
    records: PlayerRecord[];
    letter: string;
    scores: ScoreMap;
    scoringDone: boolean;
}) {
    return (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
            <table className="min-w-full text-right text-xs" dir="rtl">
                <thead>
                    <tr className="bg-violet-600 text-white">
                        <th className="px-3 py-2.5 font-black text-right sticky right-0 bg-violet-600 z-10 min-w-[80px]">اللاعب</th>
                        {CATEGORIES.map(cat => (
                            <th key={cat.key} className="px-2 py-2.5 font-black whitespace-nowrap min-w-[70px]">
                                {cat.emoji} {cat.label}
                            </th>
                        ))}
                        {scoringDone && (
                            <th className="px-3 py-2.5 font-black bg-yellow-500 text-gray-900 sticky left-0 z-10">المجموع</th>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {records.map((rec, rowIdx) => {
                        const playerScores = scores[rec.playerId] ?? {};
                        const total = Object.values(playerScores).reduce((s, v) => s + v, 0);
                        return (
                            <tr key={rec.playerId} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                {/* Player name */}
                                <td className={`px-3 py-2 font-black sticky right-0 z-10 border-l border-gray-100 ${
                                    rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                }`}>
                                    <div className="flex items-center gap-1.5">
                                        {rec.stopped && <span className="text-green-500 text-[10px]">🏁</span>}
                                        <span className="text-gray-800 truncate max-w-[70px]">{rec.playerName}</span>
                                    </div>
                                </td>
                                {/* Each category */}
                                {CATEGORIES.map(cat => {
                                    const val = rec.answers[cat.key]?.trim() ?? '';
                                    const score = playerScores[cat.key];
                                    const hasScore = score !== undefined;
                                    return (
                                        <td key={cat.key} className="px-2 py-2 text-center border-r border-gray-100">
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className={`text-xs font-bold ${val ? 'text-gray-700' : 'text-gray-300 italic'}`}>
                                                    {val || '—'}
                                                </span>
                                                {hasScore && (
                                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                                                        score === 10 ? 'bg-green-100 text-green-700' :
                                                        score === 5  ? 'bg-yellow-100 text-yellow-700' :
                                                                       'bg-red-100 text-red-500'
                                                    }`}>
                                                        {score}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                                {/* Total */}
                                {scoringDone && (
                                    <td className={`px-3 py-2 font-black text-center sticky left-0 z-10 border-r border-gray-100 ${
                                        rowIdx % 2 === 0 ? 'bg-yellow-50' : 'bg-yellow-50'
                                    }`}>
                                        <span className="text-base font-black text-amber-700">{total}</span>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── Host Scoring Panel ───────────────────────────────────────────────────────
// Only the HOST (room creator) sees this
function HostScoringPanel({ records, letter, scores, onScore, onFinish, saving }: {
    records: PlayerRecord[];
    letter: string;
    scores: ScoreMap;
    onScore: (playerId: string, catKey: string, value: number) => void;
    onFinish: () => void;
    saving: boolean;
}) {
    // Count how many scores have been assigned
    const totalCells = records.length * CATEGORIES.length;
    const scoredCells = records.reduce((acc, rec) => {
        return acc + Object.keys(scores[rec.playerId] ?? {}).length;
    }, 0);
    const allScored = scoredCells >= totalCells;

    return (
        <div className="space-y-3" dir="rtl">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-3 text-white flex items-center gap-3">
                <Star className="w-6 h-6 flex-shrink-0"/>
                <div className="flex-1">
                    <p className="font-black text-sm">أنت المضيف — قيّم الإجابات</p>
                    <p className="text-[11px] text-amber-100">{scoredCells}/{totalCells} تم تقييمه</p>
                </div>
                <div className="bg-white/20 rounded-xl px-2 py-1 text-center">
                    <p className="text-lg font-black">{scoredCells}</p>
                    <p className="text-[9px]">/{totalCells}</p>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-300"
                    style={{ width: `${totalCells > 0 ? (scoredCells / totalCells) * 100 : 0}%` }}
                />
            </div>

            {/* Score each player × category */}
            {records.map(rec => (
                <div key={rec.playerId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="bg-violet-50 px-3 py-2 border-b border-violet-100 flex items-center gap-2">
                        {rec.stopped && <span className="text-green-500">🏁</span>}
                        <span className="font-black text-violet-800 text-sm">{rec.playerName}</span>
                        <span className="mr-auto text-[10px] text-gray-400 font-bold">
                            {Object.keys(scores[rec.playerId] ?? {}).length}/{CATEGORIES.length} تم
                        </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {CATEGORIES.map(cat => {
                            const val = rec.answers[cat.key]?.trim() ?? '';
                            const currentScore = scores[rec.playerId]?.[cat.key];
                            const isEmpty = !val;
                            return (
                                <div key={cat.key} className="flex items-center gap-2 px-3 py-2">
                                    <span className="text-base flex-shrink-0">{cat.emoji}</span>
                                    <span className="text-[11px] font-black text-gray-400 w-14 flex-shrink-0">{cat.label}</span>
                                    <span className={`flex-1 text-sm font-bold min-w-0 truncate ${
                                        isEmpty ? 'text-gray-300 italic' : 'text-gray-700'
                                    }`}>
                                        {val || 'لا يوجد'}
                                    </span>
                                    {/* Score buttons */}
                                    <div className="flex gap-1 flex-shrink-0">
                                        {isEmpty ? (
                                            // Auto-zero for empty
                                            <span className="text-[10px] font-black bg-red-100 text-red-500 px-2 py-1 rounded-lg">
                                                0 تلقائي
                                            </span>
                                        ) : (
                                            SCORE_OPTIONS.map(opt => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => onScore(rec.playerId, cat.key, opt.value)}
                                                    className={`w-8 h-8 rounded-lg font-black text-xs transition-all active:scale-90 border-2 ${
                                                        currentScore === opt.value
                                                            ? `${opt.color} border-transparent scale-110 shadow-md`
                                                            : `bg-gray-50 text-gray-500 border-gray-200 ${opt.hover}`
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            <button
                onClick={onFinish}
                disabled={!allScored || saving}
                className="w-full bg-gradient-to-r from-violet-600 to-purple-700 text-white py-3.5 rounded-2xl font-black text-base shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
                {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin"/>
                ) : (
                    <><Trophy className="w-5 h-5"/> إنهاء التقييم وإعلان النتائج</>
                )}
            </button>
        </div>
    );
}

// ─── Leaderboard after scoring ────────────────────────────────────────────────
function FinalLeaderboard({ records, scores, myId, grantPoints }: {
    records: PlayerRecord[];
    scores: ScoreMap;
    myId: string;
    grantPoints: (pts: number) => Promise<void>;
}) {
    const [granted, setGranted] = useState(false);

    // Calculate totals and sort
    const ranked = records
        .map(rec => ({
            ...rec,
            total: Object.values(scores[rec.playerId] ?? {}).reduce((s, v) => s + v, 0),
        }))
        .sort((a, b) => b.total - a.total);

    const myRank = ranked.findIndex(r => r.playerId === myId);
    const myTotal = ranked[myRank]?.total ?? 0;

    useEffect(() => {
        if (granted || myTotal <= 0) return;
        setGranted(true);
        grantPoints(myTotal);
    }, []);

    return (
        <div className="space-y-2" dir="rtl">
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-4 text-white text-center shadow-xl">
                <Trophy className="w-10 h-10 mx-auto mb-1 drop-shadow"/>
                <h3 className="text-lg font-black">النتائج النهائية 🏆</h3>
                <p className="text-amber-100 text-xs mt-0.5">تم إضافة نقاطك تلقائياً!</p>
            </div>

            {ranked.map((rec, i) => {
                const isMe = rec.playerId === myId;
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                return (
                    <div key={rec.playerId} className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
                        isMe ? 'border-violet-300 bg-violet-50' : 'border-gray-100 bg-white'
                    }`}>
                        <span className="text-xl w-8 text-center flex-shrink-0">{medal ?? `#${i + 1}`}</span>
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-black truncate ${isMe ? 'text-violet-700' : 'text-gray-800'}`}>
                                {rec.playerName} {isMe && '(أنت)'}
                            </p>
                            {/* Mini bar */}
                            <div className="flex gap-0.5 mt-1">
                                {CATEGORIES.map(cat => {
                                    const s = scores[rec.playerId]?.[cat.key] ?? 0;
                                    return (
                                        <div key={cat.key} className={`h-1.5 flex-1 rounded-full ${
                                            s === 10 ? 'bg-green-400' : s === 5 ? 'bg-yellow-400' : 'bg-gray-200'
                                        }`}/>
                                    );
                                })}
                            </div>
                        </div>
                        <div className={`text-right flex-shrink-0 px-3 py-1.5 rounded-xl ${
                            i === 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                        }`}>
                            <p className="text-lg font-black">{rec.total}</p>
                            <p className="text-[9px] font-bold">نقطة</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StopTheBusGame({ match, employee, onExit, grantPoints }: Props) {
    const play   = useSound();
    const myId   = employee.employee_id;
    const myName = employee.name?.split(' ')[0] || 'أنت';

    // ── Derived ───────────────────────────────────────────────────────────────
    const gs: GameState    = match.game_state ?? {};
    const letter           = gs.letter    ?? '';
    const startedAt        = gs.startedAt ?? 0;
    const records          = gs.records   ?? [];
    const scores: ScoreMap = gs.scores    ?? {};
    const scoringDone      = gs.scoringDone ?? false;
    const phase            = gs.phase     ?? 'playing';
    const status: string   = match.status ?? 'waiting';
    const players: any[]   = match.players ?? [];

    // Host = whoever created the room
    const isHost = match.created_by === employee.employee_id;

    // ── Local state ───────────────────────────────────────────────────────────
    const [answers, setAnswers]       = useState<Answers>(emptyAnswers);
    const [timeLeft, setTimeLeft]     = useState(TIMER_SECS);
    const [stopped, setStopped]       = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [savingScores, setSavingScores] = useState(false);
    const [localScores, setLocalScores]   = useState<ScoreMap>({});

    const prevTickRef  = useRef(TIMER_SECS);
    const soundedStop  = useRef(false);
    const savedOnStop  = useRef(false);

    // ── Sync local scores from DB ─────────────────────────────────────────────
    useEffect(() => {
        setLocalScores(scores);
    }, [JSON.stringify(scores)]);

    // ── My record ─────────────────────────────────────────────────────────────
    const myRecord = records.find(r => r.playerId === myId);
    const iStopped = stopped || !!myRecord;
    const stopper  = records.find(r => r.stopped);

    const myPlayerInfo  = players.find((p: any) => p.id === myId);
    const myDisplayName = myPlayerInfo?.name || myName;

    // ── Auto-save when someone else stops ─────────────────────────────────────
    useEffect(() => {
        if (!stopper || stopper.playerId === myId || savedOnStop.current || iStopped) return;
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
            // Time's up — auto-end game (host triggers it)
            if (left === 0 && isHost && status === 'playing') {
                play('timeout');
                endGame();
            }
            // Non-host: save own answers on timeout
            if (left === 0 && !savedOnStop.current && !iStopped) {
                savedOnStop.current = true;
                saveMyAnswers(false);
            }
        };
        tick();
        const iv = setInterval(tick, 500);
        return () => clearInterval(iv);
    }, [status, startedAt, iStopped]);

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
            totalScore: 0,
        };

        const updatedRecords = [...records.filter(r => r.playerId !== myId), rec];
        const update: any = {
            game_state: {
                ...gs,
                records: updatedRecords,
            },
        };
        if (iAmStopper) {
            // Stopper ends the game immediately
            update.status = 'finished';
            update.game_state.phase = 'finished';
        }

        await supabase.from('live_matches').update(update).eq('id', match.id);
        setSubmitting(false);
    };

    // ── Host ends game (timer ran out) ────────────────────────────────────────
    const endGame = async () => {
        // Make sure my own answers are saved first
        const myRec = records.find(r => r.playerId === myId);
        const finalRecords = myRec ? records : [
            ...records,
            { playerId: myId, playerName: myDisplayName, answers, stopped: false, totalScore: 0 },
        ];
        await supabase.from('live_matches').update({
            status: 'finished',
            game_state: { ...gs, records: finalRecords, phase: 'finished' },
        }).eq('id', match.id);
    };

    // ── Stop button ───────────────────────────────────────────────────────────
    const handleStop = async () => {
        if (submitting || iStopped) return;
        if (!soundedStop.current) { soundedStop.current = true; play('stop'); }
        await saveMyAnswers(true);
    };

    // ── Host: update a score locally ─────────────────────────────────────────
    const handleScore = (playerId: string, catKey: string, value: number) => {
        setLocalScores(prev => ({
            ...prev,
            [playerId]: { ...(prev[playerId] ?? {}), [catKey]: value },
        }));
    };

    // ── Auto-zero empty cells ─────────────────────────────────────────────────
    const buildFinalScores = (sc: ScoreMap): ScoreMap => {
        const final: ScoreMap = {};
        records.forEach(rec => {
            final[rec.playerId] = {};
            CATEGORIES.forEach(cat => {
                const val = rec.answers[cat.key]?.trim() ?? '';
                if (!val) {
                    final[rec.playerId][cat.key] = 0;
                } else {
                    final[rec.playerId][cat.key] = sc[rec.playerId]?.[cat.key] ?? 0;
                }
            });
        });
        return final;
    };

    // ── Host: finalize scoring ────────────────────────────────────────────────
    const handleFinishScoring = async () => {
        setSavingScores(true);
        const finalScores = buildFinalScores(localScores);

        // Calculate totals
        const updatedRecords = records.map(rec => ({
            ...rec,
            totalScore: Object.values(finalScores[rec.playerId] ?? {}).reduce((s, v) => s + v, 0),
        }));

        await supabase.from('live_matches').update({
            game_state: {
                ...gs,
                scores: finalScores,
                scoringDone: true,
                records: updatedRecords,
            },
        }).eq('id', match.id);
        setSavingScores(false);
        play('win');
    };

    // ── Host starts ───────────────────────────────────────────────────────────
    const handleStart = async () => {
        await supabase.from('live_matches').update({
            status: 'playing',
            game_state: {
                letter: pickLetter(),
                startedAt: Date.now(),
                records: [],
                scores: {},
                scoringDone: false,
                phase: 'playing',
            },
        }).eq('id', match.id);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // WAITING
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className="py-6 px-4 flex flex-col gap-4" dir="rtl">
            {/* Header */}
            <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-700 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-2xl">
                    <span className="text-4xl">🚌</span>
                </div>
                <h3 className="text-xl font-black text-gray-800 mb-1">أتوبيس كومبليت!</h3>
                <p className="text-sm text-gray-400 font-bold">يصل لـ 10 لاعبين — حرف واحد، 8 فئات</p>
            </div>

            {/* Players list */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                <p className="text-xs font-black text-gray-500 mb-2.5 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5"/> اللاعبون في الغرفة ({players.length}/10)
                </p>
                <div className="flex flex-wrap gap-2">
                    {players.map((p: any, i: number) => (
                        <div key={p.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${
                            p.id === match.created_by
                                ? 'bg-amber-50 border-amber-300 text-amber-800'
                                : 'bg-violet-50 border-violet-200 text-violet-700'
                        }`}>
                            <span>{p.avatar?.startsWith('http') ? '👤' : (p.avatar || '👤')}</span>
                            <span>{p.name}</span>
                            {p.id === myId && <span className="text-[10px] opacity-60">(أنت)</span>}
                            {p.id === match.created_by && <span className="text-[10px] text-amber-600">👑 مضيف</span>}
                        </div>
                    ))}
                    {/* Empty slots */}
                    {Array.from({ length: Math.max(0, 2 - players.length) }).map((_, i) => (
                        <div key={`empty-${i}`} className="px-3 py-1.5 rounded-full border border-dashed border-gray-200 text-xs text-gray-300 font-bold">
                            ينتظر...
                        </div>
                    ))}
                </div>
            </div>

            {/* Rules */}
            <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                <p className="text-[11px] font-black text-gray-500 mb-1">قواعد اللعبة:</p>
                {[
                    'اكتب كلمة تبدأ بالحرف المحدد لكل فئة',
                    'اضغط "خلصت" لإيقاف اللعبة وإنهائها للجميع',
                    'المضيف يقيّم كل إجابة: 10 أو 5 أو 0',
                    'النقاط تُضاف تلقائياً بعد انتهاء التقييم',
                ].map((rule, i) => (
                    <div key={i} className="flex items-start gap-2">
                        <span className="text-violet-500 font-black text-[11px] flex-shrink-0">{i + 1}.</span>
                        <span className="text-[11px] text-gray-600 font-bold">{rule}</span>
                    </div>
                ))}
            </div>

            {isHost ? (
                <div className="flex flex-col items-center gap-2">
                    <button
                        onClick={handleStart}
                        disabled={players.length < 2}
                        className="w-full bg-gradient-to-r from-violet-500 to-purple-700 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
                    >
                        🎲 ابدأ اللعبة
                    </button>
                    {players.length < 2 && (
                        <p className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                            ⏳ في انتظار لاعب آخر للانضمام...
                        </p>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 justify-center py-3 bg-white rounded-xl border border-gray-100">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-500"/>
                    <span className="text-sm font-bold text-gray-500">في انتظار المضيف ليبدأ...</span>
                </div>
            )}

            <button onClick={onExit} className="text-sm font-bold text-gray-400 hover:text-gray-600 text-center">
                ← العودة إلى الصالة
            </button>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // PLAYING
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'playing') return (
        <div className="flex flex-col gap-2 py-2 px-3" dir="rtl">
            {/* Header row */}
            <div className="flex items-center gap-2">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-700 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <span className="text-2xl font-black text-white">{letter}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-gray-700">حرف الجولة</p>
                    <p className="text-[11px] font-bold text-gray-400">
                        {iStopped
                            ? '✅ إجاباتك محفوظة'
                            : `${validCount(answers, letter)}/${CATEGORIES.length} إجابة صحيحة`}
                    </p>
                </div>
                <TimerRing seconds={timeLeft} total={TIMER_SECS}/>
            </div>

            {/* Stopper alert */}
            {stopper && stopper.playerId !== myId && !iStopped && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl px-3 py-2 flex items-center gap-2">
                    <Flag className="w-4 h-4 text-red-500 flex-shrink-0"/>
                    <p className="text-xs font-black text-red-700">
                        🏁 {stopper.playerName} أوقف الأتوبيس! جاري حفظ إجاباتك...
                    </p>
                </div>
            )}

            {/* Players progress */}
            <div className="flex flex-wrap gap-1.5">
                {players.map((p: any) => {
                    const saved = !!records.find(r => r.playerId === p.id);
                    return (
                        <div key={p.id} className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${
                            saved
                                ? 'bg-green-100 border-green-300 text-green-700'
                                : 'bg-gray-100 border-gray-200 text-gray-400'
                        }`}>
                            {saved ? '✓' : '⏳'} {p.name}
                        </div>
                    );
                })}
            </div>

            {iStopped ? (
                <div className="text-center py-6 bg-white rounded-2xl border-2 border-green-200 shadow-sm">
                    <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2"/>
                    <p className="font-black text-gray-700 text-sm">إجاباتك محفوظة!</p>
                    <p className="text-xs text-gray-400 mt-1">
                        في انتظار باقي اللاعبين... ({records.length}/{players.length})
                    </p>
                </div>
            ) : (
                <>
                    <AnswerForm
                        letter={letter} answers={answers}
                        onChange={(k, v) => setAnswers(prev => ({ ...prev, [k]: v }))}
                        disabled={false}
                    />
                    <button
                        onClick={handleStop} disabled={submitting}
                        className="w-full bg-gradient-to-r from-violet-500 to-purple-700 text-white py-4 rounded-2xl font-black text-base shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
                    >
                        {submitting
                            ? <Loader2 className="w-5 h-5 animate-spin"/>
                            : <><Flag className="w-5 h-5"/>🛑 خلصت! أوقف الأتوبيس</>
                        }
                    </button>
                </>
            )}

            <button onClick={onExit} className="text-xs font-bold text-gray-400 hover:text-gray-600 py-1 text-center">
                ← العودة إلى الصالة
            </button>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // FINISHED
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'finished') return (
        <div className="flex flex-col gap-3 py-2 px-3 animate-in fade-in duration-400" dir="rtl">

            {/* Header */}
            <div className="bg-gradient-to-br from-violet-500 to-purple-700 text-white rounded-2xl p-4 text-center">
                <div className="text-3xl mb-1">🚌</div>
                <h3 className="font-black text-lg">انتهت الجولة!</h3>
                <p className="text-purple-100 text-xs mt-0.5">
                    حرف الجولة: <span className="text-2xl font-black text-white mx-1">{letter}</span>
                </p>
                {stopper && (
                    <div className="mt-2 bg-white/20 rounded-xl px-3 py-1 inline-block">
                        <p className="text-xs font-black">🏁 {stopper.playerName} أنهى أولاً!</p>
                    </div>
                )}
            </div>

            {/* Results table — always visible to everyone */}
            <div>
                <p className="text-xs font-black text-gray-500 mb-2 px-1">جدول الإجابات:</p>
                <ResultsTable
                    records={records}
                    letter={letter}
                    scores={scoringDone ? scores : localScores}
                    scoringDone={scoringDone}
                />
            </div>

            {/* HOST: scoring panel (only before scoring is done) */}
            {isHost && !scoringDone && records.length > 0 && (
                <HostScoringPanel
                    records={records}
                    letter={letter}
                    scores={localScores}
                    onScore={handleScore}
                    onFinish={handleFinishScoring}
                    saving={savingScores}
                />
            )}

            {/* After scoring done: leaderboard */}
            {scoringDone && (
                <FinalLeaderboard
                    records={records}
                    scores={scores}
                    myId={myId}
                    grantPoints={grantPoints}
                />
            )}

            {/* Non-host waiting message */}
            {!isHost && !scoringDone && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-500 mx-auto mb-2"/>
                    <p className="font-black text-amber-800 text-sm">المضيف يقيّم الإجابات...</p>
                    <p className="text-xs text-amber-600 mt-1">انتظر حتى تظهر النتائج النهائية</p>
                </div>
            )}

            <button
                onClick={onExit}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-700 text-white py-3.5 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
                <Users className="w-5 h-5"/> العودة إلى الصالة
            </button>
        </div>
    );

    return null;
}
