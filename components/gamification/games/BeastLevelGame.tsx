import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Trophy, Timer, Brain, Zap, Shield, Users, Star, Crown, Flame } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const MIN_POINTS    = 5000;   // حد أدنى للدخول
const TOTAL_STEPS   = 15;     // 15 سؤال زي البرنامج
const STEP_SECS     = [       // وقت كل سؤال حسب مستواه
    30, 30, 30, 28, 28,       // 1-5  سهل
    25, 25, 22, 22, 20,       // 6-10 متوسط-صعب
    18, 15, 12, 10, 8,        // 11-15 وحش
];

// ─── Prize ladder (نقاط الفوز) ────────────────────────────────────────────────
const PRIZES = [
    50, 100, 200, 300, 500,           // 1-5
    1000, 2000, 4000, 8000, 16000,    // 6-10  ← نقطة أمان عند 5
    32000, 64000, 125000, 250000, 500000, // 11-15
];

const SAFE_HAVENS = [4, 9]; // index 4 = سؤال 5, index 9 = سؤال 10

// ─── Bet tiers ─────────────────────────────────────────────────────────────────
const BET_TIERS = [
    { min: 100,  max: 299,  multiplier: 2,   badge: 'bronze', label: 'برونزي',  emoji: '🥉', color: 'from-orange-400 to-amber-600'  },
    { min: 300,  max: 599,  multiplier: 2.5, badge: 'silver', label: 'فضي',     emoji: '🥈', color: 'from-slate-400 to-gray-500'    },
    { min: 600,  max: 999,  multiplier: 3,   badge: 'gold',   label: 'ذهبي',    emoji: '🥇', color: 'from-yellow-400 to-amber-500'  },
    { min: 1000, max: 1000, multiplier: 3,   badge: 'diamond',label: 'ألماس',   emoji: '💎', color: 'from-cyan-400 to-blue-600'     },
];

// ─── Medical Badges ────────────────────────────────────────────────────────────
const MEDICAL_BADGES = [
    { id: 'intern',        label: 'طبيب مقيم',          emoji: '🩺',  minWins: 1,  color: 'bg-blue-100 text-blue-700'    },
    { id: 'resident',      label: 'طبيب أخصائي',        emoji: '⚕️',  minWins: 3,  color: 'bg-green-100 text-green-700'  },
    { id: 'specialist',    label: 'استشاري',             emoji: '👨‍⚕️', minWins: 5,  color: 'bg-purple-100 text-purple-700'},
    { id: 'consultant',    label: 'أستاذ مساعد',         emoji: '🎓',  minWins: 10, color: 'bg-yellow-100 text-yellow-700'},
    { id: 'professor',     label: 'أستاذ دكتور',         emoji: '🏛️',  minWins: 20, color: 'bg-red-100 text-red-700'     },
    { id: 'grand_master',  label: 'عميد الأطباء',        emoji: '👑',  minWins: 50, color: 'bg-amber-100 text-amber-700'  },
    { id: 'beast',         label: '🦁 وحش المعرفة',      emoji: '🦁',  minWins: 100,color: 'bg-gradient-to-r from-red-500 to-orange-500 text-white'},
    // Nursing
    { id: 'nurse_1',       label: 'ممرض متميز',          emoji: '💉',  minWins: 1,  color: 'bg-pink-100 text-pink-700'    },
    { id: 'nurse_2',       label: 'مشرف تمريض',          emoji: '🏥',  minWins: 5,  color: 'bg-rose-100 text-rose-700'    },
    { id: 'nurse_chief',   label: 'رئيس تمريض',          emoji: '⭐',  minWins: 20, color: 'bg-red-100 text-red-700'      },
    // Pharmacy
    { id: 'pharmacist_1',  label: 'صيدلاني متقدم',       emoji: '💊',  minWins: 1,  color: 'bg-teal-100 text-teal-700'   },
    { id: 'pharmacist_2',  label: 'رئيس صيادلة',         emoji: '🧪',  minWins: 10, color: 'bg-emerald-100 text-emerald-700'},
    // Lab
    { id: 'lab_1',         label: 'فني معمل متميز',      emoji: '🔬',  minWins: 1,  color: 'bg-indigo-100 text-indigo-700'},
    { id: 'lab_chief',     label: 'رئيس معمل',           emoji: '🧫',  minWins: 10, color: 'bg-violet-100 text-violet-700'},
    // Quality
    { id: 'quality_1',     label: 'محقق الجودة',         emoji: '✅',  minWins: 1,  color: 'bg-cyan-100 text-cyan-700'   },
    { id: 'quality_chief', label: 'مدير الجودة',         emoji: '🏆',  minWins: 10, color: 'bg-sky-100 text-sky-700'     },
];

