import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, CheckCircle2, AlertCircle, Play, Eye, FileText, Loader2, Timer } from 'lucide-react';
import { sendSystemNotification } from '../../../utils/pushNotifications';
import confetti from 'canvas-confetti'; // ✅ استيراد تأثير الاحتفال

export default function StaffTasks({ employee }: { employee: Employee }) {
    const queryClient = useQueryClient();
    const [notes, setNotes] = useState<{ [key: string]: string }>({});
    const [currentTime, setCurrentTime] = useState(new Date());

    // تحديث العداد كل دقيقة
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // 1. جلب التكليفات
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

    // 2. معالجة تحديث الحالة + التنبيهات + النقاط
    const updateStatusMutation = useMutation({
        mutationFn: async ({ taskId, newStatus, replyNote, taskTitle, priority }: { taskId: string, newStatus: string, replyNote?: string, taskTitle?: string, priority?: string }) => {
            
            // أ) تحديث الحالة في قاعدة البيانات
            const updates: any = { status: newStatus };
            if (newStatus === 'completed') {
                updates.completed_at = new Date();
                updates.response_note = replyNote;
            }
            const { error: updateError } = await supabase.from('tasks').update(updates).eq('id', taskId);
            if (updateError) throw updateError;

            // ب) تجهيز نصوص التنبيه
            let notifTitle = '';
            let notifMsg = '';

            if (newStatus === 'acknowledged') {
                notifTitle = '👀 تم العلم';
                notifMsg = `قام ${employee.name} بالاطلاع على التكليف: ${taskTitle}`;
            } else if (newStatus === 'in_progress') {
                notifTitle = '🚀 جاري التنفيذ';
                notifMsg = `بدأ ${employee.name} العمل على: ${taskTitle}`;
            } else if (newStatus === 'completed') {
                notifTitle = '✅ تم الإنجاز';
                notifMsg = `أنهى ${employee.name} المهمة: ${taskTitle}`;

                // ✅ ج) إضافة النقاط عند الإنجاز
                const points = priority === 'urgent' ? 20 : 15; // 20 للمهام العاجلة، 15 للعادية
                
                // 1. زيادة الرصيد
                await supabase.rpc('increment_points', { 
                    emp_id: employee.employee_id, 
                    amount: points 
                });

                // 2. تسجيل في السجل
                await supabase.from('points_ledger').insert({
                    employee_id: employee.employee_id,
                    points: points,
                    reason: `إنجاز تكليف: ${taskTitle}`
                });
            }

            // د) إرسال التنبيه للمديرين
            const { data: admins } = await supabase
                .from('employees')
                .select('id, employee_id')
                .eq('role', 'admin');
            
            if (admins && admins.length > 0) {
                await Promise.all(admins.map(async (admin) => {
                    const targetId = admin.id || admin.employee_id;
                    
                    await supabase.from('notifications').insert({
                        user_id: targetId, 
                        title: notifTitle,
                        message: notifMsg,
                        type: 'task_update', 
                        sender_name: employee.name,
                        is_read: false
                    });

                    if (admin.id) {
                        try {
                            await supabase.functions.invoke('send-push-notification', {
                                body: {
                                    userId: admin.id,
                                    title: notifTitle,
                                    body: notifMsg,
                                    url: '/tasks' 
                                }
                            });
                        } catch (e) {
                            console.error("Push failed for admin:", admin.id);
                        }
                    }
                }));
            }
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['staff_tasks'] });
            queryClient.invalidateQueries({ queryKey: ['staff_badges'] }); // لتحديث النقاط في الواجهة إذا كنت تعرضها
            
            if (variables.newStatus === 'completed') {
                toast.success('تم الإنجاز وإضافة النقاط! 🎉');
                // ✅ تشغيل تأثير الاحتفال
                try {
                    confetti({
                        particleCount: 100,
                        spread: 70,
                        origin: { y: 0.6 }
                    });
                } catch (e) {}
            } else {
                toast.success('تم تحديث الحالة');
            }
        },
        onError: (err: any) => {
            console.error(err);
            toast.error('حدث خطأ أثناء التحديث');
        }
    });

    const handleUpdate = (taskId: string, newStatus: string, title: string, priority: string, replyNote?: string) => {
        toast.promise(
            updateStatusMutation.mutateAsync({ taskId, newStatus, replyNote, taskTitle: title, priority }),
            {
                loading: 'جاري التحديث...',
                success: 'تم!',
                error: 'فشل العملية'
            }
        );
    };

    // دالة حساب الوقت المتبقي
    const getTimeRemaining = (dueDateStr: string) => {
        const due = new Date(dueDateStr);
        const diff = due.getTime() - currentTime.getTime();
        
        if (diff < 0) return { text: 'انتهى الوقت (متأخر)', color: 'text-red-600 bg-red-50', isOverdue: true };
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        let text = '';
        if (days > 0) text += `${days} يوم `;
        if (hours > 0) text += `${hours} س `;
        text += `${minutes} د`;

        return { text: `متبقي: ${text}`, color: 'text-emerald-600 bg-emerald-50', isOverdue: false };
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
                </div>
            )}

            {tasks.map((task: any) => {
                const timeStatus = task.due_date ? getTimeRemaining(task.due_date) : null;
                
                return (
                    <div key={task.id} className={`bg-white p-5 rounded-2xl border shadow-sm transition-all ${task.priority === 'urgent' ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-100'}`}>
                        
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h4 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                    {task.priority === 'urgent' && <AlertCircle className="w-4 h-4 text-red-500 animate-pulse"/>}
                                    {task.title}
                                </h4>
                                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{task.description}</p>
                            </div>
                            <div className="text-left flex flex-col items-end gap-1">
                                <span className="text-[10px] bg-gray-50 text-gray-400 px-2 py-1 rounded-lg font-mono border border-gray-100">
                                    {new Date(task.created_at).toLocaleDateString('ar-EG')}
                                </span>
                                {task.status !== 'completed' && timeStatus && (
                                    <span className={`text-[10px] px-2 py-1 rounded-lg font-bold flex items-center gap-1 ${timeStatus.color} ${timeStatus.isOverdue ? 'animate-pulse' : ''}`}>
                                        <Timer className="w-3 h-3"/> {timeStatus.text}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-50 flex flex-col gap-3">
                            
                            {/* 1. زر تأكيد العلم */}
                            {task.status === 'pending' && (
                                <button onClick={() => handleUpdate(task.id, 'acknowledged', task.title, task.priority)} className="w-full bg-blue-50 text-blue-700 py-2.5 rounded-xl font-bold text-xs hover:bg-blue-100 flex items-center justify-center gap-2 transition-colors active:scale-95">
                                    <Eye className="w-4 h-4"/> اضغط لتأكيد العلم
                                </button>
                            )}

                            {/* 2. زر بدء التنفيذ */}
                            {task.status === 'acknowledged' && (
                                <button onClick={() => handleUpdate(task.id, 'in_progress', task.title, task.priority)} className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-indigo-700 flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-md shadow-indigo-200">
                                    <Play className="w-4 h-4 rtl:rotate-180"/> اضغط لبدء التنفيذ
                                </button>
                            )}

                            {/* 3. نموذج الانتهاء */}
                            {task.status === 'in_progress' && (
                                <div className="space-y-3 animate-in fade-in">
                                    <textarea 
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-green-500 transition-all resize-none h-20"
                                        placeholder="اكتب ملاحظات الانتهاء هنا (اختياري)..."
                                        value={notes[task.id] || ''}
                                        onChange={(e) => setNotes({...notes, [task.id]: e.target.value})}
                                    />
                                    <button onClick={() => handleUpdate(task.id, 'completed', task.title, task.priority, notes[task.id])} className="w-full bg-green-600 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-green-700 flex items-center justify-center gap-2 transition-colors shadow-md shadow-green-200 active:scale-95">
                                        <CheckCircle2 className="w-4 h-4"/> تم الانتهاء من المهمة
                                    </button>
                                </div>
                            )}

                            {/* 4. الحالة النهائية */}
                            {task.status === 'completed' && (
                                <div className="bg-green-50 p-3 rounded-xl border border-green-100 text-center">
                                    <span className="text-green-700 font-bold text-xs flex items-center justify-center gap-1 mb-1">
                                        <CheckCircle2 className="w-4 h-4"/> المهمة مكتملة (+{task.priority === 'urgent' ? 20 : 15} نقطة)
                                    </span>
                                    {task.response_note && <p className="text-[10px] text-green-600 mt-1">ملاحظاتك: {task.response_note}</p>}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
