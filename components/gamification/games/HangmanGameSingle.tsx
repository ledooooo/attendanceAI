import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Skull, CheckCircle, XCircle, Loader2, ArrowRight, Star, Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { Employee } from '../../../types';

interface Props {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
    employee?: Employee;
}

// ─── 1. إعدادات المستويات ────────────────────────────────────────────────────────
const DIFFICULTIES = [
    { id: 'easy', label: 'سهل', attempts: 6, points: 15, color: 'from-emerald-500 to-teal-500' },
    { id: 'medium', label: 'متوسط', attempts: 5, points: 20, color: 'from-blue-500 to-indigo-500' },
    { id: 'hard', label: 'صعب', attempts: 4, points: 25, color: 'from-orange-500 to-red-500' },
    { id: 'expert', label: 'صعب جداً', attempts: 3, points: 30, color: 'from-purple-600 to-gray-900' }
];

const BONUS_LEVELS = [
    { id: 'سهل', points: 10, time: 20 },
    { id: 'متوسط', points: 20, time: 20 },
    { id: 'صعب', points: 30, time: 30 }
];

// ─── 2. الحروف العربية الشاملة ───────────────────────────────────────────────────
const ARABIC_KEYBOARD = [
    'ض', 'ص', 'ث', 'ق', 'ف', 'غ',
    'ع', 'ه', 'خ', 'ح', 'ج', 'د',
    'ش', 'س', 'ي', 'ب', 'ل', 'ا',
    'ت', 'ن', 'م', 'ك', 'ط', 'ذ',
    'ر', 'ز', 'و', 'ة', 'ى', 'ظ',
    'أ', 'إ', 'آ', 'ء', 'ؤ', 'ئ'
];

