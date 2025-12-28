import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { FilePlus } from 'lucide-react';
import { useNotifications } from '../../../context/NotificationContext'; // 1. استيراد السياق

const LEAVE_TYPES = [
  "اجازة عارضة", "اجازة اعتيادية", "اجازة مرضى", "جزء من الوقت", "خط سير", "مأمورية", "دورة تدريبية", "بيان حالة وظيفية"
];

export default function StaffNewRequest({ employee, refresh }: { employee: Employee, refresh: () => void }) {
    const { sendNotification } = useNotifications(); // 2. استخدام الهوك
    const [formData, setFormData] = useState({ type: '', start: '', end: '', backup: '', notes: '' });
    const [submitting, setSubmitting] = useState(false);

    // 3. التأكد من أن الدالة async
    const submit = async () => {
        if(!formData.type || !formData.start || !formData.end) return alert('برجاء إكمال البيانات الأساسية');
        
        setSubmitting(true);
        
        const { error } = await supabase.from('leave_requests').insert([{ 
            employee_id: employee.employee_id, 
            type: formData.type, 
            start_date: formData.start, 
            end_date: formData.end, 
            backup_person: formData.backup, 
            status: 'معلق', 
            notes: formData.notes 
        }]);

        if(!error) { 
            // 4. استخدام await داخل الدالة الـ async
            await sendNotification(
                'admin', 
                'طلب جديد', 
                `قام الموظف ${employee.name} بتقديم طلب ${formData.type}`
            );

            alert('تم الإرسال'); 
            setFormData({ type: '', start: '', end: '', backup: '', notes: '' }); 
            refresh(); 
        } else {
            alert(error.message);
        }
        
        setSubmitting(false);
    };

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><FilePlus className="text-emerald-600 w-7 h-7" /> تقديم طلب إلكتروني</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-emerald-50/50 p-8 rounded-3xl border border-emerald-100 shadow-inner">
                <div className="md:col-span-2"><Select label="نوع الطلب" options={LEAVE_TYPES} value={formData.type} onChange={(v:any)=>setFormData({...formData, type: v})} /></div>
                <Input label="من تاريخ" type="date" value={formData.start} onChange={(v:any)=>setFormData({...formData, start: v})} />
                <Input label="إلى تاريخ" type="date" value={formData.end} onChange={(v:any)=>setFormData({...formData, end: v})} />
                <Input label="الموظف البديل" value={formData.backup} onChange={(v:any)=>setFormData({...formData, backup: v})} />
                <div className="md:col-span-2 text-right">
                    <label className="block text-xs font-bold text-gray-500 mb-1">ملاحظات</label>
                    <textarea value={formData.notes} onChange={(e)=>setFormData({...formData, notes: e.target.value})} className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-emerald-500" rows={3}></textarea>
                </div>
                <button onClick={submit} disabled={submitting} className="md:col-span-2 bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-emerald-700 transition-all active:scale-95 disabled:bg-gray-400">
                    {submitting ? 'جاري الإرسال...' : 'إرسال الطلب للاعتماد'}
                </button>
            </div>
        </div>
    );
}