import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient'; // تم تعديل المسار
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Swords, Plus, Trash2, Trophy, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import CreateCompetitionModal from './CreateCompetitionModal'; // استيراد مباشر من نفس المجلد

export default function CompetitionsManager() {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const queryClient = useQueryClient();

    const { data: competitions = [], isLoading } = useQuery({
        queryKey: ['admin_competitions'],
        queryFn: async () => {
            const { data } = await supabase
                .from('competitions')
                .select(`
                    *,
                    player1:employees!player1_id(name),
                    player2:employees!player2_id(name),
                    winner:employees!winner_id(name)
                `)
                .order('created_at', { ascending: false });
            return data || [];
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('competitions').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم حذف المسابقة');
            queryClient.invalidateQueries({ queryKey: ['admin_competitions'] });
        },
        onError: () => toast.error('فشل الحذف')
    });

    if (isLoading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600"/></div>;

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                        <Swords className="w-6 h-6 text-purple-600"/> إدارة التحديات والمسابقات
                    </h2>
                    <p className="text-gray-500 text-sm mt-1 font-bold">إنشاء مسابقات الفرق للموظفين</p>
                </div>
                <button 
                    onClick={() => setShowCreateModal(true)}
                    className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-700 flex items-center gap-2 shadow-lg shadow-purple-200 transition-all"
                >
                    <Plus className="w-5 h-5"/> مسابقة جديدة
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {competitions.map((comp: any) => (
                    <div key={comp.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                        <div className={`absolute top-0 right-0 left-0 h-1 ${comp.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        
                        <div className="flex justify-between items-center mb-4 mt-2">
                            <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${comp.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                                {comp.status === 'active' ? 'جـاريـة 🔥' : 'منتهية ✅'}
                            </span>
                            <span className="text-[10px] font-bold text-gray-400">{new Date(comp.created_at).toLocaleDateString('ar-EG')}</span>
                        </div>

                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl mb-4">
                            <div className="text-center w-1/3">
                                <p className="text-xs font-bold text-gray-800 truncate">
                                    {comp.team1_ids && comp.team1_ids.length > 0 ? 'فريق أحمر' : comp.player1?.name}
                                </p>
                                <p className="text-lg font-black text-purple-600">{comp.player1_score}</p>
                            </div>
                            <div className="text-center w-1/3">
                                <span className="text-xs font-black text-gray-400">VS</span>
                            </div>
                            <div className="text-center w-1/3">
                                <p className="text-xs font-bold text-gray-800 truncate">
                                    {comp.team2_ids && comp.team2_ids.length > 0 ? 'فريق أزرق' : comp.player2?.name}
                                </p>
                                <p className="text-lg font-black text-purple-600">{comp.player2_score}</p>
                            </div>
                        </div>

                        {comp.winner && (
                            <div className="flex items-center justify-center gap-2 text-yellow-600 bg-yellow-50 p-2 rounded-lg mb-4 text-xs font-bold">
                                <Trophy className="w-4 h-4"/> الفائز: {comp.winner?.name || (comp.player1_score > comp.player2_score ? 'الفريق الأحمر' : 'الفريق الأزرق')}
                            </div>
                        )}

                        <button 
                            onClick={() => { if(confirm('هل أنت متأكد من حذف هذه المسابقة؟')) deleteMutation.mutate(comp.id); }}
                            className="w-full py-2 text-red-500 hover:bg-red-50 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100"
                        >
                            <Trash2 className="w-4 h-4"/> حذف المسابقة
                        </button>
                    </div>
                ))}
            </div>

            {competitions.length === 0 && (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed">
                    <Swords className="w-16 h-16 text-gray-200 mx-auto mb-4"/>
                    <p className="text-gray-400 font-bold">لا توجد مسابقات حالياً</p>
                </div>
            )}

            {showCreateModal && <CreateCompetitionModal onClose={() => setShowCreateModal(false)} />}
        </div>
    );
}
