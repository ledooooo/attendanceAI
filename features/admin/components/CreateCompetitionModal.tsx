import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient'; // تم تعديل المسار
import { useQuery } from '@tanstack/react-query';
import { X, Loader2, Users, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CreateCompetitionModal({ onClose }: { onClose: () => void }) {
    const [team1, setTeam1] = useState<string[]>([]);
    const [team2, setTeam2] = useState<string[]>([]);
    const [points, setPoints] = useState(50);
    const [loading, setLoading] = useState(false);
    const [selectedEmp, setSelectedEmp] = useState('');

    const { data: employees = [] } = useQuery({
        queryKey: ['active_employees'],
        queryFn: async () => {
            const { data } = await supabase.from('employees').select('id, name').eq('status', 'نشط');
            return data || [];
        }
    });

    const addToTeam = (teamNum: 1 | 2) => {
        if (!selectedEmp) return;
        if (team1.includes(selectedEmp) || team2.includes(selectedEmp)) {
            return toast.error('الموظف مضاف بالفعل!');
        }
        if (teamNum === 1) setTeam1([...team1, selectedEmp]);
        else setTeam2([...team2, selectedEmp]);
        setSelectedEmp('');
    };

    const removeFromTeam = (teamNum: 1 | 2, id: string) => {
        if (teamNum === 1) setTeam1(team1.filter(m => m !== id));
        else setTeam2(team2.filter(m => m !== id));
    };

    const handleCreate = async () => {
        if (team1.length === 0 || team2.length === 0) return toast.error('يجب اختيار عضو واحد على الأقل لكل فريق');
        setLoading(true);

        try {
            const { data: comp, error } = await supabase.from('competitions').insert({
                team1_ids: team1,
                team2_ids: team2,
                current_turn_team: 1,
                reward_points: points,
                status: 'active'
            }).select().single();

            if (error) throw error;

            const questions = [
                { competition_id: comp.id, assigned_to_team: 1, question_text: 'سؤال للفريق الأول: عاصمة السعودية؟', option_a: 'الرياض', option_b: 'جدة', option_c: 'مكة', correct_option: 'a', order_index: 1 },
                { competition_id: comp.id, assigned_to_team: 1, question_text: 'سؤال للفريق الأول: 5 + 6؟', option_a: '10', option_b: '11', option_c: '12', correct_option: 'b', order_index: 2 },
                { competition_id: comp.id, assigned_to_team: 1, question_text: 'سؤال للفريق الأول: الذهب لونه؟', option_a: 'أصفر', option_b: 'أحمر', option_c: 'أخضر', correct_option: 'a', order_index: 3 },
                { competition_id: comp.id, assigned_to_team: 2, question_text: 'سؤال للفريق الثاني: عاصمة مصر؟', option_a: 'القاهرة', option_b: 'الإسكندرية', option_c: 'أسوان', correct_option: 'a', order_index: 1 },
                { competition_id: comp.id, assigned_to_team: 2, question_text: 'سؤال للفريق الثاني: 3 × 4؟', option_a: '10', option_b: '12', option_c: '14', correct_option: 'b', order_index: 2 },
                { competition_id: comp.id, assigned_to_team: 2, question_text: 'سؤال للفريق الثاني: لون الدم؟', option_a: 'أزرق', option_b: 'أحمر', option_c: 'أبيض', correct_option: 'b', order_index: 3 },
            ];

            await supabase.from('competition_questions').insert(questions);
            toast.success('تم إطلاق تحدي الفرق بنجاح! 🔥');
            onClose();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getEmpName = (id: string) => employees.find((e: any) => e.id === id)?.name || 'غير معروف';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black flex items-center gap-2"><Users className="text-purple-600"/> تحدي الفرق</h3>
                    <button onClick={onClose}><X/></button>
                </div>
                <div className="space-y-6">
                    <div className="bg-gray-50 p-3 rounded-xl border">
                        <label className="text-xs font-bold text-gray-500 mb-2 block">اختر الموظفين لإضافتهم للفرق</label>
                        <div className="flex gap-2">
                            <select className="flex-1 p-2 bg-white rounded-lg border text-sm" value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}>
                                <option value="">اختر موظفاً...</option>
                                {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                            <div className="flex gap-1">
                                <button onClick={() => addToTeam(1)} className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-200">+ فريق 1</button>
                                <button onClick={() => addToTeam(2)} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-200">+ فريق 2</button>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="border-2 border-red-100 rounded-xl p-3 bg-red-50/30">
                            <h4 className="font-black text-red-600 text-sm mb-2 flex justify-between">الفريق الأحمر 🔴 <span>({team1.length})</span></h4>
                            <div className="space-y-1">
                                {team1.map(id => (
                                    <div key={id} className="flex justify-between items-center bg-white p-2 rounded-lg text-xs shadow-sm">
                                        <span className="truncate">{getEmpName(id)}</span>
                                        <button onClick={() => removeFromTeam(1, id)} className="text-red-400 hover:text-red-600"><Trash2 size={12}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="border-2 border-blue-100 rounded-xl p-3 bg-blue-50/30">
                            <h4 className="font-black text-blue-600 text-sm mb-2 flex justify-between">الفريق الأزرق 🔵 <span>({team2.length})</span></h4>
                            <div className="space-y-1">
                                {team2.map(id => (
                                    <div key={id} className="flex justify-between items-center bg-white p-2 rounded-lg text-xs shadow-sm">
                                        <span className="truncate">{getEmpName(id)}</span>
                                        <button onClick={() => removeFromTeam(2, id)} className="text-red-400 hover:text-red-600"><Trash2 size={12}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500">نقاط الفائز (لكل عضو) 🏆</label>
                        <input type="number" value={points} onChange={e => setPoints(Number(e.target.value))} className="w-full p-3 bg-gray-50 rounded-xl border mt-1 font-bold text-center"/>
                    </div>
                    <button onClick={handleCreate} disabled={loading} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold mt-4 flex justify-center gap-2 hover:bg-purple-700 shadow-lg">
                        {loading ? <Loader2 className="animate-spin"/> : '🔥 إطلاق التحدي الجماعي'}
                    </button>
                </div>
            </div>
        </div>
    );
}
