import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, CheckCircle, XCircle, Flag, Users, Trophy, Medal, BrainCircuit, Timer, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const TIMER_SECS = 120;
const MAX_VOTE_ROUNDS = 3; // max re-vote attempts on conflict

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
    playerName: string;      // alias (or real if no alias)
    realName?:  string;      // real name — revealed after game
    answers:    Answers;
    stopped:    boolean;
    vote:       'win' | 'lose' | 'draw' | null;
    voteRound:  number;      // which conflict round this vote belongs to
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

// ─── Resolve outcome from votes ───────────────────────────────────────────────
function resolveVotes(records: PlayerRecord[], round: number): { result: 'valid' | 'conflict' | 'draw' | 'force_draw'; winnerId?: string } {
    const votes = records.filter(r => r.voteRound === round).map(r => ({ id: r.playerId, vote: r.vote }));
    const winners = votes.filter(v => v.vote === 'win');
    const losers  = votes.filter(v => v.vote === 'lose');
    const draws   = votes.filter(v => v.vote === 'draw');

    if (draws.length === votes.length) return { result: 'draw' };
    if (losers.length === votes.length) return { result: 'draw' };
    if (winners.length === votes.length) return { result: 'conflict' };
    if (winners.length === 1 && losers.length === votes.length - 1) {
        return { result: 'valid', winnerId: winners[0].id };
    }
    if (draws.length > 0 && winners.length > 0) return { result: 'conflict' };
    return { result: 'conflict' };
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
function AnswersTable({ records, letter, myId, revealIdentities }: {
    records: PlayerRecord[]; letter: string; myId: string; revealIdentities: boolean;
}) {
    const getName = (p: PlayerRecord) => {
        if (p.playerId === myId) return 'أنت';
        if (revealIdentities && p.realName && p.realName !== p.playerName) {
            return `${p.playerName} (${p.realName})`;
        }
        return p.playerName;
    };
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
                <p className="text-xs font-black text-gray-500">إجابات اللاعبين:</p>
                {revealIdentities && records.some(r => r.realName && r.realName !== r.playerName) && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                        <Eye className="w-3 h-3"/> تم كشف الهويات
                    </div>
                )}
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

// ─── Voting Panel with round tracking ─────────────────────────────────────────
function VotingPanel({ records, myId, onVote, currentRound, maxRounds }: {
    records: PlayerRecord[]; myId: string;
    onVote: (v: 'win' | 'lose' | 'draw') => void;
    currentRound: number;
    maxRounds: number;
}) {
    const roundRecords = records.filter(r => r.voteRound === currentRound || r.playerId === myId);
    const myRecord = records.find(r => r.playerId === myId);
    const myVote = myRecord?.voteRound === currentRound ? myRecord.vote : null;
    const allVoted = records.length > 0 && records.every(r => r.vote !== null && r.voteRound === currentRound);
    const outcome  = allVoted ? resolveVotes(records, currentRound) : null;
    const others = records.filter(r => r.playerId !== myId);
    const isConflictRound = currentRound > 1;
    const roundsLeft = maxRounds - currentRound;

    return (
        <div className={`border-2 rounded-2xl p-4 space-y-3 ${isConflictRound ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'}`}>
            {isConflictRound && (
                <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-black text-red-700">⚠️ تعارض في الجولة {currentRound - 1}!</p>
                    <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                        {roundsLeft > 0 ? `${roundsLeft} فرصة متبقية` : 'آخر فرصة'}
                    </span>
                </div>
            )}
            <p className="text-sm font-black text-center" style={{ color: isConflictRound ? '#7f1d1d' : '#78350f' }}>
                {isConflictRound ? 'أعد التصويت بعناية...' : 'بعد مراجعة الإجابات... ما قرارك؟'}
            </p>

            {myVote === null ? (
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => onVote('win')}
                        className="flex flex-col items-center gap-1.5 bg-gradient-to-b from-emerald-400 to-green-600 text-white py-3 rounded-2xl font-black shadow-md hover:scale-105 active:scale-95 transition-all">
                        <Trophy className="w-6 h-6"/>
                        <span className="text-xs">فزت 🏆</span>
                    </button>
                    <button onClick={() => onVote('draw')}
                        className="flex flex-col items-center gap-1.5 bg-gradient-to-b from-blue-400 to-blue-600 text-white py-3 rounded-2xl font-black shadow-md hover:scale-105 active:scale-95 transition-all">
                        <Medal className="w-6 h-6"/>
                        <span className="text-xs">تعادل 🤝</span>
                    </button>
                    <button onClick={() => onVote('lose')}
                        className="flex flex-col items-center gap-1.5 bg-gradient-to-b from-gray-400 to-gray-600 text-white py-3 rounded-2xl font-black shadow-md hover:scale-105 active:scale-95 transition-all">
                        <XCircle className="w-6 h-6"/>
                        <span className="text-xs">خسرت 😔</span>
                    </button>
                </div>
            ) : (
                <div className={`text-center py-2.5 rounded-xl font-black text-sm ${
                    myVote === 'win' ? 'bg-green-100 text-green-800' :
                    myVote === 'draw' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-700'}`}>
                    {myVote === 'win' ? '🏆 اخترت: فزت' : myVote === 'draw' ? '🤝 اخترت: تعادل' : '😔 اخترت: خسرت'}
                </div>
            )}

            {others.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                    {others.map(r => {
                        const voted = r.vote !== null && r.voteRound === currentRound;
                        return (
                            <div key={r.playerId} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${voted ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                                {voted ? '✓ صوّت' : <><Loader2 className="w-3 h-3 animate-spin inline ml-1"/>ينتظر</>} {r.playerName}
                            </div>
                        );
                    })}
                </div>
            )}

            {outcome && (
                <div className={`rounded-xl p-3 text-center font-black text-sm border-2 ${
                    outcome.result === 'valid' ? 'bg-emerald-50 border-emerald-400 text-emerald-800' :
                    outcome.result === 'draw'  ? 'bg-blue-50 border-blue-400 text-blue-800' :
                    outcome.result === 'force_draw' ? 'bg-gray-50 border-gray-400 text-gray-700' :
                    'bg-red-50 border-red-300 text-red-700'}`}>
                    {outcome.result === 'conflict' && roundsLeft > 0 && '⚠️ تعارض — ستبدأ جولة تصويت جديدة'}
                    {outcome.result === 'conflict' && roundsLeft <= 0 && '⚠️ انتهت الفرص — سيُعتبر تعادلاً'}
                    {outcome.result === 'draw'     && '🤝 تعادل! سيحصل الجميع على 5 نقاط'}
                    {outcome.result === 'force_draw' && '🤝 تعادل إجباري بعد تكرار التعارض'}
                    {outcome.result === 'valid'    && (outcome.winnerId === myId ? '🏆 أنت الفائز! استعد للسؤال' : '🎖️ الفائز محدد — انتظر السؤال')}
                </div>
            )}
        </div>
    );
}

