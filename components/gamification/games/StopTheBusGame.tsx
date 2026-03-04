import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Trophy, Clock, CheckCircle, XCircle, Flag, Users, LogOut, Zap, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const TIMER_SECS = 120; // 2 minutes

const ARABIC_LETTERS = [
    'أ','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش',
    'ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي'
];

const CATEGORIES = [
    { key: 'male',    label: 'اسم ذكر',    emoji: '👨' },
    { key: 'female',  label: 'اسم أنثى',   emoji: '👩' },
    { key: 'plant',   label: 'نبات',        emoji: '🌿' },
    { key: 'food',    label: 'أكلة',        emoji: '🍽️' },
    { key: 'object',  label: 'جماد',        emoji: '📦' },
    { key: 'animal',  label: 'حيوان',       emoji: '🐾' },
    { key: 'country', label: 'بلد',         emoji: '🌍' },
    { key: 'famous',  label: 'مشهور',       emoji: '⭐' },
];

type Answers = Record<string, string>;
type PlayerAnswers = { playerId: string; playerName: string; answers: Answers; finishedAt: number | null };

// ─── Audio ────────────────────────────────────────────────────────────────────
function useSound() {
    const ctx = useRef<AudioContext | null>(null);
    const getCtx = () => {
        if (!ctx.current) ctx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return ctx.current;
    };
    return useCallback((type: 'tick' | 'finish' | 'win' | 'timeout') => {
        try {
            const ac = getCtx();
            const now = ac.currentTime;
            if (type === 'tick') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.value = 880;
                g.gain.setValueAtTime(0.15, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                o.start(now); o.stop(now + 0.08);
            }
            if (type === 'finish') {
                [523, 659, 784].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'triangle'; o.frequency.value = f;
                    const t = now + i * 0.1;
                    g.gain.setValueAtTime(0.25, t);
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                    o.start(t); o.stop(t + 0.25);
                });
            }
            if (type === 'win') {
                [523, 659, 784, 1047].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'triangle'; o.frequency.value = f;
                    const t = now + i * 0.13;
                    g.gain.setValueAtTime(0.3, t);
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
                    o.start(t); o.stop(t + 0.35);
                });
            }
            if (type === 'timeout') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sawtooth'; o.frequency.value = 220;
                g.gain.setValueAtTime(0.3, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                o.start(now); o.stop(now + 0.5);
            }
        } catch (_) {}
    }, []);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pickLetter(): string {
    return ARABIC_LETTERS[Math.floor(Math.random() * ARABIC_LETTERS.length)];
}

function countFilled(answers: Answers): number {
    return Object.values(answers).filter(v => v.trim().length > 0).length;
}

function scoreAnswers(allAnswers: PlayerAnswers[], letter: string): Record<string, number> {
    const scores: Record<string, number> = {};
    allAnswers.forEach(p => { scores[p.playerId] = 0; });

    CATEGORIES.forEach(cat => {
        // Collect all non-empty answers for this category
        const catAnswers = allAnswers
            .filter(p => p.answers[cat.key]?.trim())
            .map(p => ({ id: p.playerId, val: p.answers[cat.key].trim() }));

        catAnswers.forEach(({ id, val }) => {
            // Must start with correct letter
            if (!val.startsWith(letter)) return;
            // Check if unique
            const sameCount = catAnswers.filter(a => a.val === val).length;
            scores[id] += sameCount === 1 ? 10 : 5;
        });
    });

    return scores;
}

