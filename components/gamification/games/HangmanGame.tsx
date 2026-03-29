import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Trophy, Users, Heart, Skull, Sparkles, RotateCcw, Timer, Zap, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { Employee } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_WRONG_EASY   = 8;
const MAX_WRONG_MEDIUM = 6;
const MAX_WRONG_HARD   = 4;
const ROUND_SECS       = 90;

const getMaxWrong = (difficulty: string) => {
    switch (difficulty) {
        case 'easy':   return MAX_WRONG_EASY;
        case 'hard':   return MAX_WRONG_HARD;
        default:       return MAX_WRONG_MEDIUM;
    }
};

// ─── Difficulty Levels ────────────────────────────────────────────────────────
const DIFFICULTIES = [
    { key: 'easy',   label: 'سهل',      emoji: '🟢', desc: '8 فرص', color: 'from-green-400 to-emerald-500'  },
    { key: 'medium', label: 'متوسط',     emoji: '🟡', desc: '6 فرص', color: 'from-amber-400 to-orange-500'  },
    { key: 'hard',   label: 'صعب',      emoji: '🔴', desc: '4 فرص', color: 'from-red-500 to-rose-600'      },
];

// ─── Categories (WITHOUT HINTS - Difficulty based) ───────────────────────────
const CATEGORIES = [
    { key: 'medical',      label: 'طبي',      emoji: '🏥', color: 'from-blue-500 to-cyan-600'      },
    { key: 'anatomy',      label: 'تشريح',    emoji: '🫀', color: 'from-rose-500 to-pink-600'     },
    { key: 'medicines',    label: 'أدوية',    emoji: '💊', color: 'from-purple-500 to-violet-600'  },
    { key: 'diseases',     label: 'أمراض',    emoji: '🦠', color: 'from-red-500 to-orange-600'    },
    { key: 'famous',       label: 'مشاهير',   emoji: '⭐', color: 'from-amber-500 to-yellow-600'  },
    { key: 'countries',    label: 'بلاد',     emoji: '🌍', color: 'from-green-500 to-emerald-600' },
    { key: 'animals',      label: 'حيوانات',  emoji: '🐾', color: 'from-orange-500 to-amber-600'  },
    { key: 'food',         label: 'أكل',      emoji: '🍽️', color: 'from-yellow-500 to-orange-500'  },
    { key: 'sports',       label: 'رياضة',     emoji: '⚽', color: 'from-indigo-500 to-blue-600'    },
    { key: 'science',      label: 'علوم',     emoji: '🔬', color: 'from-cyan-500 to-blue-600'      },
    { key: 'geography',    label: 'جغرافيا',  emoji: '🗺️', color: 'from-teal-500 to-green-600'    },
    { key: 'history',      label: 'تاريخ',     emoji: '🏛️', color: 'from-amber-600 to-yellow-700'  },
    { key: 'professions',  label: 'مهَن',     emoji: '💼', color: 'from-slate-500 to-gray-600'     },
    { key: 'technology',    label: 'تكنولوجيا', emoji: '💻', color: 'from-blue-600 to-indigo-600'   },
    { key: 'mixed',        label: 'متنوع',    emoji: '🎲', color: 'from-pink-500 to-purple-600'   },
];

