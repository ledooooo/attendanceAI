import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Employee } from '../../types';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import {
    Swords, UserX, Trophy, Users, Clock,
    Play, X, CheckCircle2, BrainCircuit, Loader2, Trash2, Timer, Hand, Grid3x3, Bus,
    Link2, Share2
} from 'lucide-react';
import Connect4Game from './games/Connect4Game';
import XOGame from './games/XOGame';
import StopTheBusGame from './games/StopTheBusGame';

// ─── Aliases ──────────────────────────────────────────────────────────────────
const ALIASES = [
    { name: 'طبيب غامض', emoji: '🕵️‍♂️' }, { name: 'ممرض نينجا', emoji: '🥷' },
    { name: 'شبح المعمل', emoji: '🧛‍♂️' }, { name: 'ساحر الأدوية', emoji: '🧙‍♂️' },
    { name: 'بطلة الطوارئ', emoji: '🦸‍♀️' }, { name: 'صقر الجودة', emoji: '🦅' },
    { name: 'دينامو الاستقبال', emoji: '⚡' }, { name: 'قناص الملفات', emoji: '🎯' },
];

const GAME_TYPES = [
    { key: 'xo',         label: 'XO',               icon: '✕⭕',  desc: 'إكس أو الكلاسيكية',  color: 'from-indigo-500 to-violet-600', minPlayers: 2, maxPlayers: 2  },
    { key: 'connect4',   label: 'Connect 4',         icon: '🔴🟡', desc: 'أربعة في صف',        color: 'from-blue-500 to-cyan-600',    minPlayers: 2, maxPlayers: 2  },
    { key: 'stopthebus', label: 'أتوبيس كومبليت',   icon: '🚌',   desc: 'كلمات بنفس الحرف',   color: 'from-violet-500 to-purple-700', minPlayers: 2, maxPlayers: 10 },
];

// ─── Room sharing ─────────────────────────────────────────────────────────────
// ✏️  Change this to your real app URL
const BASE_URL = 'https://gharb-alpha.vercel.app';

function getRoomLink(matchId: string) {
    return `${BASE_URL}${window.location.pathname}#room=${matchId}`;
}