// ─── 3. بنك الكلمات (أكثر من 50 لكل مجال) ────────────────────────────────────────
const CATEGORIES = {
    celebrities: { label: 'مشاهير مصريين', words: ["عادل إمام", "عمرو دياب", "محمد صلاح", "أحمد زكي", "أم كلثوم", "عبد الحليم حافظ", "مجدي يعقوب", "أحمد زويل", "نجيب محفوظ", "طه حسين", "محمود المليجي", "يحيى الفخراني", "سعاد حسني", "فاتن حمامة", "شادية", "نادية لطفي", "عمر الشريف", "فريد شوقي", "إسماعيل ياسين", "رشدي أباظة", "حسن يوسف", "أحمد مظهر", "كمال الشناوي", "عبد المنعم مدبولي", "فؤاد المهندس", "محمد عبد الوهاب", "محمود درويش", "مصطفى محمود", "أحمد شوقي", "توفيق الحكيم", "عباس العقاد", "يوسف إدريس", "يحيى حقي", "أنيس منصور", "سميرة موسى", "فاروق الباز", "هاني عازر", "مصطفى السيد", "محمد البرادعي", "علي مشرفة", "يوسف شاهين", "حسن فتحي", "سيد درويش", "محمود مختار", "زكي نجيب محمود", "عائشة عبد الرحمن", "مي زيادة", "هدى شعراوي", "نوال السعداوي", "سمير غانم", "أحمد حلمي", "تامر حسني"] },
    countries: { label: 'اسماء بلاد', words: ["مصر", "السعودية", "الإمارات", "الكويت", "البحرين", "عمان", "قطر", "اليمن", "العراق", "سوريا", "الجزائر", "تونس", "المغرب", "ليبيا", "السودان", "فلسطين", "الأردن", "لبنان", "جيبوتي", "موريتانيا", "الصومال", "تركيا", "اليابان", "الصين", "كوريا", "الهند", "باكستان", "إندونيسيا", "ماليزيا", "إيران", "بريطانيا", "فرنسا", "ألمانيا", "إيطاليا", "إسبانيا", "البرتغال", "اليونان", "السويد", "سويسرا", "هولندا", "بلجيكا", "روسيا", "أوكرانيا", "أمريكا", "كندا", "البرازيل", "الأرجنتين", "أستراليا", "المكسيك", "النرويج", "فنلندا"] },
    movies: { label: 'أفلام مصرية', words: ["الإرهابي", "العفاريت", "عمارة يعقوبيان", "الجزيرة", "الممر", "الفيل الأزرق", "الكيف", "صعيدي في الجامعة", "همام في أمستردام", "الناظر", "عبود على الحدود", "مافيا", "تيتو", "ملاكي إسكندرية", "ولاد العم", "إبراهيم الأبيض", "المصلحة", "الخلية", "كازابلانكا", "هروب اضطراري", "نادي الرجال السري", "ولاد رزق", "الفلوس", "الكنز", "حرب كرموز", "تراب الماس", "كيرة والجن", "العارف", "موسى", "الإنس والنمس", "بحبك", "عمهم", "واحد تاني", "وقفة رجالة", "البعض لا يذهب للمأذون", "مش أنا", "ديدو", "زنزانة سبعة", "الغسالة", "الصندوق الأسود", "صاحب المقام", "توأم روحي", "الحارث", "لص بغداد", "خيال مآتة", "سبع البرمبة", "الناظر", "اللمبي", "بوحة", "عوكل"] },
    series: { label: 'مسلسلات مصرية', words: ["رأفت الهجان", "ليالي الحلمية", "لن أعيش في جلباب أبي", "الاختيار", "الجماعة", "زيزينيا", "المال والبنون", "ذئاب الجبل", "يتربى في عزو", "الضوء الشارد", "البخيل وأنا", "يوميات ونيس", "أوبرا عايدة", "أرابيسك", "الشهد والدموع", "غوايش", "بوابة الحلواني", "رحلة السيد أبو العلا", "العائلة", "نصف ربيع الآخر", "الوتد", "خالتي صفية والدير", "امرأة من زمن الحب", "أم كلثوم", "أوان الورد", "أين قلبي", "أوراق مصرية", "عائلة الحاج متولي", "يوميات مدير عام", "العيان", "حديث الصباح والمساء", "أميرة في عابدين", "الليل وآخره", "أسمهان", "الملك فاروق", "أهل كايرو", "عايزة أتجوز", "نيران صديقة", "دوران شبرا", "المواطن إكس", "رقم مجهول", "طرف ثالث", "بدون ذكر أسماء", "السبع وصايا", "سجن النسا", "طريقي", "جراند أوتيل", "أفراح القبة", "الأسطورة", "كلبش"] },
    landmarks: { label: 'معالم شهيرة', words: ["الأهرامات", "أبو الهول", "برج القاهرة", "قلعة صلاح الدين", "معبد الكرنك", "خان الخليلي", "الكعبة", "برج إيفل", "ساعة بيج بن", "سور الصين العظيم", "تمثال الحرية", "تاج محل", "الكولوسيوم", "ماتشو بيتشو", "البتراء", "برج خليفة", "برج العرب", "مسجد الشيخ زايد", "المسجد الأقصى", "قبة الصخرة", "المسجد النبوي", "الجامع الأموي", "قلعة حلب", "مدرج بصرى", "قلعة الحصن", "مدينة طروادة", "قصر الحمراء", "مسجد قرطبة", "متحف اللوفر", "الكرملين", "الساحة الحمراء", "جبل إفرست", "شلالات نياجرا", "جبل كليمنجارو", "جزيرة بالي", "جزر المالديف", "شلالات فيكتوريا", "جبال الألب", "غابات الأمازون", "نهر النيل", "نهر الأمازون", "نهر الدانوب", "نهر الراين", "نهر التايمز", "نهر السين", "جزر الكناري", "جزر هاواي", "برج بيزا المائل", "ساعة مكة", "متحف الشمع"] },
    egyptian_novels: { label: 'روايات مصرية', words: ["ثلاثية القاهرة", "أولاد حارتنا", "الحرافيش", "بين القصرين", "قصر الشوق", "السكرية", "زقاق المدق", "اللص والكلاب", "خان الخليلي", "ميرامار", "الكرنك", "حديث الصباح والمساء", "أفراح القبة", "يوميات نائب في الأرياف", "دعاء الكروان", "البوسطجي", "رد قلبي", "لا أنام", "في بيتنا رجل", "شيء في صدري", "لا تطفئ الشمس", "نحن لا نزرع الشوك", "الباب المفتوح", "الأرض", "الحرام", "النداهة", "عزازيل", "يوتوبيا", "الفيل الأزرق", "تراب الماس", "لوكاندة بير الوطاويط", "شيكاغو", "عمارة يعقوبيان", "نداء المجهول", "الرجل الذي فقد ظله", "أرض النفاق", "أنا حرة", "أنف وثلاث عيون", "الخيط الرفيع", "إمبراطورية ميم", "ذات", "رادوبيس", "واحة الغروب", "نادي السيارات", "طوق الحمامة", "ربع جرام", "في ممر الفئران", "صانع الظلام", "هيبتا"] },
    global_novels: { label: 'روايات عالمية', words: ["البؤساء", "الجريمة والعقاب", "الإخوة كارامازوف", "الحرب والسلام", "مائة عام من العزلة", "الخيميائي", "الحب في زمن الكوليرا", "دون كيشوت", "شيفرة دا فينشي", "ملائكة وشياطين", "الجحيم", "الكوميديا الإلهية", "العجوز والبحر", "ذهب مع الريح", "وداعا للسلاح", "لمن تقرع الأجراس", "مزرعة الحيوان", "غاتسبي العظيم", "كبرياء وتحامل", "جين أير", "مرتفعات وذرينغ", "صورة دوريان غراي", "آمال عظيمة", "أوليفر تويست", "ديفيد كوبرفيلد", "قصة مدينتين", "مدام بوفاري", "البحث عن الزمن المفقود", "الغريب", "المسخ", "الطاعون", "محاكمة كافكا", "العمى", "الخطيئة الأولى", "آنا كارنينا", "الآمال الكبرى", "هاملت", "ماكبث", "عطيل", "روميو وجولييت", "كينغ لير", "فاوست", "الإلياذة", "الأوديسة", "موبي ديك", "جزيرة الكنز", "فرانكشتاين", "دراكولا", "أليس في بلاد العجائب"] }
};

