import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import {
    Loader2, Trophy, Users, Heart, Skull,
    CheckCircle, XCircle, MinusCircle, Crown, Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROUND_SECS  = 120;
const MAX_PLAYERS = 10;

// ─── Difficulty Levels ────────────────────────────────────────────────────────
const DIFFICULTIES = [
    { key: 'easy',   label: 'سهل',   maxWrong: 6, emoji: '🟢',
      color: 'from-emerald-500 to-green-600',  bg: 'bg-emerald-50', text: 'text-emerald-700' },
    { key: 'medium', label: 'متوسط', maxWrong: 5, emoji: '🟡',
      color: 'from-amber-500 to-yellow-500',   bg: 'bg-amber-50',   text: 'text-amber-700'   },
    { key: 'hard',   label: 'صعب',   maxWrong: 4, emoji: '🔴',
      color: 'from-rose-500 to-red-600',       bg: 'bg-rose-50',    text: 'text-rose-700'    },
];

// ─── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = [
    { key: 'celebrities', label: 'مشاهير مصريين', emoji: '⭐', color: 'from-yellow-500 to-amber-600'   },
    { key: 'movies',      label: 'أفلام مصرية',   emoji: '🎬', color: 'from-rose-500 to-pink-600'     },
    { key: 'series',      label: 'مسلسلات مصرية', emoji: '📺', color: 'from-purple-500 to-violet-600' },
    { key: 'novels',      label: 'روايات',         emoji: '📚', color: 'from-blue-500 to-indigo-600'   },
    { key: 'countries',   label: 'بلاد',           emoji: '🌍', color: 'from-green-500 to-emerald-600' },
    { key: 'food',        label: 'أكلات',          emoji: '🍽️', color: 'from-orange-500 to-amber-500' },
];

