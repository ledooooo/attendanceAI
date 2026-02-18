import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Trophy, Swords, Clock, Users } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    comp: any;
    currentUserId: string;
}

export default function CompetitionCard({ comp, currentUserId }: Props) {
    const [currentQuestion, setCurrentQuestion] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [team1Members, setTeam1Members] = useState<string[]>([]);
    const [team2Members, setTeam2Members] = useState<string[]>([]);

    // 1. تحديد فريقي (1 أو 2 أو 0 إذا متفرج)
    const myTeamNumber = comp.team1_ids?.includes(currentUserId) ? 1 
                       : comp.team2_ids?.includes(currentUserId) ? 2 
                       : 0;

    // 2. هل دور فريقي الآن؟
    const isMyTeamTurn = comp.status === 'active' && comp.current_turn_team === myTeamNumber;

    // 3. جلب أسماء الأعضاء (للعرض)
    useEffect(() => {
        const fetchNames = async () => {
            if(comp.team1_ids?.length) {
                const { data } = await supabase.from('employees').select('name').in('id', comp.team1_ids);
                setTeam1Members(data?.map(e => e.name) || []);
            }
            if(comp.team2_ids?.length) {
                const { data } = await supabase.from('employees').select('name').in('id', comp.team2_ids);
                setTeam2Members(data?.map(e => e.name) || []);
            }
        };
        fetchNames();
    }, [comp.team1_ids, comp.team2_ids]);

    // 4. جلب السؤال إذا كان دور فريقي
    useEffect(() => {
        if (isMyTeamTurn) {
            const fetchQuestion = async () => {
                const { data } = await supabase
                    .from('competition_questions')
                    .select('*')
                    .eq('competition_id', comp.id)
                    .eq('assigned_to_team', myTeamNumber) // الأسئلة المخصصة لفريقي
                    .eq('is_answered', false)
                    .order('order_index', { ascending: true })
                    .limit(1)
                    .maybeSingle();
                
                setCurrentQuestion(data);
            };
            fetchQuestion();
        }
    }, [isMyTeamTurn, comp.id, myTeamNumber]);

    const handleAnswer = async (selectedOption: string) => {
        if (!currentQuestion) return;
        setLoading(true);

        const isCorrect = selectedOption === currentQuestion.correct_option;
        
        // أ) تحديث السؤال كـ مُجاب
        await supabase.from('competition_questions').update({ is_answered: true }).eq('id', currentQuestion.id);

        // ب) تحديث السكور
        const updates: any = {};
        if (isCorrect) {
            if (myTeamNumber === 1) updates.player1_score = (comp.player1_score || 0) + 1;
            else updates.player2_score = (comp.player2_score || 0) + 1;
            toast.success('عاش يا بطل! إجابة صحيحة 💪');
        } else {
            toast.error('إجابة خاطئة 😢');
        }

        // ج) تبديل الدور للفريق الآخر
        const nextTeamTurn = myTeamNumber === 1 ? 2 : 1;
        
        // د) هل انتهت المباراة؟ (لا توجد أسئلة متبقية لأي فريق)
        const { count } = await supabase.from('competition_questions')
            .select('*', { count: 'exact', head: true })
            .eq('competition_id', comp.id)
            .eq('is_answered', false);

        if (count === 0) {
            updates.status = 'completed';
            updates.current_turn_team = null;
            
            // تحديد الفريق الفائز وتوزيع الجوائز
            const finalScore1 = myTeamNumber === 1 && isCorrect ? (comp.player1_score || 0) + 1 : (comp.player1_score || 0);
            const finalScore2 = myTeamNumber === 2 && isCorrect ? (comp.player2_score || 0) + 1 : (comp.player2_score || 0);

            // توزيع النقاط على كل أعضاء الفريق الفائز
            let winningTeamIds: string[] = [];
            if (finalScore1 > finalScore2) winningTeamIds = comp.team1_ids;
            else if (finalScore2 > finalScore1) winningTeamIds = comp.team2_ids;

            if (winningTeamIds.length > 0) {
                // إضافة نقاط لكل عضو
                for (const memberId of winningTeamIds) {
                    await supabase.rpc('increment_points', { emp_id: memberId, amount: comp.reward_points });
                }
            }
        } else {
            updates.current_turn_team = nextTeamTurn;
        }

        await supabase.from('competitions').update(updates).eq('id', comp.id);
        setLoading(false);
        setCurrentQuestion(null);
    };

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-purple-100 overflow-hidden mb-4 relative">
            
            {/* Header: الفرق والنتيجة */}
            <div className="bg-gradient-to-r from-red-500 via-purple-600 to-blue-600 p-4 text-white flex justify-between items-start">
                
                {/* الفريق الأول */}
                <div className="flex flex-col items-center w-1/3">
                    <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-lg mb-1 border-2 border-white shadow-md relative">
                        <Users size={18}/>
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-red-600 rounded-full text-[9px] font-black flex items-center justify-center">
                            {team1Members.length}
                        </span>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] font-bold opacity-90">الفريق الأحمر</p>
                        <p className="text-[8px] opacity-75 truncate w-20">{team1Members.join(', ')}</p>
                    </div>
                    <span className="text-2xl font-black mt-1">{comp.player1_score || 0}</span>
                </div>

                {/* الحالة في المنتصف */}
                <div className="flex flex-col items-center justify-center w-1/3 mt-2">
                    <Swords className="w-8 h-8 text-yellow-300 animate-pulse"/>
                    <span className="text-[10px] font-bold bg-black/20 px-2 py-0.5 rounded-full mt-1">
                        {comp.status === 'active' ? 'تحدي الفرق 🔥' : 'انتهى التحدي'}
                    </span>
                </div>

                {/* الفريق الثاني */}
                <div className="flex flex-col items-center w-1/3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-lg mb-1 border-2 border-white shadow-md relative">
                        <Users size={18}/>
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-blue-600 rounded-full text-[9px] font-black flex items-center justify-center">
                            {team2Members.length}
                        </span>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] font-bold opacity-90">الفريق الأزرق</p>
                        <p className="text-[8px] opacity-75 truncate w-20">{team2Members.join(', ')}</p>
                    </div>
                    <span className="text-2xl font-black mt-1">{comp.player2_score || 0}</span>
                </div>
            </div>

            {/* منطقة اللعب */}
            <div className="p-4 text-center">
                {comp.status === 'completed' ? (
                    <div className="py-4">
                        {(comp.player1_score || 0) > (comp.player2_score || 0) ? (
                            <div className="text-red-600">
                                <Trophy className="w-12 h-12 mx-auto mb-2"/>
                                <h3 className="font-black">فاز الفريق الأحمر! 🏆🔴</h3>
                            </div>
                        ) : (comp.player2_score || 0) > (comp.player1_score || 0) ? (
                            <div className="text-blue-600">
                                <Trophy className="w-12 h-12 mx-auto mb-2"/>
                                <h3 className="font-black">فاز الفريق الأزرق! 🏆🔵</h3>
                            </div>
                        ) : (
                            <h3 className="font-black text-gray-500">تعادل عادل! 🤝</h3>
                        )}
                        <p className="text-xs text-gray-400 mt-2">حصل كل عضو في الفريق الفائز على {comp.reward_points} نقطة</p>
                    </div>
                ) : (
                    <>
                        {isMyTeamTurn && currentQuestion ? (
                            <div className="animate-in fade-in slide-in-from-bottom-4">
                                <div className="bg-yellow-50 text-yellow-800 text-xs font-bold py-1 px-3 rounded-full inline-block mb-3 border border-yellow-200">
                                    دور فريقك الآن! أي حد يجاوب 🚀
                                </div>
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
                                    {myTeamNumber !== 0 
                                        ? "انتظر دور الفريق الآخر..." 
                                        : `الدور الآن على: ${comp.current_turn_team === 1 ? 'الفريق الأحمر 🔴' : 'الفريق الأزرق 🔵'}`
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
