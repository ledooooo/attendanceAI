import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Swords, Plus, Trash2, Trophy, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import CreateCompetitionModal from './CreateCompetitionModal';

export default function CompetitionsManager() {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const queryClient = useQueryClient();

    // 1. جلب المسابقات مع بيانات اللاعبين
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

    // 2. دالة الحذف المحدثة بنظام الإشعارات اللحظية
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            // أ) حذف المسابقة من قاعدة البيانات
            const { error } = await supabase.from('competitions').delete().eq('id', id);
            if (error) throw error;

            // ب) إرسال إشعار لحظي "تحديث" للموظفين النشطين لإخفاء المسابقة من واجهاتهم
            try {
                const { data: allEmps } = await supabase.from('employees').select('employee_id').eq('status', 'نشط');
                if (allEmps && allEmps.length > 0) {
                    const notifTitle = '🗑️ تحديث المسابقات';
                    const notifBody = 'تمت إزالة إحدى المسابقات من جدول التحديات الحالية.';

                    // إرسال Push Notification (بدون حفظ في الداتابيز لتجنب إزعاج الموظفين بإشعارات الحذف الدائمة)
                    Promise.all(allEmps.map(emp => 
                        supabase.functions.invoke('send-push-notification', {
                            body: { 
                                userId: String(emp.employee_id), 
                                title: notifTitle, 
                                body: notifBody, 
                                url: '/staff?tab=news' 
                            }
                        })
                    )).catch(e => console.error("Push Delete Comp Error:", e));
                }
            } catch (err) {
                console.error("Notification trigger error:", err);
            }
        },
        onSuccess: () => {
            toast.success('تم حذف المسابقة بنجاح وتحديث النظام 🚀');
            queryClient.invalidateQueries({ queryKey: ['admin_competitions'] });
        },
        onError: (err: any) => toast.error('فشل الحذف: ' + err.message)
    });

    if (isLoading) return (
        <div className="p-20 text-center flex flex-col items-center gap-3 text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin text-purple-600"/>
            <span className="font-bold">جاري تحميل سجل التحديات...</span>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* الهيدر */}
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                        <Swords className="w-6 h-6 text-purple-600"/> إدارة التحديات والمسابقات
                    </h2>
                    <p className="text-gray-500 text-sm mt-1 font-bold">إنشاء وإدارة مسابقات الفرق والموظفين المباشرة</p>
                </div>
                <button 
                    onClick={() => setShowCreateModal(true)}
                    className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-700 flex items-center gap-2 shadow-lg shadow-purple-200 transition-all active:scale-95"
                >
                    <Plus className="w-5 h-5"/> مسابقة جديدة
                </button>
            </div>

            {/* شبكة المسابقات */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {competitions.map((comp: any) => (
                    <div key={comp.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                        {/* شريط الحالة العلوي */}
                        <div className={`absolute top-0 right-0 left-0 h-1.5 ${comp.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        
                        <div className="flex justify-between items-center mb-4 mt-2">
                            <span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${
                                comp.status === 'active' 
                                ? 'bg-green-50 text-green-600 border-green-100' 
                                : 'bg-gray-100 text-gray-500 border-gray-200'
                            }`}>
                                {comp.status === 'active' ? 'جـاريـة الآن 🔥' : 'تم الانتهاء ✅'}
                            </span>
                            <span className="text-[10px] font-bold text-gray-400 font-mono">
                                {new Date(comp.created_at).toLocaleDateString('ar-EG')}
                            </span>
                        </div>

                        {/* منطقة النتيجة واللاعبين */}
                        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl mb-4 border border-gray-100">
                            <div className="text-center w-[40%]">
                                <p className="text-xs font-black text-gray-800 truncate mb-1">
                                    {comp.team1_ids && comp.team1_ids.length > 0 ? 'الفريق الأحمر' : comp.player1?.name}
                                </p>
                                <p className="text-2xl font-black text-purple-600">{comp.player1_score}</p>
                            </div>
                            <div className="text-center w-[20%]">
                                <span className="text-xs font-black text-gray-300 italic">VS</span>
                            </div>
                            <div className="text-center w-[40%]">
                                <p className="text-xs font-black text-gray-800 truncate mb-1">
                                    {comp.team2_ids && comp.team2_ids.length > 0 ? 'الفريق الأزرق' : comp.player2?.name}
                                </p>
                                <p className="text-2xl font-black text-purple-600">{comp.player2_score}</p>
                            </div>
                        </div>

                        {/* الفائز */}
                        {comp.winner && (
                            <div className="flex items-center justify-center gap-2 text-yellow-700 bg-yellow-50 p-2.5 rounded-xl mb-4 text-xs font-black border border-yellow-100 animate-pulse">
                                <Trophy className="w-4 h-4 text-yellow-500"/> الفائز: {comp.winner?.name || (comp.player1_score > comp.player2_score ? 'الفريق الأحمر' : 'الفريق الأزرق')}
                            </div>
                        )}

                        {/* زر الحذف */}
                        <button 
                            onClick={() => { if(confirm('⚠️ هل أنت متأكد من حذف هذه المسابقة نهائياً من سجلات جميع الموظفين؟')) deleteMutation.mutate(comp.id); }}
                            className="w-full py-2.5 text-red-500 hover:bg-red-50 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 border border-transparent hover:border-red-100"
                        >
                            <Trash2 className="w-4 h-4"/> حذف المسابقة
                        </button>
                    </div>
                ))}
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