// ─── Word Bank (Extensive - NO HINTS) ─────────────────────────────────────────
const WORD_BANK: Record<string, string[]> = {

    // 🏥 MEDICAL - Diseases & Conditions
    medical: [
        'السكري', 'الربو', 'الكوليرا', 'الملاريا', 'الزهايمر', 'الإيدز', 'الجدري', 'التيفود',
        'الأنيميا', 'الصداع', 'الحمى', 'الإسهال', 'الغثيان', 'الدوخة', 'الزكام', 'السعال',
        'الالتهاب', 'التجفاف', 'التشنج', 'الذبحة', 'الجلطة', 'السرطان', 'النقرس', 'الحصبة',
        'شلل الأطفال', 'التوحد', 'الاكتئاب', 'الفصام', 'الباركنسون', 'التصلب المتعدد', 'الصدفية',
        'الأكزيما', 'الدمامل', 'القوباء', 'السل', 'الكبد الوبائي', 'التهاب الكبد', 'تليف الكبد',
    ],

    // 🫀 ANATOMY - Body Parts & Organs
    anatomy: [
        'القلب', 'المخ', 'الرئة', 'الكبد', 'الكلية', 'الطحال', 'المعدة', 'الأمعاء', 'المريء',
        'القصبة', 'البنكرياس', 'المرارة', 'الزائدة', 'المثانة', 'البروستاتا', 'المبيض', 'الرحم',
        'الأنبوب', 'العصب', 'الوريد', 'الشريان', 'العضلة', 'العظم', 'الغضروف', 'الوتر', 'الرباط',
        'الجمجمة', 'الفقرات', 'الضلوع', 'الحوض', 'عظمة الفخذ', 'الظنبوب', 'الشظية', 'الكتف',
        'المرفق', 'الرسغ', 'الإبهام', 'الإصبع', 'القدم', 'الكاحل', 'الساق', 'الفخذ',
        'الرقبة', 'الحلق', 'اللسان', 'الأسنان', 'اللثة', 'الشفة', 'الخد', 'الجفن', 'القزحية',
    ],

    // 💊 MEDICINES & Drugs
    medicines: [
        'الأسبرين', 'الباراسيتامول', 'البنسلين', 'الأموكسيسيلين', 'الديكلوفيناك', 'الإيبوبروفين',
        'الميتفورمين', 'الإنسولين', 'الميفورت', 'الميفبريستون', 'الميثوتريكسات', 'الأزيثرومايسين',
        'السيبروفloxacin', 'الميترونيدازول', 'الكانامايسين', 'الديجوكسين', 'الأتينولول', 'الأميودارون',
        'الوارفارين', 'الهيبارين', 'الفينتونين', 'الكاربامازيبين', 'الليثيوم', 'الفلوكستين', 'السيرترالين',
        'المورفين', 'الكودايين', 'الترامادول', 'البثيدين', 'الفنتانيل', 'الكورتيزون', 'الديكساميثازون',
        'البيكنيدروفيلين', 'الكلورفينيرامين', 'الديفينهيدرامين', 'الميكلوزين', 'الأوندانسيترون',
        'الميتوكلوبراميد', 'البانتوبرازول', 'الأوميبرازول', 'الرانيتيدين', 'الميزوبروستول',
    ],

    // 🦠 DISEASES & Infections
    diseases: [
        'الزهري', 'السيلان', 'الكلاميديا', 'الهربس', 'الثآليل', 'الكانديدا', 'المشعرة', 'الجارديا',
        'الديدان', 'الأميبا', 'البلهارسيا', 'الفطر', 'الخميرة', 'الكنكر', 'الورم', 'السلائل',
        'الخراجات', 'الناسور', 'الشق الشرجي', 'الدوالي', 'البواسير', 'الغرغرينا', 'الغرنا',
        'الكزاز', 'التيتانوس', 'الدفتيريا', 'السعال الديكي', 'الحصبة الألمانية', 'النكاف', 'الجدري المائي',
    ],

    // ⭐ FAMOUS HISTORICAL
    famous: [
        'ابن سينا', 'ابن خلدون', 'الخوارزمي', 'صلاح الدين', 'الرازي', 'ابن رشد', 'ابن الهيثم',
        'جابر بن حيان', 'المأمون', 'المعتصم', 'هارون الرشيد', 'عبد الملك', 'الحجاج', 'عمرو بن العاص',
        'طارق بن زياد', 'قتيبة بن مسلم', 'ابن بطوطة', 'المسعودي', 'الطبري', 'ابن الأثير',
        'نيوتن', 'أينشتاين', 'داروين', 'غاندي', 'نابليون', 'كليوباترا', 'الإسكندر', 'الماسونية',
        'شكسبير', 'موزارت', 'بيتهوفن', 'ليوناردو', 'فرويد', 'ماري كوري', 'نيلسون مانديلا',
        'أبو بكر', 'عمر بن الخطاب', 'عثمان بن عفان', 'علي بن أبي طالب', 'الحسن بن علي', 'زينب بنت علي',
        'الإمام الشافعي', 'أبو حنيفة', 'الإمام مالك', 'الإمام أحمد', 'سعد بن أبي وقاص', 'خالد بن الوليد',
        'توفيق الحكيم', 'أحمد زويل', 'عمر الشريف', 'محمد عبد الوهاب', 'أم كلثوم', 'عبد الحليم',
    ],

    // 🌍 COUNTRIES
    countries: [
        'السعودية', 'الإمارات', 'الأردن', 'الجزائر', 'المغرب', 'تونس', 'ليبيا', 'السودان',
        'اليمن', 'العراق', 'سوريا', 'لبنان', 'فلسطين', 'مصر', 'عمان', 'قطر', 'البحرين', 'الكويت',
        'تركيا', 'إيران', 'الهند', 'الصين', 'اليابان', 'كوريا', 'تايوان', 'فيتنام', 'تايلاند',
        'البرازيل', 'الأرجنتين', 'المكسيك', 'كندا', 'أمريكا', 'كولومبيا', 'بيرو', 'تشيلي',
        'إسبانيا', 'إيطاليا', 'ألمانيا', 'فرنسا', 'بريطانيا', 'هولندا', 'بلجيكا', 'سويسرا',
        'النمسا', 'بولندا', 'السويد', 'النرويج', 'الدنمارك', 'فنلندا', 'اليونان', 'برتغال',
        'أستراليا', 'نيوزيلندا', 'جنوب أفريقيا', 'نيجيريا', 'إثيوبيا', 'كينيا', 'غانا', 'السنغال',
        'إندونيسيا', 'ماليزيا', 'الفلبين', 'باكستان', 'أفغانستان', 'كازاخستان', 'أوزبكستان',
    ],

    // 🐾 ANIMALS
    animals: [
        'الفيل', 'الزرافة', 'الأسد', 'النمر', 'الفهد', 'الدولفين', 'الحوت', 'الأخطبوط', 'التمساح',
        'الببغاء', 'النسر', 'الطاووس', 'الجمل', 'الأرنب', 'الثعلب', 'الذئب', 'الدب', 'القنفذ',
        'الخفاش', 'العقرب', 'الكوبرا', 'البطريق', 'الكنغر', 'الوعل', 'الغزلان', 'الماعز',
        'الخروف', 'البقرة', 'الحصان', 'البغل', 'الحمار', 'الخنزير', 'السلحفاة', 'الضفدعة',
        'السلطعون', 'الجراد', 'النحلة', 'النمل', 'الفراشة', 'العثة', 'الخنفساء', 'اليعسوب',
        'النسور', 'الصقور', 'البوم', 'الغراب', 'العصفور', 'الدجاجة', 'الديك', 'الإوزة', 'البط',
        'الأخطبوط', 'الحبار', 'قنديل البحر', 'السمك', 'القرش', 'الرا', 'الضب', 'السحلية', 'الأوزاخ',
        'الخرتيت', 'الجاموس', 'الثور', 'الأيل', 'الوشق', 'القيوط', 'الراكون', 'الابنوس', 'الخرمج',
    ],

    // 🍽️ FOOD & DRINKS
    food: [
        'الكنافة', 'المنسف', 'الكبسة', 'الملوخية', 'الكشري', 'الشاورما', 'الفلافل', 'الحمص',
        'التبولة', 'البقلاوة', 'المهلبية', 'القطايف', 'التمر', 'الرمان', 'التين', 'الجميز',
        'الشاي', 'القهوة', 'الكاكاو', 'النعناع', 'البابونج', 'الزعتر', 'الحلبة', 'اليانسون',
        'الكمون', 'الكركم', 'القرفة', 'الهال', 'الزعفران', 'الفلفل', 'الملح', 'السكر',
        'الأرز', 'القمح', 'الشعير', 'الذرة', 'الدقيق', 'الطحين', 'السمن', 'زيت الزيتون', 'الزيت',
        'العسل', 'الطحينة', 'المربى', 'الشوكولاتة', 'الآيس كريم', 'الكازو', 'الفستق', 'اللوز',
        'الجوز', 'البندق', 'المشمش', 'الخوخ', 'الدراق', 'التفاح', 'الكمثرى', 'البرتقال',
        'الليمون', 'الموز', 'المانجو', 'الأناناس', 'الجريب فروت', 'الر Durian', 'الكيوي',
        'الأفوكادو', 'البطاطس', 'الطماطم', 'الخيار', 'الملفوف', 'الجزر', 'البصل', 'الثوم',
        'الفلفل', 'الباذنجان', 'الكوسة', 'الفاصوليا', 'العدس', 'الفول', 'الحمص', 'البازيلاء',
    ],

    // ⚽ SPORTS
    sports: [
        'كرة القدم', 'كرة السلة', 'كرة الطائرة', 'كرة اليد', 'التنس', 'السباحة', 'الجودو',
        'الكاراتيه', 'الملاكمة', 'الغولف', 'الرغبي', 'الفروسية', 'الجمباز', 'الرماية', 'الدراجات',
        'العدو', 'المصارعة', 'الاسكواش', 'البيسبول', 'الكريكيت', 'الإسكي', 'التجديف', 'ركوب الأمواج',
        'التزحلق', 'البارالمبية', 'الترايثلون', 'البياثلون', 'اللاكروس', 'ال绒球', 'البنج بونج',
        'البليارد', 'السنوكر', 'الشطرنج', 'الدمدم', 'الطرائف', 'الباركور', 'الهاكينغ', 'الفيتنيس',
    ],

    // 🔬 SCIENCE
    science: [
        'الكيمياء', 'الفيزياء', 'الأحياء', 'الرياضيات', 'الجيولوجيا', 'علم الفلك', 'الميكانيكا',
        'الكهرباء', 'المغناطيس', 'الضوء', 'الصوت', 'الحرارة', 'الضغط', 'الطاقة', 'القوة',
        'السرعة', 'الكتلة', 'الحجم', 'الكثافة', 'الذرة', 'الإلكترون', 'البروتون', 'النيوترون',
        'الجزيء', 'العنصر', 'المركب', 'التفاعل', 'التأكسد', 'الاختزال', 'التبلور', 'الترشيح',
        'التقطير', 'الاستخلاص', 'القياس', 'المجهر', 'التلسكوب', 'ال雷达', 'الأقمار', 'الصواريخ',
        'النانو', 'الليزر', 'البلازما', 'النظائر', 'النواة', 'الانشطار', 'الاندماج', 'الشعاع',
    ],

    // 🗺️ GEOGRAPHY
    geography: [
        'الصحراء', 'الغابة', 'البحر', 'المحيط', 'البحيرة', 'النهر', 'الوادي', 'الجبل', 'الهضبة',
        'السهل', 'السراب', 'الجزيرة', 'البر', 'القارة', 'المضيق', 'الخليج', 'البحر الأحمر',
        'المحيط الهادئ', 'المحيط الأطلسي', 'ممر الدانوب', 'نهر النيل', 'نهر دجلة', 'نهر الفرات',
        'نهر الأردن', 'نهر السين', 'نهر التايمز', 'جبلEverest', 'جبل كليمنجارو', 'جبل آلپ',
        'جبل الهيمالايا', 'جبل الأنديز', 'القطب الشمالي', 'القطب الجنوبي', 'خط الاستواء',
        'مدار السرطان', 'مدار الجدي', 'الشرق الأوسط', 'شمال أفريقيا', 'جنوب أوروبا', 'غرب آسيا',
    ],

    // 🏛️ HISTORY
    history: [
        'الفراعنة', 'الاهرامات', 'سقوط غرناطة', 'الحروب الصليبية', 'العصر الحجري', 'العصر البرونزي',
        'العصر الحديدي', 'الثورة الفرنسية', 'الحرب العالمية', 'حرب الخليج', 'ثورة 1919', 'ثورة 1952',
        'محمد علي', 'عبد الناصر', 'السادات', 'مبارك', 'عبد الله', 'فيصل', 'عبد العزيز', 'سلمان',
        'الحرب الأهلية', 'الاستعمار', 'الاستقلال', 'الوحدة', 'الانقسام', 'الحصار', 'السلم',
        'الاتفاقية', 'المعاهدة', 'الهدنة', 'الكفاح', 'النضال', 'التحرير', 'الاحتلال', 'التهجير',
    ],

    // 💼 PROFESSIONS
    professions: [
        'الطبيب', 'الممرض', 'الصيدلي', 'المخبري', 'الأشعة', 'الجراح', 'طبيب الأسنان', 'العلاج الطبيعي',
        'المهندس', 'المعماري', 'المحامي', 'القاضي', 'المحامي العام', 'النائب', 'الوزير', 'الحاكم',
        'المعلم', 'الأستاذ', 'الدكتور', 'الباحث', 'الصحفي', 'الكاتب', 'الشاعر', 'الفنان', 'النحات',
        'المصور', 'الممثل', 'المخرج', 'المغني', 'الموسيقي', 'الرقاص', 'الطباخ', 'النادل', 'السائق',
        'الطيار', 'الربان', 'المضيف', 'الضابط', 'الجندي', 'الضابط', 'الكشاف', 'الحداد', 'النجار',
        'الحديقة', 'الجزار', 'الخباز', 'الحلو', 'الصائغ', 'التاجر', 'المصرفي', 'المحاسب', 'المراجع',
    ],

    // 💻 TECHNOLOGY
    technology: [
        'الكمبيوتر', 'الهاتف', 'الإنترنت', 'البرمجة', 'الذكاء', 'التعلم', 'الشبكة', 'السيرفر',
        'البيانات', 'الخوارزمية', 'التشفير', 'الأمن', 'الهكر', 'الفيروس', 'التورنت', 'الكلاود',
        'الذكاء الاصطناعي', 'التعلم العميق', 'الشبكات العصبية', 'البيانات الضخمة', 'البلوك تشين',
        'العملات الرقمية', 'البيتكوين', 'الإيثيريوم', 'الويب', 'التطبيق', 'المنصة', 'النظام',
        'نظام التشغيل', 'الويندوز', 'اللينكس', 'الأندرويد', 'الآيفون', 'الماك', 'الذكاء', 'التخزين',
        'الذاكرة', 'المعالج', 'البطاقة', 'الشاشة', 'الطابعة', 'الماسح', 'الكاميرا', 'الميكروفون',
    ],

    // 🎲 MIXED
    mixed: [
        'الذكاء', 'الإبداع', 'الصداقة', 'الشجاعة', 'الأمانة', 'الصبر', 'الطائرة', 'الغواصة',
        'الصاروخ', 'الفلسفة', 'الاقتصاد', 'الصحافة', 'السينما', 'الموسيقى', 'الشعر', 'الديمقراطية',
        'الإلكترونيات', 'الأقمار', 'الأرصاد', 'اللغة', 'القواعد', 'الصرف', 'النحو', 'البلاغة',
        'الرياضيات', 'الهندسة', 'الطب', 'الفقه', 'أصول الدين', 'التفسير', 'الحديث', 'السيرة',
        'الفلك', 'النجوم', 'الكواكب', 'المجرة', 'الشمس', 'القمر', 'الأرض', 'المريخ', 'الزهرة',
    ],
};

