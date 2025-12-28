import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { FilePlus, Send } from 'lucide-react';
import { useNotifications } from '../../../context/NotificationContext';

const LEAVE_TYPES = [
  "اجازة عارضة", "اجازة اعتيادية", "اجازة مرضى", "جزء من الوقت", "خط سير", "مأمورية", "دورة تدريبية", "بيان حالة وظيفية"
];

export default function StaffNewRequest({ employee, refresh }: { employee: Employee, refresh: () => void }) {
    const { sendNotification } = useNotifications();
    const [formData, setFormData] = useState({ 
        type: '', 
        start: '', 
        end: '', 
        returnDate: '', // خانة جديدة
        backup: '', 
        notes: '' 
    });
    const [submitting, setSubmitting] = useState(false);

    const submit = async () => {
        // التحقق الإجباري
        if(!formData.type || !formData.start || !formData.end || !formData.returnDate || !formData.backup) {
            return alert('عفواً، جميع الحقول الموضحة بعلامة (*) إجبارية.');
        }

        setSubmitting(true);
        
        // دمج تاريخ العودة في الملاحظات أو إضافته كحقل إذا قمت بتعديل الجدول
        // سأقوم بدمجه في الملاحظات حالياً لعدم تغيير هيكلة قاعدة البيانات
        const notesWithReturn = `تاريخ العودة: ${formData.returnDate} \n ${formData.notes}`;

        const { error } = await supabase.from('leave_requests').insert([{ 
            employee_id: employee.employee_id, 
            type: formData.type, 
            start_date: formData.start, 
            end_date: formData.end, 
            backup_person: formData.backup, 
            status: 'معلق', 
            notes: notesWithReturn 
        }]);

        if(!error) { 
            await sendNotification('admin', 'طلب جديد', `طلب ${formData.type} من ${employee.name}`);
            alert('تم إرسال الطلب بنجاح'); 
            setFormData({ type: '', start: '', end: '', returnDate: '', backup: '', notes: '' }); 
            refresh(); 
        } else {
            alert(error.message);
        }
        setSubmitting(false);
    };

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><FilePlus className="text-emerald-600 w-7 h-7" /> تقديم طلب إلكتروني</h3>
            <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <Select label="نوع الطلب *" options={LEAVE_TYPES} value={formData.type} onChange={(v:any)=>setFormData({...formData, type: v})} required />
                    </div>
                    <Input label="من تاريخ *" type="date" value={formData.start} onChange={(v:any)=>setFormData({...formData, start: v})} required />
                    <Input label="إلى تاريخ *" type="date" value={formData.end} onChange={(v:any)=>setFormData({...formData, end: v})} required />
                    <Input label="تاريخ العودة للعمل *" type="date" value={formData.returnDate} onChange={(v:any)=>setFormData({...formData, returnDate: v})} required />
                    <Input label="الموظف البديل *" value={formData.backup} onChange={(v:any)=>setFormData({...formData, backup: v})} required placeholder="اسم الزميل القائم بالعمل" />
                    
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 mb-1">ملاحظات إضافية</label>
                        <textarea value={formData.notes} onChange={(e)=>setFormData({...formData, notes: e.target.value})} className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px]" placeholder="أي تفاصيل أخرى..."></textarea>
                    </div>
                </div>
                <button onClick={submit} disabled={submitting} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black shadow-lg hover:bg-emerald-700 transition-all flex justify-center items-center gap-2 active:scale-95 disabled:bg-gray-400">
                    <Send className="w-5 h-5" /> {submitting ? 'جاري الإرسال...' : 'إرسال الطلب للاعتماد'}
                </button>
            </div>
        </div>
    );
}