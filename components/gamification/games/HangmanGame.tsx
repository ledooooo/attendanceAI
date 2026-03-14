import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Trophy, Users, Heart, Skull, Clock, Crown } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_WRONG   = 6;   // فرص خطأ لكل لاعب
const ROUND_SECS  = 120; // 2 دقيقة للجولة كلها

// ─── قاموس الكلمات الطبية وغير الطبية ────────────────────────────────────────
const WORD_BANK = [
    // أمراض
    { word: 'السكري',         hint: '🩺 مرض', category: 'مرض' },
    { word: 'الربو',           hint: '🫁 مرض تنفسي', category: 'مرض' },
    { word: 'الكوليرا',        hint: '🦠 مرض معدي', category: 'مرض' },
    { word: 'الملاريا',        hint: '🦟 مرض طفيلي', category: 'مرض' },
    { word: 'الزهايمر',        hint: '🧠 مرض عصبي', category: 'مرض' },
    { word: 'الصداع',          hint: '🤕 أعراض', category: 'أعراض' },
    { word: 'الحمى',           hint: '🌡️ أعراض', category: 'أعراض' },
    { word: 'الإسهال',         hint: '🤒 أعراض هضمية', category: 'أعراض' },
    { word: 'الغثيان',         hint: '🤢 أعراض', category: 'أعراض' },
    { word: 'الدوخة',          hint: '😵 أعراض عصبية', category: 'أعراض' },
    // أعضاء
    { word: 'الكبد',           hint: '🫀 عضو', category: 'تشريح' },
    { word: 'الكلية',          hint: '🫘 عضو', category: 'تشريح' },
    { word: 'الطحال',          hint: '🫁 عضو', category: 'تشريح' },
    { word: 'البنكرياس',       hint: '🫀 غدة', category: 'تشريح' },
    { word: 'المريء',          hint: '🫁 أنبوب هضمي', category: 'تشريح' },
    { word: 'القصبة',          hint: '🫁 مجرى هوائي', category: 'تشريح' },
    { word: 'الحجاب',          hint: '💪 عضلة تنفس', category: 'تشريح' },
    // أدوية وعلاج
    { word: 'المضاد',          hint: '💊 علاج بكتيري', category: 'دواء' },
    { word: 'الأسبرين',        hint: '💊 مسكن', category: 'دواء' },
    { word: 'الأنسولين',       hint: '💉 هرمون', category: 'دواء' },
    { word: 'المورفين',        hint: '💊 مسكن قوي', category: 'دواء' },
    { word: 'الكورتيزون',      hint: '💊 مضاد التهاب', category: 'دواء' },
    // تخصصات
    { word: 'الجراحة',         hint: '🔪 تخصص طبي', category: 'تخصص' },
    { word: 'الأشعة',          hint: '📡 تخصص تصوير', category: 'تخصص' },
    { word: 'التمريض',         hint: '👩‍⚕️ مهنة', category: 'تخصص' },
    { word: 'الصيدلة',         hint: '💊 مهنة', category: 'تخصص' },
    { word: 'الطوارئ',         hint: '🚨 قسم', category: 'تخصص' },
    // عام
    { word: 'المستشفى',        hint: '🏥 مبنى', category: 'عام' },
    { word: 'العيادة',         hint: '🏥 مكان', category: 'عام' },
    { word: 'التشخيص',         hint: '🔍 عملية طبية', category: 'عام' },
    { word: 'العلاج',           hint: '💉 عملية', category: 'عام' },
    { word: 'الفحص',            hint: '🩺 إجراء', category: 'عام' },
    { word: 'التحليل',          hint: '🧪 فحص مخبري', category: 'عام' },
    { word: 'الوصفة',           hint: '📝 ورقة طبية', category: 'عام' },
];

function pickWord() {
    return WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
}

