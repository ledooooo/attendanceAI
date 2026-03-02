import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gamepad2, Lock, Timer, Trophy, Loader2, HelpCircle, Calculator, Brain, Copy, Lightbulb, Zap, Swords, Play, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

// المكونات الفرعية (الألعاب والصالة المباشرة)
import LiveGamesArena from '../../../components/gamification/LiveGamesArena';
import WordScramble from '../../../components/gamification/games/WordScramble';
import MedicalQuiz from '../../../components/gamification/games/MedicalQuiz';
import DoseCalculator from '../../../components/gamification/games/DoseCalculator';
import MedicalMemory from '../../../components/gamification/games/MedicalMemory';
import MedicalRiddles from '../../../components/gamification/games/MedicalRiddles';
import SpeedMath from '../../../components/gamification/games/SpeedMath';

interface Props { employee: Employee; }

const COOLDOWN_HOURS = 5;

// --- خوارزميات التخصص وجلب الأسئلة ---
const getSpecialtyVariations = (spec: string) => {
    if (!spec) return ['الكل'];
    const s = spec.toLowerCase();
    if (s.includes('بشر') || s.includes('عام')) return ['بشري', 'طبيب بشرى', 'طبيب عام'];
    if (s.includes('سنان') || s.includes('أسنان')) return ['أسنان', 'اسنان', 'طبيب أسنان', 'فنى اسنان'];
    if (s.includes('تمريض') || s.includes('ممرض')) return ['تمريض', 'ممرض', 'ممرضة'];
    if (s.includes('صيدل')) return ['صيدلة', 'صيدلي', 'صيدلاني'];
    if (s.includes('معمل') || s.includes('مختبر') || s.includes('كيميائي')) return ['معمل', 'فني معمل', 'مختبر', 'كيميائي'];
    if (s.includes('جود')) return ['جودة', 'الجودة'];
    if (s.includes('عدوى') || s.includes('مراقب')) return ['مكافحة عدوى', 'مكافحه عدوى', 'مراقب'];
    if (s.includes('رائد')) return ['رائدة ريفية'];
    if (s.includes('ملفات') || s.includes('احصاء') || s.includes('كاتب') || s.includes('ادارى')) return ['مسئول ملفات', 'فنى احصاء', 'كاتب', 'ادارى'];
    if (s.includes('علاج طبيعي')) return ['علاج طبيعي', 'علاج طبيعى'];
    return [spec, 'الكل'];
};

const normalizeQuestionFormat = (rawQ: any) => {
    let questionText = rawQ.question || rawQ.question_text || '';
    if (rawQ.scenario) questionText = `${rawQ.scenario} - ${questionText}`; 

    let opts: string[] = [];
    let correctAns = '';

    if (rawQ.source === 'standard_quiz') {
        try { 
            let parsed = JSON.parse(rawQ.options);
            opts = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
            if (!Array.isArray(opts)) opts = [opts]; 
        } catch (e) { opts = []; }
        correctAns = rawQ.correct_answer;
    } else {
        opts = [rawQ.option_a, rawQ.option_b, rawQ.option_c, rawQ.option_d].filter(opt => opt !== null && opt !== undefined && String(opt).trim() !== '');
        if (rawQ.correct_index !== undefined && rawQ.correct_index !== null) {
            correctAns = opts[rawQ.correct_index];
        } else {
            const correctLetter = String(rawQ.correct_option || rawQ.correct_answer || '').trim().toLowerCase();
            if (['a', 'b', 'c', 'd'].includes(correctLetter)) correctAns = rawQ[`option_${correctLetter}`];
            else correctAns = correctLetter;
        }
    }
    return { id: rawQ.id, questionText, options: opts, correctAnswer: String(correctAns).trim().toLowerCase() };
};

// مستويات الصعوبة (تخفيض 5 نقاط)
const DIFF_PROFILES: Record<string, any> = {
    beginner: { level: 'beginner', label: 'مبتدئ', emoji: '🌱', color: 'text-green-500', points: 5, mappedDiff: 'easy', timer: 10 },
    intermediate: { level: 'intermediate', label: 'متوسط', emoji: '🔥', color: 'text-yellow-500', points: 15, mappedDiff: 'medium', timer: 20 },
    advanced: { level: 'advanced', label: 'متقدم', emoji: '⚡', color: 'text-orange-500', points: 25, mappedDiff: 'hard', timer: 30 },
    elite: { level: 'elite', label: 'أسطوري', emoji: '👑', color: 'text-purple-500', points: 45, mappedDiff: 'hard', timer: 30 },
};