export default function HangmanGame({ onStart, onComplete, employee }: Props) {
    const [phase, setPhase] = useState<'setup' | 'playing' | 'puzzle_solved' | 'loading_quiz' | 'quiz' | 'summary'>('setup');
    const [starting, setStarting] = useState(false);
    
    // Game Options
    const [selectedCategory, setSelectedCategory] = useState<keyof typeof CATEGORIES | null>(null);
    const [selectedDiff, setSelectedDiff] = useState<typeof DIFFICULTIES[0] | null>(null);
    
    // Hangman State
    const [secretWord, setSecretCode] = useState('');
    const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
    const [mistakes, setMistakes] = useState(0);
    const [maxMistakes, setMaxMistakes] = useState(6);
    
    // Quiz & Settings
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [totalScore, setTotalScore] = useState(0);
    const [quizQuestion, setQuizQuestion] = useState<any>(null);
    const [selectedBonus, setSelectedBonus] = useState<typeof BONUS_LEVELS[0] | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const handleQuizAnswerRef = useRef<(idx: number) => void>();

    const playSound = useCallback((type: 'win' | 'lose') => {
        if (!soundEnabled) return;
        try { new Audio(type === 'win' ? '/applause.mp3' : '/fail.mp3').play().catch(() => {}); } catch {}
    }, [soundEnabled]);

    // ─── 1. بدء اللعبة ──────────────────────────────────────────────────────────
    const startGame = async () => {
        if (!selectedCategory || !selectedDiff) {
            toast.error('الرجاء اختيار المجال ومستوى الصعوبة أولاً!');
            return;
        }
        
        setStarting(true);
        try { await onStart(); } catch { setStarting(false); return; }
        
        const words = CATEGORIES[selectedCategory].words;
        const randomWord = words[Math.floor(Math.random() * words.length)];
        
        setSecretCode(randomWord);
        setMaxMistakes(selectedDiff.attempts);
        setMistakes(0);
        setGuessedLetters([]);
        setTotalScore(0);
        setPhase('playing');
        setStarting(false);
    };

    // ─── 2. الضغط على الحروف ────────────────────────────────────────────────────
    const handleGuess = (letter: string) => {
        if (guessedLetters.includes(letter)) return;

        const newGuessed = [...guessedLetters, letter];
        setGuessedLetters(newGuessed);

        if (!secretWord.includes(letter)) {
            const newMistakes = mistakes + 1;
            setMistakes(newMistakes);
            
            if (newMistakes >= maxMistakes) {
                // خسر اللعبة
                playSound('lose');
                toast.error(`لعبة موفقة، ولكن الكلمة هي: ${secretWord}`);
                setTimeout(() => onComplete(0, false), 3500);
            }
        } else {
            // تحقق من الفوز
            const isWin = secretWord.split('').every(char => char === ' ' || newGuessed.includes(char));
            if (isWin) {
                playSound('win');
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                setTotalScore(selectedDiff!.points);
                toast.success('🎉 بطل! لقد أنقذته!');
                setTimeout(() => setPhase('puzzle_solved'), 2000);
            }
        }
    };

    // ─── 3. جلب سؤال الذكاء الاصطناعي الإضافي ──────────────────────────────────
    const fetchAIQuestion = async (bonus: typeof BONUS_LEVELS[0]) => {
        setSelectedBonus(bonus);
        setPhase('loading_quiz');

        const isMedical = ['بشر', 'أسنان', 'صيدل', 'اسره'].some(s => (employee?.job_title || '').includes(s) || (employee?.specialty || '').includes(s));

        try {
            const { data, error } = await supabase.functions.invoke('generate-smart-quiz', {
                body: {
                    specialty: employee?.job_title || employee?.specialty || 'طبيب بشرى',
                    domain: 'طبي وعلمي',
                    difficulty: bonus.id,
                    length: 'قصير',
                    language: isMedical ? 'English (Professional Medical Terminology)' : 'ar',
                    include_hint: false,
                    game_type: 'mcq',
                    question_count: 5 // 5 لإثراء المحتوى
                }
            });

            if (error || !data) throw new Error('Fetch failed');

            let qArray = Array.isArray(data) ? data : data.questions || [data];
            if (qArray.length === 0) throw new Error('No questions returned');

            const q = qArray[0]; 
            const charToIndex: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
            
            setQuizQuestion({
                question_text: q.question_text || q.question,
                options: Array.isArray(q.options) && q.options.length >= 4 ? q.options : [q.option_a, q.option_b, q.option_c, q.option_d],
                correct_index: charToIndex[q.correct_option || q.correct_answer] ?? 0,
                explanation: q.explanation
            });
            
            setTimeLeft(bonus.time);
            setPhase('quiz');
        } catch (err) {
            toast.error('تم الاحتفاظ بالنقاط الأساسية!');
            onComplete(totalScore, true);
        }
    };

    // مؤقت سؤال الذكاء الاصطناعي
    const handleQuizAnswer = useCallback((idx: number) => {
        if (selectedAnswer !== null) return;
        setSelectedAnswer(idx);
        
        if (idx === quizQuestion?.correct_index) {
            playSound('win');
            confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 } });
            setTotalScore(prev => prev + selectedBonus!.points);
        } else {
            playSound('lose');
        }
        setPhase('summary');
    }, [selectedAnswer, quizQuestion, selectedBonus, playSound]);

    useEffect(() => { handleQuizAnswerRef.current = handleQuizAnswer; }, [handleQuizAnswer]);

    useEffect(() => {
        if (phase !== 'quiz' || selectedAnswer !== null) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(timer); handleQuizAnswerRef.current?.(-1); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [phase, selectedAnswer]);

    // ─── 4. رسم المشنقة التكيفي (SVG) ──────────────────────────────────────────
    const renderHangmanSVG = () => {
        const partsToShow = Math.floor((mistakes / maxMistakes) * 6);
        return (
            <svg viewBox="0 0 200 200" className="w-full h-full stroke-gray-800 fill-transparent stroke-[4px] stroke-linecap-round stroke-linejoin-round">
                {/* القاعدة الأساسية دائمة */}
                <line x1="20" y1="180" x2="100" y2="180" />
                <line x1="60" y1="180" x2="60" y2="20" />
                <line x1="60" y1="20" x2="140" y2="20" />
                <line x1="140" y1="20" x2="140" y2="40" />

                {partsToShow >= 1 && <circle cx="140" cy="60" r="20" />} {/* الرأس */}
                {partsToShow >= 2 && <line x1="140" y1="80" x2="140" y2="130" />} {/* الجسم */}
                {partsToShow >= 3 && <line x1="140" y1="90" x2="115" y2="110" />} {/* اليد اليسرى */}
                {partsToShow >= 4 && <line x1="140" y1="90" x2="165" y2="110" />} {/* اليد اليمنى */}
                {partsToShow >= 5 && <line x1="140" y1="130" x2="120" y2="160" />} {/* القدم اليسرى */}
                {partsToShow >= 6 && <line x1="140" y1="130" x2="160" y2="160" />} {/* القدم اليمنى */}
            </svg>
        );
    };

    // =======================================================================
    // واجهات اللعبة 
    // =======================================================================

    if (phase === 'setup') {
        return (
            <div className="text-center py-4 px-2 animate-in zoom-in-95 flex flex-col h-[85vh] overflow-y-auto pb-10">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-800 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shrink-0">
                    <Skull className="w-10 h-10 text-white animate-pulse" />
                </div>
                <h3 className="text-2xl font-black text-gray-800 mb-2">لعبة المشنقة (Hangman)</h3>
                <p className="text-xs font-bold text-gray-500 mb-4 max-w-sm mx-auto leading-relaxed">
                    اختر المجال والمستوى لتخمين الكلمة السرية قبل أن تكتمل المشنقة!
                </p>

                {/* اختيار المجال مع دعم الأقسام الجديدة والتجاوب */}
                <h4 className="text-sm font-black text-indigo-800 mb-2 text-right">1. اختر المجال:</h4>
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                    {Object.entries(CATEGORIES).map(([key, data]) => (
                        <button key={key} onClick={() => setSelectedCategory(key as keyof typeof CATEGORIES)}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border-2 transition-all flex-grow min-w-[30%] ${selectedCategory === key ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-md scale-105' : 'bg-white border-gray-100 text-gray-600 hover:border-indigo-200'}`}>
                            {data.label}
                        </button>
                    ))}
                </div>

                {/* اختيار المستوى */}
                <h4 className="text-sm font-black text-indigo-800 mb-2 text-right">2. اختر الصعوبة:</h4>
                <div className="grid grid-cols-2 gap-2 mb-6">
                    {DIFFICULTIES.map(diff => (
                        <button key={diff.id} onClick={() => setSelectedDiff(diff)}
                            className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center ${selectedDiff?.id === diff.id ? 'bg-gray-50 border-indigo-500 shadow-md' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                            <span className={`text-transparent bg-clip-text bg-gradient-to-r ${diff.color} font-black text-base mb-1`}>{diff.label}</span>
                            <span className="text-[10px] text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded-md">{diff.attempts} محاولات | {diff.points} نقطة</span>
                        </button>
                    ))}
                </div>

                <button onClick={startGame} disabled={starting} className="w-full max-w-sm mx-auto mt-auto bg-gradient-to-r from-indigo-600 to-purple-800 text-white py-4 rounded-2xl font-black text-base shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2 shrink-0">
                    {starting ? <Loader2 className="w-6 h-6 animate-spin"/> : '🎮 ابدأ التحدي الآن'}
                </button>
            </div>
        );
    }

    if (phase === 'playing') {
        return (
            <div className="max-w-md mx-auto flex flex-col h-[85vh] animate-in slide-in-from-bottom" dir="rtl">
                
                {/* Header Stats */}
                <div className="flex justify-between items-center mb-2 px-2 shrink-0">
                    <div className="bg-indigo-50 text-indigo-800 px-3 py-1.5 rounded-xl font-black text-xs border border-indigo-200">
                        نقاطك: {selectedDiff?.points}
                    </div>
                    <div className="flex gap-1">
                        {[...Array(maxMistakes)].map((_, i) => (
                            <Heart key={i} className={`w-4 h-4 ${i < (maxMistakes - mistakes) ? 'text-red-500 fill-current' : 'text-gray-300'}`} />
                        ))}
                    </div>
                </div>

                {/* Hangman SVG Area */}
                <div className="w-full h-28 md:h-36 bg-gradient-to-b from-slate-50 to-gray-100 rounded-3xl border border-gray-200 shadow-inner flex items-center justify-center shrink-0 mb-4 p-2 relative">
                    <span className="absolute top-2 right-3 text-[10px] font-black text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">{CATEGORIES[selectedCategory as keyof typeof CATEGORIES].label}</span>
                    {renderHangmanSVG()}
                </div>

                {/* 💡 Word Display Area (Smart Word Wrapping) */}
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mb-6 bg-white p-4 rounded-3xl shadow-sm border border-gray-100 min-h-[80px] content-center shrink-0" dir="rtl">
                    {secretWord.split(' ').filter(Boolean).map((word, wordIdx) => (
                        <div key={wordIdx} className="flex gap-1.5" dir="rtl">
                            {word.split('').map((char, charIdx) => {
                                const isRevealed = guessedLetters.includes(char) || mistakes >= maxMistakes;
                                const isMissing = mistakes >= maxMistakes && !guessedLetters.includes(char);
                                return (
                                    <span key={charIdx} className={`w-6 md:w-8 h-10 flex items-center justify-center font-black text-lg md:text-xl border-b-4 rounded-t-md transition-all ${isRevealed ? (isMissing ? 'text-red-500 border-red-300 bg-red-50' : 'text-gray-800 border-indigo-500 bg-indigo-50/30') : 'text-transparent border-gray-300'}`}>
                                        {isRevealed ? char : '_'}
                                    </span>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {/* Arabic Keyboard 6x6 */}
                <div className="mt-auto grid grid-cols-6 gap-1.5 bg-gray-50 p-2 rounded-3xl border border-gray-200 shadow-inner overflow-hidden shrink-0">
                    {ARABIC_KEYBOARD.map((letter) => {
                        const isGuessed = guessedLetters.includes(letter);
                        const isCorrect = isGuessed && secretWord.includes(letter);
                        const isWrong = isGuessed && !secretWord.includes(letter);
                        
                        let btnClass = 'bg-white text-gray-800 border border-gray-200 shadow-sm active:bg-indigo-50 hover:bg-gray-50';
                        if (isCorrect) btnClass = 'bg-emerald-500 text-white border-emerald-600 shadow-inner';
                        if (isWrong) btnClass = 'bg-gray-200 text-gray-400 border-gray-300 opacity-50 cursor-not-allowed';

                        return (
                            <button key={letter} disabled={isGuessed || mistakes >= maxMistakes} onClick={() => handleGuess(letter)}
                                className={`h-10 md:h-12 flex items-center justify-center font-black text-lg md:text-xl rounded-xl transition-all ${btnClass}`}>
                                {letter}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    if (phase === 'puzzle_solved') {
        return (
            <div className="text-center py-8 px-4 animate-in slide-in-from-bottom" dir="rtl">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-black text-gray-800 mb-2">أنقذته ببراعة! 🎉</h3>
                <p className="text-sm font-bold text-gray-600 mb-6">
                    الكلمة هي: <span className="text-indigo-600 font-black mx-1">{secretWord}</span><br/><br/>
                    ضمنت {selectedDiff?.points} نقطة. ضاعفها الآن بسؤال ذكاء اصطناعي!
                </p>
                <div className="grid grid-cols-1 gap-2 max-w-sm mx-auto">
                    {BONUS_LEVELS.map(bonus => (
                        <button key={bonus.id} onClick={() => fetchAIQuestion(bonus)}
                            className="bg-white border-2 border-emerald-200 p-4 rounded-xl hover:bg-emerald-50 transition-all active:scale-95 flex justify-between items-center">
                            <span className="font-black text-sm text-gray-800">مستوى {bonus.id}</span>
                            <span className="text-emerald-600 font-bold bg-emerald-100 px-3 py-1 rounded-lg text-xs">+{bonus.points} نقطة</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (phase === 'loading_quiz') {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-indigo-600 animate-pulse text-center">
                <Loader2 className="w-12 h-12 mb-4 animate-spin mx-auto" />
                <p className="font-black text-lg">جاري سحب سؤال التحدي...</p>
            </div>
        );
    }

    if (phase === 'quiz' || phase === 'summary') {
        if (!quizQuestion) return null;
        const isEnglishQ = /^[A-Za-z]/.test(quizQuestion?.question_text || '');
        
        return (
            <div className="max-w-xl mx-auto w-full animate-in zoom-in-95 duration-300 py-4 px-2" dir="rtl">
                {phase === 'summary' && (
                    <div className="text-center mb-4 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                        <h2 className="text-lg font-black text-gray-800 mb-1">النقاط النهائية المكتسبة</h2>
                        <span className="text-4xl font-black text-emerald-500">{totalScore}</span>
                        <button onClick={() => onComplete(totalScore, true)} className="block w-full mt-4 bg-gray-800 text-white py-3 rounded-xl font-bold active:scale-95 transition-all text-sm">
                            إنهاء وجمع النقاط <ArrowRight className="inline w-4 h-4 ml-1" />
                        </button>
                    </div>
                )}

                <div className="bg-white rounded-3xl p-5 shadow-lg border-t-4 border-indigo-500">
                    <div className="flex justify-between items-center mb-4">
                        <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-black text-xs">مكافأة: +{selectedBonus?.points}</span>
                        {phase === 'quiz' && <span className="bg-gray-100 px-3 py-1.5 rounded-lg font-black text-xs text-red-500 animate-pulse flex items-center gap-1"><Clock className="w-3 h-3"/> {timeLeft}ث</span>}
                    </div>

                    <h3 className={`text-base font-black text-gray-800 leading-relaxed mb-5 ${isEnglishQ ? 'text-left' : 'text-right'}`} dir={isEnglishQ ? 'ltr' : 'rtl'}>
                        {quizQuestion?.question_text}
                    </h3>

                    <div className="grid grid-cols-1 gap-2" dir={isEnglishQ ? 'ltr' : 'rtl'}>
                        {quizQuestion?.options.map((option: string, idx: number) => {
                            let btnClass = 'bg-white border-2 border-gray-100 text-gray-700 hover:border-indigo-300';
                            if (phase === 'summary') {
                                if (idx === quizQuestion.correct_index) btnClass = 'bg-emerald-500 border-emerald-600 text-white shadow-sm';
                                else if (idx === selectedAnswer) btnClass = 'bg-red-500 border-red-600 text-white shadow-sm';
                                else btnClass = 'bg-gray-50 border-gray-100 opacity-50';
                            }
                            return (
                                <button key={idx} onClick={() => handleQuizAnswerRef.current?.(idx)} disabled={phase === 'summary'}
                                    className={`${btnClass} p-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-between ${isEnglishQ ? 'text-left' : 'text-right'}`}>
                                    <span className="flex-1 leading-snug">{option}</span>
                                    {phase === 'summary' && idx === quizQuestion.correct_index && <CheckCircle className="w-4 h-4 flex-shrink-0 ml-2"/>}
                                    {phase === 'summary' && idx === selectedAnswer && idx !== quizQuestion.correct_index && <XCircle className="w-4 h-4 flex-shrink-0 ml-2"/>}
                                </button>
                            );
                        })}
                    </div>

                    {phase === 'summary' && quizQuestion?.explanation && (
                        <div className="mt-4 p-3 rounded-xl text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200" dir={isEnglishQ ? 'ltr' : 'rtl'}>
                            <span className="block mb-1 opacity-70">📚 التفسير:</span>
                            {quizQuestion.explanation}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null;
}