// ─── Timer Display ────────────────────────────────────────────────────────────
function TimerRing({ seconds, total }: { seconds: number; total: number }) {
    const pct = seconds / total;
    const r = 28, circ = 2 * Math.PI * r;
    const offset = circ * (1 - pct);
    const isRed = seconds <= 20;
    const isOrange = seconds <= 45;

    return (
        <div className="relative w-16 h-16 flex items-center justify-center">
            <svg width={64} height={64} viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={32} cy={32} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5}/>
                <circle cx={32} cy={32} r={r} fill="none"
                    stroke={isRed ? '#ef4444' : isOrange ? '#f97316' : '#22c55e'}
                    strokeWidth={5}
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
                />
            </svg>
            <span className={`absolute text-sm font-black ${isRed ? 'text-red-600 animate-pulse' : isOrange ? 'text-orange-600' : 'text-green-700'}`}>
                {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}
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
    const filled = countFilled(answers);
    return (
        <div className="space-y-2">
            {CATEGORIES.map(cat => {
                const val = answers[cat.key] ?? '';
                const ok = val.trim().startsWith(letter) && val.trim().length > 1;
                const hasVal = val.trim().length > 0;
                return (
                    <div key={cat.key}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
                            ok ? 'border-green-400 bg-green-50' :
                            hasVal ? 'border-orange-300 bg-orange-50' :
                            'border-gray-200 bg-white'
                        }`}>
                        <span className="text-lg flex-shrink-0">{cat.emoji}</span>
                        <span className="text-xs font-black text-gray-500 w-16 flex-shrink-0">{cat.label}</span>
                        <input
                            type="text"
                            value={val}
                            onChange={e => onChange(cat.key, e.target.value)}
                            disabled={disabled}
                            placeholder={`يبدأ بـ "${letter}"`}
                            dir="rtl"
                            className={`flex-1 text-sm font-bold bg-transparent outline-none text-gray-800 placeholder:text-gray-300 disabled:opacity-60 min-w-0`}
                        />
                        {ok && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0"/>}
                    </div>
                );
            })}
            <div className="flex items-center justify-between px-1 pt-1">
                <span className="text-xs font-bold text-gray-400">{filled}/{CATEGORIES.length} مكتمل</span>
                <div className="flex gap-0.5">
                    {CATEGORIES.map((_, i) => (
                        <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < filled ? 'bg-green-400' : 'bg-gray-200'}`}/>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Results View ─────────────────────────────────────────────────────────────
function ResultsView({ allAnswers, letter, myId, onExit, grantPoints, amIWinner, winnerName, scores }: {
    allAnswers: PlayerAnswers[]; letter: string; myId: string;
    onExit: () => void; grantPoints: (pts: number) => Promise<void>;
    amIWinner: boolean; winnerName: string; scores: Record<string, number>;
}) {
    const [granted, setGranted] = useState(false);
    const myScore = scores[myId] ?? 0;

    const handleGrant = async () => {
        if (granted) return;
        setGranted(true);
        await grantPoints(amIWinner ? 20 : myScore > 0 ? 5 : 0);
        toast.success(amIWinner ? '🏆 +20 نقطة للفوز!' : myScore > 0 ? `+5 نقاط للمشاركة` : 'حظ أحسن!');
    };

    useEffect(() => { handleGrant(); }, []);

    return (
        <div className="space-y-4 py-2 px-3 animate-in fade-in duration-500">
            {/* Winner banner */}
            <div className={`text-center py-3 px-4 rounded-2xl border-2 ${amIWinner ? 'bg-amber-50 border-amber-400' : 'bg-blue-50 border-blue-300'}`}>
                <div className="text-3xl mb-1">{amIWinner ? '🏆' : '🎖️'}</div>
                <p className="font-black text-sm text-gray-800">
                    {amIWinner ? 'فزت!' : `فاز ${winnerName}`}
                </p>
                <p className="text-xs font-bold text-gray-500 mt-0.5">حرف الجولة: <span className="text-2xl font-black text-blue-700">{letter}</span></p>
            </div>

            {/* Score summary */}
            <div className="grid grid-cols-2 gap-2">
                {allAnswers.map(p => (
                    <div key={p.playerId}
                        className={`p-2.5 rounded-xl border-2 text-center ${p.playerId===myId ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                        <p className="text-xs font-black text-gray-700 truncate">{p.playerName}</p>
                        <p className="text-2xl font-black text-blue-700 leading-tight">{scores[p.playerId] ?? 0}</p>
                        <p className="text-[10px] font-bold text-gray-400">نقطة</p>
                        {p.finishedAt && <span className="text-[10px] font-black text-green-600">✓ أنهى أولاً</span>}
                    </div>
                ))}
            </div>

            {/* Answers comparison — per category */}
            <div className="space-y-2">
                <p className="text-xs font-black text-gray-500 px-1">مقارنة الإجابات:</p>
                {CATEGORIES.map(cat => (
                    <div key={cat.key} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                        <div className="bg-gray-50 px-3 py-1.5 flex items-center gap-1.5 border-b border-gray-100">
                            <span>{cat.emoji}</span>
                            <span className="text-xs font-black text-gray-600">{cat.label}</span>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {allAnswers.map(p => {
                                const val = p.answers[cat.key]?.trim() ?? '';
                                const valid = val.startsWith(letter) && val.length > 1;
                                const unique = allAnswers.filter(a => a.answers[cat.key]?.trim() === val).length === 1;
                                return (
                                    <div key={p.playerId} className="flex items-center gap-2 px-3 py-1.5">
                                        <span className="text-[10px] font-bold text-gray-400 w-14 flex-shrink-0 truncate">{p.playerName}</span>
                                        {val ? (
                                            <>
                                                <span className={`text-xs font-bold flex-1 ${valid ? 'text-gray-800' : 'text-red-400 line-through'}`}>{val}</span>
                                                {valid && (
                                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${unique ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                        {unique ? '+10' : '+5'}
                                                    </span>
                                                )}
                                                {!valid && val && <XCircle className="w-3.5 h-3.5 text-red-400"/>}
                                            </>
                                        ) : (
                                            <span className="text-xs text-gray-300 flex-1 italic">لا يوجد</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <button onClick={onExit}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3.5 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all">
                العودة للصالة
            </button>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
    match: any;
    employee: Employee;
    onExit: () => void;
    grantPoints: (pts: number) => Promise<void>;
}

export default function StopTheBusGame({ match, employee, onExit, grantPoints }: Props) {
    const play = useSound();
    const myId = employee.employee_id;
    const myName = employee.name || 'أنت';

    // Game state from match
    const gs = match.game_state ?? {};
    const letter: string     = gs.letter ?? '';
    const startedAt: number  = gs.startedAt ?? 0;
    const status: string     = match.status ?? 'waiting';
    const allAnswers: PlayerAnswers[] = gs.allAnswers ?? [];

    // Local state
    const [answers, setAnswers] = useState<Answers>(() =>
        Object.fromEntries(CATEGORIES.map(c => [c.key, '']))
    );
    const [timeLeft, setTimeLeft]   = useState(TIMER_SECS);
    const [finished, setFinished]   = useState(false);  // I pressed "خلصت"
    const [submitting, setSubmitting] = useState(false);
    const prevTickRef = useRef(TIMER_SECS);
    const soundedEnd  = useRef(false);

    // My saved answers from allAnswers (in case of re-render)
    const myRecord = allAnswers.find(p => p.playerId === myId);
    const iFinished = !!myRecord?.finishedAt || finished;

    // ── Timer sync ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'playing' || !startedAt) return;
        const tick = () => {
            const elapsed = Math.floor((Date.now() - startedAt) / 1000);
            const left = Math.max(0, TIMER_SECS - elapsed);
            setTimeLeft(left);

            // Tick sound at 30, 20, 10, 5, 4, 3, 2, 1
            if ([30,20,10,5,4,3,2,1].includes(left) && left !== prevTickRef.current) {
                prevTickRef.current = left;
                play('tick');
            }

            if (left === 0 && !soundedEnd.current) {
                soundedEnd.current = true;
                play('timeout');
            }
        };
        tick();
        const t = setInterval(tick, 500);
        return () => clearInterval(t);
    }, [status, startedAt]);

    // ── Auto-submit when time runs out ────────────────────────────────────────
    useEffect(() => {
        if (timeLeft === 0 && status === 'playing' && !iFinished) {
            handleFinish(true);
        }
    }, [timeLeft]);

    // ── Check if all players finished → move to results ───────────────────────
    useEffect(() => {
        if (status !== 'playing') return;
        const players: any[] = match.players ?? [];
        if (players.length === 0) return;
        const allDone = players.every(p => allAnswers.find(a => a.playerId === p.id));
        if (allDone) {
            // Host (first player alphabetically) triggers transition
            const hostId = [...players].sort((a,b) => a.id.localeCompare(b.id))[0]?.id;
            if (myId === hostId) {
                supabase.from('live_matches').update({ status: 'finished' }).eq('id', match.id);
            }
        }
    }, [allAnswers, status]);

    // ── Win sound ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (status === 'finished' && allAnswers.length > 0) {
            const scores = scoreAnswers(allAnswers, letter);
            const maxScore = Math.max(...Object.values(scores));
            if (scores[myId] === maxScore) play('win');
        }
    }, [status]);

    const handleChange = (key: string, val: string) => {
        if (iFinished) return;
        setAnswers(prev => ({ ...prev, [key]: val }));
    };

    const handleFinish = async (byTimeout = false) => {
        if (submitting || iFinished) return;
        setSubmitting(true);
        if (!byTimeout) play('finish');
        setFinished(true);

        const newRecord: PlayerAnswers = {
            playerId: myId,
            playerName: myName,
            answers,
            finishedAt: byTimeout ? null : Date.now(),
        };

        const updated = [
            ...allAnswers.filter(a => a.playerId !== myId),
            newRecord,
        ];

        await supabase.from('live_matches').update({
            game_state: { ...gs, allAnswers: updated },
        }).eq('id', match.id);

        setSubmitting(false);
    };

    // ── Is host (starts the game) ─────────────────────────────────────────────
    const players: any[] = match.players ?? [];
    const isHost = players.length > 0 &&
        [...players].sort((a,b) => a.id.localeCompare(b.id))[0]?.id === myId;

    const handleStart = async () => {
        const chosenLetter = pickLetter();
        await supabase.from('live_matches').update({
            status: 'playing',
            game_state: {
                letter: chosenLetter,
                startedAt: Date.now(),
                allAnswers: [],
            },
        }).eq('id', match.id);
    };

    // ── Scores & winner ───────────────────────────────────────────────────────
    const scores      = status === 'finished' ? scoreAnswers(allAnswers, letter) : {};
    const maxScore    = status === 'finished' ? Math.max(0, ...Object.values(scores)) : 0;
    const winnerId    = status === 'finished'
        ? (Object.entries(scores).sort((a,b) => b[1]-a[1])[0]?.[0] ?? '')
        : '';
    const amIWinner   = winnerId === myId;
    const winnerName  = allAnswers.find(a => a.playerId === winnerId)?.playerName ?? '';

    // ── WAITING ───────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className="text-center py-8 px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-700 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
                <span className="text-4xl">🚌</span>
            </div>
            <h3 className="text-xl font-black text-gray-800 mb-1">أتوبيس كومبليت!</h3>
            <p className="text-sm font-bold text-gray-400 mb-6">
                {players.length} لاعب/{players.length > 1 ? 'ين' : ''} في الغرفة
            </p>

            {/* Players list */}
            <div className="flex flex-wrap gap-2 justify-center mb-6">
                {players.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-full">
                        <Users className="w-3 h-3 text-purple-500"/>
                        <span className="text-xs font-bold text-purple-700">{p.name}</span>
                        {p.id === myId && <span className="text-[10px] text-purple-400">(أنت)</span>}
                    </div>
                ))}
            </div>

            {isHost ? (
                <button onClick={handleStart}
                    className="bg-gradient-to-r from-violet-500 to-purple-700 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all">
                    🎲 ابدأ اللعبة
                </button>
            ) : (
                <div className="flex items-center gap-2 justify-center text-sm font-bold text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin"/>
                    في انتظار المضيف ليبدأ...
                </div>
            )}
        </div>
    );

    // ── PLAYING ───────────────────────────────────────────────────────────────
    if (status === 'playing') return (
        <div className="flex flex-col gap-2 py-2 px-3" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {/* Letter badge */}
                    <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <span className="text-3xl font-black text-white">{letter}</span>
                    </div>
                    <div>
                        <p className="text-xs font-black text-gray-800">حرف الجولة</p>
                        <p className="text-[11px] font-bold text-gray-400">
                            {iFinished ? '✅ أنهيت!' : `${countFilled(answers)}/${CATEGORIES.length} مكتمل`}
                        </p>
                    </div>
                </div>
                <TimerRing seconds={timeLeft} total={TIMER_SECS}/>
            </div>

            {/* Who finished */}
            {allAnswers.filter(a => a.finishedAt).length > 0 && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 px-3 py-1.5 rounded-xl">
                    <Flag className="w-3.5 h-3.5 text-green-600 flex-shrink-0"/>
                    <p className="text-xs font-bold text-green-700">
                        {allAnswers.filter(a=>a.finishedAt).map(a=>a.playerName).join('، ')} انتهى
                    </p>
                </div>
            )}

            {/* Form */}
            {iFinished ? (
                <div className="text-center py-6">
                    <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <CheckCircle className="w-9 h-9 text-green-500"/>
                    </div>
                    <p className="font-black text-gray-700 text-sm">إجاباتك اتحفظت!</p>
                    <p className="text-xs text-gray-400 mt-1 font-bold">في انتظار باقي اللاعبين...</p>
                    <div className="flex items-center justify-center gap-1.5 mt-3">
                        {players.map((p: any) => {
                            const done = !!allAnswers.find(a => a.playerId === p.id);
                            return (
                                <div key={p.id} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${done ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                                    {done ? '✓' : '⏳'} {p.name}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <>
                    <AnswerForm letter={letter} answers={answers} onChange={handleChange} disabled={iFinished}/>

                    <button
                        onClick={() => handleFinish(false)}
                        disabled={submitting}
                        className="w-full bg-gradient-to-r from-violet-500 to-purple-700 text-white py-3.5 rounded-2xl font-black text-base shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <><Flag className="w-5 h-5"/>خلصت! 🎉</>}
                    </button>
                </>
            )}
        </div>
    );

    // ── FINISHED / RESULTS ────────────────────────────────────────────────────
    if (status === 'finished') return (
        <ResultsView
            allAnswers={allAnswers}
            letter={letter}
            myId={myId}
            onExit={onExit}
            grantPoints={grantPoints}
            amIWinner={amIWinner}
            winnerName={winnerName}
            scores={scores}
        />
    );

    return null;
}