// ─── Arabic letters keyboard ──────────────────────────────────────────────────
const AR_LETTERS = [
    'ا','ب','ت','ث','ج','ح','خ','د','ذ','ر',
    'ز','س','ش','ص','ض','ط','ظ','ع','غ','ف',
    'ق','ك','ل','م','ن','ه','و','ي','ة','ى',
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlayerState {
    id:          string;
    name:        string;
    guessed:     string[];   // الحروف اللي خمّنها
    wrong:       number;     // عدد الأخطاء
    solved:      boolean;    // حلّ الكلمة؟
    solvedAt:    number | null; // timestamp
    eliminated:  boolean;    // استنفد الـ 6 فرص
}

interface HangmanGS {
    word:        string;
    hint:        string;
    category:    string;
    players:     PlayerState[];
    startedAt:   number;
    status:      'waiting' | 'playing' | 'finished';
    winnerId:    string | null;
}

// ─── Sound ────────────────────────────────────────────────────────────────────
function useSound() {
    const ctx = useRef<AudioContext | null>(null);
    const get = () => {
        if (!ctx.current) ctx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return ctx.current;
    };
    return useCallback((type: 'correct' | 'wrong' | 'win' | 'lose' | 'tick') => {
        try {
            const ac = get(), now = ac.currentTime;
            if (type === 'correct') {
                [523, 659].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'sine'; o.frequency.value = f;
                    const t = now + i * 0.1;
                    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                    o.start(t); o.stop(t + 0.15);
                });
            }
            if (type === 'wrong') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sawtooth'; o.frequency.value = 180;
                g.gain.setValueAtTime(0.2, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                o.start(now); o.stop(now + 0.18);
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
            if (type === 'lose') {
                [330, 220].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'sine'; o.frequency.value = f;
                    const t = now + i * 0.22;
                    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                    o.start(t); o.stop(t + 0.25);
                });
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

// ─── Hangman SVG Drawing ──────────────────────────────────────────────────────
function HangmanSVG({ wrong, total = MAX_WRONG }: { wrong: number; total?: number }) {
    const pct = wrong / total;
    const color = pct >= 1 ? '#ef4444' : pct >= 0.5 ? '#f97316' : '#6366f1';
    return (
        <svg viewBox="0 0 100 110" className="w-full h-full" strokeLinecap="round" strokeLinejoin="round">
            {/* Gallows */}
            <line x1="10" y1="105" x2="90" y2="105" stroke="#94a3b8" strokeWidth="3"/>
            <line x1="25" y1="105" x2="25" y2="10"  stroke="#94a3b8" strokeWidth="3"/>
            <line x1="25" y1="10"  x2="60" y2="10"  stroke="#94a3b8" strokeWidth="3"/>
            <line x1="60" y1="10"  x2="60" y2="22"  stroke="#94a3b8" strokeWidth="3"/>
            {/* Head */}
            {wrong >= 1 && <circle cx="60" cy="30" r="8" stroke={color} strokeWidth="2.5" fill="none"/>}
            {/* Body */}
            {wrong >= 2 && <line x1="60" y1="38" x2="60" y2="65" stroke={color} strokeWidth="2.5"/>}
            {/* Left arm */}
            {wrong >= 3 && <line x1="60" y1="45" x2="45" y2="57" stroke={color} strokeWidth="2.5"/>}
            {/* Right arm */}
            {wrong >= 4 && <line x1="60" y1="45" x2="75" y2="57" stroke={color} strokeWidth="2.5"/>}
            {/* Left leg */}
            {wrong >= 5 && <line x1="60" y1="65" x2="45" y2="80" stroke={color} strokeWidth="2.5"/>}
            {/* Right leg */}
            {wrong >= 6 && <line x1="60" y1="65" x2="75" y2="80" stroke={color} strokeWidth="2.5"/>}
            {/* Face when dead */}
            {wrong >= MAX_WRONG && (
                <>
                    <line x1="56" y1="27" x2="58" y2="29" stroke={color} strokeWidth="1.5"/>
                    <line x1="58" y1="27" x2="56" y2="29" stroke={color} strokeWidth="1.5"/>
                    <line x1="62" y1="27" x2="64" y2="29" stroke={color} strokeWidth="1.5"/>
                    <line x1="64" y1="27" x2="62" y2="29" stroke={color} strokeWidth="1.5"/>
                    <path d="M56 34 Q60 31 64 34" stroke={color} strokeWidth="1.5" fill="none"/>
                </>
            )}
            {/* Smile when alive */}
            {wrong > 0 && wrong < MAX_WRONG && (
                <path d="M56 33 Q60 36 64 33" stroke={color} strokeWidth="1.5" fill="none"/>
            )}
        </svg>
    );
}

// ─── Word Display ─────────────────────────────────────────────────────────────
function WordDisplay({ word, guessed, solved, eliminated }: {
    word: string; guessed: string[]; solved: boolean; eliminated: boolean;
}) {
    // Normalize: remove 'ال' prefix display helper — still match the actual chars
    const chars = word.split('').filter(c => c.trim());
    return (
        <div className="flex gap-1.5 flex-wrap justify-center" dir="rtl">
            {chars.map((ch, i) => {
                const isSpace = ch === ' ';
                if (isSpace) return <div key={i} className="w-3"/>;
                const revealed = solved || eliminated || guessed.includes(ch);
                return (
                    <div key={i} className={`flex flex-col items-center gap-0.5`}>
                        <span className={`text-xl font-black min-w-[1.6rem] text-center transition-all duration-300 ${
                            revealed
                                ? solved ? 'text-green-600' : eliminated ? 'text-red-500' : 'text-gray-800'
                                : 'text-transparent'
                        }`}>
                            {revealed ? ch : 'أ'}
                        </span>
                        <div className={`h-0.5 w-6 rounded-full transition-all ${
                            revealed
                                ? solved ? 'bg-green-400' : eliminated ? 'bg-red-300' : 'bg-indigo-400'
                                : 'bg-gray-300'
                        }`}/>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Lives display ────────────────────────────────────────────────────────────
function LivesBar({ wrong, max = MAX_WRONG }: { wrong: number; max?: number }) {
    return (
        <div className="flex gap-1 justify-center">
            {Array.from({ length: max }).map((_, i) => (
                <Heart key={i} className={`w-5 h-5 transition-all ${
                    i < max - wrong
                        ? 'text-red-500 fill-red-500'
                        : 'text-gray-200 fill-gray-200'
                }`}/>
            ))}
        </div>
    );
}

// ─── Scoreboard row ───────────────────────────────────────────────────────────
function PlayerRow({ ps, isMe, rank }: { ps: PlayerState; isMe: boolean; rank: number }) {
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
            isMe ? 'border-indigo-300 bg-indigo-50' :
            ps.solved ? 'border-green-200 bg-green-50' :
            ps.eliminated ? 'border-red-100 bg-red-50/50 opacity-60' :
            'border-gray-100 bg-white'
        }`}>
            <span className="text-base w-6 text-center flex-shrink-0">{medal ?? `#${rank}`}</span>
            <p className={`text-xs font-black flex-1 truncate ${isMe ? 'text-indigo-700' : 'text-gray-700'}`}>
                {ps.name}{isMe && ' (أنت)'}
            </p>
            {ps.solved && <span className="text-[10px] font-black text-green-600 bg-green-100 px-2 py-0.5 rounded-full">✓ حلّها!</span>}
            {ps.eliminated && !ps.solved && <span className="text-[10px] font-black text-red-500 bg-red-100 px-2 py-0.5 rounded-full">💀 خرج</span>}
            {!ps.solved && !ps.eliminated && (
                <div className="flex gap-0.5">
                    {Array.from({ length: MAX_WRONG }).map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full ${i < MAX_WRONG - ps.wrong ? 'bg-red-400' : 'bg-gray-200'}`}/>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
    match:       any;
    employee:    Employee;
    onExit:      () => void;
    grantPoints: (pts: number) => Promise<void>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HangmanGame({ match, employee, onExit, grantPoints }: Props) {
    const play  = useSound();
    const myId  = employee.employee_id;
    const myName = employee.name?.split(' ')[0] || 'أنت';

    const gs: HangmanGS        = match.game_state ?? {};
    const word: string         = gs.word ?? '';
    const players: PlayerState[] = gs.players ?? [];
    const status: string       = match.status ?? 'waiting';
    const isHost = match.players?.[0]?.id === myId;

    const myPS = players.find(p => p.id === myId);
    const myGuessed   = myPS?.guessed   ?? [];
    const myWrong     = myPS?.wrong     ?? 0;
    const mySolved    = myPS?.solved    ?? false;
    const myEliminated = myPS?.eliminated ?? false;

    // ── Timer ─────────────────────────────────────────────────────────────────
    const [timeLeft, setTimeLeft] = useState(ROUND_SECS);
    const prevTickRef = useRef(ROUND_SECS);
    const resultDoneRef = useRef(false);

    useEffect(() => {
        if (status !== 'playing' || !gs.startedAt) return;
        const tick = () => {
            const left = Math.max(0, ROUND_SECS - Math.floor((Date.now() - gs.startedAt) / 1000));
            setTimeLeft(left);
            if ([30, 20, 10, 5, 4, 3, 2, 1].includes(left) && left !== prevTickRef.current) {
                prevTickRef.current = left;
                play('tick');
            }
            // Time's up → finish game
            if (left === 0 && isHost && status === 'playing') {
                finishGame(null);
            }
        };
        tick();
        const iv = setInterval(tick, 500);
        return () => clearInterval(iv);
    }, [status, gs.startedAt]);

    // ── Grant points on finish ────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'finished' || resultDoneRef.current) return;
        resultDoneRef.current = true;
        const winner = gs.winnerId;
        if (winner === myId) { play('win'); grantPoints(15); }
        else if (mySolved) { play('win'); grantPoints(5); }
        else { play('lose'); }
    }, [status]);

    // ── Guess a letter ────────────────────────────────────────────────────────
    const handleGuess = async (letter: string) => {
        if (mySolved || myEliminated || status !== 'playing') return;
        if (myGuessed.includes(letter)) return;

        const newGuessed = [...myGuessed, letter];
        const isCorrect  = word.includes(letter);
        const newWrong   = isCorrect ? myWrong : myWrong + 1;
        play(isCorrect ? 'correct' : 'wrong');

        // Check solved: every non-space char in word is guessed
        const wordChars = word.split('').filter(c => c !== ' ');
        const solved = wordChars.every(c => newGuessed.includes(c));
        const eliminated = newWrong >= MAX_WRONG;

        const updatedPlayers = players.map(p =>
            p.id === myId
                ? { ...p, guessed: newGuessed, wrong: newWrong, solved, eliminated, solvedAt: solved ? Date.now() : p.solvedAt }
                : p
        );

        // Check if game should end: first solver wins, or all eliminated/solved
        const firstSolver = updatedPlayers.find(p => p.solved && !gs.winnerId);
        const allDone = updatedPlayers.every(p => p.solved || p.eliminated);

        let newStatus = status;
        let winnerId = gs.winnerId;

        if (solved && !gs.winnerId) {
            winnerId = myId;
            newStatus = 'finished';
        } else if (allDone) {
            // If nobody solved → pick the one with least wrong guesses
            if (!winnerId) {
                const solvers = updatedPlayers.filter(p => p.solved);
                if (solvers.length > 0) {
                    winnerId = solvers.sort((a, b) => (a.solvedAt ?? 0) - (b.solvedAt ?? 0))[0].id;
                }
            }
            newStatus = 'finished';
        }

        await supabase.from('live_matches').update({
            game_state: { ...gs, players: updatedPlayers, winnerId },
            status: newStatus,
            winner_id: winnerId,
        }).eq('id', match.id);
    };

    const finishGame = async (forceWinnerId: string | null) => {
        if (status === 'finished') return;
        // Pick winner as first solver, else least wrong
        const solvers = players.filter(p => p.solved).sort((a, b) => (a.solvedAt ?? 0) - (b.solvedAt ?? 0));
        const winner = forceWinnerId ?? (solvers[0]?.id ?? null);
        await supabase.from('live_matches').update({
            status: 'finished',
            winner_id: winner,
            game_state: { ...gs, winnerId: winner },
        }).eq('id', match.id);
    };

    // ── Host starts game ──────────────────────────────────────────────────────
    const handleStart = async () => {
        const picked = pickWord();
        const matchPlayers: PlayerState[] = match.players.map((p: any) => ({
            id: p.id, name: p.name,
            guessed: [], wrong: 0, solved: false, eliminated: false, solvedAt: null,
        }));
        await supabase.from('live_matches').update({
            status: 'playing',
            game_state: {
                word:      picked.word,
                hint:      picked.hint,
                category:  picked.category,
                players:   matchPlayers,
                startedAt: Date.now(),
                status:    'playing',
                winnerId:  null,
            },
        }).eq('id', match.id);
    };

    // ── Sorted leaderboard ────────────────────────────────────────────────────
    const sortedPlayers = [...players].sort((a, b) => {
        if (a.solved && !b.solved) return -1;
        if (!a.solved && b.solved) return 1;
        if (a.solved && b.solved) return (a.solvedAt ?? 0) - (b.solvedAt ?? 0);
        return a.wrong - b.wrong;
    });

    const amIWinner = match.winner_id === myId;
    const timerPct  = timeLeft / ROUND_SECS;
    const timerColor = timerPct < 0.2 ? 'text-red-600' : timerPct < 0.4 ? 'text-orange-500' : 'text-green-700';

    // ── WAITING ───────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className="text-center py-8 px-4" dir="rtl">
            <div className="w-20 h-20 bg-gradient-to-br from-rose-500 to-pink-700 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl text-4xl">🪢</div>
            <h3 className="text-xl font-black text-gray-800 mb-1">المشنقة!</h3>
            <p className="text-sm font-bold text-gray-400 mb-5">{match.players?.length ?? 0} لاعب في الغرفة</p>
            <div className="flex flex-wrap gap-2 justify-center mb-6">
                {match.players?.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-full">
                        <span className="text-xs font-bold text-rose-700">{p.name}</span>
                        {p.id === myId && <span className="text-[10px] text-rose-400">(أنت)</span>}
                    </div>
                ))}
            </div>
            {isHost ? (
                <button onClick={handleStart}
                    className="bg-gradient-to-r from-rose-500 to-pink-700 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all">
                    🎮 ابدأ اللعبة
                </button>
            ) : (
                <div className="flex items-center gap-2 justify-center text-sm font-bold text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin"/> في انتظار المضيف...
                </div>
            )}
            <button onClick={onExit} className="mt-4 text-sm font-bold text-gray-400 hover:text-gray-600 block mx-auto">
                ← العودة
            </button>
        </div>
    );

    // ── PLAYING ───────────────────────────────────────────────────────────────
    if (status === 'playing') return (
        <div className="flex flex-col gap-3 py-2 px-3" dir="rtl">

            {/* Header: hint + timer */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-black bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">{gs.category}</span>
                        <span className="text-[10px] font-bold text-gray-400">{word.length} حرف</span>
                    </div>
                    <p className="text-sm font-black text-gray-700 truncate">{gs.hint}</p>
                </div>
                {/* Timer ring */}
                <div className="relative w-14 h-14 flex-shrink-0">
                    <svg width={56} height={56} viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx={28} cy={28} r={24} fill="none" stroke="#e5e7eb" strokeWidth={4}/>
                        <circle cx={28} cy={28} r={24} fill="none"
                            stroke={timerPct < 0.2 ? '#ef4444' : timerPct < 0.4 ? '#f97316' : '#22c55e'}
                            strokeWidth={4} strokeDasharray={2 * Math.PI * 24}
                            strokeDashoffset={2 * Math.PI * 24 * (1 - timerPct)}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.4s' }}/>
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-xs font-black ${timerColor}`}>
                        {timeLeft < 60 ? timeLeft : `${Math.floor(timeLeft/60)}:${String(timeLeft%60).padStart(2,'0')}`}
                    </span>
                </div>
            </div>

            {/* Main game area: hangman + word */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                <div className="flex items-start gap-3">
                    {/* Hangman drawing */}
                    <div className="w-24 h-24 flex-shrink-0">
                        <HangmanSVG wrong={myWrong}/>
                    </div>
                    {/* Word + lives */}
                    <div className="flex-1 flex flex-col gap-3 pt-1">
                        <WordDisplay word={word} guessed={myGuessed} solved={mySolved} eliminated={myEliminated}/>
                        <LivesBar wrong={myWrong}/>
                        {mySolved && (
                            <div className="text-center text-xs font-black text-green-600 bg-green-50 rounded-xl py-1.5 animate-bounce">
                                🎉 أحسنت! حللتها!
                            </div>
                        )}
                        {myEliminated && (
                            <div className="text-center text-xs font-black text-red-500 bg-red-50 rounded-xl py-1.5">
                                💀 استنفدت فرصك! الكلمة: {word}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Players progress */}
            {players.length > 1 && (
                <div className="space-y-1.5">
                    <p className="text-[11px] font-black text-gray-400 px-1">اللاعبون:</p>
                    {sortedPlayers.map((ps, i) => (
                        <PlayerRow key={ps.id} ps={ps} isMe={ps.id === myId} rank={i + 1}/>
                    ))}
                </div>
            )}

            {/* Keyboard — disabled if solved/eliminated */}
            {!mySolved && !myEliminated && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                    <p className="text-[10px] font-black text-gray-400 mb-2 text-center">اختر حرفاً:</p>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                        {AR_LETTERS.map(letter => {
                            const used = myGuessed.includes(letter);
                            const inWord = word.includes(letter);
                            return (
                                <button key={letter} onClick={() => handleGuess(letter)} disabled={used}
                                    className={`w-9 h-9 rounded-xl font-black text-sm transition-all border-2 active:scale-95 ${
                                        !used
                                            ? 'bg-white border-gray-200 text-gray-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 shadow-sm'
                                            : inWord
                                                ? 'bg-green-100 border-green-300 text-green-700 cursor-not-allowed'
                                                : 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed'
                                    }`}>
                                    {letter}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Waiting for others if solved */}
            {mySolved && (
                <div className="text-center bg-green-50 border-2 border-green-200 rounded-2xl py-4 px-3">
                    <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-1"/>
                    <p className="text-sm font-black text-green-800">حللتها! في انتظار باقي اللاعبين...</p>
                </div>
            )}

            <button onClick={onExit} className="text-xs font-bold text-gray-400 hover:text-gray-600 py-1 text-center">
                ← العودة
            </button>
        </div>
    );

    // ── FINISHED ──────────────────────────────────────────────────────────────
    if (status === 'finished') return (
        <div className="flex flex-col gap-3 py-2 px-3 animate-in fade-in duration-400" dir="rtl">

            {/* Result banner */}
            <div className={`rounded-2xl p-5 text-center text-white shadow-xl ${
                amIWinner
                    ? 'bg-gradient-to-br from-yellow-400 to-amber-500'
                    : mySolved
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                        : 'bg-gradient-to-br from-gray-500 to-gray-700'
            }`}>
                {amIWinner ? (
                    <><Trophy className="w-14 h-14 mx-auto mb-2 drop-shadow-xl animate-bounce"/><h3 className="text-2xl font-black">🎉 أنت الأسرع!</h3><p className="text-amber-100 text-sm mt-1">+15 نقطة 🏆</p></>
                ) : mySolved ? (
                    <><div className="text-5xl mb-2">🌟</div><h3 className="text-2xl font-black">أحسنت!</h3><p className="text-green-100 text-sm mt-1">+5 نقاط</p></>
                ) : (
                    <><Skull className="w-14 h-14 mx-auto mb-2 opacity-70"/><h3 className="text-2xl font-black">لم تكملها</h3><p className="text-gray-300 text-sm mt-1">الكلمة كانت: <span className="text-white font-black">{word}</span></p></>
                )}
            </div>

            {/* The word revealed */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-xs font-black text-gray-400 mb-2">الكلمة الصحيحة</p>
                <p className="text-2xl font-black text-gray-800 tracking-widest">{word}</p>
                <p className="text-xs text-gray-400 mt-1">{gs.hint}</p>
            </div>

            {/* Final rankings */}
            <div className="space-y-1.5">
                <p className="text-xs font-black text-gray-500 px-1">الترتيب النهائي:</p>
                {sortedPlayers.map((ps, i) => (
                    <PlayerRow key={ps.id} ps={ps} isMe={ps.id === myId} rank={i + 1}/>
                ))}
            </div>

            <button onClick={onExit}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-700 text-white py-3.5 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">
                <Users className="w-5 h-5"/> العودة إلى الصالة
            </button>
        </div>
    );

    return null;
}
