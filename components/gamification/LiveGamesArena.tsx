import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Employee } from '../../types';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { 
    Gamepad2, Swords, UserSecret, Trophy, Users, Clock, 
    AlertTriangle, Play, X, CheckCircle2, Zap, BrainCircuit, Loader2 
} from 'lucide-react';

const ALIASES = [
    { name: 'طبيب غامض', emoji: '🕵️‍♂️' }, { name: 'ممرض نينجا', emoji: '🥷' },
    { name: 'شبح المعمل', emoji: '🧛‍♂️' }, { name: 'ساحر الأدوية', emoji: '🧙‍♂️' },
    { name: 'بطلة الطوارئ', emoji: '🦸‍♀️' }, { name: 'صقر الجودة', emoji: '🦅' },
    { name: 'دينامو الاستقبال', emoji: '⚡' }, { name: 'قناص الملفات', emoji: '🎯' }
];

export default function LiveGamesArena({ employee, onClose }: { employee: Employee, onClose?: () => void }) {
    const queryClient = useQueryClient();

    // --- States ---
    const [matches, setMatches] = useState<any[]>([]);
    const [currentMatch, setCurrentMatch] = useState<any>(null);
    const [view, setView] = useState<'lobby' | 'identity_setup' | 'playing'>('lobby');
    
    // Identity State
    const [useAlias, setUseAlias] = useState(false);
    const [selectedAlias, setSelectedAlias] = useState(ALIASES[0]);
    const [joiningMatchId, setJoiningMatchId] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);

    // --- Realtime Subscription ---
    useEffect(() => {
        fetchWaitingMatches();

        const channel = supabase.channel('live_arena')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'live_matches' }, (payload) => {
                const updatedMatch = payload.new;
                
                // تحديث الصالة
                if (updatedMatch.status === 'waiting') {
                    fetchWaitingMatches();
                } else {
                    setMatches(prev => prev.filter(m => m.id !== updatedMatch.id));
                }

                // تحديث اللعبة الحالية إذا كنت داخلها
                setCurrentMatch((prev: any) => {
                    if (prev && prev.id === updatedMatch.id) {
                        return updatedMatch;
                    }
                    return prev;
                });
            }).subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchWaitingMatches = async () => {
        const { data } = await supabase.from('live_matches').select('*').eq('status', 'waiting').order('created_at', { ascending: false });
        if (data) setMatches(data);
    };

    // --- Actions ---
    const getMyPlayerInfo = () => {
        return {
            id: employee.employee_id,
            name: useAlias ? selectedAlias.name : employee.name.split(' ')[0],
            avatar: useAlias ? selectedAlias.emoji : (employee.photo_url || '👤'),
            isAlias: useAlias
        };
    };

    const handleCreateMatch = async () => {
        setLoading(true);
        const player = { ...getMyPlayerInfo(), symbol: 'X' }; // منشئ الغرفة دائماً X
        
        const { data, error } = await supabase.from('live_matches').insert({
            game_type: 'xo',
            status: 'waiting',
            players: [player],
            game_state: { board: Array(9).fill(null), current_turn: player.id },
            created_by: employee.employee_id
        }).select().single();

        setLoading(false);
        if (error) return toast.error('حدث خطأ أثناء الإنشاء');
        
        setCurrentMatch(data);
        setView('playing');
    };

    const handleJoinMatch = async () => {
        if (!joiningMatchId) return;
        setLoading(true);
        
        // جلب بيانات الغرفة
        const { data: match } = await supabase.from('live_matches').select('*').eq('id', joiningMatchId).single();
        if (!match || match.status !== 'waiting') {
            setLoading(false);
            return toast.error('هذه الغرفة لم تعد متاحة!');
        }

        const player = { ...getMyPlayerInfo(), symbol: 'O' }; // المنضم دائماً O
        const updatedPlayers = [...match.players, player];

        const { data: updatedMatch, error } = await supabase.from('live_matches').update({
            players: updatedPlayers,
            status: 'playing' // تبدأ اللعبة فوراً
        }).eq('id', joiningMatchId).select().single();

        setLoading(false);
        if (error) return toast.error('فشل الانضمام للغرفة');
        
        setCurrentMatch(updatedMatch);
        setView('playing');
    };

    // --- XO Logic ---
    const checkWinner = (board: string[]) => {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6],
            [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]
        ];
        for (let i = 0; i < lines.length; i++) {
            const [a, b, c] = lines[i];
            if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
        }
        if (!board.includes(null)) return 'draw';
        return null;
    };

    const handleCellClick = async (index: number) => {
        if (!currentMatch || currentMatch.status !== 'playing') return;
        
        const state = currentMatch.game_state;
        const myPlayer = currentMatch.players.find((p: any) => p.id === employee.employee_id);
        
        // التحقق من الدور والخانة
        if (state.current_turn !== employee.employee_id) return toast.error('ليس دورك!');
        if (state.board[index] !== null) return;

        const newBoard = [...state.board];
        newBoard[index] = myPlayer.symbol;

        const winnerSymbol = checkWinner(newBoard);
        const opponent = currentMatch.players.find((p: any) => p.id !== employee.employee_id);
        
        let newStatus = 'playing';
        let winnerId = null;

        if (winnerSymbol === 'draw') {
            newStatus = 'sudden_death'; // كسر التعادل
            await prepareSuddenDeathQuestion(currentMatch.id, newBoard, opponent.id);
            return;
        } else if (winnerSymbol) {
            newStatus = 'reward_time';
            winnerId = winnerSymbol === myPlayer.symbol ? myPlayer.id : opponent.id;
        }

        await supabase.from('live_matches').update({
            game_state: { board: newBoard, current_turn: opponent.id },
            status: newStatus,
            winner_id: winnerId
        }).eq('id', currentMatch.id);
    };

    const prepareSuddenDeathQuestion = async (matchId: string, board: string[], nextTurn: string) => {
        // سحب سؤال عشوائي لكسر التعادل
        const { data: qData } = await supabase.from('arcade_quiz_questions').select('*').limit(20);
        const randomQ = qData ? qData[Math.floor(Math.random() * qData.length)] : null;
        
        await supabase.from('live_matches').update({
            game_state: { board, current_turn: nextTurn },
            status: 'sudden_death',
            final_question: randomQ
        }).eq('id', matchId);
    };

    const handleSuddenDeathAnswer = async (answer: string) => {
        if (currentMatch.status !== 'sudden_death') return;
        setLoading(true);

        const isCorrect = answer === currentMatch.final_question?.correct_answer;
        
        if (isCorrect) {
            // أنا الفائز! نعطيه نقاط التعادل (10 نقاط)
            await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: 10 });
            await supabase.from('points_ledger').insert({ employee_id: employee.employee_id, points: 10, reason: 'الفوز بكسر التعادل المباشر ⚡' });
            
            await supabase.from('live_matches').update({ status: 'finished', winner_id: employee.employee_id }).eq('id', currentMatch.id);
            confetti({ particleCount: 150, spread: 80 });
            toast.success('أنت الأسرع! كسبت التحدي ⚡🏆');
        } else {
            toast.error('إجابة خاطئة! خصمك قد يفوز الآن.');
        }
        setLoading(false);
    };

    const handleRewardSelection = async (difficulty: 'easy'|'medium'|'hard', points: number) => {
        setLoading(true);
        // سحب سؤال بناء على الصعوبة
        const { data: qData } = await supabase.from('arcade_quiz_questions').select('*').eq('difficulty', difficulty).limit(10);
        const randomQ = qData && qData.length > 0 ? qData[Math.floor(Math.random() * qData.length)] : null;

        await supabase.from('live_matches').update({
            status: 'answering_reward',
            final_question: { ...randomQ, rewardPoints: points }
        }).eq('id', currentMatch.id);
        setLoading(false);
    };

    const handleRewardAnswer = async (answer: string) => {
        setLoading(true);
        const isCorrect = answer === currentMatch.final_question?.correct_answer;
        const rewardPoints = currentMatch.final_question?.rewardPoints || 0;

        if (isCorrect) {
            await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: rewardPoints });
            await supabase.from('points_ledger').insert({ employee_id: employee.employee_id, points: rewardPoints, reason: `سؤال جائزة التحدي (${rewardPoints} نقطة) 🏆` });
            toast.success(`مبروك! ربحت ${rewardPoints} نقطة! 🎉`);
            confetti({ particleCount: 200, spread: 100 });
        } else {
            toast.error('إجابة خاطئة! للأسف ضاعت الجائزة 😞');
        }

        await supabase.from('live_matches').update({ status: 'finished' }).eq('id', currentMatch.id);
        setLoading(false);
    };

    const exitMatch = () => {
        setCurrentMatch(null);
        setView('lobby');
        setJoiningMatchId(null);
    };

    // --- Render Helpers ---
    const amIWinner = currentMatch?.winner_id === employee.employee_id;
    const opponent = currentMatch?.players?.find((p: any) => p.id !== employee.employee_id);
    const me = currentMatch?.players?.find((p: any) => p.id === employee.employee_id);

    return (
        <div className="bg-gray-100 min-h-[80vh] rounded-[2rem] overflow-hidden flex flex-col relative font-sans text-right" dir="rtl">
            
            {/* --- Header --- */}
            <div className="bg-gradient-to-l from-indigo-900 via-purple-900 to-indigo-900 p-4 text-white flex justify-between items-center shrink-0 shadow-md z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm"><Gamepad2 className="text-yellow-400 animate-pulse"/></div>
                    <div>
                        <h2 className="font-black text-lg">صالة الألعاب المباشرة</h2>
                        <p className="text-[10px] text-indigo-200 font-bold">Live Multiplayer Arena</p>
                    </div>
                </div>
                {onClose && <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><X/></button>}
            </div>

            {/* --- View: LOBBY --- */}
            {view === 'lobby' && (
                <div className="p-4 md:p-6 flex-1 overflow-y-auto space-y-6">
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white text-center shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -ml-10 -mt-10"></div>
                        <h3 className="text-xl font-black mb-2 relative z-10">تحدى زملائك الآن! 🔥</h3>
                        <p className="text-xs text-indigo-100 mb-6 relative z-10">العب، اكسب، وتصدر لوحة الشرف في ثوانٍ معدودة.</p>
                        <button onClick={() => { setJoiningMatchId(null); setView('identity_setup'); }} className="bg-yellow-400 text-indigo-900 px-8 py-3 rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all w-full md:w-auto relative z-10">
                            إنشاء تحدي جديد ⚔️
                        </button>
                    </div>

                    <div>
                        <h4 className="font-black text-gray-800 flex items-center gap-2 mb-4"><Users className="text-purple-600"/> تحديات في انتظارك ({matches.length})</h4>
                        {matches.length === 0 ? (
                            <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-gray-300">
                                <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2"/>
                                <p className="text-gray-500 font-bold">لا توجد غرف مفتوحة حالياً. كن أنت المبادر!</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {matches.map((m: any) => (
                                    <div key={m.id} className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-50 flex justify-between items-center hover:border-indigo-300 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="text-3xl bg-gray-50 w-12 h-12 flex items-center justify-center rounded-xl shadow-inner border border-gray-100">{m.players[0]?.avatar}</div>
                                            <div>
                                                <p className="font-black text-gray-800 text-sm">{m.players[0]?.name}</p>
                                                <p className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md inline-block mt-1">لعبة XO</p>
                                            </div>
                                        </div>
                                        <button onClick={() => { setJoiningMatchId(m.id); setView('identity_setup'); }} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm">
                                            انضمام
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- View: IDENTITY SETUP --- */}
            {view === 'identity_setup' && (
                <div className="p-6 flex-1 flex flex-col items-center justify-center animate-in zoom-in-95">
                    <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-gray-100 w-full max-w-md text-center">
                        <UserSecret className="w-12 h-12 text-indigo-500 mx-auto mb-4"/>
                        <h3 className="text-xl font-black text-gray-800 mb-2">كيف تريد أن تظهر؟</h3>
                        <p className="text-xs text-gray-500 font-bold mb-6">يمكنك اللعب باسمك الحقيقي أو الدخول بهوية سرية لزيادة الحماس!</p>

                        <div className="flex bg-gray-100 p-1 rounded-2xl mb-6">
                            <button onClick={() => setUseAlias(false)} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${!useAlias ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>صورتي واسمي</button>
                            <button onClick={() => setUseAlias(true)} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${useAlias ? 'bg-indigo-600 shadow text-white' : 'text-gray-500'}`}>هوية مخفية 🥷</button>
                        </div>

                        {useAlias && (
                            <div className="grid grid-cols-2 gap-2 mb-6">
                                {ALIASES.map(alias => (
                                    <button 
                                        key={alias.name} onClick={() => setSelectedAlias(alias)}
                                        className={`p-2 rounded-xl border-2 text-sm font-bold flex items-center justify-center gap-2 transition-all ${selectedAlias.name === alias.name ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-100 text-gray-600 bg-white hover:bg-gray-50'}`}
                                    >
                                        <span>{alias.emoji}</span> <span>{alias.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <button 
                            onClick={joiningMatchId ? handleJoinMatch : handleCreateMatch} 
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-indigo-200 hover:scale-[1.02] active:scale-95 transition-all flex justify-center items-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin w-6 h-6"/> : <><Play fill="currentColor"/> {joiningMatchId ? 'دخول الغرفة' : 'إنشاء الغرفة'}</>}
                        </button>
                        <button onClick={() => setView('lobby')} className="mt-4 text-sm font-bold text-gray-400 hover:text-gray-600">إلغاء والعودة</button>
                    </div>
                </div>
            )}

            {/* --- View: PLAYING --- */}
            {view === 'playing' && currentMatch && (
                <div className="flex-1 flex flex-col bg-gray-50 animate-in fade-in">
                    
                    {/* شريط اللاعبين العرضي */}
                    <div className="bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm relative z-10">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 transition-colors ${currentMatch.game_state.current_turn === me?.id ? 'border-green-400 bg-green-50 shadow-sm' : 'border-transparent opacity-60'}`}>
                            <span className="text-2xl bg-white w-8 h-8 flex items-center justify-center rounded-lg shadow-sm border">{me?.avatar}</span>
                            <div>
                                <p className="text-xs font-black text-gray-800">أنت ({me?.symbol})</p>
                                {currentMatch.game_state.current_turn === me?.id && <span className="text-[9px] font-bold text-green-600 animate-pulse block">دورك الآن</span>}
                            </div>
                        </div>
                        
                        <div className="font-black text-gray-300 text-lg">VS</div>

                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 transition-colors flex-row-reverse ${currentMatch.game_state.current_turn === opponent?.id ? 'border-red-400 bg-red-50 shadow-sm' : 'border-transparent opacity-60'}`}>
                            <span className="text-2xl bg-white w-8 h-8 flex items-center justify-center rounded-lg shadow-sm border">{opponent?.avatar || '⏳'}</span>
                            <div className="text-left">
                                <p className="text-xs font-black text-gray-800">{opponent?.name || 'في الانتظار...'} {opponent ? `(${opponent.symbol})` : ''}</p>
                                {currentMatch.game_state.current_turn === opponent?.id && <span className="text-[9px] font-bold text-red-600 animate-pulse block">يفكر...</span>}
                            </div>
                        </div>
                    </div>

                    {/* لوحة اللعب XO */}
                    <div className="flex-1 flex items-center justify-center p-4">
                        {currentMatch.status === 'waiting' ? (
                            <div className="text-center animate-pulse">
                                <Loader2 className="w-12 h-12 text-indigo-300 animate-spin mx-auto mb-4"/>
                                <h3 className="font-black text-indigo-900 text-lg">في انتظار انضمام المنافس...</h3>
                                <p className="text-xs text-gray-500 font-bold mt-2">شارك اللعبة مع زملائك ليدخلوا الصالة</p>
                            </div>
                        ) : currentMatch.status === 'playing' ? (
                            <div className="grid grid-cols-3 gap-2 md:gap-3 bg-indigo-100 p-2 md:p-3 rounded-3xl shadow-inner max-w-[350px] w-full">
                                {currentMatch.game_state.board.map((cell: string, idx: number) => (
                                    <button 
                                        key={idx} 
                                        onClick={() => handleCellClick(idx)}
                                        disabled={cell !== null || currentMatch.game_state.current_turn !== employee.employee_id}
                                        className={`aspect-square bg-white rounded-2xl shadow-sm text-5xl md:text-6xl font-black flex items-center justify-center transition-all ${!cell && currentMatch.game_state.current_turn === employee.employee_id ? 'hover:bg-indigo-50 active:scale-95 cursor-pointer' : ''} ${cell === 'X' ? 'text-indigo-600' : 'text-rose-500'}`}
                                    >
                                        {cell && <span className="animate-in zoom-in spin-in-12">{cell}</span>}
                                    </button>
                                ))}
                            </div>
                        ) : currentMatch.status === 'sudden_death' ? (
                            <div className="bg-white w-full max-w-md rounded-[2rem] p-6 text-center shadow-2xl border-4 border-yellow-400 animate-in zoom-in">
                                <Zap className="w-16 h-16 text-yellow-500 mx-auto mb-2 animate-bounce"/>
                                <h3 className="text-2xl font-black text-gray-800 mb-1">تعادل! الموت المفاجئ ⚡</h3>
                                <p className="text-xs font-bold text-gray-500 mb-6">أول من يجيب إجابة صحيحة يربح 10 نقاط فوراً</p>
                                
                                {currentMatch.final_question ? (
                                    <div className="space-y-4">
                                        <p className="font-black text-lg bg-gray-50 p-4 rounded-xl border leading-relaxed">{currentMatch.final_question.question || currentMatch.final_question.question_text}</p>
                                        <div className="grid grid-cols-1 gap-2">
                                            {/* افتراض أن الخيارات مخزنة في مصفوفة options أو بحقول option_a, etc */}
                                            {['a', 'b', 'c', 'd'].map(opt => {
                                                const optText = currentMatch.final_question[`option_${opt}`];
                                                if(!optText) return null;
                                                return (
                                                    <button key={opt} onClick={() => handleSuddenDeathAnswer(optText)} disabled={loading} className="w-full bg-white border-2 border-gray-100 p-3 rounded-xl font-bold text-gray-700 hover:border-yellow-400 hover:bg-yellow-50 transition-colors">
                                                        {optText}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ) : <Loader2 className="mx-auto animate-spin"/>}
                            </div>
                        ) : currentMatch.status === 'reward_time' ? (
                            <div className="bg-white w-full max-w-md rounded-[2rem] p-6 text-center shadow-2xl animate-in zoom-in">
                                {amIWinner ? (
                                    <>
                                        <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4 drop-shadow-lg animate-pulse"/>
                                        <h3 className="text-3xl font-black text-gray-800 mb-2">أنت الفائز! 🎉</h3>
                                        <p className="text-sm font-bold text-gray-500 mb-6">اختر مستوى الصعوبة لسؤال الجائزة لتكسب النقاط:</p>
                                        <div className="space-y-3">
                                            <button onClick={() => handleRewardSelection('easy', 5)} disabled={loading} className="w-full bg-green-50 border border-green-200 text-green-700 p-4 rounded-2xl font-black flex justify-between items-center hover:bg-green-100 transition-colors"><span>سهل</span> <span>+5 نقاط</span></button>
                                            <button onClick={() => handleRewardSelection('medium', 10)} disabled={loading} className="w-full bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-2xl font-black flex justify-between items-center hover:bg-yellow-100 transition-colors"><span>متوسط</span> <span>+10 نقاط</span></button>
                                            <button onClick={() => handleRewardSelection('hard', 20)} disabled={loading} className="w-full bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl font-black flex justify-between items-center hover:bg-red-100 transition-colors"><span>صعب (مخاطرة)</span> <span>+20 نقطة</span></button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-10">
                                        <span className="text-6xl mb-4 block">😞</span>
                                        <h3 className="text-xl font-black text-gray-800">لقد خسرت الجولة</h3>
                                        <p className="text-sm font-bold text-gray-500 mt-2">خصمك يقوم الآن باختيار سؤال الجائزة.</p>
                                        <button onClick={exitMatch} className="mt-8 bg-gray-100 px-6 py-2 rounded-xl font-bold text-gray-600">خروج للرئيسية</button>
                                    </div>
                                )}
                            </div>
                        ) : currentMatch.status === 'answering_reward' ? (
                            <div className="bg-white w-full max-w-md rounded-[2rem] p-6 text-center shadow-2xl animate-in zoom-in">
                                {amIWinner ? (
                                    <>
                                        <BrainCircuit className="w-16 h-16 text-indigo-500 mx-auto mb-4"/>
                                        <h3 className="text-xl font-black text-gray-800 mb-1">سؤال الجائزة 🎁</h3>
                                        <p className="text-xs font-bold text-yellow-600 mb-6 bg-yellow-50 inline-block px-3 py-1 rounded-full border border-yellow-100">اربح {currentMatch.final_question?.rewardPoints} نقطة!</p>
                                        
                                        <p className="font-black text-lg bg-gray-50 p-4 rounded-xl border mb-6 leading-relaxed">{currentMatch.final_question?.question || currentMatch.final_question?.question_text}</p>
                                        
                                        <div className="grid grid-cols-1 gap-2">
                                            {['a', 'b', 'c', 'd'].map(opt => {
                                                const optText = currentMatch.final_question[`option_${opt}`];
                                                if(!optText) return null;
                                                return (
                                                    <button key={opt} onClick={() => handleRewardAnswer(optText)} disabled={loading} className="w-full bg-white border-2 border-gray-100 p-3 rounded-xl font-bold text-gray-700 hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                                                        {optText}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-10">
                                        <Loader2 className="w-12 h-12 text-indigo-300 animate-spin mx-auto mb-4"/>
                                        <h3 className="text-lg font-black text-gray-800">جاري الإجابة...</h3>
                                        <p className="text-xs font-bold text-gray-500 mt-2">الفائز يحاول الإجابة على سؤال الجائزة.</p>
                                        <button onClick={exitMatch} className="mt-8 bg-gray-100 px-6 py-2 rounded-xl font-bold text-gray-600">خروج للرئيسية</button>
                                    </div>
                                )}
                            </div>
                        ) : currentMatch.status === 'finished' ? (
                            <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 text-center shadow-2xl animate-in zoom-in text-center">
                                <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4"/>
                                <h3 className="text-2xl font-black text-gray-800 mb-2">انتهت اللعبة!</h3>
                                <button onClick={exitMatch} className="mt-6 bg-indigo-600 text-white w-full py-3 rounded-xl font-black hover:bg-indigo-700 transition-colors shadow-lg">العودة للصالة</button>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
}
