import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Swords, Plus, Trash2, Trophy, Loader2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import CreateCompetitionModal from './CreateCompetitionModal';

export default function CompetitionsManager() {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const queryClient = useQueryClient();

    // 1. جلب المسابقات (بدون Joins معقدة لأننا نستخدم Arrays الآن)
    const { data: competitions = [], isLoading } = useQuery({
        queryKey: ['admin_competitions'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('competitions')
                .select('*')
                .order('created_at', { ascending: false });
                
            if (error) {
                console.error("Error fetching competitions:", error);
                return [];
            }
            return data || [];
        }
    });

    // 2. دالة الحذف المحدثة
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('competitions').delete().eq('id', id);
            if (error) throw error;

            // إرسال إشعار لحظي لتحديث شاشات الموظفين
            supabase.functions.invoke('send-push-notification', {
                body: { 
                    userId: 'all', 
                    title: 'تحديث في المسابقات 🔄', 
                    body: 'تم إنهاء إحدى المسابقات', 
                    url: '/staff?tab=arcade' 
                }
            }).catch(() => {});
        },
        onSuccess: () => {
            toast.success('تم الحذف بنجاح');
            queryClient.invalidateQueries({ queryKey: ['admin_competitions'] });
        },
        onError: (err: any) => toast.error('خطأ في الحذف: ' + err.message)
    });

    if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-purple-600"/></div>;

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                        <Swords className="text-purple-600" /> إدارة التحديات والمسابقات
                    </h2>
                    <p className="text-sm font-bold text-gray-500 mt-1">تحديات الفرق ومكافآت النقاط</p>
                </div>
                <button 
                    onClick={() => setShowCreateModal(true)}
                    className="bg-purple-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-purple-200 hover:bg-purple-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                    <Plus size={20}/> مسابقة جديدة
                </button>
            </div>

            {/* Grid of Competitions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {competitions.map((comp: any) => {
                    const team1Count = comp.team1_ids ? comp.team1_ids.length : 0;
                    const team2Count = comp.team2_ids ? comp.team2_ids.length : 0;
                    const isCompleted = comp.status === 'completed';

                    return (
                        <div key={comp.id} className={`bg-white rounded-3xl p-6 shadow-sm border-2 transition-all group ${isCompleted ? 'border-gray-200 opacity-75' : 'border-purple-100 hover:border-purple-400 hover:shadow-xl hover:-translate-y-1'}`}>
                            
                            {/* Header: Status & Points */}
                            <div className="flex justify-between items-center mb-6">
                                <span className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 ${isCompleted ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700 animate-pulse'}`}>
                                    <div className={`w-2 h-2 rounded-full ${isCompleted ? 'bg-gray-400' : 'bg-green-500'}`}></div>
                                    {isCompleted ? 'منتهية' : 'نشطة الآن'}
                                </span>
                                <span className="bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 border border-yellow-200 shadow-sm">
                                    <Trophy size={14}/> {comp.points_reward} نقطة
                                </span>
                            </div>

                            {/* Versus Section (Team System) */}
                            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6 relative">
                                <div className="text-center flex-1 z-10">
                                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner border border-white">
                                        <Users size={20}/>
                                    </div>
                                    <p className="font-black text-sm text-gray-800">الفريق الأول</p>
                                    <p className="text-[10px] text-gray-500 font-bold bg-white px-2 py-0.5 rounded-md mt-1 border inline-block">{team1Count} أفراد</p>
                                </div>
                                
                                <div className="absolute left-1/2 -translate-x-1/2 w-10 h-10 bg-white border-4 border-gray-50 rounded-full flex items-center justify-center z-20 shadow-sm">
                                    <span className="font-black text-xs text-gray-400">VS</span>
                                </div>

                                <div className="text-center flex-1 z-10">
                                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner border border-white">
                                        <Users size={20}/>
                                    </div>
                                    <p className="font-black text-sm text-gray-800">الفريق الثاني</p>
                                    <p className="text-[10px] text-gray-500 font-bold bg-white px-2 py-0.5 rounded-md mt-1 border inline-block">{team2Count} أفراد</p>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="text-center mb-6">
                                <p className="text-xs font-bold text-gray-500 flex items-center justify-center gap-1">
                                    <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-lg border border-purple-100">الأسئلة: {comp.questions?.length || 0}</span>
                                    <span className="text-gray-300">•</span>
                                    <span className="text-[10px]">{new Date(comp.created_at).toLocaleDateString('ar-EG')}</span>
                                </p>
                            </div>

                            {/* Action Button */}
                            <button 
                                onClick={() => { if(confirm('⚠️ هل أنت متأكد من حذف هذه المسابقة نهائياً؟')) deleteMutation.mutate(comp.id); }}
                                className="w-full py-2.5 text-red-500 hover:bg-red-50 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 border border-transparent hover:border-red-100"
                            >
                                <Trash2 className="w-4 h-4"/> حذف المسابقة
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* حالة عدم وجود مسابقات */}
            {competitions.length === 0 && (
                <div className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-gray-200">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Swords className="w-10 h-10 text-gray-200"/>
                    </div>
                    <p className="text-gray-400 font-black text-lg">لا توجد مسابقات مسجلة حالياً</p>
                    <p className="text-gray-300 text-sm font-bold">اضغط على "مسابقة جديدة" لبدء التحدي بين الموظفين</p>
                </div>
            )}

            {showCreateModal && <CreateCompetitionModal onClose={() => setShowCreateModal(false)} />}
        </div>
    );
}
