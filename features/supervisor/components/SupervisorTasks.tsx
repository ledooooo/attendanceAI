import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { CheckSquare, Plus, Loader2, Clock, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SupervisorTasks() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');

    const { data: tasks = [], isLoading } = useQuery({
        queryKey: ['supervisor_tasks', user?.id],
        queryFn: async () => {
            const { data } = await supabase.from('tasks').select('*').eq('created_by', user?.id).order('created_at', { ascending: false });
            return data || [];
        },
        enabled: !!user?.id
    });

    const addTaskMutation = useMutation({
        mutationFn: async () => {
            if (!title) throw new Error("يجب كتابة عنوان التكليف");
            const { error } = await supabase.from('tasks').insert({
                title, description, due_date: dueDate || null, 
                assigned_to: 'admin',
                created_by: user?.id,
                status: 'pending'
            });
            if (error) throw error;
            
            await supabase.from('notifications').insert({
                type: 'task_update', title: 'تكليف إشرافي جديد', message: `تم تكليفك بـ: ${title}`, to_user: 'admin'
            });
        },
        onSuccess: () => {
            toast.success('تم إرسال التكليف بنجاح');
            setTitle(''); setDescription(''); setDueDate('');
            queryClient.invalidateQueries({ queryKey: ['supervisor_tasks'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-3xl shadow-sm border h-fit">
                <h3 className="font-black text-lg flex items-center gap-2 mb-4"><Plus className="w-5 h-5 text-emerald-600"/> إصدار تكليف جديد</h3>
                <div className="space-y-4">
                    <input type="text" placeholder="عنوان التكليف..." value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 rounded-xl border bg-gray-50 focus:border-emerald-500 outline-none font-bold text-sm" />
                    <textarea placeholder="التفاصيل (اختياري)..." value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 rounded-xl border bg-gray-50 focus:border-emerald-500 outline-none text-sm resize-none h-24" />
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full p-3 rounded-xl border bg-gray-50 outline-none text-sm font-bold text-gray-500" />
                    <button onClick={() => addTaskMutation.mutate()} disabled={addTaskMutation.isPending || !title} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700 flex justify-center items-center gap-2 disabled:opacity-50">
                        {addTaskMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : 'إرسال التكليف'}
                    </button>
                </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
                <h3 className="font-black text-lg flex items-center gap-2 text-gray-800"><CheckSquare className="w-5 h-5 text-emerald-600"/> سجل التكليفات الصادرة</h3>
                {isLoading ? <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600"/></div> : 
                 tasks.length === 0 ? <p className="text-center text-gray-400 font-bold py-10 bg-white rounded-3xl border border-dashed">لم تصدر أي تكليفات بعد.</p> :
                 tasks.map((task: any) => (
                    <div key={task.id} className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4 border-r-4 border-r-emerald-500">
                        <div>
                            <h4 className="font-black text-gray-800">{task.title}</h4>
                            {task.description && <p className="text-xs text-gray-500 mt-1">{task.description}</p>}
                            <p className="text-[10px] text-gray-400 font-mono mt-2">{new Date(task.created_at).toLocaleDateString('ar-EG')}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${task.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                {task.status === 'completed' ? <CheckCircle className="w-4 h-4"/> : <Clock className="w-4 h-4"/>}
                                {task.status === 'completed' ? 'تم الإنجاز' : 'قيد التنفيذ'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
