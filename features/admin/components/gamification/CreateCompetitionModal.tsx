import React, { useState } from 'react';
import { supabase } from '../../../../supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { User, Save, X, Loader2, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CreateCompetitionModal({ onClose }: { onClose: () => void }) {
    const [p1, setP1] = useState('');
    const [p2, setP2] = useState('');
    const [points, setPoints] = useState(50);
    const [loading, setLoading] = useState(false);

    // جلب الموظفين للاختيار
    const { data: employees = [] } = useQuery({
        queryKey: ['active_employees'],
        queryFn: async () => {
            const { data } = await supabase.from('employees').select('id, name').eq('status', 'نشط');
            return data || [];
        }
    });

    const handleCreate = async () => {
        if (!p1 || !p2 || p1 === p2) return toast.error('يرجى اختيار متنافسين مختلفين');
        setLoading(true);

        try {
            // 1. إنشاء المسابقة
            const { data: comp, error } = await supabase.from('competitions').insert({
                player1_id: p1,
                player2_id: p2,
                current_turn: p1, // اللاعب الأول يبدأ
                reward_points: points
            }).select().single();

            if (error) throw error;

            // 2. إنشاء أسئلة وهمية (للتجربة، لاحقاً يمكنك جعل المدير يكتبها)
            const questions = [
                // أسئلة اللاعب الأول
                { competition_id: comp.id, assigned_to: p1, question_text: 'ما هي عاصمة مصر؟', option_a: 'القاهرة', option_b: 'الإسكندرية', option_c: 'أسوان', correct_option: 'a', order_index: 1 },
                { competition_id: comp.id, assigned_to: p1, question_text: 'عدد أيام الأسبوع؟', option_a: '5', option_b: '7', option_c: '9', correct_option: 'b', order_index: 2 },
                { competition_id: comp.id, assigned_to: p1, question_text: 'لون السماء؟', option_a: 'أحمر', option_b: 'أخضر', option_c: 'أزرق', correct_option: 'c', order_index: 3 },
                // أسئلة اللاعب الثاني
                { competition_id: comp.id, assigned_to: p2, question_text: 'ناتج 5 × 5؟', option_a: '20', option_b: '25', option_c: '30', correct_option: 'b', order_index: 1 },
                { competition_id: comp.id, assigned_to: p2, question_text: 'أسرع حيوان بري؟', option_a: 'الفهد', option_b: 'الأسد', option_c: 'الفيل', correct_option: 'a', order_index: 2 },
                { competition_id: comp.id, assigned_to: p2, question_text: 'عدد ألوان الطيف؟', option_a: '5', option_b: '7', option_c: '10', correct_option: 'b', order_index: 3 },
            ];

            await supabase.from('competition_questions').insert(questions);
            
            toast.success('تم إطلاق المسابقة بنجاح! 🔥');
            onClose();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black flex items-center gap-2"><Users className="text-purple-600"/> مسابقة جديدة</h3>
                    <button onClick={onClose}><X/></button>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500">الطرف الأول 🔴</label>
                            <select className="w-full p-3 bg-gray-50 rounded-xl border mt-1" onChange={e => setP1(e.target.value)}>
                                <option value="">اختر...</option>
                                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500">الطرف الثاني 🔵</label>
                            <select className="w-full p-3 bg-gray-50 rounded-xl border mt-1" onChange={e => setP2(e.target.value)}>
                                <option value="">اختر...</option>
                                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500">نقاط الفائز 🏆</label>
                        <input type="number" value={points} onChange={e => setPoints(Number(e.target.value))} className="w-full p-3 bg-gray-50 rounded-xl border mt-1 font-bold text-center"/>
                    </div>

                    <button onClick={handleCreate} disabled={loading} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold mt-4 flex justify-center gap-2">
                        {loading ? <Loader2 className="animate-spin"/> : '🔥 إطلاق التحدي'}
                    </button>
                </div>
            </div>
        </div>
    );
}
