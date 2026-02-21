import React, { useState, useMemo } from 'react'; // ✅ تصحيح Import إلى import
import { supabase } from '../../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { CheckSquare, Plus, Loader2, Clock, CheckCircle, User, Users, Briefcase, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SupervisorTasks() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    
    // States
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    
    // حالات اختيار المكلف (مسؤول أو موظف عادي)
    const [assigneeType, setAssigneeType] = useState<'manager' | 'staff'>('manager'); 
    const [selectedUser, setSelectedUser] = useState('');

    // 1. جلب كل الموظفين النشطين (مع معالجة الأخطاء)
    const { data: allEmployees = [], isLoading: loadingEmployees } = useQuery({
        queryKey: ['all_active_employees'],
        queryFn: async () => {
            // نتأكد أولاً أن الجدول يحتوي على الأعمدة المطلوبة لتجنب الأخطاء
            const { data, error } = await supabase
                .from('employees')
                .select('id, name, role, specialty, admin_tasks')
                .eq('status', 'نشط');
            
            if (error) {
                console.error("Error fetching employees:", error);
                return [];
            }
            return data || [];
        }
    });

    // 2. تقسيم الموظفين إلى مجموعتين (مسؤولين - وموظفين)
    const { managersList, staffList } = useMemo(() => {
        const managers = [];
        const staff = [];
        
        // حماية ضد البيانات الفارغة
        if (!allEmployees) return { managersList: [], staffList: [] };

        for (const emp of allEmployees) {
            // تحويل الدور لنص صغير لتجنب مشاكل الحروف الكبيرة والصغيرة
            const role = emp.role ? emp.role.toLowerCase() : '';
            if (['admin', 'quality_manager', 'head_of_dept'].includes(role)) {
                managers.push(emp);
            } else {
                staff.push(emp);
            }
        }
        return { managersList: managers, staffList: staff };
    }, [allEmployees]);

    // 3. جلب التكليفات الصادرة
    const { data: tasks = [], isLoading } = useQuery({
        queryKey: ['supervisor_tasks', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('created_by', user.id)
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error("Error fetching tasks:", error);
                return [];
            }
            return data || [];
        },
        enabled: !!user?.id
    });

    // 4. دالة الإرسال
