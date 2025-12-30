import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { FilePlus, Send, Calendar, UserCheck } from 'lucide-react';
import { useNotifications } from '../../../context/NotificationContext';

const LEAVE_TYPES = [
  "اجازة عارضة", "اجازة اعتيادية", "اجازة مرضى", "دورة تدريبية", "خط سير", "مأمورية", "اذن صباحى", "اذن مسائي", "تأمين صحي"
];

// 1. تحديث الواجهة لتقبل initialDate (اختياري)
interface Props { 
    employee: Employee; 
    refresh: () => void;
    initialDate?: string | null; 
}

export default function StaffNewRequest({ employee, refresh, initialDate }: Props) {
    const { sendNotification } = useNotifications();
    const [submitting, setSubmitting] = useState(false);
    
    // حالة النموذج
    const [formData, setFormData] = useState({
        type: LEAVE_TYPES[0], 
        start: initialDate || '', // استخدام التاريخ الممرر كبداية
        end: initialDate || '',   // وكهناية (افتراض يوم واحد)
        returnDate: '', 
        backup: '', 
        notes: ''
    });

    // 2. تأثير (Effect) لتحديث النموذج إذا تغير التاريخ الممرر
    useEffect(() => {
        if (initialDate) {
            setFormData(prev => ({
                ...prev,
                start: initialDate,
                end: initialDate
            }));
        }
    }, [initialDate]);

    const submit = async () => {
        // التحقق الإجباري
        if (!formData.type || !formData.start || !formData.end || !formData.returnDate || !formData.backup) {
            return alert('⚠️ عفواً، جميع الحقول الموضحة بعلامة (*) إجبارية.');
        }

        // التحقق من منطقية التواريخ
        if (new Date(formData.end) < new Date(formData.start)) {
            return alert('⚠️ تاريخ النهاية يجب أن يكون بعد تاريخ البداية!');
        }
        if (new Date(formData.returnDate) <= new Date(formData.end)) {
            return alert('⚠️ تاريخ العودة للعمل يجب أن يكون بعد انتهاء الإجازة!');
        }

        setSubmitting(true);
        
        try {
            // الإرسال لقاعدة البيانات
            const { error } = await supabase.from('leave_requests').insert([{ 
                employee_id: employee.employee_id, 
                type: formData.type, 
                start_date: formData.start, 
                end_date: formData.end,
                back_date: formData.returnDate, 
                backup_person: formData.backup, 
                status: 'معلق', 
                notes: formData.notes 
            }]);

            if (error) throw error;

            // إرسال إشعار للمدير
            await sendNotification('admin', 'طلب جديد 📄', `قام ${employee.name} بتقديم طلب ${formData.type}`);

            alert('✅ تم إرسال الطلب بنجاح'); 
            
            // تصفير النموذج وتحديث الصفحة
            setFormData({ 
                type: LEAVE_TYPES[0], 
                start: '', 
                end: '', 
                returnDate: '', 
                backup: '', 
                notes: '' 
            }); 
            refresh();

        } catch (error: any) {
            console.error(error);
            alert('❌ خطأ في الإرسال: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800">
                <FilePlus className="text-emerald-600 w-7 h-7" /> تقديم طلب إلكتروني
            </h3>
            
            <div className="bg-white p-6 md:p-8 rounded-[40px] border border-gray-100 shadow-sm space-y-6">
                
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-blue-800 text-sm font-bold flex items-center gap-2">
                    <UserCheck className="w-5 h-5"/>
                    يرجى التأكد من التنسيق مع الموظف البديل قبل تقديم الطلب.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* نوع الطلب */}
                    <div className="md:col-span-2">
                        <Select 
                            label="نوع الطلب *" 
                            options={LEAVE_TYPES} 
                            value={formData.type} 
                            onChange={(v:any)=>setFormData({...formData, type: v})} 
                        />
                    </div>

                    {/* التواريخ */}
                    <Input 
                        label="من تاريخ *" 
                        type="date" 
                        value={formData.start} 
                        onChange={(v:any)=>setFormData({...formData, start: v})} 
                    />
                    <Input 
                        label="إلى تاريخ *" 
                        type="date" 
                        value={formData.end} 
                        onChange={(v:any)=>setFormData({...formData, end: v})} 
                    />
                    
                    {/* تاريخ العودة والموظف البديل */}
                    <div className="relative">
                         <Input 
                            label="تاريخ العودة للعمل *" 
                            type="date" 
                            value={formData.returnDate} 
                            onChange={(v:any)=>setFormData({...formData, returnDate: v})} 
                        />
                        <Calendar className="absolute left-3 top-9 text-gray-400 w-4 h-4 pointer-events-none"/>
                    </div>
                    
                    <Input 
                        label="الموظف البديل *" 
                        value={formData.backup} 
                        onChange={(v:any)=>setFormData({...formData, backup: v})} 
                        placeholder="اسم الزميل القائم بالعمل" 
                    />
                    
                    {/* الملاحظات */}
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 mb-1">ملاحظات إضافية (اختياري)</label>
                        <textarea 
                            value={formData.notes} 
                            onChange={(e)=>setFormData({...formData, notes: e.target.value})} 
                            className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all min-h-[100px] text-sm font-medium" 
                            placeholder="اكتب أي تفاصيل أخرى..."
                        />
                    </div>
                </div>

                {/* زر الإرسال */}
                <button 
                    onClick={submit} 
                    disabled={submitting} 
                    className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black shadow-lg hover:bg-emerald-700 hover:shadow-emerald-200 transition-all flex justify-center items-center gap-2 active:scale-95 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none"
                >
                    {submitting ? (
                        <span className="flex items-center gap-2">جاري الإرسال... <span className="animate-spin">⏳</span></span>
                    ) : (
                        <><Send className="w-5 h-5" /> إرسال الطلب للاعتماد</>
                    )}
                </button>
            </div>
        </div>
    );
}
