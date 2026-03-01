import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Employee } from '../../types';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { 
    Gamepad2, Swords, UserX, Trophy, Users, Clock, 
    AlertTriangle, Play, X, CheckCircle2, Zap, BrainCircuit, Loader2, Trash2, Timer
} from 'lucide-react';

const ALIASES = [
    { name: 'طبيب غامض', emoji: '🕵️‍♂️' }, { name: 'ممرض نينجا', emoji: '🥷' },
    { name: 'شبح المعمل', emoji: '🧛‍♂️' }, { name: 'ساحر الأدوية', emoji: '🧙‍♂️' },
    { name: 'بطلة الطوارئ', emoji: '🦸‍♀️' }, { name: 'صقر الجودة', emoji: '🦅' },
    { name: 'دينامو الاستقبال', emoji: '⚡' }, { name: 'قناص الملفات', emoji: '🎯' }
];

const AvatarDisplay = ({ avatar, className = "" }: { avatar: string, className?: string }) => {
    if (avatar?.startsWith('http')) {
        return <img src={avatar} alt="avatar" className={`w-full h-full object-cover ${className}`} />;
    }
    return <span className={className}>{avatar || '👤'}</span>;
};

// دالة توحيد التخصصات للبحث الدقيق
const getSpecialtyVariations = (spec: string) => {
    if (!spec) return ['الكل'];
    const s = spec.toLowerCase();
    if (s.includes('بشر') || s.includes('عام')) return ['بشري', 'طبيب بشرى', 'طبيب عام'];
    if (s.includes('سنان')) return ['أسنان', 'اسنان', 'طبيب أسنان'];
    if (s.includes('تمريض') || s.includes('ممرض')) return ['تمريض', 'ممرض', 'ممرضة'];
    if (s.includes('صيدل')) return ['صيدلة', 'صيدلي', 'صيدلاني'];
    if (s.includes('معمل') || s.includes('مختبر')) return ['معمل', 'فني معمل', 'مختبر'];
    if (s.includes('جود')) return ['جودة', 'الجودة'];
    if (s.includes('عدوى')) return ['مكافحة عدوى', 'مكافحه عدوى'];
    return [spec, 'الكل', 'all'];
};

