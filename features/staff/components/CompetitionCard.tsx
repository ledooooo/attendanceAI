import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Competition, Question } from '../../../types'; // تأكد من استيراد الأنواع
import { Trophy, Swords, Clock, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

interface Props {
    comp: Competition;
    currentUserId: string;
}

export default function CompetitionCard({ comp, currentUserId }: Props) {
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [loading, setLoading] = useState(false);

    // هل أنا لاعب في هذه المباراة؟
    const isPlayer = currentUserId === comp.player1_id || currentUserId === comp.player2_id;
    // هل هو دوري الآن؟
    const isMyTurn = comp.status === 'active' && comp.current_turn === currentUserId;

    // جلب السؤال الحالي إذا كان دوري
    useEffect(() => {
        if (isMyTurn) {
            const fetchQuestion = async () => {
                const { data } = await supabase
                    .from('competition_questions')
                    .select('*')
                    .eq('competition_id', comp.id)
                    .eq('assigned_to', currentUserId)
                    .eq('is_answered', false)
                    .order('order_index', { ascending: true })
                    .limit(1)
                    .single();
                
                if (data) setCurrentQuestion(data);
            };
            fetchQuestion();
        }
    }, [isMyTurn, comp.id, currentUserId]);

    const handleAnswer = async (selectedOption: string) => {
        if (!currentQuestion) return;
        setLoading(true);

        const isCorrect = selectedOption === currentQuestion.correct_option;
        
        // 1. تحديث السؤال كـ مُجاب
        await supabase.from('competition_questions').update({ is_answered: true }).eq('id', currentQuestion.id);

        // 2. تحديث السكور والدور
        const updates: any = {};
        if (isCorrect) {
            if (currentUserId === comp.player1_id) updates.player1_score = comp.player1_score + 1;
            else updates.player2_score = comp.player2_score + 1;
            toast.success('إجابة صحيحة! 💪');
        } else {
            toast.error('إجابة خاطئة 😢');
        }

        // تبديل الدور
        const nextTurn = currentUserId === comp.player1_id ? comp.player2_id : comp.player1_id;
        
        // التحقق هل انتهت الأسئلة للطرف الآخر أيضاً؟ (نهاية المباراة)
        const { count } = await supabase.from('competition_questions')
            .select('*', { count: 'exact', head: true })
            .eq('competition_id', comp.id)
            .eq('is_answered', false);

        if (count === 0) {
            updates.status = 'completed';
            updates.current_turn = null;
            
            // تحديد الفائز
            const finalScore1 = currentUserId === comp.player1_id && isCorrect ? comp.player1_score + 1 : comp.player1_score;
            const finalScore2 = currentUserId === comp.player2_id && isCorrect ? comp.player2_score + 1 : comp.player2_score;

            if (finalScore1 > finalScore2) updates.winner_id = comp.player1_id;
            else if (finalScore2 > finalScore1) updates.winner_id = comp.player2_id;
            else updates.winner_id = null; // تعادل

            // توزيع النقاط للفائز
            if (updates.winner_id) {
                await supabase.rpc('increment_points', { emp_id: updates.winner_id, amount: comp.reward_points });
            }
        } else {
            updates.current_turn = nextTurn;
        }

        await supabase.from('competitions').update(updates).eq('id', comp.id);
        setLoading(false);
        setCurrentQuestion(null);
    };

    // --- واجهة العرض ---
    return (
        <div className="bg-white rounded-3xl shadow-sm border border-purple-100 overflow-hidden mb-4 relative">
            {/* Header: المتنافسين والنتيجة */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white flex justify-between items-center">
                <div className="flex flex-col items-center w-1/3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-lg mb-1 border border-white/30">
                        {comp.player1?.name?.charAt(0) || '?'}
                    </div>
                    <span className="text-[10px] font-bold truncate max-w-full">{comp.player1?.name}</span>
                    <span className="text-xl font-black mt-1">{comp.player1_score}</span>
                </div>

                <div className="flex flex-col items-center justify-center w-1/3">
                    <Swords className="w-8 h-8 text-yellow-300 animate-pulse"/>
                    <span className="text-[10px] font-bold bg-black/20 px-2 py-0.5 rounded-full mt-1">
                        {comp.status === 'active' ? 'مباراة جارية' : 'انتهت'}
                    </span>
                </div>

                <div className="flex flex-col items-center w-1/3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-lg mb-1 border border-white/30">
                        {comp.player2?.name?.charAt(0) || '?'}
                    </div>
                    <span className="text-[10px] font-bold truncate max-w-full">{comp.player2?.name}</span>
                    <span className="text-xl font-black mt-1">{comp.player2_score}</span>
                </div>
            </div>

            {/* Content Body */}
            <div className="p-4 text-center">
                {comp.status === 'completed' ? (
                    <div className="py-4">
                        {comp.winner_id ? (
                            <>
                                <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-2"/>
                                <h3 className="font-black text-gray-800">الفائز: {comp.winner_id === comp.player1_id ? comp.player1?.name : comp.player2?.name} 🏆</h3>
                                <p className="text-sm text-gray-500 mt-1">حصل على {comp.reward_points} نقطة</p>
                            </>
                        ) : (
                            <h3 className="font-black text-gray-500">تعادل عادل! 🤝</h3>
                        )}
                    </div>
                ) : (
                    <>
                        {isMyTurn && currentQuestion ? (
                            <div className="animate-in fade-in slide-in-from-bottom-4">
                                <h4 className="font-bold text-gray-800 mb-4 text-lg">{currentQuestion.question_text}</h4>
                                <div className="space-y-2">
                                    <button onClick={() => handleAnswer('a')} disabled={loading} className="w-full p-3 bg-gray-50 hover:bg-purple-50 hover:border-purple-300 border rounded-xl font-bold transition-all text-sm">{currentQuestion.option_a}</button>
                                    <button onClick={() => handleAnswer('b')} disabled={loading} className="w-full p-3 bg-gray-50 hover:bg-purple-50 hover:border-purple-300 border rounded-xl font-bold transition-all text-sm">{currentQuestion.option_b}</button>
                                    <button onClick={() => handleAnswer('c')} disabled={loading} className="w-full p-3 bg-gray-50 hover:bg-purple-50 hover:border-purple-300 border rounded-xl font-bold transition-all text-sm">{currentQuestion.option_c}</button>
                                </div>
                            </div>
                        ) : (
                            <div className="py-6 flex flex-col items-center justify-center text-gray-400">
                                <Clock className="w-8 h-8 mb-2 opacity-50"/>
                                <p className="font-bold text-sm">
                                    {isPlayer 
                                        ? "في انتظار منافسك ليلعب دوره..." 
                                        : `الدور الآن على: ${comp.current_turn === comp.player1_id ? comp.player1?.name : comp.player2?.name}`
                                    }
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
