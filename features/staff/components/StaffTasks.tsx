import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, CheckCircle2, AlertCircle, Play, Eye, FileText, Send } from 'lucide-react';

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

    // 2. تغيير الحالة (الدورة الكاملة + التنبيهات)
    const updateStatusMutation = useMutation({
        mutationFn: async ({ taskId, newStatus, replyNote }: { taskId: string, newStatus: string, replyNote?: string }) => {
            
            // تحديث الجدول
            const updates: any = { status: newStatus };
            if (newStatus === 'completed') {
                updates.completed_at = new Date();
                updates.response_note = replyNote;
            }

            const { error } = await supabase.from('tasks').update(updates).eq('id', taskId);
            if (error) throw error;

            // تحديد رسالة التنبيه للمدير حسب الحالة
            let msg = '';
            let title = '';
            if (newStatus === 'acknowledged') {
                title = '👀 تم العلم';
                msg = `قام ${employee.name} بالاطلاع على التكليف`;
            } else if (newStatus === 'in_progress') {
                title = '🚀 جاري التنفيذ';
                msg = `بدأ ${employee.name} العمل على المهمة`;
            } else if (newStatus === 'completed') {
                title = '✅ تم الانتهاء';
                msg = `أنهى ${employee.name} المهمة: ${replyNote || ''}`;
            }

            // إرسال التنبيه للمدير
            // هنا نفترض إرسال لكل المديرين "admin"، يمكن تخصيصها لـ manager_id المحدد
            const { data: admins } = await supabase.from('employees').select('employee_id').eq('role', 'admin');
            if (admins) {
                const notifications = admins.map(a => ({
                    user_id: a.employee_id,
                    title: title,
                    message: msg,
                    type: 'task_update',
                    is_read: false
                }));
                await supabase.from('notifications').insert(notifications);
            }
        },
        onSuccess: () => {
            toast.success('تم تحديث الحالة وإبلاغ الإدارة');
            queryClient.invalidateQueries({ queryKey: ['staff_tasks'] });
        },
        onError: () => toast.error('حدث خطأ')
    });

    if (isLoading) return <div className="text-center py-10">جاري تحميل التكليفات...</div>;

    return (
        <div className="space-y-4 animate-in slide-in-from-bottom">
            <h3 className="font-black text-gray-800 flex items-center gap-2 text-lg">
                <FileText className="w-6 h-6 text-purple-600"/> التكليفات والإشارات
            </h3>

            {tasks.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed">
                    <p className="text-gray-400 font-bold">لا توجد تكليفات جديدة</p>
                </div>
            )}

            {tasks.map((task: any) => (
                <div key={task.id} className={`bg-white p-5 rounded-2xl border shadow-sm transition-all ${task.priority === 'urgent' ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-100'}`}>
                    
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h4 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                {task.priority === 'urgent' && <AlertCircle className="w-4 h-4 text-red-500 animate-pulse"/>}
                                {task.title}
                            </h4>
                            <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                        </div>
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded font-mono">
                            {new Date(task.created_at).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}
                        </span>
                    </div>

                    {/* Actions Area */}
                    <div className="mt-4 pt-3 border-t border-gray-50 flex flex-col gap-3">
                        
                        {/* الحالة 1: جديد (معلق) -> زر "تم العلم" */}
                        {task.status === 'pending' && (
                            <button 
                                onClick={() => updateStatusMutation.mutate({ taskId: task.id, newStatus: 'acknowledged' })}
                                className="w-full bg-blue-50 text-blue-700 py-2 rounded-xl font-bold text-sm hover:bg-blue-100 flex items-center justify-center gap-2 transition-colors"
                            >
                                <Eye className="w-4 h-4"/> تم العلم
                            </button>
                        )}

                        {/* الحالة 2: تم العلم -> زر "جاري التنفيذ" */}
                        {task.status === 'acknowledged' && (
                            <button 
                                onClick={() => updateStatusMutation.mutate({ taskId: task.id, newStatus: 'in_progress' })}
                                className="w-full bg-orange-50 text-orange-700 py-2 rounded-xl font-bold text-sm hover:bg-orange-100 flex items-center justify-center gap-2 transition-colors"
                            >
                                <Play className="w-4 h-4"/> بدء التنفيذ
                            </button>
                        )}

                        {/* الحالة 3: جاري التنفيذ -> نموذج الإنتهاء */}
                        {task.status === 'in_progress' && (
                            <div className="space-y-2 animate-in fade-in">
                                <textarea 
                                    className="w-full p-3 bg-gray-50 border rounded-xl text-sm"
                                    placeholder="ملاحظات الانتهاء (اختياري)..."
                                    value={notes[task.id] || ''}
                                    onChange={(e) => setNotes({...notes, [task.id]: e.target.value})}
                                />
                                <button 
                                    onClick={() => updateStatusMutation.mutate({ taskId: task.id, newStatus: 'completed', replyNote: notes[task.id] })}
                                    className="w-full bg-green-600 text-white py-2 rounded-xl font-bold text-sm hover:bg-green-700 flex items-center justify-center gap-2 transition-colors shadow-md"
                                >
                                    <CheckCircle2 className="w-4 h-4"/> إبلاغ بالانتهاء
                                </button>
                            </div>
                        )}

                        {/* الحالة 4: منتهي */}
                        {task.status === 'completed' && (
                            <div className="bg-green-50 p-2 rounded-lg text-center">
                                <span className="text-green-700 font-bold text-xs flex items-center justify-center gap-1">
                                    <CheckCircle2 className="w-3 h-3"/> المهمة مكتملة
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