export default function LiveGamesArena({ employee, onClose }: { employee: Employee, onClose?: () => void }) {
    const queryClient = useQueryClient();

    const [matches, setMatches] = useState<any[]>([]);
    const [currentMatch, setCurrentMatch] = useState<any>(null);
    const [view, setView] = useState<'lobby' | 'identity_setup' | 'playing'>('lobby');
    
    const [useAlias, setUseAlias] = useState(false);
    const [selectedAlias, setSelectedAlias] = useState(ALIASES[0]);
    const [joiningMatchId, setJoiningMatchId] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    
    // Timer States
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    // --- Timer Logic ---
    useEffect(() => {
        if (timeLeft === null || timeLeft <= 0) return;
        const timerId = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev && prev <= 1) {
                    clearInterval(timerId);
                    handleTimeOut(); 
                    return 0;
                }
                return prev ? prev - 1 : 0;
            });
        }, 1000);
        return () => clearInterval(timerId);
    }, [timeLeft]);

    const handleTimeOut = () => {
        if (currentMatch?.status === 'answering_reward') {
            handleRewardAnswer('TIMEOUT_WRONG_ANSWER');
        } else if (currentMatch?.status === 'sudden_death') {
            toast.error('انتهى الوقت!');
        }
    };

    // --- Realtime Subscription ---
    useEffect(() => {
        fetchWaitingMatches();

        const channel = supabase.channel('live_arena')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'live_matches' }, (payload) => {
                const updatedMatch = payload.new;

                if (payload.eventType === 'DELETE') {
                    setMatches(prev => prev.filter(m => m.id !== payload.old.id));
                    setCurrentMatch(prev => prev?.id === payload.old.id ? null : prev);
                    if (currentMatch?.id === payload.old.id) setView('lobby');
                    return;
                }
                
                if (updatedMatch.status === 'waiting') {
                    fetchWaitingMatches();
                } else {
                    setMatches(prev => prev.filter(m => m.id !== updatedMatch.id));
                }

                setCurrentMatch((prev: any) => {
                    if (prev && prev.id === updatedMatch.id) {
                        if (prev.status === 'waiting' && updatedMatch.status === 'playing' && updatedMatch.created_by === employee.employee_id) {
                            toast.success('انضم منافس لغرفتك! اللعبة تبدأ الآن 🎮', { icon: '🔥', duration: 4000, style: { borderRadius: '15px', background: '#333', color: '#fff' }});
                            new Audio('/notification.mp3').play().catch(() => {});
                        }
                        if (updatedMatch.status === 'answering_reward' && prev.status !== 'answering_reward' && updatedMatch.winner_id === employee.employee_id) {
                            setTimeLeft(updatedMatch.final_question?.timeLimit || 15);
                        }
                        if (updatedMatch.status === 'sudden_death' && prev.status !== 'sudden_death') {
                            setTimeLeft(15); 
                        }
                        return updatedMatch;
                    }
                    return prev;
                });
            }).subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [employee.employee_id, currentMatch?.id]);

    const fetchWaitingMatches = async () => {
        const { data } = await supabase.from('live_matches').select('*').eq('status', 'waiting').order('created_at', { ascending: false });
        if (data) setMatches(data);
    };

    // --- API & Question Fetching Logic ---
    const checkCooldown = async () => {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data } = await supabase.from('points_ledger')
            .select('id')
            .eq('employee_id', employee.employee_id)
            .like('reason', '%التحدي المباشر%')
            .gte('created_at', oneHourAgo)
            .limit(1);
        return data && data.length > 0;
    };

    // ✅ دالة ذكية جداً لجلب الأسئلة وتوحيد شكلها
    const fetchUnifiedQuestion = async (difficulty?: string) => {
        const variations = getSpecialtyVariations(employee.specialty);
        // تكوين فلتر البحث بالتخصص (ilike)
        const orFilter = variations.map(v => `specialty.ilike.%${v}%`).join(',');

        let questionsPool: any[] = [];

        // 1. البحث في arcade_quiz_questions
        const { data: aqData } = await supabase.from('arcade_quiz_questions').select('*').or(orFilter);
        if (aqData) questionsPool = [...questionsPool, ...aqData.map(q => ({ ...q, source: 'arcade_quiz' }))];

        // 2. البحث في arcade_dose_scenarios
        const { data: adData } = await supabase.from('arcade_dose_scenarios').select('*').or(orFilter);
        if (adData) questionsPool = [...questionsPool, ...adData.map(q => ({ ...q, source: 'arcade_dose' }))];

        // 3. البحث في quiz_questions
        const { data: qData } = await supabase.from('quiz_questions').select('*').or(orFilter);
        if (qData) questionsPool = [...questionsPool, ...qData.map(q => ({ ...q, source: 'standard_quiz' }))];

        // إذا لم يجد أسئلة بالتخصص، يجلب أسئلة عامة (Fallback)
        if (questionsPool.length === 0) {
            const { data: anyData } = await supabase.from('arcade_quiz_questions').select('*').limit(50);
            if (anyData) questionsPool = anyData.map(q => ({ ...q, source: 'arcade_quiz' }));
        }

        if (questionsPool.length === 0) return null;

        // فلترة بالصعوبة إذا طُلبت (سهل، متوسط، صعب)
        if (difficulty) {
            const diffPool = questionsPool.filter(q => q.difficulty === difficulty || (q.source === 'standard_quiz' && difficulty === 'medium')); 
            if (diffPool.length > 0) {
                return normalizeQuestionFormat(diffPool[Math.floor(Math.random() * diffPool.length)]);
            }
        }

        // سحب سؤال عشوائي من المتاح
        return normalizeQuestionFormat(questionsPool[Math.floor(Math.random() * questionsPool.length)]);
    };

    // ✅ دالة ضبط هيكل البيانات (تضمن ظهور الخيارات والإجابة الصحيحة بغض النظر عن الجدول)
    const normalizeQuestionFormat = (rawQ: any) => {
        let questionText = rawQ.question || rawQ.question_text || '';
        if (rawQ.scenario) questionText = `${rawQ.scenario} - ${questionText}`; 

        let opts: string[] = [];
        let correctAns = '';

        if (rawQ.source === 'standard_quiz') {
            // جدول quiz_questions يخزن الخيارات كمصفوفة نصية
            try { 
                let parsed = JSON.parse(rawQ.options);
                opts = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
            } catch (e) { 
                opts = []; 
            }
            correctAns = rawQ.correct_answer;
        } else {
            // جدولي الأركيد يخزنان الخيارات في حقول منفصلة
            opts = [rawQ.option_a, rawQ.option_b, rawQ.option_c, rawQ.option_d].filter(Boolean);
            
            // تحديد الإجابة الصحيحة
            if (rawQ.correct_index !== undefined && rawQ.correct_index !== null) {
                correctAns = opts[rawQ.correct_index];
            } else {
                // إذا كانت الإجابة محفوظة كـ a,b,c,d
                const correctLetter = String(rawQ.correct_option || rawQ.correct_answer || '').trim().toLowerCase();
                if (['a', 'b', 'c', 'd'].includes(correctLetter)) {
                    correctAns = rawQ[`option_${correctLetter}`];
                } else {
                    correctAns = correctLetter;
                }
            }
        }

        return {
            id: rawQ.id,
            questionText,
            options: opts, // هنا تأكدنا أن الخيارات أصبحت مصفوفة نظيفة جاهزة للعرض
            correctAnswer: String(correctAns).trim().toLowerCase()
        };
    };

    // --- Play Logic ---
    const getMyPlayerInfo = () => ({
        id: employee.employee_id,
        name: useAlias ? selectedAlias.name : employee.name.split(' ')[0],
        avatar: useAlias ? selectedAlias.emoji : (employee.photo_url || '👤'),
        isAlias: useAlias
    });

    const handleCreateMatch = async () => {
        setLoading(true);
        const player = { ...getMyPlayerInfo(), symbol: 'X' }; 
        const { data, error } = await supabase.from('live_matches').insert({
            game_type: 'xo', status: 'waiting', players: [player],
            game_state: { board: Array(9).fill(null), current_turn: player.id },
            created_by: employee.employee_id
        }).select().single();

        setLoading(false);
        if (error) return toast.error('حدث خطأ أثناء الإنشاء');
        setCurrentMatch(data); setView('playing');
    };

    const handleJoinMatch = async () => {
        if (!joiningMatchId) return;
        setLoading(true);
        const { data: match } = await supabase.from('live_matches').select('*').eq('id', joiningMatchId).single();
        if (!match || match.status !== 'waiting') { setLoading(false); return toast.error('هذه الغرفة لم تعد متاحة!'); }

        const player = { ...getMyPlayerInfo(), symbol: 'O' }; 
        const { data: updatedMatch, error } = await supabase.from('live_matches').update({
            players: [...match.players, player], status: 'playing' 
        }).eq('id', joiningMatchId).select().single();

        setLoading(false);
        if (error) return toast.error('فشل الانضمام للغرفة');
        setCurrentMatch(updatedMatch); setView('playing');
    };

    const handleDeleteMatch = async (matchId: string) => {
        setLoading(true);
        const { error } = await supabase.from('live_matches').delete().eq('id', matchId);
        setLoading(false);
        if (error) { toast.error('حدث خطأ أثناء الحذف'); } 
        else { toast.success('تم حذف الغرفة بنجاح'); if (currentMatch?.id === matchId) { setCurrentMatch(null); setView('lobby'); } }
    };

    const checkWinner = (board: string[]) => {
        const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
        for (let [a, b, c] of lines) { if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a]; }
        if (!board.includes(null)) return 'draw';
        return null;
    };

    const handleCellClick = async (index: number) => {
        if (!currentMatch || currentMatch.status !== 'playing') return;
        const state = currentMatch.game_state;
        const myPlayer = currentMatch.players.find((p: any) => p.id === employee.employee_id);
        
        if (state.current_turn !== employee.employee_id) return toast.error('ليس دورك!');
        if (state.board[index] !== null) return;

        const newBoard = [...state.board]; newBoard[index] = myPlayer.symbol;
        const winnerSymbol = checkWinner(newBoard);
        const opponent = currentMatch.players.find((p: any) => p.id !== employee.employee_id);
        
        let newStatus = 'playing'; let winnerId = null;

        if (winnerSymbol === 'draw') {
            newStatus = 'sudden_death'; 
            await prepareSuddenDeathQuestion(currentMatch.id, newBoard, opponent.id);
            return;
        } else if (winnerSymbol) {
            newStatus = 'reward_time';
            winnerId = winnerSymbol === myPlayer.symbol ? myPlayer.id : opponent.id;
        }

        await supabase.from('live_matches').update({
            game_state: { board: newBoard, current_turn: opponent.id }, status: newStatus, winner_id: winnerId
        }).eq('id', currentMatch.id);
    };

    const prepareSuddenDeathQuestion = async (matchId: string, board: string[], nextTurn: string) => {
        const randomQ = await fetchUnifiedQuestion(); 
        await supabase.from('live_matches').update({
            game_state: { board, current_turn: nextTurn }, status: 'sudden_death', final_question: randomQ
        }).eq('id', matchId);
    };

    const handleSuddenDeathAnswer = async (answerText: string) => {
        if (currentMatch.status !== 'sudden_death') return;
        setLoading(true); setTimeLeft(null);

        const isCorrect = answerText.trim().toLowerCase() === currentMatch.final_question?.correctAnswer;
        
        if (isCorrect) {
            const onCooldown = await checkCooldown();
            if (onCooldown) {
                toast.success('أنت الأسرع! لم تضف نقاط لوجودك في فترة الانتظار (ساعة واحدة).', { icon: '🤝' });
            } else {
                await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: 5 });
                await supabase.from('points_ledger').insert({ employee_id: employee.employee_id, points: 5, reason: 'كسر التعادل المباشر ⚡' });
                toast.success('أنت الأسرع! كسبت التحدي و 5 نقاط ⚡🏆');
            }
            await supabase.from('live_matches').update({ status: 'finished', winner_id: employee.employee_id }).eq('id', currentMatch.id);
            confetti({ particleCount: 150, spread: 80, zIndex: 9999 });
        } else {
            toast.error('إجابة خاطئة! خصمك قد يفوز الآن.');
        }
        setLoading(false);
    };

    const handleRewardSelection = async (difficulty: 'easy'|'medium'|'hard', points: number, timeLimit: number) => {
        setLoading(true);
        const randomQ = await fetchUnifiedQuestion(difficulty);
        if (!randomQ) {
            setLoading(false);
            return toast.error("لا توجد أسئلة بهذه الصعوبة حالياً.");
        }
        await supabase.from('live_matches').update({
            status: 'answering_reward', final_question: { ...randomQ, rewardPoints: points, timeLimit }
        }).eq('id', currentMatch.id);
        setLoading(false);
    };

    const handleRewardAnswer = async (answerText: string) => {
        setLoading(true); setTimeLeft(null);
        const isCorrect = answerText.trim().toLowerCase() === currentMatch.final_question?.correctAnswer;
        const rewardPoints = currentMatch.final_question?.rewardPoints || 0;

        if (isCorrect) {
            const onCooldown = await checkCooldown();
            if (onCooldown) {
                toast.success('إجابة صحيحة! لم تضف النقاط لأنك ربحت مؤخراً (يسمح بالنقاط مرة كل ساعة).', { icon: '🎮', duration: 6000 });
            } else {
                await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: rewardPoints });
                await supabase.from('points_ledger').insert({ employee_id: employee.employee_id, points: rewardPoints, reason: `سؤال جائزة التحدي المباشر 🏆` });
                toast.success(`مبروك! ربحت ${rewardPoints} نقطة! 🎉`, { style: { background: '#22c55e', color: '#fff' }});
                confetti({ particleCount: 200, spread: 100, zIndex: 9999 });
            }
        } else {
            toast.error('إجابة خاطئة أو انتهى الوقت! للأسف ضاعت الجائزة 😞');
        }

        await supabase.from('live_matches').update({ status: 'finished' }).eq('id', currentMatch.id);
        setLoading(false);
    };

    const exitMatch = () => { setCurrentMatch(null); setView('lobby'); setJoiningMatchId(null); setTimeLeft(null); };

    const amIWinner = currentMatch?.winner_id === employee.employee_id;
    const opponent = currentMatch?.players?.find((p: any) => p.id !== employee.employee_id);
    const me = currentMatch?.players?.find((p: any) => p.id === employee.employee_id);

    return (
        <div className="bg-gray-100 min-h-[100dvh] md:min-h-[80vh] md:rounded-[2rem] overflow-hidden flex flex-col relative font-sans text-right" dir="rtl">
            {/* Header */}
            <div className="bg-gradient-to-l from-indigo-900 via-purple-900 to-indigo-900 p-3 md:p-4 text-white flex justify-between items-center shrink-0 shadow-md z-10">
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="bg-white/20 p-1.5 md:p-2 rounded-xl backdrop-blur-sm"><Gamepad2 className="text-yellow-400 animate-pulse w-5 h-5 md:w-6 md:h-6"/></div>
                    <div><h2 className="font-black text-base md:text-lg">صالة الألعاب المباشرة</h2><p className="text-[9px] md:text-[10px] text-indigo-200 font-bold">Live Multiplayer Arena</p></div>
                </div>
                {onClose && <button onClick={onClose} className="p-1.5 md:p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><X className="w-5 h-5 md:w-6 md:h-6"/></button>}
            </div>

            {view === 'lobby' && (
                <div className="p-3 md:p-6 flex-1 overflow-y-auto space-y-4 md:space-y-6">
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl md:rounded-3xl p-5 md:p-6 text-white text-center shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-24 h-24 md:w-32 md:h-32 bg-white/10 rounded-full blur-2xl md:blur-3xl -ml-6 -mt-6"></div>
                        <h3 className="text-lg md:text-xl font-black mb-1 md:mb-2 relative z-10">تحدى زملائك الآن! 🔥</h3>
                        <p className="text-[10px] md:text-xs text-indigo-100 mb-4 md:mb-6 relative z-10">العب، اكسب، وتصدر لوحة الشرف (النقاط متاحة مرة كل ساعة).</p>
                        <button onClick={() => { setJoiningMatchId(null); setView('identity_setup'); }} className="bg-yellow-400 text-indigo-900 px-6 py-2.5 md:px-8 md:py-3 rounded-xl md:rounded-2xl font-black text-sm md:text-base shadow-lg hover:scale-105 active:scale-95 transition-all w-full md:w-auto relative z-10">إنشاء تحدي جديد ⚔️</button>
                    </div>

                    <div>
                        <h4 className="font-black text-gray-800 text-sm md:text-base flex items-center gap-2 mb-3 md:mb-4"><Users className="text-purple-600 w-4 h-4 md:w-5 md:h-5"/> تحديات في انتظارك ({matches.length})</h4>
                        {matches.length === 0 ? (
                            <div className="text-center py-8 md:py-10 bg-white rounded-2xl md:rounded-3xl border border-dashed border-gray-300">
                                <Clock className="w-8 h-8 md:w-10 md:h-10 text-gray-300 mx-auto mb-2"/>
                                <p className="text-xs md:text-sm text-gray-500 font-bold">لا توجد غرف مفتوحة حالياً. كن أنت المبادر!</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                {matches.map((m: any) => {
                                    const isMyRoom = m.created_by === employee.employee_id;
                                    return (
                                        <div key={m.id} className={`bg-white p-3 md:p-4 rounded-2xl shadow-sm border flex justify-between items-center transition-colors ${isMyRoom ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-100 hover:border-indigo-300'}`}>
                                            <div className="flex items-center gap-2 md:gap-3">
                                                <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl shadow-inner border border-gray-100 overflow-hidden bg-gray-50 text-2xl"><AvatarDisplay avatar={m.players[0]?.avatar} /></div>
                                                <div>
                                                    <div className="flex items-center gap-1"><p className="font-black text-gray-800 text-xs md:text-sm truncate max-w-[100px] md:max-w-none">{m.players[0]?.name}</p>{isMyRoom && <span className="bg-indigo-100 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded-md">غرفتك</span>}</div>
                                                    <p className="text-[9px] md:text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md inline-block mt-1">لعبة XO</p>
                                                </div>
                                            </div>
                                            {isMyRoom ? (
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <button onClick={() => handleDeleteMatch(m.id)} className="bg-red-50 text-red-600 hover:bg-red-500 hover:text-white p-2 rounded-xl transition-colors shadow-sm"><Trash2 size={14}/></button>
                                                    <button onClick={() => { setCurrentMatch(m); setView('playing'); }} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl font-bold text-[10px] md:text-xs transition-all shadow-sm">دخول</button>
                                                </div>
                                            ) : (
                                                <button onClick={() => { setJoiningMatchId(m.id); setView('identity_setup'); }} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl font-bold text-[10px] md:text-xs transition-all shadow-sm shrink-0">انضمام</button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {view === 'identity_setup' && (
                <div className="p-4 md:p-6 flex-1 flex flex-col items-center justify-center animate-in zoom-in-95">
                    <div className="bg-white p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] shadow-xl border border-gray-100 w-full max-w-md text-center">
                        <UserX className="w-10 h-10 md:w-12 md:h-12 text-indigo-500 mx-auto mb-3 md:mb-4"/>
                        <h3 className="text-lg md:text-xl font-black text-gray-800 mb-1 md:mb-2">كيف تريد أن تظهر؟</h3>
                        <p className="text-[10px] md:text-xs text-gray-500 font-bold mb-4 md:mb-6">العب باسمك الحقيقي أو ادخل بهوية سرية للحماس!</p>

                        <div className="flex bg-gray-100 p-1 rounded-2xl mb-4 md:mb-6">
                            <button onClick={() => setUseAlias(false)} className={`flex-1 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${!useAlias ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>صورتي واسمي</button>
                            <button onClick={() => setUseAlias(true)} className={`flex-1 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${useAlias ? 'bg-indigo-600 shadow text-white' : 'text-gray-500'}`}>هوية مخفية 🥷</button>
                        </div>

                        {useAlias && (
                            <div className="grid grid-cols-2 gap-2 mb-4 md:mb-6 max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                                {ALIASES.map(alias => (
                                    <button key={alias.name} onClick={() => setSelectedAlias(alias)} className={`p-2 rounded-xl border-2 text-[10px] md:text-xs font-bold flex items-center justify-center gap-1.5 md:gap-2 transition-all ${selectedAlias.name === alias.name ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-100 text-gray-600 bg-white hover:bg-gray-50'}`}><span className="text-base">{alias.emoji}</span> <span>{alias.name}</span></button>
                                ))}
                            </div>
                        )}
                        <button onClick={joiningMatchId ? handleJoinMatch : handleCreateMatch} disabled={loading} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-sm md:text-lg shadow-lg shadow-indigo-200 hover:scale-[1.02] active:scale-95 transition-all flex justify-center items-center gap-2">{loading ? <Loader2 className="animate-spin w-5 h-5"/> : <><Play className="w-4 h-4 md:w-5 md:h-5" fill="currentColor"/> {joiningMatchId ? 'دخول الغرفة' : 'إنشاء الغرفة'}</>}</button>
                        <button onClick={() => setView('lobby')} className="mt-3 md:mt-4 text-xs md:text-sm font-bold text-gray-400 hover:text-gray-600">إلغاء والعودة</button>
                    </div>
                </div>
            )}

            {view === 'playing' && currentMatch && (
                <div className="flex-1 flex flex-col bg-gray-50 animate-in fade-in">
                    <div className="bg-white border-b px-3 py-2 md:px-4 md:py-3 flex justify-between items-center shadow-sm relative z-10">
                        <div className={`flex items-center gap-2 px-2 py-1.5 md:px-3 md:py-1.5 rounded-xl border-2 transition-colors ${currentMatch.game_state.current_turn === me?.id ? 'border-green-400 bg-green-50 shadow-sm' : 'border-transparent opacity-60'}`}>
                            <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-lg shadow-sm border overflow-hidden bg-white text-xl"><AvatarDisplay avatar={me?.avatar} /></div>
                            <div><p className="text-[10px] md:text-xs font-black text-gray-800">أنت ({me?.symbol})</p>{currentMatch.game_state.current_turn === me?.id && <span className="text-[8px] md:text-[9px] font-bold text-green-600 animate-pulse block">دورك الآن</span>}</div>
                        </div>
                        <div className="font-black text-gray-300 text-base md:text-lg">VS</div>
                        <div className={`flex items-center gap-2 px-2 py-1.5 md:px-3 md:py-1.5 rounded-xl border-2 transition-colors flex-row-reverse ${currentMatch.game_state.current_turn === opponent?.id ? 'border-red-400 bg-red-50 shadow-sm' : 'border-transparent opacity-60'}`}>
                            <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-lg shadow-sm border overflow-hidden bg-white text-xl">{opponent ? <AvatarDisplay avatar={opponent.avatar} /> : '⏳'}</div>
                            <div className="text-left"><p className="text-[10px] md:text-xs font-black text-gray-800 truncate max-w-[70px] md:max-w-none">{opponent?.name || 'في الانتظار...'} {opponent ? `(${opponent.symbol})` : ''}</p>{currentMatch.game_state.current_turn === opponent?.id && <span className="text-[8px] md:text-[9px] font-bold text-red-600 animate-pulse block">يفكر...</span>}</div>
                        </div>
                    </div>

                    <div className="flex-1 flex items-center justify-center p-2 md:p-4">
                        {currentMatch.status === 'waiting' ? (
                            <div className="text-center animate-pulse p-4">
                                <Loader2 className="w-10 h-10 md:w-12 md:h-12 text-indigo-300 animate-spin mx-auto mb-3 md:mb-4"/>
                                <h3 className="font-black text-indigo-900 text-base md:text-lg">في انتظار انضمام المنافس...</h3>
                                <p className="text-[10px] md:text-xs text-gray-500 font-bold mt-1 md:mt-2 mb-4 md:mb-6">العب وتحدى زملائك الأونلاين الآن</p>
                                {currentMatch.created_by === employee.employee_id && (
                                    <button onClick={() => handleDeleteMatch(currentMatch.id)} className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-100 flex items-center gap-2 mx-auto transition-colors"><Trash2 size={14}/> إلغاء وحذف الغرفة</button>
                                )}
                            </div>
                        ) : currentMatch.status === 'playing' ? (
                            <div className="grid grid-cols-3 gap-2 md:gap-3 bg-indigo-100 p-2 md:p-3 rounded-3xl shadow-inner max-w-[280px] md:max-w-[350px] w-full">
                                {currentMatch.game_state.board.map((cell: string, idx: number) => (
                                    <button key={idx} onClick={() => handleCellClick(idx)} disabled={cell !== null || currentMatch.game_state.current_turn !== employee.employee_id} className={`aspect-square bg-white rounded-2xl shadow-sm text-4xl md:text-6xl font-black flex items-center justify-center transition-all ${!cell && currentMatch.game_state.current_turn === employee.employee_id ? 'hover:bg-indigo-50 active:scale-95 cursor-pointer' : ''} ${cell === 'X' ? 'text-indigo-600' : 'text-rose-500'}`}>{cell && <span className="animate-in zoom-in spin-in-12">{cell}</span>}</button>
                                ))}
                            </div>
                        ) : currentMatch.status === 'sudden_death' ? (
                            <div className="bg-white w-full max-w-md rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-6 text-center shadow-2xl border-4 border-yellow-400 animate-in zoom-in m-4 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-yellow-400 to-red-500 animate-pulse"></div>
                                <Zap className="w-12 h-12 md:w-16 md:h-16 text-yellow-500 mx-auto mb-2 animate-bounce drop-shadow-md"/>
                                <h3 className="text-xl md:text-2xl font-black text-gray-800 mb-1">تعادل! الموت المفاجئ ⚡</h3>
                                
                                <div className="flex items-center justify-center gap-2 mb-4 bg-red-50 text-red-600 w-max mx-auto px-4 py-1.5 rounded-full font-black text-lg">
                                    <Timer size={20} className={timeLeft && timeLeft <= 5 ? "animate-pulse" : ""} />
                                    <span>{timeLeft} ثانية</span>
                                </div>

                                {currentMatch.final_question ? (
                                    <div className="space-y-3 md:space-y-4">
                                        <p className="font-black text-sm md:text-lg bg-gray-50 p-3 md:p-4 rounded-xl border leading-relaxed shadow-inner">{currentMatch.final_question.questionText}</p>
                                        <div className="grid grid-cols-1 gap-2">
                                            {currentMatch.final_question.options.map((optText: string, idx: number) => (
                                                <button key={idx} onClick={() => handleSuddenDeathAnswer(optText)} disabled={loading} className="w-full bg-white border-2 border-gray-100 p-2.5 md:p-3 rounded-xl font-bold text-xs md:text-sm text-gray-700 hover:border-yellow-400 hover:bg-yellow-50 active:scale-95 transition-all shadow-sm">
                                                    {optText}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : <Loader2 className="mx-auto animate-spin text-yellow-500 w-8 h-8"/>}
                            </div>
                        ) : currentMatch.status === 'reward_time' ? (
                            <div className="bg-white w-full max-w-md rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-6 text-center shadow-2xl animate-in zoom-in m-4">
                                {amIWinner ? (
                                    <>
                                        <Trophy className="w-16 h-16 md:w-20 md:h-20 text-yellow-400 mx-auto mb-3 md:mb-4 drop-shadow-lg animate-pulse"/>
                                        <h3 className="text-2xl md:text-3xl font-black text-gray-800 mb-2">أنت الفائز! 🎉</h3>
                                        <p className="text-xs md:text-sm font-bold text-gray-500 mb-4 md:mb-6">اختر مستوى الصعوبة لسؤال الجائزة لتكسب النقاط:</p>
                                        <div className="space-y-2.5 md:space-y-3">
                                            <button onClick={() => handleRewardSelection('easy', 5, 10)} disabled={loading} className="w-full bg-green-50 border border-green-200 text-green-700 p-3 md:p-4 rounded-xl md:rounded-2xl font-black text-sm md:text-base flex justify-between items-center hover:bg-green-100 active:scale-95 transition-all"><span>سهل (10 ثوانٍ)</span> <span>+5 نقاط</span></button>
                                            <button onClick={() => handleRewardSelection('medium', 10, 20)} disabled={loading} className="w-full bg-yellow-50 border border-yellow-200 text-yellow-700 p-3 md:p-4 rounded-xl md:rounded-2xl font-black text-sm md:text-base flex justify-between items-center hover:bg-yellow-100 active:scale-95 transition-all"><span>متوسط (20 ثانية)</span> <span>+10 نقاط</span></button>
                                            <button onClick={() => handleRewardSelection('hard', 15, 30)} disabled={loading} className="w-full bg-red-50 border border-red-200 text-red-700 p-3 md:p-4 rounded-xl md:rounded-2xl font-black text-sm md:text-base flex justify-between items-center hover:bg-red-100 active:scale-95 transition-all"><span>صعب (30 ثانية)</span> <span>+15 نقطة</span></button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-8 md:py-10">
                                        <span className="text-5xl md:text-6xl mb-3 md:mb-4 block animate-bounce">😞</span>
                                        <h3 className="text-lg md:text-xl font-black text-gray-800">لقد خسرت الجولة</h3>
                                        <p className="text-[10px] md:text-sm font-bold text-gray-500 mt-2">خصمك يقوم الآن باختيار سؤال الجائزة.</p>
                                        <button onClick={exitMatch} className="mt-6 md:mt-8 bg-gray-100 hover:bg-gray-200 px-5 py-2 md:px-6 md:py-2 rounded-xl text-sm font-bold text-gray-600 transition-colors">خروج للرئيسية</button>
                                    </div>
                                )}
                            </div>
                        ) : currentMatch.status === 'answering_reward' ? (
                            <div className="bg-white w-full max-w-md rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-6 text-center shadow-2xl animate-in zoom-in m-4">
                                {amIWinner ? (
                                    <>
                                        <div className="flex justify-between items-center mb-4">
                                            <BrainCircuit className="w-10 h-10 text-indigo-500"/>
                                            <div className={`flex items-center gap-1 px-3 py-1 rounded-full font-black text-lg ${timeLeft && timeLeft <= 5 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-700'}`}>
                                                <Timer size={18}/> {timeLeft}
                                            </div>
                                        </div>
                                        <h3 className="text-lg md:text-xl font-black text-gray-800 mb-1">سؤال الجائزة 🎁</h3>
                                        <p className="text-[10px] md:text-xs font-bold text-yellow-600 mb-4 md:mb-6 bg-yellow-50 inline-block px-3 py-1 rounded-full border border-yellow-100">أجب لتربح {currentMatch.final_question?.rewardPoints} نقطة!</p>
                                        
                                        <p className="font-black text-sm md:text-lg bg-gray-50 p-3 md:p-4 rounded-xl border mb-4 md:mb-6 leading-relaxed shadow-inner">{currentMatch.final_question?.questionText}</p>
                                        
                                        <div className="grid grid-cols-1 gap-2">
                                            {currentMatch.final_question?.options.map((optText: string, idx: number) => (
                                                <button key={idx} onClick={() => handleRewardAnswer(optText)} disabled={loading} className="w-full bg-white border-2 border-gray-100 p-2.5 md:p-3 rounded-xl font-bold text-xs md:text-sm text-gray-700 hover:border-indigo-400 hover:bg-indigo-50 active:scale-95 transition-all shadow-sm">
                                                    {optText}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-8 md:py-10">
                                        <Loader2 className="w-10 h-10 md:w-12 md:h-12 text-indigo-300 animate-spin mx-auto mb-3 md:mb-4"/>
                                        <h3 className="text-base md:text-lg font-black text-gray-800">جاري الإجابة...</h3>
                                        <p className="text-[10px] md:text-xs font-bold text-gray-500 mt-2">الفائز يحاول الإجابة على سؤال الجائزة.</p>
                                        <button onClick={exitMatch} className="mt-6 md:mt-8 bg-gray-100 hover:bg-gray-200 px-5 py-2 md:px-6 md:py-2 rounded-xl font-bold text-sm text-gray-600 transition-colors">خروج للرئيسية</button>
                                    </div>
                                )}
                            </div>
                        ) : currentMatch.status === 'finished' ? (
                            <div className="bg-white w-full max-w-sm rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-8 text-center shadow-2xl animate-in zoom-in m-4">
                                <CheckCircle2 className="w-16 h-16 md:w-20 md:h-20 text-green-500 mx-auto mb-3 md:mb-4"/>
                                <h3 className="text-xl md:text-2xl font-black text-gray-800 mb-2">انتهت اللعبة!</h3>
                                <button onClick={exitMatch} className="mt-4 md:mt-6 bg-indigo-600 text-white w-full py-2.5 md:py-3 rounded-xl font-black text-sm md:text-base hover:bg-indigo-700 active:scale-95 transition-all shadow-lg">العودة للصالة</button>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
}
