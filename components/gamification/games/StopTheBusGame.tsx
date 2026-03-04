import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, CheckCircle, XCircle, Flag, Users, Trophy, Medal } from 'lucide-react';
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

type Answers     = Record<string, string>;
type PlayerAnswers = {
    playerId:   string;
    playerName: string;
    answers:    Answers;
    finishedAt: number | null;  // timestamp of "خلصت" press, null = timeout
};

// ─── Audio ────────────────────────────────────────────────────────────────────
function useSound() {
    const ctx = useRef<AudioContext | null>(null);
    const get = () => {
        if (!ctx.current)
            ctx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return ctx.current;
    };
    return useCallback((type: 'tick' | 'stop' | 'win' | 'lose' | 'timeout') => {
        try {
            const ac = get(), now = ac.currentTime;
            if (type === 'tick') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.value = 880;
                g.gain.setValueAtTime(0.14, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
                o.start(now); o.stop(now + 0.07);
            }
            if (type === 'stop') {
                // "Stop the bus!" trumpet blast
                [659, 784, 1047].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'square'; o.frequency.value = f;
                    const t = now + i * 0.09;
                    g.gain.setValueAtTime(0.22, t);
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
                    o.start(t); o.stop(t + 0.28);
                });
            }
            if (type === 'win') {
                [523, 659, 784, 1047].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'triangle'; o.frequency.value = f;
                    const t = now + i * 0.13;
                    g.gain.setValueAtTime(0.28, t);
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
                    o.start(t); o.stop(t + 0.32);
                });
            }
            if (type === 'lose') {
                [330, 220].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'sine'; o.frequency.value = f;
                    const t = now + i * 0.2;
                    g.gain.setValueAtTime(0.22, t);
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
                    o.start(t); o.stop(t + 0.28);
                });
            }
            if (type === 'timeout') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sawtooth'; o.frequency.value = 200;
                g.gain.setValueAtTime(0.25, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
                o.start(now); o.stop(now + 0.45);
            }
        } catch (_) {}
    }, []);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pickLetter() {
    return ARABIC_LETTERS[Math.floor(Math.random() * ARABIC_LETTERS.length)];
}

function countFilled(answers: Answers, letter: string) {
    return Object.values(answers).filter(v => v.trim().startsWith(letter) && v.trim().length > 1).length;
}

