import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { Save, User, Clock, Phone, FileText, Star, ShieldCheck, Loader2, Lock } from 'lucide-react';

interface Props {
    employee: Employee;
    isEditable?: boolean; // خاصية جديدة للتحكم في التعديل
    onUpdate?: () => void;
}

export default function StaffProfile({ employee, isEditable = false, onUpdate }: Props) {
    const [loading, setLoading] = useState(false);
    
    // تهيئة البيانات
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
        status: employee.status || 'نشط',
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
        // URLs
        photo_url: employee.photo_url || '',
        id_front_url: employee.id_front_url || '',
        id_back_url: employee.id_back_url || '',
        // Work days (Converted to string)
        work_days: Array.isArray(employee.work_days) ? employee.work_days.join(', ') : (employee.work_days || '')
    });

    // تحديث البيانات عند تغيير الموظف المختار
    useEffect(() => {
        setFormData({
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
            status: employee.status || 'نشط',
            start_time: employee.start_time || '',
            end_time: employee.end_time || '',
            leave_annual_balance: employee.leave_annual_balance || 21,
            leave_casual_balance: employee.leave_casual_balance || 7,
            remaining_annual: employee.remaining_annual || 21,
            remaining_casual: employee.remaining_casual || 7,
            total_absence: employee.total_absence || 0,
            admin_tasks: employee.admin_tasks || '',
            training_courses: employee.training_courses || '',
            notes: employee.notes || '',
            photo_url: employee.photo_url || '',
            id_front_url: employee.id_front_url || '',
            id_back_url: employee.id_back_url || '',
            work_days: Array.isArray(employee.work_days) ? employee.work_days.join(', ') : (employee.work_days || '')
        });
    }, [employee]);

    const handleSave = async () => {
        if (!isEditable) return; // حماية إضافية
        setLoading(true);
        try {
            const workDaysArray = formData.work_days.split(/[,،]/).map((d: string) => d.trim()).filter((d: string) => d);

            const { error } = await supabase
                .from('employees')
                .update({
                    ...formData,
                    work_days: workDaysArray
                })
                .eq('id', employee.id);

            if (error) throw error;

            alert('تم تحديث بيانات الموظف بنجاح ✅');
            if (onUpdate) onUpdate();

        } catch (err: any) {
            alert('حدث خطأ أثناء الحفظ: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // دالة مساعدة لتعطيل الحقول إذا لم يكن التعديل متاحاً
    const commonProps = { disabled: !isEditable };
    const inputClass = !isEditable ? "bg-gray-100 text-gray-600 border-transparent cursor-not-allowed" : "";

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
            
            {/* رأس الصفحة */}
            <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800">
                    <User className="text-emerald-600 w-7 h-7" /> الملف الوظيفي الشامل
                </h3>
                
                {isEditable ? (
                    <button 
                        onClick={handleSave} 
                        disabled={loading}
                        className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2 active:scale-95 disabled:bg-gray-400"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                        حفظ التعديلات
                    </button>
                ) : (
                    <div className="flex items-center gap-2 text-gray-400 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                        <Lock className="w-4 h-4"/> <span className="text-xs font-bold">للقراءة فقط</span>
                    </div>
                )}
            </div>
            
            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 ${!isEditable ? 'opacity-90 pointer-events-none' : ''}`}>
                
                {/* 1. البيانات الشخصية */}
                <div className="bg-white p-6 rounded-[30px] border shadow-sm space-y-4 relative group hover:border-blue-200 transition-all">
                    <div className="absolute top-0 right-0 w-1 h-full bg-blue-500 rounded-r-full"></div>
                    <h4 className="font-black text-gray-600 flex items-center gap-2 mb-4 border-b pb-2"><ShieldCheck className="w-5 h-5 text-blue-500"/> البيانات الشخصية</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <Input label="الاسم الرباعي" value={formData.name} onChange={(v:any)=>setFormData({...formData, name: v})} {...commonProps} className={inputClass} />
                        </div>
                        <Input label="الكود الوظيفي (ID)" value={formData.employee_id} onChange={(v:any)=>setFormData({...formData, employee_id: v})} {...commonProps} className={inputClass} />
                        <Input label="الرقم القومي" value={formData.national_id} onChange={(v:any)=>setFormData({...formData, national_id: v})} {...commonProps} className={inputClass} />
                        
                        {isEditable ? (
                            <Select label="النوع" options={['ذكر', 'أنثى']} value={formData.gender} onChange={(v:any)=>setFormData({...formData, gender: v})} />
                        ) : (
                            <Input label="النوع" value={formData.gender} readOnly className={inputClass} />
                        )}
                        
                        <Input label="الديانة" value={formData.religion} onChange={(v:any)=>setFormData({...formData, religion: v})} {...commonProps} className={inputClass} />
                        <Input label="تاريخ التعيين" type="date" value={formData.join_date} onChange={(v:any)=>setFormData({...formData, join_date: v})} {...commonProps} className={inputClass} />
                        <Input label="الدرجة الوظيفية" value={formData.grade} onChange={(v:any)=>setFormData({...formData, grade: v})} {...commonProps} className={inputClass} />
                        
                        {isEditable ? (
                             <Select label="الحالة الحالية" options={['نشط', 'موقوف', 'إجازة', 'خارج المركز']} value={formData.status} onChange={(v:any)=>setFormData({...formData, status: v})} />
                        ) : (
                             <Input label="الحالة الحالية" value={formData.status} readOnly className={inputClass} />
                        )}
                    </div>
                </div>

                {/* 2. بيانات الاتصال */}
                <div className="bg-white p-6 rounded-[30px] border shadow-sm space-y-4 relative group hover:border-purple-200 transition-all">
                    <div className="absolute top-0 right-0 w-1 h-full bg-purple-500 rounded-r-full"></div>
                    <h4 className="font-black text-gray-600 flex items-center gap-2 mb-4 border-b pb-2"><Phone className="w-5 h-5 text-purple-500"/> الاتصال والتخصص</h4>
                    <div className="space-y-4">
                        <Input label="التخصص / المسمى" value={formData.specialty} onChange={(v:any)=>setFormData({...formData, specialty: v})} {...commonProps} className={inputClass} />
                        <Input label="رقم الهاتف" value={formData.phone} onChange={(v:any)=>setFormData({...formData, phone: v})} {...commonProps} className={inputClass} />
                        <Input label="البريد الإلكتروني" type="email" value={formData.email} onChange={(v:any)=>setFormData({...formData, email: v})} {...commonProps} className={inputClass} />
                        <Input label="رابط الصورة الشخصية" value={formData.photo_url} onChange={(v:any)=>setFormData({...formData, photo_url: v})} placeholder="https://..." {...commonProps} className={inputClass} />
                    </div>
                </div>

                {/* 3. مواعيد العمل */}
                <div className="bg-white p-6 rounded-[30px] border shadow-sm space-y-4 relative group hover:border-orange-200 transition-all">
                    <div className="absolute top-0 right-0 w-1 h-full bg-orange-500 rounded-r-full"></div>
                    <h4 className="font-black text-gray-600 flex items-center gap-2 mb-4 border-b pb-2"><Clock className="w-5 h-5 text-orange-500"/> المواعيد والنوبتجيات</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="وقت الحضور" type="time" value={formData.start_time} onChange={(v:any)=>setFormData({...formData, start_time: v})} {...commonProps} className={inputClass} />
                        <Input label="وقت الانصراف" type="time" value={formData.end_time} onChange={(v:any)=>setFormData({...formData, end_time: v})} {...commonProps} className={inputClass} />
                    </div>
                    <div>
                        <Input 
                            label="أيام العمل الرسمية" 
                            value={formData.work_days} 
                            onChange={(v:any)=>setFormData({...formData, work_days: v})} 
                            placeholder="السبت، الأحد، الاثنين..."
                            {...commonProps}
                            className={inputClass}
                        />
                    </div>
                </div>

                {/* 4. رصيد الإجازات */}
                <div className="bg-white p-6 rounded-[30px] border shadow-sm space-y-4 relative group hover:border-green-200 transition-all">
                    <div className="absolute top-0 right-0 w-1 h-full bg-green-500 rounded-r-full"></div>
                    <h4 className="font-black text-gray-600 flex items-center gap-2 mb-4 border-b pb-2"><Star className="w-5 h-5 text-green-500"/> أرشيف الإجازات</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="رصيد سنوي (أصل)" type="number" value={formData.leave_annual_balance} onChange={(v:any)=>setFormData({...formData, leave_annual_balance: Number(v)})} {...commonProps} className={inputClass} />
                        <Input label="رصيد عارضة (أصل)" type="number" value={formData.leave_casual_balance} onChange={(v:any)=>setFormData({...formData, leave_casual_balance: Number(v)})} {...commonProps} className={inputClass} />
                        
                        <div className="bg-green-50 p-2 rounded-xl border border-green-100">
                           <Input label="متبقي سنوي" type="number" value={formData.remaining_annual} onChange={(v:any)=>setFormData({...formData, remaining_annual: Number(v)})} {...commonProps} className={inputClass} />
                        </div>
                        <div className="bg-green-50 p-2 rounded-xl border border-green-100">
                           <Input label="متبقي عارضة" type="number" value={formData.remaining_casual} onChange={(v:any)=>setFormData({...formData, remaining_casual: Number(v)})} {...commonProps} className={inputClass} />
                        </div>
                        
                        <div className="col-span-2 bg-red-50 p-2 rounded-xl border border-red-100">
                            <Input label="إجمالي الغياب (بالأيام)" type="number" value={formData.total_absence} onChange={(v:any)=>setFormData({...formData, total_absence: Number(v)})} {...commonProps} className={inputClass} />
                        </div>
                    </div>
                </div>

                {/* 5. معلومات إضافية */}
                <div className="lg:col-span-2 bg-white p-6 rounded-[30px] border shadow-sm space-y-4 relative">
                    <div className="absolute top-0 right-0 w-1 h-full bg-gray-500 rounded-r-full"></div>
                    <h4 className="font-black text-gray-600 flex items-center gap-2 mb-4 border-b pb-2"><FileText className="w-5 h-5"/> ملفات وملاحظات إضافية</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="رابط صورة البطاقة (وجه)" value={formData.id_front_url} onChange={(v:any)=>setFormData({...formData, id_front_url: v})} {...commonProps} className={inputClass} />
                        <Input label="رابط صورة البطاقة (ظهر)" value={formData.id_back_url} onChange={(v:any)=>setFormData({...formData, id_back_url: v})} {...commonProps} className={inputClass} />
                        <Input label="المهام الإدارية المسندة" value={formData.admin_tasks} onChange={(v:any)=>setFormData({...formData, admin_tasks: v})} {...commonProps} className={inputClass} />
                        <Input label="الدورات التدريبية" value={formData.training_courses} onChange={(v:any)=>setFormData({...formData, training_courses: v})} {...commonProps} className={inputClass} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">ملاحظات عامة</label>
                        <textarea 
                            value={formData.notes} 
                            onChange={(e)=>setFormData({...formData, notes: e.target.value})} 
                            disabled={!isEditable}
                            className={`w-full p-3 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px] ${!isEditable ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        ></textarea>
                    </div>
                </div>

            </div>
        </div>
    );
}