// ─── Question Screen ──────────────────────────────────────────────────────────
function QuestionScreen({ question, onAnswer, timeLeft, answered, isCorrect, loading }: {
    question: any; onAnswer: (opt: string) => void;
    timeLeft: number; answered: boolean; isCorrect: boolean | null; loading: boolean;
}) {
    return (
        <div className="bg-white rounded-2xl border-2 border-indigo-200 p-4 space-y-3 shadow-lg animate-in fade-in duration-400">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-indigo-600"/>
                    <span className="text-xs font-black text-indigo-700">سؤال المكافأة</span>
                </div>
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-black text-xs border ${timeLeft <= 5 ? 'bg-red-100 border-red-400 text-red-700 animate-pulse' : 'bg-indigo-50 border-indigo-300 text-indigo-700'}`}>
                    <Timer className="w-3 h-3"/> {timeLeft}ث
                </div>
            </div>
            <p className="text-sm font-bold text-gray-800 leading-relaxed">{question.questionText}</p>
            {!answered ? (
                <div className="space-y-2">
                    {question.options.map((opt: string, i: number) => (
                        <button key={i} onClick={() => onAnswer(opt)} disabled={loading}
                            className="w-full bg-white border-2 border-gray-100 p-3 rounded-xl font-bold text-gray-700 text-sm hover:border-indigo-400 hover:bg-indigo-50 active:scale-95 transition-all text-right">
                            {opt}
                        </button>
                    ))}
                </div>
            ) : (
                <div className={`text-center py-3 rounded-xl font-black text-sm ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                    {isCorrect ? '✅ إجابة صحيحة! تمت إضافة النقاط' : '❌ إجابة خاطئة — حظ أوفر'}
                </div>
            )}
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
    const currentVoteRound: number = gs.voteRound ?? 1;
    const status:  string         = match.status  ?? 'waiting';
    const players: any[]          = match.players ?? [];

    // ── Local state ───────────────────────────────────────────────────────────
    const [answers, setAnswers]       = useState<Answers>(emptyAnswers);
    const [timeLeft, setTimeLeft]     = useState(TIMER_SECS);
    const [stopped, setStopped]       = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Question phase
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

    // ── Question timer ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!question || qAnswered) return;
        if (qTime <= 0) { handleQAnswer('__timeout__'); return; }
        const t = setInterval(() => setQTime(p => p - 1), 1000);
        return () => clearInterval(t);
    }, [question, qTime, qAnswered]);

    // ── Resolve votes → trigger question for winner ───────────────────────────
    useEffect(() => {
        if (status !== 'finished') return;
        const allVoted = records.length === players.length &&
            records.every(r => r.vote !== null && r.voteRound === currentVoteRound);
        if (!allVoted) return;

        const outcome = resolveVotes(records, currentVoteRound);

        if (outcome.result === 'conflict') {
            // If still have rounds left — bump voteRound and reset votes
            if (currentVoteRound < MAX_VOTE_ROUNDS) {
                const nextRound = currentVoteRound + 1;
                const resetRecords = records.map(r => ({ ...r, vote: null, voteRound: nextRound }));
                supabase.from('live_matches').update({
                    game_state: { ...gs, records: resetRecords, voteRound: nextRound },
                }).eq('id', match.id);
            } else {
                // Force draw after max rounds
                if (!qAnswered && !question) {
                    play('win');
                    grantPoints(5).then(() => toast.success('تعادل إجباري بعد تكرار التعارض! +5 نقاط 🤝'));
                    setQAnswered(true);
                }
            }
            return;
        }

        if (outcome.result === 'draw' || outcome.result === 'force_draw') {
            if (!qAnswered && !question) {
                play('win');
                grantPoints(5).then(() => toast.success('تعادل! +5 نقاط 🤝'));
                setQAnswered(true);
            }
            return;
        }

        // Valid result: winner gets question
        if (outcome.winnerId === myId && !question && !qAnswered) {
            setQLoading(true);
            fetchQuestion(employee).then(q => {
                setQLoading(false);
                if (q) { setQuestion(q); setQTime(20); }
                else {
                    grantPoints(15).then(() => toast.success('فزت! +15 نقطة 🏆'));
                    setQAnswered(true);
                }
            });
        }
    }, [records, status, currentVoteRound]);

    // ── Save my answers ───────────────────────────────────────────────────────
    const saveMyAnswers = async (iAmStopper: boolean) => {
        if (submitting) return;
        setSubmitting(true);
        setStopped(true);

        const rec: PlayerRecord = {
            playerId:   myId,
            playerName: myDisplayName,
            realName:   isAlias ? myName : undefined,
            answers,
            stopped:    iAmStopper,
            vote:       null,
            voteRound:  1,
        };

        const updatedRecords = [...records.filter(r => r.playerId !== myId), rec];
        const update: any = { game_state: { ...gs, records: updatedRecords, voteRound: gs.voteRound ?? 1 } };
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

    // ── Vote (with round tracking) ────────────────────────────────────────────
    const handleVote = async (vote: 'win' | 'lose' | 'draw') => {
        if (!myRecord) return;
        const updated = records.map(r =>
            r.playerId === myId ? { ...r, vote, voteRound: currentVoteRound } : r
        );
        await supabase.from('live_matches').update({
            game_state: { ...gs, records: updated },
        }).eq('id', match.id);
    };

    // ── Question answer ───────────────────────────────────────────────────────
    const handleQAnswer = async (ans: string) => {
        if (qAnswered) return;
        setQAnswered(true);
        setQTime(0);
        const correct = question?.correctAnswer ?? '';
        const sel = ans.trim().toLowerCase();
        const ok  = ans !== '__timeout__' && (correct === sel || correct.includes(sel) || sel.includes(correct));
        setQCorrect(ok);
        play(ok ? 'win' : 'lose');
        if (ok) await grantPoints(15);
        else    toast.error('إجابة خاطئة — حظ أوفر 😅');
    };

    // ── Host start ────────────────────────────────────────────────────────────
    const isHost = players.length > 0 &&
        [...players].sort((a, b) => a.id.localeCompare(b.id))[0]?.id === myId;

    const handleStart = async () => {
        await supabase.from('live_matches').update({
            status:     'playing',
            game_state: { letter: pickLetter(), startedAt: Date.now(), records: [], voteRound: 1 },
        }).eq('id', match.id);
    };

    const myVote = (myRecord?.voteRound === currentVoteRound) ? (myRecord?.vote ?? null) : null;
    const allVoted = status === 'finished' && records.length === players.length &&
        records.every(r => r.vote !== null && r.voteRound === currentVoteRound);
    const outcome = allVoted ? resolveVotes(records, currentVoteRound) : null;

    // Reveal identities once game is finished (status=finished)
    const revealIdentities = status === 'finished';

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
                <button onClick={handleStart}
                    className="bg-gradient-to-r from-violet-500 to-purple-700 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all">
                    🎲 ابدأ اللعبة
                </button>
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
    // FINISHED
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'finished') return (
        <div className="flex flex-col gap-3 py-2 px-3 animate-in fade-in duration-400" dir="rtl">

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
                {/* Alias reveal notice */}
                {records.some(r => r.realName && r.realName !== r.playerName) && (
                    <div className="mt-2 bg-white/20 rounded-xl px-3 py-1.5 flex items-center justify-center gap-2">
                        <Eye className="w-4 h-4"/>
                        <p className="text-xs font-black">تم كشف هويات اللاعبين المجهولين 🕵️</p>
                    </div>
                )}
            </div>

            <AnswersTable records={records} letter={letter} myId={myId} revealIdentities={revealIdentities}/>

            {/* Voting section */}
            {(!allVoted || (outcome?.result === 'conflict' && currentVoteRound < MAX_VOTE_ROUNDS)) ? (
                <VotingPanel
                    records={records}
                    myId={myId}
                    onVote={handleVote}
                    currentRound={currentVoteRound}
                    maxRounds={MAX_VOTE_ROUNDS}
                />
            ) : (
                <div className="space-y-3">
                    {outcome?.result === 'draw' && (
                        <div className="bg-blue-50 border-2 border-blue-400 rounded-2xl p-4 text-center">
                            <div className="text-3xl mb-1">🤝</div>
                            <p className="font-black text-blue-800">تعادل! حصل الجميع على 5 نقاط</p>
                        </div>
                    )}
                    {(outcome?.result === 'conflict' && currentVoteRound >= MAX_VOTE_ROUNDS) && (
                        <div className="bg-gray-50 border-2 border-gray-300 rounded-2xl p-4 text-center">
                            <div className="text-3xl mb-1">🤝</div>
                            <p className="font-black text-gray-700">تعادل إجباري — انتهت الفرص</p>
                            <p className="text-xs text-gray-400 mt-1">حصل الجميع على 5 نقاط</p>
                        </div>
                    )}
                    {outcome?.result === 'valid' && (
                        <div className={`rounded-2xl p-4 text-center border-2 ${outcome.winnerId === myId ? 'bg-emerald-50 border-emerald-400' : 'bg-gray-50 border-gray-300'}`}>
                            {outcome.winnerId === myId ? (
                                <><div className="text-3xl mb-1">🏆</div><p className="font-black text-emerald-800">أنت الفائز!</p></>
                            ) : (
                                <><div className="text-3xl mb-1">🎖️</div><p className="font-black text-gray-700">{records.find(r => r.playerId === outcome.winnerId)?.playerName} هو الفائز</p></>
                            )}
                        </div>
                    )}

                    {outcome?.result === 'valid' && outcome.winnerId === myId && (
                        qLoading ? (
                            <div className="text-center py-4">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-2"/>
                                <p className="text-xs font-bold text-gray-400">جاري تحضير السؤال...</p>
                            </div>
                        ) : question && !qAnswered ? (
                            <QuestionScreen
                                question={question} onAnswer={handleQAnswer}
                                timeLeft={qTime} answered={qAnswered}
                                isCorrect={qCorrect} loading={false}/>
                        ) : qAnswered && (
                            <div className={`rounded-xl p-3 text-center font-black text-sm ${qCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                                {qCorrect ? '✅ أجبت صح! تمت إضافة 15 نقطة 🎉' : '❌ إجابة خاطئة — حظ أوفر'}
                            </div>
                        )
                    )}
                </div>
            )}

            <button onClick={onExit}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-700 text-white py-3.5 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">
                <Users className="w-5 h-5"/> العودة إلى الصالة
            </button>
        </div>
    );

    return null;
}
