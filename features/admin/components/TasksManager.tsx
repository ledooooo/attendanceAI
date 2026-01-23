import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Clock, CheckCircle2, Loader2, AlertCircle, Eye, Play } from 'lucide-react';

export default function TasksManager({ employees }: { employees: Employee[] }) {
    const queryClient = useQueryClient();
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [selectedEmp, setSelectedEmp] = useState('');
    const [priority, setPriority] = useState('normal');

    // 1. جلب التكليفات
    const { data: tasks = [], isLoading } = useQuery({
        queryKey: ['admin_tasks'],
        queryFn: async () => {
            const { data } = await supabase
                .from('tasks')
                .select('*, employee:employees(name)') // ربط لجدول الموظفين لجلب الاسم
                .order('created_at', { ascending: false });
            return data || [];
        },
        refetchInterval: 10000, // تحديث تلقائي كل 10 ثواني لمتابعة الردود
    });

    // 2. إرسال تكليف جديد
    const sendTaskMutation = useMutation({
        mutationFn: async () => {
            if (!selectedEmp || !title) throw new Error("البيانات ناقصة");

            // أ) إنشاء التكليف
            const { data: task, error } = await supabase.from('tasks').insert({
                title,
                description: desc,
                employee_id: selectedEmp,
                manager_id: 'admin', // أو معرف المدير الحالي
                priority
            }).select().single();

            if (error) throw error;

            // ب) إرسال تنبيه للموظف (داخلي)
            await supabase.from('notifications').insert({
                user_id: selectedEmp,
                title: '⚡ تكليف جديد',
                message: `لديك إشارة جديدة: ${title}`,
                type: 'task',
                is_read: false
            });

            // ج) إرسال تنبيه خارجي (Push Notification) - دالة مفترضة
            // sendPushToUser(selectedEmp, "تكليف جديد", title);
        },
        onSuccess: () => {
            toast.success('تم إرسال الإشارة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['admin_tasks'] });
            setTitle('');
            setDesc('');
            setSelectedEmp('');
        },
        onError: (err: any) => toast.error(err.message)
    });

    // دالة لتحديد لون الحالة
    const getStatusBadge = (status: string) => {
        const styles: any = {
            'pending': { label: 'معلق', color: 'bg-gray-100 text-gray-600', icon: Clock },
            'acknowledged': { label: 'تم العلم', color: 'bg-blue-100 text-blue-700', icon: Eye },
            'in_progress': { label: 'جاري التنفيذ', color: 'bg-orange-100 text-orange-700', icon: Play },
            'completed': { label: 'منتهي', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
        };
        const s = styles[status] || styles['pending'];
        const Icon = s.icon;
        return <span className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${s.color}`}><Icon className="w-3 h-3"/> {s.label}</span>;
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* نموذج الإرسال */}
            <div className="bg-white p-6 rounded-[30px] border shadow-sm">
                <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2">
                    <Send className="w-5 h-5 text-indigo-600"/> إرسال إشارة / تكليف
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input 
                        type="text" placeholder="عنوان الإشارة (مثال: تجهيز غرفة 3)" 
                        className="p-3 border rounded-xl bg-gray-50 font-bold text-sm"
                        value={title} onChange={e => setTitle(e.target.value)}
                    />
                    <select 
                        className="p-3 border rounded-xl bg-gray-50 font-bold text-sm"
                        value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}
                    >
                        <option value="">اختر الموظف...</option>
                        {employees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.name}</option>)}
                    </select>
                </div>
                <textarea 
                    placeholder="التفاصيل..." 
                    className="w-full p-3 border rounded-xl bg-gray-50 text-sm h-20 mb-4"
                    value={desc} onChange={e => setDesc(e.target.value)}
                />
                <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-600 cursor-pointer">
                            <input type="radio" name="priority" value="normal" checked={priority === 'normal'} onChange={() => setPriority('normal')} /> عادي
                        </label>
                        <label className="flex items-center gap-2 text-sm font-bold text-red-600 cursor-pointer">
                            <input type="radio" name="priority" value="urgent" checked={priority === 'urgent'} onChange={() => setPriority('urgent')} /> عاجل وهام
                        </label>
                    </div>
                    <button 
                        onClick={() => sendTaskMutation.mutate()}
                        disabled={sendTaskMutation.isPending}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {sendTaskMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4 rtl:rotate-180"/>} إرسال
                    </button>
                </div>
            </div>

            {/* قائمة المتابعة */}
            <div className="bg-white rounded-[30px] border shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b font-bold text-gray-700">سجل التكليفات الصادرة</div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-100 text-gray-600 font-black">
                            <tr>
                                <th className="p-4">العنوان</th>
                                <th className="p-4">الموظف</th>
                                <th className="p-4">الحالة</th>
                                <th className="p-4">التاريخ</th>
                                <th className="p-4">رد الموظف</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tasks.map((task: any) => (
                                <tr key={task.id} className="border-b hover:bg-gray-50">
                                    <td className="p-4 font-bold text-gray-800">
                                        {task.priority === 'urgent' && <span className="text-red-500 ml-1">🔴</span>}
                                        {task.title}
                                    </td>
                                    <td className="p-4">{task.employee?.name}</td>
                                    <td className="p-4">{getStatusBadge(task.status)}</td>
                                    <td className="p-4 text-xs text-gray-500 font-mono">{new Date(task.created_at).toLocaleDateString('ar-EG')}</td>
                                    <td className="p-4 text-xs text-gray-600 truncate max-w-[200px]">{task.response_note || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