// ✅ إضافة الـ 6 ألعاب هنا
const GAMES = [
    { id: 'scramble', name: 'الكلمات المبعثرة', icon: Brain, color: 'bg-purple-50 text-purple-600 border-purple-200' },
    { id: 'quiz', name: 'الاختبار السريع', icon: HelpCircle, color: 'bg-blue-50 text-blue-600 border-blue-200' },
    { id: 'dose', name: 'حساب الجرعات', icon: Calculator, color: 'bg-teal-50 text-teal-600 border-teal-200' },
    { id: 'memory', name: 'الذاكرة الطبية', icon: Copy, color: 'bg-pink-50 text-pink-600 border-pink-200' },
    { id: 'riddle', name: 'الفوازير الطبية', icon: Lightbulb, color: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
    { id: 'math', name: 'السرعة والحساب', icon: Zap, color: 'bg-orange-50 text-orange-600 border-orange-200' },
];

export default function StaffArcade({ employee }: Props) {
    const queryClient = useQueryClient();
    
    // States
    const [activeGame, setActiveGame] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [showLiveArena, setShowLiveArena] = useState(false);
    const [finalQuestionData, setFinalQuestionData] = useState<any>(null);
    const [finalTimer, setFinalTimer] = useState<number>(0);
    const [isFetchingFinal, setIsFetchingFinal] = useState(false);

    // Data Fetching
    const { data: latestSession, isLoading: loadingSession } = useQuery({
        queryKey: ['arcade_latest_session', employee.employee_id],
        queryFn: async () => {
            const { data } = await supabase.from('arcade_sessions').select('*').eq('employee_id', employee.employee_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
            return data || null;
        }
    });

    const { data: totalPoints = 0 } = useQuery({
        queryKey: ['arcade_total_points', employee.employee_id],
        queryFn: async () => {
            const { data } = await supabase.rpc('get_arcade_points', { emp_id: employee.employee_id });
            return data || 0;
        }
    });

    // Mutations
    const startGameMutation = useMutation({
        mutationFn: async () => {
            const { data, error } = await supabase.from('arcade_sessions').insert({ employee_id: employee.employee_id, status: 'playing' }).select().single();
            if (error) throw error;
            return data.id;
        },
        onSuccess: (id) => setSessionId(id)
    });

    const finishGameMutation = useMutation({
        mutationFn: async ({ points_earned, result }: { points_earned: number, result: string }) => {
            if (!sessionId) return;
            await supabase.from('arcade_sessions').update({ status: 'completed', points_earned, completed_at: new Date().toISOString() }).eq('id', sessionId);
            if (points_earned > 0) {
                await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: points_earned });
                await supabase.from('points_ledger').insert({ employee_id: employee.employee_id, points: points_earned, reason: `الفوز في صالة الألعاب 🎮 (${result})` });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['arcade_latest_session'] });
            queryClient.invalidateQueries({ queryKey: ['arcade_total_points'] });
            setActiveGame(null);
            setSessionId(null);
            setFinalQuestionData(null);
        }
    });

    // --- Final Question Logic ---
    const triggerFinalQuestion = async (points: number, diffLabel: string) => {
        setIsFetchingFinal(true);
        const profile = DIFF_PROFILES[diffLabel];
        const variations = getSpecialtyVariations(employee.specialty);
        const orFilter = variations.map(v => `specialty.ilike.%${v}%`).join(',');

        let questionsPool: any[] = [];

        const { data: aqData } = await supabase.from('arcade_quiz_questions').select('*').or(orFilter).eq('difficulty', profile.mappedDiff).limit(10);
        if (aqData) questionsPool = [...questionsPool, ...aqData.map(q => ({ ...q, source: 'arcade_quiz' }))];
        
        const { data: qData } = await supabase.from('quiz_questions').select('*').or(orFilter).limit(10);
        if (qData) questionsPool = [...questionsPool, ...qData.map(q => ({ ...q, source: 'standard_quiz' }))];

        if (questionsPool.length === 0) {
            const { data: fallback } = await supabase.from('arcade_quiz_questions').select('*').limit(20);
            if (fallback) questionsPool = fallback.map(q => ({ ...q, source: 'arcade_quiz' }));
        }

        setIsFetchingFinal(false);

        if (questionsPool.length > 0) {
            const randomQ = normalizeQuestionFormat(questionsPool[Math.floor(Math.random() * questionsPool.length)]);
            setFinalQuestionData({ question: randomQ, points, timer: profile.timer });
            setFinalTimer(profile.timer);
        } else {
            toast.success(`أحسنت! لا يوجد سؤال نهائي، ربحت ${points} نقطة مباشرة!`);
            confetti({ particleCount: 150, spread: 70 });
            finishGameMutation.mutate({ points_earned: points, result: 'win' });
        }
    };

    // Final Question Timer
    useEffect(() => {
        if (!finalQuestionData || finalTimer <= 0) return;
        const tid = setInterval(() => {
            setFinalTimer(p => {
                if (p <= 1) {
                    clearInterval(tid);
                    toast.error('انتهى الوقت! خسرت الجولة');
                    finishGameMutation.mutate({ points_earned: 0, result: 'timeout_final' });
                    return 0;
                }
                return p - 1;
            });
        }, 1000);
        return () => clearInterval(tid);
    }, [finalTimer, finalQuestionData]);

    const handleFinalAnswer = (answerText: string) => {
        const isCorrect = answerText.trim().toLowerCase() === finalQuestionData.question.correctAnswer;
        if (isCorrect) {
            toast.success(`إجابة صحيحة! مبروك ربحت ${finalQuestionData.points} نقطة 🎉`);
            confetti({ particleCount: 200, spread: 100 });
            finishGameMutation.mutate({ points_earned: finalQuestionData.points, result: 'win' });
        } else {
            toast.error('إجابة خاطئة! للأسف خسرت نقاط التحدي 😞');
            finishGameMutation.mutate({ points_earned: 0, result: 'loss_final' });
        }
    };

    // Cooldown Logic
    const nextAvailableTime = useMemo(() => {
        if (!latestSession) return null;
        const completedAt = new Date(latestSession.created_at);
        const nextTime = new Date(completedAt.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);
        return nextTime > new Date() ? nextTime : null;
    }, [latestSession]);

    const [timeLeftToPlay, setTimeLeftToPlay] = useState<string>('');
    useEffect(() => {
        if (!nextAvailableTime) return;
        const updateTimer = () => {
            const now = new Date();
            const diff = nextAvailableTime.getTime() - now.getTime();
            if (diff <= 0) { setTimeLeftToPlay(''); return; }
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeLeftToPlay(`${h}س ${m}د ${s}ث`);
        };
        updateTimer();
        const t = setInterval(updateTimer, 1000);
        return () => clearInterval(t);
    }, [nextAvailableTime]);

    if (showLiveArena) return <LiveGamesArena employee={employee} onClose={() => setShowLiveArena(false)} />;

    if (isFetchingFinal) {
        return <div className="py-32 text-center animate-pulse"><Brain className="w-16 h-16 text-purple-500 mx-auto mb-4 animate-bounce" /><h3 className="text-2xl font-black text-gray-800">جاري تحضير سؤال التحدي النهائي...</h3></div>;
    }

    if (finalQuestionData) {
        return (
            <div className="bg-white w-full max-w-lg mx-auto rounded-[2rem] p-6 md:p-8 text-center shadow-2xl border-4 border-yellow-400 animate-in zoom-in">
                <div className="flex justify-between items-center mb-6">
                    <Trophy className="w-12 h-12 text-yellow-500 animate-bounce" />
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-black text-xl ${finalTimer <= 5 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-800'}`}>
                        <Timer size={24}/> {finalTimer}
                    </div>
                </div>
                <h3 className="text-2xl font-black text-gray-800 mb-2">سؤال الجائزة النهائي!</h3>
                <p className="text-sm font-bold text-gray-500 mb-6 bg-yellow-50 p-2 rounded-lg border border-yellow-100">أجب بشكل صحيح لتربح {finalQuestionData.points} نقطة</p>
                
                <p className="font-black text-lg bg-gray-50 p-4 rounded-xl border leading-relaxed mb-6 shadow-inner text-right">{finalQuestionData.question.questionText}</p>
                
                <div className="grid grid-cols-1 gap-3">
                    {finalQuestionData.question.options.map((optText: string, idx: number) => (
                        <button key={idx} onClick={() => handleFinalAnswer(optText)} className="w-full bg-white border-2 border-gray-100 p-4 rounded-xl font-black text-gray-700 hover:border-yellow-400 hover:bg-yellow-50 active:scale-95 transition-all shadow-sm text-right">
                            {optText}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (activeGame) {
        const gameProps = {
            points: DIFF_PROFILES.intermediate.points,
            difficulty: 'intermediate',
            specialty: employee.specialty,
            onWin: triggerFinalQuestion,
            onLose: () => { toast.error('للأسف خسرت الجولة'); finishGameMutation.mutate({ points_earned: 0, result: 'loss' }); },
            onBack: () => { setActiveGame(null); setSessionId(null); }
        };

        return (
            <div className="space-y-4">
                <button onClick={gameProps.onBack} className="text-gray-500 font-bold text-sm hover:text-gray-800 mb-4 px-4 py-2 bg-white rounded-xl shadow-sm border">العودة للصالة</button>
                {activeGame === 'scramble' && <WordScramble {...gameProps} />}
                {activeGame === 'quiz' && <MedicalQuiz {...gameProps} />}
                {activeGame === 'dose' && <DoseCalculator {...gameProps} />}
                {activeGame === 'memory' && <MedicalMemory {...gameProps} />}
                {activeGame === 'riddle' && <MedicalRiddles {...gameProps} />}
                {activeGame === 'math' && <SpeedMath {...gameProps} />}
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in pb-10">
            <div className="relative bg-gradient-to-br from-violet-600 via-fuchsia-600 to-purple-700 rounded-3xl p-6 text-white shadow-xl overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <div className="flex justify-between items-center relative z-10">
                    <div>
                        <h2 className="text-2xl font-black flex items-center gap-2 mb-1"><Gamepad2 className="text-yellow-300" /> صالة الألعاب</h2>
                        <p className="text-xs text-white/80 font-bold flex items-center gap-1">إلعب، تعلم، واجمع النقاط <Sparkles size={12}/></p>
                    </div>
                    <div className="text-center bg-black/20 p-3 rounded-2xl border border-white/10 backdrop-blur-sm min-w-[100px]">
                        <p className="text-[10px] text-white/70 font-black mb-1">رصيد الأركيد</p>
                        <p className="text-2xl font-black text-yellow-300 flex items-center justify-center gap-1"><Trophy size={18} /> {totalPoints}</p>
                    </div>
                </div>
            </div>

            <button onClick={() => setShowLiveArena(true)} className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-[2rem] p-6 text-white shadow-xl hover:shadow-2xl hover:scale-[1.01] active:scale-95 transition-all relative overflow-hidden group text-right flex items-center justify-between border-4 border-indigo-100">
                <div className="relative z-10 flex-1">
                    <h3 className="text-2xl font-black mb-2 flex items-center gap-2"><Swords className="w-6 h-6 text-yellow-300 animate-pulse" /> تحدى زملائك (أونلاين) 🔥</h3>
                    <p className="text-indigo-100 font-bold text-sm max-w-lg">ادخل حلبة الألعاب المباشرة، العب مع المتواجدين الآن، واكسب النقاط!</p>
                </div>
                <div className="hidden md:flex w-14 h-14 bg-white/20 rounded-2xl backdrop-blur-sm items-center justify-center shrink-0"><Play className="w-6 h-6 fill-current text-yellow-300" /></div>
            </button>

            {loadingSession ? <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto" /></div> : 
             timeLeftToPlay ? (
                <div className="bg-white rounded-[2rem] p-8 text-center border-2 border-gray-100 shadow-sm relative overflow-hidden">
                    <Lock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-gray-800 mb-2">الصالة الفردية مغلقة للاستراحة</h3>
                    <p className="text-sm font-bold text-gray-500 mb-6">يُسمح بلعب التحديات الفردية مرة كل {COOLDOWN_HOURS} ساعات للتركيز في العمل.</p>
                    <div className="bg-gray-50 py-3 px-6 rounded-2xl inline-flex items-center gap-3 border border-gray-200">
                        <Timer className="w-5 h-5 text-purple-500 animate-pulse" />
                        <span className="text-xl font-black text-purple-700 font-mono" dir="ltr">{timeLeftToPlay}</span>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {GAMES.map((game) => {
                        const Icon = game.icon;
                        return (
                            <button key={game.id} onClick={() => { startGameMutation.mutate(); setActiveGame(game.id); }} disabled={startGameMutation.isPending} className={`p-6 rounded-[2rem] border-2 shadow-sm hover:shadow-md transition-all active:scale-95 text-right relative overflow-hidden group ${game.color}`}>
                                <Icon className="w-10 h-10 mb-4 opacity-80 group-hover:scale-110 transition-transform" />
                                <h3 className="text-lg font-black mb-1">{game.name}</h3>
                                <p className="text-[10px] font-bold opacity-70">اضغط للبدء واختيار المستوى</p>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    );
}
