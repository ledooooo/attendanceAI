import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Trophy, Swords, Clock, Play, X, CheckCircle, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query'; // لتحديث الواجهة
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

interface Props {
    comp: any;
    currentUserId: string;
}

export default function CompetitionCard({ comp, currentUserId }: Props) {
    const queryClient = useQueryClient();
    const [isPlayModalOpen, setIsPlayModalOpen] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [team1Members, setTeam1Members] = useState<string[]>([]);
    const [team2Members, setTeam2Members] = useState<string[]>([]);

    const formatName = (fullName: string) => fullName ? fullName.trim().split(/\s+/).slice(0, 2).join(' ') : '';

    const myTeamNumber = comp.team1_ids?.includes(currentUserId) ? 1 : comp.team2_ids?.includes(currentUserId) ? 2 : 0;
    const isMyTeamTurn = comp.status === 'active' && comp.current_turn_team === myTeamNumber;

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

    const handleCardClick = async () => {
        if (comp.status === 'completed') return toast('هذه المسابقة انتهت وتم إعلان الفائز 🏆', { icon: '🏁' });
        if (myTeamNumber === 0) return toast('أنت تشاهد هذه المباراة كجمهور 👀', { icon: '🍿' });
        if (!isMyTeamTurn) return toast('انتظر دور الفريق الآخر للعب ⏳', { icon: '✋' });

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
        await supabase.from('competition_questions').update({ is_answered: true }).eq('id', currentQuestion.id);

        const updates: any = {};
        let t1Score = comp.team1_score || 0;
        let t2Score = comp.team2_score || 0;

        if (isCorrect) {
            if (myTeamNumber === 1) t1Score += 1;
            else t2Score += 1;
            
            updates.team1_score = t1Score;
            updates.team2_score = t2Score;
            
            toast.success('إجابة صحيحة! 🎉', { icon: '✅' });
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        } else {
            toast.error('إجابة خاطئة 😞', { icon: '❌' });
        }

        const nextTeamTurn = myTeamNumber === 1 ? 2 : 1;
        
        const { count } = await supabase.from('competition_questions')
            .select('*', { count: 'exact', head: true })
            .eq('competition_id', comp.id)
            .eq('is_answered', false);

        if (count === 0) {
            updates.status = 'completed';
            updates.current_turn_team = null;
            
            let winningTeamIds: string[] = [];
            if (t1Score > t2Score) winningTeamIds = comp.team1_ids;
            else if (t2Score > t1Score) winningTeamIds = comp.team2_ids;

            // 🔥 توزيع الجوائز على الفريق الفائز وتسجيلها في دفتر النقاط
            if (winningTeamIds.length > 0) {
                const { data: winners } = await supabase.from('employees').select('employee_id').in('id', winningTeamIds);
                if (winners) {
                    for (const w of winners) {
                        await supabase.rpc('increment_points', { emp_id: w.employee_id, amount: comp.reward_points });
                        await supabase.from('points_ledger').insert({
                            employee_id: w.employee_id,
                            points: comp.reward_points,
                            reason: 'الفوز في التحدي الجماعي 🏆'
                        });
                    }
                }
            }
        } else {
            updates.current_turn_team = nextTeamTurn;
        }

        await supabase.from('competitions').update(updates).eq('id', comp.id);
        
        // 🔥 تحديث الواجهة لتظهر النتيجة الجديدة فوراً
        queryClient.invalidateQueries({ queryKey: ['news_feed_mixed'] });
        
        setLoading(false);
        setIsPlayModalOpen(false);
        setCurrentQuestion(null);
    };

    return (
        <>
            <div onClick={handleCardClick} className={`bg-white rounded-3xl shadow-md border border-purple-100 overflow-hidden mb-4 relative transform transition-all duration-200 ${isMyTeamTurn ? 'cursor-pointer hover:scale-[1.02] ring-2 ring-yellow-400 ring-offset-2' : ''}`}>
                {isMyTeamTurn && <div className="absolute top-2 right-2 z-20 bg-yellow-400 text-black text-[10px] font-black px-3 py-1 rounded-full animate-bounce shadow-sm">دورك الآن! اضغط للعب 🎮</div>}
                <div className="bg-gradient-to-r from-red-600 via-purple-600 to-blue-600 p-4 text-white flex justify-between items-start relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/5 opacity-30"></div>
                    <div className="flex flex-col items-center w-1/3 z-10">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center border-4 border-red-500 shadow-lg relative">
                            <span className="text-xl">🔴</span>
                            <span className="absolute -bottom-2 bg-red-600 text-white text-[10px] px-2 rounded-full font-bold">{comp.team1_score || 0}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap justify-center gap-1">
                            {team1Members.map((name, idx) => <span key={idx} className="text-[9px] bg-black/20 px-2 py-0.5 rounded-md truncate max-w-[80px]">{name}</span>)}
                        </div>
                    </div>
                    <div className="flex flex-col items-center justify-center w-1/3 mt-1 z-10">
                        <Swords className="w-8 h-8 text-yellow-300 drop-shadow-md animate-pulse"/>
                        {comp.status === 'completed' ? (
                            <span className="mt-2 bg-gray-900/50 px-3 py-1 rounded-full text-[10px] font-bold border border-white/20">انتهت 🏁</span>
                        ) : isMyTeamTurn ? (
                            <div className="mt-3 bg-white/20 backdrop-blur-sm rounded-full p-2 hover:bg-white/30 transition-colors"><Play size={20} fill="currentColor" className="text-white"/></div>
                        ) : (
                            <span className="mt-2 bg-black/30 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1"><Clock size={10}/> انتظر دورك</span>
                        )}
                    </div>
                    <div className="flex flex-col items-center w-1/3 z-10">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center border-4 border-blue-500 shadow-lg relative">
                            <span className="text-xl">🔵</span>
                            <span className="absolute -bottom-2 bg-blue-600 text-white text-[10px] px-2 rounded-full font-bold">{comp.team2_score || 0}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap justify-center gap-1">
                            {team2Members.map((name, idx) => <span key={idx} className="text-[9px] bg-black/20 px-2 py-0.5 rounded-md truncate max-w-[80px]">{name}</span>)}
                        </div>
                    </div>
                </div>
                <div className="p-3 bg-gray-50 flex justify-between items-center text-[10px] text-gray-500 font-bold">
                    <span>🏆 الجائزة: {comp.reward_points} نقطة</span>
                    <span className="text-xs">{comp.status === 'active' ? 'مستمرة...' : 'انتهت'}</span>
                </div>
            </div>

            {isPlayModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden relative animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="absolute top-0 right-0 left-0 h-32 bg-gradient-to-br from-purple-600 to-indigo-600 -z-0"></div>
                        <button onClick={() => setIsPlayModalOpen(false)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full z-10 transition-colors"><X size={20}/></button>
                        
                        <div className="pt-8 px-6 pb-6 relative z-10">
                            <div className="w-20 h-20 bg-white rounded-3xl mx-auto shadow-xl flex items-center justify-center mb-6 transform rotate-3 border-4 border-yellow-400"><span className="text-4xl">🤔</span></div>
                            {loading ? (
                                <div className="text-center py-10"><Loader2 className="w-10 h-10 animate-spin text-purple-600 mx-auto mb-4"/><p className="font-bold text-gray-500 animate-pulse">جاري تحضير السؤال...</p></div>
                            ) : currentQuestion ? (
                                <div className="text-center">
                                    <h3 className="text-xl font-black text-gray-800 mb-6 leading-relaxed">{currentQuestion.question_text}</h3>
                                    <div className="space-y-3">
                                        {['a', 'b', 'c', 'd'].map(opt => currentQuestion[`option_${opt}`] && (
                                            <button key={opt} onClick={() => handleAnswer(opt)} className="w-full bg-gray-50 hover:bg-purple-50 border-2 border-gray-100 hover:border-purple-200 p-4 rounded-2xl font-bold text-gray-700 transition-all active:scale-95 text-sm">
                                                {currentQuestion[`option_${opt}`]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-10"><CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4"/><h3 className="text-xl font-black text-gray-800">أحسنت!</h3><p className="font-bold text-gray-500 mt-2">لا توجد أسئلة متبقية لفريقك في هذا الدور.</p><button onClick={() => setIsPlayModalOpen(false)} className="mt-6 bg-gray-100 px-6 py-2 rounded-xl font-bold text-gray-600">إغلاق</button></div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
