import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, CheckCircle2, AlertCircle, Play, Eye, FileText, Loader2 } from 'lucide-react';

export default function StaffTasks({ employee }: { employee: Employee }) {
    const queryClient = useQueryClient();
    const [notes, setNotes] = useState<{ [key: string]: string }>({});

    // 1. جلب تكليفات الموظف
    const { data: tasks = [], isLoading } = useQuery({
        queryKey: ['staff_tasks', employee.employee_id],
        queryFn: async () => {
            const { data } = await supabase
                .from('tasks')
                .select('*')
                .eq('employee_id', employee.employee_id)
                .order('created_at', { ascending: false });
            return data || [];
        },
        refetchInterval: 10000, 
    });

    // 2. تغيير الحالة (Mutation)
    const updateStatusMutation = useMutation({
        mutationFn: async ({ taskId, newStatus, replyNote }: { taskId: string, newStatus: string, replyNote?: string }) => {
            
            // أ) تحديث حالة المهمة في قاعدة البيانات
            const updates: any = { status: newStatus };
            if (newStatus === 'completed') {
                updates.completed_at = new Date();
                updates.response_note = replyNote;
            }

            const { error: updateError } = await supabase.from('tasks').update(updates).eq('id', taskId);
            if (updateError) throw updateError;

            // ب) تجهيز بيانات التنبيه
            let notifTitle = '';
            let notifMsg = '';

            if (newStatus === 'acknowledged') {
                notifTitle = '👀 تم العلم';
                notifMsg = `قام ${employee.name} بالاطلاع على التكليف`;
            } else if (newStatus === 'in_progress') {
                notifTitle = '🚀 جاري التنفيذ';
                notifMsg = `بدأ ${employee.name} العمل على المهمة`;
            } else if (newStatus === 'completed') {
                notifTitle = '✅ تم الانتهاء';
                notifMsg = `أنهى ${employee.name} المهمة: ${replyNote || ''}`;
            }

            // ج) 🔥 إرسال التنبيهات لكل من يحمل صلاحية 'admin' 🔥
            // التعديل: نجلب id (UUID) و employee_id
            const { data: admins } = await supabase
                .from('employees')
                .select('id, employee_id') // ✅ جلب المعرفين
                .eq('role', 'admin');
            
            if (admins && admins.length > 0) {
                await Promise.all(admins.map(async (admin) => {
                    
                    // 1. إشعار داخلي (للجرس)
                    await supabase.from('notifications').insert({
                        user_id: admin.id || admin.employee_id, // نفضل UUID لضمان المطابقة
                        title: notifTitle,
                        message: notifMsg,
                        type: 'task_update',
                        sender_name: employee.name, // ✅ إضافة اسم المرسل
                        is_read: false
                    });

                    // 2. إشعار خارجي (للموبايل) - يتطلب UUID
                    if (admin.id) {
                        await supabase.functions.invoke('send-push-notification', {
                            body: {
                                userId: admin.id, // ✅ استخدام UUID حصراً هنا
                                title: notifTitle,
                                body: notifMsg,
                                url: '/tasks' // يوجه المدير لصفحة التكليفات
                            }
                        });
                    }
                }));
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff_tasks'] });
            toast.success('تم تحديث الحالة وإبلاغ المدير');
        },
        onError: (err: any) => {
            console.error(err);
            toast.error('حدث خطأ أثناء التحديث');
        }
    });

    const handleUpdate = (taskId: string, newStatus: string, replyNote?: string) => {
        toast.promise(
            updateStatusMutation.mutateAsync({ taskId, newStatus, replyNote }),
            {
                loading: 'جاري التحديث...',
                success: 'تم التحديث بنجاح!',
                error: 'فشل التحديث'
            }
        );
    };

    if (isLoading) return <div className="text-center py-12 flex flex-col items-center gap-2 text-gray-400"><Loader2 className="w-8 h-8 animate-spin text-purple-600"/> جاري تحميل التكليفات...</div>;

    return (
        <div className="space-y-4 animate-in slide-in-from-bottom pb-20">
            <h3 className="font-black text-gray-800 flex items-center gap-2 text-lg border-b pb-2">
                <FileText className="w-6 h-6 text-purple-600"/> التكليفات والإشارات
            </h3>

            {tasks.length === 0 && (
                <div className="text-center py-16 bg-gray-50 rounded-[2.5rem] border border-dashed border-gray-200">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2"/>
                    <p className="text-gray-500 font-bold">لا توجد تكليفات جديدة</p>
                    <p className="text-xs text-gray-400">ستظهر هنا أي مهام يرسلها المدير لك</p>
                </div>
            )}

            {tasks.map((task: any) => (
                <div key={task.id} className={`bg-white p-5 rounded-2xl border shadow-sm transition-all hover:shadow-md ${task.priority === 'urgent' ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-100'}`}>
                    
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h4 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                {task.priority === 'urgent' && <AlertCircle className="w-4 h-4 text-red-500 animate-pulse"/>}
                                {task.title}
                            </h4>
                            <p className="text-xs text-gray-600 mt-1 leading-relaxed">{task.description}</p>
                        </div>
                        <span className="text-[10px] bg-gray-50 text-gray-400 px-2 py-1 rounded-lg font-mono border border-gray-100">
                            {new Date(task.created_at).toLocaleDateString('ar-EG')}
                        </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-50 flex flex-col gap-3">
                        {task.status === 'pending' && (
                            <button onClick={() => handleUpdate(task.id, 'acknowledged')} className="w-full bg-blue-50 text-blue-700 py-2.5 rounded-xl font-bold text-xs hover:bg-blue-100 flex items-center justify-center gap-2 transition-colors active:scale-95">
                                <Eye className="w-4 h-4"/> تأكيد العلم والاستلام
                            </button>
                        )}

                        {task.status === 'acknowledged' && (
                            <button onClick={() => handleUpdate(task.id, 'in_progress')} className="w-full bg-orange-50 text-orange-700 py-2.5 rounded-xl font-bold text-xs hover:bg-orange-100 flex items-center justify-center gap-2 transition-colors active:scale-95">
                                <Play className="w-4 h-4"/> بدء التنفيذ
                            </button>
                        )}

                        {task.status === 'in_progress' && (
                            <div className="space-y-3 animate-in fade-in">
                                <textarea 
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-green-500 transition-all resize-none h-20"
                                    placeholder="اكتب ملاحظات الانتهاء هنا (اختياري)..."
                                    value={notes[task.id] || ''}
                                    onChange={(e) => setNotes({...notes, [task.id]: e.target.value})}
                                />
                                <button onClick={() => handleUpdate(task.id, 'completed', notes[task.id])} className="w-full bg-green-600 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-green-700 flex items-center justify-center gap-2 transition-colors shadow-md shadow-green-200 active:scale-95">
                                    <CheckCircle2 className="w-4 h-4"/> إبلاغ بالانتهاء
                                </button>
                            </div>
                        )}

                        {task.status === 'completed' && (
                            <div className="bg-green-50 p-3 rounded-xl border border-green-100 text-center">
                                <span className="text-green-700 font-bold text-xs flex items-center justify-center gap-1 mb-1">
                                    <CheckCircle2 className="w-4 h-4"/> المهمة مكتملة
                                </span>
                                {task.response_note && <p className="text-[10px] text-green-600 mt-1">ملاحظاتك: {task.response_note}</p>}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
