import React, { useState, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Send, Clock, CheckCircle2, Loader2, AlertCircle, Eye, Play, 
    Filter, Users, RefreshCw, Layers, CheckSquare, XCircle, CalendarClock
} from 'lucide-react';
import { sendSystemNotification } from '../../../utils/pushNotifications';

export default function TasksManager({ employees }: { employees: Employee[] }) {
    const queryClient = useQueryClient();
    
    // --- حالات النموذج ---
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [priority, setPriority] = useState('normal');
    const [dueDate, setDueDate] = useState(''); // ✅ حالة تاريخ الاستحقاق

    // --- حالات الفلترة والاختيار ---
    const [targetType, setTargetType] = useState<'individual' | 'department' | 'all'>('individual');
    const [filterSpecialty, setFilterSpecialty] = useState('all');
    const [filterStatus, setFilterStatus] = useState('active'); 
    const [selectedEmp, setSelectedEmp] = useState('');
    const [selectedDept, setSelectedDept] = useState('');

    // 1. 📥 جلب سجل التكليفات
    const { data: tasks = [], isLoading: loadingHistory, refetch, isRefetching } = useQuery({
        queryKey: ['admin_tasks_history'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('tasks')
                .select('*, employee:employees(name, specialty)')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data || [];
        },
        refetchInterval: 10000, 
    });

    // 2. 🚀 إرسال التكليف
    const sendTaskMutation = useMutation({
        mutationFn: async () => {
            if (!title) throw new Error("يجب كتابة عنوان للتكليف");
            if (!dueDate) throw new Error("يجب تحديد مدة/موعد انتهاء المهمة"); // ✅ التحقق من التاريخ

            let targetEmployees: Employee[] = [];

            if (targetType === 'individual') {
                if (!selectedEmp) throw new Error("اختر الموظف");
                const emp = employees.find(e => e.employee_id === selectedEmp);
                if (emp) targetEmployees = [emp];
            } 
            else if (targetType === 'department') {
                if (!selectedDept) throw new Error("اختر التخصص/القسم");
                targetEmployees = employees.filter(e => e.specialty === selectedDept && e.status === 'نشط');
            } 
            else if (targetType === 'all') {
                targetEmployees = employees.filter(e => e.status === 'نشط');
            }

            if (targetEmployees.length === 0) throw new Error("لا يوجد موظفين مستهدفين");

            // أ) إدخال التكليفات
            const tasksPayload = targetEmployees.map(emp => ({
                title,
                description: desc,
                employee_id: emp.employee_id,
                manager_id: 'admin',
                priority,
                status: 'pending',
                due_date: new Date(dueDate).toISOString() // ✅ حفظ التاريخ
            }));

            const { error: taskError } = await supabase.from('tasks').insert(tasksPayload);
            if (taskError) throw taskError;

            // ب) إرسال التنبيهات
            await Promise.all(targetEmployees.map(emp => 
                sendSystemNotification(
                    emp.employee_id,
                    '⚡ تكليف جديد',
                    `مطلوب: ${title} - الموعد النهائي: ${new Date(dueDate).toLocaleTimeString('ar-EG', {day:'numeric', month:'numeric', hour:'2-digit', minute:'2-digit'})}`,
                    'task'
                )
            ));

            return targetEmployees.length;
        },
        onSuccess: (count) => {
            toast.success(`تم إرسال التكليف لـ ${count} موظف بنجاح`);
            queryClient.invalidateQueries({ queryKey: ['admin_tasks_history'] });
            setTitle('');
            setDesc('');
            setDueDate(''); // تصفير التاريخ
            setActiveTab('history');
        },
        onError: (err: any) => toast.error(err.message)
    });

    const deleteTaskMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('tasks').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم الحذف');
            queryClient.invalidateQueries({ queryKey: ['admin_tasks_history'] });
        },
        onError: () => toast.error('فشل الحذف')
    });

    const specialties = useMemo(() => ['all', ...Array.from(new Set(employees.map(e => e.specialty)))], [employees]);

    const filteredEmployees = useMemo(() => {
        return employees.filter(e => {
            const matchSpec = filterSpecialty === 'all' || e.specialty === filterSpecialty;
            const matchStatus = filterStatus === 'all' || (filterStatus === 'active' && e.status === 'نشط');
            return matchSpec && matchStatus;
        });
    }, [employees, filterSpecialty, filterStatus]);

    const getStatusBadge = (status: string) => {
        switch(status) {
            case 'pending': return <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Clock className="w-3 h-3"/> معلق</span>;
            case 'acknowledged': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Eye className="w-3 h-3"/> تم العلم</span>;
            case 'in_progress': return <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Play className="w-3 h-3"/> جاري التنفيذ</span>;
            case 'completed': return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> منتهي</span>;
            default: return status;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100 w-fit">
                <button onClick={() => setActiveTab('new')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'new' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <Send className="w-4 h-4"/> إرسال جديد
                </button>
                <button onClick={() => setActiveTab('history')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <Layers className="w-4 h-4"/> سجل التكليفات
                </button>
            </div>

            {activeTab === 'new' && (
                <div className="bg-white p-6 rounded-[30px] border shadow-sm space-y-6">
                    <div className="space-y-3 border-b pb-6">
                        <label className="text-sm font-black text-gray-700 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-500"/> لمن توجه هذا التكليف؟</label>
                        <div className="flex flex-wrap gap-4">
                            {[
                                { id: 'individual', label: 'موظف محدد' },
                                { id: 'department', label: 'قسم كامل' },
                                { id: 'all', label: 'جميع الموظفين' }
                            ].map(opt => (
                                <label key={opt.id} className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 cursor-pointer transition-all ${targetType === opt.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-100 hover:border-indigo-200'}`}>
                                    <input type="radio" name="target" value={opt.id} checked={targetType === opt.id} onChange={() => setTargetType(opt.id as any)} className="hidden" />
                                    <span className="font-bold text-sm">{opt.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {targetType === 'individual' && (
                            <>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 mb-1 block">فلتر التخصص</label>
                                    <select className="w-full p-3 bg-gray-50 border rounded-xl text-sm outline-none" value={filterSpecialty} onChange={e => setFilterSpecialty(e.target.value)}>
                                        <option value="all">كل التخصصات</option>
                                        {specialties.filter(s => s !== 'all').map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 mb-1 block">اختيار الموظف ({filteredEmployees.length})</label>
                                    <select className="w-full p-3 bg-white border-2 border-indigo-100 focus:border-indigo-500 rounded-xl text-sm outline-none font-bold" value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}>
                                        <option value="">اختر الموظف...</option>
                                        {filteredEmployees.map(e => (<option key={e.employee_id} value={e.employee_id}>{e.name} {e.status !== 'نشط' ? '(غير نشط)' : ''}</option>))}
                                    </select>
                                </div>
                            </>
                        )}
                        {targetType === 'department' && (
                            <div className="md:col-span-2">
                                <label className="text-xs font-bold text-gray-400 mb-1 block">اختر القسم / التخصص</label>
                                <select className="w-full p-3 bg-white border-2 border-indigo-100 focus:border-indigo-500 rounded-xl text-sm outline-none font-bold" value={selectedDept} onChange={e => setSelectedDept(e.target.value)}>
                                    <option value="">حدد القسم...</option>
                                    {specialties.filter(s => s !== 'all').map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        )}
                        {targetType === 'all' && (
                            <div className="md:col-span-2 bg-yellow-50 p-3 rounded-xl border border-yellow-200 text-yellow-700 text-sm font-bold flex items-center gap-2">
                                <AlertCircle className="w-5 h-5"/> سيتم إرسال هذا التكليف إلى جميع الموظفين النشطين في النظام.
                            </div>
                        )}
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 mb-1 block">عنوان الإشارة / التكليف</label>
                                <input type="text" placeholder="مثال: تعليمات بخصوص المرور الصباحي" className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-indigo-500 outline-none font-bold text-sm transition-all" value={title} onChange={e => setTitle(e.target.value)}/>
                            </div>
                            {/* ✅ حقل التاريخ والوقت الجديد */}
                            <div>
                                <label className="text-xs font-bold text-gray-400 mb-1 block">الموعد النهائي للتنفيذ</label>
                                <input 
                                    type="datetime-local" 
                                    className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-indigo-500 outline-none font-bold text-sm transition-all ltr text-right"
                                    value={dueDate} 
                                    onChange={e => setDueDate(e.target.value)}
                                    min={new Date().toISOString().slice(0, 16)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 mb-1 block">التفاصيل</label>
                            <textarea placeholder="اكتب تفاصيل التكليف هنا..." className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-indigo-500 outline-none text-sm h-24 resize-none transition-all" value={desc} onChange={e => setDesc(e.target.value)}/>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-2">
                        <div className="flex gap-4 bg-gray-50 p-2 rounded-xl">
                            <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all ${priority === 'normal' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400'}`}>
                                <input type="radio" name="priority" value="normal" checked={priority === 'normal'} onChange={() => setPriority('normal')} className="hidden" />
                                <span className="text-sm font-bold">عادي</span>
                            </label>
                            <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all ${priority === 'urgent' ? 'bg-red-50 text-red-600 shadow-sm border border-red-100' : 'text-gray-400'}`}>
                                <input type="radio" name="priority" value="urgent" checked={priority === 'urgent'} onChange={() => setPriority('urgent')} className="hidden" />
                                <span className="text-sm font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3"/> عاجل وهام</span>
                            </label>
                        </div>

                        <button onClick={() => sendTaskMutation.mutate()} disabled={sendTaskMutation.isPending} className="w-full md:w-auto bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-50">
                            {sendTaskMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5 rtl:rotate-180"/>} إرسال التكليف
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="bg-white rounded-[30px] border shadow-sm overflow-hidden flex flex-col h-[600px]">
                    <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2"><CheckSquare className="w-5 h-5 text-indigo-600"/> سجل التكليفات الصادرة</h3>
                        <button onClick={() => refetch()} disabled={isRefetching} className="p-2 bg-white border rounded-lg text-gray-600 hover:text-indigo-600 hover:border-indigo-200 transition-all">
                            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`}/>
                        </button>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar flex-1 p-2">
                        {loadingHistory ? (
                            <div className="text-center py-20 flex flex-col items-center gap-3 text-gray-400"><Loader2 className="w-8 h-8 animate-spin text-indigo-500"/><span>جاري تحميل السجل...</span></div>
                        ) : tasks.length === 0 ? (
                            <div className="text-center py-20 text-gray-400 font-bold border-2 border-dashed border-gray-100 rounded-3xl m-4">لا توجد تكليفات سابقة</div>
                        ) : (
                            <table className="w-full text-sm text-right">
                                <thead className="bg-gray-50 text-gray-500 font-bold sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4">العنوان</th>
                                        <th className="p-4">الموظف</th>
                                        <th className="p-4 text-center">الموعد النهائي</th>
                                        <th className="p-4 text-center">الحالة</th>
                                        <th className="p-4">الرد</th>
                                        <th className="p-4 text-center">إجراء</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {tasks.map((task: any) => (
                                        <tr key={task.id} className="hover:bg-indigo-50/30 transition-colors group">
                                            <td className="p-4 font-bold text-gray-800">
                                                <div className="flex items-center gap-2">
                                                    {task.priority === 'urgent' && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                                                    {task.title}
                                                </div>
                                                <p className="text-xs text-gray-400 font-normal mt-1 truncate max-w-[200px]">{task.description}</p>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-gray-700">{task.employee?.name}</div>
                                                <div className="text-xs text-gray-400">{task.employee?.specialty}</div>
                                            </td>
                                            <td className="p-4 text-center">
                                                {task.due_date ? (
                                                    <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                                                        {new Date(task.due_date).toLocaleDateString('ar-EG')}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="p-4 text-center">{getStatusBadge(task.status)}</td>
                                            <td className="p-4 text-xs text-gray-600 max-w-[200px]">{task.response_note ? <div className="bg-green-50 p-2 rounded border border-green-100">{task.response_note}</div> : '-'}</td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => { if(confirm('حذف هذا التكليف؟')) deleteTaskMutation.mutate(task.id); }} className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                                    <XCircle className="w-5 h-5"/>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
