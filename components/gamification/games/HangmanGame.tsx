import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Trophy, Users, Heart, Skull } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROUND_SECS = 120;

// ─── Difficulty Levels ────────────────────────────────────────────────────────
const DIFFICULTIES = [
    { key: 'easy',   label: 'سهل',   maxWrong: 6, emoji: '🟢', color: 'from-emerald-500 to-green-600',   border: 'border-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    { key: 'medium', label: 'متوسط', maxWrong: 5, emoji: '🟡', color: 'from-amber-500 to-yellow-500',    border: 'border-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700'   },
    { key: 'hard',   label: 'صعب',   maxWrong: 4, emoji: '🔴', color: 'from-rose-500 to-red-600',        border: 'border-rose-400',    bg: 'bg-rose-50',    text: 'text-rose-700'    },
];

// ─── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = [
    { key: 'celebrities', label: 'مشاهير مصريين', emoji: '⭐', color: 'from-yellow-500 to-amber-600'    },
    { key: 'movies',      label: 'أفلام مصرية',    emoji: '🎬', color: 'from-rose-500 to-pink-600'      },
    { key: 'series',      label: 'مسلسلات مصرية',  emoji: '📺', color: 'from-purple-500 to-violet-600'  },
    { key: 'novels',      label: 'روايات',          emoji: '📚', color: 'from-blue-500 to-indigo-600'    },
    { key: 'countries',   label: 'بلاد',            emoji: '🌍', color: 'from-green-500 to-emerald-600'  },
    { key: 'food',        label: 'أكلات',           emoji: '🍽️', color: 'from-orange-500 to-amber-500'  },
];