// ─── Word Bank ────────────────────────────────────────────────────────────────
const WORD_BANK: Record<string, string[]> = {
    celebrities: [
        'عادل إمام','عمرو دياب','محمد صلاح','أحمد زكي','أم كلثوم',
        'عبد الحليم حافظ','مجدي يعقوب','أحمد زويل','نجيب محفوظ','طه حسين',
        'محمود المليجي','يحيى الفخراني','سعاد حسني','فاتن حمامة','شادية',
        'نادية لطفي','عمر الشريف','فريد شوقي','إسماعيل ياسين','رشدي أباظة',
        'حسن يوسف','أحمد مظهر','كمال الشناوي','عبد المنعم مدبولي','فؤاد المهندس',
        'محمد عبد الوهاب','مصطفى محمود','أحمد شوقي','توفيق الحكيم','يوسف إدريس',
        'سميرة موسى','فاروق الباز','محمد البرادعي','علي مشرفة','يوسف شاهين',
        'سيد درويش','محمود مختار','هدى شعراوي','نوال السعداوي','سمير غانم',
        'أحمد حلمي','تامر حسني','محمد منير','هاني شاكر','علاء ولي الدين',
        'أشرف عبد الباقي','كريم عبد العزيز','أحمد السقا','منى زكي','يسرا',
    ],
    movies: [
        'الإرهابي','العفاريت','عمارة يعقوبيان','الجزيرة','الممر',
        'الفيل الأزرق','الكيف','صعيدي في الجامعة','همام في أمستردام','الناظر',
        'عبود على الحدود','مافيا','تيتو','ملاكي إسكندرية','ولاد العم',
        'إبراهيم الأبيض','المصلحة','الخلية','كازابلانكا','هروب اضطراري',
        'نادي الرجال السري','ولاد رزق','الفلوس','الكنز','حرب كرموز',
        'تراب الماس','كيرة والجن','العارف','موسى','الإنس والنمس',
        'وقفة رجالة','ديدو','الغسالة','الصندوق الأسود','صاحب المقام',
        'توأم روحي','لص بغداد','خيال مآتة','سبع البرمبة','اللمبي',
        'بوحة','عوكل','كباريه','السفارة في العمارة','حسن ومرقص',
        'عمر وسلمى','زهايمر','طير إنتا','رسالة إلى الوالي','أسرار البنات',
    ],
    series: [
        'رأفت الهجان','ليالي الحلمية','الاختيار','الجماعة','زيزينيا',
        'المال والبنون','ذئاب الجبل','يتربى في عزو','الضوء الشارد','أرابيسك',
        'الشهد والدموع','غوايش','بوابة الحلواني','رحلة السيد أبو العلا','العائلة',
        'نصف ربيع الآخر','الوتد','خالتي صفية والدير','أم كلثوم','أوان الورد',
        'عائلة الحاج متولي','يوميات مدير عام','العيان','حديث الصباح والمساء',
        'أميرة في عابدين','الليل وآخره','أسمهان','الملك فاروق','أهل كايرو',
        'عايزة أتجوز','نيران صديقة','دوران شبرا','المواطن إكس','رقم مجهول',
        'السبع وصايا','سجن النسا','طريقي','جراند أوتيل','أفراح القبة',
        'الأسطورة','كلبش','لا تطفئ الشمس','قضية رأي عام','حضرة المتهم أبي',
        'الراية البيضا','أبو العروسة','هجمة مرتدة','الكبير','ضل راجل',
    ],
    novels: [
        'ثلاثية القاهرة','أولاد حارتنا','الحرافيش','بين القصرين','قصر الشوق',
        'السكرية','زقاق المدق','اللص والكلاب','خان الخليلي','ميرامار',
        'الكرنك','أفراح القبة','يوميات نائب في الأرياف','دعاء الكروان','البوسطجي',
        'رد قلبي','لا أنام','في بيتنا رجل','شيء في صدري','لا تطفئ الشمس',
        'الباب المفتوح','الأرض','الحرام','النداهة','عزازيل',
        'يوتوبيا','الفيل الأزرق','تراب الماس','شيكاغو','عمارة يعقوبيان',
        'البؤساء','الجريمة والعقاب','مائة عام من العزلة','الخيميائي','دون كيشوت',
        'شيفرة دا فينشي','مزرعة الحيوان','غاتسبي العظيم','مدام بوفاري','الغريب',
        'المسخ','الطاعون','العمى','آنا كارنينا','الحرب والسلام',
        'العجوز والبحر','ذهب مع الريح','فرانكشتاين','دراكولا','موبي ديك',
    ],
    countries: [
        'مصر','السعودية','الإمارات','الكويت','البحرين',
        'عمان','قطر','اليمن','العراق','سوريا',
        'الجزائر','تونس','المغرب','ليبيا','السودان',
        'فلسطين','الأردن','لبنان','تركيا','إيران',
        'الهند','الصين','اليابان','البرازيل','الأرجنتين',
        'إسبانيا','إيطاليا','ألمانيا','فرنسا','أستراليا',
        'إثيوبيا','نيجيريا','إندونيسيا','باكستان','روسيا',
        'كندا','أمريكا','المكسيك','البرتغال','هولندا',
        'بلجيكا','السويد','النرويج','فنلندا','اليونان',
        'بريطانيا','أوكرانيا','أفغانستان','ماليزيا','كوريا',
    ],
    food: [
        'الكنافة','المنسف','الكبسة','الكوشري','الشاورما',
        'الفلافل','الحمص','التبولة','البقلاوة','المهلبية',
        'القطايف','الأرز','العدس','الفول','الزيتون',
        'التمر','الرمان','الشاي','القهوة','الأناناس',
        'الكاكاو','الفستق','اللوز','الأفوكادو','الكنافة',
        'المحشي','الملوخية','الفتة','البسطرمة','الطحينة',
        'الكباب','الكفتة','الحواوشي','الهريسة','البريك',
        'المقلوبة','المجدرة','الأوملت','الإسكالوب','الباجة',
        'الترمس','السمبوسك','البليلة','الشكشوكة','الرقاق',
        'المبطن','الجريش','الهامبرجر','البيتزا','الباستا',
    ],
};

// ─── Arabic Keyboard ──────────────────────────────────────────────────────────
const AR_LETTERS = [
    'ا','أ','إ','آ','ء','ب','ت','ث','ج','ح',
    'خ','د','ذ','ر','ز','س','ش','ص','ض','ط',
    'ظ','ع','غ','ف','ق','ك','ل','م','ن','ه',
    'و','ي','ة','ى','ئ','ؤ',
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
// score per answer: 10 = correct, 5 = partial, 0 = wrong/empty
type AnswerScore = 10 | 5 | 0;

interface PlayerState {
    id:         string;
    name:       string;
    guessed:    string[];
    wrong:      number;
    solved:     boolean;
    solvedAt:   number | null;
    eliminated: boolean;
    // score given by host after game
    totalScore: number;
}

interface HangmanGS {
    word:        string;
    category:    string;
    difficulty:  string;
    maxWrong:    number;
    players:     PlayerState[];
    startedAt:   number;
    winnerId:    string | null;
    // host scoring phase
    scoringDone: boolean;
    // map: playerId -> score (set by host)
    scores:      Record<string, number>;
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
        if (!ctx.current)
            ctx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return ctx.current;
    };
    return useCallback((type: 'correct' | 'wrong' | 'win' | 'lose' | 'tick') => {
        try {
            const ac = get(), now = ac.currentTime;
            if (type === 'correct') {
                [523,659].forEach((f,i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'sine'; o.frequency.value = f;
                    const t = now + i*0.1;
                    g.gain.setValueAtTime(0.2,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.15);
                    o.start(t); o.stop(t+0.15);
                });
            }
            if (type === 'wrong') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sawtooth'; o.frequency.value = 180;
                g.gain.setValueAtTime(0.2,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.18);
                o.start(now); o.stop(now+0.18);
            }
            if (type === 'win') {
                [523,659,784,1047].forEach((f,i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'triangle'; o.frequency.value = f;
                    const t = now + i*0.12;
                    g.gain.setValueAtTime(0.25,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.3);
                    o.start(t); o.stop(t+0.3);
                });
            }
            if (type === 'lose') {
                [330,220].forEach((f,i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'sine'; o.frequency.value = f;
                    const t = now + i*0.22;
                    g.gain.setValueAtTime(0.2,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.25);
                    o.start(t); o.stop(t+0.25);
                });
            }
            if (type === 'tick') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.value = 880;
                g.gain.setValueAtTime(0.08,now); g.gain.exponentialRampToValueAtTime(0.001,now+0.06);
                o.start(now); o.stop(now+0.06);
            }
        } catch(_) {}
    }, []);
}

