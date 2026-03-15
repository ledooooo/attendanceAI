import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Trophy, Users, Heart, Skull } from 'lucide-react';
import toast from 'react-hot-toast';
import { Employee } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_WRONG  = 6;
const ROUND_SECS = 120;

// ─── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = [
    { key: 'medical',   label: 'طبي',       emoji: '🏥', color: 'from-blue-500 to-cyan-600'      },
    { key: 'famous',    label: 'مشاهير',    emoji: '⭐', color: 'from-amber-500 to-yellow-600'   },
    { key: 'countries', label: 'بلاد',      emoji: '🌍', color: 'from-green-500 to-emerald-600'  },
    { key: 'animals',   label: 'حيوانات',   emoji: '🐾', color: 'from-orange-500 to-amber-600'   },
    { key: 'food',      label: 'أكل وشرب',  emoji: '🍽️', color: 'from-rose-500 to-pink-600'     },
    { key: 'sports',    label: 'رياضة',     emoji: '⚽', color: 'from-violet-500 to-purple-600'  },
    { key: 'mixed',     label: 'متنوع',     emoji: '🎲', color: 'from-indigo-500 to-violet-600'  },
];

// ─── Word Bank ────────────────────────────────────────────────────────────────
const WORD_BANK: Record<string, { word: string; hint: string }[]> = {

    medical: [
        { word: 'السكري',       hint: 'مرض يرتفع فيه سكر الدم' },
        { word: 'الربو',        hint: 'مرض تنفسي مزمن' },
        { word: 'الكوليرا',     hint: 'مرض معوي معدٍ' },
        { word: 'الملاريا',     hint: 'مرض تنقله البعوضة' },
        { word: 'الزهايمر',     hint: 'مرض يصيب الذاكرة' },
        { word: 'الإيدز',       hint: 'مرض نقص المناعة' },
        { word: 'الجدري',       hint: 'مرض فيروسي قديم' },
        { word: 'التيفود',      hint: 'مرض معدي من الطعام' },
        { word: 'الأنيميا',     hint: 'نقص الهيموجلوبين' },
        { word: 'الصداع',       hint: 'ألم في الرأس' },
        { word: 'الحمى',        hint: 'ارتفاع درجة الحرارة' },
        { word: 'الإسهال',      hint: 'أعراض هضمية' },
        { word: 'الغثيان',      hint: 'إحساس بالدوار والقيء' },
        { word: 'الدوخة',       hint: 'فقدان التوازن' },
        { word: 'الكبد',        hint: 'أكبر غدة في الجسم' },
        { word: 'الكلية',       hint: 'تصفي الدم' },
        { word: 'الطحال',       hint: 'عضو في البطن الأيسر' },
        { word: 'البنكرياس',    hint: 'يفرز الأنسولين' },
        { word: 'المريء',       hint: 'أنبوب بين الفم والمعدة' },
        { word: 'القصبة',       hint: 'مجرى الهواء للرئتين' },
        { word: 'الأسبرين',     hint: 'مسكن ومضاد التهاب' },
        { word: 'الأنسولين',    hint: 'هرمون ينظم السكر' },
        { word: 'المورفين',     hint: 'مسكن ألم قوي' },
        { word: 'الكورتيزون',   hint: 'مضاد التهاب قوي' },
        { word: 'الجراحة',      hint: 'تخصص يعمل بالعمليات' },
        { word: 'الأشعة',       hint: 'تصوير تشخيصي' },
        { word: 'التمريض',      hint: 'مهنة رعاية المريض' },
        { word: 'الصيدلة',      hint: 'علم الأدوية' },
        { word: 'الطوارئ',      hint: 'قسم الحالات الحرجة' },
        { word: 'المستشفى',     hint: 'مكان العلاج' },
        { word: 'التشخيص',      hint: 'تحديد المرض' },
        { word: 'الوصفة',       hint: 'ورقة الطبيب للدواء' },
        { word: 'البكتيريا',    hint: 'كائن دقيق أحادي الخلية' },
        { word: 'الفيروس',      hint: 'عدوى أصغر من البكتيريا' },
        { word: 'التطعيم',      hint: 'وقاية من الأمراض' },
        { word: 'الضغط',        hint: 'قوة ضخ الدم' },
        { word: 'الكوليسترول',  hint: 'دهون في الدم' },
        { word: 'الأكزيما',     hint: 'مرض جلدي' },
        { word: 'الصدفية',      hint: 'مرض جلدي مزمن' },
        { word: 'الإنفلونزا',   hint: 'مرض فيروسي موسمي' },
    ],

    famous: [
        { word: 'ابن سينا',       hint: 'طبيب وفيلسوف إسلامي عظيم' },
        { word: 'ابن خلدون',      hint: 'مؤسس علم الاجتماع' },
        { word: 'الخوارزمي',      hint: 'أبو الجبر والرياضيات' },
        { word: 'صلاح الدين',     hint: 'محرر بيت المقدس' },
        { word: 'الرازي',         hint: 'طبيب عربي اكتشف الجدري' },
        { word: 'نيوتن',          hint: 'اكتشف قانون الجاذبية' },
        { word: 'أينشتاين',       hint: 'النظرية النسبية' },
        { word: 'داروين',         hint: 'نظرية التطور' },
        { word: 'غاندي',          hint: 'رمز السلام الهندي' },
        { word: 'نابليون',        hint: 'قائد عسكري فرنسي' },
        { word: 'كليوباترا',      hint: 'ملكة مصر القديمة' },
        { word: 'الإسكندر',       hint: 'قائد عسكري فتح العالم' },
        { word: 'شكسبير',         hint: 'أشهر كتّاب المسرح' },
        { word: 'موزارت',         hint: 'موسيقار نمساوي عبقري' },
        { word: 'بيتهوفن',        hint: 'موسيقار ألماني عظيم' },
        { word: 'ليوناردو دافنشي', hint: 'فنان وعالم إيطالي' },
        { word: 'فرويد',          hint: 'مؤسس التحليل النفسي' },
        { word: 'ماري كوري',      hint: 'أول امرأة تنال نوبل' },
        { word: 'نيلسون مانديلا', hint: 'رمز النضال ضد التمييز' },
        { word: 'أبو بكر الصديق', hint: 'أول الخلفاء الراشدين' },
        { word: 'عمر بن الخطاب',  hint: 'ثاني الخلفاء الراشدين' },
        { word: 'الإمام الشافعي', hint: 'أحد أئمة المذاهب الأربعة' },
        { word: 'أبو حنيفة',      hint: 'إمام أهل الرأي' },
        { word: 'ابن بطوطة',      hint: 'أشهر رحالة عربي' },
        { word: 'الجاحظ',         hint: 'أديب عربي عباسي' },
    ],

    countries: [
        { word: 'السعودية',     hint: 'أكبر دولة عربية مساحةً' },
        { word: 'الإمارات',     hint: 'دولة الخليج الاتحادية' },
        { word: 'الأردن',       hint: 'المملكة الهاشمية' },
        { word: 'الجزائر',      hint: 'أكبر دولة في أفريقيا' },
        { word: 'المغرب',       hint: 'دولة المغرب العربي' },
        { word: 'تونس',         hint: 'جمهورية شمال أفريقيا الصغيرة' },
        { word: 'ليبيا',        hint: 'دولة عربية شمال أفريقيا' },
        { word: 'السودان',      hint: 'أرض الحضارات النيلية' },
        { word: 'اليمن',        hint: 'جنوب الجزيرة العربية' },
        { word: 'العراق',       hint: 'بلاد الرافدين' },
        { word: 'سوريا',        hint: 'الشام العربي' },
        { word: 'لبنان',        hint: 'سويسرا الشرق' },
        { word: 'فلسطين',       hint: 'الأرض المقدسة' },
        { word: 'تركيا',        hint: 'جسر بين أوروبا وآسيا' },
        { word: 'إيران',        hint: 'بلاد فارس' },
        { word: 'الهند',        hint: 'أكثر دول العالم سكاناً' },
        { word: 'الصين',        hint: 'أكبر اقتصاد آسيوي' },
        { word: 'اليابان',      hint: 'أرض الشمس المشرقة' },
        { word: 'البرازيل',     hint: 'أكبر دول أمريكا اللاتينية' },
        { word: 'الأرجنتين',    hint: 'بلد ميسي ومارادونا' },
        { word: 'إسبانيا',      hint: 'بلاد الفلامنكو' },
        { word: 'إيطاليا',      hint: 'حضارة روما' },
        { word: 'ألمانيا',      hint: 'قلب أوروبا الاقتصادي' },
        { word: 'فرنسا',        hint: 'بلد برج إيفل' },
        { word: 'أستراليا',     hint: 'القارة الجنوبية' },
        { word: 'إثيوبيا',      hint: 'أقدم دولة أفريقية' },
        { word: 'نيجيريا',      hint: 'عملاق أفريقيا السكاني' },
        { word: 'أفغانستان',    hint: 'دولة في قلب آسيا' },
        { word: 'إندونيسيا',    hint: 'أكبر دولة مسلمة' },
        { word: 'باكستان',      hint: 'دولة إسلامية جنوب آسيا' },
    ],

    animals: [
        { word: 'الفيل',        hint: 'أضخم حيوان بري' },
        { word: 'الزرافة',      hint: 'أطول حيوان في العالم' },
        { word: 'الأسد',        hint: 'ملك الغابة' },
        { word: 'النمر',        hint: 'قط ضخم مخطط' },
        { word: 'الفهد',        hint: 'أسرع حيوان بري' },
        { word: 'الدولفين',     hint: 'أذكى حيوان بحري' },
        { word: 'الحوت',        hint: 'أضخم مخلوق حي' },
        { word: 'الأخطبوط',     hint: 'له ثمانية أذرع' },
        { word: 'التمساح',      hint: 'زاحف قديم يعيش في المياه' },
        { word: 'الببغاء',      hint: 'طير يقلد الكلام' },
        { word: 'النسر',        hint: 'ملك الطيور' },
        { word: 'الطاووس',      hint: 'طير بريش جميل' },
        { word: 'الجمل',        hint: 'سفينة الصحراء' },
        { word: 'الأرنب',       hint: 'حيوان سريع بأذنين طويلتين' },
        { word: 'الثعلب',       hint: 'حيوان ذكي محتال' },
        { word: 'الذئب',        hint: 'يعيش في قطيع' },
        { word: 'الدب',         hint: 'يشتي في كهوف' },
        { word: 'القنفذ',       hint: 'جسمه مغطى بأشواك' },
        { word: 'الخفاش',       hint: 'الثدييات الطائرة' },
        { word: 'العقرب',       hint: 'حشرة ذات لسعة سامة' },
        { word: 'الكوبرا',      hint: 'ثعبان سام خطير' },
        { word: 'البطريق',      hint: 'طير لا يطير في القطب' },
        { word: 'الكنغر',       hint: 'حيوان أسترالي بجيب' },
        { word: 'الوعل',        hint: 'حيوان جبلي بقرون' },
        { word: 'الإبل',        hint: 'جمع الجمل' },
    ],

    food: [
        { word: 'الكنافة',      hint: 'حلوى شرقية بالجبن' },
        { word: 'المنسف',       hint: 'الطبق الوطني الأردني' },
        { word: 'الكبسة',       hint: 'أرز سعودي بالدجاج' },
        { word: 'الكوشري',      hint: 'الطبق الشعبي المصري' },
        { word: 'الشاورما',     hint: 'لحم مشوي بخبز' },
        { word: 'الفلافل',      hint: 'أكلة من الحمص المقلي' },
        { word: 'الحمص',        hint: 'معجون حبوب بالطحينة' },
        { word: 'التبولة',      hint: 'سلطة بقدونس وبرغل' },
        { word: 'البقلاوة',     hint: 'حلوى شرقية بالمكسرات' },
        { word: 'المهلبية',     hint: 'حلوى بيضاء بالنشا' },
        { word: 'القطايف',      hint: 'حلوى رمضانية' },
        { word: 'الأرز',        hint: 'الغذاء الأساسي في آسيا' },
        { word: 'العدس',        hint: 'بقوليات غنية بالبروتين' },
        { word: 'الفول',        hint: 'فطور مصري شعبي' },
        { word: 'الزيتون',      hint: 'ثمرة شجر البحر المتوسط' },
        { word: 'التمر',        hint: 'ثمرة النخيل' },
        { word: 'الرمان',       hint: 'فاكهة حمراء بحبوب' },
        { word: 'الشاي',        hint: 'أكثر مشروب شعبية في العالم' },
        { word: 'القهوة',       hint: 'مشروب من حبوب محمصة' },
        { word: 'الإجاص',       hint: 'فاكهة شبيهة بالتفاح' },
        { word: 'الأناناس',     hint: 'فاكهة استوائية شوكية' },
        { word: 'الكاكاو',      hint: 'أصل الشوكولاتة' },
        { word: 'الفستق',       hint: 'مكسرات خضراء' },
        { word: 'اللوز',        hint: 'مكسرات بيضاء' },
        { word: 'الأفوكادو',    hint: 'فاكهة الزبدة الخضراء' },
    ],

    sports: [
        { word: 'كرة القدم',    hint: 'الرياضة الأشهر في العالم' },
        { word: 'كرة السلة',    hint: 'رياضة التسجيل في السلة' },
        { word: 'كرة الطائرة',  hint: 'رياضة الشبكة والفرق' },
        { word: 'التنس',        hint: 'رياضة المضرب والكرة' },
        { word: 'السباحة',      hint: 'رياضة في الماء' },
        { word: 'الجودو',       hint: 'فن قتالي ياباني' },
        { word: 'الكاراتيه',    hint: 'فن دفاع ذاتي ياباني' },
        { word: 'الملاكمة',     hint: 'رياضة القبضات' },
        { word: 'الغولف',       hint: 'رياضة الضرب بالعصا' },
        { word: 'الرغبي',       hint: 'رياضة الكرة البيضية' },
        { word: 'الفروسية',     hint: 'رياضة ركوب الخيل' },
        { word: 'الجمباز',      hint: 'رياضة التوازن والحركات' },
        { word: 'الرماية',      hint: 'رياضة إطلاق السهام' },
        { word: 'الدراجات',     hint: 'رياضة ركوب العجل' },
        { word: 'العدو',        hint: 'أسرع رياضة على الأقدام' },
        { word: 'المصارعة',     hint: 'رياضة الإمساك والصراع' },
        { word: 'الاسكواش',     hint: 'رياضة الكرة في الغرفة المغلقة' },
        { word: 'البيسبول',     hint: 'رياضة المضرب الأمريكية' },
        { word: 'الإسكي',       hint: 'رياضة الجليد بالزلاجات' },
        { word: 'التجديف',      hint: 'رياضة القوارب بالمجاديف' },
    ],

    mixed: [
        { word: 'الذكاء',       hint: 'القدرة على التفكير والفهم' },
        { word: 'الإبداع',      hint: 'القدرة على الابتكار' },
        { word: 'الصداقة',      hint: 'علاقة حب واحترام متبادل' },
        { word: 'الشجاعة',      hint: 'الإقدام رغم الخوف' },
        { word: 'الأمانة',      hint: 'الصدق وعدم الخيانة' },
        { word: 'الصبر',        hint: 'التحمل وانتظار النتيجة' },
        { word: 'الكمبيوتر',    hint: 'جهاز إلكتروني للمعالجة' },
        { word: 'الهاتف',       hint: 'جهاز التواصل الأشهر' },
        { word: 'الإنترنت',     hint: 'شبكة المعلومات العالمية' },
        { word: 'البرمجة',      hint: 'لغة الحواسيب' },
        { word: 'الطائرة',      hint: 'وسيلة نقل جوية' },
        { word: 'الغواصة',      hint: 'مركبة تحت الماء' },
        { word: 'الصاروخ',      hint: 'يصل الفضاء الخارجي' },
        { word: 'الكيمياء',     hint: 'علم دراسة المواد' },
        { word: 'الفيزياء',     hint: 'علم القوى والطاقة' },
        { word: 'الرياضيات',    hint: 'علم الأعداد والمنطق' },
        { word: 'الجغرافيا',    hint: 'علم الأرض والبيئة' },
        { word: 'التاريخ',      hint: 'علم الأحداث الماضية' },
        { word: 'الفلسفة',      hint: 'علم التفكير والوجود' },
        { word: 'الاقتصاد',     hint: 'علم إدارة الثروات' },
        { word: 'الصحافة',      hint: 'مهنة نقل الأخبار' },
        { word: 'السينما',      hint: 'فن الصور المتحركة' },
        { word: 'الموسيقى',     hint: 'فن الألحان والأصوات' },
        { word: 'الشعر',        hint: 'فن الكلام الموزون' },
        { word: 'الديمقراطية',  hint: 'حكم الشعب' },
        { word: 'الأرستقراطية', hint: 'حكم النخبة' },
        { word: 'الإلكترونيات', hint: 'علم الدوائر الكهربائية' },
        { word: 'الأقمار الصناعية', hint: 'تدور حول الأرض' },
        { word: 'الأرصاد الجوية',   hint: 'علم التنبؤ بالطقس' },
        { word: 'الأنثروبولوجيا',   hint: 'علم دراسة الإنسان' },
    ],
};