function copyRoomLink(matchId: string) {
    const link = getRoomLink(matchId);
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(link).then(() => {});
    } else {
        // Fallback for older browsers
        const el = document.createElement('textarea');
        el.value = link;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AvatarDisplay = ({ avatar, className = '' }: { avatar: string; className?: string }) => {
    if (avatar?.startsWith('http'))
        return <img src={avatar} alt="avatar" className={`w-full h-full object-cover ${className}`}/>;
    return <span className={className}>{avatar || '👤'}</span>;
};

const getSpecialtyVariations = (spec: string) => {
    if (!spec) return ['الكل'];
    const s = spec.toLowerCase();
    if (s.includes('بشر') || s.includes('عام')) return ['بشري', 'طبيب بشرى', 'طبيب عام'];
    if (s.includes('سنان') || s.includes('أسنان')) return ['أسنان', 'اسنان', 'طبيب أسنان', 'فنى اسنان'];
    if (s.includes('تمريض') || s.includes('ممرض')) return ['تمريض', 'ممرض', 'ممرضة', 'اخصائى تمريض'];
    if (s.includes('صيدل')) return ['صيدلة', 'صيدلي', 'صيدلاني'];
    if (s.includes('معمل') || s.includes('مختبر')) return ['معمل', 'فني معمل', 'مختبر'];
    if (s.includes('جود')) return ['جودة', 'الجودة'];
    return [spec, 'الكل'];
};

// ─── Question helpers ─────────────────────────────────────────────────────────
const normalizeQuestion = (rawQ: any) => {
    let questionText = rawQ.question || rawQ.question_text || '';
    if (rawQ.scenario) questionText = `${rawQ.scenario} - ${questionText}`;
    let opts: string[] = [];
    let correctAns = '';
    if (rawQ.source === 'standard_quiz') {
        try {
            let parsed = rawQ.options;
            if (typeof parsed === 'string') { if (parsed.startsWith('"')) parsed = JSON.parse(parsed); if (typeof parsed === 'string') parsed = JSON.parse(parsed); }
            opts = Array.isArray(parsed) ? parsed : [];
        } catch { opts = []; }
        correctAns = rawQ.correct_answer;
    } else {
        opts = [rawQ.option_a, rawQ.option_b, rawQ.option_c, rawQ.option_d].filter(o => o && String(o).trim() !== '' && o !== 'null');
        if (rawQ.correct_index !== undefined && rawQ.correct_index !== null) correctAns = opts[rawQ.correct_index];
        else {
            const letter = String(rawQ.correct_option || rawQ.correct_answer || '').trim().toLowerCase();
            correctAns = ['a','b','c','d'].includes(letter) ? rawQ[`option_${letter}`] : letter;
        }
    }
    if (!correctAns || opts.length < 2) return null;
    return { id: rawQ.id, questionText, options: opts, correctAnswer: String(correctAns).trim().toLowerCase() };
};

const fetchUnifiedQuestion = async (employee: Employee, difficulty?: string) => {
    const variations = getSpecialtyVariations(employee.specialty);
    const orFilter = variations.map(v => `specialty.ilike.%${v}%`).join(',');
    let pool: any[] = [];
    const [r1, r2, r3] = await Promise.all([
        supabase.from('arcade_quiz_questions').select('*').or(orFilter),
        supabase.from('arcade_dose_scenarios').select('*').or(orFilter),
        supabase.from('quiz_questions').select('*').or(orFilter),
    ]);
    if (r1.data) pool.push(...r1.data.map(q => ({ ...q, source: 'arcade_quiz' })));
    if (r2.data) pool.push(...r2.data.map(q => ({ ...q, source: 'arcade_dose' })));
    if (r3.data) pool.push(...r3.data.map(q => ({ ...q, source: 'standard_quiz' })));
    if (pool.length === 0) {
        const { data } = await supabase.from('arcade_quiz_questions').select('*').limit(30);
        if (data) pool = data.map(q => ({ ...q, source: 'arcade_quiz' }));
    }
    if (difficulty) {
        const dp = pool.filter(q => q.difficulty === difficulty || (q.source === 'standard_quiz' && difficulty === 'medium'));
        if (dp.length > 0) pool = dp;
    }
    if (pool.length === 0) return null;
    for (let i = 0; i < 5; i++) {
        const n = normalizeQuestion(pool[Math.floor(Math.random() * pool.length)]);
        if (n) return n;
    }
    return null;
};

// ─── Main Component ───────────────────────────────────────────────────────────
interface LiveGamesArenaProps {
    employee: Employee;
    onClose?: () => void;
    initialRoomId?: string | null;
}

export default function LiveGamesArena({ employee, onClose, initialRoomId }: { employee: Employee; onClose?: () => void }) {
    const queryClient = useQueryClient();

    const [matches, setMatches] = useState<any[]>([]);
    const [currentMatch, setCurrentMatch] = useState<any>(null);
    const [view, setView] = useState<'lobby' | 'game_select' | 'identity_setup' | 'playing'>('lobby');

    const [selectedGameType, setSelectedGameType] = useState<string>('xo');
    const [useAlias, setUseAlias] = useState(false);
    const [selectedAlias, setSelectedAlias] = useState(ALIASES[0]);
    const [joiningMatchId, setJoiningMatchId] = useState<string | null>(null);
    const [joiningGameType, setJoiningGameType] = useState<string>('xo');
    const [loading, setLoading] = useState(false);

    // Timers
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [autoDeleteTimeLeft, setAutoDeleteTimeLeft] = useState<number | null>(null);
    const autoDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Auto delete ──
    useEffect(() => {
        if (currentMatch?.status === 'waiting' && currentMatch.created_by === employee.employee_id) {
            const elapsed = Date.now() - new Date(currentMatch.created_at).getTime();
            const remaining = Math.max(0, 3 * 60 * 1000 - elapsed);
            setAutoDeleteTimeLeft(Math.floor(remaining / 1000));
            if (autoDeleteTimerRef.current) clearTimeout(autoDeleteTimerRef.current);
            autoDeleteTimerRef.current = setTimeout(() => handleDeleteMatch(currentMatch.id, true), remaining);
        } else {
            if (autoDeleteTimerRef.current) { clearTimeout(autoDeleteTimerRef.current); autoDeleteTimerRef.current = null; }
            setAutoDeleteTimeLeft(null);
        }
        return () => { if (autoDeleteTimerRef.current) clearTimeout(autoDeleteTimerRef.current); };
    }, [currentMatch?.id, currentMatch?.status]);

    useEffect(() => {
        if (!autoDeleteTimeLeft || autoDeleteTimeLeft <= 0) return;
        const iv = setInterval(() => setAutoDeleteTimeLeft(p => (p && p > 0 ? p - 1 : 0)), 1000);
        return () => clearInterval(iv);
    }, [autoDeleteTimeLeft]);

    // ── Question timer ──
    useEffect(() => {
        if (timeLeft === null || timeLeft <= 0) return;
        const iv = setInterval(() => setTimeLeft(p => {
            if (p && p <= 1) { clearInterval(iv); handleTimeOut(); return 0; }
            return p ? p - 1 : 0;
        }), 1000);
        return () => clearInterval(iv);
    }, [timeLeft]);

    const handleTimeOut = () => {
        if (currentMatch?.status === 'answering_reward') handleRewardAnswer('TIMEOUT_WRONG_ANSWER');
    };

    // ── Realtime ──
    useEffect(() => {
        fetchWaitingMatches();
        const channel = supabase.channel('live_arena_v2')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'live_matches' }, payload => {
                if (payload.eventType === 'DELETE') {
                    setMatches(prev => prev.filter(m => m.id !== payload.old.id));
                    if (currentMatch?.id === payload.old.id) { setCurrentMatch(null); setView('lobby'); toast('تم إغلاق الغرفة', { icon: '🚪' }); }
                    return;
                }
                const updated = payload.new;
                if (updated.status === 'waiting') fetchWaitingMatches();
                else setMatches(prev => prev.filter(m => m.id !== updated.id));
                setCurrentMatch((prev: any) => {
                    if (!prev || prev.id !== updated.id) return prev;
                    if (prev.status === 'waiting' && updated.status === 'playing' && updated.created_by === employee.employee_id) {
                        toast.success('انضم منافس! اللعبة بدأت 🎮', { icon: '🔥', duration: 4000 });
                        new Audio('/notification.mp3').play().catch(() => {});
                    }
                    if (updated.status === 'answering_reward' && prev.status !== 'answering_reward' && updated.winner_id === employee.employee_id) {
                        setTimeLeft(updated.final_question?.timeLimit || 15);
                    }
                    return updated;
                });
            }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [employee.employee_id, currentMatch?.id]);

    const fetchWaitingMatches = async () => {
        const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        await supabase.from('live_matches').delete().eq('status', 'waiting').lt('created_at', cutoff);
        const { data } = await supabase.from('live_matches').select('*').eq('status', 'waiting').order('created_at', { ascending: false });
        if (data) setMatches(data);
    };

    const checkCooldown = async () => {
        const { data } = await supabase.from('points_ledger').select('id').eq('employee_id', employee.employee_id)
            .like('reason', '%التحدي المباشر%').gte('created_at', new Date(Date.now() - 3600000).toISOString()).limit(1);
        return data && data.length > 0;
    };

    const grantPoints = async (pts: number) => {
        if (pts <= 0) return;
        const onCooldown = await checkCooldown();
        if (onCooldown) { toast.success('فوز رائع! (النقاط تضاف مرة كل ساعة)', { icon: '🎮' }); return; }
        await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: pts });
        await supabase.from('points_ledger').insert({ employee_id: employee.employee_id, points: pts, reason: `فوز في التحدي المباشر 🏆` });
        toast.success(`مبروك! تمت إضافة ${pts} نقطة! 🎉`, { style: { background: '#22c55e', color: '#fff' } });
        confetti({ particleCount: 200, spread: 100, zIndex: 9999 });
    };

    // ── Player info ──
    const getMyPlayerInfo = () => ({
        id: employee.employee_id,
        name: useAlias ? selectedAlias.name : employee.name.split(' ')[0],
        avatar: useAlias ? selectedAlias.emoji : (employee.photo_url || '👤'),
        isAlias: useAlias,
    });

    // ── Create match ──
    const handleCreateMatch = async () => {
        setLoading(true);
        const player = { ...getMyPlayerInfo(), symbol: selectedGameType === 'xo' ? 'X' : selectedGameType === 'connect4' ? 'R' : undefined };

        let initialState: any = {};
        if (selectedGameType === 'xo')       initialState = { board: Array(9).fill(null), current_turn: player.id };
        else if (selectedGameType === 'connect4') initialState = { board: Array.from({ length: 6 }, () => Array(7).fill(null)), current_turn: player.id };
        else if (selectedGameType === 'stopthebus') initialState = { letter: '', startedAt: 0, allAnswers: [] };

        const { data, error } = await supabase.from('live_matches').insert({
            game_type: selectedGameType, status: 'waiting', players: [player],
            game_state: initialState, created_by: employee.employee_id,
        }).select().single();
        setLoading(false);
        if (error) return toast.error('خطأ في الإنشاء');
        setCurrentMatch(data); setView('playing');
    };

    // ── Join match ──
    const handleJoinMatch = async () => {
        if (!joiningMatchId) return;
        setLoading(true);
        const { data: match } = await supabase.from('live_matches').select('*').eq('id', joiningMatchId).single();
        if (!match || match.status !== 'waiting') { setLoading(false); return toast.error('الغرفة غير متاحة'); }

        const player = {
            ...getMyPlayerInfo(),
            symbol: match.game_type === 'xo' ? 'O' : match.game_type === 'connect4' ? 'Y' : undefined,
        };

        // stopthebus stays 'waiting' until host starts — others go 'playing'
        const newStatus = match.game_type === 'stopthebus' ? 'waiting' : 'playing';
        const updatedPlayers = [...match.players, player];

        const { data: updated, error } = await supabase.from('live_matches').update({
            players: updatedPlayers,
            status: newStatus,
        }).eq('id', joiningMatchId).select().single();
        setLoading(false);
        if (error) return toast.error('فشل الانضمام');
        setCurrentMatch(updated); setView('playing');
    };

    // ── Delete match ──
    const handleDeleteMatch = async (matchId: string, isAuto = false) => {
        if (!isAuto) setLoading(true);
        try {
            await supabase.from('live_matches').delete().eq('id', matchId);
            if (isAuto) toast('تم إغلاق الغرفة لعدم انضمام أحد', { icon: '⏳' });
            else toast.success('تم حذف الغرفة');
        } catch { if (!isAuto) toast.error('لم يتم الحذف من السيرفر'); }
        if (currentMatch?.id === matchId) { setCurrentMatch(null); setView('lobby'); }
        setMatches(prev => prev.filter(m => m.id !== matchId));
        if (!isAuto) setLoading(false);
    };

    // ── XO / Reward helpers (passed down to XOGame) ──
    const handleRewardSelection = async (difficulty: 'easy' | 'medium' | 'hard', pts: number, timeLimit: number) => {
        setLoading(true);
        const q = await fetchUnifiedQuestion(employee, difficulty);
        if (!q) {
            toast.success(`لا أسئلة — ربحت ${pts} نقطة مباشرة!`);
            await grantPoints(pts);
            await supabase.from('live_matches').update({ status: 'finished' }).eq('id', currentMatch.id);
            setLoading(false); return;
        }
        await supabase.from('live_matches').update({ status: 'answering_reward', final_question: { ...q, rewardPoints: pts, timeLimit } }).eq('id', currentMatch.id);
        setLoading(false);
    };

    const handleRewardAnswer = async (answerText: string) => {
        setLoading(true); setTimeLeft(null);
        const correct = currentMatch.final_question?.correctAnswer || '';
        const sel = answerText.trim().toLowerCase();
        const isCorrect = correct === sel || correct.includes(sel) || sel.includes(correct);
        if (isCorrect) await grantPoints(currentMatch.final_question?.rewardPoints || 0);
        else toast.error(answerText === 'TIMEOUT_WRONG_ANSWER' ? 'انتهى الوقت!' : 'إجابة خاطئة! حظ أوفر');
        await supabase.from('live_matches').update({ status: 'finished' }).eq('id', currentMatch.id);
        setLoading(false);
    };

    const exitMatch = () => { setCurrentMatch(null); setView('lobby'); setJoiningMatchId(null); setTimeLeft(null); };

    const amIWinner = currentMatch?.winner_id === employee.employee_id;
    const me       = currentMatch?.players?.find((p: any) => p.id === employee.employee_id);
    const opponent = currentMatch?.players?.find((p: any) => p.id !== employee.employee_id);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="bg-gray-50 min-h-full flex flex-col relative font-sans text-right" dir="rtl">

            {onClose && (
                <button onClick={onClose} className="absolute top-3 left-3 z-50 p-2 bg-black/10 hover:bg-black/20 rounded-full text-gray-700">
                    <X className="w-5 h-5"/>
                </button>
            )}

            {/* ── LOBBY ── */}
            {view === 'lobby' && (
                <div className="p-3 flex-1 space-y-4">

                    {/* Banner */}
                    <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-4 text-white text-center shadow-lg">
                        <h3 className="text-xl font-black mb-1">تحدى زملائك الآن! 🔥</h3>
                        <p className="text-indigo-100 text-xs mb-4">اختر لعبة وتحدى زميلك أونلاين</p>

                        {/* Game type selector */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {GAME_TYPES.map(g => (
                                <button key={g.key} onClick={() => setSelectedGameType(g.key)}
                                    className={`py-2 px-1 rounded-xl font-black text-xs transition-all border-2 ${selectedGameType === g.key ? 'bg-white text-indigo-700 border-white' : 'bg-white/20 text-white border-white/30 hover:bg-white/30'}`}>
                                    <span className="text-xl block mb-0.5">{g.icon}</span>
                                    <span>{g.label}</span>
                                </button>
                            ))}
                        </div>

                        <button onClick={() => { setJoiningMatchId(null); setView('identity_setup'); }}
                            className="bg-yellow-400 text-indigo-900 px-6 py-3 rounded-xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all w-full text-sm">
                            إنشاء تحدي {GAME_TYPES.find(g => g.key === selectedGameType)?.label} ⚔️
                        </button>
                    </div>

                    {/* Waiting rooms */}
                    <div>
                        <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2 text-sm">
                            <Users className="w-4 h-4 text-indigo-500"/> غرف الانتظار ({matches.length})
                        </h4>
                        {matches.length === 0 ? (
                            <div className="text-center py-8 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                                <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2"/>
                                <p className="text-gray-400 font-bold text-sm">لا توجد غرف.. كن الأول!</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {matches.map((m: any) => {
                                    const isMyRoom = m.created_by === employee.employee_id;
                                    const gameInfo = GAME_TYPES.find(g => g.key === m.game_type);
                                    const isBus = m.game_type === 'stopthebus';
                                    const playerCount = m.players?.length ?? 1;
                                    return (
                                        <div key={m.id} className={`bg-white p-3 rounded-xl shadow-sm border flex justify-between items-center ${isMyRoom ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-100'}`}>
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xl border border-gray-200">
                                                    <AvatarDisplay avatar={m.players[0]?.avatar}/>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <p className="font-bold text-gray-800 text-sm">{m.players[0]?.name}</p>
                                                        <span className="bg-indigo-100 text-indigo-600 text-[10px] font-black px-1.5 py-0.5 rounded-full">{gameInfo?.icon} {gameInfo?.label}</span>
                                                        {isMyRoom && <span className="bg-green-100 text-green-600 text-[10px] font-black px-1.5 py-0.5 rounded-full">غرفتك</span>}
                                                        {isBus && <span className="bg-purple-100 text-purple-600 text-[10px] font-black px-1.5 py-0.5 rounded-full">{playerCount} لاعب</span>}
                                                    </div>
                                                    <p className="text-[11px] text-gray-400 font-bold">
                                                        {isBus ? `في انتظار اللاعبين... (${playerCount}/${gameInfo?.maxPlayers})` : 'في انتظار منافس...'}
                                                    </p>
                                                </div>
                                            </div>
                                            {isMyRoom ? (
                                                <div className="flex gap-1.5">
                                                    <button onClick={() => handleDeleteMatch(m.id)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                                                    <button onClick={() => { copyRoomLink(m.id); toast.success('تم نسخ الرابط! 🔗', { icon: '📋', duration: 2500 }); }} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100" title="شارك الرابط"><Share2 size={16}/></button>
                                                    <button onClick={() => { setCurrentMatch(m); setView('playing'); }} className="px-3 py-1.5 bg-indigo-100 text-indigo-600 rounded-lg font-bold text-xs">دخول</button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-1.5">
                                                    <button onClick={() => { copyRoomLink(m.id); toast.success('تم نسخ الرابط! 🔗', { icon: '📋', duration: 2500 }); }} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100" title="شارك الرابط"><Share2 size={16}/></button>
                                                    <button onClick={() => { setJoiningMatchId(m.id); setJoiningGameType(m.game_type); setView('identity_setup'); }}
                                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-md hover:bg-indigo-700">انضمام</button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── IDENTITY ── */}
            {view === 'identity_setup' && (
                <div className="p-4 flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
                    <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 w-full text-center">
                        <UserX className="w-12 h-12 text-indigo-500 mx-auto mb-3"/>
                        <h3 className="text-xl font-black text-gray-800 mb-1">اختر هويتك</h3>
                        <p className="text-xs text-gray-400 font-bold mb-4">
                            {joiningMatchId
                                ? `الانضمام: ${GAME_TYPES.find(g => g.key === joiningGameType)?.label}`
                                : `إنشاء: ${GAME_TYPES.find(g => g.key === selectedGameType)?.label}`}
                        </p>
                        <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                            <button onClick={() => setUseAlias(false)} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${!useAlias ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>هويتي الحقيقية</button>
                            <button onClick={() => setUseAlias(true)}  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${useAlias  ? 'bg-indigo-600 shadow-sm text-white' : 'text-gray-500'}`}>هوية مستعارة 🥷</button>
                        </div>
                        {useAlias && (
                            <div className="grid grid-cols-2 gap-2 mb-4 max-h-[220px] overflow-y-auto p-0.5">
                                {ALIASES.map(alias => (
                                    <button key={alias.name} onClick={() => setSelectedAlias(alias)}
                                        className={`p-2 rounded-xl border-2 font-bold flex items-center justify-center gap-1.5 transition-all text-xs ${selectedAlias.name === alias.name ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-100 text-gray-600'}`}>
                                        <span>{alias.emoji}</span><span>{alias.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        <button onClick={joiningMatchId ? handleJoinMatch : handleCreateMatch} disabled={loading}
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-base shadow-lg hover:bg-indigo-700 flex justify-center items-center gap-2">
                            {loading ? <Loader2 className="animate-spin w-5 h-5"/> : <><Play fill="currentColor" className="w-4 h-4"/> {joiningMatchId ? 'دخول اللعبة' : 'إنشاء الغرفة'}</>}
                        </button>
                        <button onClick={() => setView('lobby')} className="mt-3 text-gray-400 font-bold text-sm hover:text-gray-600">إلغاء</button>
                    </div>
                </div>
            )}

            {/* ── PLAYING ── */}
            {view === 'playing' && currentMatch && (
                <div className="flex-1 flex flex-col">

                    {/* Players header — hidden for stopthebus (has its own) */}
                    {currentMatch.game_type !== 'stopthebus' && (
                        <div className="px-3 py-3 flex justify-between items-center border-b border-gray-100">
                            {/* Me */}
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${currentMatch.game_state?.current_turn === me?.id ? 'border-green-500 bg-white shadow-md scale-105' : 'border-transparent opacity-60'}`}>
                                <div className="w-9 h-9 rounded-full border overflow-hidden bg-gray-100 flex items-center justify-center"><AvatarDisplay avatar={me?.avatar}/></div>
                                <div><p className="text-xs font-black text-gray-800">أنت</p><p className="text-sm font-bold text-green-600">{me?.symbol}</p></div>
                            </div>
                            <div className="font-black text-gray-300 text-base">VS</div>
                            {/* Opponent */}
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all flex-row-reverse ${currentMatch.game_state?.current_turn === opponent?.id ? 'border-red-500 bg-white shadow-md scale-105' : 'border-transparent opacity-60'}`}>
                                <div className="w-9 h-9 rounded-full border overflow-hidden bg-white flex items-center justify-center">
                                    {opponent ? <AvatarDisplay avatar={opponent.avatar}/> : <Loader2 className="w-4 h-4 animate-spin text-gray-400"/>}
                                </div>
                                <div className="text-left"><p className="text-xs font-black text-gray-800 truncate max-w-[70px]">{opponent?.name || 'انتظار...'}</p><p className="text-sm font-bold text-red-500">{opponent?.symbol || '?'}</p></div>
                            </div>
                        </div>
                    )}

                    {/* Game area */}
                    <div className={`flex-1 flex flex-col ${currentMatch.game_type !== 'stopthebus' ? 'items-center justify-center p-3' : ''}`}>

                        {/* WAITING (non-stopthebus) */}
                        {currentMatch.status === 'waiting' && currentMatch.game_type !== 'stopthebus' && (
                            <div className="text-center">
                                <Loader2 className="w-14 h-14 text-indigo-200 animate-spin mx-auto mb-4"/>
                                <h3 className="text-lg font-black text-indigo-900">في انتظار المنافس...</h3>
                                {autoDeleteTimeLeft !== null && (
                                    <p className="text-sm font-bold text-red-500 mt-2">
                                        يُغلق تلقائياً: {Math.floor(autoDeleteTimeLeft/60)}:{String(autoDeleteTimeLeft%60).padStart(2,'0')}
                                    </p>
                                )}
                                {currentMatch.created_by === employee.employee_id && (
                                    <div className="mt-6 flex items-center gap-3 justify-center flex-wrap">
                                        {/* Share room link */}
                                        <button onClick={() => {
                                            copyRoomLink(currentMatch.id);
                                            toast.success('تم نسخ رابط الغرفة! أرسله لزميلك 🔗', { icon: '📋', duration: 3000 });
                                        }} className="bg-green-50 text-green-600 border border-green-200 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-green-100 active:scale-95 transition-all text-sm shadow-sm">
                                            <Share2 size={16}/> شارك الرابط
                                        </button>
                                        {/* Cancel room */}
                                        <button onClick={() => handleDeleteMatch(currentMatch.id)}
                                            className="bg-red-50 text-red-500 border border-red-200 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-red-100 active:scale-95 transition-all text-sm shadow-sm">
                                            <Trash2 size={16}/> إلغاء الغرفة
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── XO ── */}
                        {currentMatch.game_type === 'xo' && ['playing','reward_time','answering_reward','finished'].includes(currentMatch.status) && (
                            <XOGame
                                match={currentMatch}
                                employee={employee}
                                onExit={exitMatch}
                                grantPoints={grantPoints}
                                handleRewardSelection={handleRewardSelection}
                                handleRewardAnswer={handleRewardAnswer}
                                timeLeft={timeLeft}
                                loading={loading}
                            />
                        )}

                        {/* ── CONNECT 4 ── */}
                        {currentMatch.game_type === 'connect4' && (
                            <Connect4Game match={currentMatch} employee={employee} onExit={exitMatch} grantPoints={grantPoints}/>
                        )}

                        {/* ── STOP THE BUS ── */}
                        {currentMatch.game_type === 'stopthebus' && (
                            <StopTheBusGame match={currentMatch} employee={employee} onExit={exitMatch} grantPoints={grantPoints}/>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
