import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gamepad2, Lock, Timer, Trophy, Loader2, Dices, HelpCircle, Star, Zap, Calculator, Brain, Award, Target, Clock, CheckCircle, XCircle, AlertCircle, TrendingUp, User, Sparkles, Tv2 } from 'lucide-react';
import toast from 'react-hot-toast';
import LiveGamesArena from '../../../LiveGamesArena';

interface Props {
    employee: Employee;
}

const COOLDOWN_HOURS = 5;

// ================================================
// 📦 Types
// ================================================
interface ScrambleWord  { id: string; word: string; hint: string; difficulty: string; }
interface QuizQuestion  { id: string; question: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_index: number; difficulty: string; }
interface DoseScenario  { id: string; scenario: string; question: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_index: number; explanation: string; difficulty: string; }

// ================================================
// 🧠 Adaptive Difficulty System
// ================================================
type DiffLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite';

interface DiffProfile {
    level: DiffLevel;
    label: string;
    emoji: string;
    color: string;
    weights: { easy: number; medium: number; hard: number };
    multiplier: number;
    desc: string;
}

const DIFF_PROFILES: Record<DiffLevel, DiffProfile> = {
    beginner: {
        level: 'beginner', label: 'مبتدئ', emoji: '🌱',
        color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
        weights: { easy: 70, medium: 30, hard: 0 },
        multiplier: 1.0,
        desc: 'أسئلة سهلة لتبدأ رحلتك!'
    },
    intermediate: {
        level: 'intermediate', label: 'متوسط', emoji: '⚡',
        color: 'bg-blue-100 text-blue-700 border-blue-300',
        weights: { easy: 40, medium: 50, hard: 10 },
        multiplier: 1.1,
        desc: 'مزيج متوازن +10% نقاط'
    },
    advanced: {
        level: 'advanced', label: 'متقدم', emoji: '🔥',
        color: 'bg-orange-100 text-orange-700 border-orange-300',
        weights: { easy: 20, medium: 50, hard: 30 },
        multiplier: 1.2,
        desc: 'تحدي أكبر +20% نقاط'
    },
    elite: {
        level: 'elite', label: 'نخبة', emoji: '👑',
        color: 'bg-purple-100 text-purple-700 border-purple-300',
        weights: { easy: 10, medium: 30, hard: 60 },
        multiplier: 1.3,
        desc: 'للمتميزين فقط +30% نقاط'
    }
};

function getDiffProfile(totalPoints: number): DiffProfile {
    if (totalPoints >= 5000) return DIFF_PROFILES.elite;
    if (totalPoints >= 2000) return DIFF_PROFILES.advanced;
    if (totalPoints >= 1000)  return DIFF_PROFILES.intermediate;
    return DIFF_PROFILES.beginner;
}

function pickDifficultySet(profile: DiffProfile, count: number): string[] {
    const { easy, medium } = profile.weights;
    const easyN   = Math.round((easy   / 100) * count);
    const mediumN = Math.round((medium / 100) * count);
    const hardN   = count - easyN - mediumN;
    const set = [
        ...Array(Math.max(0, easyN  )).fill('easy'),
        ...Array(Math.max(0, mediumN)).fill('medium'),
        ...Array(Math.max(0, hardN  )).fill('hard'),
    ];
    return set.sort(() => Math.random() - 0.5);
}

function applyMultiplier(base: number, profile: DiffProfile): number {
    return Math.round(base * profile.multiplier);
}

