import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { Save, User, Briefcase, Calendar, Clock, Phone, Mail, FileText, Star, ShieldCheck, Loader2 } from 'lucide-react';

// تعريف الـ Props
interface Props {
    employee: Employee;
    onUpdate?: () => void; // دالة اختيارية لتحديث القائمة الرئيسية
}

export default function StaffProfile({ employee, onUpdate }: Props) {
    const [loading, setLoading] = useState(false);
    
    // تهيئة النموذج بكل البيانات الموجودة
    const [formData, setFormData] = useState({
        name: employee.name || '',
        employee_id: employee.employee_id || '',
        national_id: employee.national_id || '',
        specialty: employee.specialty || '',
        phone: employee.phone || '',
        email: employee.email || '',
        gender: employee.gender || 'ذكر',
        grade: employee.grade || '',
        religion: employee.religion || '',
        join_date: employee.join_date || '',
        // Dates & Times
        start_time: employee.start_time || '',
        end_time: employee.end_time || '',
        // Leaves
        leave_annual_balance: employee.leave_annual_balance || 21,
        leave_casual_balance: employee.leave_casual_balance || 7,
        remaining_annual: employee.remaining_annual || 21,
        remaining_casual: employee.remaining_casual || 7,
        total_absence: employee.total_absence || 0,
        // Extras
        admin_tasks: employee.admin_tasks || '',
        training_courses: employee.training_courses || '',
        notes: employee.notes || '',
        // URLs (Text inputs for simplicity)
        photo_url: employee.photo_url || '',
        id_front_url: employee.id_front_url || '',
        id_back_url: employee.id_back_url || '',
        // Work days (Converted to string for easy editing)
        work_days: Array.isArray(employee.work_days) ? employee.work_days.join(', ') : (employee.work_days || '')
    });

    const handleSave = async () => {
        setLoading(true);
        try {
            // معالجة أيام العمل (تحويل النص إلى مصفوفة)
            const workDaysArray = formData.work_days.split(/[,،]/).map((d: string) => d.trim()).filter((d: string) => d);

            const { error } = await supabase
                .from('employees')
                .update({
                    ...formData,
                    work_days: workDaysArray
                })
                .eq('id', employee.id); // التحديث بناءً على الـ UUID

            if (error) throw error;

            alert('تم تحديث بيانات الموظف بنجاح ✅');
            if (onUpdate) onUpdate(); // تحديث القائمة الخارجية

        } catch (err: any) {
            alert('حدث خطأ أثناء الحفظ: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
            
            {/* رأس الصفحة مع زر الحفظ */}
            <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800">
                    <User className="text-emerald-600 w-7 h-7" /> تعديل الملف الوظيفي
                </h3>
                <button 
                    onClick={handleSave} 
                    disabled={loading}
                    className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2 active:scale-95 disabled:bg-gray-400"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                    حفظ التعديلات
                </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* 1. البيانات الشخصية */}
                <div className="bg-gray-50 p-6 rounded-[30px] border space-y-4">
                    <h4 className="font-black text-gray-600 flex items-center gap-2 mb-4 border-b pb-2"><ShieldCheck className="w-5 h-5"/> البيانات الشخصية</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="الاسم الرباعي" value={formData.name} onChange={(v:any)=>setFormData({...formData, name: v})} />
                        <Input label="الكود الوظيفي (ID)" value={formData.employee_id} onChange={(v:any)=>setFormData({...formData, employee_id: v})} />
                        <Input label="الرقم القومي" value={formData.national_id} onChange={(v:any)=>setFormData({...formData, national_id: v})} />
                        <Select label="النوع" options={['ذكر', 'أنثى']} value={formData.gender} onChange={(v:any)=>setFormData({...formData, gender: v})} />
                        <Input label="الديانة" value={formData.religion} onChange={(v:any)=>setFormData({...formData, religion: v})} />
                        <Input label="تاريخ التعيين" type="date" value={formData.join_date} onChange={(v:any)=>setFormData({...formData, join_date: v})} />
                        <Input label="الدرجة الوظيفية" value={formData.grade} onChange={(v:any)=>setFormData({...formData, grade: v})} />
                    </div>
                </div>

                {/* 2. بيانات الاتصال */}
                <div className="bg-gray-50 p-6 rounded-[30px] border space-y-4">
                    <h4 className="font-black text-gray-600 flex items-center gap-2 mb-4 border-b pb-2"><Phone className="w-5 h-5"/> الاتصال والتخصص</h4>
                    <div className="space-y-4">
                        <Input label="التخصص / المسمى" value={formData.specialty} onChange={(v:any)=>setFormData({...formData, specialty: v})} />
                        <Input label="رقم الهاتف" value={formData.phone} onChange={(v:any)=>setFormData({...formData, phone: v})} />
                        <Input label="البريد الإلكتروني" type="email" value={formData.email} onChange={(v:any)=>setFormData({...formData, email: v})} />
                        <Input label="صورة شخصية (رابط URL)" value={formData.photo_url} onChange={(v:any)=>setFormData({...formData, photo_url: v})} placeholder="https://..." />
                    </div>
                </div>

                {/* 3. مواعيد العمل */}
                <div className="bg-gray-50 p-6 rounded-[30px] border space-y-4">
                    <h4 className="font-black text-gray-600 flex items-center gap-2 mb-4 border-b pb-2"><Clock className="w-5 h-5"/> المواعيد والنوبتجيات</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="وقت الحضور" type="time" value={formData.start_time} onChange={(v:any)=>setFormData({...formData, start_time: v})} />
                        <Input label="وقت الانصراف" type="time" value={formData.end_time} onChange={(v:any)=>setFormData({...formData, end_time: v})} />
                    </div>
                    <div>
                        <Input 
                            label="أيام العمل (افصل بينهم بفاصلة)" 
                            value={formData.work_days} 
                            onChange={(v:any)=>setFormData({...formData, work_days: v})} 
                            placeholder="السبت، الأحد، الاثنين..."
                        />
                        <p className="text-xs text-gray-400 mt-1">اكتب أيام العمل مفصولة بفاصلة</p>
                    </div>
                </div>

                {/* 4. رصيد الإجازات */}
                <div className="bg-gray-50 p-6 rounded-[30px] border space-y-4">
                    <h4 className="font-black text-gray-600 flex items-center gap-2 mb-4 border-b pb-2"><Star className="w-5 h-5"/> أرشيف الإجازات</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="رصيد سنوي (أصل)" type="number" value={formData.leave_annual_balance} onChange={(v:any)=>setFormData({...formData, leave_annual_balance: Number(v)})} />
                        <Input label="رصيد عارضة (أصل)" type="number" value={formData.leave_casual_balance} onChange={(v:any)=>setFormData({...formData, leave_casual_balance: Number(v)})} />
                        <Input label="متبقي سنوي" type="number" value={formData.remaining_annual} onChange={(v:any)=>setFormData({...formData, remaining_annual: Number(v)})} />
                        <Input label="متبقي عارضة" type="number" value={formData.remaining_casual} onChange={(v:any)=>setFormData({...formData, remaining_casual: Number(v)})} />
                        <Input label="إجمالي الغياب" type="number" value={formData.total_absence} onChange={(v:any)=>setFormData({...formData, total_absence: Number(v)})} />
                    </div>
                </div>

                {/* 5. معلومات إضافية ومرفقات */}
                <div className="lg:col-span-2 bg-gray-50 p-6 rounded-[30px] border space-y-4">
                    <h4 className="font-black text-gray-600 flex items-center gap-2 mb-4 border-b pb-2"><FileText className="w-5 h-5"/> ملفات وملاحظات إضافية</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="صورة البطاقة (وجه - URL)" value={formData.id_front_url} onChange={(v:any)=>setFormData({...formData, id_front_url: v})} />
                        <Input label="صورة البطاقة (ظهر - URL)" value={formData.id_back_url} onChange={(v:any)=>setFormData({...formData, id_back_url: v})} />
                        <Input label="المهام الإدارية" value={formData.admin_tasks} onChange={(v:any)=>setFormData({...formData, admin_tasks: v})} />
                        <Input label="الدورات التدريبية" value={formData.training_courses} onChange={(v:any)=>setFormData({...formData, training_courses: v})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">ملاحظات عامة</label>
                        <textarea 
                            value={formData.notes} 
                            onChange={(e)=>setFormData({...formData, notes: e.target.value})} 
                            className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px]"
                        ></textarea>
                    </div>
                </div>

            </div>
        </div>
    );
}