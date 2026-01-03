import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Inbox, CheckCircle, XCircle, ArrowRight, Calendar, User, Loader2 } from 'lucide-react';

interface Props {
    employee: Employee; // الموظف الحالي (البديل المحتمل)
}

export default function ShiftRequestsTab({ employee }: Props) {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchRequests = async () => {
        setLoading(true);
        // جلب الطلبات المرسلة إلي (أنا الـ recipient) وحالتها 'pending_recipient'
        const { data, error } = await supabase
            .from('shift_swap_requests')
            .select(`
                *,
                requester: requester_id ( name, specialty ) 
            `) 
            // ملاحظة: الـ requester_id هنا هو كود وظيفي، لو الربط صعب في Supabase بسبب اختلاف الأنواع
            // يمكننا جلب الأسماء يدوياً لاحقاً، لكن سنفترض الآن أننا نجلب الاسم
            .eq('recipient_id', employee.employee_id)
            .eq('status', 'pending_recipient')
            .order('created_at', { ascending: false });

        if (error) console.error(error);
        
        // إذا لم يعمل الربط (Foreign Key) بشكل مباشر، سنجلب اسم الزميل يدوياً
        if (data) {
            const enrichedData = await Promise.all(data.map(async (req) => {
                const { data: emp } = await supabase
                    .from('employees')
                    .select('name')
                    .eq('employee_id', req.requester_id)
                    .single();
                return { ...req, requester_name: emp?.name || req.requester_id };
            }));
            setRequests(enrichedData);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchRequests();
    }, [employee.employee_id]);

    // ✅ الدالة الخطيرة: تنفيذ التبادل وتحديث الـ JSON
    const handleApprove = async (request: any) => {
        if (!confirm(`هل أنت متأكد من قبول نوبتجية يوم ${request.schedule_date} بدلاً من د. ${request.requester_name}؟`)) return;
        
        setProcessingId(request.id);

        try {
            // 1. جلب الجدول الأصلي
            const { data: schedule, error: schError } = await supabase
                .from('evening_schedules')
                .select('*')
                .eq('date', request.schedule_date)
                .single();

            if (schError || !schedule) throw new Error('لم يتم العثور على الجدول الأصلي!');

            // 2. تعديل الـ JSON (استبدال الزميل بي أنا)
            let doctorsArray = schedule.doctors || [];
            
            // التأكد أن الزميل موجود فعلاً في الجدول قبل الحذف
            const requesterIndex = doctorsArray.findIndex((doc: any) => 
                doc.employee_id === request.requester_id || doc.id === request.requester_id
            );

            if (requesterIndex === -1) {
                throw new Error('الزميل طالب التبديل غير موجود في الجدول الأصلي لهذا اليوم!');
            }

            // نقوم بالاستبدال
            // نحتفظ بنفس هيكل الكائن (سواء كان نص أو كائن)
            const newDoctorObject = { 
                employee_id: employee.employee_id, 
                name: employee.name,
                specialty: employee.specialty 
            };
            
            doctorsArray[requesterIndex] = newDoctorObject;

            // 3. تحديث الجدول في القاعدة
            const { error: updateError } = await supabase
                .from('evening_schedules')
                .update({ doctors: doctorsArray })
                .eq('id', schedule.id);

            if (updateError) throw updateError;

            // 4. تحديث حالة الطلب إلى Approved
            await supabase
                .from('shift_swap_requests')
                .update({ status: 'approved' })
                .eq('id', request.id);

            // 5. إرسال إشعار للزميل (Requester)
            // نحتاج معرفة الـ User UID للزميل لإرسال الإشعار
            const { data: requesterUser } = await supabase.from('employees').select('id').eq('employee_id', request.requester_id).single();
            if (requesterUser) {
                await supabase.from('notifications').insert({
                    user_id: requesterUser.id, // User UID
                    title: 'تم قبول التبديل ✅',
                    message: `وافق د. ${employee.name} على طلب التبديل ليوم ${request.schedule_date}. تم تحديث الجدول.`,
                    is_read: false
                });
            }

            // إشعار للمدير
            const { data: admins } = await supabase.from('employees').select('employee_id').eq('role', 'admin');
            if (admins) {
                 await supabase.from('notifications').insert(admins.map(a => ({
                     user_id: a.employee_id, // هنا يجب التأكد أننا نرسل للـ UID أو نعتمد على النظام
                     title: 'تحديث في الجدول',
                     message: `تم تبديل نوبتجية يوم ${request.schedule_date} بين د. ${request.requester_name} و د. ${employee.name}`,
                     is_read: false
                 })));
            }

            alert('تم العملية بنجاح! أصبح الجدول باسمك الآن.');
            fetchRequests(); // تحديث القائمة

        } catch (err: any) {
            alert('حدث خطأ: ' + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (requestId: string) => {
        if (!confirm('هل تريد رفض الطلب؟')) return;
        setProcessingId(requestId);
        
        const { error } = await supabase
            .from('shift_swap_requests')
            .update({ status: 'rejected' })
            .eq('id', requestId);

        if (!error) {
            fetchRequests();
        }
        setProcessingId(null);
    };

    return (
        <div className="space-y-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Inbox className="w-5 h-5 text-purple-600"/> طلبات التبديل الواردة
            </h3>

            {loading ? (
                <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-600"/></div>
            ) : requests.length === 0 ? (
                <div className="bg-gray-50 rounded-2xl p-6 text-center border border-dashed text-gray-400 font-bold text-sm">
                    لا توجد طلبات واردة حالياً
                </div>
            ) : (
                <div className="grid gap-3">
                    {requests.map(req => (
                        <div key={req.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 animate-in slide-in-from-right">
                            <div className="flex items-center gap-4">
                                <div className="bg-purple-100 p-3 rounded-full">
                                    <ArrowRight className="w-5 h-5 text-purple-600"/>
                                </div>
                                <div>
                                    <h4 className="font-black text-gray-800 text-sm mb-1">طلب تبديل من د. {req.requester_name}</h4>
                                    <div className="flex gap-3 text-xs text-gray-500 font-bold">
                                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {req.schedule_date}</span>
                                        <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">بانتظار موافقتك</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 w-full md:w-auto">
                                <button 
                                    onClick={() => handleApprove(req)}
                                    disabled={processingId === req.id}
                                    className="flex-1 md:flex-none bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4"/>}
                                    موافقة
                                </button>
                                <button 
                                    onClick={() => handleReject(req.id)}
                                    disabled={processingId === req.id}
                                    className="flex-1 md:flex-none bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                                >
                                    <XCircle className="w-4 h-4"/>
                                    رفض
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