// ─── Word Bank ────────────────────────────────────────────────────────────────
const WORD_BANK: Record<string, string[]> = {
    celebrities: [
        'عادل إمام', 'عمرو دياب', 'محمد صلاح', 'أحمد زكي', 'أم كلثوم',
        'عبد الحليم حافظ', 'مجدي يعقوب', 'أحمد زويل', 'نجيب محفوظ', 'طه حسين',
        'محمود المليجي', 'يحيى الفخراني', 'سعاد حسني', 'فاتن حمامة', 'شادية',
        'نادية لطفي', 'عمر الشريف', 'فريد شوقي', 'إسماعيل ياسين', 'رشدي أباظة',
        'حسن يوسف', 'أحمد مظهر', 'كمال الشناوي', 'عبد المنعم مدبولي', 'فؤاد المهندس',
        'محمد عبد الوهاب', 'مصطفى محمود', 'أحمد شوقي', 'توفيق الحكيم', 'يوسف إدريس',
        'سميرة موسى', 'فاروق الباز', 'محمد البرادعي', 'علي مشرفة', 'يوسف شاهين',
        'سيد درويش', 'محمود مختار', 'هدى شعراوي', 'نوال السعداوي', 'سمير غانم',
        'أحمد حلمي', 'تامر حسني', 'محمد منير', 'هاني شاكر', 'علاء ولي الدين',
        'أشرف عبد الباقي', 'كريم عبد العزيز', 'أحمد السقا', 'منى زكي', 'يسرا',
        'أحمد عز', 'مي عز الدين', 'دنيا سمير غانم', 'حسن الرداد', 'إيمي سمير غانم'
    ],

    movies: [
        'الإرهابي', 'العفاريت', 'عمارة يعقوبيان', 'الجزيرة', 'الممر',
        'الفيل الأزرق', 'الكيف', 'صعيدي في الجامعة', 'همام في أمستردام', 'الناظر',
        'عبود على الحدود', 'مافيا', 'تيتو', 'ملاكي إسكندرية', 'ولاد العم',
        'إبراهيم الأبيض', 'المصلحة', 'الخلية', 'كازابلانكا', 'هروب اضطراري',
        'نادي الرجال السري', 'ولاد رزق', 'الفلوس', 'الكنز', 'حرب كرموز',
        'تراب الماس', 'كيرة والجن', 'العارف', 'موسى', 'الإنس والنمس',
        'وقفة رجالة', 'ديدو', 'الغسالة', 'الصندوق الأسود', 'صاحب المقام',
        'توأم روحي', 'لص بغداد', 'خيال مآتة', 'سبع البرمبة', 'اللمبي',
        'بوحة', 'عوكل', 'كباريه', 'السفارة في العمارة', 'حسن ومرقص',
        'عمر وسلمى', 'زهايمر', 'طير إنتا', 'رسالة إلى الوالي', 'أسرار البنات',
        'واحد صحيح', 'حين ميسرة', 'هي فوضى'
    ],

    series: [
        'رأفت الهجان', 'ليالي الحلمية', 'الاختيار', 'الجماعة', 'زيزينيا',
        'المال والبنون', 'ذئاب الجبل', 'يتربى في عزو', 'الضوء الشارد', 'أرابيسك',
        'الشهد والدموع', 'غوايش', 'بوابة الحلواني', 'رحلة السيد أبو العلا', 'العائلة',
        'نصف ربيع الآخر', 'الوتد', 'خالتي صفية والدير', 'أم كلثوم', 'أوان الورد',
        'عائلة الحاج متولي', 'يوميات مدير عام', 'العيان', 'حديث الصباح والمساء',
        'أميرة في عابدين', 'الليل وآخره', 'أسمهان', 'الملك فاروق', 'أهل كايرو',
        'عايزة أتجوز', 'نيران صديقة', 'دوران شبرا', 'المواطن إكس', 'رقم مجهول',
        'طرف ثالث', 'السبع وصايا', 'سجن النسا', 'طريقي', 'جراند أوتيل',
        'أفراح القبة', 'الأسطورة', 'كلبش', 'لا تطفئ الشمس', 'قضية رأي عام',
        'حضرة المتهم أبي', 'الراية البيضا', 'أبو العروسة', 'هجمة مرتدة', 'الكبير',
        'جعفر العمدة', 'تحت الوصاية', 'الاختيار 2'
    ],

    novels: [
        'ثلاثية القاهرة', 'أولاد حارتنا', 'الحرافيش', 'بين القصرين', 'قصر الشوق',
        'السكرية', 'زقاق المدق', 'اللص والكلاب', 'خان الخليلي', 'ميرامار',
        'الكرنك', 'أفراح القبة', 'يوميات نائب في الأرياف', 'دعاء الكروان', 'البوسطجي',
        'رد قلبي', 'لا أنام', 'في بيتنا رجل', 'شيء في صدري', 'لا تطفئ الشمس',
        'الباب المفتوح', 'الأرض', 'الحرام', 'النداهة', 'عزازيل',
        'يوتوبيا', 'الفيل الأزرق', 'تراب الماس', 'شيكاغو', 'عمارة يعقوبيان',
        'البؤساء', 'الجريمة والعقاب', 'مائة عام من العزلة', 'الخيميائي', 'دون كيشوت',
        'شيفرة دا فينشي', 'مزرعة الحيوان', 'غاتسبي العظيم', 'مدام بوفاري', 'الغريب',
        'المسخ', 'الطاعون', 'العمى', 'آنا كارنينا', 'الحرب والسلام',
        'العجوز والبحر', 'ذهب مع الريح', 'فرانكشتاين', 'دراكولا', 'موبي ديك',
        'رجال في الشمس', 'موسم الهجرة إلى الشمال'
    ],

    countries: [
        'مصر', 'السعودية', 'الإمارات', 'الكويت', 'البحرين',
        'عمان', 'قطر', 'اليمن', 'العراق', 'سوريا',
        'الجزائر', 'تونس', 'المغرب', 'ليبيا', 'السودان',
        'فلسطين', 'الأردن', 'لبنان', 'تركيا', 'إيران',
        'الهند', 'الصين', 'اليابان', 'البرازيل', 'الأرجنتين',
        'إسبانيا', 'إيطاليا', 'ألمانيا', 'فرنسا', 'أستراليا',
        'إثيوبيا', 'نيجيريا', 'إندونيسيا', 'باكستان', 'روسيا',
        'كندا', 'أمريكا', 'المكسيك', 'البرتغال', 'هولندا',
        'بلجيكا', 'السويد', 'النرويج', 'فنلندا', 'اليونان',
        'بريطانيا', 'أوكرانيا', 'أفغانستان', 'ماليزيا', 'كوريا',
        'جنوب أفريقيا', 'سويسرا', 'النمسا'
    ],

    food: [
        'كشري', 'ملوخية', 'محشي', 'فتة', 'فول',
        'طعمية', 'حمام محشي', 'ممبار', 'كبدة اسكندراني', 'سجق',
        'بط', 'فسيخ', 'رنجة', 'بصارة', 'عدس',
        'عيش بلدي', 'عيش فينو', 'حواوشي', 'رقاق', 'بامية',
        'مسقعة', 'بطاطس محمرة', 'بطاطس صينية', 'كوارع', 'مخ',
        'لسان عصفور', 'شوربة فراخ', 'سمك مقلي', 'سمك مشوي', 'جمبري',
        'أرز بلبن', 'مهلبية', 'أم علي', 'كنافة', 'قطايف',
        'بسبوسة', 'هريسة', 'زلابية', 'بلح الشام', 'دوم'
    ],
};

