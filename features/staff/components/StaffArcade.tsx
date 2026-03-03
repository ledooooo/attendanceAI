import React, { useState, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Target, Zap, Gamepad2, Tv2 } from 'lucide-react';
import toast from 'react-hot-toast';

// Arcade Modules
import { getDiffProfile, COOLDOWN_HOURS } from './arcade/types';
import ArcadeHeader, { LevelBadge } from './arcade/ArcadeHeader';
import ArcadeCooldown from './arcade/ArcadeCooldown';
import ArcadeGameGrid from './arcade/ArcadeGameGrid';
import ArcadeLeaderboard from './arcade/ArcadeLeaderboard';

// Game Components
import SpinAndAnswerGame from '../../../components/gamification/games/SpinAndAnswerGame';
import WordScrambleGame from '../../../components/gamification/games/WordScrambleGame';
import SafeCrackerGame from '../../../components/gamification/games/SafeCrackerGame';
import MemoryMatchGame from '../../../components/gamification/games/MemoryMatchGame';
import MedicalQuizRush from '../../../components/gamification/games/MedicalQuizRush';
import DoseCalculatorChallenge from '../../../components/gamification/games/DoseCalculatorChallenge';

// Live Arena
import LiveGamesArena from '../../../components/gamification/LiveGamesArena';

interface Props {
    employee: Employee;
}

export default function StaffArcade({ employee }: Props) {
    const queryClient = useQueryClient();
    const [activeGame, setActiveGame] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [activeTab, setActiveTab] = useState<'games' | 'live'>('games');

    const diffProfile = useMemo(() => getDiffProfile(employee.total_points || 0), [employee.total_points]);

    // جلب آخر محاولة
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

    // حساب الوقت المتبقي
    const timeRemaining = useMemo(() => {
        if (!lastPlay?.played_at) return null;
        const diff = (Date.now() - new Date(lastPlay.played_at).getTime()) / (1000 * 60 * 60);
        if (diff >= COOLDOWN_HOURS) return null;
        const rem = COOLDOWN_HOURS * 3600000 - (Date.now() - new Date(lastPlay.played_at).getTime());
        return {
            hrs:  Math.floor(rem / 3600000),
            mins: Math.floor((rem % 3600000) / 60000)
        };
    }, [lastPlay]);

    // خصم المحاولة
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
        mutationFn: async ({ points, isWin, gameName }: { points: number; isWin: boolean; gameName: string }) => {
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
        onSuccess: (_, { points, isWin }) => {
            if (isWin) {
                toast.success(`بطل! كسبت ${points} نقطة 🎉`, {
                    duration: 5000, icon: '🏆',
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

    // خريطة الألعاب → اسم + مكوّن
    const GAME_MAP: Record<string, { name: string; node: React.ReactNode }> = {
        spin: {
            name: 'عجلة الحظ',
            node: <SpinAndAnswerGame employee={employee} diffProfile={diffProfile}
                        onStart={() => consumeAttempt('عجلة الحظ')}
                        onComplete={(p, w) => finishAttemptMutation.mutate({ points: p, isWin: w, gameName: 'عجلة الحظ' })} />
        },
        scramble: {
            name: 'فك الشفرة',
            node: <WordScrambleGame employee={employee} diffProfile={diffProfile}
                        onStart={() => consumeAttempt('فك الشفرة')}
                        onComplete={(p, w) => finishAttemptMutation.mutate({ points: p, isWin: w, gameName: 'فك الشفرة' })} />
        },
        safe: {
            name: 'الخزنة السرية',
            node: <SafeCrackerGame
                        onStart={() => consumeAttempt('الخزنة السرية')}
                        onComplete={(p, w) => finishAttemptMutation.mutate({ points: p, isWin: w, gameName: 'الخزنة السرية' })} />
        },
        memory: {
            name: 'تطابق الذاكرة',
            node: <MemoryMatchGame
                        onStart={() => consumeAttempt('تطابق الذاكرة')}
                        onComplete={(p, w) => finishAttemptMutation.mutate({ points: p, isWin: w, gameName: 'تطابق الذاكرة' })} />
        },
        quiz: {
            name: 'سباق المعرفة الطبية',
            node: <MedicalQuizRush employee={employee} diffProfile={diffProfile}
                        onStart={() => consumeAttempt('سباق المعرفة الطبية')}
                        onComplete={(p, w) => finishAttemptMutation.mutate({ points: p, isWin: w, gameName: 'سباق المعرفة الطبية' })} />
        },
        dose: {
            name: 'تحدي حساب الجرعات',
            node: <DoseCalculatorChallenge employee={employee} diffProfile={diffProfile}
                        onStart={() => consumeAttempt('تحدي حساب الجرعات')}
                        onComplete={(p, w) => finishAttemptMutation.mutate({ points: p, isWin: w, gameName: 'تحدي حساب الجرعات' })} />
        },
    };

    return (
        <div className="space-y-4 animate-in fade-in pb-10">

            {/* Header */}
            <ArcadeHeader employee={employee} onShowLeaderboard={() => setShowLeaderboard(true)} />

            {/* Tabs */}
            <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 gap-1">
                <button
                    onClick={() => setActiveTab('games')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all ${activeTab === 'games' ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <Gamepad2 className="w-4 h-4"/> الألعاب الفردية
                </button>
                <button
                    onClick={() => setActiveTab('live')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all ${activeTab === 'live' ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <Tv2 className="w-4 h-4"/>
                    <span>الألعاب المباشرة</span>
                    <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
                </button>
            </div>

            {/* Live Tab */}
            {activeTab === 'live' && (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in">
                    <div className="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-6 py-4 flex items-center gap-3">
                        <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                            <Tv2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-white font-black text-lg">ساحة الألعاب المباشرة</h2>
                            <p className="text-sky-100 text-xs font-bold">تحدى زملائك أونلاين الآن!</p>
                        </div>
                        <span className="mr-auto flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-xs font-black text-white">
                            <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span> LIVE
                        </span>
                    </div>
                    <div className="p-4 md:p-6">
                        <LiveGamesArena employee={employee} />
                    </div>
                </div>
            )}

            {/* Games Tab */}
            {activeTab === 'games' && loadingPlay ? (
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
                        GAME_MAP[activeGame]?.node ?? null
                    )}
                </div>

            ) : timeRemaining ? (
                /* شاشة الانتظار */
                <ArcadeCooldown hrs={timeRemaining.hrs} mins={timeRemaining.mins} />

            ) : (
                /* قائمة الألعاب */
                <ArcadeGameGrid diffProfile={diffProfile} onSelectGame={setActiveGame} />
            )}



            {/* Leaderboard Modal */}
            {showLeaderboard && (
                <ArcadeLeaderboard onClose={() => setShowLeaderboard(false)} />
            )}
        </div>
    );
}