// ─── Arabic Keyboard ───────────────────────────────────────────────────────────
const AR_KEYBOARD = [
    ['ا', 'أ', 'إ', 'آ', 'ء', 'ب', 'ت', 'ث', 'ج', 'ح'],
    ['خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط'],
    ['ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه'],
    ['و', 'ي', 'ة', 'ى', 'ئ', 'ؤ', ' '],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pickWordFromCategory(category: string): string {
    const pool = category === 'mixed'
        ? Object.values(WORD_BANK).flat()
        : (WORD_BANK[category] ?? WORD_BANK.mixed);
    return pool[Math.floor(Math.random() * pool.length)];
}

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
    word:        string;
    category:    string;
    difficulty:  string;
    players:     PlayerState[];
    startedAt:   number;
    winnerId:    string | null;
    hintsUsed:   number;
}

// ─── Sound ────────────────────────────────────────────────────────────────────
function useSound() {
    const ctx = useRef<AudioContext | null>(null);
    const get = () => {
        if (!ctx.current) ctx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return ctx.current;
    };

    return useCallback((type: 'correct' | 'wrong' | 'win' | 'lose' | 'tick' | 'hint') => {
        try {
            const ac = get(), now = ac.currentTime;
            if (type === 'correct') {
                [523, 659].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'sine'; o.frequency.value = f;
                    const t = now + i * 0.1;
                    g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
                    o.start(t); o.stop(t + 0.12);
                });
            }
            if (type === 'wrong') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sawtooth'; o.frequency.value = 150;
                g.gain.setValueAtTime(0.15, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                o.start(now); o.stop(now + 0.15);
            }
            if (type === 'win') {
                [523, 659, 784, 1047].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'triangle'; o.frequency.value = f;
                    const t = now + i * 0.1;
                    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                    o.start(t); o.stop(t + 0.25);
                });
            }
            if (type === 'lose') {
                [330, 220, 165].forEach((f, i) => {
                    const o = ac.createOscillator(), g = ac.createGain();
                    o.connect(g); g.connect(ac.destination);
                    o.type = 'sine'; o.frequency.value = f;
                    const t = now + i * 0.2;
                    g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                    o.start(t); o.stop(t + 0.2);
                });
            }
            if (type === 'tick') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.value = 880;
                g.gain.setValueAtTime(0.06, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                o.start(now); o.stop(now + 0.05);
            }
            if (type === 'hint') {
                const o = ac.createOscillator(), g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.type = 'sine'; o.frequency.value = 600;
                g.gain.setValueAtTime(0.1, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                o.start(now); o.stop(now + 0.2);
            }
        } catch (_) {}
    }, []);
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
const fireConfetti = () => {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;';
    document.body.appendChild(canvas);
    const myConfetti = confetti.create(canvas, { resize: true, useWorker: false });
    const colors = ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#f97316', '#fbbf24', '#ffffff'];
    myConfetti({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors, zIndex: 99999 });
    myConfetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors, zIndex: 99999 });
    setTimeout(() => canvas.remove(), 4000);
};

