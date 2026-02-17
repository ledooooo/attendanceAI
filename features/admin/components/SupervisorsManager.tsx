import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    ShieldCheck, Clock, CheckCircle, XCircle, Trash2, 
    Building2, Briefcase, Phone, Mail, Loader2, UserCheck, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SupervisorsManager() {
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<'pending' | 'approved'>('pending');

    // 1. جلب بيانات المشرفين
    const { data: supervisors = [], isLoading } = useQuery({
        queryKey: ['admin_supervisors'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('supervisors')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data || [];
        }
    });

    // تقسيم البيانات حسب الحالة
    const pendingRequests = supervisors.filter(s => s.status === 'pending');
    const approvedSupervisors = supervisors.filter(s => s.status === 'approved');

    // 2. دالة تحديث حالة المشرف (قبول / رفض)
    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, newStatus, email, name }: { id: string, newStatus: string, email: string, name: string }) => {
            const { error } = await supabase
                .from('supervisors')
                .update({ status: newStatus })
                .eq('id', id);
            
            if (error) throw error;

            // إذا تم القبول، يمكننا إرسال إشعار ترحيبي يراه فور تسجيل دخوله الأول
            if (newStatus === 'approved') {
                await supabase.from('notifications').insert({
                    user_id: id,
                    type: 'welcome',
                    title: '🎉 مرحباً بك في مركز غرب المطار',
                    message: `أهلاً بك أستاذ ${name}. تم تفعيل حسابك الإشرافي بنجاح. يرجى استكمال ملفك الشخصي للحصول على نقاط إضافية.`,
                });
            }
            
            return { newStatus, email };
        },
        onSuccess: (data) => {
            if (data.newStatus === 'approved') {
                toast.success('تم قبول المشرف وتفعيل حسابه بنجاح! ✅');
                // تذكير للمدير ليقوم بمراسلته
                toast('لا تنسَ إبلاغه عبر الواتساب أو الإيميل بأنه يمكنه الدخول الآن.', { icon: '💡', duration: 5000 });
            } else {
                toast.error('تم رفض الطلب.');
            }
            queryClient.invalidateQueries({ queryKey: ['admin_supervisors'] });
            queryClient.invalidateQueries({ queryKey: ['admin_badges'] }); // لتحديث عداد القائمة الجانبية
        },
        onError: (err: any) => toast.error(err.message)
    });

    // 3. دالة حذف مشرف
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            // ملاحظة: هذا يحذفه من جدول المشرفين فقط، لحذفه نهائياً من المصادقة يتطلب Edge Function
            const { error } = await supabase.from('supervisors').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم حذف المشرف بنجاح');
            queryClient.invalidateQueries({ queryKey: ['admin_supervisors'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    if (isLoading) {
        return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-blue-600"/></div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in pb-10">
            {/* Header */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-blue-600"/> إدارة المشرفين
                    </h2>
                    <p className="text-gray-500 text-sm mt-1 font-bold">مراجعة واعتماد حسابات الإشراف الخارجي والإداري</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 pb-2">
                <button 
                    onClick={() => setFilter('pending')} 
                    className={`px-6 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${filter === 'pending' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    <Clock className="w-4 h-4"/> طلبات جديدة
                    {pendingRequests.length > 0 && <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingRequests.length}</span>}
                </button>
                <button 
                    onClick={() => setFilter('approved')} 
                    className={`px-6 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${filter === 'approved' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    <UserCheck className="w-4 h-4"/> المشرفين المعتمدين
                    <span className="bg-gray-200 text-gray-700 text-[10px] px-2 py-0.5 rounded-full">{approvedSupervisors.length}</span>
                </button>
            </div>

            {/* Content List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(filter === 'pending' ? pendingRequests : approvedSupervisors).length === 0 ? (
                    <div className="col-span-full text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-bold">لا توجد سجلات في هذا القسم حالياً.</p>
                    </div>
                ) : (
                    (filter === 'pending' ? pendingRequests : approvedSupervisors).map((sup: any) => (
                        <div key={sup.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-4 relative overflow-hidden transition-all hover:shadow-md">
                            
                            {/* شريط علوي ملون حسب الحالة */}
                            <div className={`absolute top-0 left-0 right-0 h-1.5 ${filter === 'pending' ? 'bg-orange-400' : 'bg-green-500'}`}></div>

                            <div className="flex items-start gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center text-3xl border shadow-sm shrink-0">
                                    {sup.avatar_url || "👨‍💼"}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-black text-gray-800 text-lg">{sup.name}</h3>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <span className="flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">
                                            <Briefcase className="w-3 h-3"/> {sup.role_title}
                                        </span>
                                        <span className="flex items-center gap-1 text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-1 rounded-lg">
                                            <Building2 className="w-3 h-3"/> {sup.organization}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-2xl space-y-2 border border-gray-100">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                                    <Mail className="w-4 h-4 text-gray-400"/> <span dir="ltr">{sup.email}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                                    <Phone className="w-4 h-4 text-gray-400"/> <span dir="ltr">{sup.phone}</span>
                                </div>
                            </div>

                            {/* أزرار الإجراءات */}
                            {filter === 'pending' ? (
                                <div className="flex gap-2 mt-auto pt-2 border-t border-gray-50">
                                    <button 
                                        onClick={() => updateStatusMutation.mutate({ id: sup.id, newStatus: 'approved', email: sup.email, name: sup.name })}
                                        disabled={updateStatusMutation.isPending}
                                        className="flex-1 bg-green-500 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-green-600 flex items-center justify-center gap-2 transition-all shadow-sm shadow-green-200"
                                    >
                                        {updateStatusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4"/>} قبول واعتماد
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if(window.confirm('هل أنت متأكد من رفض هذا الطلب؟')) {
                                                updateStatusMutation.mutate({ id: sup.id, newStatus: 'rejected', email: sup.email, name: sup.name });
                                            }
                                        }}
                                        disabled={updateStatusMutation.isPending}
                                        className="bg-red-50 text-red-600 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-red-100 flex items-center justify-center transition-all"
                                        title="رفض الطلب"
                                    >
                                        <XCircle className="w-4 h-4"/>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2 mt-auto pt-2 border-t border-gray-50 justify-between items-center">
                                    <div className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                                        <Clock className="w-3 h-3"/> انضم في: {new Date(sup.created_at).toLocaleDateString('ar-EG')}
                                    </div>
                                    <button 
                                        onClick={() => {
                                            if(window.confirm('تأكيد إزالة هذا المشرف من النظام؟')) {
                                                deleteMutation.mutate(sup.id);
                                            }
                                        }}
                                        disabled={deleteMutation.isPending}
                                        className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-xl transition-colors"
                                        title="حذف المشرف"
                                    >
                                        {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