// 4. دالة الإرسال (المحدثة بنظام الإشعارات اللحظية)
    const addTaskMutation = useMutation({
        mutationFn: async () => {
            if (!user?.id) throw new Error("يجب تسجيل الدخول أولاً");
            if (!title) throw new Error("يجب كتابة عنوان للتكليف");
            if (!selectedUser) throw new Error("يرجى اختيار الموظف المكلف");
            
            // البحث عن بيانات الموظف المختار
            const targetEmp = allEmployees.find((e: any) => e.id === selectedUser);
            if (!targetEmp) throw new Error("الموظف غير موجود");

            // أ) الإدراج في قاعدة البيانات
            const { error } = await supabase.from('tasks').insert({
                title, 
                description, 
                due_date: dueDate || null, 
                employee_id: String(targetEmp.employee_id), // استخدام المعرف الموحد (مثل 80)
                target_name: targetEmp.name, 
                manager_id: user.id, 
                created_by: user.id,
                status: 'pending'
            });

            if (error) throw error;
            
            // ب) تجهيز الإشعارات
            const notifTitle = '⚡ تكليف إشرافي جديد';
            const notifBody = `كلفك المشرف بـ: ${title}`;

            // 1. الحفظ في جدول notifications في قاعدة البيانات
            await supabase.from('notifications').insert({
                user_id: String(targetEmp.employee_id),
                title: notifTitle,
                message: notifBody,
                type: 'task',
                is_read: false
            });

            // ✅ 2. إرسال Push Notification لحظي لهاتف الموظف
            supabase.functions.invoke('send-push-notification', {
                body: { 
                    userId: String(targetEmp.employee_id), 
                    title: notifTitle, 
                    body: notifBody, 
                    url: '/staff?tab=tasks' 
                }
            }).catch(err => console.error("Push Error (Supervisor Task):", err));
        },
        onSuccess: () => {
            toast.success('تم إرسال التكليف وتنبيه الموظف بنجاح ✅');
            setTitle(''); setDescription(''); setDueDate(''); setSelectedUser('');
            queryClient.invalidateQueries({ queryKey: ['supervisor_tasks'] });
        },
        onError: (err: any) => toast.error(err.message)
    });
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
            {/* نموذج التكليف */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border h-fit">
                <h3 className="font-black text-lg flex items-center gap-2 mb-4"><Plus className="w-5 h-5 text-emerald-600"/> إصدار تكليف جديد</h3>
                
                <div className="space-y-4">
                    {/* أزرار التبديل بين المسؤولين والموظفين */}
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button 
                            onClick={() => { setAssigneeType('manager'); setSelectedUser(''); }}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${assigneeType === 'manager' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}
                        >
                            <Shield size={14}/> القيادات والإشراف
                        </button>
                        <button 
                            onClick={() => { setAssigneeType('staff'); setSelectedUser(''); }}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${assigneeType === 'staff' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}
                        >
                            <Users size={14}/> باقي الموظفين
                        </button>
                    </div>

                    {/* القائمة المنسدلة (تتغير حسب الاختيار) */}
                    <div className="relative">
                        <select 
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                            className="w-full p-3 rounded-xl border bg-gray-50 focus:border-emerald-500 outline-none font-bold text-xs appearance-none"
                        >
                            <option value="">
                                {assigneeType === 'manager' ? 'اختر المسؤول...' : 'اختر الموظف...'}
                            </option>
                            
                            {assigneeType === 'manager' ? (
                                managersList.map((m: any) => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} - ({m.role === 'admin' ? 'مدير' : m.admin_tasks || 'رئيس قسم'})
                                    </option>
                                ))
                            ) : (
                                staffList.map((s: any) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} - ({s.specialty})
                                    </option>
                                ))
                            )}
                        </select>
                        <div className="absolute left-3 top-3 pointer-events-none text-gray-400">
                            {assigneeType === 'manager' ? <Shield size={16}/> : <Briefcase size={16}/>}
                        </div>
                    </div>

                    <input type="text" placeholder="عنوان التكليف..." value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 rounded-xl border bg-gray-50 focus:border-emerald-500 outline-none font-bold text-sm" />
                    <textarea placeholder="التفاصيل (اختياري)..." value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 rounded-xl border bg-gray-50 focus:border-emerald-500 outline-none text-sm resize-none h-20" />
                    
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">تاريخ الاستحقاق (اختياري)</label>
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full p-3 rounded-xl border bg-gray-50 outline-none text-sm font-bold text-gray-500" />
                    </div>

                    <button onClick={() => addTaskMutation.mutate()} disabled={addTaskMutation.isPending} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700 flex justify-center items-center gap-2 disabled:opacity-50">
                        {addTaskMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : 'إرسال التكليف'}
                    </button>
                </div>
            </div>

            {/* سجل التكليفات */}
            <div className="lg:col-span-2 space-y-4">
                <h3 className="font-black text-lg flex items-center gap-2 text-gray-800"><CheckSquare className="w-5 h-5 text-emerald-600"/> سجل التكليفات الصادرة</h3>
                {isLoading ? <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600"/></div> : 
                 tasks.length === 0 ? <p className="text-center text-gray-400 font-bold py-10 bg-white rounded-3xl border border-dashed">لم تصدر أي تكليفات بعد.</p> :
                 tasks.map((task: any) => (
                    <div key={task.id} className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between gap-4 border-r-4 border-r-emerald-500">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-black text-gray-800 text-base">{task.title}</h4>
                                <p className="text-xs text-emerald-600 font-bold mt-1 flex items-center gap-1">
                                    <User size={12}/> موجه إلى: {task.target_name || 'غير محدد'}
                                </p>
                                {task.description && <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded-lg leading-relaxed">{task.description}</p>}
                            </div>
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 ${task.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                {task.status === 'completed' ? <CheckCircle className="w-4 h-4"/> : <Clock className="w-4 h-4"/>}
                                {task.status === 'completed' ? 'تم الإنجاز' : 'قيد التنفيذ'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center border-t pt-3 mt-1">
                            <p className="text-[10px] text-gray-400 font-mono">{new Date(task.created_at).toLocaleDateString('ar-EG', {day:'numeric', month:'long', year:'numeric'})}</p>
                            {task.due_date && <p className="text-[10px] text-red-400 font-bold">آخر موعد: {task.due_date}</p>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