// ─── Arabic Keyboard ──────────────────────────────────────────────────────────
const AR_LETTERS = [
    'ا', 'أ', 'إ', 'آ', 'ء', 'ب', 'ت', 'ث', 'ج', 'ح',
    'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط',
    'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه',
    'و', 'ي', 'ة', 'ى', 'ئ', 'ؤ',
];

// ─── Normalize Arabic ─────────────────────────────────────────────────────────
function normalizeChar(ch: string): string {
    if ('أإآءئؤا'.includes(ch)) return 'ا';
    if (ch === 'ة') return 'ه';
    if (ch === 'ى') return 'ي';
    return ch;
}

function wordContains(word: string, letter: string): boolean {
    const norm = normalizeChar(letter);
    return word.split('').some(ch => normalizeChar(ch) === norm);
}

function isLetterRevealed(ch: string, guessed: string[]): boolean {
    const norm = normalizeChar(ch);
    return guessed.some(g => normalizeChar(g) === norm);
}

function isWordSolved(word: string, guessed: string[]): boolean {
    return word.split('').filter(c => c !== ' ').every(ch => isLetterRevealed(ch, guessed));
}

function pickWord(cat: string): string {
    const pool = WORD_BANK[cat] ?? WORD_BANK.food;
    return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlayerState {
    id:         string;
    name:       string;
    guessed:    string[];
    wrong:      number;
    solved:     boolean;
    solvedAt:   number | null;
    eliminated: boolean;
}

interface HangmanGS {
    word:       string;
    category:   string;
    difficulty: string;
    maxWrong:   number;
    players:    PlayerState[];
    startedAt:  number;
    winnerId:   string | null;
}

interface Props {
    match: any;
    employee: Employee;
    onExit: () => void;
    grantPoints: (pts: number) => Promise<void>;
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
                    g.gain.setValueAtTime(0.2, t);
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                    o.start(t); o.stop(t + 0.15);
                });
            }
            if (type === 'wrong') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sawtooth'; o.frequency.value = 180;
                g.gain.setValueAtTime(0.2, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                o.start(now); o.stop(now + 0.18);
            }
            if (type === 'win') {
                [523, 659, 784, 1047].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'triangle'; o.frequency.value = f;
                    const t = now + i * 0.12;
                    g.gain.setValueAtTime(0.25, t);
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
                    o.start(t); o.stop(t + 0.3);
                });
            }
            if (type === 'lose') {
                [330, 220].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'sine'; o.frequency.value = f;
                    const t = now + i * 0.22;
                    g.gain.setValueAtTime(0.2, t);
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                    o.start(t); o.stop(t + 0.25);
                });
            }
            if (type === 'tick') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.value = 880;
                g.gain.setValueAtTime(0.08, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                o.start(now); o.stop(now + 0.06);
            }
        } catch (_) {}
    }, []);
}