// ─── Timer ring ───────────────────────────────────────────────────────────────
function TimerRing({ seconds, total }: { seconds: number; total: number }) {
    const r = 26, circ = 2 * Math.PI * r;
    const offset = circ * (1 - seconds / total);
    const color = seconds <= 20 ? '#ef4444' : seconds <= 45 ? '#f97316' : '#22c55e';
    return (
        <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
            <svg width={56} height={56} viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={28} cy={28} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4.5}/>
                <circle cx={28} cy={28} r={r} fill="none" stroke={color} strokeWidth={4.5}
                    strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
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
    const filled = countFilled(answers, letter);
    return (
        <div className="space-y-1.5">
            {CATEGORIES.map(cat => {
                const val    = answers[cat.key] ?? '';
                const valid  = val.trim().startsWith(letter) && val.trim().length > 1;
                const hasVal = val.trim().length > 0;
                return (
                    <div key={cat.key}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
                            valid   ? 'border-green-400 bg-green-50' :
                            hasVal  ? 'border-orange-300 bg-orange-50' :
                                      'border-gray-200 bg-white'
                        }`}>
                        <span className="text-base flex-shrink-0">{cat.emoji}</span>
                        <span className="text-[11px] font-black text-gray-500 w-14 flex-shrink-0">{cat.label}</span>
                        <input
                            type="text"
                            value={val}
                            onChange={e => onChange(cat.key, e.target.value)}
                            disabled={disabled}
                            placeholder={`يبدأ بـ "${letter}"`}
                            dir="rtl"
                            className="flex-1 text-sm font-bold bg-transparent outline-none text-gray-800 placeholder:text-gray-300 disabled:opacity-50 min-w-0"
                        />
                        {valid  && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0"/>}
                        {!valid && hasVal && <XCircle className="w-4 h-4 text-orange-400 flex-shrink-0"/>}
                    </div>
                );
            })}
            {/* Progress dots */}
            <div className="flex items-center justify-between px-1 pt-0.5">
                <span className="text-[11px] font-bold text-gray-400">{filled}/{CATEGORIES.length} صحيح</span>
                <div className="flex gap-1">
                    {CATEGORIES.map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i < filled ? 'bg-green-400' : 'bg-gray-200'}`}/>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Results + Voting View ────────────────────────────────────────────────────
function ResultsView({ allAnswers, letter, myId, onExit, onVote, myVote, grantingPoints }: {
    allAnswers:     PlayerAnswers[];
    letter:         string;
    myId:           string;
    onExit:         () => void;
    onVote:         (won: boolean) => void;
    myVote:         boolean | null;   // null = not voted yet
    grantingPoints: boolean;
}) {
    const stopper = allAnswers.find(p => p.finishedAt !== null);   // who pressed "خلصت"

    return (
        <div className="space-y-3 py-2 px-3 animate-in fade-in duration-400" dir="rtl">

            {/* Header */}
            <div className="bg-gradient-to-br from-violet-500 to-purple-700 text-white rounded-2xl p-4 text-center">
                <div className="text-3xl mb-1">🚌</div>
                <h3 className="font-black text-lg">انتهت الجولة!</h3>
                <p className="text-purple-100 text-xs font-bold mt-0.5">
                    حرف الجولة: <span className="text-2xl font-black text-white mx-1">{letter}</span>
                </p>
                {stopper && (
                    <div className="mt-2 bg-white/20 rounded-xl px-3 py-1.5 inline-block">
                        <p className="text-xs font-black">
                            🏁 {stopper.playerName} أنهى أولاً!
                        </p>
                    </div>
                )}
            </div>

            {/* Answers comparison — per category */}
            <div className="space-y-2">
                <p className="text-xs font-black text-gray-500 px-1">إجابات اللاعبين:</p>
                {CATEGORIES.map(cat => (
                    <div key={cat.key} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                        <div className="bg-gray-50 px-3 py-1.5 flex items-center gap-1.5 border-b border-gray-100">
                            <span className="text-base">{cat.emoji}</span>
                            <span className="text-xs font-black text-gray-600">{cat.label}</span>
                        </div>
                        {allAnswers.map(p => {
                            const val   = p.answers[cat.key]?.trim() ?? '';
                            const valid = val.startsWith(letter) && val.length > 1;
                            const isMe  = p.playerId === myId;
                            return (
                                <div key={p.playerId}
                                    className={`flex items-center gap-2 px-3 py-2 border-b border-gray-50 last:border-0 ${isMe ? 'bg-blue-50/50' : ''}`}>
                                    <span className={`text-[10px] font-black w-16 flex-shrink-0 truncate ${isMe ? 'text-blue-600' : 'text-gray-400'}`}>
                                        {isMe ? 'أنت' : p.playerName}
                                    </span>
                                    {val ? (
                                        <>
                                            <span className={`text-sm font-bold flex-1 ${valid ? 'text-gray-800' : 'text-red-400 line-through'}`}>
                                                {val}
                                            </span>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${
                                                valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
                                            }`}>
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

            {/* Voting section */}
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4">
                <p className="text-sm font-black text-amber-900 text-center mb-3">
                    بعد مراجعة الإجابات... ما رأيك؟
                </p>

                {myVote === null ? (
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => onVote(true)}
                            disabled={grantingPoints}
                            className="flex flex-col items-center gap-2 bg-gradient-to-b from-emerald-400 to-green-600 text-white py-4 rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                            <Trophy className="w-8 h-8"/>
                            <span className="text-sm">أنا فزت! 🏆</span>
                            <span className="text-[11px] font-bold opacity-80">+15 نقطة</span>
                        </button>
                        <button
                            onClick={() => onVote(false)}
                            disabled={grantingPoints}
                            className="flex flex-col items-center gap-2 bg-gradient-to-b from-gray-400 to-gray-600 text-white py-4 rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                            <Medal className="w-8 h-8"/>
                            <span className="text-sm">أنا خسرت 😔</span>
                            <span className="text-[11px] font-bold opacity-80">+3 نقاط للمشاركة</span>
                        </button>
                    </div>
                ) : (
                    <div className={`text-center py-3 rounded-xl font-black text-sm ${myVote ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                        {grantingPoints
                            ? <><Loader2 className="inline w-4 h-4 animate-spin ml-1"/>جاري إضافة النقاط...</>
                            : myVote
                                ? '🏆 سجّلت نفسك فائزاً! تمت إضافة 15 نقطة'
                                : '👍 شكراً على شرفك! تمت إضافة 3 نقاط للمشاركة'
                        }
                    </div>
                )}
            </div>

            {/* Back button */}
            <button onClick={onExit}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-700 text-white py-3.5 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">
                <Users className="w-5 h-5"/>
                العودة إلى الصالة
            </button>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
    match:        any;
    employee:     Employee;
    onExit:       () => void;
    grantPoints:  (pts: number) => Promise<void>;
}

export default function StopTheBusGame({ match, employee, onExit, grantPoints }: Props) {
    const play   = useSound();
    const myId   = employee.employee_id;
    const myName = employee.name?.split(' ')[0] || 'أنت';

    // Derived from match
    const gs:           any            = match.game_state ?? {};
    const letter:       string         = gs.letter    ?? '';
    const startedAt:    number         = gs.startedAt ?? 0;
    const allAnswers:   PlayerAnswers[] = gs.allAnswers ?? [];
    const status:       string         = match.status  ?? 'waiting';
    const players:      any[]          = match.players ?? [];

    // Local state
    const [answers, setAnswers]         = useState<Answers>(() =>
        Object.fromEntries(CATEGORIES.map(c => [c.key, '']))
    );
    const [timeLeft, setTimeLeft]       = useState(TIMER_SECS);
    const [submitted, setSubmitted]     = useState(false);   // I pressed "خلصت"
    const [submitting, setSubmitting]   = useState(false);
    const [myVote, setMyVote]           = useState<boolean | null>(null);
    const [grantingPoints, setGranting] = useState(false);

    const prevTickRef  = useRef(TIMER_SECS);
    const soundedEnd   = useRef(false);
    const soundedStop  = useRef(false);

    // Did someone already press "خلصت"? (game over)
    const stopperRecord = allAnswers.find(p => p.finishedAt !== null);
    const gameOver      = !!stopperRecord || status === 'finished';

    // My saved record
    const myRecord  = allAnswers.find(p => p.playerId === myId);
    const iFinished = submitted || !!myRecord;

    // ── Timer sync ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'playing' || !startedAt) return;
        const tick = () => {
            const elapsed = Math.floor((Date.now() - startedAt) / 1000);
            const left    = Math.max(0, TIMER_SECS - elapsed);
            setTimeLeft(left);
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

    // Sound when someone stops the bus
    useEffect(() => {
        if (stopperRecord && !soundedStop.current) {
            soundedStop.current = true;
            play('stop');
        }
    }, [stopperRecord]);

    // Auto-submit when time runs out (save empty/partial answers)
    useEffect(() => {
        if (timeLeft === 0 && status === 'playing' && !iFinished) {
            submitAnswers(true);
        }
    }, [timeLeft]);

    // ── Submit answers ─────────────────────────────────────────────────────────
    // Pressing "خلصت" ends the game IMMEDIATELY for everyone:
    //   1. Save my answers with finishedAt timestamp
    //   2. Snapshot every OTHER player's current answers (empty if not saved yet)
    //   3. Set status = 'finished' atomically — no waiting
    const submitAnswers = async (byTimeout = false) => {
        if (submitting || iFinished) return;
        setSubmitting(true);
        if (!byTimeout) play('stop');
        setSubmitted(true);

        const myRecord: PlayerAnswers = {
            playerId:   myId,
            playerName: myName,
            answers,
            finishedAt: byTimeout ? null : Date.now(),
        };

        // Players who haven't submitted yet get empty snapshots
        const otherRecords: PlayerAnswers[] = players
            .filter(p => p.id !== myId && !allAnswers.find((a: PlayerAnswers) => a.playerId === p.id))
            .map(p => ({
                playerId:   p.id,
                playerName: p.name,
                answers:    Object.fromEntries(CATEGORIES.map(c => [c.key, ''])),
                finishedAt: null,
            }));

        const finalAnswers: PlayerAnswers[] = [
            ...allAnswers.filter((a: PlayerAnswers) => a.playerId !== myId),
            myRecord,
            ...otherRecords,
        ];

        // Single update: save answers + end game immediately
        await supabase.from('live_matches').update({
            status:     'finished',
            game_state: { ...gs, allAnswers: finalAnswers },
        }).eq('id', match.id);

        setSubmitting(false);
    };


    // ── Vote (win / lose) ─────────────────────────────────────────────────────
    const handleVote = async (won: boolean) => {
        if (myVote !== null || grantingPoints) return;
        setMyVote(won);
        setGranting(true);
        play(won ? 'win' : 'lose');
        await grantPoints(won ? 15 : 3);
        setGranting(false);
    };

    // ── Host start ────────────────────────────────────────────────────────────
    const isHost = players.length > 0 &&
        [...players].sort((a,b) => a.id.localeCompare(b.id))[0]?.id === myId;

    const handleStart = async () => {
        await supabase.from('live_matches').update({
            status:     'playing',
            game_state: { letter: pickLetter(), startedAt: Date.now(), allAnswers: [] },
        }).eq('id', match.id);
    };

    // ─── WAITING ──────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className="text-center py-8 px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-700 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
                <span className="text-4xl">🚌</span>
            </div>
            <h3 className="text-xl font-black text-gray-800 mb-1">أتوبيس كومبليت!</h3>
            <p className="text-sm font-bold text-gray-400 mb-5">
                {players.length} لاعب في الغرفة
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
                    في انتظار المضيف...
                </div>
            )}

            <button onClick={onExit}
                className="mt-4 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors block mx-auto">
                ← العودة إلى الصالة
            </button>
        </div>
    );

    // ─── FINISHED → show results + voting ─────────────────────────────────────
    if (status === 'finished') return (
        <ResultsView
            allAnswers={allAnswers}
            letter={letter}
            myId={myId}
            onExit={onExit}
            onVote={handleVote}
            myVote={myVote}
            grantingPoints={grantingPoints}
        />
    );

    // ─── PLAYING ──────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-2 py-2 px-3" dir="rtl">

            {/* Header bar */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Letter badge */}
                    <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-700 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <span className="text-2xl font-black text-white">{letter}</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-black text-gray-700 leading-tight">حرف الجولة</p>
                        <p className="text-[11px] font-bold text-gray-400 leading-tight truncate">
                            {iFinished
                                ? '✅ إجاباتك محفوظة — في انتظار الآخرين'
                                : `${countFilled(answers, letter)}/${CATEGORIES.length} إجابة صحيحة`}
                        </p>
                    </div>
                </div>
                <TimerRing seconds={timeLeft} total={TIMER_SECS}/>
            </div>

            {/* Who stopped (if someone already did) */}
            {stopperRecord && !iFinished && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl px-3 py-2 flex items-center gap-2">
                    <Flag className="w-4 h-4 text-red-500 flex-shrink-0"/>
                    <p className="text-xs font-black text-red-700">
                        🏁 {stopperRecord.playerName} انتهى أولاً! احفظ إجاباتك بسرعة...
                    </p>
                </div>
            )}

            {/* Waiting after I submitted */}
            {iFinished ? (
                <div className="text-center py-8 bg-white rounded-2xl border-2 border-green-200 shadow-sm">
                    <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <CheckCircle className="w-8 h-8 text-green-500"/>
                    </div>
                    <p className="font-black text-gray-700 text-sm mb-1">إجاباتك محفوظة!</p>
                    <p className="text-xs text-gray-400 font-bold mb-4">في انتظار باقي اللاعبين...</p>
                    {/* Mini player status */}
                    <div className="flex flex-wrap gap-2 justify-center">
                        {players.map((p: any) => {
                            const saved = !!allAnswers.find(a => a.playerId === p.id);
                            return (
                                <div key={p.id}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                        saved ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-100 border-gray-200 text-gray-400'
                                    }`}>
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
                    />

                    {/* "خلصت" button */}
                    <button
                        onClick={() => submitAnswers(false)}
                        disabled={submitting}
                        className="w-full bg-gradient-to-r from-violet-500 to-purple-700 text-white py-4 rounded-2xl font-black text-base shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-1">
                        {submitting
                            ? <Loader2 className="w-5 h-5 animate-spin"/>
                            : <><Flag className="w-5 h-5"/>🛑 خلصت! أوقف الأتوبيس</>}
                    </button>
                </>
            )}

            {/* Back to lobby */}
            <button onClick={onExit}
                className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors py-1 text-center">
                ← العودة إلى الصالة
            </button>
        </div>
    );
}
