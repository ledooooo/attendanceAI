import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gamepad2, Lock, Timer, Trophy, Loader2, Dices, HelpCircle, Star, Zap, Calculator, Brain, Award, Target, Clock, CheckCircle, XCircle, AlertCircle, TrendingUp, User } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    employee: Employee;
}

const COOLDOWN_HOURS = 5;

// كلمات لعبة فك الشفرة
const SCRAMBLE_WORDS = [
    { word: 'باراسيتامول', hint: 'مسكن وخافض للحرارة شهير' },
    { word: 'ميكروسكوب', hint: 'جهاز لتكبير الأشياء الدقيقة' },
    { word: 'أدرينالين', hint: 'هرمون يفرز في حالات الخوف والتوتر' },
    { word: 'أكسجين', hint: 'غاز ضروري للتنفس' },
    { word: 'مضادحيوي', hint: 'دواء لقتل البكتيريا' },
    { word: 'إستقبال', hint: 'أول مكان يدخله المريض' },
    { word: 'تعقيم', hint: 'قتل جميع الميكروبات' },
    { word: 'تخدير', hint: 'فقدان الإحساس بالألم' },
];

// بنك أسئلة Medical Quiz Rush
const QUIZ_BANK = [
    { q: 'ما هو المعدل الطبيعي لضربات القلب للبالغين؟', options: ['60-100 نبضة/دقيقة', '40-60 نبضة/دقيقة', '100-120 نبضة/دقيقة', '120-140 نبضة/دقيقة'], correct: 0 },
    { q: 'ما هي الجرعة القصوى للباراسيتامول للبالغين يومياً؟', options: ['2 جرام', '4 جرام', '6 جرام', '8 جرام'], correct: 1 },
    { q: 'كم عدد عظام جسم الإنسان البالغ؟', options: ['186', '206', '226', '246'], correct: 1 },
    { q: 'ما هو الضغط الطبيعي للدم؟', options: ['100/60', '120/80', '140/90', '160/100'], correct: 1 },
    { q: 'كم تبلغ نسبة الماء في جسم الإنسان البالغ؟', options: ['50%', '60%', '70%', '80%'], correct: 1 },
    { q: 'ما هو العضو المسؤول عن إنتاج الأنسولين؟', options: ['الكبد', 'البنكرياس', 'الكلى', 'الطحال'], correct: 1 },
    { q: 'كم عدد حجرات القلب؟', options: ['2', '3', '4', '5'], correct: 2 },
    { q: 'ما هي مدة الحمل الطبيعية؟', options: ['36 أسبوع', '38 أسبوع', '40 أسبوع', '42 أسبوع'], correct: 2 },
    { q: 'ما هو الفيتامين الذي يساعد على تجلط الدم؟', options: ['فيتامين A', 'فيتامين C', 'فيتامين D', 'فيتامين K'], correct: 3 },
    { q: 'كم لتر من الدم يضخ القلب يومياً؟', options: ['3000 لتر', '5000 لتر', '7000 لتر', '9000 لتر'], correct: 2 },
];

// بنك حالات Dose Calculator
const DOSE_SCENARIOS = [
    { 
        scenario: 'طفل وزنه 20 كجم، الجرعة الموصى بها: 10 ملجم/كجم',
        question: 'ما هي الجرعة الكلية المطلوبة؟',
        options: ['150 ملجم', '200 ملجم', '250 ملجم', '300 ملجم'],
        correct: 1,
        explanation: '20 كجم × 10 ملجم = 200 ملجم'
    },
    { 
        scenario: 'مريض وزنه 70 كجم، الجرعة: 5 ملجم/كجم مرتين يومياً',
        question: 'ما هي الجرعة اليومية الكلية؟',
        options: ['350 ملجم', '500 ملجم', '700 ملجم', '1000 ملجم'],
        correct: 2,
        explanation: '70 × 5 = 350 ملجم للمرة الواحدة × 2 = 700 ملجم يومياً'
    },
    { 
        scenario: 'دواء متوفر بتركيز 250 ملجم/5 مل، المطلوب: 500 ملجم',
        question: 'كم مل يجب إعطاؤها للمريض؟',
        options: ['5 مل', '10 مل', '15 مل', '20 مل'],
        correct: 1,
        explanation: '500 ملجم ÷ 250 ملجم = 2 × 5 مل = 10 مل'
    },
    { 
        scenario: 'طفل عمره 6 أشهر وزنه 7 كجم، باراسيتامول 15 ملجم/كجم',
        question: 'ما هي الجرعة الواحدة؟',
        options: ['85 ملجم', '105 ملجم', '125 ملجم', '145 ملجم'],
        correct: 1,
        explanation: '7 كجم × 15 ملجم = 105 ملجم'
    },
    { 
        scenario: 'محلول ملحي 0.9% - 1000 مل يُعطى على 8 ساعات',
        question: 'ما هو معدل التنقيط بالمل/ساعة؟',
        options: ['100 مل/ساعة', '125 مل/ساعة', '150 مل/ساعة', '175 مل/ساعة'],
        correct: 1,
        explanation: '1000 مل ÷ 8 ساعات = 125 مل/ساعة'
    },
];