// ─── Hangman SVG ──────────────────────────────────────────────────────────────
function HangmanSVG({ wrong, maxWrong }: { wrong: number; maxWrong: number }) {
    const pct   = wrong / maxWrong;
    const parts = Math.round(pct * 6);
    const color = pct >= 1 ? '#ef4444' : pct >= 0.6 ? '#f97316' : '#6366f1';
    return (
        <svg viewBox="0 0 100 110" className="w-full h-full" strokeLinecap="round" strokeLinejoin="round">
            <line x1="10" y1="105" x2="90" y2="105" stroke="#94a3b8" strokeWidth="3"/>
            <line x1="25" y1="105" x2="25" y2="10"  stroke="#94a3b8" strokeWidth="3"/>
            <line x1="25" y1="10"  x2="60" y2="10"  stroke="#94a3b8" strokeWidth="3"/>
            <line x1="60" y1="10"  x2="60" y2="22"  stroke="#94a3b8" strokeWidth="3"/>
            {parts >= 1 && <circle cx="60" cy="30" r="8" stroke={color} strokeWidth="2.5" fill="none"/>}
            {parts >= 2 && <line x1="60" y1="38" x2="60" y2="65" stroke={color} strokeWidth="2.5"/>}
            {parts >= 3 && <line x1="60" y1="45" x2="45" y2="57" stroke={color} strokeWidth="2.5"/>}
            {parts >= 4 && <line x1="60" y1="45" x2="75" y2="57" stroke={color} strokeWidth="2.5"/>}
            {parts >= 5 && <line x1="60" y1="65" x2="45" y2="80" stroke={color} strokeWidth="2.5"/>}
            {parts >= 6 && <line x1="60" y1="65" x2="75" y2="80" stroke={color} strokeWidth="2.5"/>}
            {pct >= 1 && (
                <>
                    <line x1="56" y1="27" x2="58" y2="29" stroke={color} strokeWidth="1.5"/>
                    <line x1="58" y1="27" x2="56" y2="29" stroke={color} strokeWidth="1.5"/>
                    <line x1="62" y1="27" x2="64" y2="29" stroke={color} strokeWidth="1.5"/>
                    <line x1="64" y1="27" x2="62" y2="29" stroke={color} strokeWidth="1.5"/>
                    <path d="M56 35 Q60 31 64 35" stroke={color} strokeWidth="1.5" fill="none"/>
                </>
            )}
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
                if (ch === ' ') return <div key={i} className="w-4"/>;
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
                                ? solved     ? 'bg-emerald-400'
                                : eliminated ? 'bg-red-300'
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
        <div className="flex gap-1 justify-center flex-wrap">
            {Array.from({ length: maxWrong }).map((_, i) => (
                <Heart key={i} className={`w-5 h-5 transition-all ${
                    i < maxWrong - wrong ? 'text-red-500 fill-red-500' : 'text-gray-200 fill-gray-200'
                }`}/>
            ))}
        </div>
    );
}