// Badge component
function LevelBadge({ employee }: { employee: Employee }) {
    const profile = getDiffProfile(employee.total_points || 0);
    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 font-black text-xs ${profile.color}`}>
            <span>{profile.emoji}</span>
            <div>
                <span>{profile.label}</span>
                <span className="opacity-70 mr-1">× {profile.multiplier.toFixed(1)}</span>
            </div>
        </div>
    );
}

// ================================================
// 🎮 Main Component
// ================================================
export default function StaffArcade({ employee }: Props) {
    const queryClient = useQueryClient();
    const [activeGame, setActiveGame] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [showLiveGames, setShowLiveGames] = useState(false);

    const diffProfile = useMemo(() => getDiffProfile(employee.total_points || 0), [employee.total_points]);

    // 1. جلب آخر محاولة
    const { data: lastPlay, isLoading: loadingPlay } = useQuery({
        queryKey: ['last_arcade_play', employee.employee_id],
        queryFn: async () => {
            const { data } = await supabase
                .from('arcade_scores')
                .select('played_at')
                .eq('employee_id', employee.employee_id)
                .order('played_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            return data;
        }
    });

    // 2. لوحة الشرف
    const { data: leaderboard = [] } = useQuery({
        queryKey: ['arcade_leaderboard'],
        queryFn: async () => {
            const { data: scores } = await supabase
                .from('arcade_scores')
                .select('employee_id, points_earned, is_win, employees(name, photo_url)')
                .eq('is_win', true);
            if (!scores) return [];
            const grouped: Record<string, any> = {};
            scores.forEach(s => {
                if (!grouped[s.employee_id]) {
                    grouped[s.employee_id] = {
                        id: s.employee_id,
                        name: s.employees?.name || 'مجهول',
                        photo: s.employees?.photo_url,
                        points: 0,
                        wins: 0
                    };
                }
                grouped[s.employee_id].points += s.points_earned;
                grouped[s.employee_id].wins += 1;
            });
            return Object.values(grouped).sort((a, b) => b.points - a.points).slice(0, 10);
        }
    });

    // حساب الوقت المتبقي
    const timeRemaining = useMemo(() => {
        if (!lastPlay?.played_at) return null;
        const lastPlayTime = new Date(lastPlay.played_at).getTime();
        const now = new Date().getTime();
        const diffHours = (now - lastPlayTime) / (1000 * 60 * 60);
        if (diffHours >= COOLDOWN_HOURS) return null;
        const remainingMs = (COOLDOWN_HOURS * 60 * 60 * 1000) - (now - lastPlayTime);
        const hrs  = Math.floor(remainingMs / (1000 * 60 * 60));
        const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        return { hrs, mins };
    }, [lastPlay]);

    // خصم المحاولة فور البدء
    const consumeAttempt = async (gameName: string) => {
        const { data, error } = await supabase.from('arcade_scores').insert({
            employee_id: employee.employee_id,
            game_name: gameName,
            points_earned: 0,
            is_win: false
        }).select('id').single();
        if (error) throw error;
        setSessionId(data.id);
        queryClient.invalidateQueries({ queryKey: ['last_arcade_play'] });
    };

    // تسجيل النتيجة
    const finishAttemptMutation = useMutation({
        mutationFn: async ({ points, isWin, gameName }: { points: number, isWin: boolean, gameName: string }) => {
            if (!sessionId) return;
            await supabase.from('arcade_scores').update({ points_earned: points, is_win: isWin }).eq('id', sessionId);
            if (isWin && points > 0) {
                await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: points });
                await supabase.from('points_ledger').insert({
                    employee_id: employee.employee_id,
                    points,
                    reason: `فوز في لعبة: ${gameName} 🎮`
                });
            }
        },
        onSuccess: (_, variables) => {
            if (variables.isWin) {
                toast.success(`بطل! كسبت ${variables.points} نقطة 🎉`, {
                    duration: 5000,
                    icon: '🏆',
                    style: { background: '#10b981', color: 'white', fontWeight: 'bold' }
                });
            } else {
                toast.error('حظ أوفر! تعال جرب تاني بعد 5 ساعات 💔', { duration: 4000 });
            }
            queryClient.invalidateQueries({ queryKey: ['arcade_leaderboard'] });
            queryClient.invalidateQueries({ queryKey: ['admin_employees'] });
            setActiveGame(null);
            setSessionId(null);
        }
    });

    return (
        <div className="space-y-4 animate-in fade-in pb-10">
            {/* Header */}
            <div className="relative bg-gradient-to-br from-violet-600 via-fuchsia-600 to-purple-700 rounded-2xl p-5 text-white shadow-2xl overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-10 right-10 w-40 h-40 bg-fuchsia-300 rounded-full blur-3xl animate-pulse delay-700"></div>
                </div>
                <div className="relative z-10">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <h2 className="text-2xl md:text-4xl font-black flex items-center gap-2 mb-1">
                                <Gamepad2 className="w-7 h-7 md:w-10 md:h-10 text-fuchsia-300 animate-bounce flex-shrink-0"/>
                                <span>صالة الألعاب</span>
                            </h2>
                            <p className="text-violet-100 text-xs md:text-base font-bold flex items-center gap-1 mb-2">
                                <Clock className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0"/> محاولة واحدة كل 5 ساعات
                            </p>
                            <LevelBadge employee={employee} />
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={() => setShowLeaderboard(true)}
                                className="bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 p-2.5 md:px-4 md:py-3 rounded-xl border border-white border-opacity-30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                            >
                                <Trophy className="w-5 h-5 text-yellow-300"/>
                                <span className="hidden md:inline text-sm font-black">الأبطال</span>
                            </button>
                            <div className="bg-white bg-opacity-20 backdrop-blur-sm px-3 py-2 md:px-6 md:py-3 rounded-xl border border-white border-opacity-30">
                                <p className="text-[10px] text-violet-200 mb-0.5">رصيدك</p>
                                <p className="text-lg md:text-2xl font-black flex items-center gap-1">
                                    <Trophy className="w-4 h-4 text-yellow-300"/> {employee.total_points || 0}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {loadingPlay ? (
                <div className="text-center py-20 bg-white rounded-2xl shadow-sm">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto text-fuchsia-600 mb-4"/>
                    <p className="text-gray-500 font-bold">جاري التحميل...</p>
                </div>
            ) : activeGame !== null ? (
                /* شاشة اللعب */
                <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 p-4 md:p-10">
                    <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-gray-100">
                        <h3 className="font-black text-lg md:text-2xl text-violet-700 flex items-center gap-2">
                            <Target className="w-5 h-5 md:w-6 md:h-6"/> تحدي قيد التنفيذ
                        </h3>
                        <div className="flex items-center gap-2">
                            <LevelBadge employee={employee} />
                            <div className="flex items-center gap-1 bg-violet-50 px-3 py-2 rounded-xl">
                                <Zap className="w-4 h-4 text-violet-600"/>
                                <span className="text-xs font-bold text-violet-700 hidden sm:inline">جاري اللعب...</span>
                            </div>
                        </div>
                    </div>
                    {finishAttemptMutation.isPending ? (
                        <div className="text-center py-24">
                            <Loader2 className="w-16 h-16 animate-spin mx-auto text-violet-600 mb-6"/>
                            <p className="text-xl font-black text-gray-700 mb-2">جاري تسجيل نتيجتك...</p>
                        </div>
                    ) : (
                        <>
                            {activeGame === 'spin'    && <SpinAndAnswerGame      employee={employee} diffProfile={diffProfile} onStart={() => consumeAttempt('عجلة الحظ')}             onComplete={(p, w) => finishAttemptMutation.mutate({ points: p, isWin: w, gameName: 'عجلة الحظ' })} />}
                            {activeGame === 'scramble'&& <WordScrambleGame       employee={employee} diffProfile={diffProfile} onStart={() => consumeAttempt('فك الشفرة')}             onComplete={(p, w) => finishAttemptMutation.mutate({ points: p, isWin: w, gameName: 'فك الشفرة' })} />}
                            {activeGame === 'safe'    && <SafeCrackerGame                            onStart={() => consumeAttempt('الخزنة السرية')}         onComplete={(p, w) => finishAttemptMutation.mutate({ points: p, isWin: w, gameName: 'الخزنة السرية' })} />}
                            {activeGame === 'memory'  && <MemoryMatchGame                            onStart={() => consumeAttempt('تطابق الذاكرة')}          onComplete={(p, w) => finishAttemptMutation.mutate({ points: p, isWin: w, gameName: 'تطابق الذاكرة' })} />}
                            {activeGame === 'quiz'    && <MedicalQuizRush        employee={employee} diffProfile={diffProfile} onStart={() => consumeAttempt('سباق المعرفة الطبية')}   onComplete={(p, w) => finishAttemptMutation.mutate({ points: p, isWin: w, gameName: 'سباق المعرفة الطبية' })} />}
                            {activeGame === 'dose'    && <DoseCalculatorChallenge employee={employee} diffProfile={diffProfile} onStart={() => consumeAttempt('تحدي حساب الجرعات')}   onComplete={(p, w) => finishAttemptMutation.mutate({ points: p, isWin: w, gameName: 'تحدي حساب الجرعات' })} />}
                        </>
                    )}
                </div>
            ) : timeRemaining ? (
                /* شاشة الانتظار */
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-8 md:p-12 rounded-2xl text-center border-2 border-gray-200 shadow-xl animate-in zoom-in-95">
                    <div className="bg-white w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <Timer className="w-14 h-14 text-violet-500 animate-pulse"/>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black text-gray-800 mb-3">وقت الراحة! ☕</h3>
                    <p className="text-gray-600 font-bold mb-6 max-w-md mx-auto">
                        لقد استهلكت محاولتك. خذ استراحة وتعال تلعب مرة تانية بعد:
                    </p>
                    <div className="inline-flex items-center gap-4 text-4xl font-black text-violet-600 bg-white py-5 px-8 rounded-3xl shadow-lg border-2 border-violet-100">
                        <div className="text-center">
                            <div className="text-5xl">{timeRemaining.hrs}</div>
                            <div className="text-xs font-bold text-violet-400 mt-1">ساعة</div>
                        </div>
                        <span className="text-violet-300">:</span>
                        <div className="text-center">
                            <div className="text-5xl">{timeRemaining.mins}</div>
                            <div className="text-xs font-bold text-violet-400 mt-1">دقيقة</div>
                        </div>
                    </div>
                    <div className="mt-8 flex justify-center gap-2">
                        <div className="w-3 h-3 bg-violet-400 rounded-full animate-bounce"></div>
                        <div className="w-3 h-3 bg-violet-400 rounded-full animate-bounce delay-100"></div>
                        <div className="w-3 h-3 bg-violet-400 rounded-full animate-bounce delay-200"></div>
                    </div>
                </div>
            ) : (
                /* قائمة الألعاب */
                <div>
                    {/* بانر المستوى */}
                    <div className={`mb-4 p-3 md:p-4 rounded-2xl border-2 flex items-center gap-3 ${diffProfile.color}`}>
                        <span className="text-2xl md:text-3xl">{diffProfile.emoji}</span>
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-sm">مستواك الحالي: {diffProfile.label}</p>
                            <p className="text-xs font-bold opacity-80 truncate">{diffProfile.desc}</p>
                        </div>
                        <div className="text-left flex-shrink-0">
                            <p className="font-black text-lg">×{diffProfile.multiplier.toFixed(1)}</p>
                            <p className="text-xs font-bold opacity-70">مضاعف</p>
                        </div>
                    </div>

                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-lg md:text-xl font-black text-gray-800 flex items-center gap-2">
                            <Star className="w-5 h-5 text-yellow-500"/> اختر لعبتك
                        </h3>
                        <div className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-xl">
                            6 ألعاب متاحة
                        </div>
                    </div>

                    {/* ✅ Grid: 2 عامود دائماً على موبايل، 3 على تابلت، 4 على ديسكتوب كبير */}
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">

                        {/* Game 1 - عجلة الحظ */}
                        <button onClick={() => setActiveGame('spin')} className="group bg-gradient-to-br from-fuchsia-50 to-pink-50 border-2 border-fuchsia-100 hover:border-fuchsia-300 p-3 md:p-4 rounded-2xl shadow-md hover:shadow-2xl transition-all text-right flex flex-col relative overflow-hidden hover:scale-105 active:scale-95">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-fuchsia-200/20 rounded-full blur-3xl group-hover:blur-2xl transition-all"></div>
                            <div className="relative z-10 flex flex-col h-full">
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-3 group-hover:scale-110 group-hover:rotate-12 transition-transform shadow-lg">
                                    <Dices className="w-5 h-5 md:w-7 md:h-7"/>
                                </div>
                                <h3 className="font-black text-gray-900 text-sm md:text-base mb-1 leading-tight">عجلة الحظ</h3>
                                <p className="text-[11px] md:text-xs text-gray-500 font-bold leading-relaxed mb-3 flex-1 hidden sm:block">لف العجلة وأجب على سؤال طبي لتفوز!</p>
                                <div className="flex items-center justify-between pt-2 border-t border-fuchsia-100">
                                    <span className="text-[10px] md:text-xs bg-white text-fuchsia-700 px-2 py-1 rounded-lg font-black shadow-sm">حظ + ذكاء</span>
                                    <span className="text-[10px] md:text-xs text-fuchsia-600 font-black flex items-center gap-0.5"><Trophy className="w-2.5 h-2.5 md:w-3 md:h-3"/> 5-30</span>
                                </div>
                            </div>
                        </button>

                        {/* Game 2 - فك الشفرة */}
                        <button onClick={() => setActiveGame('scramble')} className="group bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-100 hover:border-blue-300 p-3 md:p-4 rounded-2xl shadow-md hover:shadow-2xl transition-all text-right flex flex-col overflow-hidden hover:scale-105 active:scale-95 relative">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-200/20 rounded-full blur-3xl group-hover:blur-2xl transition-all"></div>
                            <div className="relative z-10 flex flex-col h-full">
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-cyan-600 text-white rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-3 group-hover:scale-110 transition-transform shadow-lg">
                                    <Timer className="w-5 h-5 md:w-7 md:h-7"/>
                                </div>
                                <h3 className="font-black text-gray-900 text-sm md:text-base mb-1 leading-tight">فك الشفرة</h3>
                                <p className="text-[11px] md:text-xs text-gray-500 font-bold leading-relaxed mb-3 flex-1 hidden sm:block">رتب الحروف بسرعة. النقاط تنقص كل ثانية!</p>
                                <div className="flex items-center justify-between pt-2 border-t border-blue-100">
                                    <span className="text-[10px] md:text-xs bg-white text-blue-700 px-2 py-1 rounded-lg font-black shadow-sm">سرعة بديهة</span>
                                    <span className="text-[10px] md:text-xs text-blue-600 font-black flex items-center gap-0.5"><Trophy className="w-2.5 h-2.5 md:w-3 md:h-3"/> 5-20</span>
                                </div>
                            </div>
                        </button>

                        {/* Game 3 - الخزنة السرية */}
                        <button onClick={() => setActiveGame('safe')} className="group bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-100 hover:border-emerald-300 p-3 md:p-4 rounded-2xl shadow-md hover:shadow-2xl transition-all text-right flex flex-col overflow-hidden hover:scale-105 active:scale-95 relative">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-200/20 rounded-full blur-3xl group-hover:blur-2xl transition-all"></div>
                            <div className="relative z-10 flex flex-col h-full">
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-3 group-hover:scale-110 transition-transform shadow-lg">
                                    <Lock className="w-5 h-5 md:w-7 md:h-7"/>
                                </div>
                                <h3 className="font-black text-gray-900 text-sm md:text-base mb-1 leading-tight">الخزنة السرية</h3>
                                <p className="text-[11px] md:text-xs text-gray-500 font-bold leading-relaxed mb-3 flex-1 hidden sm:block">خمن الرقم السري في 5 محاولات بالتلميحات.</p>
                                <div className="flex items-center justify-between pt-2 border-t border-emerald-100">
                                    <span className="text-[10px] md:text-xs bg-white text-emerald-700 px-2 py-1 rounded-lg font-black shadow-sm">ذكاء ومنطق</span>
                                    <span className="text-[10px] md:text-xs text-emerald-600 font-black flex items-center gap-0.5"><Trophy className="w-2.5 h-2.5 md:w-3 md:h-3"/> 20</span>
                                </div>
                            </div>
                        </button>

                        {/* Game 4 - تطابق الذاكرة */}
                        <button onClick={() => setActiveGame('memory')} className="group bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-100 hover:border-orange-300 p-3 md:p-4 rounded-2xl shadow-md hover:shadow-2xl transition-all text-right flex flex-col overflow-hidden hover:scale-105 active:scale-95 relative">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-200/20 rounded-full blur-3xl group-hover:blur-2xl transition-all"></div>
                            <div className="relative z-10 flex flex-col h-full">
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-orange-500 to-amber-600 text-white rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-3 group-hover:scale-110 transition-transform shadow-lg">
                                    <Gamepad2 className="w-5 h-5 md:w-7 md:h-7"/>
                                </div>
                                <h3 className="font-black text-gray-900 text-sm md:text-base mb-1 leading-tight">تطابق الذاكرة</h3>
                                <p className="text-[11px] md:text-xs text-gray-500 font-bold leading-relaxed mb-3 flex-1 hidden sm:block">اقلب الكروت وطابق الأيقونات قبل انتهاء الوقت.</p>
                                <div className="flex items-center justify-between pt-2 border-t border-orange-100">
                                    <span className="text-[10px] md:text-xs bg-white text-orange-700 px-2 py-1 rounded-lg font-black shadow-sm">قوة ذاكرة</span>
                                    <span className="text-[10px] md:text-xs text-orange-600 font-black flex items-center gap-0.5"><Trophy className="w-2.5 h-2.5 md:w-3 md:h-3"/> 20</span>
                                </div>
                            </div>
                        </button>

                        {/* Game 5 - سباق المعرفة الطبية */}
                        <button onClick={() => setActiveGame('quiz')} className="group bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-100 hover:border-indigo-300 p-3 md:p-4 rounded-2xl shadow-md hover:shadow-2xl transition-all text-right flex flex-col overflow-hidden hover:scale-105 active:scale-95 relative">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-200/20 rounded-full blur-3xl group-hover:blur-2xl transition-all"></div>
                            <div className="relative z-10 flex flex-col h-full">
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-3 group-hover:scale-110 transition-transform shadow-lg">
                                    <Brain className="w-5 h-5 md:w-7 md:h-7"/>
                                </div>
                                <div className="absolute -top-1 -left-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-md animate-pulse">جديد!</div>
                                <h3 className="font-black text-gray-900 text-sm md:text-base mb-1 leading-tight">سباق المعرفة</h3>
                                <p className="text-[11px] md:text-xs text-gray-500 font-bold leading-relaxed mb-3 flex-1 hidden sm:block">أجب على 5 أسئلة طبية. كل ثانية = نقاط إضافية!</p>
                                <div className="flex items-center justify-between pt-2 border-t border-indigo-100">
                                    <span className="text-[10px] md:text-xs bg-white text-indigo-700 px-2 py-1 rounded-lg font-black shadow-sm">معرفة + سرعة</span>
                                    <span className="text-[10px] md:text-xs text-indigo-600 font-black flex items-center gap-0.5"><Trophy className="w-2.5 h-2.5 md:w-3 md:h-3"/> 5-25</span>
                                </div>
                            </div>
                        </button>

                        {/* Game 6 - تحدي حساب الجرعات */}
                        <button onClick={() => setActiveGame('dose')} className="group bg-gradient-to-br from-rose-50 to-red-50 border-2 border-rose-100 hover:border-rose-300 p-3 md:p-4 rounded-2xl shadow-md hover:shadow-2xl transition-all text-right flex flex-col overflow-hidden hover:scale-105 active:scale-95 relative">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-200/20 rounded-full blur-3xl group-hover:blur-2xl transition-all"></div>
                            <div className="relative z-10 flex flex-col h-full">
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-rose-500 to-red-600 text-white rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-3 group-hover:scale-110 transition-transform shadow-lg">
                                    <Calculator className="w-5 h-5 md:w-7 md:h-7"/>
                                </div>
                                <div className="absolute -top-1 -left-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-md animate-pulse">جديد!</div>
                                <h3 className="font-black text-gray-900 text-sm md:text-base mb-1 leading-tight">حساب الجرعات</h3>
                                <p className="text-[11px] md:text-xs text-gray-500 font-bold leading-relaxed mb-3 flex-1 hidden sm:block">احسب الجرعات الدوائية بدقة في 3 حالات طبية!</p>
                                <div className="flex items-center justify-between pt-2 border-t border-rose-100">
                                    <span className="text-[10px] md:text-xs bg-white text-rose-700 px-2 py-1 rounded-lg font-black shadow-sm">دقة حسابية</span>
                                    <span className="text-[10px] md:text-xs text-rose-600 font-black flex items-center gap-0.5"><Trophy className="w-2.5 h-2.5 md:w-3 md:h-3"/> 10-30</span>
                                </div>
                            </div>
                        </button>

                    </div>
                </div>
            )}


            {/* 🎮 Floating Button - Live Games Arena */}
            <button
                onClick={() => setShowLiveGames(true)}
                className="fixed bottom-6 left-6 z-50 group"
                title="ساحة الألعاب المباشرة"
            >
                <span className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 opacity-30 animate-ping scale-125"></span>
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 shadow-2xl shadow-blue-500/60 flex items-center justify-center border-4 border-white/30 hover:scale-110 active:scale-95 transition-all duration-300">
                    <Tv2 className="w-7 h-7 text-white drop-shadow" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-md flex items-center justify-center">
                        <span className="w-2 h-2 bg-red-300 rounded-full animate-ping absolute"></span>
                    </span>
                </div>
                <span className="absolute left-20 top-1/2 -translate-y-1/2 bg-gray-900/90 backdrop-blur-sm text-white text-xs font-black px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap border border-blue-500/50 shadow-xl pointer-events-none">
                    🔴 ساحة الألعاب المباشرة
                </span>
            </button>

            {/* Modal - LiveGamesArena */}
            {showLiveGames && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
                    onClick={() => setShowLiveGames(false)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="sticky top-0 z-10 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 rounded-t-3xl px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                                    <Tv2 className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-white font-black text-xl">ساحة الألعاب المباشرة</h2>
                                    <div className="flex items-center gap-1">
                                        <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
                                        <span className="text-sky-100 text-xs font-bold">LIVE</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowLiveGames(false)}
                                className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-all active:scale-95"
                            >
                                <XCircle className="w-6 h-6 text-white" />
                            </button>
                        </div>
                        <div className="p-4 md:p-6">
                            <LiveGamesArena employee={employee} />
                        </div>
                    </div>
                </div>
            )}
            {showLeaderboard && (
                <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowLeaderboard(false)}>
                    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-[2rem] border-2 border-amber-200 shadow-2xl p-6 md:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-black text-2xl md:text-3xl text-gray-800 flex items-center gap-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg">
                                    <Trophy className="w-7 h-7 text-white"/>
                                </div>
                                أبطال الألعاب
                            </h3>
                            <button onClick={() => setShowLeaderboard(false)} className="w-10 h-10 bg-white hover:bg-gray-100 rounded-xl flex items-center justify-center shadow-md transition-all active:scale-95">
                                <XCircle className="w-5 h-5 text-gray-600"/>
                            </button>
                        </div>
                        {leaderboard.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-amber-200">
                                <Award className="w-20 h-20 text-amber-300 mx-auto mb-4"/>
                                <p className="text-xl font-black text-gray-400 mb-2">لا يوجد فائزين حتى الآن</p>
                                <p className="text-sm text-gray-500 font-bold">كن أنت الأول! 🚀</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {leaderboard.map((user, idx) => {
                                    const firstName = user.name ? user.name.split(' ')[0] : 'غير معروف';
                                    return (
                                        <div key={user.id} className={`flex items-center justify-between bg-white p-4 rounded-2xl border-2 transition-all hover:scale-105 hover:shadow-lg ${idx === 0 ? 'border-yellow-400 shadow-lg' : idx === 1 ? 'border-gray-300 shadow-md' : idx === 2 ? 'border-amber-300 shadow-md' : 'border-gray-100'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg text-white shadow-lg ${idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' : idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' : idx === 2 ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-violet-400 to-violet-600'}`}>
                                                    {idx === 0 ? '👑' : idx + 1}
                                                </div>
                                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-white shadow-md overflow-hidden">
                                                    {user.photo ? <img src={user.photo} alt={firstName} className="w-full h-full object-cover"/> : <User className="w-full h-full p-2.5 text-gray-400"/>}
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-base text-gray-900">{firstName}</h4>
                                                    <p className="text-xs text-gray-500 font-bold flex items-center gap-1"><TrendingUp className="w-3 h-3"/> {user.wins} انتصارات</p>
                                                </div>
                                            </div>
                                            <div className="bg-gradient-to-br from-violet-500 to-fuchsia-600 px-4 py-2 rounded-xl shadow-lg border-2 border-white">
                                                <p className="font-black text-white text-lg leading-none">{user.points}</p>
                                                <p className="text-[10px] text-violet-100 font-bold text-center">نقطة</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ==========================================
// 1️⃣ عجلة الحظ + سؤال
// ==========================================
function SpinAndAnswerGame({ employee, diffProfile, onStart, onComplete }: { employee: Employee, diffProfile: DiffProfile, onStart: () => Promise<void>, onComplete: (points: number, isWin: boolean) => void }) {
    const [phase, setPhase] = useState<'spin' | 'question'>('spin');
    const [pointsWon, setPointsWon] = useState(0);
    const [spinning, setSpinning] = useState(false);
    const [question, setQuestion] = useState<any>(null);
    const [timeLeft, setTimeLeft] = useState(15);
    const [starting, setStarting] = useState(false);

    const { data: questions } = useQuery({
        queryKey: ['arcade_question', employee.specialty],
        queryFn: async () => {
            const { data } = await supabase.from('quiz_questions').select('*');
            if (!data) return [];
            // فلترة بالعربي: الكل أو تخصص الموظف
            return data.filter((q: any) => 
                q.specialty?.includes('الكل') || q.specialty?.includes(employee.specialty)
            );
        }
    });

    const startSpin = async () => {
        if (spinning || starting) return;
        setStarting(true);
        try { await onStart(); } catch (e) { setStarting(false); return; }
        setSpinning(true);
        const options = [5, 10, 15, 20, 25, 30];
        const rawResult = options[Math.floor(Math.random() * options.length)];
        setTimeout(() => {
            const finalResult = applyMultiplier(rawResult, diffProfile);
            setPointsWon(finalResult);
            setSpinning(false);
            if (questions && questions.length > 0) {
                setQuestion(questions[Math.floor(Math.random() * questions.length)]);
                setPhase('question');
            } else {
                toast.success('ربحت مباشرة!');
                onComplete(finalResult, true);
            }
        }, 3000);
    };

    useEffect(() => {
        let timer: any;
        if (phase === 'question' && timeLeft > 0) timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        else if (phase === 'question' && timeLeft === 0) onComplete(0, false);
        return () => clearInterval(timer);
    }, [phase, timeLeft, onComplete]);

    const handleAnswer = (opt: string) => {
        if (opt.trim() === question.correct_answer.trim()) onComplete(pointsWon, true);
        else onComplete(0, false);
    };

    if (phase === 'spin') {
        return (
            <div className="text-center py-12 animate-in zoom-in-95">
                <h3 className="text-3xl font-black text-gray-800 mb-3 flex items-center justify-center gap-2">
                    <Dices className="w-8 h-8 text-fuchsia-600"/> لف العجلة!
                </h3>
                <p className="text-base font-bold text-gray-500 mb-2">سيتم خصم المحاولة بمجرد بدء اللف</p>
                <p className="text-sm font-bold text-violet-600 mb-8 flex items-center justify-center gap-1">
                    <Sparkles className="w-4 h-4"/> مضاعف {diffProfile.emoji} {diffProfile.label}: ×{diffProfile.multiplier.toFixed(1)}
                </p>
                <div className={`w-64 h-64 mx-auto rounded-full border-[12px] border-violet-200 flex items-center justify-center text-5xl shadow-2xl transition-all duration-[3000ms] ${spinning ? 'rotate-[1440deg] blur-sm scale-105' : ''}`}
                     style={{ background: 'conic-gradient(#fca5a5 0% 20%, #fcd34d 20% 40%, #86efac 40% 60%, #93c5fd 60% 80%, #c4b5fd 80% 100%)' }}>
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl z-10 font-black text-violet-700 border-4 border-violet-100">
                        {spinning ? '🎰' : '🎁'}
                    </div>
                </div>
                <button onClick={startSpin} disabled={spinning || starting}
                    className="mt-10 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-12 py-5 rounded-2xl font-black shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 text-lg">
                    {spinning ? '🎲 جاري اللف...' : starting ? '⏳ جاري البدء...' : '✨ اضغط للّف (خصم محاولة)'}
                </button>
            </div>
        );
    }

    let parsedOptions: string[] = [];
    if (question?.options) {
        if (Array.isArray(question.options)) parsedOptions = question.options;
        else { try { parsedOptions = JSON.parse(question.options); } catch { parsedOptions = question.options.split(',').map((s: string) => s.trim()); } }
    }

    return (
        <div className="text-center py-10 animate-in slide-in-from-right max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-8 px-6">
                <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-6 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2">
                    <Clock className="w-5 h-5 animate-pulse"/> {timeLeft} ثانية
                </div>
                <div className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-6 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2">
                    <Star className="w-5 h-5"/> الجائزة: {pointsWon} نقطة
                </div>
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 p-8 rounded-3xl mb-8 border-2 border-violet-200 shadow-xl">
                <HelpCircle className="w-14 h-14 text-violet-500 mx-auto mb-4 animate-bounce"/>
                <h3 className="text-2xl font-black text-violet-900 leading-relaxed">{question.question_text}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {parsedOptions.map((opt: string, i: number) => (
                    <button key={i} onClick={() => handleAnswer(opt)}
                        className="bg-white border-3 border-gray-200 p-5 rounded-2xl font-bold text-gray-800 hover:border-violet-500 hover:bg-violet-50 hover:scale-105 transition-all active:scale-95 shadow-md hover:shadow-xl text-lg">
                        {opt}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ==========================================
// 2️⃣ فك الشفرة (Adaptive)
// ==========================================
function WordScrambleGame({ employee, diffProfile, onStart, onComplete }: { employee: Employee, diffProfile: DiffProfile, onStart: () => Promise<void>, onComplete: (points: number, isWin: boolean) => void }) {
    const [wordObj, setWordObj] = useState<ScrambleWord | null>(null);
    const [scrambledArray, setScrambledArray] = useState<string[]>([]);
    const [input, setInput] = useState('');
    const [timeLeft, setTimeLeft] = useState(20);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);

    const { data: words = [], isLoading: loadingWords } = useQuery({
        queryKey: ['arcade_scramble_words', employee.specialty],
        queryFn: async () => {
            const { data, error } = await supabase.from('arcade_scramble_words').select('id, word, hint, difficulty, specialty').eq('is_active', true);
            if (error) throw error;
            // فلترة حسب التخصص بالعربي: الكل أو تخصص الموظف
            const filtered = (data || []).filter((w: any) => 
                !w.specialty || w.specialty.includes('الكل') || w.specialty.includes(employee.specialty)
            );
            return filtered as ScrambleWord[];
        },
        staleTime: 1000 * 60 * 10,
    });

    const startGame = async () => {
        if (words.length === 0) { toast.error('لا توجد كلمات متاحة حالياً'); return; }
        setStarting(true);
        try { await onStart(); } catch(e) { setStarting(false); return; }

        // اختيار صعوبة الكلمة حسب مستوى اللاعب
        const [targetDiff] = pickDifficultySet(diffProfile, 1);
        const pool = words.filter(w => w.difficulty === targetDiff);
        const finalPool = pool.length > 0 ? pool : words;
        const randomWord = finalPool[Math.floor(Math.random() * finalPool.length)];

        setWordObj(randomWord);
        setScrambledArray(randomWord.word.split('').sort(() => 0.5 - Math.random()));
        setTimeLeft(20);
        setInput('');
        setIsActive(true);
        setStarting(false);
    };

    useEffect(() => {
        let timer: any;
        if (isActive && timeLeft > 0) timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        else if (isActive && timeLeft === 0) { setIsActive(false); onComplete(0, false); }
        return () => clearInterval(timer);
    }, [isActive, timeLeft, onComplete]);

    const checkAnswer = () => {
        if (!wordObj) return;
        if (input.trim() === wordObj.word) {
            setIsActive(false);
            const rawPoints = Math.max(5, Math.floor(timeLeft));
            onComplete(applyMultiplier(rawPoints, diffProfile), true);
        } else {
            toast.error('كلمة خاطئة! حاول مرة أخرى', { icon: '❌' });
            setInput('');
        }
    };

    if (!isActive) {
        return (
            <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <Timer className="w-14 h-14 text-white animate-pulse"/>
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">فك الشفرة! 🧩</h3>
                <p className="text-base font-bold text-gray-600 mb-4 max-w-md mx-auto">النقاط تتناقص كل ثانية! رتب الحروف المبعثرة واكتب الكلمة بأسرع ما يمكن.</p>
                <p className="text-sm font-bold text-blue-600 mb-6 flex items-center justify-center gap-1">
                    <Sparkles className="w-4 h-4"/> مستواك {diffProfile.emoji}: صعوبة مخصصة ×{diffProfile.multiplier.toFixed(1)} نقاط
                </p>
                {loadingWords ? <p className="text-gray-400 font-bold mb-4">⏳ جاري تحميل الكلمات...</p>
                    : words.length === 0 ? <p className="text-red-400 font-bold mb-4">⚠️ لا توجد كلمات متاحة حالياً</p> : null}
                <button onClick={startGame} disabled={starting || loadingWords || words.length === 0}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg">
                    {starting ? '⏳ جاري البدء...' : '🚀 ابدأ التحدي'}
                </button>
            </div>
        );
    }

    const currentPoints = applyMultiplier(Math.max(5, timeLeft), diffProfile);

    return (
        <div className="text-center py-10 max-w-2xl mx-auto animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-10 px-4">
                <div className={`px-6 py-3 rounded-2xl font-black text-xl shadow-lg transition-all ${timeLeft > 10 ? 'bg-blue-500 text-white' : 'bg-red-500 text-white animate-pulse'}`}>
                    ⏱️ {timeLeft} ث
                </div>
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg">
                    💎 الآن: {currentPoints} نقطة
                </div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-3xl mb-3 border-2 border-blue-200">
                <p className="text-sm font-bold text-blue-700 mb-2">💡 تلميح:</p>
                <p className="text-base font-black text-gray-800">{wordObj?.hint}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mb-12 p-6 bg-white rounded-3xl shadow-xl border-2 border-gray-100" dir="ltr">
                {scrambledArray.map((letter, idx) => (
                    <div key={idx} className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 border-4 border-blue-200 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-lg transform hover:scale-110 transition-transform">
                        {letter}
                    </div>
                ))}
            </div>
            <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && checkAnswer()}
                className="w-full text-center text-2xl font-black p-6 bg-gray-50 border-4 border-blue-300 focus:border-blue-500 outline-none rounded-3xl mb-6 transition-all shadow-lg"
                placeholder="اكتب الكلمة مجمعة هنا..." autoFocus/>
            <button onClick={checkAnswer} className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-5 rounded-3xl font-black shadow-2xl hover:scale-105 active:scale-95 transition-all text-xl">
                ✅ تحقق من الإجابة (الجائزة: {currentPoints} نقطة)
            </button>
        </div>
    );
}

// ==========================================
// 3️⃣ الخزنة السرية (بدون adaptive - لعبة منطق)
// ==========================================
function SafeCrackerGame({ onStart, onComplete }: { onStart: () => Promise<void>, onComplete: (points: number, isWin: boolean) => void }) {
    const [secretCode, setSecretCode] = useState('');
    const [guesses, setGuesses] = useState<{ guess: string, feedback: string[] }[]>([]);
    const [currentGuess, setCurrentGuess] = useState('');
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const MAX_GUESSES = 5;

    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch(e) { setStarting(false); return; }
        let code = '';
        while(code.length < 3) { const r = Math.floor(Math.random() * 9) + 1; if(!code.includes(r.toString())) code += r; }
        setSecretCode(code);
        setGuesses([]);
        setCurrentGuess('');
        setIsActive(true);
        setStarting(false);
    };

    const submitGuess = () => {
        if (currentGuess.length !== 3) { toast.error('يجب إدخال 3 أرقام فقط!', { icon: '⚠️' }); return; }
        let feedback = [];
        for (let i = 0; i < 3; i++) {
            if (currentGuess[i] === secretCode[i]) feedback.push('green');
            else if (secretCode.includes(currentGuess[i])) feedback.push('yellow');
            else feedback.push('red');
        }
        const newGuesses = [...guesses, { guess: currentGuess, feedback }];
        setGuesses(newGuesses);
        setCurrentGuess('');
        if (currentGuess === secretCode) {
            setTimeout(() => { toast.success('🎉 أحسنت! فتحت الخزنة!', { duration: 3000 }); onComplete(20, true); }, 800);
        } else if (newGuesses.length >= MAX_GUESSES) {
            toast.error(`💔 الكود الصحيح كان: ${secretCode}`, { duration: 3000 });
            setTimeout(() => onComplete(0, false), 2000);
        }
    };

    if (!isActive) {
        return (
            <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl animate-pulse">
                    <Lock className="w-14 h-14 text-white"/>
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">الخزنة السرية! 🔐</h3>
                <p className="text-base font-bold text-gray-600 mb-8 max-w-lg mx-auto">
                    خمن الرقم السري (3 أرقام مختلفة من 1-9) في 5 محاولات فقط بناءً على تلميحات الألوان.
                </p>
                <div className="flex justify-center gap-6 mb-8">
                    {[['bg-emerald-500','رقم صحيح\nمكان صحيح'],['bg-amber-500','رقم صحيح\nمكان خطأ'],['bg-red-500','رقم غير\nموجود']].map(([color, label],i) => (
                        <div key={i} className="text-center">
                            <div className={`w-12 h-12 ${color} rounded-xl mb-2 shadow-md`}></div>
                            <p className="text-xs font-bold text-gray-600 whitespace-pre-line">{label}</p>
                        </div>
                    ))}
                </div>
                <button onClick={startGame} disabled={starting}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg">
                    {starting ? '⏳ جاري البدء...' : '🔓 ابدأ المحاولة'}
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-xl mx-auto py-8 animate-in slide-in-from-bottom-4 text-center">
            <div className="flex items-center justify-center gap-3 mb-8">
                <Lock className="w-10 h-10 text-emerald-600"/>
                <h3 className="text-2xl font-black text-gray-800">اكسر الخزنة!</h3>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-3xl mb-8 border-2 border-emerald-200">
                <p className="text-sm font-bold text-gray-700 mb-3">المحاولات المتبقية: <span className="text-2xl text-emerald-600 font-black">{MAX_GUESSES - guesses.length}</span></p>
                <div className="flex justify-center gap-4 text-xs font-bold">
                    <div className="flex items-center gap-1"><div className="w-4 h-4 bg-emerald-500 rounded"></div> صح</div>
                    <div className="flex items-center gap-1"><div className="w-4 h-4 bg-amber-500 rounded"></div> مكان خطأ</div>
                    <div className="flex items-center gap-1"><div className="w-4 h-4 bg-red-500 rounded"></div> غير موجود</div>
                </div>
            </div>
            <div className="space-y-4 mb-10">
                {guesses.map((g, i) => (
                    <div key={i} className="flex justify-center gap-3 animate-in slide-in-from-right" dir="ltr">
                        {g.guess.split('').map((num, idx) => (
                            <div key={idx} className={`w-16 h-16 flex items-center justify-center text-2xl font-black text-white rounded-2xl shadow-xl transform transition-all hover:scale-110 ${g.feedback[idx] === 'green' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : g.feedback[idx] === 'yellow' ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-red-400 to-red-600'}`}>
                                {num}
                            </div>
                        ))}
                    </div>
                ))}
                {[...Array(MAX_GUESSES - guesses.length)].map((_, i) => (
                    <div key={i} className="flex justify-center gap-3 opacity-20" dir="ltr">
                        {[1,2,3].map(n => <div key={n} className="w-16 h-16 bg-gray-300 rounded-2xl"></div>)}
                    </div>
                ))}
            </div>
            {guesses.length < MAX_GUESSES && (
                <div className="flex gap-3 justify-center items-stretch" dir="ltr">
                    <input type="number" maxLength={3} value={currentGuess}
                        onChange={e => setCurrentGuess(e.target.value.slice(0,3))}
                        onKeyDown={e => e.key === 'Enter' && submitGuess()}
                        className="w-48 text-center text-3xl font-black p-4 bg-gray-50 border-4 border-emerald-300 focus:border-emerald-500 outline-none rounded-2xl shadow-lg"
                        placeholder="***" autoFocus/>
                    <button onClick={submitGuess} className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 rounded-2xl font-black hover:scale-105 active:scale-95 shadow-xl transition-all text-lg">
                        جرب ✨
                    </button>
                </div>
            )}
        </div>
    );
}

// ==========================================
// 4️⃣ تطابق الذاكرة
// ==========================================
const CARDS_DATA = ['🚑', '💊', '💉', '🔬', '🩺', '🦷'];

function MemoryMatchGame({ onStart, onComplete }: { onStart: () => Promise<void>, onComplete: (points: number, isWin: boolean) => void }) {
    const [cards, setCards] = useState<{ id: number, icon: string, isFlipped: boolean, isMatched: boolean }[]>([]);
    const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
    const [matches, setMatches] = useState(0);
    const [timeLeft, setTimeLeft] = useState(45);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);

    const startGame = async () => {
        setStarting(true);
        try { await onStart(); } catch(e) { setStarting(false); return; }
        const shuffled = [...CARDS_DATA, ...CARDS_DATA].sort(() => 0.5 - Math.random()).map((icon, idx) => ({ id: idx, icon, isFlipped: false, isMatched: false }));
        setCards(shuffled);
        setMatches(0);
        setFlippedIndices([]);
        setTimeLeft(45);
        setIsActive(true);
        setStarting(false);
    };

    useEffect(() => {
        let timer: any;
        if (isActive && timeLeft > 0) timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        else if (isActive && timeLeft === 0) { setIsActive(false); toast.error('انتهى الوقت! 💔'); setTimeout(() => onComplete(0, false), 1500); }
        return () => clearInterval(timer);
    }, [isActive, timeLeft, onComplete]);

    const handleCardClick = (index: number) => {
        if (!isActive || cards[index].isFlipped || cards[index].isMatched || flippedIndices.length === 2) return;
        const newCards = [...cards];
        newCards[index].isFlipped = true;
        setCards(newCards);
        const newFlipped = [...flippedIndices, index];
        setFlippedIndices(newFlipped);
        if (newFlipped.length === 2) {
            const [first, second] = newFlipped;
            if (newCards[first].icon === newCards[second].icon) {
                setTimeout(() => {
                    const matchedCards = [...newCards];
                    matchedCards[first].isMatched = true;
                    matchedCards[second].isMatched = true;
                    setCards(matchedCards);
                    setFlippedIndices([]);
                    setMatches(prev => {
                        const newMatches = prev + 1;
                        if (newMatches === CARDS_DATA.length) { setIsActive(false); toast.success('🎉 مبروك! أنهيت اللعبة!'); setTimeout(() => onComplete(20, true), 1000); }
                        return newMatches;
                    });
                }, 500);
            } else {
                setTimeout(() => {
                    const resetCards = [...newCards];
                    resetCards[first].isFlipped = false;
                    resetCards[second].isFlipped = false;
                    setCards(resetCards);
                    setFlippedIndices([]);
                }, 1000);
            }
        }
    };

    if (!isActive) {
        return (
            <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <Gamepad2 className="w-14 h-14 text-white animate-bounce"/>
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">تطابق الذاكرة 🧠</h3>
                <p className="text-base font-bold text-gray-600 mb-8 max-w-lg mx-auto">لديك 45 ثانية لتطابق جميع الأيقونات الطبية معاً. ركز جيداً!</p>
                <button onClick={startGame} disabled={starting}
                    className="bg-gradient-to-r from-orange-500 to-amber-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 text-lg">
                    {starting ? '⏳ جاري البدء...' : '🎮 ابدأ اللعب'}
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto py-6 text-center animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8 px-4">
                <div className={`px-6 py-3 rounded-2xl font-black text-xl shadow-lg transition-all ${timeLeft > 15 ? 'bg-orange-500 text-white' : 'bg-red-500 text-white animate-pulse'}`}>
                    ⏰ {timeLeft} ث
                </div>
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg">
                    ✅ {matches} / {CARDS_DATA.length}
                </div>
            </div>
            <div className="grid grid-cols-4 gap-3 md:gap-4 p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-3xl border-2 border-orange-200 shadow-xl" dir="ltr">
                {cards.map((card, idx) => (
                    <div key={card.id} onClick={() => handleCardClick(idx)}
                        className={`aspect-square rounded-2xl cursor-pointer transition-all duration-500 transform flex items-center justify-center text-4xl md:text-5xl shadow-lg hover:shadow-2xl ${card.isFlipped || card.isMatched ? 'bg-white rotate-y-180 border-2 border-orange-300' : 'bg-gradient-to-br from-gray-700 to-gray-900 hover:from-gray-600 hover:to-gray-800 border-b-4 border-gray-950'} ${card.isMatched ? 'opacity-50 scale-95' : 'hover:scale-105'} ${!card.isMatched && !card.isFlipped ? 'hover:rotate-6' : ''}`}>
                        {(card.isFlipped || card.isMatched) ? card.icon : <span className="text-white/30 text-2xl font-black">?</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ==========================================
// 5️⃣ سباق المعرفة الطبية (Adaptive)
// ==========================================
function MedicalQuizRush({ employee, diffProfile, onStart, onComplete }: { employee: Employee, diffProfile: DiffProfile, onStart: () => Promise<void>, onComplete: (points: number, isWin: boolean) => void }) {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);

    const { data: allQuestions = [], isLoading: loadingQuestions } = useQuery({
        queryKey: ['arcade_quiz_questions', employee.specialty],
        queryFn: async () => {
            const { data, error } = await supabase.from('arcade_quiz_questions')
                .select('id, question, option_a, option_b, option_c, option_d, correct_index, difficulty, specialty')
                .eq('is_active', true);
            if (error) throw error;
            // فلترة حسب التخصص بالعربي
            const filtered = (data || []).filter((q: any) => 
                !q.specialty || q.specialty.includes('الكل') || q.specialty.includes(employee.specialty)
            );
            return filtered as QuizQuestion[];
        },
        staleTime: 1000 * 60 * 10,
    });

    const startGame = async () => {
        if (allQuestions.length < 5) { toast.error('لا توجد أسئلة كافية حالياً'); return; }
        setStarting(true);
        try { await onStart(); } catch(e) { setStarting(false); return; }

        // توزيع الصعوبة حسب المستوى
        const diffSet = pickDifficultySet(diffProfile, 5);
        const selected: QuizQuestion[] = [];
        for (const diff of diffSet) {
            const pool = allQuestions.filter(q => q.difficulty === diff && !selected.find(s => s.id === q.id));
            const fallback = allQuestions.filter(q => !selected.find(s => s.id === q.id));
            const source = pool.length > 0 ? pool : fallback;
            if (source.length > 0) selected.push(source[Math.floor(Math.random() * source.length)]);
        }
        // تكملة لو ناقص
        if (selected.length < 5) {
            const remaining = allQuestions.filter(q => !selected.find(s => s.id === q.id)).sort(() => Math.random() - 0.5);
            selected.push(...remaining.slice(0, 5 - selected.length));
        }

        setQuestions(selected.sort(() => Math.random() - 0.5));
        setCurrentQuestion(0);
        setScore(0);
        setTimeLeft(60);
        setSelectedAnswer(null);
        setShowFeedback(false);
        setIsActive(true);
        setStarting(false);
    };

    useEffect(() => {
        let timer: any;
        if (isActive && timeLeft > 0) timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        else if (isActive && timeLeft === 0) { setIsActive(false); onComplete(0, false); }
        return () => clearInterval(timer);
    }, [isActive, timeLeft, onComplete]);

    const handleAnswer = (answerIndex: number) => {
        if (showFeedback) return;
        setSelectedAnswer(answerIndex);
        setShowFeedback(true);
        const isCorrect = answerIndex === questions[currentQuestion].correct_index;
        if (isCorrect) setScore(prev => prev + 1);
        setTimeout(() => {
            if (currentQuestion < questions.length - 1) {
                setCurrentQuestion(prev => prev + 1);
                setSelectedAnswer(null);
                setShowFeedback(false);
            } else {
                setIsActive(false);
                const finalScore = score + (isCorrect ? 1 : 0);
                const rawBase = finalScore * 3;
                const rawBonus = Math.floor(timeLeft / 3);
                const rawTotal = rawBase + rawBonus;
                const total = applyMultiplier(rawTotal, diffProfile);
                if (finalScore >= 3) {
                    toast.success(`رائع! ${finalScore}/5 إجابات صحيحة! 🎉`);
                    onComplete(total, true);
                } else {
                    toast.error(`حاول مرة أخرى! ${finalScore}/5 فقط 💔`);
                    onComplete(0, false);
                }
            }
        }, 1500);
    };

    if (!isActive) {
        return (
            <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <Brain className="w-14 h-14 text-white animate-pulse"/>
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">سباق المعرفة الطبية! 🏃‍♂️</h3>
                <p className="text-base font-bold text-gray-600 mb-4 max-w-lg mx-auto">أجب على 5 أسئلة طبية بأسرع وقت ممكن. كل ثانية توفرها = نقاط إضافية!</p>
                <p className="text-sm font-bold text-indigo-600 mb-6 flex items-center justify-center gap-1">
                    <Sparkles className="w-4 h-4"/> مستواك {diffProfile.emoji}: أسئلة مخصصة ×{diffProfile.multiplier.toFixed(1)} نقاط
                </p>
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-3xl max-w-md mx-auto mb-8 border-2 border-indigo-200">
                    <div className="grid grid-cols-2 gap-4 text-sm font-bold">
                        <div className="bg-white p-3 rounded-xl shadow-sm"><p className="text-indigo-600">⏱️ الوقت المحدد</p><p className="text-2xl text-gray-800">60 ثانية</p></div>
                        <div className="bg-white p-3 rounded-xl shadow-sm"><p className="text-indigo-600">❓ عدد الأسئلة</p><p className="text-2xl text-gray-800">5 أسئلة</p></div>
                        <div className="bg-white p-3 rounded-xl shadow-sm col-span-2"><p className="text-indigo-600">🎯 شرط النجاح</p><p className="text-lg text-gray-800">3 إجابات صحيحة على الأقل</p></div>
                    </div>
                </div>
                <button onClick={startGame} disabled={starting || loadingQuestions || allQuestions.length < 5}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg">
                    {loadingQuestions ? '⏳ جاري التحميل...' : starting ? '⏳ جاري البدء...' : '🚀 ابدأ السباق'}
                </button>
            </div>
        );
    }

    const currentQ = questions[currentQuestion];
    const currentOptions = [currentQ.option_a, currentQ.option_b, currentQ.option_c, currentQ.option_d];

    return (
        <div className="max-w-3xl mx-auto py-8 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8 px-4">
                <div className={`px-6 py-3 rounded-2xl font-black text-xl shadow-lg transition-all ${timeLeft > 20 ? 'bg-indigo-500 text-white' : 'bg-red-500 text-white animate-pulse'}`}>
                    ⏱️ {timeLeft} ث
                </div>
                <div className="bg-white px-6 py-3 rounded-2xl font-black shadow-lg border-2 border-indigo-200">
                    <span className="text-indigo-600">{currentQuestion + 1}</span><span className="text-gray-400"> / 5</span>
                </div>
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg">
                    ✅ {score} صحيحة
                </div>
            </div>
            <div className="w-full bg-gray-200 h-3 rounded-full mb-8 overflow-hidden shadow-inner">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300 rounded-full" style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}></div>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-8 rounded-3xl mb-8 border-2 border-indigo-200 shadow-xl">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-black text-xl flex-shrink-0 shadow-lg">
                        {currentQuestion + 1}
                    </div>
                    <h3 className="text-xl md:text-2xl font-black text-gray-900 leading-relaxed">{currentQ.question}</h3>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentOptions.map((option, idx) => {
                    let btnClass = "bg-white border-3 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50";
                    if (showFeedback) {
                        if (idx === currentQ.correct_index) btnClass = "bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-600 text-white";
                        else if (idx === selectedAnswer) btnClass = "bg-gradient-to-br from-red-400 to-red-600 border-red-600 text-white";
                        else btnClass = "bg-gray-100 border-gray-200 text-gray-400";
                    }
                    return (
                        <button key={idx} onClick={() => handleAnswer(idx)} disabled={showFeedback}
                            className={`${btnClass} p-5 rounded-2xl font-bold text-lg transition-all hover:scale-105 active:scale-95 shadow-md hover:shadow-xl disabled:cursor-not-allowed text-right flex items-center gap-3`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${showFeedback && idx === currentQ.correct_index ? 'bg-white text-emerald-600' : showFeedback && idx === selectedAnswer ? 'bg-white text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                {String.fromCharCode(65 + idx)}
                            </div>
                            <span className="flex-1">{option}</span>
                            {showFeedback && idx === currentQ.correct_index && <CheckCircle className="w-6 h-6 flex-shrink-0"/>}
                            {showFeedback && idx === selectedAnswer && idx !== currentQ.correct_index && <XCircle className="w-6 h-6 flex-shrink-0"/>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ==========================================
// 6️⃣ تحدي حساب الجرعات (Adaptive)
// ==========================================
function DoseCalculatorChallenge({ employee, diffProfile, onStart, onComplete }: { employee: Employee, diffProfile: DiffProfile, onStart: () => Promise<void>, onComplete: (points: number, isWin: boolean) => void }) {
    const [currentCase, setCurrentCase] = useState(0);
    const [score, setScore] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [cases, setCases] = useState<DoseScenario[]>([]);

    const { data: allScenarios = [], isLoading: loadingScenarios } = useQuery({
        queryKey: ['arcade_dose_scenarios', employee.specialty],
        queryFn: async () => {
            const { data, error } = await supabase.from('arcade_dose_scenarios')
                .select('id, scenario, question, option_a, option_b, option_c, option_d, correct_index, explanation, difficulty, specialty')
                .eq('is_active', true);
            if (error) throw error;
            // فلترة حسب التخصص بالعربي
            const filtered = (data || []).filter((s: any) => 
                !s.specialty || s.specialty.includes('الكل') || s.specialty.includes(employee.specialty)
            );
            return filtered as DoseScenario[];
        },
        staleTime: 1000 * 60 * 10,
    });

    const startGame = async () => {
        if (allScenarios.length < 3) { toast.error('لا توجد سيناريوهات كافية حالياً'); return; }
        setStarting(true);
        try { await onStart(); } catch(e) { setStarting(false); return; }

        // توزيع الصعوبة
        const diffSet = pickDifficultySet(diffProfile, 3);
        const selected: DoseScenario[] = [];
        for (const diff of diffSet) {
            const pool = allScenarios.filter(s => s.difficulty === diff && !selected.find(x => x.id === s.id));
            const fallback = allScenarios.filter(s => !selected.find(x => x.id === s.id));
            const source = pool.length > 0 ? pool : fallback;
            if (source.length > 0) selected.push(source[Math.floor(Math.random() * source.length)]);
        }
        if (selected.length < 3) {
            const remaining = allScenarios.filter(s => !selected.find(x => x.id === s.id)).sort(() => Math.random() - 0.5);
            selected.push(...remaining.slice(0, 3 - selected.length));
        }

        setCases(selected.sort(() => Math.random() - 0.5));
        setCurrentCase(0);
        setScore(0);
        setSelectedAnswer(null);
        setShowFeedback(false);
        setIsActive(true);
        setStarting(false);
    };

    const handleAnswer = (answerIndex: number) => {
        if (showFeedback) return;
        setSelectedAnswer(answerIndex);
        setShowFeedback(true);
        const isCorrect = answerIndex === cases[currentCase].correct_index;
        if (isCorrect) { setScore(prev => prev + 1); toast.success('إجابة صحيحة! 🎯', { duration: 1500 }); }
        else toast.error('خطأ! راجع الحساب 💔', { duration: 1500 });
        setTimeout(() => {
            if (currentCase < cases.length - 1) {
                setCurrentCase(prev => prev + 1);
                setSelectedAnswer(null);
                setShowFeedback(false);
            } else {
                setIsActive(false);
                const finalScore = score + (isCorrect ? 1 : 0);
                if (finalScore === cases.length) {
                    toast.success('مثالي! جميع الحسابات صحيحة! 🏆');
                    onComplete(applyMultiplier(30, diffProfile), true);
                } else if (finalScore >= 2) {
                    toast.success(`جيد! ${finalScore}/${cases.length} صحيحة 👍`);
                    onComplete(applyMultiplier(10, diffProfile), true);
                } else {
                    toast.error('تحتاج لمزيد من التدريب 💪');
                    onComplete(0, false);
                }
            }
        }, 3000);
    };

    if (!isActive) {
        return (
            <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-br from-rose-500 to-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <Calculator className="w-14 h-14 text-white"/>
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">تحدي حساب الجرعات 💊</h3>
                <p className="text-base font-bold text-gray-600 mb-4 max-w-md mx-auto">3 حالات طبية واقعية. احسب الجرعة الصحيحة واثبت كفاءتك!</p>
                <p className="text-sm font-bold text-rose-600 mb-6 flex items-center justify-center gap-1">
                    <Sparkles className="w-4 h-4"/> مستواك {diffProfile.emoji}: حالات مخصصة ×{diffProfile.multiplier.toFixed(1)} نقاط
                </p>
                {loadingScenarios ? <p className="text-gray-400 font-bold mb-4">⏳ جاري تحميل الحالات...</p>
                    : allScenarios.length < 3 ? <p className="text-red-400 font-bold mb-4">⚠️ لا توجد حالات كافية حالياً</p> : null}
                <button onClick={startGame} disabled={starting || loadingScenarios || allScenarios.length < 3}
                    className="bg-gradient-to-r from-rose-600 to-red-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg">
                    {loadingScenarios ? '⏳ جاري التحميل...' : starting ? '⏳ جاري البدء...' : '🚀 ابدأ التحدي'}
                </button>
            </div>
        );
    }

    const currentScenario = cases[currentCase];
    const currentOptions = [currentScenario.option_a, currentScenario.option_b, currentScenario.option_c, currentScenario.option_d];

    return (
        <div className="max-w-3xl mx-auto py-8 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8 px-4">
                <div className="bg-white px-6 py-3 rounded-2xl font-black shadow-lg border-2 border-rose-200">
                    <span className="text-rose-600">الحالة {currentCase + 1}</span><span className="text-gray-400"> / {cases.length}</span>
                </div>
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5"/> {score} صحيحة
                </div>
            </div>
            <div className="w-full bg-gray-200 h-3 rounded-full mb-8 overflow-hidden shadow-inner">
                <div className="h-full bg-gradient-to-r from-rose-500 to-red-600 transition-all duration-300 rounded-full" style={{ width: `${((currentCase + 1) / cases.length) * 100}%` }}></div>
            </div>
            <div className="bg-gradient-to-br from-rose-50 to-red-50 p-8 rounded-3xl mb-6 border-2 border-rose-200 shadow-xl">
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                        <Calculator className="w-8 h-8 text-white"/>
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-bold text-rose-600 mb-2">الحالة الطبية:</h4>
                        <p className="text-xl font-black text-gray-900 leading-relaxed">{currentScenario.scenario}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border-2 border-rose-200 shadow-md">
                    <AlertCircle className="w-6 h-6 text-rose-600 mb-2"/>
                    <h4 className="text-lg font-black text-gray-900">{currentScenario.question}</h4>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {currentOptions.map((option, idx) => {
                    let btnClass = "bg-white border-3 border-gray-200 hover:border-rose-400 hover:bg-rose-50";
                    if (showFeedback) {
                        if (idx === currentScenario.correct_index) btnClass = "bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-600 text-white";
                        else if (idx === selectedAnswer) btnClass = "bg-gradient-to-br from-red-400 to-red-600 border-red-600 text-white";
                        else btnClass = "bg-gray-100 border-gray-200 text-gray-400";
                    }
                    return (
                        <button key={idx} onClick={() => handleAnswer(idx)} disabled={showFeedback}
                            className={`${btnClass} p-6 rounded-2xl font-bold text-xl transition-all hover:scale-105 active:scale-95 shadow-md hover:shadow-xl disabled:cursor-not-allowed text-center`}>
                            <div className="flex items-center justify-center gap-3">
                                <span>{option}</span>
                                {showFeedback && idx === currentScenario.correct_index && <CheckCircle className="w-7 h-7"/>}
                                {showFeedback && idx === selectedAnswer && idx !== currentScenario.correct_index && <XCircle className="w-7 h-7"/>}
                            </div>
                        </button>
                    );
                })}
            </div>
            {showFeedback && (
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-3xl border-2 border-blue-200 shadow-xl animate-in slide-in-from-bottom">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                            <AlertCircle className="w-6 h-6 text-white"/>
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-blue-700 mb-2">التفسير:</h4>
                            <p className="text-lg font-black text-gray-900">{currentScenario.explanation}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