// ─── Hangman SVG (More Detailed) ─────────────────────────────────────────────
function HangmanSVG({ wrong, maxWrong }: { wrong: number; maxWrong: number }) {
    const pct   = wrong / maxWrong;
    const color = pct >= 1 ? '#ef4444' : pct >= 0.6 ? '#f97316' : pct >= 0.3 ? '#eab308' : '#6366f1';

    return (
        <svg viewBox="0 0 100 110" className="w-full h-full" strokeLinecap="round" strokeLinejoin="round">
            {/* Gallows */}
            <line x1="10" y1="105" x2="90" y2="105" stroke="#94a3b8" strokeWidth="3"/>
            <line x1="25" y1="105" x2="25" y2="10"  stroke="#94a3b8" strokeWidth="3"/>
            <line x1="25" y1="10"  x2="60" y2="10"  stroke="#94a3b8" strokeWidth="3"/>
            <line x1="60" y1="10"  x2="60" y2="22"  stroke="#94a3b8" strokeWidth="3"/>

            {/* Head */}
            {wrong >= 1 && (
                <circle cx="60" cy="30" r="8" stroke={color} strokeWidth="2.5" fill="none"
                    className={wrong >= maxWrong ? 'animate-pulse' : ''}/>
            )}

            {/* Body */}
            {wrong >= 2 && <line x1="60" y1="38" x2="60" y2="65" stroke={color} strokeWidth="2.5"/>}

            {/* Arms */}
            {wrong >= 3 && <line x1="60" y1="45" x2="45" y2="57" stroke={color} strokeWidth="2.5"/>}
            {wrong >= 4 && <line x1="60" y1="45" x2="75" y2="57" stroke={color} strokeWidth="2.5"/>}

            {/* Legs */}
            {wrong >= 5 && <line x1="60" y1="65" x2="45" y2="80" stroke={color} strokeWidth="2.5"/>}
            {wrong >= 6 && <line x1="60" y1="65" x2="75" y2="80" stroke={color} strokeWidth="2.5"/>}

            {/* Extra for Easy mode */}
            {wrong >= 7 && <line x1="45" y1="57" x2="40" y2="50" stroke={color} strokeWidth="2"/>}
            {wrong >= 8 && <line x1="75" y1="57" x2="80" y2="50" stroke={color} strokeWidth="2"/>}

            {/* Dead Face */}
            {wrong >= maxWrong && (
                <>
                    <line x1="56" y1="27" x2="58" y2="29" stroke={color} strokeWidth="1.5"/>
                    <line x1="58" y1="27" x2="56" y2="29" stroke={color} strokeWidth="1.5"/>
                    <line x1="62" y1="27" x2="64" y2="29" stroke={color} strokeWidth="1.5"/>
                    <line x1="64" y1="27" x2="62" y2="29" stroke={color} strokeWidth="1.5"/>
                    <path d="M56 34 Q60 31 64 34" stroke={color} strokeWidth="1.5" fill="none"/>
                </>
            )}

            {/* Alive Smile */}
            {wrong > 0 && wrong < maxWrong && (
                <path d="M56 33 Q60 36 64 33" stroke={color} strokeWidth="1.5" fill="none"/>
            )}

            {/* Remaining Lives Indicator */}
            <text x="50" y="98" textAnchor="middle" className="text-[8px] fill-gray-400 font-bold">
                {maxWrong - wrong}/{maxWrong}
            </text>
        </svg>
    );
}