// ─── AI Question Generator ────────────────────────────────────────────────────
async function generateAIQuestion(
    specialty: string,
    level: number,     // 1-15
    usedTopics: string[]
): Promise<{ question: string; options: string[]; correct: number; explanation: string; topic: string } | null> {
    const difficulty = level <= 5 ? 'متوسطة' : level <= 10 ? 'صعبة' : 'صعبة جداً وعميقة';
    const specFocus  = level % 3 === 0 ? `متخصصة في ${specialty}` : level % 3 === 1 ? 'طبية عامة' : `متخصصة في ${specialty} مع مفاهيم عامة`;
    const avoidTopics = usedTopics.length > 0 ? `تجنب هذه المواضيع التي سبق طرحها: ${usedTopics.join('، ')}` : '';

    const prompt = `أنت خبير في وضع أسئلة امتحانات طبية على مستوى عالٍ جداً.

ضع سؤالاً واحداً ${specFocus} بمستوى صعوبة ${difficulty}.
${avoidTopics}
المستوى: ${level} من 15 (كلما زاد الرقم كلما زادت الصعوبة والعمق).

⚠️ مهم جداً:
- السؤال يجب أن يكون واقعياً وعملياً، وليس نظرياً بحتاً
- الخيارات الخاطئة يجب أن تكون منطقية ومحيّرة لمن لا يعرف جيداً
- المستوى 11-15: أسئلة نادرة، حالات سريرية معقدة، تفاصيل دقيقة جداً
- لا تذكر أي تلميح في صياغة السؤال

أجب بـ JSON فقط بهذا الشكل:
{
  "question": "نص السؤال",
  "options": ["الخيار أ", "الخيار ب", "الخيار ج", "الخيار د"],
  "correct": 0,
  "explanation": "شرح مختصر للإجابة الصحيحة",
  "topic": "موضوع السؤال بكلمة أو كلمتين"
}

حيث correct هو رقم الخيار الصحيح (0-3).`;

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                messages: [{ role: 'user', content: prompt }],
            }),
        });
        const data = await response.json();
        const text = data.content?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.question || !Array.isArray(parsed.options) || parsed.options.length !== 4) return null;
        return parsed;
    } catch {
        return null;
    }
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlayerState {
    id:           string;
    name:         string;
    bet:          number;
    currentStep:  number;     // 0-14
    safePoints:   number;     // نقاط محمية
    status:       'playing' | 'won' | 'lost' | 'walked';
    lifelinesUsed: string[];  // ['50_50', 'time_extra', 'skip']
    answeredAt:   number | null;
    answer:       number | null;   // index of chosen option
    correct:      boolean | null;
}

interface BeastGS {
    players:      PlayerState[];
    currentStep:  number;           // global step (all sync)
    question:     {
        question:    string;
        options:     string[];
        correct:     number;
        explanation: string;
        topic:       string;
    } | null;
    questionReady: boolean;
    revealedAt:   number | null;    // when question was shown
    stepStartedAt: number | null;
    usedTopics:   string[];
    phase:        'betting' | 'playing' | 'reveal' | 'next' | 'finished';
    winnerId:     string | null;
}

interface Props {
    match:       any;
    employee:    Employee;
    onExit:      () => void;
    grantPoints: (pts: number) => Promise<void>;
}

// ─── Sound ────────────────────────────────────────────────────────────────────
function useSound() {
    const ctx = useRef<AudioContext | null>(null);
    const get = () => {
        if (!ctx.current) ctx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return ctx.current;
    };
    return useCallback((type: 'tick' | 'correct' | 'wrong' | 'win' | 'safe' | 'tension') => {
        try {
            const ac = get(), now = ac.currentTime;
            if (type === 'tick') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.value = 880;
                g.gain.setValueAtTime(0.1, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
                o.start(now); o.stop(now + 0.07);
            }
            if (type === 'correct') {
                [523, 659, 784, 1047].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'triangle'; o.frequency.value = f;
                    const t = now + i * 0.12;
                    g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
                    o.start(t); o.stop(t + 0.3);
                });
            }
            if (type === 'wrong') {
                [220, 180, 150].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'sawtooth'; o.frequency.value = f;
                    const t = now + i * 0.15;
                    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                    o.start(t); o.stop(t + 0.2);
                });
            }
            if (type === 'win') {
                [523,659,784,1047,1319,1568].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'triangle'; o.frequency.value = f;
                    const t = now + i * 0.1;
                    g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
                    o.start(t); o.stop(t + 0.35);
                });
            }
            if (type === 'tension') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.setValueAtTime(300, now);
                o.frequency.linearRampToValueAtTime(350, now + 0.5);
                g.gain.setValueAtTime(0.08, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                o.start(now); o.stop(now + 0.6);
            }
        } catch (_) {}
    }, []);
}

