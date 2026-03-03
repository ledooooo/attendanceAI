import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Employee } from '../../types';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { 
    Gamepad2, Swords, UserX, Trophy, Users, Clock, 
    Play, X, CheckCircle2, Zap, BrainCircuit, Loader2, Trash2, Timer, Hand
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
    if (s.includes('سنان') || s.includes('أسنان')) return ['أسنان', 'اسنان', 'طبيب أسنان', 'فنى اسنان'];
    if (s.includes('تمريض') || s.includes('ممرض')) return ['تمريض', 'ممرض', 'ممرضة', 'اخصائى تمريض'];
    if (s.includes('صيدل')) return ['صيدلة', 'صيدلي', 'صيدلاني'];
    if (s.includes('معمل') || s.includes('مختبر') || s.includes('كيميائي')) return ['معمل', 'فني معمل', 'مختبر', 'كيميائي'];
    if (s.includes('جود')) return ['جودة', 'الجودة'];
    if (s.includes('عدوى') || s.includes('مراقب')) return ['مكافحة عدوى', 'مكافحه عدوى', 'مراقب'];
    if (s.includes('رائد')) return ['رائدة ريفية'];
    if (s.includes('ملفات') || s.includes('احصاء') || s.includes('كاتب') || s.includes('ادارى')) return ['مسئول ملفات', 'فنى احصاء', 'كاتب', 'ادارى'];
    if (s.includes('علاج طبيعي')) return ['علاج طبيعي', 'علاج طبيعى'];
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
    const [autoDeleteTimeLeft, setAutoDeleteTimeLeft] = useState<number | null>(null); // عداد تنازلي للحذف
    const autoDeleteTimerRef = useRef<NodeJS.Timeout | null>(null);

    // --- Auto Delete Logic (Visual + Functional) ---
    useEffect(() => {
        if (currentMatch && currentMatch.status === 'waiting' && currentMatch.created_by === employee.employee_id) {
            const createdAt = new Date(currentMatch.created_at).getTime();
            const now = Date.now();
            const elapsed = now - createdAt;
            const totalWaitTime = 3 * 60 * 1000; // 3 دقائق
            const remaining = Math.max(0, totalWaitTime - elapsed);

            // ضبط العداد البصري
            setAutoDeleteTimeLeft(Math.floor(remaining / 1000));

            // تشغيل الحذف التلقائي
            if (autoDeleteTimerRef.current) clearTimeout(autoDeleteTimerRef.current);
            autoDeleteTimerRef.current = setTimeout(() => {
                handleDeleteMatch(currentMatch.id, true);
            }, remaining);

        } else {
            if (autoDeleteTimerRef.current) {
                clearTimeout(autoDeleteTimerRef.current);
                autoDeleteTimerRef.current = null;
            }
            setAutoDeleteTimeLeft(null);
        }

        return () => {
            if (autoDeleteTimerRef.current) clearTimeout(autoDeleteTimerRef.current);
        };
    }, [currentMatch]);

    // تحديث العداد البصري للحذف كل ثانية
    useEffect(() => {
        if (!autoDeleteTimeLeft || autoDeleteTimeLeft <= 0) return;
        const interval = setInterval(() => {
            setAutoDeleteTimeLeft(prev => (prev && prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, [autoDeleteTimeLeft]);


    // --- Timer Logic (Game & Questions) ---
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
                    setCurrentMatch(prev => {
                        if (prev?.id === payload.old.id) return null;
                        return prev;
                    });
                    if (currentMatch?.id === payload.old.id) {
                        setView('lobby');
                        toast('تم إغلاق الغرفة', { icon: '🚪' });
                    }
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
                            toast.success('انضم منافس! اللعبة بدأت 🎮', { icon: '🔥', duration: 4000 });
                            const audio = new Audio('/notification.mp3'); 
                            audio.play().catch(e => console.log('Audio play failed', e));
                        }
                        if (updatedMatch.status === 'answering_reward' && prev.status !== 'answering_reward' && updatedMatch.winner_id === employee.employee_id) {
                            setTimeLeft(updatedMatch.final_question?.timeLimit || 15);
                        }
                        return updatedMatch;
                    }
                    return prev;
                });
            }).subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [employee.employee_id, currentMatch?.id]);

    const fetchWaitingMatches = async () => {
        // تنظيف الغرف القديمة جداً المعلقة (أكثر من 5 دقائق)
        const now = new Date();
        const cutoff = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
        
        // محاولة تنظيف الغرف القديمة (سيعمل فقط إذا كانت السياسات تسمح)
        await supabase.from('live_matches').delete().eq('status', 'waiting').lt('created_at', cutoff);
        
        const { data } = await supabase.from('live_matches').select('*').eq('status', 'waiting').order('created_at', { ascending: false });
        if (data) setMatches(data);
    };

    // --- Question Fetching & Logic ---
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

    const normalizeQuestionFormat = (rawQ: any) => {
        let questionText = rawQ.question || rawQ.question_text || '';
        if (rawQ.scenario) questionText = `${rawQ.scenario} - ${questionText}`; 

        let opts: string[] = [];
        let correctAns = '';

        if (rawQ.source === 'standard_quiz') {
            try { 
                let parsed = rawQ.options;
                if (typeof parsed === 'string') {
                    if (parsed.startsWith('"') && parsed.endsWith('"')) parsed = JSON.parse(parsed);
                    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
                }
                opts = Array.isArray(parsed) ? parsed : [];
            } catch (e) { 
                console.error("Error parsing standard quiz options:", rawQ.options);
                opts = []; 
            }
            correctAns = rawQ.correct_answer;
        } else {
            opts = [rawQ.option_a, rawQ.option_b, rawQ.option_c, rawQ.option_d].filter(opt => opt && String(opt).trim() !== '' && opt !== 'null');
            
            if (rawQ.correct_index !== undefined && rawQ.correct_index !== null) {
                correctAns = opts[rawQ.correct_index];
            } else {
                const correctLetter = String(rawQ.correct_option || rawQ.correct_answer || '').trim().toLowerCase();
                if (['a', 'b', 'c', 'd'].includes(correctLetter)) {
                    correctAns = rawQ[`option_${correctLetter}`];
                } else {
                    correctAns = correctLetter;
                }
            }
        }

        if (!correctAns || opts.length < 2) return null; 

        return {
            id: rawQ.id,
            questionText,
            options: opts, 
            correctAnswer: String(correctAns).trim().toLowerCase()
        };
    };

    const fetchUnifiedQuestion = async (difficulty?: string) => {
        const variations = getSpecialtyVariations(employee.specialty);
        const orFilter = variations.map(v => `specialty.ilike.%${v}%`).join(',');

        let questionsPool: any[] = [];

        const [res1, res2, res3] = await Promise.all([
            supabase.from('arcade_quiz_questions').select('*').or(orFilter),
            supabase.from('arcade_dose_scenarios').select('*').or(orFilter),
            supabase.from('quiz_questions').select('*').or(orFilter)
        ]);

        if (res1.data) questionsPool.push(...res1.data.map(q => ({ ...q, source: 'arcade_quiz' })));
        if (res2.data) questionsPool.push(...res2.data.map(q => ({ ...q, source: 'arcade_dose' })));
        if (res3.data) questionsPool.push(...res3.data.map(q => ({ ...q, source: 'standard_quiz' })));

        if (questionsPool.length === 0) {
            const { data: anyData } = await supabase.from('arcade_quiz_questions').select('*').limit(30);
            if (anyData) questionsPool = anyData.map(q => ({ ...q, source: 'arcade_quiz' }));
        }

        if (difficulty) {
            const diffPool = questionsPool.filter(q => q.difficulty === difficulty || (q.source === 'standard_quiz' && difficulty === 'medium')); 
            if (diffPool.length > 0) questionsPool = diffPool;
        }

        if (questionsPool.length === 0) return null;

        for (let i = 0; i < 5; i++) { 
            const randomRaw = questionsPool[Math.floor(Math.random() * questionsPool.length)];
            const normalized = normalizeQuestionFormat(randomRaw);
            if (normalized) return normalized;
        }

        return null;
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
        if (error) return toast.error('خطأ في الإنشاء');
        setCurrentMatch(data); setView('playing');
    };

    const handleJoinMatch = async () => {
        if (!joiningMatchId) return;
        setLoading(true);
        const { data: match } = await supabase.from('live_matches').select('*').eq('id', joiningMatchId).single();
        if (!match || match.status !== 'waiting') { setLoading(false); return toast.error('الغرفة غير متاحة'); }

        const player = { ...getMyPlayerInfo(), symbol: 'O' }; 
        const { data: updatedMatch, error } = await supabase.from('live_matches').update({
            players: [...match.players, player], status: 'playing' 
        }).eq('id', joiningMatchId).select().single();

        setLoading(false);
        if (error) return toast.error('فشل الانضمام');
        setCurrentMatch(updatedMatch); setView('playing');
    };

    // ✅ دالة الحذف القوية
    const handleDeleteMatch = async (matchId: string, isAuto = false) => {
        if (!isAuto) setLoading(true); 
        
        try {
            // محاولة الحذف
            const { error } = await supabase.from('live_matches').delete().eq('id', matchId);
            
            if (error) throw error; // إذا فشل الحذف سيرمي خطأ

            if (isAuto) {
                toast('تم إغلاق الغرفة لعدم انضمام أحد (3 دقائق)', { icon: '⏳' });
            } else {
                toast.success('تم حذف الغرفة نهائياً');
            }
            
            // تنظيف الحالة المحلية فوراً
            if (currentMatch?.id === matchId) {
                setCurrentMatch(null);
                setView('lobby');
            }
            // تحديث القائمة فوراً
            setMatches(prev => prev.filter(m => m.id !== matchId));

        } catch (err) {
            console.error("Delete error:", err);
            // في حال فشل الحذف بسبب السياسات، نقوم بإخفائها من الواجهة على الأقل
            if (!isAuto) {
                toast.error('لم يتم الحذف من السيرفر، لكن تم إخفاؤها.');
                setMatches(prev => prev.filter(m => m.id !== matchId));
                if (currentMatch?.id === matchId) {
                    setCurrentMatch(null);
                    setView('lobby');
                }
            }
        } finally {
            if (!isAuto) setLoading(false);
        }
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
            newStatus = 'finished';
            winnerId = null; 
        } else if (winnerSymbol) {
            newStatus = 'reward_time';
            winnerId = winnerSymbol === myPlayer.symbol ? myPlayer.id : opponent.id;
        }

        await supabase.from('live_matches').update({
            game_state: { board: newBoard, current_turn: opponent.id }, status: newStatus, winner_id: winnerId
        }).eq('id', currentMatch.id);
    };

    const handleRewardSelection = async (difficulty: 'easy'|'medium'|'hard', points: number, timeLimit: number) => {
        setLoading(true);
        const randomQ = await fetchUnifiedQuestion(difficulty);
        
        if (!randomQ) {
            setLoading(false);
            toast.success(`لعدم توفر أسئلة، ربحت ${points} نقطة مباشرة!`);
            await grantPoints(points);
            await supabase.from('live_matches').update({ status: 'finished' }).eq('id', currentMatch.id);
            return;
        }

        await supabase.from('live_matches').update({
            status: 'answering_reward', final_question: { ...randomQ, rewardPoints: points, timeLimit }
        }).eq('id', currentMatch.id);
        setLoading(false);
    };

    const grantPoints = async (points: number) => {
        const onCooldown = await checkCooldown();
        if (onCooldown) {
            toast.success('فوز رائع! (النقاط تضاف مرة كل ساعة)', { icon: '🎮' });
        } else {
            await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: points });
            await supabase.from('points_ledger').insert({ employee_id: employee.employee_id, points: points, reason: `فوز في التحدي المباشر 🏆` });
            toast.success(`مبروك! تمت إضافة ${points} نقطة لرصيدك! 🎉`, { style: { background: '#22c55e', color: '#fff' }});
            confetti({ particleCount: 200, spread: 100, zIndex: 9999 });
        }
    };

    const handleRewardAnswer = async (answerText: string) => {
        setLoading(true); setTimeLeft(null);
        
        const correct = currentMatch.final_question?.correctAnswer || '';
        const selected = answerText.trim().toLowerCase();
        const isCorrect = correct === selected || correct.includes(selected) || selected.includes(correct); 
        const rewardPoints = currentMatch.final_question?.rewardPoints || 0;

        if (isCorrect) {
            await grantPoints(rewardPoints);
        } else {
            toast.error(answerText === 'TIMEOUT_WRONG_ANSWER' ? 'انتهى الوقت!' : 'إجابة خاطئة! حظ أوفر');
        }

        await supabase.from('live_matches').update({ status: 'finished' }).eq('id', currentMatch.id);
        setLoading(false);
    };

    const exitMatch = () => { setCurrentMatch(null); setView('lobby'); setJoiningMatchId(null); setTimeLeft(null); };

    const amIWinner = currentMatch?.winner_id === employee.employee_id;
    const opponent = currentMatch?.players?.find((p: any) => p.id !== employee.employee_id);
    const me = currentMatch?.players?.find((p: any) => p.id === employee.employee_id);

    return (
        <div className="bg-gray-50 h-full flex flex-col relative font-sans text-right overflow-hidden" dir="rtl">
            
            {onClose && (
                <button onClick={onClose} className="absolute top-4 left-4 z-50 p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors text-gray-700">
                    <X className="w-6 h-6"/>
                </button>
            )}

            {/* --- View: LOBBY --- */}
            {view === 'lobby' && (
                <div className="p-4 flex-1 overflow-y-auto space-y-6 pt-12">
                    <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl p-6 text-white text-center shadow-lg relative overflow-hidden mx-auto max-w-md">
                        <h3 className="text-2xl font-black mb-2">تحدى زملائك الآن! 🔥</h3>
                        <p className="text-indigo-100 text-sm mb-6">العب XO أونلاين، الفائز يحصل على سؤال ذهبي لربح النقاط.</p>
                        <button onClick={() => { setJoiningMatchId(null); setView('identity_setup'); }} className="bg-yellow-400 text-indigo-900 px-8 py-3 rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all w-full">
                            إنشاء تحدي جديد ⚔️
                        </button>
                    </div>

                    <div className="max-w-md mx-auto">
                        <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-500"/> غرف الانتظار ({matches.length})</h4>
                        {matches.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3"/>
                                <p className="text-gray-400 font-bold">لا توجد غرف.. كن الأول!</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {matches.map((m: any) => {
                                    const isMyRoom = m.created_by === employee.employee_id;
                                    return (
                                        <div key={m.id} className={`bg-white p-4 rounded-2xl shadow-sm border flex justify-between items-center ${isMyRoom ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-100'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl border border-gray-200">
                                                    <AvatarDisplay avatar={m.players[0]?.avatar} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-gray-800">{m.players[0]?.name}</p>
                                                        {isMyRoom && <span className="bg-indigo-100 text-indigo-600 text-[10px] font-black px-2 py-0.5 rounded-full">غرفتك</span>}
                                                    </div>
                                                    <p className="text-xs text-gray-400 font-bold mt-0.5">في انتظار منافس...</p>
                                                </div>
                                            </div>
                                            {isMyRoom ? (
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleDeleteMatch(m.id)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100"><Trash2 size={18}/></button>
                                                    <button onClick={() => { setCurrentMatch(m); setView('playing'); }} className="px-4 py-2 bg-indigo-100 text-indigo-600 rounded-xl font-bold text-sm">دخول</button>
                                                </div>
                                            ) : (
                                                <button onClick={() => { setJoiningMatchId(m.id); setView('identity_setup'); }} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700">انضمام</button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- View: IDENTITY --- */}
            {view === 'identity_setup' && (
                <div className="p-6 flex-1 flex flex-col items-center justify-center animate-in zoom-in-95 max-w-md mx-auto w-full">
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 w-full text-center">
                        <UserX className="w-16 h-16 text-indigo-500 mx-auto mb-4"/>
                        <h3 className="text-2xl font-black text-gray-800 mb-2">اختر هويتك</h3>
                        <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-6">
                            <button onClick={() => setUseAlias(false)} className={`flex-1 py-3 rounded-xl font-bold transition-all ${!useAlias ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>هويتي الحقيقية</button>
                            <button onClick={() => setUseAlias(true)} className={`flex-1 py-3 rounded-xl font-bold transition-all ${useAlias ? 'bg-indigo-600 shadow-sm text-white' : 'text-gray-500'}`}>هوية مستعارة 🥷</button>
                        </div>
                        {useAlias && (
                            <div className="grid grid-cols-2 gap-3 mb-6 max-h-[250px] overflow-y-auto p-1">
                                {ALIASES.map(alias => (
                                    <button key={alias.name} onClick={() => setSelectedAlias(alias)} className={`p-3 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition-all ${selectedAlias.name === alias.name ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-100 text-gray-600'}`}>
                                        <span>{alias.emoji}</span> <span className="text-xs">{alias.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        <button onClick={joiningMatchId ? handleJoinMatch : handleCreateMatch} disabled={loading} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-indigo-700 flex justify-center items-center gap-2">
                            {loading ? <Loader2 className="animate-spin"/> : <><Play fill="currentColor"/> {joiningMatchId ? 'دخول اللعبة' : 'إنشاء الغرفة'}</>}
                        </button>
                        <button onClick={() => setView('lobby')} className="mt-4 text-gray-400 font-bold hover:text-gray-600">إلغاء</button>
                    </div>
                </div>
            )}

            {/* --- View: PLAYING --- */}
            {view === 'playing' && currentMatch && (
                <div className="flex-1 flex flex-col animate-in fade-in h-full">
                    <div className="px-4 py-4 flex justify-between items-center">
                        <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border-2 transition-all ${currentMatch.game_state.current_turn === me?.id ? 'border-green-500 bg-white shadow-md scale-105' : 'border-transparent opacity-60'}`}>
                            <div className="w-10 h-10 rounded-full border overflow-hidden"><AvatarDisplay avatar={me?.avatar} /></div>
                            <div><p className="text-xs font-black text-gray-800">أنت</p><p className="text-sm font-bold text-green-600">{me?.symbol}</p></div>
                        </div>
                        <div className="font-black text-gray-300 text-xl">VS</div>
                        <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border-2 transition-all flex-row-reverse ${currentMatch.game_state.current_turn === opponent?.id ? 'border-red-500 bg-white shadow-md scale-105' : 'border-transparent opacity-60'}`}>
                            <div className="w-10 h-10 rounded-full border overflow-hidden bg-white flex items-center justify-center">{opponent ? <AvatarDisplay avatar={opponent.avatar} /> : <Loader2 className="w-5 h-5 animate-spin text-gray-400"/>}</div>
                            <div className="text-left"><p className="text-xs font-black text-gray-800 truncate max-w-[80px]">{opponent?.name || 'انتظار...'}</p><p className="text-sm font-bold text-red-500">{opponent ? opponent.symbol : '?'}</p></div>
                        </div>
                    </div>

                    <div className="flex-1 flex items-center justify-center p-4">
                        {currentMatch.status === 'waiting' ? (
                            <div className="text-center">
                                <Loader2 className="w-16 h-16 text-indigo-200 animate-spin mx-auto mb-6"/>
                                <h3 className="text-xl font-black text-indigo-900">في انتظار المنافس...</h3>
                                {autoDeleteTimeLeft !== null && (
                                    <p className="text-sm font-bold text-red-500 mt-2">سيتم إغلاق الغرفة تلقائياً خلال: {Math.floor(autoDeleteTimeLeft / 60)}:{(autoDeleteTimeLeft % 60).toString().padStart(2, '0')}</p>
                                )}
                                {currentMatch.created_by === employee.employee_id && (
                                    <button onClick={() => handleDeleteMatch(currentMatch.id)} className="mt-8 bg-red-50 text-red-500 px-6 py-3 rounded-xl font-bold flex items-center gap-2 mx-auto hover:bg-red-100 transition-colors"><Trash2 size={20}/> إلغاء الغرفة</button>
                                )}
                            </div>
                        ) : currentMatch.status === 'playing' ? (
                            <div className="grid grid-cols-3 gap-3 bg-white p-4 rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-[350px] w-full aspect-square">
                                {currentMatch.game_state.board.map((cell: string, idx: number) => (
                                    <button key={idx} onClick={() => handleCellClick(idx)} disabled={cell !== null || currentMatch.game_state.current_turn !== employee.employee_id} 
                                        className={`rounded-2xl text-5xl font-black flex items-center justify-center transition-all ${!cell ? 'bg-gray-50 hover:bg-gray-100' : cell === 'X' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-500'}`}>
                                        {cell && <span className="animate-in zoom-in spin-in-12">{cell}</span>}
                                    </button>
                                ))}
                            </div>
                        ) : currentMatch.status === 'reward_time' ? (
                            <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 text-center shadow-2xl animate-in zoom-in mx-4">
                                {amIWinner ? (
                                    <>
                                        <Trophy className="w-24 h-24 text-yellow-400 mx-auto mb-6 drop-shadow-xl animate-bounce"/>
                                        <h3 className="text-3xl font-black text-gray-800 mb-2">أنت الفائز! 🎉</h3>
                                        <p className="text-gray-500 font-bold mb-8">اختر تحدي السؤال لربح النقاط:</p>
                                        <div className="space-y-3">
                                            <button onClick={() => handleRewardSelection('easy', 5, 10)} disabled={loading} className="w-full bg-green-50 border-2 border-green-100 text-green-700 p-4 rounded-2xl font-bold flex justify-between items-center hover:bg-green-100 transition-all"><span>سهل (10ث)</span> <span>+5 نقاط</span></button>
                                            <button onClick={() => handleRewardSelection('medium', 10, 20)} disabled={loading} className="w-full bg-yellow-50 border-2 border-yellow-100 text-yellow-700 p-4 rounded-2xl font-bold flex justify-between items-center hover:bg-yellow-100 transition-all"><span>متوسط (20ث)</span> <span>+10 نقاط</span></button>
                                            <button onClick={() => handleRewardSelection('hard', 15, 30)} disabled={loading} className="w-full bg-red-50 border-2 border-red-100 text-red-700 p-4 rounded-2xl font-bold flex justify-between items-center hover:bg-red-100 transition-all"><span>صعب (30ث)</span> <span>+15 نقطة</span></button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-12">
                                        <span className="text-7xl mb-6 block grayscale">😞</span>
                                        <h3 className="text-2xl font-black text-gray-800">حظ أوفر!</h3>
                                        <p className="text-gray-500 font-bold mt-2">خسرت هذه الجولة.</p>
                                        <button onClick={exitMatch} className="mt-10 bg-gray-100 px-8 py-3 rounded-2xl font-bold text-gray-600 w-full">خروج</button>
                                    </div>
                                )}
                            </div>
                        ) : currentMatch.status === 'answering_reward' ? (
                            <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 text-center shadow-2xl animate-in zoom-in mx-4 relative">
                                {amIWinner ? (
                                    <>
                                        <div className="absolute top-6 left-6 flex items-center gap-1 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-black">
                                            <Timer size={16}/> {timeLeft}
                                        </div>
                                        <BrainCircuit className="w-16 h-16 text-indigo-500 mx-auto mb-6 mt-4"/>
                                        <h3 className="text-xl font-black text-gray-800 mb-6 px-2">{currentMatch.final_question?.questionText}</h3>
                                        
                                        <div className="grid grid-cols-1 gap-3">
                                            {currentMatch.final_question?.options.map((optText: string, idx: number) => (
                                                <button key={idx} onClick={() => handleRewardAnswer(optText)} disabled={loading} className="w-full bg-white border-2 border-gray-100 p-4 rounded-2xl font-bold text-gray-700 hover:border-indigo-500 hover:bg-indigo-50 active:scale-95 transition-all text-sm">
                                                    {optText}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-12">
                                        <Loader2 className="w-12 h-12 text-indigo-300 animate-spin mx-auto mb-6"/>
                                        <h3 className="text-xl font-black text-gray-800">الفائز يجيب الآن...</h3>
                                        <button onClick={exitMatch} className="mt-8 bg-gray-100 px-8 py-3 rounded-2xl font-bold text-gray-600">خروج</button>
                                    </div>
                                )}
                            </div>
                        ) : currentMatch.status === 'finished' ? (
                            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 text-center shadow-2xl animate-in zoom-in mx-4">
                                {currentMatch.winner_id ? (
                                    <>
                                        <CheckCircle2 className="w-24 h-24 text-green-500 mx-auto mb-6"/>
                                        <h3 className="text-2xl font-black text-gray-800 mb-2">انتهت اللعبة!</h3>
                                    </>
                                ) : (
                                    <>
                                        <Hand className="w-24 h-24 text-gray-400 mx-auto mb-6"/>
                                        <h3 className="text-2xl font-black text-gray-800 mb-2">تعادل! 🤝</h3>
                                        <p className="text-gray-500 font-bold mb-4">لا فائز ولا أسئلة في التعادل.</p>
                                    </>
                                )}
                                <button onClick={exitMatch} className="mt-6 bg-indigo-600 text-white w-full py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 shadow-xl">العودة للصالة</button>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
}