// ─── Word Display ─────────────────────────────────────────────────────────────
function WordDisplay({ word, guessed, solved, eliminated, maxWrong, wrong }: {
    word: string; guessed: string[]; solved: boolean; eliminated: boolean;
    maxWrong: number; wrong: number;
}) {
    const uniqueLetters = [...new Set(word.split('').filter(c => c !== ' ').map(normalizeChar))];
    const revealedCount = uniqueLetters.filter(l => guessed.some(g => normalizeChar(g) === l)).length;
    const progress = (revealedCount / uniqueLetters.length) * 100;

    return (
        <div className="flex flex-col gap-3">
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                        width: `${progress}%`,
                        background: progress >= 80 ? '#22c55e' : progress >= 50 ? '#eab308' : '#6366f1'
                    }}
                />
            </div>

            <div className="flex gap-1.5 flex-wrap justify-center" dir="rtl">
                {word.split('').map((ch, i) => {
                    if (ch === ' ') return <div key={i} className="w-4"/>;
                    const revealed = solved || eliminated || isLetterRevealed(ch, guessed);
                    return (
                        <div key={i} className="flex flex-col items-center gap-0.5">
                            <span className={`text-2xl font-black min-w-[2rem] text-center transition-all duration-300 ${
                                revealed
                                    ? solved ? 'text-green-600' : eliminated ? 'text-red-500' : 'text-gray-800'
                                    : 'text-transparent'
                            }`}>
                                {revealed ? ch : 'ـ'}
                            </span>
                            <div className={`h-1 w-6 rounded-full transition-all ${
                                revealed
                                    ? solved ? 'bg-green-400' : eliminated ? 'bg-red-300' : 'bg-indigo-400'
                                    : 'bg-gray-300'
                            }`}/>
                        </div>
                    );
                })}
            </div>

            {/* Progress Text */}
            <p className="text-xs text-gray-400 text-center">
                {revealedCount} من {uniqueLetters.length} حرف {eliminated && `(استخدمت ${wrong} من ${maxWrong} فرص)`}
            </p>
        </div>
    );
}

// ─── Lives Bar ────────────────────────────────────────────────────────────────
function LivesBar({ wrong, maxWrong }: { wrong: number; maxWrong: number }) {
    return (
        <div className="flex gap-1.5 justify-center">
            {Array.from({ length: maxWrong }).map((_, i) => (
                <Heart key={i} className={`w-5 h-5 transition-all duration-300 ${
                    i < maxWrong - wrong
                        ? wrong > maxWrong * 0.6 ? 'text-orange-400 fill-orange-400' : 'text-red-500 fill-red-500'
                        : 'text-gray-200 fill-gray-200'
                }`}/>
            ))}
        </div>
    );
}

// ─── Keyboard Button ─────────────────────────────────────────────────────────
function KeyboardButton({ letter, used, inWord, onClick, disabled }: {
    letter: string; used: boolean; inWord: boolean | null; onClick: () => void; disabled: boolean;
}) {
    if (letter === ' ') return <div className="w-4"/>;

    return (
        <button
            onClick={onClick}
            disabled={used || disabled}
            className={`w-9 h-10 rounded-xl font-black text-base transition-all border-2 active:scale-95 ${
                used
                    ? inWord === true
                        ? 'bg-green-100 border-green-300 text-green-700 cursor-not-allowed'
                        : inWord === false
                            ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed'
                            : 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 shadow-sm'
            } ${disabled ? 'opacity-50' : ''}`}
        >
            {letter}
        </button>
    );
}