// ─── Prize Ladder ─────────────────────────────────────────────────────────────
function PrizeLadder({ currentStep, safePoints }: { currentStep: number; safePoints: number }) {
    return (
        <div className="space-y-0.5 overflow-y-auto max-h-96">
            {[...PRIZES].reverse().map((prize, ri) => {
                const stepIdx = PRIZES.length - 1 - ri;
                const isCurrent  = stepIdx === currentStep;
                const isPassed   = stepIdx < currentStep;
                const isSafe     = SAFE_HAVENS.includes(stepIdx);
                return (
                    <div key={stepIdx} className={`flex items-center justify-between px-3 py-1.5 rounded-lg transition-all ${
                        isCurrent  ? 'bg-yellow-400 text-gray-900 font-black shadow-lg scale-105' :
                        isPassed   ? 'bg-green-100 text-green-700 font-bold' :
                        isSafe     ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' :
                        'bg-white/5 text-white/60 font-medium'
                    }`}>
                        <span className={`text-xs ${isSafe ? 'text-blue-500' : ''}`}>
                            {isSafe ? '🔒 ' : ''}{stepIdx + 1}
                        </span>
                        <span className="text-sm font-black">
                            {prize.toLocaleString('ar')} نقطة
                        </span>
                        {isCurrent && <Flame className="w-3.5 h-3.5 text-orange-600 animate-pulse"/>}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Timer Ring ───────────────────────────────────────────────────────────────
function TimerRing({ seconds, total }: { seconds: number; total: number }) {
    const r = 28, c = 2 * Math.PI * r;
    const pct = seconds / total;
    const color = pct < 0.25 ? '#ef4444' : pct < 0.5 ? '#f97316' : '#22c55e';
    return (
        <div className="relative w-16 h-16 flex items-center justify-center">
            <svg width={64} height={64} viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={32} cy={32} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={4}/>
                <circle cx={32} cy={32} r={r} fill="none" stroke={color} strokeWidth={4}
                    strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}/>
            </svg>
            <span className={`absolute text-lg font-black ${pct < 0.25 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                {seconds}
            </span>
        </div>
    );
}

// ─── Option Button ────────────────────────────────────────────────────────────
function OptionBtn({ label, text, chosen, correct, revealed, hidden, onClick }: {
    label: string; text: string; chosen: boolean;
    correct: boolean; revealed: boolean; hidden: boolean; onClick: () => void;
}) {
    if (hidden) return <div className="h-12 rounded-xl bg-white/5 opacity-30"/>;

    const bg = revealed
        ? correct ? 'bg-green-500 text-white border-green-400 shadow-green-500/30'
                  : chosen ? 'bg-red-500 text-white border-red-400' : 'bg-white/10 text-white/50 border-white/10'
        : chosen ? 'bg-yellow-400 text-gray-900 border-yellow-300 shadow-yellow-400/30 scale-105'
                 : 'bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/40 active:scale-95';

    return (
        <button onClick={onClick} disabled={revealed || chosen}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all shadow-lg ${bg}`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 border ${
                revealed && correct ? 'bg-white/30 border-white/30' :
                chosen ? 'bg-black/20 border-transparent' : 'bg-white/10 border-white/20'
            }`}>{label}</span>
            <span className="text-right flex-1">{text}</span>
        </button>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BeastLevelGame({ match, employee, onExit, grantPoints }: Props) {
    const play    = useSound();
    const myId    = employee.employee_id;
    const isHost  = match.players?.[0]?.id === myId;

    const gs: BeastGS       = match.game_state ?? {};
    const players           = gs.players ?? [];
    const phase             = gs.phase ?? 'betting';
    const question          = gs.question;
    const currentStep       = gs.currentStep ?? 0;
    const status            = match.status ?? 'waiting';

    const myPS = players.find(p => p.id === myId);
    const myStep     = myPS?.currentStep  ?? 0;
    const myStatus   = myPS?.status       ?? 'playing';
    const myLifelines = myPS?.lifelinesUsed ?? [];

    // ── Local state ────────────────────────────────────────────────────────────
    const [bet, setBet]               = useState(100);
    const [betError, setBetError]     = useState('');
    const [chosenOption, setChosen]   = useState<number | null>(null);
    const [timeLeft, setTimeLeft]     = useState(STEP_SECS[0]);
    const [revealed, setRevealed]     = useState(false);
    const [showExpl, setShowExpl]     = useState(false);
    const [hiddenOptions, setHidden]  = useState<number[]>([]);
    const [genLoading, setGenLoading] = useState(false);
    const [walked, setWalked]         = useState(false);

    const prevTickRef   = useRef(STEP_SECS[0]);
    const timedOutRef   = useRef(false);
    const submitLockRef = useRef(false);

    // ── Sync timer from DB ─────────────────────────────────────────────────────
    useEffect(() => {
        if (phase !== 'playing' || !gs.stepStartedAt) return;
        timedOutRef.current = false;
        setChosen(null);
        setRevealed(false);
        setShowExpl(false);
        setHidden([]);
        const total = STEP_SECS[currentStep] || 20;
        const iv = setInterval(() => {
            const elapsed = Math.floor((Date.now() - gs.stepStartedAt!) / 1000);
            const left = Math.max(0, total - elapsed);
            setTimeLeft(left);
            if ([10, 5, 4, 3, 2, 1].includes(left) && left !== prevTickRef.current) {
                prevTickRef.current = left; play('tick');
            }
            if (left === 0 && !timedOutRef.current && isHost) {
                timedOutRef.current = true;
                handleReveal();
            }
        }, 500);
        return () => clearInterval(iv);
    }, [phase, gs.stepStartedAt, currentStep]);

    // ── Generate question (host only) ──────────────────────────────────────────
    useEffect(() => {
        if (!isHost || phase !== 'playing' || gs.questionReady) return;
        generateQuestion();
    }, [phase, gs.questionReady, currentStep]);

    const generateQuestion = async () => {
        setGenLoading(true);
        const specialty = employee.specialty || 'طبي عام';
        const q = await generateAIQuestion(specialty, currentStep + 1, gs.usedTopics ?? []);
        setGenLoading(false);
        if (!q) {
            toast.error('خطأ في توليد السؤال، يُعاد المحاولة...');
            setTimeout(generateQuestion, 2000);
            return;
        }
        await supabase.from('live_matches').update({
            game_state: {
                ...gs,
                question:      q,
                questionReady: true,
                stepStartedAt: Date.now(),
                usedTopics:    [...(gs.usedTopics ?? []), q.topic],
            },
        }).eq('id', match.id);
    };

    // ── Submit answer ──────────────────────────────────────────────────────────
    const handleAnswer = async (idx: number) => {
        if (chosenOption !== null || myStatus !== 'playing' || !question) return;
        setChosen(idx);
        submitLockRef.current = true;

        const updatedPlayers = players.map(p =>
            p.id === myId ? { ...p, answer: idx, answeredAt: Date.now() } : p
        );
        await supabase.from('live_matches').update({
            game_state: { ...gs, players: updatedPlayers },
        }).eq('id', match.id);

        // If everyone answered, host reveals
        const allAnswered = updatedPlayers.filter(p => p.status === 'playing').every(p => p.answer !== null);
        if (allAnswered && isHost) {
            setTimeout(() => handleReveal(), 1500);
        }
    };

    // ── Reveal + Score ──────────────────────────────────────────────────────────
    const handleReveal = async () => {
        if (!question || submitLockRef.current === false) return;
        setRevealed(true);
        setShowExpl(true);

        const correct = question.correct;
        const updatedPlayers = players.map(p => {
            if (p.status !== 'playing') return p;
            const isCorrect = p.answer === correct;
            play(isCorrect ? 'correct' : 'wrong');

            if (isCorrect) {
                const newStep  = p.currentStep + 1;
                const isSafe   = SAFE_HAVENS.includes(p.currentStep);
                const safePts  = isSafe ? PRIZES[p.currentStep] : p.safePoints;
                return { ...p, correct: true, currentStep: newStep, safePoints: safePts };
            } else {
                return { ...p, correct: false, status: 'lost' };
            }
        });

        const allDone = updatedPlayers.every(p =>
            p.status !== 'playing' || p.currentStep >= TOTAL_STEPS
        );
        const champion = updatedPlayers.find(p => p.currentStep >= TOTAL_STEPS);
        const newPhase = allDone ? 'finished' : 'reveal';
        const winner   = champion?.id ?? null;

        await supabase.from('live_matches').update({
            game_state: {
                ...gs,
                players:       updatedPlayers,
                phase:         newPhase,
                questionReady: false,
                question:      null,
                winnerId:      winner,
            },
            status:    allDone ? 'finished' : 'playing',
            winner_id: winner,
        }).eq('id', match.id);

        if (allDone) {
            setTimeout(() => handleFinish(updatedPlayers, winner), 2500);
        }
    };

    // ── Finish & Pay ──────────────────────────────────────────────────────────
    const handleFinish = async (finalPlayers: PlayerState[], winnerId: string | null) => {
        for (const p of finalPlayers) {
            if (p.id !== myId) continue;
            const prizeStep = p.status === 'won' || p.currentStep >= TOTAL_STEPS
                ? TOTAL_STEPS - 1 : p.safePoints > 0 ? SAFE_HAVENS.find(s => s < p.currentStep) ?? -1 : -1;
            const earnedPts = p.status === 'won' ? Math.round(p.bet * getBetTier(p.bet).multiplier)
                : p.safePoints;
            const lostPts = p.status === 'lost' ? p.bet - p.safePoints : 0;

            if (p.status === 'won') {
                await grantPoints(earnedPts);
                play('win');
            } else if (p.status === 'lost' && lostPts > 0) {
                // Deduct points
                await supabase.rpc('increment_points', { emp_id: myId, amount: -lostPts });
                await supabase.from('points_ledger').insert({
                    employee_id: myId, points: -lostPts,
                    reason: 'خسارة في ليفل الوحش 🦁',
                });
            } else if (p.safePoints > 0) {
                await grantPoints(p.safePoints);
            }
        }
    };

    // ── Walk Away ─────────────────────────────────────────────────────────────
    const handleWalkAway = async () => {
        setWalked(true);
        const safeAmt = myPS?.safePoints ?? 0;
        const updatedPlayers = players.map(p =>
            p.id === myId ? { ...p, status: 'walked' } : p
        );
        await supabase.from('live_matches').update({
            game_state: { ...gs, players: updatedPlayers },
        }).eq('id', match.id);
        if (safeAmt > 0) {
            await grantPoints(safeAmt);
            toast.success(`أخذت ${safeAmt.toLocaleString('ar')} نقطة وخرجت بأمان ✅`);
        }
    };

    // ── Lifeline: 50/50 ───────────────────────────────────────────────────────
    const use5050 = () => {
        if (!question || myLifelines.includes('50_50')) return;
        const correct = question.correct;
        const wrong = [0, 1, 2, 3].filter(i => i !== correct);
        const remove = wrong.sort(() => Math.random() - 0.5).slice(0, 2);
        setHidden(remove);
        const updatedPlayers = players.map(p =>
            p.id === myId ? { ...p, lifelinesUsed: [...p.lifelinesUsed, '50_50'] } : p
        );
        supabase.from('live_matches').update({
            game_state: { ...gs, players: updatedPlayers },
        }).eq('id', match.id);
    };

    // ── Lifeline: Skip ─────────────────────────────────────────────────────────
    const useSkip = async () => {
        if (myLifelines.includes('skip') || !isHost) return;
        const updatedPlayers = players.map(p =>
            p.id === myId ? { ...p, lifelinesUsed: [...p.lifelinesUsed, 'skip'] } : p
        );
        await supabase.from('live_matches').update({
            game_state: {
                ...gs,
                players:       updatedPlayers,
                question:      null,
                questionReady: false,
                stepStartedAt: Date.now(),
            },
        }).eq('id', match.id);
    };

    // ── Host advances to next step ─────────────────────────────────────────────
    const handleNext = async () => {
        await supabase.from('live_matches').update({
            game_state: {
                ...gs,
                phase:         'playing',
                question:      null,
                questionReady: false,
                currentStep:   currentStep + 1,
                stepStartedAt: null,
            },
        }).eq('id', match.id);
    };

    // ── Start game ────────────────────────────────────────────────────────────
    const handleStart = async () => {
        if (employee.total_points < MIN_POINTS) {
            toast.error(`تحتاج ${MIN_POINTS.toLocaleString('ar')} نقطة للدخول!`);
            return;
        }
        const matchPlayers: PlayerState[] = match.players.map((p: any) => ({
            id: p.id, name: p.name,
            bet:          0,
            currentStep:  0,
            safePoints:   0,
            status:       'playing',
            lifelinesUsed: [],
            answeredAt:   null,
            answer:       null,
            correct:      null,
        }));
        await supabase.from('live_matches').update({
            status: 'playing',
            game_state: {
                players:       matchPlayers,
                currentStep:   0,
                question:      null,
                questionReady: false,
                revealedAt:    null,
                stepStartedAt: null,
                usedTopics:    [],
                phase:         'betting',
                winnerId:      null,
            },
        }).eq('id', match.id);
    };

    // ── Submit bet ────────────────────────────────────────────────────────────
    const handleSubmitBet = async () => {
        if (bet < 100 || bet > 1000) { setBetError('الرهان بين 100 و 1000 نقطة'); return; }
        if (bet > (employee.total_points || 0)) { setBetError('رصيدك غير كافٍ'); return; }
        setBetError('');
        const updatedPlayers = players.map(p =>
            p.id === myId ? { ...p, bet } : p
        );
        const allBet = updatedPlayers.every(p => p.bet > 0);
        await supabase.from('live_matches').update({
            game_state: {
                ...gs,
                players: updatedPlayers,
                phase:   allBet ? 'playing' : 'betting',
            },
        }).eq('id', match.id);
    };

    // ─ Helpers ────────────────────────────────────────────────────────────────
    const getBetTier = (b: number) => BET_TIERS.find(t => b >= t.min && b <= t.max) ?? BET_TIERS[0];
    const currentTier = getBetTier(myPS?.bet ?? bet);
    const amIPlaying  = myStatus === 'playing';
    const amIWinner   = match.winner_id === myId;

    // ─────────────────────────────────────────────────────────────────────────
    // WAITING
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className="py-6 px-4 flex flex-col items-center gap-4" dir="rtl"
            style={{ background: 'linear-gradient(160deg,#0f0c29,#302b63,#24243e)', minHeight: 400 }}>
            <div className="text-center">
                <div className="text-6xl mb-2 animate-bounce">🦁</div>
                <h3 className="text-2xl font-black text-yellow-400 mb-1">ليفل الوحش</h3>
                <p className="text-sm text-white/60 font-bold">للمحترفين فقط — 5000 نقطة فأكثر</p>
            </div>

            {/* Requirements */}
            <div className="bg-white/10 rounded-2xl p-4 w-full max-w-sm space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-white/70 text-sm font-bold">رصيدك الحالي</span>
                    <span className={`font-black text-lg ${employee.total_points >= MIN_POINTS ? 'text-green-400' : 'text-red-400'}`}>
                        {(employee.total_points || 0).toLocaleString('ar')} نقطة
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-white/70 text-sm font-bold">الحد الأدنى</span>
                    <span className="text-yellow-400 font-black">{MIN_POINTS.toLocaleString('ar')} نقطة</span>
                </div>
                {employee.total_points < MIN_POINTS && (
                    <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-2 text-center">
                        <p className="text-red-300 text-xs font-black">❌ رصيدك غير كافٍ للدخول</p>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
                {match.players?.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-white/10 border border-white/20 px-3 py-1.5 rounded-full">
                        <span className="text-xs font-bold text-white">{p.name}</span>
                        {p.id === myId && <span className="text-[10px] text-yellow-400">(أنت)</span>}
                    </div>
                ))}
            </div>

            {isHost && employee.total_points >= MIN_POINTS ? (
                <div className="flex flex-col items-center gap-2 w-full max-w-xs">
                    <button onClick={handleStart}
                        disabled={match.players?.length < 2}
                        className="w-full py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>
                        🦁 ابدأ التحدي
                    </button>
                    {match.players?.length < 2 && (
                        <p className="text-xs font-bold text-amber-400">⏳ في انتظار لاعب آخر...</p>
                    )}
                </div>
            ) : !isHost ? (
                <div className="flex items-center gap-2 text-sm font-bold text-white/60">
                    <Loader2 className="w-4 h-4 animate-spin"/> في انتظار المضيف...
                </div>
            ) : null}
            <button onClick={onExit} className="text-sm font-bold text-white/40 hover:text-white/70">← العودة</button>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // BETTING PHASE
    // ─────────────────────────────────────────────────────────────────────────
    if (phase === 'betting') {
        const myBetDone = (myPS?.bet ?? 0) > 0;
        return (
            <div className="flex flex-col gap-4 py-4 px-4" dir="rtl"
                style={{ background: 'linear-gradient(160deg,#0f0c29,#302b63)', minHeight: 400 }}>
                <div className="text-center">
                    <div className="text-4xl mb-1">🎰</div>
                    <h3 className="text-xl font-black text-yellow-400">حدد رهانك</h3>
                    <p className="text-xs text-white/50 mt-1">من {(employee.total_points || 0).toLocaleString('ar')} نقطة متاحة</p>
                </div>

                {!myBetDone ? (
                    <div className="bg-white/10 rounded-2xl p-4 space-y-4">
                        {/* Bet slider */}
                        <div>
                            <div className="flex justify-between text-xs text-white/60 mb-1">
                                <span>100</span><span>1000</span>
                            </div>
                            <input type="range" min={100} max={Math.min(1000, employee.total_points || 100)}
                                value={bet} onChange={e => setBet(Number(e.target.value))}
                                className="w-full accent-yellow-400"/>
                            <div className="text-center mt-2">
                                <span className="text-3xl font-black text-yellow-400">{bet.toLocaleString('ar')}</span>
                                <span className="text-white/60 text-sm mr-1">نقطة</span>
                            </div>
                        </div>

                        {/* Quick buttons */}
                        <div className="grid grid-cols-4 gap-2">
                            {[100, 300, 600, 1000].map(v => (
                                <button key={v} onClick={() => setBet(Math.min(v, employee.total_points || v))}
                                    className={`py-2 rounded-xl text-xs font-black transition-all ${bet === v ? 'bg-yellow-400 text-gray-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                                    {v}
                                </button>
                            ))}
                        </div>

                        {/* Tier preview */}
                        <div className={`rounded-xl p-3 text-center bg-gradient-to-r ${currentTier.color}`}>
                            <p className="text-white font-black text-sm">
                                {currentTier.emoji} {currentTier.label} — فوز = {Math.round(bet * currentTier.multiplier).toLocaleString('ar')} نقطة
                            </p>
                            <p className="text-white/70 text-xs mt-0.5">خسارة = تخسر {bet - (myPS?.safePoints ?? 0)} نقطة</p>
                        </div>

                        {betError && <p className="text-red-400 text-xs text-center font-bold">{betError}</p>}

                        <button onClick={handleSubmitBet}
                            className="w-full py-3.5 rounded-2xl font-black text-gray-900 shadow-xl hover:scale-105 active:scale-95 transition-all"
                            style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)' }}>
                            ✅ تأكيد الرهان
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="text-4xl mb-2">✅</div>
                        <p className="text-green-400 font-black text-lg">رهنت {myPS?.bet?.toLocaleString('ar')} نقطة</p>
                        <p className="text-white/50 text-sm mt-2">في انتظار باقي اللاعبين...</p>
                        <Loader2 className="w-6 h-6 animate-spin text-white/30 mx-auto mt-3"/>
                    </div>
                )}
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PLAYING PHASE
    // ─────────────────────────────────────────────────────────────────────────
    if (phase === 'playing' || phase === 'reveal') {
        const totalTime = STEP_SECS[currentStep] || 20;
        const labels    = ['أ', 'ب', 'ج', 'د'];

        return (
            <div className="flex flex-col gap-2 py-2 px-2" dir="rtl"
                style={{ background: 'linear-gradient(160deg,#0f0c29,#302b63,#24243e)', minHeight: 500 }}>

                {/* Header */}
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                        <span className="text-yellow-400 font-black text-sm">سؤال {currentStep + 1}/{TOTAL_STEPS}</span>
                        <span className="text-xs text-white/40 font-bold">{PRIZES[currentStep]?.toLocaleString('ar')} نقطة</span>
                        {SAFE_HAVENS.includes(currentStep) && <span className="text-[10px] bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full font-bold">🔒 نقطة أمان</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        {amIPlaying && !revealed && <TimerRing seconds={timeLeft} total={totalTime}/>}
                    </div>
                </div>

                {/* Question card */}
                <div className="rounded-2xl p-4 shadow-xl" style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81)' }}>
                    {genLoading || !gs.questionReady ? (
                        <div className="text-center py-8">
                            <Brain className="w-10 h-10 text-indigo-400 animate-pulse mx-auto mb-3"/>
                            <p className="text-white/70 font-bold text-sm">الذكاء الاصطناعي يولد السؤال...</p>
                        </div>
                    ) : question ? (
                        <>
                            <p className="text-white font-bold text-sm leading-relaxed mb-4 text-center">
                                {question.question}
                            </p>
                            <div className="grid grid-cols-1 gap-2">
                                {question.options.map((opt, i) => (
                                    <OptionBtn key={i}
                                        label={labels[i]} text={opt}
                                        chosen={chosenOption === i}
                                        correct={i === question.correct}
                                        revealed={revealed}
                                        hidden={hiddenOptions.includes(i)}
                                        onClick={() => amIPlaying && !revealed && handleAnswer(i)}
                                    />
                                ))}
                            </div>
                            {revealed && showExpl && question.explanation && (
                                <div className="mt-3 bg-white/10 rounded-xl p-3 text-xs text-white/80 font-bold leading-relaxed">
                                    💡 {question.explanation}
                                </div>
                            )}
                        </>
                    ) : null}
                </div>

                {/* Lifelines */}
                {amIPlaying && !revealed && gs.questionReady && (
                    <div className="flex gap-2 px-2">
                        <button onClick={use5050} disabled={myLifelines.includes('50_50')}
                            className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all ${myLifelines.includes('50_50') ? 'opacity-30 bg-white/5 border-white/10 text-white/30' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}>
                            50:50
                        </button>
                        <button onClick={useSkip} disabled={myLifelines.includes('skip')}
                            className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all ${myLifelines.includes('skip') ? 'opacity-30 bg-white/5 border-white/10 text-white/30' : 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/30'}`}>
                            تخطي ⏭️
                        </button>
                        {(myPS?.safePoints ?? 0) > 0 && (
                            <button onClick={handleWalkAway} disabled={walked}
                                className="flex-1 py-2 rounded-xl text-xs font-black bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30 transition-all">
                                خروج آمن 🚪
                            </button>
                        )}
                    </div>
                )}

                {/* Players status */}
                <div className="flex gap-2 flex-wrap px-2">
                    {players.map(p => (
                        <div key={p.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold ${
                            p.status === 'won'    ? 'bg-yellow-400/30 text-yellow-300' :
                            p.status === 'lost'   ? 'bg-red-400/20 text-red-300' :
                            p.status === 'walked' ? 'bg-green-400/20 text-green-300' :
                            p.answer !== null     ? 'bg-indigo-400/30 text-indigo-200' :
                            'bg-white/10 text-white/60'
                        }`}>
                            {p.status === 'won' ? '🏆' : p.status === 'lost' ? '💀' : p.status === 'walked' ? '🚪' : p.answer !== null ? '✓' : '⌛'}
                            {p.name}
                        </div>
                    ))}
                </div>

                {/* Host: Next step */}
                {phase === 'reveal' && isHost && (
                    <button onClick={handleNext}
                        className="mx-2 py-3 rounded-2xl font-black text-gray-900 shadow-xl hover:scale-105 active:scale-95 transition-all"
                        style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)' }}>
                        السؤال التالي ←
                    </button>
                )}

                {myStatus !== 'playing' && (
                    <div className={`mx-2 p-3 rounded-2xl text-center font-black text-sm ${
                        myStatus === 'won' ? 'bg-yellow-400/20 text-yellow-300' :
                        myStatus === 'lost' ? 'bg-red-400/20 text-red-300' :
                        'bg-green-400/20 text-green-300'
                    }`}>
                        {myStatus === 'won' ? '🏆 فزت! في انتظار انتهاء الجولة...' :
                         myStatus === 'lost' ? '💀 خرجت من اللعبة — في انتظار النتيجة النهائية...' :
                         '🚪 خرجت بأمان — في انتظار النتيجة النهائية...'}
                    </div>
                )}
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FINISHED
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'finished' || phase === 'finished') {
        const sortedPlayers = [...players].sort((a, b) => {
            if (a.status === 'won' && b.status !== 'won') return -1;
            if (b.status === 'won' && a.status !== 'won') return 1;
            return b.currentStep - a.currentStep;
        });

        return (
            <div className="flex flex-col gap-3 py-4 px-4 animate-in fade-in" dir="rtl"
                style={{ background: 'linear-gradient(160deg,#0f0c29,#302b63)', minHeight: 400 }}>
                <div className="text-center">
                    <div className="text-5xl mb-2 animate-bounce">{amIWinner ? '🏆' : '🦁'}</div>
                    <h3 className={`text-2xl font-black ${amIWinner ? 'text-yellow-400' : 'text-white'}`}>
                        {amIWinner ? 'مبروك البطل! 🎉' : 'انتهت اللعبة'}
                    </h3>
                </div>

                <div className="space-y-2">
                    {sortedPlayers.map((p, i) => {
                        const tier  = getBetTier(p.bet);
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
                        const earned = p.status === 'won'    ? Math.round(p.bet * tier.multiplier)
                                     : p.status === 'walked' ? p.safePoints : p.safePoints;
                        const lost   = p.status === 'lost'   ? p.bet - p.safePoints : 0;
                        return (
                            <div key={p.id} className={`rounded-2xl p-3 border-2 ${
                                p.id === myId ? 'border-yellow-400/50 bg-yellow-400/10' : 'border-white/10 bg-white/5'
                            }`}>
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{medal}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-white text-sm truncate">{p.name}{p.id === myId && ' (أنت)'}</p>
                                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                                p.status === 'won'    ? 'bg-yellow-400/30 text-yellow-300' :
                                                p.status === 'lost'   ? 'bg-red-400/30 text-red-300' :
                                                'bg-green-400/30 text-green-300'
                                            }`}>
                                                {p.status === 'won' ? '🏆 فوز' : p.status === 'lost' ? '💀 خسارة' : '🚪 خرج'}
                                            </span>
                                            <span className="text-[10px] text-white/40 font-bold">رهان: {p.bet.toLocaleString('ar')}</span>
                                            <span className={`text-[10px] font-black ${earned > 0 ? 'text-green-400' : lost > 0 ? 'text-red-400' : 'text-white/40'}`}>
                                                {earned > 0 ? `+${earned.toLocaleString('ar')}` : lost > 0 ? `-${lost.toLocaleString('ar')}` : '±0'}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`text-xs font-black px-2 py-1 rounded-lg bg-gradient-to-r ${tier.color} text-white`}>
                                        {tier.emoji} {tier.label}
                                    </span>
                                </div>
                                {/* Progress */}
                                <div className="mt-2 flex gap-0.5">
                                    {Array.from({ length: TOTAL_STEPS }).map((_, si) => (
                                        <div key={si} className={`flex-1 h-1.5 rounded-full ${
                                            si < p.currentStep ? 'bg-green-400' :
                                            si === p.currentStep && p.status === 'lost' ? 'bg-red-400' :
                                            'bg-white/10'
                                        }`}/>
                                    ))}
                                </div>
                                <p className="text-[10px] text-white/30 mt-1 text-left">وصل للسؤال {p.currentStep}/{TOTAL_STEPS}</p>
                            </div>
                        );
                    })}
                </div>

                <button onClick={onExit}
                    className="w-full py-3.5 rounded-2xl font-black text-gray-900 shadow-xl hover:scale-105 active:scale-95 transition-all"
                    style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)' }}>
                    العودة للصالة
                </button>
            </div>
        );
    }

    return null;
}
