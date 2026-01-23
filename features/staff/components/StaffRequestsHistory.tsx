import React from 'react';
import { supabase } from '../../../supabaseClient';
import { Clock, CheckCircle2, XCircle, Trash2, AlertCircle, FileText, Loader2, RefreshCw } from 'lucide-react';
import { Employee } from '../../../types';
import toast from 'react-hot-toast';
// 1. ✅ استيراد React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function StaffRequestsHistory({ employee }: { employee: Employee }) {
    const queryClient = useQueryClient();

    // ------------------------------------------------------------------
    // 1. 📥 جلب سجل الطلبات
    // ------------------------------------------------------------------
    const { data: requests = [], isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['staff_requests', employee.employee_id],
        queryFn: async () => {
            if (!employee?.employee_id) return [];
            const { data, error } = await supabase
                .from('leave_requests')
                .select('*')
                .eq('employee_id', employee.employee_id)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data;
        },
        enabled: !!employee.employee_id, // لا يعمل إلا بوجود رقم الموظف
        staleTime: 1000 * 60 * 5, // البيانات صالحة لمدة 5 دقائق
    });

    // ------------------------------------------------------------------
    // 2. 🗑️ حذف الطلب (Mutation)
    // ------------------------------------------------------------------
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('leave_requests')
                .delete()
                .eq('id', id)
                .eq('status', 'معلق'); // شرط أمني: حذف المعلق فقط

            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم حذف الطلب بنجاح');
            // تحديث القائمة فوراً
            queryClient.invalidateQueries({ queryKey: ['staff_requests'] });
        },
        onError: () => {
            toast.error('تعذر الحذف، قد يكون تم الرد على الطلب بالفعل');
            refetch(); // تحديث القائمة لرؤية الحالة الجديدة
        }
    });

    const handleCancel = (id: string) => {
        if (confirm('هل أنت متأكد من إلغاء هذا الطلب؟')) {
            deleteMutation.mutate(id);
        }
    };

    // ------------------------------------------------------------------
    // 3. 🎨 واجهة المستخدم
    // ------------------------------------------------------------------

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'مقبول': return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 w-fit"><CheckCircle2 className="w-3 h-3"/> مقبول</span>;
            case 'مرفوض': return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 w-fit"><XCircle className="w-3 h-3"/> مرفوض</span>;
            default: return <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 w-fit"><Clock className="w-3 h-3"/> معلق</span>;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                    <FileText className="w-6 h-6 text-orange-600"/> سجل الطلبات
                </h3>
                <button 
                    onClick={() => refetch()} 
                    disabled={isRefetching}
                    className="text-xs text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors"
                >
                    <RefreshCw className={`w-3 h-3 ${isRefetching ? 'animate-spin' : ''}`}/> تحديث
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-gray-400 flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500"/>
                    <span>جاري تحميل السجل...</span>
                </div>
            ) : requests.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                    <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3"/>
                    <p className="text-gray-500 font-bold">لا توجد طلبات سابقة</p>
                </div>
            ) : (
                <div className="overflow-x-auto border rounded-3xl shadow-sm bg-white custom-scrollbar">
                    <table className="w-full text-sm text-right min-w-[700px]">
                        <thead className="bg-gray-50 font-black text-gray-600 border-b">
                            <tr>
                                <th className="p-4">نوع الطلب</th>
                                <th className="p-4">التاريخ</th>
                                <th className="p-4">المدة</th>
                                <th className="p-4">الحالة</th>
                                <th className="p-4">ملاحظات</th>
                                <th className="p-4 text-center">إجراء</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {requests.map((req: any) => {
                                const days = Math.ceil((new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                return (
                                    <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 font-bold text-gray-800">{req.type}</td>
                                        <td className="p-4 text-gray-600 font-mono text-xs">
                                            {req.start_date} <span className="text-gray-300 mx-1">➜</span> {req.end_date}
                                        </td>
                                        <td className="p-4 text-blue-600 font-bold">{days} يوم</td>
                                        <td className="p-4">{getStatusBadge(req.status)}</td>
                                        <td className="p-4 text-gray-500 text-xs max-w-[150px] truncate" title={req.notes}>{req.notes || '-'}</td>
                                        <td className="p-4 text-center">
                                            {req.status === 'معلق' && (
                                                <button 
                                                    onClick={() => handleCancel(req.id)}
                                                    disabled={deleteMutation.isPending}
                                                    className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                                                    title="إلغاء الطلب"
                                                >
                                                    {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