// ─── Player Row ───────────────────────────────────────────────────────────────
function PlayerRow({ ps, isMe, rank, maxWrong }: { ps: PlayerState; isMe: boolean; rank: number; maxWrong: number }) {
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
            isMe           ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/30' :
            ps.solved      ? 'border-green-200 bg-green-50 dark:bg-green-900/30' :
            ps.eliminated  ? 'border-red-100 bg-red-50/50 dark:bg-red-900/30 opacity-60' :
                             'border-gray-100 bg-white dark:bg-gray-800 dark:border-gray-700'
        }`}>
            <span className={`text-base w-6 text-center flex-shrink-0 ${
                rank <= 3 ? 'text-amber-500' : 'text-gray-400'
            }`}>
                {medal ?? `#${rank}`}
            </span>
            <p className={`text-xs font-black flex-1 truncate ${isMe ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-200'}`}>
                {ps.name}{isMe && ' (أنت)'}
            </p>
            {ps.solved && (
                <span className="text-[10px] font-black text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded-full">
                    ✓ حلّها!
                </span>
            )}
            {ps.eliminated && !ps.solved && (
                <span className="text-[10px] font-black text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded-full">
                    💀 خرج
                </span>
            )}
            {!ps.solved && !ps.eliminated && (
                <div className="flex gap-0.5">
                    {Array.from({ length: maxWrong }).map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full transition-all ${
                            i < maxWrong - ps.wrong
                                ? ps.wrong > maxWrong * 0.6 ? 'bg-orange-400' : 'bg-red-400'
                                : 'bg-gray-200 dark:bg-gray-600'
                        }`}/>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Category Display (No Hints) ───────────────────────────────────────────────
function CategoryBadge({ category }: { category: string }) {
    const catInfo = CATEGORIES.find(c => c.key === category || c.label === category);
    return (
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full bg-gradient-to-r ${catInfo?.color ?? 'from-gray-400 to-gray-500'} text-white shadow-sm`}>
            <span>{catInfo?.emoji ?? '🎲'}</span>
            <span>{catInfo?.label ?? category}</span>
        </span>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
    match: any;
    employee: Employee;
    onExit: () => void;
    grantPoints: (pts: number) => Promise<void>;
}

export default function HangmanGame({ match, employee, onExit, grantPoints }: Props) {
    const play = useSound();
    const myId = employee.employee_id;
    const isHost = match.players?.[0]?.id === myId;

    const gs: HangmanGS = match.game_state ?? {};
    const word: string = gs.word ?? '';
    const players: PlayerState[] = gs.players ?? [];
    const status: string = match.status ?? 'waiting';
    const difficulty = gs.difficulty ?? 'medium';
    const maxWrong = getMaxWrong(difficulty);

    const myPS = players.find(p => p.id === myId);
    const myGuessed = myPS?.guessed ?? [];
    const myWrong = myPS?.wrong ?? 0;
    const mySolved = myPS?.solved ?? false;
    const myEliminated = myPS?.eliminated ?? false;

    const [selectedCat, setSelectedCat] = useState('medical');
    const [selectedDiff, setSelectedDiff] = useState('medium');
    const [timeLeft, setTimeLeft] = useState(ROUND_SECS);
    const [showHint, setShowHint] = useState(false);
    const prevTickRef = useRef(ROUND_SECS);
    const resultDoneRef = useRef(false);
    const [usedHint, setUsedHint] = useState(false);

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

            if (left === 0 && isHost && status === 'playing') {
                finishGame(null);
            }
        };

        tick();
        const iv = setInterval(tick, 500);
        return () => clearInterval(iv);
    }, [status, gs.startedAt, isHost]);

    // ── Grant points ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'finished' || resultDoneRef.current) return;
        resultDoneRef.current = true;

        const isWinner = gs.winnerId === myId;
        const points = isWinner ? 25 : mySolved ? 10 : 0;

        if (points > 0) {
            play('win');
            fireConfetti();
            grantPoints(points);
        } else {
            play('lose');
        }
    }, [status]);

    // ── Guess ─────────────────────────────────────────────────────────────────
    const handleGuess = async (letter: string) => {
        if (mySolved || myEliminated || status !== 'playing') return;
        if (myGuessed.some(g => normalizeChar(g) === normalizeChar(letter))) return;

        const inWord = wordContains(word, letter);
        const newGuessed = [...myGuessed, letter];
        const newWrong = inWord ? myWrong : myWrong + 1;
        play(inWord ? 'correct' : 'wrong');

        const solved = isWordSolved(word, newGuessed);
        const eliminated = newWrong >= maxWrong;

        const updatedPlayers = players.map(p =>
            p.id === myId
                ? { ...p, guessed: newGuessed, wrong: newWrong, solved, eliminated,
                    solvedAt: solved ? Date.now() : p.solvedAt }
                : p
        );

        const firstSolver = solved && !gs.winnerId;
        const winnerId = firstSolver ? myId : gs.winnerId;
        const allDone = updatedPlayers.every(p => p.solved || p.eliminated);

        await supabase.from('live_matches').update({
            game_state: { ...gs, players: updatedPlayers, winnerId },
            status: firstSolver || allDone ? 'finished' : 'playing',
            winner_id: winnerId,
        }).eq('id', match.id);
    };

    // ── Hint System (Simple - Just reveals a random letter) ──────────────────
    const handleHint = async () => {
        if (usedHint || mySolved || myEliminated || status !== 'playing') return;

        const wordLetters = word.split('').filter(c => c !== ' ');
        const hiddenLetters = wordLetters.filter(ch => !isLetterRevealed(ch, myGuessed));

        if (hiddenLetters.length === 0) return;

        // Pick a random hidden letter
        const hintLetter = hiddenLetters[Math.floor(Math.random() * hiddenLetters.length)];

        play('hint');
        setUsedHint(true);
        setShowHint(true);

        // Auto-guess the hint letter
        await handleGuess(hintLetter);

        // Hide hint after 2 seconds
        setTimeout(() => setShowHint(false), 2000);
    };

    const finishGame = async (forceWinner: string | null) => {
        if (status === 'finished') return;
        const solvers = players.filter(p => p.solved).sort((a, b) => (a.solvedAt ?? 0) - (b.solvedAt ?? 0));
        const winner = forceWinner ?? solvers[0]?.id ?? null;
        await supabase.from('live_matches').update({
            status: 'finished', winner_id: winner,
            game_state: { ...gs, winnerId: winner },
        }).eq('id', match.id);
    };

    // ── Start ─────────────────────────────────────────────────────────────────
    const handleStart = async () => {
        const picked = pickWordFromCategory(selectedCat);
        const catLabel = CATEGORIES.find(c => c.key === selectedCat)?.label ?? selectedCat;
        const matchPlayers: PlayerState[] = match.players.map((p: any) => ({
            id: p.id, name: p.name, guessed: [], wrong: 0,
            solved: false, eliminated: false, solvedAt: null,
        }));

        await supabase.from('live_matches').update({
            status: 'playing',
            game_state: {
                word: picked, category: selectedCat, difficulty: selectedDiff,
                players: matchPlayers, startedAt: Date.now(), winnerId: null, hintsUsed: 0,
            },
        }).eq('id', match.id);
    };

    const sortedPlayers = useMemo(() => {
        return [...players].sort((a, b) => {
            if (a.solved && !b.solved) return -1;
            if (!a.solved && b.solved) return 1;
            if (a.solved && b.solved) return (a.solvedAt ?? 0) - (b.solvedAt ?? 0);
            return a.wrong - b.wrong;
        });
    }, [players]);

    const amIWinner = match.winner_id === myId;
    const timerPct = timeLeft / ROUND_SECS;

    // ── WAITING ───────────────────────────────────────────────────────────────
    if (status === 'waiting') return (
        <div className="py-5 px-4 flex flex-col gap-5" dir="rtl">
            {/* Header */}
            <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-rose-500 to-pink-700 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-2xl text-4xl animate-pulse">
                    🪢
                </div>
                <h3 className="text-xl font-black text-gray-800 dark:text-white mb-1">المشنقة!</h3>
                <p className="text-sm font-bold text-gray-400 dark:text-gray-500">
                    {match.players?.length ?? 0} لاعب في الغرفة
                </p>
            </div>

            {/* Players */}
            <div className="flex flex-wrap gap-2 justify-center">
                {match.players?.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-700 px-3 py-1.5 rounded-full">
                        <span className="text-xs font-bold text-rose-700 dark:text-rose-300">{p.name}</span>
                        {p.id === myId && <span className="text-[10px] text-rose-400">(أنت)</span>}
                    </div>
                ))}
            </div>

            {isHost ? (
                <>
                    {/* Difficulty Selection */}
                    <div>
                        <p className="text-xs font-black text-gray-600 dark:text-gray-300 mb-2.5 text-center flex items-center justify-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500"/> اختر مستوى الصعوبة:
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {DIFFICULTIES.map(diff => (
                                <button
                                    key={diff.key}
                                    onClick={() => setSelectedDiff(diff.key)}
                                    className={`flex flex-col items-center gap-1 px-3 py-3 rounded-2xl border-2 font-black text-sm transition-all ${
                                        selectedDiff === diff.key
                                            ? `bg-gradient-to-r ${diff.color} text-white border-transparent shadow-lg scale-105`
                                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                                    }`}
                                >
                                    <span className="text-xl">{diff.emoji}</span>
                                    <span>{diff.label}</span>
                                    <span className="text-[10px] opacity-70">{diff.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Category Selection */}
                    <div>
                        <p className="text-xs font-black text-gray-600 dark:text-gray-300 mb-2.5 text-center flex items-center justify-center gap-2">
                            <Target className="w-4 h-4 text-rose-500"/> اختر فئة الكلمات:
                        </p>
                        <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat.key}
                                    onClick={() => setSelectedCat(cat.key)}
                                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 font-black text-sm transition-all ${
                                        selectedCat === cat.key
                                            ? `bg-gradient-to-r ${cat.color} text-white border-transparent shadow-lg`
                                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                                    }`}
                                >
                                    <span className="text-lg">{cat.emoji}</span>
                                    <span className="flex-1 text-right">{cat.label}</span>
                                    {selectedCat === cat.key && <span className="text-xs opacity-80">✓</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Start Button */}
                    <button
                        onClick={handleStart}
                        disabled={match.players?.length < 2}
                        className="w-full bg-gradient-to-r from-rose-500 to-pink-700 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Sparkles className="w-5 h-5 inline ml-2"/> ابدأ اللعبة
                    </button>

                    {match.players?.length < 2 && (
                        <p className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 rounded-xl text-center">
                            ⏳ في انتظار لاعب آخر للانضمام...
                        </p>
                    )}
                </>
            ) : (
                <div className="flex items-center gap-2 justify-center text-sm font-bold text-gray-400 dark:text-gray-500 py-6 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                    <Loader2 className="w-4 h-4 animate-spin"/> في انتظار المضيف ليبدأ...
                </div>
            )}

            <button onClick={onExit} className="text-sm font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-center transition-colors">
                ← العودة للغرفة
            </button>
        </div>
    );

    // ── PLAYING ───────────────────────────────────────────────────────────────
    if (status === 'playing') return (
        <div className="flex flex-col gap-3 py-2 px-3" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <CategoryBadge category={gs.category}/>
                        <span className="text-[10px] font-bold text-gray-400">
                            {word.split('').filter(c => c !== ' ').length} حرف
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            difficulty === 'easy' ? 'bg-green-100 text-green-600' :
                            difficulty === 'hard' ? 'bg-red-100 text-red-600' :
                            'bg-amber-100 text-amber-600'
                        }`}>
                            {DIFFICULTIES.find(d => d.key === difficulty)?.label}
                        </span>
                    </div>
                    {/* Hint Display (minimal) */}
                    <div className={`text-sm font-black text-gray-700 dark:text-gray-200 truncate transition-all ${
                        showHint ? 'opacity-100' : 'opacity-0'
                    }`}>
                        💡 تلميح: {word.split('')[Math.floor(Math.random() * word.split('').filter(c => c !== ' ').length)]}
                    </div>
                </div>

                {/* Timer */}
                <div className="relative w-14 h-14 flex-shrink-0">
                    <svg width={56} height={56} viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx={28} cy={28} r={24} fill="none" stroke="#e5e7eb" strokeWidth={4}/>
                        <circle cx={28} cy={28} r={24} fill="none"
                            stroke={timerPct < 0.2 ? '#ef4444' : timerPct < 0.4 ? '#f97316' : '#22c55e'}
                            strokeWidth={4}
                            strokeDasharray={2 * Math.PI * 24}
                            strokeDashoffset={2 * Math.PI * 24 * (1 - timerPct)}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.4s' }}
                        />
                    </svg>
                    <div className={`absolute inset-0 flex items-center justify-center ${
                        timerPct < 0.2 ? 'text-red-600' : timerPct < 0.4 ? 'text-orange-500' : 'text-green-600'
                    }`}>
                        <Timer className="w-4 h-4"/>
                        <span className="text-xs font-black mr-0.5">
                            {timeLeft < 60 ? timeLeft : `${Math.floor(timeLeft/60)}:${String(timeLeft%60).padStart(2,'0')}`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Game Board */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                <div className="flex items-start gap-3">
                    <div className="w-24 h-24 flex-shrink-0">
                        <HangmanSVG wrong={myWrong} maxWrong={maxWrong}/>
                    </div>
                    <div className="flex-1 flex flex-col gap-3 pt-1">
                        <WordDisplay
                            word={word}
                            guessed={myGuessed}
                            solved={mySolved}
                            eliminated={myEliminated}
                            maxWrong={maxWrong}
                            wrong={myWrong}
                        />
                        <LivesBar wrong={myWrong} maxWrong={maxWrong}/>

                        {/* Status Messages */}
                        {mySolved && (
                            <div className="text-center text-sm font-black text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded-xl py-2 animate-bounce">
                                🎉 أحسنت! حللتها في {myGuessed.length} محاولة!
                            </div>
                        )}
                        {myEliminated && (
                            <div className="text-center text-sm font-black text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-xl py-2">
                                💀 استنفدت فرصك! الكلمة: <span className="font-black">{word}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Players */}
            {players.length > 1 && (
                <div className="space-y-1.5">
                    <p className="text-[11px] font-black text-gray-400 dark:text-gray-500 px-1 flex items-center gap-1">
                        <Users className="w-3 h-3"/> اللاعبون:
                    </p>
                    {sortedPlayers.map((ps, i) => (
                        <PlayerRow key={ps.id} ps={ps} isMe={ps.id === myId} rank={i + 1} maxWrong={maxWrong}/>
                    ))}
                </div>
            )}

            {/* Hint Button */}
            {!mySolved && !myEliminated && !usedHint && (
                <button
                    onClick={handleHint}
                    className="w-full flex items-center justify-center gap-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-600 dark:text-amber-400 py-2 rounded-xl font-bold text-sm hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all"
                >
                    💡 استخدم تلميح (يكشف حرفاً عشوائياً)
                </button>
            )}

            {/* Keyboard */}
            {!mySolved && !myEliminated && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-3">
                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 mb-2 text-center">
                        اختر حرفاً:
                    </p>
                    <div className="flex flex-col gap-1.5">
                        {AR_KEYBOARD.map((row, i) => (
                            <div key={i} className="flex gap-1.5 justify-center">
                                {row.map(letter => (
                                    <KeyboardButton
                                        key={letter}
                                        letter={letter}
                                        used={myGuessed.some(g => normalizeChar(g) === normalizeChar(letter))}
                                        inWord={letter !== ' ' ? wordContains(word, letter) ? wordContains(word, letter) ? true : null : null : null}
                                        onClick={() => handleGuess(letter)}
                                        disabled={mySolved || myEliminated || status !== 'playing'}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Solved State */}
            {mySolved && (
                <div className="text-center bg-green-50 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-700 rounded-2xl py-4 px-3">
                    <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-1"/>
                    <p className="text-sm font-black text-green-800 dark:text-green-200">
                        You've solved it! Waiting for other players...
                    </p>
                </div>
            )}

            <button
                onClick={onExit}
                className="text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-1 text-center transition-colors"
            >
                ← العودة للغرفة
            </button>
        </div>
    );

    // ── FINISHED ──────────────────────────────────────────────────────────────
    if (status === 'finished') return (
        <div className="flex flex-col gap-3 py-2 px-3 animate-in fade-in duration-400" dir="rtl">
            {/* Result Banner */}
            <div className={`rounded-2xl p-5 text-center text-white shadow-xl ${
                amIWinner
                    ? 'bg-gradient-to-br from-yellow-400 to-amber-500'
                    : mySolved
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                        : 'bg-gradient-to-br from-gray-500 to-gray-700'
            }`}>
                {amIWinner ? (
                    <>
                        <Trophy className="w-16 h-16 mx-auto mb-2 drop-shadow-xl animate-bounce"/>
                        <h3 className="text-2xl font-black">🎉 أنت الأسرع!</h3>
                        <p className="text-amber-100 text-sm mt-1">+25 نقطة 🏆</p>
                        <p className="text-amber-200 text-xs mt-1">
                            {word.split('').filter(c => c !== ' ').length - [...new Set(myGuessed.filter(g => wordContains(word, g)))].length === 0 ? '' : ''}
                        </p>
                    </>
                ) : mySolved ? (
                    <>
                        <div className="text-5xl mb-2">🌟</div>
                        <h3 className="text-2xl font-black">أحسنت!</h3>
                        <p className="text-green-100 text-sm mt-1">+10 نقاط</p>
                    </>
                ) : (
                    <>
                        <Skull className="w-16 h-16 mx-auto mb-2 opacity-70"/>
                        <h3 className="text-2xl font-black">لم تكملها</h3>
                        <p className="text-gray-300 text-sm mt-1">الكلمة: <span className="text-white font-black">{word}</span></p>
                    </>
                )}
            </div>

            {/* Word Reveal */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 text-center">
                <p className="text-xs font-black text-gray-400 dark:text-gray-500 mb-2">الكلمة الصحيحة</p>
                <p className="text-2xl font-black text-gray-800 dark:text-white">{word}</p>
                <div className="mt-2">
                    <CategoryBadge category={gs.category}/>
                </div>
            </div>

            {/* Final Rankings */}
            <div className="space-y-1.5">
                <p className="text-xs font-black text-gray-500 dark:text-gray-400 px-1 flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-500"/> الترتيب النهائي:
                </p>
                {sortedPlayers.map((ps, i) => (
                    <PlayerRow key={ps.id} ps={ps} isMe={ps.id === myId} rank={i + 1} maxWrong={maxWrong}/>
                ))}
            </div>

            {/* Play Again Button */}
            <button
                onClick={onExit}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-700 text-white py-3.5 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
                <RotateCcw className="w-5 h-5"/> العودة للغرفة
            </button>
        </div>
    );

    return null;
}