// ─── Hangman SVG ──────────────────────────────────────────────────────────────
function HangmanSVG({ wrong, maxWrong }: { wrong: number; maxWrong: number }) {
    const pct   = wrong / maxWrong;
    // حساب كم جزء يظهر من أصل 6 أجزاء حسب نسبة الأخطاء
    const parts = Math.round(pct * 6);
    const color = pct >= 1 ? '#ef4444' : pct >= 0.6 ? '#f97316' : '#6366f1';

    return (
        <svg viewBox="0 0 100 110" className="w-full h-full" strokeLinecap="round" strokeLinejoin="round">
            {/* الهيكل ثابت دائماً */}
            <line x1="10" y1="105" x2="90" y2="105" stroke="#94a3b8" strokeWidth="3"/>
            <line x1="25" y1="105" x2="25" y2="10"  stroke="#94a3b8" strokeWidth="3"/>
            <line x1="25" y1="10"  x2="60" y2="10"  stroke="#94a3b8" strokeWidth="3"/>
            <line x1="60" y1="10"  x2="60" y2="22"  stroke="#94a3b8" strokeWidth="3"/>
            {/* الأجزاء تظهر تدريجياً */}
            {parts >= 1 && <circle cx="60" cy="30" r="8" stroke={color} strokeWidth="2.5" fill="none"/>}
            {parts >= 2 && <line x1="60" y1="38" x2="60" y2="65" stroke={color} strokeWidth="2.5"/>}
            {parts >= 3 && <line x1="60" y1="45" x2="45" y2="57" stroke={color} strokeWidth="2.5"/>}
            {parts >= 4 && <line x1="60" y1="45" x2="75" y2="57" stroke={color} strokeWidth="2.5"/>}
            {parts >= 5 && <line x1="60" y1="65" x2="45" y2="80" stroke={color} strokeWidth="2.5"/>}
            {parts >= 6 && <line x1="60" y1="65" x2="75" y2="80" stroke={color} strokeWidth="2.5"/>}
            {/* وجه حزين عند الخسارة */}
            {pct >= 1 && (
                <>
                    <line x1="56" y1="27" x2="58" y2="29" stroke={color} strokeWidth="1.5"/>
                    <line x1="58" y1="27" x2="56" y2="29" stroke={color} strokeWidth="1.5"/>
                    <line x1="62" y1="27" x2="64" y2="29" stroke={color} strokeWidth="1.5"/>
                    <line x1="64" y1="27" x2="62" y2="29" stroke={color} strokeWidth="1.5"/>
                    <path d="M56 35 Q60 31 64 35" stroke={color} strokeWidth="1.5" fill="none"/>
                </>
            )}
            {/* وجه مبتسم قبل الخسارة */}
            {parts >= 1 && pct < 1 && (
                <path d="M56 33 Q60 37 64 33" stroke={color} strokeWidth="1.5" fill="none"/>
            )}
        </svg>
    );
}