export default function StaffArcade({ employee }: Props) {
    const queryClient = useQueryClient();
    const [activeGame, setActiveGame] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);

    // 1. جلب آخر محاولة لمعرفة هل هو في فترة الانتظار أم لا
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

    // 2. جلب لوحة الشرف (Top 10)
    const { data: leaderboard = [] } = useQuery({
        queryKey: ['arcade_leaderboard'],
        queryFn: async () => {
            const { data: scores } = await supabase
                .from('arcade_scores')
                .select('employee_id, points_earned, is_win, employees(name, photo_url)')
                .eq('is_win', true);
            
            if (!scores) return [];

            // تجميع النقاط لكل موظف
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
        const hrs = Math.floor(remainingMs / (1000 * 60 * 60));
        const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        return { hrs, mins };
    }, [lastPlay]);

    // ✅ دالة الخصم الفوري: تسجل المحاولة فور ضغط زر ابدأ لتجنب التلاعب
    const consumeAttempt = async (gameName: string) => {
        const { data, error } = await supabase.from('arcade_scores').insert({
            employee_id: employee.employee_id,
            game_name: gameName,
            points_earned: 0,
            is_win: false
        }).select('id').single();

        if (error) throw error;
        setSessionId(data.id);
        // تحديث الكاش لتفعيل القفل المؤقت في الخلفية مباشرة
        queryClient.invalidateQueries({ queryKey: ['last_arcade_play'] });
    };

    // ✅ دالة تحديث النتيجة بعد انتهاء اللعبة
    const finishAttemptMutation = useMutation({
        mutationFn: async ({ points, isWin, gameName }: { points: number, isWin: boolean, gameName: string }) => {
            if (!sessionId) return;

            // تحديث السجل الذي تم إنشاؤه مسبقاً
            await supabase.from('arcade_scores').update({
                points_earned: points,
                is_win: isWin
            }).eq('id', sessionId);

            // إضافة النقاط للرصيد العام إذا فاز
            if (isWin && points > 0) {
                await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: points });
                await supabase.from('points_ledger').insert({
                    employee_id: employee.employee_id,
                    points: points,
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
        <div className="space-y-6 animate-in fade-in pb-10">
            {/* Header المحسّن */}
            <div className="relative bg-gradient-to-br from-violet-600 via-fuchsia-600 to-purple-700 rounded-[2rem] p-8 text-white shadow-2xl overflow-hidden">
                {/* خلفية متحركة */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-10 right-10 w-40 h-40 bg-fuchsia-300 rounded-full blur-3xl animate-pulse delay-700"></div>
                </div>
                
                <div className="relative z-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-3xl md:text-4xl font-black flex items-center gap-3 mb-2">
                                <Gamepad2 className="w-10 h-10 text-fuchsia-300 animate-bounce"/> 
                                صالة الألعاب
                            </h2>
                            <p className="text-violet-100 text-sm md:text-base font-bold flex items-center gap-2">
                                <Clock className="w-4 h-4"/> محاولة واحدة كل 5 ساعات • اختبر مهاراتك واجمع النقاط!
                            </p>
                        </div>
                        <div className="hidden md:block">
                            <div className="bg-white/20 backdrop-blur-sm px-6 py-3 rounded-2xl border border-white/30">
                                <p className="text-xs text-violet-200 mb-1">رصيدك الحالي</p>
                                <p className="text-2xl font-black flex items-center gap-1">
                                    <Trophy className="w-5 h-5 text-yellow-300"/> {employee.total_points || 0}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {loadingPlay ? (
                <div className="text-center py-20 bg-white rounded-[2rem] shadow-sm">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto text-fuchsia-600 mb-4"/>
                    <p className="text-gray-500 font-bold">جاري التحميل...</p>
                </div>
            ) : activeGame !== null ? (
                /* 🕹️ شاشة اللعب النشطة */
                <div className="bg-white rounded-[2rem] shadow-xl border-2 border-gray-100 p-6 md:p-10">
                    <div className="flex justify-between items-center mb-8 pb-6 border-b-2 border-gray-100">
                        <h3 className="font-black text-xl md:text-2xl text-violet-700 flex items-center gap-2">
                            <Target className="w-6 h-6"/> تحدي قيد التنفيذ
                        </h3>
                        <div className="flex items-center gap-2 bg-violet-50 px-4 py-2 rounded-xl">
                            <Zap className="w-4 h-4 text-violet-600"/>
                            <span className="text-sm font-bold text-violet-700">جاري اللعب...</span>
                        </div>
                    </div>
                    
                    {finishAttemptMutation.isPending ? (
                        <div className="text-center py-24">
                            <Loader2 className="w-16 h-16 animate-spin mx-auto text-violet-600 mb-6"/>
                            <p className="text-xl font-black text-gray-700 mb-2">جاري تسجيل نتيجتك...</p>
                            <p className="text-sm text-gray-500">يرجى الانتظار</p>
                        </div>
                    ) : (
                        <>
                            {activeGame === 'spin' && <SpinAndAnswerGame employee={employee} onStart={() => consumeAttempt('عجلة الحظ')} onComplete={(pts, win) => finishAttemptMutation.mutate({ points: pts, isWin: win, gameName: 'عجلة الحظ' })} />}
                            {activeGame === 'scramble' && <WordScrambleGame onStart={() => consumeAttempt('فك الشفرة')} onComplete={(pts, win) => finishAttemptMutation.mutate({ points: pts, isWin: win, gameName: 'فك الشفرة' })} />}
                            {activeGame === 'safe' && <SafeCrackerGame onStart={() => consumeAttempt('الخزنة السرية')} onComplete={(pts, win) => finishAttemptMutation.mutate({ points: pts, isWin: win, gameName: 'الخزنة السرية' })} />}
                            {activeGame === 'memory' && <MemoryMatchGame onStart={() => consumeAttempt('تطابق الذاكرة')} onComplete={(pts, win) => finishAttemptMutation.mutate({ points: pts, isWin: win, gameName: 'تطابق الذاكرة' })} />}
                            {activeGame === 'quiz' && <MedicalQuizRush onStart={() => consumeAttempt('سباق المعرفة الطبية')} onComplete={(pts, win) => finishAttemptMutation.mutate({ points: pts, isWin: win, gameName: 'سباق المعرفة الطبية' })} />}
                            {activeGame === 'dose' && <DoseCalculatorChallenge onStart={() => consumeAttempt('تحدي حساب الجرعات')} onComplete={(pts, win) => finishAttemptMutation.mutate({ points: pts, isWin: win, gameName: 'تحدي حساب الجرعات' })} />}
                        </>
                    )}
                </div>
            ) : timeRemaining ? (
                /* 🔒 شاشة القفل المؤقت المحسّنة */
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-12 rounded-[2rem] text-center border-2 border-gray-200 shadow-xl animate-in zoom-in-95">
                    <div className="bg-white w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <Timer className="w-16 h-16 text-violet-500 animate-pulse"/>
                    </div>
                    <h3 className="text-3xl font-black text-gray-800 mb-3">وقت الراحة! ☕</h3>
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
                /* 🎮 قائمة الألعاب المحسّنة */
                <div>
                    <div className="mb-6 flex items-center justify-between">
                        <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                            <Star className="w-6 h-6 text-yellow-500"/> اختر لعبتك المفضلة
                        </h3>
                        <div className="text-sm font-bold text-gray-500 bg-gray-100 px-4 py-2 rounded-xl">
                            6 ألعاب متاحة
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {/* Game 1 - Enhanced */}
                        <button onClick={() => setActiveGame('spin')} className="group bg-gradient-to-br from-fuchsia-50 to-pink-50 border-2 border-fuchsia-100 hover:border-fuchsia-300 p-6 rounded-3xl shadow-md hover:shadow-2xl transition-all text-right flex flex-col relative overflow-hidden hover:scale-105 active:scale-95">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-200/20 rounded-full blur-3xl group-hover:blur-2xl transition-all"></div>
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-12 transition-transform shadow-lg">
                                    <Dices className="w-9 h-9"/>
                                </div>
                                <h3 className="font-black text-gray-900 text-xl mb-2">عجلة الحظ المزدوجة</h3>
                                <p className="text-xs text-gray-600 font-bold leading-relaxed mb-4 flex-1">لف العجلة لتحديد الجائزة، ثم أجب على سؤال طبي من تخصصك لتفوز بها!</p>
                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-fuchsia-100">
                                    <span className="text-xs bg-white text-fuchsia-700 px-3 py-1.5 rounded-lg font-black shadow-sm">حظ + ذكاء</span>
                                    <span className="text-xs text-fuchsia-600 font-black flex items-center gap-1">
                                        <Trophy className="w-3 h-3"/> 5-30 نقطة
                                    </span>
                                </div>
                            </div>
                        </button>

                        {/* Game 2 - Enhanced */}
                        <button onClick={() => setActiveGame('scramble')} className="group bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-100 hover:border-blue-300 p-6 rounded-3xl shadow-md hover:shadow-2xl transition-all text-right flex flex-col overflow-hidden hover:scale-105 active:scale-95">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200/20 rounded-full blur-3xl group-hover:blur-2xl transition-all"></div>
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 text-white rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                                    <Timer className="w-9 h-9"/>
                                </div>
                                <h3 className="font-black text-gray-900 text-xl mb-2">فك الشفرة</h3>
                                <p className="text-xs text-gray-600 font-bold leading-relaxed mb-4 flex-1">حروف مبعثرة! رتبها بسرعة. النقاط تنقص كل ثانية تتأخر فيها.</p>
                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-blue-100">
                                    <span className="text-xs bg-white text-blue-700 px-3 py-1.5 rounded-lg font-black shadow-sm">سرعة بديهة</span>
                                    <span className="text-xs text-blue-600 font-black flex items-center gap-1">
                                        <Trophy className="w-3 h-3"/> 5-10 نقطة
                                    </span>
                                </div>
                            </div>
                        </button>

                        {/* Game 3 - Enhanced */}
                        <button onClick={() => setActiveGame('safe')} className="group bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-100 hover:border-emerald-300 p-6 rounded-3xl shadow-md hover:shadow-2xl transition-all text-right flex flex-col overflow-hidden hover:scale-105 active:scale-95">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-200/20 rounded-full blur-3xl group-hover:blur-2xl transition-all"></div>
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                                    <Lock className="w-9 h-9"/>
                                </div>
                                <h3 className="font-black text-gray-900 text-xl mb-2">الخزنة السرية</h3>
                                <p className="text-xs text-gray-600 font-bold leading-relaxed mb-4 flex-1">خمن الرقم السري (3 أرقام) بناءً على تلميحات الألوان في 5 محاولات.</p>
                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-emerald-100">
                                    <span className="text-xs bg-white text-emerald-700 px-3 py-1.5 rounded-lg font-black shadow-sm">ذكاء ومنطق</span>
                                    <span className="text-xs text-emerald-600 font-black flex items-center gap-1">
                                        <Trophy className="w-3 h-3"/> 25 نقطة
                                    </span>
                                </div>
                            </div>
                        </button>

                        {/* Game 4 - Enhanced */}
                        <button onClick={() => setActiveGame('memory')} className="group bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-100 hover:border-orange-300 p-6 rounded-3xl shadow-md hover:shadow-2xl transition-all text-right flex flex-col overflow-hidden hover:scale-105 active:scale-95">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-200/20 rounded-full blur-3xl group-hover:blur-2xl transition-all"></div>
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 text-white rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                                    <Gamepad2 className="w-9 h-9"/>
                                </div>
                                <h3 className="font-black text-gray-900 text-xl mb-2">تطابق الذاكرة</h3>
                                <p className="text-xs text-gray-600 font-bold leading-relaxed mb-4 flex-1">اقلب الكروت وتذكر أماكنها لتطابق الأيقونات الطبية قبل انتهاء الوقت.</p>
                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-orange-100">
                                    <span className="text-xs bg-white text-orange-700 px-3 py-1.5 rounded-lg font-black shadow-sm">قوة ذاكرة</span>
                                    <span className="text-xs text-orange-600 font-black flex items-center gap-1">
                                        <Trophy className="w-3 h-3"/> 25 نقطة
                                    </span>
                                </div>
                            </div>
                        </button>

                        {/* 🆕 Game 5 - Medical Quiz Rush */}
                        <button onClick={() => setActiveGame('quiz')} className="group bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-100 hover:border-indigo-300 p-6 rounded-3xl shadow-md hover:shadow-2xl transition-all text-right flex flex-col overflow-hidden hover:scale-105 active:scale-95">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-200/20 rounded-full blur-3xl group-hover:blur-2xl transition-all"></div>
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                                    <Brain className="w-9 h-9"/>
                                </div>
                                <div className="absolute -top-2 -left-2 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-md animate-pulse">
                                    جديد!
                                </div>
                                <h3 className="font-black text-gray-900 text-xl mb-2">سباق المعرفة الطبية</h3>
                                <p className="text-xs text-gray-600 font-bold leading-relaxed mb-4 flex-1">أجب على 5 أسئلة طبية متتالية بأسرع وقت. كل ثانية توفرها = نقاط إضافية!</p>
                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-indigo-100">
                                    <span className="text-xs bg-white text-indigo-700 px-3 py-1.5 rounded-lg font-black shadow-sm">معرفة + سرعة</span>
                                    <span className="text-xs text-indigo-600 font-black flex items-center gap-1">
                                        <Trophy className="w-3 h-3"/> 15-35 نقطة
                                    </span>
                                </div>
                            </div>
                        </button>

                        {/* 🆕 Game 6 - Dose Calculator Challenge */}
                        <button onClick={() => setActiveGame('dose')} className="group bg-gradient-to-br from-rose-50 to-red-50 border-2 border-rose-100 hover:border-rose-300 p-6 rounded-3xl shadow-md hover:shadow-2xl transition-all text-right flex flex-col overflow-hidden hover:scale-105 active:scale-95">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-200/20 rounded-full blur-3xl group-hover:blur-2xl transition-all"></div>
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-gradient-to-br from-rose-500 to-red-600 text-white rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                                    <Calculator className="w-9 h-9"/>
                                </div>
                                <div className="absolute -top-2 -left-2 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-md animate-pulse">
                                    جديد!
                                </div>
                                <h3 className="font-black text-gray-900 text-xl mb-2">تحدي حساب الجرعات</h3>
                                <p className="text-xs text-gray-600 font-bold leading-relaxed mb-4 flex-1">احسب الجرعات الدوائية بدقة. اختبار حقيقي لمهاراتك الحسابية الطبية!</p>
                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-rose-100">
                                    <span className="text-xs bg-white text-rose-700 px-3 py-1.5 rounded-lg font-black shadow-sm">دقة حسابية</span>
                                    <span className="text-xs text-rose-600 font-black flex items-center gap-1">
                                        <Trophy className="w-3 h-3"/> 30 نقطة
                                    </span>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* 🏆 لوحة الشرف المحسّنة */}
            {activeGame === null && (
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-[2rem] border-2 border-amber-200 shadow-xl p-8 mt-10">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-black text-2xl md:text-3xl text-gray-800 flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <Trophy className="w-7 h-7 text-white"/>
                            </div>
                            أبطال الألعاب
                        </h3>
                        <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-amber-200">
                            <p className="text-xs text-amber-600 font-black">Top 10</p>
                        </div>
                    </div>
                    
                    {leaderboard.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-amber-200">
                            <Award className="w-20 h-20 text-amber-300 mx-auto mb-4"/>
                            <p className="text-xl font-black text-gray-400 mb-2">لا يوجد فائزين حتى الآن</p>
                            <p className="text-sm text-gray-500 font-bold">كن أنت الأول! 🚀</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {leaderboard.map((user, idx) => (
                                <div key={user.id} className={`flex items-center justify-between bg-white p-4 rounded-2xl border-2 transition-all hover:scale-105 hover:shadow-lg ${
                                    idx === 0 ? 'border-yellow-400 shadow-lg shadow-yellow-200/50' : 
                                    idx === 1 ? 'border-gray-300 shadow-md' : 
                                    idx === 2 ? 'border-amber-300 shadow-md' : 
                                    'border-gray-100'
                                }`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg text-white shadow-lg transform transition-transform hover:rotate-12 ${
                                            idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' : 
                                            idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' : 
                                            idx === 2 ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 
                                            'bg-gradient-to-br from-violet-400 to-violet-600'
                                        }`}>
                                            {idx === 0 ? '👑' : idx + 1}
                                        </div>
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-white shadow-md overflow-hidden">
                                            {user.photo ? 
                                                <img src={user.photo} className="w-full h-full object-cover"/> : 
                                                <User className="w-full h-full p-2.5 text-gray-400"/>
                                            }
                                        </div>
                                        <div>
                                            <h4 className="font-black text-base text-gray-900">{user.name}</h4>
                                            <p className="text-xs text-gray-500 font-bold flex items-center gap-1">
                                                <TrendingUp className="w-3 h-3"/> {user.wins} انتصارات
                                            </p>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-br from-violet-500 to-fuchsia-600 px-5 py-2.5 rounded-xl shadow-lg border-2 border-white">
                                        <p className="font-black text-white text-lg leading-none">{user.points}</p>
                                        <p className="text-[10px] text-violet-100 font-bold">نقطة</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ==========================================
// 1️⃣ عجلة الحظ + سؤال (Spin & Answer) - محسّنة
// ==========================================
function SpinAndAnswerGame({ employee, onStart, onComplete }: { employee: Employee, onStart: () => Promise<void>, onComplete: (points: number, isWin: boolean) => void }) {
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
            return data.filter(q => q.specialty.includes('all') || q.specialty.includes(employee.specialty));
        }
    });

    const startSpin = async () => {
        if (spinning || starting) return;
        setStarting(true);
        try {
            await onStart();
        } catch (e) {
            setStarting(false);
            return;
        }

        setSpinning(true);
        const options = [5, 10, 15, 20, 30];
        const result = options[Math.floor(Math.random() * options.length)];
        
        setTimeout(() => {
            setPointsWon(result);
            setSpinning(false);
            
            if (questions && questions.length > 0) {
                setQuestion(questions[Math.floor(Math.random() * questions.length)]);
                setPhase('question');
            } else {
                toast.success('ربحت مباشرة لعدم توفر أسئلة!');
                onComplete(result, true);
            }
        }, 3000); 
    };

    useEffect(() => {
        let timer: any;
        if (phase === 'question' && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (phase === 'question' && timeLeft === 0) {
            onComplete(0, false); 
        }
        return () => clearInterval(timer);
    }, [phase, timeLeft, onComplete]);

    const handleAnswer = (opt: string) => {
        if (opt.trim() === question.correct_answer.trim()) {
            onComplete(pointsWon, true);
        } else {
            onComplete(0, false);
        }
    };

    if (phase === 'spin') {
        return (
            <div className="text-center py-12 animate-in zoom-in-95">
                <h3 className="text-3xl font-black text-gray-800 mb-3 flex items-center justify-center gap-2">
                    <Dices className="w-8 h-8 text-fuchsia-600"/> لف العجلة!
                </h3>
                <p className="text-base font-bold text-gray-500 mb-10">سيتم خصم المحاولة بمجرد بدء اللف</p>
                
                <div className={`w-64 h-64 mx-auto rounded-full border-[12px] border-violet-200 flex items-center justify-center text-5xl shadow-2xl transition-all duration-[3000ms] ${spinning ? 'rotate-[1440deg] blur-sm scale-105' : ''}`} 
                     style={{ background: 'conic-gradient(#fca5a5 0% 20%, #fcd34d 20% 40%, #86efac 40% 60%, #93c5fd 60% 80%, #c4b5fd 80% 100%)' }}>
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl z-10 font-black text-violet-700 border-4 border-violet-100">
                        {spinning ? '🎰' : '🎁'}
                    </div>
                </div>
                
                <button 
                    onClick={startSpin} 
                    disabled={spinning || starting} 
                    className="mt-10 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-12 py-5 rounded-2xl font-black shadow-2xl hover:shadow-3xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                    {spinning ? '🎲 جاري اللف...' : starting ? '⏳ جاري البدء...' : '✨ اضغط للّف (خصم محاولة)'}
                </button>
            </div>
        );
    }

    let parsedOptions: string[] = [];
    if (question && question.options) {
        if (Array.isArray(question.options)) parsedOptions = question.options;
        else if (typeof question.options === 'string') {
            try { parsedOptions = JSON.parse(question.options); } 
            catch (e) { parsedOptions = question.options.split(',').map((s: string) => s.trim()); }
        }
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
                    <button 
                        key={i} 
                        onClick={() => handleAnswer(opt)} 
                        className="bg-white border-3 border-gray-200 p-5 rounded-2xl font-bold text-gray-800 hover:border-violet-500 hover:bg-violet-50 hover:scale-105 transition-all active:scale-95 shadow-md hover:shadow-xl text-lg"
                    >
                        {opt}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ==========================================
// 2️⃣ فك الشفرة (Word Scramble) - محسّنة
// ==========================================
function WordScrambleGame({ onStart, onComplete }: { onStart: () => Promise<void>, onComplete: (points: number, isWin: boolean) => void }) {
    const [wordObj, setWordObj] = useState(SCRAMBLE_WORDS[0]);
    const [scrambledArray, setScrambledArray] = useState<string[]>([]);
    const [input, setInput] = useState('');
    const [timeLeft, setTimeLeft] = useState(20); 
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);

    const startGame = async () => {
        setStarting(true);
        try {
            await onStart();
        } catch(e) {
            setStarting(false);
            return;
        }

        const randomWord = SCRAMBLE_WORDS[Math.floor(Math.random() * SCRAMBLE_WORDS.length)];
        setWordObj(randomWord);
        setScrambledArray(randomWord.word.split('').sort(() => 0.5 - Math.random()));
        setTimeLeft(20);
        setInput('');
        setIsActive(true);
        setStarting(false);
    };

    useEffect(() => {
        let timer: any;
        if (isActive && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (isActive && timeLeft === 0) {
            setIsActive(false);
            onComplete(0, false); 
        }
        return () => clearInterval(timer);
    }, [isActive, timeLeft, onComplete]);

    const checkAnswer = () => {
        if (input.trim() === wordObj.word) {
            setIsActive(false);
            const points = Math.max(5, Math.floor(timeLeft));  // من 10 لـ 3 نقاط
            onComplete(points, true);
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
                <p className="text-base font-bold text-gray-600 mb-8 max-w-md mx-auto">
                    النقاط تتناقص كل ثانية! رتب الحروف المبعثرة واكتب الكلمة بأسرع ما يمكن.
                </p>
                <button 
                    onClick={startGame} 
                    disabled={starting} 
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg"
                >
                    {starting ? '⏳ جاري البدء...' : '🚀 ابدأ التحدي'}
                </button>
            </div>
        );
    }

    const currentPoints = Math.max(5, timeLeft);

    return (
        <div className="text-center py-10 max-w-2xl mx-auto animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-10 px-4">
                <div className={`px-6 py-3 rounded-2xl font-black text-xl shadow-lg transition-all ${
                    timeLeft > 10 ? 'bg-blue-500 text-white' : 'bg-red-500 text-white animate-pulse'
                }`}>
                    ⏱️ {timeLeft} ث
                </div>
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg">
                    💎 الآن: {currentPoints} نقطة
                </div>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-3xl mb-3 border-2 border-blue-200">
                <p className="text-sm font-bold text-blue-700 mb-2">💡 تلميح:</p>
                <p className="text-base font-black text-gray-800">{wordObj.hint}</p>
            </div>
            
            <div className="flex flex-wrap justify-center gap-3 mb-12 p-6 bg-white rounded-3xl shadow-xl border-2 border-gray-100" dir="ltr">
                {scrambledArray.map((letter, idx) => (
                    <div 
                        key={idx} 
                        className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 border-4 border-blue-200 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-lg transform hover:scale-110 transition-transform"
                    >
                        {letter}
                    </div>
                ))}
            </div>
            
            <input 
                type="text" 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && checkAnswer()}
                className="w-full text-center text-2xl font-black p-6 bg-gray-50 border-4 border-blue-300 focus:border-blue-500 outline-none rounded-3xl mb-6 transition-all shadow-lg"
                placeholder="اكتب الكلمة مجمعة هنا..." 
                autoFocus
            />
            
            <button 
                onClick={checkAnswer} 
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-5 rounded-3xl font-black shadow-2xl hover:scale-105 active:scale-95 transition-all text-xl"
            >
                ✅ تحقق من الإجابة (الجائزة: {currentPoints} نقطة)
            </button>
        </div>
    );
}

// ==========================================
// 3️⃣ الخزنة السرية (Safe Cracker) - محسّنة
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
        try {
            await onStart();
        } catch(e) {
            setStarting(false);
            return;
        }

        let code = '';
        while(code.length < 3) {
            const r = Math.floor(Math.random() * 9) + 1; 
            if(!code.includes(r.toString())) code += r;
        }
        setSecretCode(code);
        setGuesses([]);
        setCurrentGuess('');
        setIsActive(true);
        setStarting(false);
    };

    const submitGuess = () => {
        if (currentGuess.length !== 3) { 
            toast.error('يجب إدخال 3 أرقام فقط!', { icon: '⚠️' }); 
            return; 
        }

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
            setTimeout(() => {
                toast.success('🎉 أحسنت! فتحت الخزنة!', { duration: 3000 });
                onComplete(25, true);
            }, 800); 
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
                    <div className="text-center">
                        <div className="w-12 h-12 bg-emerald-500 rounded-xl mb-2 shadow-md"></div>
                        <p className="text-xs font-bold text-gray-600">رقم صحيح<br/>مكان صحيح</p>
                    </div>
                    <div className="text-center">
                        <div className="w-12 h-12 bg-amber-500 rounded-xl mb-2 shadow-md"></div>
                        <p className="text-xs font-bold text-gray-600">رقم صحيح<br/>مكان خطأ</p>
                    </div>
                    <div className="text-center">
                        <div className="w-12 h-12 bg-red-500 rounded-xl mb-2 shadow-md"></div>
                        <p className="text-xs font-bold text-gray-600">رقم غير<br/>موجود</p>
                    </div>
                </div>
                <button 
                    onClick={startGame} 
                    disabled={starting} 
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg"
                >
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
            
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-3xl mb-8 border-2 border-emerald-200">
                <p className="text-sm font-bold text-gray-700 mb-3">المحاولات المتبقية: <span className="text-2xl text-emerald-600 font-black">{MAX_GUESSES - guesses.length}</span></p>
                <div className="flex justify-center gap-4 text-xs font-bold">
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-emerald-500 rounded"></div> صح
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-amber-500 rounded"></div> مكان خطأ
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-red-500 rounded"></div> غير موجود
                    </div>
                </div>
            </div>
            
            <div className="space-y-4 mb-10">
                {guesses.map((g, i) => (
                    <div key={i} className="flex justify-center gap-3 animate-in slide-in-from-right" dir="ltr">
                        {g.guess.split('').map((num, idx) => (
                            <div 
                                key={idx} 
                                className={`w-16 h-16 flex items-center justify-center text-2xl font-black text-white rounded-2xl shadow-xl transform transition-all hover:scale-110 ${
                                    g.feedback[idx] === 'green' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 
                                    g.feedback[idx] === 'yellow' ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 
                                    'bg-gradient-to-br from-red-400 to-red-600'
                                }`}
                            >
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
                    <input 
                        type="number" 
                        maxLength={3} 
                        value={currentGuess} 
                        onChange={e => setCurrentGuess(e.target.value.slice(0,3))}
                        onKeyDown={e => e.key === 'Enter' && submitGuess()}
                        className="w-48 text-center text-3xl font-black p-4 bg-gray-50 border-4 border-emerald-300 focus:border-emerald-500 outline-none rounded-2xl shadow-lg" 
                        placeholder="***" 
                        autoFocus
                    />
                    <button 
                        onClick={submitGuess} 
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 rounded-2xl font-black hover:scale-105 active:scale-95 shadow-xl transition-all text-lg"
                    >
                        جرب ✨
                    </button>
                </div>
            )}
        </div>
    );
}

// ==========================================
// 4️⃣ تطابق الذاكرة (Memory Match) - محسّنة
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
        try {
            await onStart();
        } catch(e) {
            setStarting(false);
            return;
        }

        const shuffled = [...CARDS_DATA, ...CARDS_DATA]
            .sort(() => 0.5 - Math.random())
            .map((icon, idx) => ({ id: idx, icon, isFlipped: false, isMatched: false }));
        setCards(shuffled);
        setMatches(0);
        setFlippedIndices([]);
        setTimeLeft(45);
        setIsActive(true);
        setStarting(false);
    };

    useEffect(() => {
        let timer: any;
        if (isActive && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (isActive && timeLeft === 0) {
            setIsActive(false);
            toast.error('انتهى الوقت! 💔');
            setTimeout(() => onComplete(0, false), 1500); 
        }
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
                        if (newMatches === CARDS_DATA.length) {
                            setIsActive(false);
                            toast.success('🎉 مبروك! أنهيت اللعبة!');
                            setTimeout(() => onComplete(25, true), 1000); 
                        }
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
                <p className="text-base font-bold text-gray-600 mb-8 max-w-lg mx-auto">
                    لديك 45 ثانية لتطابق جميع الأيقونات الطبية معاً. ركز جيداً!
                </p>
                <button 
                    onClick={startGame} 
                    disabled={starting} 
                    className="bg-gradient-to-r from-orange-500 to-amber-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 text-lg"
                >
                    {starting ? '⏳ جاري البدء...' : '🎮 ابدأ اللعب'}
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto py-6 text-center animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8 px-4">
                <div className={`px-6 py-3 rounded-2xl font-black text-xl shadow-lg transition-all ${
                    timeLeft > 15 ? 'bg-orange-500 text-white' : 'bg-red-500 text-white animate-pulse'
                }`}>
                    ⏰ {timeLeft} ث
                </div>
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg">
                    ✅ {matches} / {CARDS_DATA.length}
                </div>
            </div>
            
            <div className="grid grid-cols-4 gap-3 md:gap-4 p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-3xl border-2 border-orange-200 shadow-xl" dir="ltr">
                {cards.map((card, idx) => (
                    <div 
                        key={card.id} 
                        onClick={() => handleCardClick(idx)}
                        className={`aspect-square rounded-2xl cursor-pointer transition-all duration-500 transform flex items-center justify-center text-4xl md:text-5xl shadow-lg hover:shadow-2xl
                            ${card.isFlipped || card.isMatched ? 
                                'bg-white rotate-y-180 border-2 border-orange-300' : 
                                'bg-gradient-to-br from-gray-700 to-gray-900 hover:from-gray-600 hover:to-gray-800 border-b-4 border-gray-950'
                            }
                            ${card.isMatched ? 'opacity-50 scale-95' : 'hover:scale-105'}
                            ${!card.isMatched && !card.isFlipped ? 'hover:rotate-6' : ''}`}
                    >
                        {(card.isFlipped || card.isMatched) ? 
                            card.icon : 
                            <span className="text-white/30 text-2xl font-black">?</span>
                        }
                    </div>
                ))}
            </div>
        </div>
    );
}

// ==========================================
// 🆕 5️⃣ Medical Quiz Rush - سباق المعرفة الطبية
// ==========================================
function MedicalQuizRush({ onStart, onComplete }: { onStart: () => Promise<void>, onComplete: (points: number, isWin: boolean) => void }) {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60); // دقيقة واحدة لـ 5 أسئلة
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [questions, setQuestions] = useState<typeof QUIZ_BANK>([]);

    const startGame = async () => {
        setStarting(true);
        try {
            await onStart();
        } catch(e) {
            setStarting(false);
            return;
        }

        // اختيار 5 أسئلة عشوائية
        const shuffled = [...QUIZ_BANK].sort(() => 0.5 - Math.random()).slice(0, 5);
        setQuestions(shuffled);
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
        if (isActive && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (isActive && timeLeft === 0) {
            setIsActive(false);
            onComplete(0, false);
        }
        return () => clearInterval(timer);
    }, [isActive, timeLeft, onComplete]);

    const handleAnswer = (answerIndex: number) => {
        if (showFeedback) return;
        
        setSelectedAnswer(answerIndex);
        setShowFeedback(true);
        
        const isCorrect = answerIndex === questions[currentQuestion].correct;
        if (isCorrect) {
            setScore(prev => prev + 1);
        }

        setTimeout(() => {
            if (currentQuestion < questions.length - 1) {
                setCurrentQuestion(prev => prev + 1);
                setSelectedAnswer(null);
                setShowFeedback(false);
            } else {
                setIsActive(false);
                const finalScore = score + (isCorrect ? 1 : 0);
const basePoints = finalScore * 5; // 5 نقاط لكل سؤال صحيح
const timeBonus = Math.floor(timeLeft / 2); // نقطة إضافية لكل ثانيتين
                const totalPoints = basePoints + timeBonus;
                
                if (finalScore >= 3) { // نجاح إذا أجاب على 3 أسئلة صحيحة على الأقل
                    toast.success(`رائع! ${finalScore}/5 إجابات صحيحة! 🎉`);
                    onComplete(totalPoints, true);
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
                <p className="text-base font-bold text-gray-600 mb-6 max-w-lg mx-auto">
                    أجب على 5 أسئلة طبية بأسرع وقت ممكن. كل ثانية توفرها = نقاط إضافية!
                </p>
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-3xl max-w-md mx-auto mb-8 border-2 border-indigo-200">
                    <div className="grid grid-cols-2 gap-4 text-sm font-bold">
                        <div className="bg-white p-3 rounded-xl shadow-sm">
                            <p className="text-indigo-600">⏱️ الوقت المحدد</p>
                            <p className="text-2xl text-gray-800">60 ثانية</p>
                        </div>
                        <div className="bg-white p-3 rounded-xl shadow-sm">
                            <p className="text-indigo-600">❓ عدد الأسئلة</p>
                            <p className="text-2xl text-gray-800">5 أسئلة</p>
                        </div>
                        <div className="bg-white p-3 rounded-xl shadow-sm col-span-2">
                            <p className="text-indigo-600">🎯 شرط النجاح</p>
                            <p className="text-lg text-gray-800">3 إجابات صحيحة على الأقل</p>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={startGame} 
                    disabled={starting} 
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg"
                >
                    {starting ? '⏳ جاري البدء...' : '🚀 ابدأ السباق'}
                </button>
            </div>
        );
    }

    const currentQ = questions[currentQuestion];

    return (
        <div className="max-w-3xl mx-auto py-8 animate-in zoom-in-95">
            {/* Header */}
            <div className="flex justify-between items-center mb-8 px-4">
                <div className={`px-6 py-3 rounded-2xl font-black text-xl shadow-lg transition-all ${
                    timeLeft > 20 ? 'bg-indigo-500 text-white' : 'bg-red-500 text-white animate-pulse'
                }`}>
                    ⏱️ {timeLeft} ث
                </div>
                <div className="bg-white px-6 py-3 rounded-2xl font-black shadow-lg border-2 border-indigo-200">
                    <span className="text-indigo-600">{currentQuestion + 1}</span>
                    <span className="text-gray-400"> / 5</span>
                </div>
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg">
                    ✅ {score} صحيحة
                </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 h-3 rounded-full mb-8 overflow-hidden shadow-inner">
                <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300 rounded-full"
                    style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                ></div>
            </div>

            {/* Question */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-8 rounded-3xl mb-8 border-2 border-indigo-200 shadow-xl">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-black text-xl flex-shrink-0 shadow-lg">
                        {currentQuestion + 1}
                    </div>
                    <h3 className="text-xl md:text-2xl font-black text-gray-900 leading-relaxed">{currentQ.q}</h3>
                </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQ.options.map((option, idx) => {
                    let buttonClass = "bg-white border-3 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50";
                    
                    if (showFeedback) {
                        if (idx === currentQ.correct) {
                            buttonClass = "bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-600 text-white";
                        } else if (idx === selectedAnswer) {
                            buttonClass = "bg-gradient-to-br from-red-400 to-red-600 border-red-600 text-white";
                        } else {
                            buttonClass = "bg-gray-100 border-gray-200 text-gray-400";
                        }
                    }

                    return (
                        <button
                            key={idx}
                            onClick={() => handleAnswer(idx)}
                            disabled={showFeedback}
                            className={`${buttonClass} p-5 rounded-2xl font-bold text-lg transition-all hover:scale-105 active:scale-95 shadow-md hover:shadow-xl disabled:cursor-not-allowed text-right flex items-center gap-3`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${
                                showFeedback && idx === currentQ.correct ? 'bg-white text-emerald-600' :
                                showFeedback && idx === selectedAnswer ? 'bg-white text-red-600' :
                                'bg-indigo-100 text-indigo-600'
                            }`}>
                                {String.fromCharCode(65 + idx)}
                            </div>
                            <span className="flex-1">{option}</span>
                            {showFeedback && idx === currentQ.correct && <CheckCircle className="w-6 h-6 flex-shrink-0"/>}
                            {showFeedback && idx === selectedAnswer && idx !== currentQ.correct && <XCircle className="w-6 h-6 flex-shrink-0"/>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ==========================================
// 🆕 6️⃣ Dose Calculator Challenge - تحدي حساب الجرعات
// ==========================================
function DoseCalculatorChallenge({ onStart, onComplete }: { onStart: () => Promise<void>, onComplete: (points: number, isWin: boolean) => void }) {
    const [currentCase, setCurrentCase] = useState(0);
    const [score, setScore] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [starting, setStarting] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [cases, setCases] = useState<typeof DOSE_SCENARIOS>([]);

    const startGame = async () => {
        setStarting(true);
        try {
            await onStart();
        } catch(e) {
            setStarting(false);
            return;
        }

        const shuffled = [...DOSE_SCENARIOS].sort(() => 0.5 - Math.random()).slice(0, 3);
        setCases(shuffled);
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
        
        const isCorrect = answerIndex === cases[currentCase].correct;
        if (isCorrect) {
            setScore(prev => prev + 1);
            toast.success('إجابة صحيحة! 🎯', { duration: 1500 });
        } else {
            toast.error('خطأ! راجع الحساب 💔', { duration: 1500 });
        }

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
                    onComplete(30, true);
                } else if (finalScore >= 2) {
                    toast.success(`جيد! ${finalScore}/${cases.length} صحيحة 👍`);
                    onComplete(15, true);
                } else {
                    toast.error('تحتاج لمزيد من التدريب 💪');
                    onComplete(0, false);
                }
            }
        }, 3000); // وقت أطول لقراءة التفسير
    };

    if (!isActive) {
        return (
            <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-br from-rose-500 to-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <Calculator className="w-14 h-14 text-white animate-pulse"/>
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-3">تحدي حساب الجرعات! 💊</h3>
                <p className="text-base font-bold text-gray-600 mb-6 max-w-lg mx-auto">
                    اختبر مهاراتك في حساب الجرعات الدوائية. دقة حسابية عالية مطلوبة!
                </p>
                <div className="bg-gradient-to-br from-rose-50 to-red-50 p-6 rounded-3xl max-w-md mx-auto mb-8 border-2 border-rose-200">
                    <div className="space-y-3 text-sm font-bold">
                        <div className="bg-white p-3 rounded-xl shadow-sm flex items-center justify-between">
                            <span className="text-rose-600">📝 عدد الحالات</span>
                            <span className="text-2xl text-gray-800">3 حالات</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl shadow-sm flex items-center justify-between">
                            <span className="text-rose-600">🎯 للفوز الكامل</span>
                            <span className="text-lg text-gray-800">3/3 صحيحة</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl shadow-sm flex items-center justify-between">
                            <span className="text-rose-600">💎 الجائزة</span>
                            <span className="text-lg text-gray-800">30 نقطة</span>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={startGame} 
                    disabled={starting} 
                    className="bg-gradient-to-r from-rose-600 to-red-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:scale-105 transition-all disabled:opacity-50 text-lg"
                >
                    {starting ? '⏳ جاري البدء...' : '🧮 ابدأ التحدي'}
                </button>
            </div>
        );
    }

    const currentScenario = cases[currentCase];

    return (
        <div className="max-w-3xl mx-auto py-8 animate-in zoom-in-95">
            {/* Header */}
            <div className="flex justify-between items-center mb-8 px-4">
                <div className="bg-white px-6 py-3 rounded-2xl font-black shadow-lg border-2 border-rose-200">
                    <span className="text-rose-600">الحالة {currentCase + 1}</span>
                    <span className="text-gray-400"> / {cases.length}</span>
                </div>
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5"/> {score} صحيحة
                </div>
            </div>

            {/* Progress */}
            <div className="w-full bg-gray-200 h-3 rounded-full mb-8 overflow-hidden shadow-inner">
                <div 
                    className="h-full bg-gradient-to-r from-rose-500 to-red-600 transition-all duration-300 rounded-full"
                    style={{ width: `${((currentCase + 1) / cases.length) * 100}%` }}
                ></div>
            </div>

            {/* Scenario */}
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

            {/* Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {currentScenario.options.map((option, idx) => {
                    let buttonClass = "bg-white border-3 border-gray-200 hover:border-rose-400 hover:bg-rose-50";
                    
                    if (showFeedback) {
                        if (idx === currentScenario.correct) {
                            buttonClass = "bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-600 text-white";
                        } else if (idx === selectedAnswer) {
                            buttonClass = "bg-gradient-to-br from-red-400 to-red-600 border-red-600 text-white";
                        } else {
                            buttonClass = "bg-gray-100 border-gray-200 text-gray-400";
                        }
                    }

                    return (
                        <button
                            key={idx}
                            onClick={() => handleAnswer(idx)}
                            disabled={showFeedback}
                            className={`${buttonClass} p-6 rounded-2xl font-bold text-xl transition-all hover:scale-105 active:scale-95 shadow-md hover:shadow-xl disabled:cursor-not-allowed text-center`}
                        >
                            <div className="flex items-center justify-center gap-3">
                                <span>{option}</span>
                                {showFeedback && idx === currentScenario.correct && <CheckCircle className="w-7 h-7"/>}
                                {showFeedback && idx === selectedAnswer && idx !== currentScenario.correct && <XCircle className="w-7 h-7"/>}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Explanation */}
            {showFeedback && (
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-3xl border-2 border-blue-200 shadow-xl animate-in slide-in-from-bottom">
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
