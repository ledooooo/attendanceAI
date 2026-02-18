import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Trophy, Swords, Clock, Users, Play, X, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti'; // تأكد من تثبيت هذه المكتبة: npm install canvas-confetti

interface Props {
    comp: any;
    currentUserId: string;
}

export default function CompetitionCard({ comp, currentUserId }: Props) {
    const [isPlayModalOpen, setIsPlayModalOpen] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [team1Members, setTeam1Members] = useState<string[]>([]);
    const [team2Members, setTeam2Members] = useState<string[]>([]);

    // تنسيق الاسم
    const formatName = (fullName: string) => fullName ? fullName.trim().split(/\s+/).slice(0, 2).join(' ') : '';

    // 1. تحديد فريقي
    const myTeamNumber = comp.team1_ids?.includes(currentUserId) ? 1 
                       : comp.team2_ids?.includes(currentUserId) ? 2 
                       : 0;

    // 2. هل دور فريقي الآن؟
    const isMyTeamTurn = comp.status === 'active' && comp.current_turn_team === myTeamNumber;

    // 3. جلب الأسماء
    useEffect(() => {
        const fetchNames = async () => {
            if(comp.team1_ids?.length) {
                const { data } = await supabase.from('employees').select('name').in('id', comp.team1_ids);
                setTeam1Members(data?.map(e => formatName(e.name)) || []);
            }
            if(comp.team2_ids?.length) {
                const { data } = await supabase.from('employees').select('name').in('id', comp.team2_ids);
                setTeam2Members(data?.map(e => formatName(e.name)) || []);
            }
        };
        fetchNames();
    }, [comp.team1_ids, comp.team2_ids]);

    // 4. فتح المودال وجلب السؤال
    const openPlayModal = async () => {
        if (!isMyTeamTurn) return;
        setLoading(true);
        setIsPlayModalOpen(true);

        const { data } = await supabase
            .from('competition_questions')
            .select('*')
            .eq('competition_id', comp.id)
            .eq('assigned_to_team', myTeamNumber)
            .eq('is_answered', false)
            .order('order_index', { ascending: true })
            .limit(1)
            .maybeSingle();
        
        setCurrentQuestion(data);
        setLoading(false);
    };

    const handleAnswer = async (selectedOption: string) => {
        if (!currentQuestion) return;
        setLoading(true);

        const isCorrect = selectedOption === currentQuestion.correct_option;
        
        // تحديث حالة السؤال
        await supabase.from('competition_questions').update({ is_answered: true }).eq('id', currentQuestion.id);

        const updates: any = {};
        if (isCorrect) {
            if (myTeamNumber === 1) updates.player1_score = (comp.player1_score || 0) + 1;
            else updates.player2_score = (comp.player2_score || 0) + 1;
            
            toast.success('إجابة صحيحة! 🎉', { icon: '✅' });
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        } else {
            toast.error('إجابة خاطئة 😞', { icon: '❌' });
        }

        // تبديل الدور
        const nextTeamTurn = myTeamNumber === 1 ? 2 : 1;
        
        // فحص النهاية
        const { count } = await supabase.from('competition_questions')
            .select('*', { count: 'exact', head: true })
            .eq('competition_id', comp.id)
            .eq('is_answered', false);

        if (count === 0) {
            updates.status = 'completed';
            updates.current_turn_team = null;
            
            // تحديد الفائز
            const finalScore1 = myTeamNumber === 1 && isCorrect ? (comp.player1_score || 0) + 1 : (comp.player1_score || 0);
            const finalScore2 = myTeamNumber === 2 && isCorrect ? (comp.player2_score || 0) + 1 : (comp.player2_score || 0);

            let winningTeamIds: string[] = [];
            if (finalScore1 > finalScore2) {
                updates.winner_id = comp.team1_ids[0]; // مجازاً نضع القائد، لكن الجوائز للكل
                winningTeamIds = comp.team1_ids;
            } else if (finalScore2 > finalScore1) {
                updates.winner_id = comp.team2_ids[0];
                winningTeamIds = comp.team2_ids;
            }

            // توزيع النقاط
            if (winningTeamIds.length > 0) {
                for (const memberId of winningTeamIds) {
                    await supabase.rpc('increment_points', { emp_id: memberId, amount: comp.reward_points });
                }
            }
        } else {
            updates.current_turn_team = nextTeamTurn;
        }

        await supabase.from('competitions').update(updates).eq('id', comp.id);
        
        setLoading(false);
        setIsPlayModalOpen(false); // إغلاق المودال
        setCurrentQuestion(null);
    };

    return (
        <>
            {/* الكارت الظاهر في الصفحة */}
            <div className="bg-white rounded-3xl shadow-md border border-purple-100 overflow-hidden mb-4 relative transform transition-all hover:scale-[1.01]">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-red-600 via-purple-600 to-blue-600 p-4 text-white flex justify-between items-start relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/5 pattern-dots opacity-30"></div>
                    
                    {/* الفريق الأول */}
                    <div className="flex flex-col items-center w-1/3 z-10">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center border-4 border-red-500 shadow-lg relative">
                            <span className="text-xl">🔴</span>
                            <span className="absolute -bottom-2 bg-red-600 text-white text-[10px] px-2 rounded-full font-bold">
                                {comp.player1_score || 0}
                            </span>
                        </div>
                        <div className="mt-3 flex flex-wrap justify-center gap-1">
                            {team1Members.map((name, idx) => (
                                <span key={idx} className="text-[9px] bg-black/20 px-2 py-0.5 rounded-md truncate max-w-[80px]">{name}</span>
                            ))}
                        </div>
                    </div>

                    {/* الحالة والزر */}
                    <div className="flex flex-col items-center justify-center w-1/3 mt-1 z-10">
                        <Swords className="w-8 h-8 text-yellow-300 drop-shadow-md animate-pulse"/>
                        
                        {comp.status === 'completed' ? (
                            <span className="mt-2 bg-gray-900/50 px-3 py-1 rounded-full text-[10px] font-bold border border-white/20">انتهت 🏁</span>
                        ) : isMyTeamTurn ? (
                            <button 
                                onClick={openPlayModal}
                                className="mt-3 bg-yellow-400 text-yellow-900 px-4 py-2 rounded-xl text-xs font-black shadow-lg hover:bg-yellow-300 hover:scale-105 transition-all flex items-center gap-1 animate-bounce"
                            >
                                <Play size={12} fill="currentColor"/> العب الآن
                            </button>
                        ) : (
                            <span className="mt-2 bg-black/30 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1">
                                <Clock size={10}/> انتظر دورك
                            </span>
                        )}
                    </div>

                    {/* الفريق الثاني */}
                    <div className="flex flex-col items-center w-1/3 z-10">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center border-4 border-blue-500 shadow-lg relative">
                            <span className="text-xl">🔵</span>
                            <span className="absolute -bottom-2 bg-blue-600 text-white text-[10px] px-2 rounded-full font-bold">
                                {comp.player2_score || 0}
                            </span>
                        </div>
                        <div className="mt-3 flex flex-wrap justify-center gap-1">
                            {team2Members.map((name, idx) => (
                                <span key={idx} className="text-[9px] bg-black/20 px-2 py-0.5 rounded-md truncate max-w-[80px]">{name}</span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer الكارت */}
                <div className="p-3 bg-gray-50 flex justify-between items-center text-[10px] text-gray-500 font-bold">
                    <span>🏆 الجائزة: {comp.reward_points} نقطة</span>
                    <span>📅 {new Date(comp.created_at).toLocaleDateString('ar-EG')}</span>
                </div>
            </div>

            {/* --- نافذة اللعب (Modal) --- */}
            {isPlayModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden relative animate-in zoom-in-95">
                        <div className="absolute top-0 right-0 left-0 h-32 bg-gradient-to-br from-purple-600 to-indigo-600 -z-0"></div>
                        <button onClick={() => setIsPlayModalOpen(false)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full z-10 transition-colors"><X size={20}/></button>
                        
                        <div className="pt-8 px-6 pb-6 relative z-10">
                            <div className="w-20 h-20 bg-white rounded-3xl mx-auto shadow-xl flex items-center justify-center mb-6 transform rotate-3 border-4 border-yellow-400">
                                <span className="text-4xl">🤔</span>
                            </div>

                            {loading ? (
                                <div className="text-center py-10">
                                    <p className="font-bold text-gray-500 animate-pulse">جاري تحضير السؤال...</p>
                                </div>
                            ) : currentQuestion ? (
                                <div className="text-center">
                                    <h3 className="text-xl font-black text-gray-800 mb-6 leading-relaxed">
                                        {currentQuestion.question_text}
                                    </h3>

                                    <div className="space-y-3">
                                        <button onClick={() => handleAnswer('a')} className="w-full bg-gray-50 hover:bg-purple-50 border-2 border-gray-100 hover:border-purple-200 p-4 rounded-2xl font-bold text-gray-700 transition-all active:scale-95 text-sm">
                                            {currentQuestion.option_a}
                                        </button>
                                        <button onClick={() => handleAnswer('b')} className="w-full bg-gray-50 hover:bg-purple-50 border-2 border-gray-100 hover:border-purple-200 p-4 rounded-2xl font-bold text-gray-700 transition-all active:scale-95 text-sm">
                                            {currentQuestion.option_b}
                                        </button>
                                        {currentQuestion.option_c && (
                                            <button onClick={() => handleAnswer('c')} className="w-full bg-gray-50 hover:bg-purple-50 border-2 border-gray-100 hover:border-purple-200 p-4 rounded-2xl font-bold text-gray-700 transition-all active:scale-95 text-sm">
                                                {currentQuestion.option_c}
                                            </button>
                                        )}
                                        {currentQuestion.option_d && (
                                            <button onClick={() => handleAnswer('d')} className="w-full bg-gray-50 hover:bg-purple-50 border-2 border-gray-100 hover:border-purple-200 p-4 rounded-2xl font-bold text-gray-700 transition-all active:scale-95 text-sm">
                                                {currentQuestion.option_d}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-10">
                                    <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-2"/>
                                    <p className="font-bold text-gray-500">عذراً، لم يتم العثور على السؤال!</p>
                                    <button onClick={() => setIsPlayModalOpen(false)} className="mt-4 text-blue-600 font-bold underline">إغلاق</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