// ─── Results Table ────────────────────────────────────────────────────────────
// يعرض كل حرف خمّنه اللاعب وإذا كان صح أو غلط
function ResultsTable({ players, word, maxWrong, isHost, scores, onScore, scoringDone }: {
    players:     PlayerState[];
    word:        string;
    maxWrong:    number;
    isHost:      boolean;
    scores:      Record<string, number>;
    onScore:     (playerId: string, score: number) => void;
    scoringDone: boolean;
}) {
    // أحرف الكلمة الفريدة (بدون فراغ) للعرض في رأس الجدول
    const uniqueChars = Array.from(
        new Set(word.split('').filter(c => c !== ' '))
    );

    return (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm" dir="rtl">
            <table className="w-full text-xs min-w-max">
                {/* Header */}
                <thead>
                    <tr className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
                        <th className="px-3 py-2.5 text-right font-black rounded-tr-2xl sticky right-0 bg-indigo-600 z-10 min-w-[90px]">
                            اللاعب
                        </th>
                        {uniqueChars.map(ch => (
                            <th key={ch} className="px-2 py-2.5 font-black text-center min-w-[36px]">
                                {ch}
                            </th>
                        ))}
                        <th className="px-3 py-2.5 font-black text-center rounded-tl-2xl min-w-[60px]">
                            حل؟
                        </th>
                        <th className="px-3 py-2.5 font-black text-center min-w-[70px]">
                            أخطاء
                        </th>
                        {isHost && !scoringDone && (
                            <th className="px-3 py-2.5 font-black text-center min-w-[100px]">
                                النقاط
                            </th>
                        )}
                        {scoringDone && (
                            <th className="px-3 py-2.5 font-black text-center min-w-[80px] bg-yellow-500/30">
                                المجموع
                            </th>
                        )}
                    </tr>
                </thead>

                {/* Body */}
                <tbody>
                    {players.map((p, rowIdx) => {
                        const rowBg = rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                        return (
                            <tr key={p.id} className={`${rowBg} border-b border-gray-100`}>
                                {/* Player name */}
                                <td className={`px-3 py-2 font-black text-gray-800 sticky right-0 ${rowBg} z-10 border-l border-gray-100`}>
                                    <div className="flex items-center gap-1">
                                        {p.solved && <span className="text-emerald-500 text-sm">✓</span>}
                                        {p.eliminated && !p.solved && <span className="text-red-400 text-sm">✗</span>}
                                        <span className="truncate max-w-[75px]">{p.name}</span>
                                    </div>
                                </td>

                                {/* Per-letter cells */}
                                {uniqueChars.map(ch => {
                                    const normCh = normalizeChar(ch);
                                    const guessed = p.guessed.some(g => normalizeChar(g) === normCh);
                                    const correct = guessed && wordContains(word, ch);
                                    return (
                                        <td key={ch} className="px-2 py-2 text-center">
                                            {guessed ? (
                                                correct
                                                    ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto"/>
                                                    : <XCircle    className="w-4 h-4 text-red-400 mx-auto"/>
                                            ) : (
                                                <MinusCircle className="w-3.5 h-3.5 text-gray-200 mx-auto"/>
                                            )}
                                        </td>
                                    );
                                })}

                                {/* Solved */}
                                <td className="px-3 py-2 text-center">
                                    {p.solved
                                        ? <span className="bg-emerald-100 text-emerald-700 font-black px-1.5 py-0.5 rounded-full text-[10px]">✓ حل</span>
                                        : p.eliminated
                                            ? <span className="bg-red-100 text-red-500 font-black px-1.5 py-0.5 rounded-full text-[10px]">💀</span>
                                            : <span className="bg-gray-100 text-gray-400 font-bold px-1.5 py-0.5 rounded-full text-[10px]">—</span>
                                    }
                                </td>

                                {/* Wrong count */}
                                <td className="px-3 py-2 text-center">
                                    <span className={`font-black px-2 py-0.5 rounded-full text-[10px] ${
                                        p.wrong === 0     ? 'bg-emerald-100 text-emerald-700' :
                                        p.wrong < maxWrong? 'bg-amber-100 text-amber-700' :
                                                            'bg-red-100 text-red-600'
                                    }`}>
                                        {p.wrong}/{maxWrong}
                                    </span>
                                </td>

                                {/* Host scoring buttons */}
                                {isHost && !scoringDone && (
                                    <td className="px-2 py-1.5 text-center">
                                        <div className="flex gap-1 justify-center">
                                            {([10, 5, 0] as AnswerScore[]).map(pts => (
                                                <button
                                                    key={pts}
                                                    onClick={() => onScore(p.id, pts)}
                                                    className={`w-8 h-7 rounded-lg font-black text-[10px] transition-all border-2 active:scale-90 ${
                                                        scores[p.id] === pts
                                                            ? pts === 10 ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm' :
                                                              pts === 5  ? 'bg-amber-400 border-amber-500 text-white shadow-sm' :
                                                                           'bg-red-400 border-red-500 text-white shadow-sm'
                                                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                                                    }`}
                                                >
                                                    {pts}
                                                </button>
                                            ))}
                                        </div>
                                    </td>
                                )}

                                {/* Final score */}
                                {scoringDone && (
                                    <td className="px-3 py-2 text-center bg-yellow-50">
                                        <span className="font-black text-sm text-amber-700">
                                            {scores[p.id] ?? 0}
                                        </span>
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
    const scoringDone: boolean    = gs.scoringDone ?? false;
    const gsScores                = gs.scores ?? {};

    const myPS         = players.find(p => p.id === myId);
    const myGuessed    = myPS?.guessed    ?? [];
    const myWrong      = myPS?.wrong      ?? 0;
    const mySolved     = myPS?.solved     ?? false;
    const myEliminated = myPS?.eliminated ?? false;

    // Host settings (before start)
    const [selectedCat,  setSelectedCat]  = useState('celebrities');
    const [selectedDiff, setSelectedDiff] = useState('easy');

    // Host local scoring state
    const [localScores, setLocalScores] = useState<Record<string, number>>({});

    const [timeLeft, setTimeLeft] = useState(ROUND_SECS);
    const prevTickRef   = useRef(ROUND_SECS);
    const resultDoneRef = useRef(false);

    const diffInfo = DIFFICULTIES.find(d => d.key === (gs.difficulty ?? 'easy')) ?? DIFFICULTIES[0];
    const catInfo  = CATEGORIES.find(c => c.key === gs.category);

    // Init localScores from DB when entering scoring view
    useEffect(() => {
        if (status === 'finished' && isHost && !scoringDone) {
            const init: Record<string, number> = {};
            players.forEach(p => { init[p.id] = gsScores[p.id] ?? 0; });
            setLocalScores(init);
        }
    }, [status, isHost, scoringDone]);

    // ── Timer ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'playing' || !gs.startedAt) return;
        const tick = () => {
            const left = Math.max(0, ROUND_SECS - Math.floor((Date.now() - gs.startedAt) / 1000));
            setTimeLeft(left);
            if ([30,20,10,5,4,3,2,1].includes(left) && left !== prevTickRef.current) {
                prevTickRef.current = left; play('tick');
            }
            if (left === 0 && isHost && status === 'playing') finishGame(null);
        };
        tick();
        const iv = setInterval(tick, 500);
        return () => clearInterval(iv);
    }, [status, gs.startedAt]);

    // ── Grant points when scoringDone ─────────────────────────────────────────
    useEffect(() => {
        if (!scoringDone || resultDoneRef.current) return;
        resultDoneRef.current = true;
        const myScore = gsScores[myId] ?? 0;
        if (myScore > 0) { play('win'); grantPoints(myScore); }
        else               play('lose');
    }, [scoringDone]);

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
        const solvers = players.filter(p => p.solved).sort((a,b) => (a.solvedAt??0) - (b.solvedAt??0));
        const winner  = forceWinner ?? solvers[0]?.id ?? null;
        await supabase.from('live_matches').update({
            status: 'finished', winner_id: winner,
            game_state: { ...gs, winnerId: winner, scoringDone: false, scores: {} },
        }).eq('id', match.id);
    };

    // ── Host: update local score ──────────────────────────────────────────────
    const handleLocalScore = (playerId: string, score: number) => {
        setLocalScores(prev => ({ ...prev, [playerId]: score }));
    };

    // ── Host: submit all scores to DB ─────────────────────────────────────────
    const handleSubmitScores = async () => {
        // find top scorer
        const topScore = Math.max(...Object.values(localScores), 0);
        const winners  = Object.entries(localScores)
            .filter(([, s]) => s === topScore && topScore > 0)
            .map(([id]) => id);
        const winnerId = winners[0] ?? null;

        await supabase.from('live_matches').update({
            game_state: {
                ...gs,
                scores:      localScores,
                scoringDone: true,
                winnerId,
            },
            winner_id: winnerId,
        }).eq('id', match.id);

        toast.success('تم حفظ النقاط! 🎉');
    };

    // ── Start ─────────────────────────────────────────────────────────────────
    const handleStart = async () => {
        const w       = pickWord(selectedCat);
        const catLbl  = CATEGORIES.find(c => c.key === selectedCat)?.label ?? selectedCat;
        const diff    = DIFFICULTIES.find(d => d.key === selectedDiff) ?? DIFFICULTIES[0];
        const mPlayers: PlayerState[] = match.players.map((p: any) => ({
            id: p.id, name: p.name,
            guessed: [], wrong: 0,
            solved: false, eliminated: false, solvedAt: null,
            totalScore: 0,
        }));
        await supabase.from('live_matches').update({
            status: 'playing',
            game_state: {
                word: w, category: catLbl,
                difficulty: diff.key, maxWrong: diff.maxWrong,
                players: mPlayers, startedAt: Date.now(),
                winnerId: null, scoringDone: false, scores: {},
            },
        }).eq('id', match.id);
    };

    const sortedPlayers = [...players].sort((a, b) => {
        if (a.solved && !b.solved) return -1;
        if (!a.solved && b.solved) return 1;
        if (a.solved && b.solved)  return (a.solvedAt??0) - (b.solvedAt??0);
        return a.wrong - b.wrong;
    });

    const sortedByScore = scoringDone
        ? [...players].sort((a,b) => (gsScores[b.id]??0) - (gsScores[a.id]??0))
        : sortedPlayers;

    const amIWinner  = match.winner_id === myId;
    const timerPct   = timeLeft / ROUND_SECS;
    const timerColor = timerPct < 0.2 ? '#ef4444' : timerPct < 0.4 ? '#f97316' : '#22c55e';

    // ═══════════════════════════════════════════════════════════════════════════
    // WAITING
    // ═══════════════════════════════════════════════════════════════════════════
    if (status === 'waiting') return (
        <div className="py-5 px-4 flex flex-col gap-4" dir="rtl">

            <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-rose-500 to-pink-700 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-2xl text-4xl">
                    🪢
                </div>
                <h3 className="text-xl font-black text-gray-800 mb-1">المشنقة!</h3>
                <p className="text-sm font-bold text-gray-400">
                    حتى {MAX_PLAYERS} لاعبين | {match.players?.length ?? 0} منضمين الآن
                </p>
            </div>

            {/* Players grid */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                <p className="text-[11px] font-black text-gray-400 mb-2">اللاعبون في الغرفة:</p>
                <div className="grid grid-cols-2 gap-1.5">
                    {match.players?.map((p: any, idx: number) => (
                        <div key={p.id} className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border-2 ${
                            p.id === myId ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 bg-gray-50'
                        }`}>
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 ${
                                p.id === match.players[0]?.id ? 'bg-amber-500' : 'bg-indigo-400'
                            }`}>
                                {p.id === match.players[0]?.id ? '👑' : idx + 1}
                            </span>
                            <span className="text-xs font-bold text-gray-700 truncate">{p.name}</span>
                            {p.id === myId && <span className="text-[9px] text-indigo-400 mr-auto">(أنت)</span>}
                        </div>
                    ))}
                    {/* Empty slots */}
                    {Array.from({ length: Math.max(0, MAX_PLAYERS - (match.players?.length ?? 0)) }).slice(0,2).map((_, i) => (
                        <div key={`empty-${i}`} className="flex items-center gap-2 px-2.5 py-2 rounded-xl border-2 border-dashed border-gray-200">
                            <span className="w-5 h-5 rounded-full bg-gray-100 flex-shrink-0"/>
                            <span className="text-xs text-gray-300 font-bold">منتظر...</span>
                        </div>
                    ))}
                </div>
            </div>

            {isHost ? (
                <>
                    {/* Category */}
                    <div>
                        <p className="text-xs font-black text-gray-600 mb-2 text-center">اختر الفئة:</p>
                        <div className="grid grid-cols-2 gap-2">
                            {CATEGORIES.map(cat => (
                                <button key={cat.key} onClick={() => setSelectedCat(cat.key)}
                                    className={`flex items-center gap-2.5 px-3 py-3 rounded-2xl border-2 font-black text-sm transition-all ${
                                        selectedCat === cat.key
                                            ? `bg-gradient-to-r ${cat.color} text-white border-transparent shadow-lg scale-105`
                                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                    }`}>
                                    <span className="text-xl">{cat.emoji}</span>
                                    <span className="flex-1 text-right">{cat.label}</span>
                                    {selectedCat === cat.key && <span className="text-xs opacity-80">✓</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Difficulty */}
                    <div>
                        <p className="text-xs font-black text-gray-600 mb-2 text-center">اختر الصعوبة:</p>
                        <div className="grid grid-cols-3 gap-2">
                            {DIFFICULTIES.map(diff => (
                                <button key={diff.key} onClick={() => setSelectedDiff(diff.key)}
                                    className={`flex flex-col items-center gap-1 py-3 px-2 rounded-2xl border-2 font-black text-sm transition-all ${
                                        selectedDiff === diff.key
                                            ? `bg-gradient-to-br ${diff.color} text-white border-transparent shadow-lg scale-105`
                                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                    }`}>
                                    <span className="text-xl">{diff.emoji}</span>
                                    <span className="text-xs font-black">{diff.label}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                        selectedDiff === diff.key ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        {diff.maxWrong} محاولات
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <button onClick={handleStart}
                        disabled={match.players?.length < 2}
                        className="w-full bg-gradient-to-r from-rose-500 to-pink-700 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                        🎮 ابدأ اللعبة
                    </button>
                    {match.players?.length < 2 && (
                        <p className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl text-center">
                            ⏳ في انتظار لاعب آخر على الأقل...
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

    // ═══════════════════════════════════════════════════════════════════════════
    // PLAYING
    // ═══════════════════════════════════════════════════════════════════════════
    if (status === 'playing') return (
        <div className="flex flex-col gap-3 py-2 px-3" dir="rtl">

            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                    <span className="text-[10px] font-black bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">
                        {catInfo?.emoji} {gs.category}
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${diffInfo.bg} ${diffInfo.text}`}>
                        {diffInfo.emoji} {diffInfo.label}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">
                        {word.replace(/ /g,'').length} حرف
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">
                        {players.length} لاعب
                    </span>
                </div>

                {/* Timer */}
                <div className="relative w-14 h-14 flex-shrink-0">
                    <svg width={56} height={56} viewBox="0 0 56 56" style={{ transform:'rotate(-90deg)' }}>
                        <circle cx={28} cy={28} r={24} fill="none" stroke="#e5e7eb" strokeWidth={4}/>
                        <circle cx={28} cy={28} r={24} fill="none" stroke={timerColor} strokeWidth={4}
                            strokeDasharray={2*Math.PI*24}
                            strokeDashoffset={2*Math.PI*24*(1-timerPct)}
                            strokeLinecap="round"
                            style={{ transition:'stroke-dashoffset 0.5s linear,stroke 0.4s' }}/>
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-gray-700">
                        {timeLeft < 60 ? timeLeft : `${Math.floor(timeLeft/60)}:${String(timeLeft%60).padStart(2,'0')}`}
                    </span>
                </div>
            </div>

            {/* Game area */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                <div className="flex items-start gap-3">
                    <div className="w-20 h-20 flex-shrink-0">
                        <HangmanSVG wrong={myWrong} maxWrong={gsMaxWrong}/>
                    </div>
                    <div className="flex-1 flex flex-col gap-2.5 pt-1 min-w-0">
                        <WordDisplay word={word} guessed={myGuessed} solved={mySolved} eliminated={myEliminated}/>
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

            {/* Players status bar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2.5">
                <p className="text-[10px] font-black text-gray-400 mb-1.5">اللاعبون ({players.length}):</p>
                <div className="flex flex-wrap gap-1.5">
                    {players.map(p => (
                        <div key={p.id} className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border ${
                            p.id === myId         ? 'bg-indigo-50 border-indigo-200 text-indigo-700' :
                            p.solved              ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                            p.eliminated          ? 'bg-red-50 border-red-200 text-red-400 opacity-60' :
                                                    'bg-gray-50 border-gray-200 text-gray-500'
                        }`}>
                            {p.solved      ? '✓' :
                             p.eliminated  ? '💀' :
                             p.id === myId ? '👤' : '⏳'}
                            <span className="max-w-[60px] truncate">{p.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Keyboard */}
            {!mySolved && !myEliminated && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                    <div className="flex flex-wrap gap-1.5 justify-center">
                        {AR_LETTERS.map(letter => {
                            const used    = myGuessed.some(g => normalizeChar(g) === normalizeChar(letter));
                            const correct = used && wordContains(word, letter);
                            const wrong   = used && !wordContains(word, letter);
                            return (
                                <button key={letter} onClick={() => handleGuess(letter)} disabled={used}
                                    className={`w-9 h-9 rounded-xl font-black text-sm transition-all border-2 active:scale-95 ${
                                        correct ? 'bg-emerald-100 border-emerald-300 text-emerald-700 cursor-not-allowed' :
                                        wrong   ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed' :
                                                  'bg-white border-gray-200 text-gray-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 shadow-sm'
                                    }`}>
                                    {letter}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {mySolved && (
                <div className="text-center bg-emerald-50 border-2 border-emerald-200 rounded-2xl py-3 px-3">
                    <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-1"/>
                    <p className="text-sm font-black text-emerald-800">حللتها! في انتظار باقي اللاعبين...</p>
                </div>
            )}

            <button onClick={onExit} className="text-xs font-bold text-gray-400 hover:text-gray-600 py-1 text-center">
                ← العودة
            </button>
        </div>
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // FINISHED — نتائج + تصحيح المضيف
    // ═══════════════════════════════════════════════════════════════════════════
    if (status === 'finished') return (
        <div className="flex flex-col gap-3 py-2 px-3 animate-in fade-in duration-400" dir="rtl">

            {/* Banner */}
            {scoringDone ? (
                <div className={`rounded-2xl p-4 text-center text-white shadow-xl ${
                    amIWinner
                        ? 'bg-gradient-to-br from-yellow-400 to-amber-500'
                        : 'bg-gradient-to-br from-indigo-600 to-violet-700'
                }`}>
                    {amIWinner
                        ? <><Crown className="w-12 h-12 mx-auto mb-1 animate-bounce"/><h3 className="text-xl font-black">أنت الفائز! 🏆</h3><p className="text-amber-100 text-sm mt-0.5">+{gsScores[myId] ?? 0} نقطة</p></>
                        : <><Star className="w-10 h-10 mx-auto mb-1 opacity-80"/><h3 className="text-xl font-black">انتهت اللعبة!</h3><p className="text-indigo-200 text-sm mt-0.5">الكلمة: <span className="font-black text-white">{word}</span></p></>
                    }
                </div>
            ) : (
                <div className="rounded-2xl p-4 text-center bg-gradient-to-br from-slate-700 to-slate-800 text-white shadow-xl">
                    <Skull className="w-10 h-10 mx-auto mb-1 opacity-70"/>
                    <h3 className="text-xl font-black">انتهت الجولة!</h3>
                    <p className="text-slate-300 text-sm mt-0.5">
                        الكلمة: <span className="font-black text-white">{word}</span>
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400">{gs.category}</span>
                        <span className="text-slate-600">•</span>
                        <span className={`text-[10px] font-black ${diffInfo.text}`}>{diffInfo.emoji} {diffInfo.label}</span>
                    </div>
                </div>
            )}

            {/* Results Table */}
            <div>
                <p className="text-xs font-black text-gray-600 mb-2 px-1">
                    {scoringDone ? '🏅 النتائج النهائية:' : '📊 ملخص اللعبة:'}
                </p>
                <ResultsTable
                    players={sortedPlayers}
                    word={word}
                    maxWrong={gsMaxWrong}
                    isHost={isHost}
                    scores={scoringDone ? gsScores : localScores}
                    onScore={handleLocalScore}
                    scoringDone={scoringDone}
                />
            </div>

            {/* Host scoring panel */}
            {isHost && !scoringDone && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4">
                    <p className="text-sm font-black text-amber-800 mb-1 flex items-center gap-2">
                        <Crown className="w-4 h-4"/> أنت المضيف — حكّم الإجابات
                    </p>
                    <p className="text-xs text-amber-600 font-bold mb-3">
                        10 = صح تماماً &nbsp;|&nbsp; 5 = جزئي &nbsp;|&nbsp; 0 = غلط / بدون إجابة
                    </p>

                    {/* Score summary */}
                    <div className="flex flex-wrap gap-2 mb-3">
                        {players.map(p => (
                            <div key={p.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border-2 text-xs font-bold ${
                                localScores[p.id] === 10 ? 'bg-emerald-100 border-emerald-300 text-emerald-700' :
                                localScores[p.id] === 5  ? 'bg-amber-100 border-amber-300 text-amber-700' :
                                localScores[p.id] === 0 && localScores[p.id] !== undefined
                                    ? 'bg-red-50 border-red-200 text-red-500' :
                                    'bg-white border-gray-200 text-gray-400'
                            }`}>
                                <span className="max-w-[70px] truncate">{p.name}</span>
                                <span className="font-black">{localScores[p.id] ?? '?'}</span>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleSubmitScores}
                        disabled={players.some(p => localScores[p.id] === undefined)}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        ✅ تأكيد النقاط وإرسالها
                    </button>
                    {players.some(p => localScores[p.id] === undefined) && (
                        <p className="text-[10px] text-amber-600 font-bold text-center mt-1">
                            حدد نقطة لكل لاعب أولاً من الجدول أعلاه
                        </p>
                    )}
                </div>
            )}

            {/* Waiting for host to score */}
            {!isHost && !scoringDone && (
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 text-center">
                    <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto mb-2"/>
                    <p className="text-sm font-black text-indigo-700">المضيف يصحح الإجابات...</p>
                    <p className="text-xs text-indigo-400 font-bold mt-0.5">انتظر النتيجة النهائية</p>
                </div>
            )}

            {/* Final Leaderboard when scoringDone */}
            {scoringDone && (
                <div className="space-y-1.5">
                    <p className="text-xs font-black text-gray-500 px-1">ترتيب النقاط:</p>
                    {sortedByScore.map((p, i) => {
                        const pts    = gsScores[p.id] ?? 0;
                        const medal  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
                        const isMe   = p.id === myId;
                        return (
                            <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 ${
                                i === 0 && pts > 0 ? 'border-yellow-300 bg-yellow-50' :
                                isMe               ? 'border-indigo-200 bg-indigo-50' :
                                                     'border-gray-100 bg-white'
                            }`}>
                                <span className="text-base w-6 text-center flex-shrink-0">{medal}</span>
                                <p className={`text-xs font-black flex-1 truncate ${isMe ? 'text-indigo-700' : 'text-gray-800'}`}>
                                    {p.name}{isMe && ' (أنت)'}
                                </p>
                                <span className={`font-black text-sm px-2 py-0.5 rounded-full ${
                                    pts === 10 ? 'bg-emerald-100 text-emerald-700' :
                                    pts === 5  ? 'bg-amber-100 text-amber-700' :
                                                 'bg-gray-100 text-gray-500'
                                }`}>
                                    {pts} نقطة
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            <button onClick={onExit}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-700 text-white py-3.5 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">
                <Users className="w-5 h-5"/> العودة إلى الصالة
            </button>
        </div>
    );

    return null;
}
