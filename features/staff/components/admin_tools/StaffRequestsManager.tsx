import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../supabaseClient';
import { Check, X, Filter, Loader2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StaffRequestsManager() {
    const queryClient = useQueryClient();
    const [filterStatus, setFilterStatus] = useState('pending'); // الافتراضي: الطلبات المعلقة

    // جلب الطلبات
    const { data: requests = [], isLoading } = useQuery({
        queryKey: ['staff_admin_requests', filterStatus],
        queryFn: async () => {
            let query = supabase
                .from('leave_requests')
                .select('*, employees(name, specialty)')
                .order('created_at', { ascending: false });
            
            if (filterStatus !== 'all') {
                query = query.eq('status', filterStatus);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            return data;
        }
    });

    // تحديث حالة الطلب
    const updateStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string, status: string }) => {
            await supabase.from('leave_requests').update({ status }).eq('id', id);
        },
        onSuccess: () => {
            toast.success('تم تحديث حالة الطلب');
            queryClient.invalidateQueries({ queryKey: ['staff_admin_requests'] });
        }
    });

    return (
        <div className="space-y-6">
            {/* الفلتر */}
            <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm border w-fit mx-auto no-print">
                {['pending', 'approved', 'rejected', 'all'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            filterStatus === status ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                        {status === 'pending' ? 'معلق' : status === 'approved' ? 'مقبول' : status === 'rejected' ? 'مرفوض' : 'الكل'}
                    </button>
                ))}
            </div>

            {/* قائمة الطلبات */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isLoading ? <div className="col-span-2 text-center py-10"><Loader2 className="animate-spin mx-auto"/></div> :
                 requests.length === 0 ? <div className="col-span-2 text-center py-10 text-gray-400 font-bold border-2 border-dashed rounded-3xl">لا توجد طلبات في هذه القائمة</div> :
                 requests.map((req: any) => (
                    <div key={req.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                        {/* شريط جانبي ملون حسب الحالة */}
                        <div className={`absolute top-0 right-0 w-1.5 h-full ${
                            req.status === 'pending' ? 'bg-orange-400' : 
                            req.status === 'approved' ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>

                        <div className="flex justify-between items-start mb-3 mr-3">
                            <div>
                                <h3 className="font-black text-gray-800 text-lg">{req.employees?.name}</h3>
                                <p className="text-xs text-gray-500 font-bold">{req.employees?.specialty}</p>
                            </div>
                            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold">
                                {req.request_type}
                            </span>
                        </div>

                        <div className="bg-gray-50 p-3 rounded-xl mb-4 mr-3 text-sm text-gray-700 leading-relaxed border border-gray-100">
                            <div className="flex justify-between mb-1 text-xs text-gray-400 font-bold">
                                <span>من: {req.start_date}</span>
                                <span>إلى: {req.end_date}</span>
                            </div>
                            <p>السبب: {req.reason || 'لا يوجد تفاصيل'}</p>
                        </div>

                        {/* أزرار الإجراء (تظهر فقط للمعلق) */}
                        {req.status === 'pending' && (
                            <div className="flex gap-2 mr-3 border-t pt-3 mt-2">
                                <button 
                                    onClick={() => updateStatus.mutate({ id: req.id, status: 'approved' })}
                                    className="flex-1 bg-green-50 text-green-700 py-2 rounded-xl font-bold hover:bg-green-100 flex items-center justify-center gap-1 text-sm"
                                >
                                    <Check className="w-4 h-4"/> قبول
                                </button>
                                <button 
                                    onClick={() => updateStatus.mutate({ id: req.id, status: 'rejected' })}
                                    className="flex-1 bg-red-50 text-red-700 py-2 rounded-xl font-bold hover:bg-red-100 flex items-center justify-center gap-1 text-sm"
                                >
                                    <X className="w-4 h-4"/> رفض
                                </button>
                            </div>
                        )}
                        
                        {req.status !== 'pending' && (
                            <div className={`mr-3 text-center py-2 rounded-xl font-bold text-sm ${req.status === 'approved' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                                تم {req.status === 'approved' ? 'الموافقة' : 'الرفض'}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