// ─── Complete Arabic keyboard ─────────────────────────────────────────────────
const AR_LETTERS = [
    'ا', 'أ', 'إ', 'آ', 'ء', 'ب', 'ت', 'ث', 'ج', 'ح',
    'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط',
    'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه',
    'و', 'ي', 'ة', 'ى', 'ئ', 'ؤ',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pickWordFromCategory(cat: string) {
    const pool = cat === 'mixed'
        ? Object.values(WORD_BANK).flat()
        : (WORD_BANK[cat] ?? WORD_BANK.mixed);
    return pool[Math.floor(Math.random() * pool.length)];
}

// Normalize hamza forms so pressing أ matches إ آ ا etc.
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
    hint:       string;
    category:   string;
    players:    PlayerState[];
    startedAt:  number;
    winnerId:   string | null;
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

// ─── Hangman SVG ──────────────────────────────────────────────────────────────
function HangmanSVG({ wrong }: { wrong: number }) {
    const pct   = wrong / MAX_WRONG;
    const color = pct >= 1 ? '#ef4444' : pct >= 0.5 ? '#f97316' : '#6366f1';
    return (
        <svg viewBox="0 0 100 110" className="w-full h-full" strokeLinecap="round" strokeLinejoin="round">
            <line x1="10" y1="105" x2="90" y2="105" stroke="#94a3b8" strokeWidth="3"/>
            <line x1="25" y1="105" x2="25" y2="10"  stroke="#94a3b8" strokeWidth="3"/>
            <line x1="25" y1="10"  x2="60" y2="10"  stroke="#94a3b8" strokeWidth="3"/>
            <line x1="60" y1="10"  x2="60" y2="22"  stroke="#94a3b8" strokeWidth="3"/>
            {wrong >= 1 && <circle cx="60" cy="30" r="8" stroke={color} strokeWidth="2.5" fill="none"/>}
            {wrong >= 2 && <line x1="60" y1="38" x2="60" y2="65" stroke={color} strokeWidth="2.5"/>}
            {wrong >= 3 && <line x1="60" y1="45" x2="45" y2="57" stroke={color} strokeWidth="2.5"/>}
            {wrong >= 4 && <line x1="60" y1="45" x2="75" y2="57" stroke={color} strokeWidth="2.5"/>}
            {wrong >= 5 && <line x1="60" y1="65" x2="45" y2="80" stroke={color} strokeWidth="2.5"/>}
            {wrong >= 6 && <line x1="60" y1="65" x2="75" y2="80" stroke={color} strokeWidth="2.5"/>}
            {wrong >= MAX_WRONG && (
                <>
                    <line x1="56" y1="27" x2="58" y2="29" stroke={color} strokeWidth="1.5"/>
                    <line x1="58" y1="27" x2="56" y2="29" stroke={color} strokeWidth="1.5"/>
                    <line x1="62" y1="27" x2="64" y2="29" stroke={color} strokeWidth="1.5"/>
                    <line x1="64" y1="27" x2="62" y2="29" stroke={color} strokeWidth="1.5"/>
                    <path d="M56 34 Q60 31 64 34" stroke={color} strokeWidth="1.5" fill="none"/>
                </>
            )}
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
    return (
        <div className="flex gap-1.5 flex-wrap justify-center" dir="rtl">
            {word.split('').map((ch, i) => {
                if (ch === ' ') return <div key={i} className="w-4"/>;
                const revealed = solved || eliminated || isLetterRevealed(ch, guessed);
                return (
                    <div key={i} className="flex flex-col items-center gap-0.5">
                        <span className={`text-xl font-black min-w-[1.8rem] text-center transition-all duration-300 ${
                            revealed
                                ? solved ? 'text-green-600' : eliminated ? 'text-red-500' : 'text-gray-800'
                                : 'text-transparent'
                        }`}>
                            {revealed ? ch : 'ـ'}
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

// ─── Lives Bar ────────────────────────────────────────────────────────────────
function LivesBar({ wrong }: { wrong: number }) {
    return (
        <div className="flex gap-1 justify-center">
            {Array.from({ length: MAX_WRONG }).map((_, i) => (
                <Heart key={i} className={`w-5 h-5 transition-all ${
                    i < MAX_WRONG - wrong ? 'text-red-500 fill-red-500' : 'text-gray-200 fill-gray-200'
                }`}/>
            ))}
        </div>
    );
}

// ─── Player Row ───────────────────────────────────────────────────────────────
function PlayerRow({ ps, isMe, rank }: { ps: PlayerState; isMe: boolean; rank: number }) {
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 ${
            isMe           ? 'border-indigo-300 bg-indigo-50' :
            ps.solved      ? 'border-green-200 bg-green-50' :
            ps.eliminated  ? 'border-red-100 bg-red-50/50 opacity-60' :
                             'border-gray-100 bg-white'
        }`}>
            <span className="text-base w-6 text-center flex-shrink-0">{medal ?? `#${rank}`}</span>
            <p className={`text-xs font-black flex-1 truncate ${isMe ? 'text-indigo-700' : 'text-gray-700'}`}>
                {ps.name}{isMe && ' (أنت)'}
            </p>
            {ps.solved    && <span className="text-[10px] font-black text-green-600 bg-green-100 px-2 py-0.5 rounded-full">✓ حلّها!</span>}
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
    match: any; employee: Employee; onExit: () => void; grantPoints: (pts: number) => Promise<void>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HangmanGame({ match, employee, onExit, grantPoints }: Props) {
    const play   = useSound();
    const myId   = employee.employee_id;
    const isHost = match.players?.[0]?.id === myId;

    const gs: HangmanGS       = match.game_state ?? {};
    const word: string        = gs.word ?? '';
    const players: PlayerState[] = gs.players ?? [];
    const status: string      = match.status ?? 'waiting';

    const myPS         = players.find(p => p.id === myId);
    const myGuessed    = myPS?.guessed    ?? [];
    const myWrong      = myPS?.wrong      ?? 0;
    const mySolved     = myPS?.solved     ?? false;
    const myEliminated = myPS?.eliminated ?? false;

    const [selectedCat, setSelectedCat] = useState('medical');
    const [timeLeft, setTimeLeft]       = useState(ROUND_SECS);
    const prevTickRef                   = useRef(ROUND_SECS);
    const resultDoneRef                 = useRef(false);

    // ── Timer ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'playing' || !gs.startedAt) return;
        const tick = () => {
            const left = Math.max(0, ROUND_SECS - Math.floor((Date.now() - gs.startedAt) / 1000));
            setTimeLeft(left);
            if ([30, 20, 10, 5, 4, 3, 2, 1].includes(left) && left !== prevTickRef.current) {
                prevTickRef.current = left; play('tick');
            }
            if (left === 0 && isHost && status === 'playing') finishGame(null);
        };
        tick();
        const iv = setInterval(tick, 500);
        return () => clearInterval(iv);
    }, [status, gs.startedAt]);

    // ── Grant points ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'finished' || resultDoneRef.current) return;
        resultDoneRef.current = true;
        if (gs.winnerId === myId) { play('win'); grantPoints(15); }
        else if (mySolved) { play('win'); grantPoints(5); }
        else play('lose');
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
        const eliminated = newWrong >= MAX_WRONG;

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
        const solvers = players.filter(p => p.solved).sort((a, b) => (a.solvedAt ?? 0) - (b.solvedAt ?? 0));
        const winner  = forceWinner ?? solvers[0]?.id ?? null;
        await supabase.from('live_matches').update({
            status: 'finished', winner_id: winner,
            game_state: { ...gs, winnerId: winner },
        }).eq('id', match.id);
    };

    // ── Start ─────────────────────────────────────────────────────────────────
    const handleStart = async () => {
        const picked    = pickWordFromCategory(selectedCat);
        const catLabel  = CATEGORIES.find(c => c.key === selectedCat)?.label ?? selectedCat;
        const matchPlayers: PlayerState[] = match.players.map((p: any) => ({
            id: p.id, name: p.name, guessed: [], wrong: 0,
            solved: false, eliminated: false, solvedAt: null,
        }));
        await supabase.from('live_matches').update({
            status: 'playing',
            game_state: {
                word: picked.word, hint: picked.hint, category: catLabel,
                players: matchPlayers, startedAt: Date.now(), winnerId: null,
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
    const timerColor = timerPct < 0.2 ? 'text-red-600' : timerPct < 0.4 ? 'text-orange-500' : 'text-green-700';

    // ── WAITING ───────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className="py-5 px-4 flex flex-col gap-4" dir="rtl">
            <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-rose-500 to-pink-700 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-2xl text-4xl">🪢</div>
                <h3 className="text-xl font-black text-gray-800 mb-1">المشنقة!</h3>
                <p className="text-sm font-bold text-gray-400">{match.players?.length ?? 0} لاعب في الغرفة</p>
            </div>

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
                    <div>
                        <p className="text-xs font-black text-gray-600 mb-2.5 text-center">اختر فئة الكلمات:</p>
                        <div className="grid grid-cols-2 gap-2">
                            {CATEGORIES.map(cat => (
                                <button key={cat.key} onClick={() => setSelectedCat(cat.key)}
                                    className={`flex items-center gap-2.5 px-3 py-3 rounded-2xl border-2 font-black text-sm transition-all ${
                                        selectedCat === cat.key
                                            ? `bg-gradient-to-r ${cat.color} text-white border-transparent shadow-lg scale-105`
                                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                    }`}>
                                    <span className="text-xl">{cat.emoji}</span>
                                    <span className="flex-1 text-right">{cat.label}</span>
                                    {selectedCat === cat.key && <span className="text-xs opacity-80">✓</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleStart}
                        className="w-full bg-gradient-to-r from-rose-500 to-pink-700 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all">
                        🎮 ابدأ اللعبة
                    </button>
                </>
            ) : (
                <div className="flex items-center gap-2 justify-center text-sm font-bold text-gray-400 py-6 bg-gray-50 rounded-2xl">
                    <Loader2 className="w-4 h-4 animate-spin"/> في انتظار المضيف ليختار الفئة...
                </div>
            )}

            <button onClick={onExit} className="text-sm font-bold text-gray-400 hover:text-gray-600 text-center">
                ← العودة
            </button>
        </div>
    );

    // ── PLAYING ───────────────────────────────────────────────────────────────
    if (status === 'playing') return (
        <div className="flex flex-col gap-3 py-2 px-3" dir="rtl">
            <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-black bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">{gs.category}</span>
                        <span className="text-[10px] font-bold text-gray-400">{word.split('').filter(c => c !== ' ').length} حرف</span>
                    </div>
                    <p className="text-sm font-black text-gray-700 truncate">{gs.hint}</p>
                </div>
                <div className="relative w-14 h-14 flex-shrink-0">
                    <svg width={56} height={56} viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx={28} cy={28} r={24} fill="none" stroke="#e5e7eb" strokeWidth={4}/>
                        <circle cx={28} cy={28} r={24} fill="none"
                            stroke={timerPct < 0.2 ? '#ef4444' : timerPct < 0.4 ? '#f97316' : '#22c55e'}
                            strokeWidth={4} strokeDasharray={2 * Math.PI * 24}
                            strokeDashoffset={2 * Math.PI * 24 * (1 - timerPct)}
                            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.4s' }}/>
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-xs font-black ${timerColor}`}>
                        {timeLeft < 60 ? timeLeft : `${Math.floor(timeLeft/60)}:${String(timeLeft%60).padStart(2,'0')}`}
                    </span>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                <div className="flex items-start gap-3">
                    <div className="w-24 h-24 flex-shrink-0"><HangmanSVG wrong={myWrong}/></div>
                    <div className="flex-1 flex flex-col gap-3 pt-1">
                        <WordDisplay word={word} guessed={myGuessed} solved={mySolved} eliminated={myEliminated}/>
                        <LivesBar wrong={myWrong}/>
                        {mySolved && <div className="text-center text-xs font-black text-green-600 bg-green-50 rounded-xl py-1.5 animate-bounce">🎉 أحسنت! حللتها!</div>}
                        {myEliminated && <div className="text-center text-xs font-black text-red-500 bg-red-50 rounded-xl py-1.5">💀 استنفدت فرصك! الكلمة: <span className="font-black">{word}</span></div>}
                    </div>
                </div>
            </div>

            {players.length > 1 && (
                <div className="space-y-1.5">
                    <p className="text-[11px] font-black text-gray-400 px-1">اللاعبون:</p>
                    {sortedPlayers.map((ps, i) => <PlayerRow key={ps.id} ps={ps} isMe={ps.id === myId} rank={i + 1}/>)}
                </div>
            )}

            {!mySolved && !myEliminated && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                    <p className="text-[10px] font-black text-gray-400 mb-2 text-center">اختر حرفاً:</p>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                        {AR_LETTERS.map(letter => {
                            const used   = myGuessed.some(g => normalizeChar(g) === normalizeChar(letter));
                            const inWord = wordContains(word, letter);
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

            {mySolved && (
                <div className="text-center bg-green-50 border-2 border-green-200 rounded-2xl py-4 px-3">
                    <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-1"/>
                    <p className="text-sm font-black text-green-800">حللتها! في انتظار باقي اللاعبين...</p>
                </div>
            )}

            <button onClick={onExit} className="text-xs font-bold text-gray-400 hover:text-gray-600 py-1 text-center">← العودة</button>
        </div>
    );

    // ── FINISHED ──────────────────────────────────────────────────────────────
    if (status === 'finished') return (
        <div className="flex flex-col gap-3 py-2 px-3 animate-in fade-in duration-400" dir="rtl">
            <div className={`rounded-2xl p-5 text-center text-white shadow-xl ${
                amIWinner ? 'bg-gradient-to-br from-yellow-400 to-amber-500' :
                mySolved  ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
                            'bg-gradient-to-br from-gray-500 to-gray-700'
            }`}>
                {amIWinner
                    ? <><Trophy className="w-14 h-14 mx-auto mb-2 drop-shadow-xl animate-bounce"/><h3 className="text-2xl font-black">🎉 أنت الأسرع!</h3><p className="text-amber-100 text-sm mt-1">+15 نقطة 🏆</p></>
                    : mySolved
                        ? <><div className="text-5xl mb-2">🌟</div><h3 className="text-2xl font-black">أحسنت!</h3><p className="text-green-100 text-sm mt-1">+5 نقاط</p></>
                        : <><Skull className="w-14 h-14 mx-auto mb-2 opacity-70"/><h3 className="text-2xl font-black">لم تكملها</h3><p className="text-gray-300 text-sm mt-1">الكلمة كانت: <span className="text-white font-black">{word}</span></p></>
                }
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-xs font-black text-gray-400 mb-2">الكلمة الصحيحة</p>
                <p className="text-2xl font-black text-gray-800">{word}</p>
                <p className="text-xs text-gray-400 mt-1">{gs.hint}</p>
            </div>

            <div className="space-y-1.5">
                <p className="text-xs font-black text-gray-500 px-1">الترتيب النهائي:</p>
                {sortedPlayers.map((ps, i) => <PlayerRow key={ps.id} ps={ps} isMe={ps.id === myId} rank={i + 1}/>)}
            </div>

            <button onClick={onExit}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-700 text-white py-3.5 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">
                <Users className="w-5 h-5"/> العودة إلى الصالة
            </button>
        </div>
    );

    return null;
}
