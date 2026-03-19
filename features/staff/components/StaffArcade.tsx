import React, { useState, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import {
    Loader2, Zap, Gamepad2, Tv2,
    ArrowRight, Trophy,
    Dices, Lock, Brain, Calculator, Flame,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { getDiffProfile, COOLDOWN_HOURS, DiffProfile } from './arcade/types';
import ArcadeHeader, { LevelBadge } from './arcade/ArcadeHeader';
import ArcadeCooldown from './arcade/ArcadeCooldown';
import ArcadeLeaderboard from './arcade/ArcadeLeaderboard';
import BonusQuestion from './arcade/BonusQuestion';

import SpinAndAnswerGame        from '../../../components/gamification/games/SpinAndAnswerGame';
import SafeCrackerGame          from '../../../components/gamification/games/SafeCrackerGame';
import MemoryMatchGame          from '../../../components/gamification/games/MemoryMatchGame';
import MedicalQuizRush          from '../../../components/gamification/games/MedicalQuizRush';
import DoseCalculatorChallenge  from '../../../components/gamification/games/DoseCalculatorChallenge';
import MoveTheMatch             from '../../../components/gamification/games/MoveTheMatch';
import LiveGamesArena           from '../../../components/gamification/LiveGamesArena';

interface Props { employee: Employee; deepLinkRoomId?: string | null; }

// ─── 7 Solo Games ─────────────────────────────────────────────────────────────
const GAME_CATALOG = [
    { key: 'spin',     title: 'عجلة الحظ',      icon: Dices,      gradient: 'from-fuchsia-500 to-pink-600',  bg: 'from-fuchsia-50 to-pink-50',  border: 'border-fuchsia-100 hover:border-fuchsia-300', tag: 'حظ + ذكاء',   pts: '5-30',  tagColor: 'text-fuchsia-700', ptsColor: 'text-fuchsia-600' },
    { key: 'safe',     title: 'الخزنة السرية',   icon: Lock,       gradient: 'from-emerald-500 to-teal-600',  bg: 'from-emerald-50 to-teal-50',  border: 'border-emerald-100 hover:border-emerald-300', tag: 'ذكاء ومنطق', pts: '20',    tagColor: 'text-emerald-700', ptsColor: 'text-emerald-600' },
    { key: 'memory',   title: 'تطابق الذاكرة',   icon: Gamepad2,   gradient: 'from-orange-500 to-amber-600',  bg: 'from-orange-50 to-amber-50',  border: 'border-orange-100 hover:border-orange-300',   tag: 'قوة ذاكرة',  pts: '20',    tagColor: 'text-orange-700',  ptsColor: 'text-orange-600'  },
    { key: 'quiz',     title: 'سباق المعرفة',    icon: Brain,      gradient: 'from-indigo-500 to-purple-600', bg: 'from-indigo-50 to-purple-50', border: 'border-indigo-100 hover:border-indigo-300',   tag: 'معرفة+سرعة', pts: '5-25',  tagColor: 'text-indigo-700',  ptsColor: 'text-indigo-600'  },
    { key: 'dose',     title: 'حساب الجرعات',    icon: Calculator, gradient: 'from-rose-500 to-red-600',      bg: 'from-rose-50 to-red-50',      border: 'border-rose-100 hover:border-rose-300',       tag: 'دقة حسابية', pts: '10-30', tagColor: 'text-rose-700',    ptsColor: 'text-rose-600'    },
    { key: 'match',    title: 'عود الثقاب',      icon: Flame,      gradient: 'from-amber-500 to-orange-600',  bg: 'from-amber-50 to-orange-50',  border: 'border-amber-100 hover:border-amber-300',     tag: 'تفاعلي 🔥',  pts: '15-48', tagColor: 'text-amber-700',   ptsColor: 'text-amber-600'   },
];

// ─── Game Grid ────────────────────────────────────────────────────────────────
function GameGrid({ diffProfile, onSelect }: { diffProfile: DiffProfile; onSelect: (key: string) => void }) {
    return (
        <div className="space-y-3">
            {/* Level banner */}
            <div className={`p-3 rounded-xl border-2 flex items-center gap-2 ${diffProfile.color}`}>
                <span className="text-2xl">{diffProfile.emoji}</span>
                <div className="flex-1 min-w-0">
                    <p className="font-black text-xs">مستواك: {diffProfile.label}</p>
                    <p className="text-[11px] font-bold opacity-80 truncate">{diffProfile.desc}</p>
                </div>
                <div className="text-left shrink-0">
                    <p className="font-black text-base">×{diffProfile.multiplier.toFixed(1)}</p>
                    <p className="text-[10px] font-bold opacity-70">مضاعف</p>
                </div>
            </div>

            {/* 7-game grid */}
            <div className="grid grid-cols-2 gap-2">
                {GAME_CATALOG.map(g => {
                    const Icon = g.icon;
                    return (
                        <button key={g.key} onClick={() => onSelect(g.key)}
                            className={`group bg-gradient-to-br ${g.bg} border-2 ${g.border} p-3 rounded-2xl shadow-sm hover:shadow-lg transition-all text-right flex flex-col relative overflow-hidden hover:scale-105 active:scale-95`}>
                            <div className="relative z-10 flex flex-col h-full">
                                <div className={`w-9 h-9 bg-gradient-to-br ${g.gradient} text-white rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 group-hover:rotate-6 transition-transform shadow-md`}>
                                    <Icon className="w-5 h-5"/>
                                </div>
                                <h3 className="font-black text-gray-900 text-xs mb-0.5 leading-tight">{g.title}</h3>
                                <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/50">
                                    <span className={`text-[10px] bg-white ${g.tagColor} px-1.5 py-0.5 rounded-md font-black shadow-sm`}>{g.tag}</span>
                                    <span className={`text-[10px] ${g.ptsColor} font-black flex items-center gap-0.5`}><Trophy className="w-2.5 h-2.5"/> {g.pts}</span>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Win effects ──────────────────────────────────────────────────────────────
function playWinSound() {
    try {
        const audio = new Audio('https://raw.githubusercontent.com/ledooooo/attendanceAI/main/public/applause.mp3');
        audio.volume = 0.8;
        audio.play().catch(() => {});
    } catch (_) {}
}

function fireConfetti() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;';
    document.body.appendChild(canvas);
    const myConfetti = confetti.create(canvas, { resize: true, useWorker: false });
    const colors = ['#f59e0b','#10b981','#6366f1','#ec4899','#f97316','#fbbf24','#ffffff'];
    myConfetti({ particleCount: 120, angle: 60,  spread: 70,  origin: { x: 0,   y: 0.7 }, colors, zIndex: 99999 });
    myConfetti({ particleCount: 120, angle: 120, spread: 70,  origin: { x: 1,   y: 0.7 }, colors, zIndex: 99999 });
    setTimeout(() => {
        myConfetti({ particleCount: 200, angle: 90, spread: 160, origin: { x: 0.5, y: 0.2 }, colors, zIndex: 99999 });
    }, 400);
    setTimeout(() => canvas.remove(), 5000);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function StaffArcade({ employee, deepLinkRoomId }: Props) {
    const queryClient = useQueryClient();
    const [activeGame, setActiveGame]   = useState<string | null>(null);
    const [sessionId, setSessionId]     = useState<string | null>(null);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [activeTab, setActiveTab]     = useState<'games' | 'live'>(deepLinkRoomId ? 'live' : 'games');
    const [bonusState, setBonusState]   = useState<{ show: boolean; pts: number; gameName: string } | null>(null);

    const diffProfile = useMemo(() => getDiffProfile(employee.total_points || 0), [employee.total_points]);

    const { data: lastPlay, isLoading: loadingPlay } = useQuery({
        queryKey: ['last_arcade_play', employee.employee_id],
        queryFn: async () => {
            const { data } = await supabase.from('arcade_scores').select('played_at')
                .eq('employee_id', employee.employee_id).order('played_at', { ascending: false }).limit(1).maybeSingle();
            return data;
        }
    });

    const timeRemaining = useMemo(() => {
        if (!lastPlay?.played_at) return null;
        const diff = (Date.now() - new Date(lastPlay.played_at).getTime()) / (1000 * 60 * 60);
        if (diff >= COOLDOWN_HOURS) return null;
        const rem = COOLDOWN_HOURS * 3600000 - (Date.now() - new Date(lastPlay.played_at).getTime());
        return { hrs: Math.floor(rem / 3600000), mins: Math.floor((rem % 3600000) / 60000) };
    }, [lastPlay]);

    const consumeAttempt = async (gameName: string) => {
        const { data, error } = await supabase.from('arcade_scores').insert({
            employee_id: employee.employee_id, game_name: gameName, points_earned: 0, is_win: false
        }).select('id').single();
        if (error) throw error;
        setSessionId(data.id);
        queryClient.invalidateQueries({ queryKey: ['last_arcade_play'] });
    };

    const finishAttemptMutation = useMutation({
        mutationFn: async ({ points, isWin, gameName }: { points: number; isWin: boolean; gameName: string }) => {
            if (!sessionId) return;
            await supabase.from('arcade_scores').update({ points_earned: points, is_win: isWin }).eq('id', sessionId);
            if (isWin && points > 0) {
                await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: points });
                await supabase.from('points_ledger').insert({ employee_id: employee.employee_id, points, reason: `فوز في لعبة: ${gameName} 🎮` });
            }
            return { isWin, points, gameName };
        },
        onSuccess: (result) => {
            if (!result) return;
            const { isWin, points, gameName } = result;
            if (isWin && points > 0) {
                playWinSound();
                fireConfetti();
                toast.success(`بطل! كسبت ${points} نقطة 🎉`, { duration: 4000, icon: '🏆', style: { background: '#10b981', color: 'white', fontWeight: 'bold' } });
                const bonusPts = Math.max(5, Math.round(points * 0.5));
                setBonusState({ show: true, pts: bonusPts, gameName });
            } else {
                toast.error('حظ أوفر! تعال جرب تاني بعد 5 ساعات 💔', { duration: 4000 });
                setActiveGame(null);
                setSessionId(null);
            }
            queryClient.invalidateQueries({ queryKey: ['arcade_leaderboard'] });
            queryClient.invalidateQueries({ queryKey: ['admin_employees'] });
        }
    });

    const handleBonusFinish = async (earned: number) => {
        if (earned > 0) {
            playWinSound();
            fireConfetti();
            await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: earned });
            await supabase.from('points_ledger').insert({ employee_id: employee.employee_id, points: earned, reason: `سؤال مكافأة 🎁` });
            queryClient.invalidateQueries({ queryKey: ['admin_employees'] });
        }
        setBonusState(null);
        setActiveGame(null);
        setSessionId(null);
    };

    const gameNode = (key: string): React.ReactNode => {
        const gameName = GAME_CATALOG.find(g => g.key === key)?.title || key;
        const props = {
            employee, diffProfile,
            onStart:    () => consumeAttempt(gameName),
            onComplete: (p: number, w: boolean) => finishAttemptMutation.mutate({ points: p, isWin: w, gameName }),
        };
        const simple = { onStart: props.onStart, onComplete: props.onComplete };
        switch (key) {
            case 'spin':     return <SpinAndAnswerGame {...props}/>;
            case 'safe':     return <SafeCrackerGame {...simple}/>;
            case 'memory':   return <MemoryMatchGame {...simple}/>;
            case 'quiz':     return <MedicalQuizRush {...props}/>;
            case 'dose':     return <DoseCalculatorChallenge {...props}/>;
            case 'match':    return <MoveTheMatch {...simple}/>;
            default:         return null;
        }
    };

    return (
        <div className="space-y-3 animate-in fade-in pb-6">

            <ArcadeHeader employee={employee} onShowLeaderboard={() => setShowLeaderboard(true)}/>

            {/* Tabs */}
            <div className="flex bg-white rounded-xl p-1 shadow-sm border border-gray-100 gap-1">
                <button onClick={() => setActiveTab('games')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-black text-xs transition-all ${activeTab === 'games' ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <Gamepad2 className="w-3.5 h-3.5"/> الألعاب الفردية
                </button>
                <button onClick={() => setActiveTab('live')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-black text-xs transition-all ${activeTab === 'live' ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <Tv2 className="w-3.5 h-3.5"/> ألعاب جماعية
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"/>
                </button>
            </div>

            {/* ── LIVE TAB ── */}
            {activeTab === 'live' && (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden animate-in fade-in">
                    <div className="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-4 py-3 flex items-center gap-2">
                        <Tv2 className="w-5 h-5 text-white"/>
                        <div>
                            <h2 className="text-white font-black text-sm">ساحة الألعاب الجماعية</h2>
                            <p className="text-sky-100 text-[11px] font-bold">تحدى زملائك أونلاين!</p>
                        </div>
                        <span className="mr-auto flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-black text-white">
                            <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"/> LIVE
                        </span>
                    </div>
                    <div className="p-3">
                        <LiveGamesArena employee={employee} initialRoomId={deepLinkRoomId}/>
                    </div>
                </div>
            )}

            {/* ── GAMES TAB ── */}
            {activeTab === 'games' && (
                <>
                    {loadingPlay ? (
                        <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
                            <Loader2 className="w-10 h-10 animate-spin mx-auto text-fuchsia-600 mb-3"/>
                            <p className="text-gray-500 font-bold text-sm">جاري التحميل...</p>
                        </div>

                    ) : bonusState?.show ? (
                        <div className="bg-white rounded-2xl shadow-xl border-2 border-amber-200 p-4">
                            <BonusQuestion employee={employee} bonusPoints={bonusState.pts} onFinish={handleBonusFinish}/>
                        </div>

                    ) : activeGame !== null ? (
                        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                                <button onClick={() => { setActiveGame(null); setSessionId(null); }}
                                    className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 font-bold text-sm transition-colors">
                                    <ArrowRight className="w-4 h-4"/> رجوع للقائمة
                                </button>
                                <div className="flex items-center gap-2">
                                    <LevelBadge employee={employee}/>
                                    <div className="flex items-center gap-1 bg-violet-50 px-2.5 py-1.5 rounded-lg">
                                        <Zap className="w-3.5 h-3.5 text-violet-600"/>
                                        <span className="text-[11px] font-bold text-violet-700">جاري اللعب</span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-3 md:p-6">
                                {finishAttemptMutation.isPending ? (
                                    <div className="text-center py-20">
                                        <Loader2 className="w-14 h-14 animate-spin mx-auto text-violet-600 mb-4"/>
                                        <p className="text-lg font-black text-gray-700">جاري تسجيل نتيجتك...</p>
                                    </div>
                                ) : gameNode(activeGame)}
                            </div>
                        </div>

                    ) : timeRemaining ? (
                        <ArcadeCooldown hrs={timeRemaining.hrs} mins={timeRemaining.mins}/>

                    ) : (
                        <GameGrid diffProfile={diffProfile} onSelect={setActiveGame}/>
                    )}
                </>
            )}

            {showLeaderboard && <ArcadeLeaderboard onClose={() => setShowLeaderboard(false)}/>}
        </div>
    );
}