// ─── Word Display ─────────────────────────────────────────────────────────────
function WordDisplay({ word, guessed, solved, eliminated }: {
    word: string; guessed: string[]; solved: boolean; eliminated: boolean;
}) {
    return (
        <div className="flex gap-2 flex-wrap justify-center py-1" dir="rtl">
            {word.split('').map((ch, i) => {
                if (ch === ' ') return <div key={i} className="w-5"/>;
                const revealed = solved || eliminated || isLetterRevealed(ch, guessed);
                return (
                    <div key={i} className="flex flex-col items-center gap-0.5">
                        <span className={`text-xl font-black min-w-[1.6rem] text-center transition-all duration-300 ${
                            revealed
                                ? solved      ? 'text-emerald-600'
                                : eliminated  ? 'text-red-500'
                                              : 'text-gray-800'
                                : 'text-transparent select-none'
                        }`}>
                            {revealed ? ch : 'ـ'}
                        </span>
                        <div className={`h-[3px] w-6 rounded-full transition-all ${
                            revealed
                                ? solved      ? 'bg-emerald-400'
                                : eliminated  ? 'bg-red-300'
                                              : 'bg-indigo-400'
                                : 'bg-gray-300'
                        }`}/>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Lives Bar ────────────────────────────────────────────────────────────────
function LivesBar({ wrong, maxWrong }: { wrong: number; maxWrong: number }) {
    return (
        <div className="flex gap-1 justify-center">
            {Array.from({ length: maxWrong }).map((_, i) => (
                <Heart
                    key={i}
                    className={`w-5 h-5 transition-all duration-300 ${
                        i < maxWrong - wrong
                            ? 'text-red-500 fill-red-500'
                            : 'text-gray-200 fill-gray-200'
                    }`}
                />
            ))}
        </div>
    );
}

// ─── Player Row ───────────────────────────────────────────────────────────────
function PlayerRow({ ps, isMe, rank, maxWrong }: {
    ps: PlayerState; isMe: boolean; rank: number; maxWrong: number;
}) {
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
            isMe          ? 'border-indigo-300 bg-indigo-50'  :
            ps.solved     ? 'border-emerald-200 bg-emerald-50' :
            ps.eliminated ? 'border-red-100 bg-red-50/50 opacity-60' :
                            'border-gray-100 bg-white'
        }`}>
            <span className="text-base w-6 text-center flex-shrink-0">
                {medal ?? `#${rank}`}
            </span>
            <p className={`text-xs font-black flex-1 truncate ${isMe ? 'text-indigo-700' : 'text-gray-700'}`}>
                {ps.name}{isMe && ' (أنت)'}
            </p>
            {ps.solved && (
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                    ✓ حلّها!
                </span>
            )}
            {ps.eliminated && !ps.solved && (
                <span className="text-[10px] font-black text-red-500 bg-red-100 px-2 py-0.5 rounded-full">
                    💀 خرج
                </span>
            )}
            {!ps.solved && !ps.eliminated && (
                <div className="flex gap-0.5">
                    {Array.from({ length: maxWrong }).map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full ${
                            i < maxWrong - ps.wrong ? 'bg-red-400' : 'bg-gray-200'
                        }`}/>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HangmanGame({ match, employee, onExit, grantPoints }: Props) {
    const play   = useSound();
    const myId   = employee.employee_id;
    const isHost = match.players?.[0]?.id === myId;

    const gs: HangmanGS          = match.game_state ?? {};
    const word: string            = gs.word ?? '';
    const players: PlayerState[]  = gs.players ?? [];
    const status: string          = match.status ?? 'waiting';
    const gsMaxWrong: number      = gs.maxWrong ?? 6;

    const myPS         = players.find(p => p.id === myId);
    const myGuessed    = myPS?.guessed    ?? [];
    const myWrong      = myPS?.wrong      ?? 0;
    const mySolved     = myPS?.solved     ?? false;
    const myEliminated = myPS?.eliminated ?? false;

    // Host settings
    const [selectedCat,  setSelectedCat]  = useState('celebrities');
    const [selectedDiff, setSelectedDiff] = useState('easy');
    const [timeLeft, setTimeLeft]         = useState(ROUND_SECS);
    const prevTickRef   = useRef(ROUND_SECS);
    const resultDoneRef = useRef(false);

    const diffInfo = DIFFICULTIES.find(d => d.key === gs.difficulty) ?? DIFFICULTIES[0];
    const catInfo  = CATEGORIES.find(c => c.key === gs.category);

    // ── Timer ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'playing' || !gs.startedAt) return;
        const tick = () => {
            const left = Math.max(0, ROUND_SECS - Math.floor((Date.now() - gs.startedAt) / 1000));
            setTimeLeft(left);
            if ([30, 20, 10, 5, 4, 3, 2, 1].includes(left) && left !== prevTickRef.current) {
                prevTickRef.current = left;
                play('tick');
            }
            if (left === 0 && isHost && status === 'playing') finishGame(null);
        };
        tick();
        const iv = setInterval(tick, 500);
        return () => clearInterval(iv);
    }, [status, gs.startedAt]);

    // ── Grant points on finish ────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'finished' || resultDoneRef.current) return;
        resultDoneRef.current = true;
        if (gs.winnerId === myId) { play('win'); grantPoints(15); }
        else if (mySolved)        { play('win'); grantPoints(5);  }
        else                        play('lose');
    }, [status]);

    // ── Guess ─────────────────────────────────────────────────────────────────
    const handleGuess = async (letter: string) => {
        if (mySolved || myEliminated || status !== 'playing') return;
        if (myGuessed.some(g => normalizeChar(g) === normalizeChar(letter))) return;

        const inWord     = wordContains(word, letter);
        const newGuessed = [...myGuessed, letter];
        const newWrong   = inWord ? myWrong : myWrong + 1;
        play(inWord ? 'correct' : 'wrong');

        const solved     = isWordSolved(word, newGuessed);
        const eliminated = newWrong >= gsMaxWrong;

        const updatedPlayers = players.map(p =>
            p.id === myId
                ? { ...p, guessed: newGuessed, wrong: newWrong, solved, eliminated,
                    solvedAt: solved ? Date.now() : p.solvedAt }
                : p
        );

        const firstSolver = solved && !gs.winnerId;
        const winnerId    = firstSolver ? myId : gs.winnerId;
        const allDone     = updatedPlayers.every(p => p.solved || p.eliminated);

        await supabase.from('live_matches').update({
            game_state: { ...gs, players: updatedPlayers, winnerId },
            status:     firstSolver || allDone ? 'finished' : 'playing',
            winner_id:  winnerId,
        }).eq('id', match.id);
    };

    const finishGame = async (forceWinner: string | null) => {
        if (status === 'finished') return;
        const solvers = players
            .filter(p => p.solved)
            .sort((a, b) => (a.solvedAt ?? 0) - (b.solvedAt ?? 0));
        const winner = forceWinner ?? solvers[0]?.id ?? null;
        await supabase.from('live_matches').update({
            status: 'finished',
            winner_id: winner,
            game_state: { ...gs, winnerId: winner },
        }).eq('id', match.id);
    };

    // ── Start ─────────────────────────────────────────────────────────────────
    const handleStart = async () => {
        const word        = pickWord(selectedCat);
        const catLabel    = CATEGORIES.find(c => c.key === selectedCat)?.label ?? selectedCat;
        const diff        = DIFFICULTIES.find(d => d.key === selectedDiff) ?? DIFFICULTIES[0];
        const matchPlayers: PlayerState[] = match.players.map((p: any) => ({
            id: p.id, name: p.name,
            guessed: [], wrong: 0,
            solved: false, eliminated: false, solvedAt: null,
        }));
        await supabase.from('live_matches').update({
            status: 'playing',
            game_state: {
                word,
                category:   catLabel,
                difficulty: diff.key,
                maxWrong:   diff.maxWrong,
                players:    matchPlayers,
                startedAt:  Date.now(),
                winnerId:   null,
            },
        }).eq('id', match.id);
    };

    const sortedPlayers = [...players].sort((a, b) => {
        if (a.solved && !b.solved) return -1;
        if (!a.solved && b.solved) return 1;
        if (a.solved && b.solved)  return (a.solvedAt ?? 0) - (b.solvedAt ?? 0);
        return a.wrong - b.wrong;
    });

    const amIWinner  = match.winner_id === myId;
    const timerPct   = timeLeft / ROUND_SECS;
    const timerColor = timerPct < 0.2 ? '#ef4444' : timerPct < 0.4 ? '#f97316' : '#22c55e';

    // ─────────────────────────────────────────────────────────────────────────
    // WAITING
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className="py-5 px-4 flex flex-col gap-4" dir="rtl">

            {/* Header */}
            <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-rose-500 to-pink-700 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-2xl text-4xl">
                    🪢
                </div>
                <h3 className="text-xl font-black text-gray-800 mb-1">المشنقة!</h3>
                <p className="text-sm font-bold text-gray-400">
                    {match.players?.length ?? 0} لاعب في الغرفة
                </p>
            </div>

            {/* Players */}
            <div className="flex flex-wrap gap-2 justify-center">
                {match.players?.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-full">
                        <span className="text-xs font-bold text-rose-700">{p.name}</span>
                        {p.id === myId && <span className="text-[10px] text-rose-400">(أنت)</span>}
                    </div>
                ))}
            </div>

            {isHost ? (
                <>
                    {/* Category Selection */}
                    <div>
                        <p className="text-xs font-black text-gray-600 mb-2 text-center">اختر الفئة:</p>
                        <div className="grid grid-cols-2 gap-2">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat.key}
                                    onClick={() => setSelectedCat(cat.key)}
                                    className={`flex items-center gap-2.5 px-3 py-3 rounded-2xl border-2 font-black text-sm transition-all ${
                                        selectedCat === cat.key
                                            ? `bg-gradient-to-r ${cat.color} text-white border-transparent shadow-lg scale-105`
                                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    <span className="text-xl">{cat.emoji}</span>
                                    <span className="flex-1 text-right">{cat.label}</span>
                                    {selectedCat === cat.key && <span className="text-xs opacity-80">✓</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Difficulty Selection */}
                    <div>
                        <p className="text-xs font-black text-gray-600 mb-2 text-center">اختر الصعوبة:</p>
                        <div className="grid grid-cols-3 gap-2">
                            {DIFFICULTIES.map(diff => (
                                <button
                                    key={diff.key}
                                    onClick={() => setSelectedDiff(diff.key)}
                                    className={`flex flex-col items-center gap-1 py-3 px-2 rounded-2xl border-2 font-black text-sm transition-all ${
                                        selectedDiff === diff.key
                                            ? `bg-gradient-to-br ${diff.color} text-white border-transparent shadow-lg scale-105`
                                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                    }`}
                                >
                                    <span className="text-xl">{diff.emoji}</span>
                                    <span className="text-xs font-black">{diff.label}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                        selectedDiff === diff.key
                                            ? 'bg-white/25 text-white'
                                            : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        {diff.maxWrong} محاولات
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleStart}
                        disabled={match.players?.length < 2}
                        className="w-full bg-gradient-to-r from-rose-500 to-pink-700 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        🎮 ابدأ اللعبة
                    </button>

                    {match.players?.length < 2 && (
                        <p className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl text-center">
                            ⏳ في انتظار لاعب آخر للانضمام...
                        </p>
                    )}
                </>
            ) : (
                <div className="flex items-center gap-2 justify-center text-sm font-bold text-gray-400 py-6 bg-gray-50 rounded-2xl">
                    <Loader2 className="w-4 h-4 animate-spin"/> في انتظار المضيف ليختار الإعدادات...
                </div>
            )}

            <button onClick={onExit} className="text-sm font-bold text-gray-400 hover:text-gray-600 text-center">
                ← العودة
            </button>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // PLAYING
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'playing') return (
        <div className="flex flex-col gap-3 py-2 px-3" dir="rtl">

            {/* Header: Category + Difficulty + Timer */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                    {/* Category badge */}
                    <span className="text-[10px] font-black bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                        {catInfo?.emoji} {gs.category}
                    </span>
                    {/* Difficulty badge */}
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${diffInfo.bg} ${diffInfo.text}`}>
                        {diffInfo.emoji} {diffInfo.label}
                    </span>
                    {/* Letter count */}
                    <span className="text-[10px] font-bold text-gray-400">
                        {word.replace(/ /g, '').length} حرف
                    </span>
                </div>

                {/* Timer ring */}
                <div className="relative w-14 h-14 flex-shrink-0">
                    <svg width={56} height={56} viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx={28} cy={28} r={24} fill="none" stroke="#e5e7eb" strokeWidth={4}/>
                        <circle cx={28} cy={28} r={24} fill="none"
                            stroke={timerColor} strokeWidth={4}
                            strokeDasharray={2 * Math.PI * 24}
                            strokeDashoffset={2 * Math.PI * 24 * (1 - timerPct)}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.4s' }}
                        />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-gray-700">
                        {timeLeft < 60 ? timeLeft : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
                    </span>
                </div>
            </div>

            {/* Game Area */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                <div className="flex items-start gap-3">
                    {/* Hangman SVG */}
                    <div className="w-24 h-24 flex-shrink-0">
                        <HangmanSVG wrong={myWrong} maxWrong={gsMaxWrong}/>
                    </div>
                    {/* Word + Lives */}
                    <div className="flex-1 flex flex-col gap-3 pt-1 min-w-0">
                        <WordDisplay
                            word={word}
                            guessed={myGuessed}
                            solved={mySolved}
                            eliminated={myEliminated}
                        />
                        <LivesBar wrong={myWrong} maxWrong={gsMaxWrong}/>
                        {mySolved && (
                            <div className="text-center text-xs font-black text-emerald-600 bg-emerald-50 rounded-xl py-1.5 animate-bounce">
                                🎉 أحسنت! حللتها!
                            </div>
                        )}
                        {myEliminated && !mySolved && (
                            <div className="text-center text-xs font-black text-red-500 bg-red-50 rounded-xl py-1.5">
                                💀 الكلمة: <span className="font-black">{word}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Other players */}
            {players.length > 1 && (
                <div className="space-y-1.5">
                    <p className="text-[11px] font-black text-gray-400 px-1">اللاعبون:</p>
                    {sortedPlayers.map((ps, i) => (
                        <PlayerRow
                            key={ps.id} ps={ps}
                            isMe={ps.id === myId}
                            rank={i + 1}
                            maxWrong={gsMaxWrong}
                        />
                    ))}
                </div>
            )}

            {/* Keyboard */}
            {!mySolved && !myEliminated && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                    <p className="text-[10px] font-black text-gray-400 mb-2 text-center">اختر حرفاً:</p>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                        {AR_LETTERS.map(letter => {
                            const used    = myGuessed.some(g => normalizeChar(g) === normalizeChar(letter));
                            const correct = used && wordContains(word, letter);
                            const wrong   = used && !wordContains(word, letter);
                            return (
                                <button
                                    key={letter}
                                    onClick={() => handleGuess(letter)}
                                    disabled={used}
                                    className={`w-9 h-9 rounded-xl font-black text-sm transition-all border-2 active:scale-95 ${
                                        correct ? 'bg-emerald-100 border-emerald-300 text-emerald-700 cursor-not-allowed' :
                                        wrong   ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed' :
                                                  'bg-white border-gray-200 text-gray-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 shadow-sm'
                                    }`}
                                >
                                    {letter}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {mySolved && (
                <div className="text-center bg-emerald-50 border-2 border-emerald-200 rounded-2xl py-4 px-3">
                    <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-1"/>
                    <p className="text-sm font-black text-emerald-800">حللتها! في انتظار باقي اللاعبين...</p>
                </div>
            )}

            <button onClick={onExit} className="text-xs font-bold text-gray-400 hover:text-gray-600 py-1 text-center">
                ← العودة
            </button>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // FINISHED
    // ─────────────────────────────────────────────────────────────────────────
    if (status === 'finished') return (
        <div className="flex flex-col gap-3 py-2 px-3 animate-in fade-in duration-400" dir="rtl">

            {/* Result banner */}
            <div className={`rounded-2xl p-5 text-center text-white shadow-xl ${
                amIWinner ? 'bg-gradient-to-br from-yellow-400 to-amber-500' :
                mySolved  ? 'bg-gradient-to-br from-emerald-500 to-green-600' :
                            'bg-gradient-to-br from-gray-500 to-gray-700'
            }`}>
                {amIWinner ? (
                    <>
                        <Trophy className="w-14 h-14 mx-auto mb-2 drop-shadow-xl animate-bounce"/>
                        <h3 className="text-2xl font-black">🎉 أنت الأسرع!</h3>
                        <p className="text-amber-100 text-sm mt-1">+15 نقطة 🏆</p>
                    </>
                ) : mySolved ? (
                    <>
                        <div className="text-5xl mb-2">🌟</div>
                        <h3 className="text-2xl font-black">أحسنت!</h3>
                        <p className="text-green-100 text-sm mt-1">+5 نقاط</p>
                    </>
                ) : (
                    <>
                        <Skull className="w-14 h-14 mx-auto mb-2 opacity-70"/>
                        <h3 className="text-2xl font-black">لم تكملها</h3>
                        <p className="text-gray-300 text-sm mt-1">
                            الكلمة كانت: <span className="text-white font-black">{word}</span>
                        </p>
                    </>
                )}
            </div>

            {/* Word reveal */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-xs font-black text-gray-400 mb-2">الكلمة الصحيحة</p>
                <p className="text-2xl font-black text-gray-800">{word}</p>
                <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400 font-bold">{gs.category}</span>
                    <span className="text-gray-300">•</span>
                    <span className={`text-[10px] font-black ${diffInfo.text}`}>
                        {diffInfo.emoji} {diffInfo.label}
                    </span>
                </div>
            </div>

            {/* Rankings */}
            <div className="space-y-1.5">
                <p className="text-xs font-black text-gray-500 px-1">الترتيب النهائي:</p>
                {sortedPlayers.map((ps, i) => (
                    <PlayerRow
                        key={ps.id} ps={ps}
                        isMe={ps.id === myId}
                        rank={i + 1}
                        maxWrong={gsMaxWrong}
                    />
                ))}
            </div>

            <button
                onClick={onExit}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-700 text-white py-3.5 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
                <Users className="w-5 h-5"/> العودة إلى الصالة
            </button>
        </div>
    );

    return null;
}
