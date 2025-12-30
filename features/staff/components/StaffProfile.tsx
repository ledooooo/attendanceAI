import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { 
    Save, User, Clock, Phone, FileText, Star, ShieldCheck, 
    Loader2, Lock, Calendar, Briefcase, Mail, MapPin, BadgeCheck 
} from 'lucide-react';

interface Props {
    employee: Employee;
    isEditable?: boolean;
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
        work_days: Array.isArray(employee.work_days) ? employee.work_days.join(', ') : (employee.work_days || '')
    });

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
        if (!isEditable) return;
        setLoading(true);
        try {
            const workDaysArray = formData.work_days.split(/[,،]/).map((d: string) => d.trim()).filter((d: string) => d);
            const { error } = await supabase
                .from('employees')
                .update({ ...formData, work_days: workDaysArray })
                .eq('id', employee.id);

            if (error) throw error;
            alert('✅ تم تحديث الملف الشخصي بنجاح');
            if (onUpdate) onUpdate();
        } catch (err: any) {
            alert('❌ خطأ: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const commonProps = { disabled: !isEditable };
    // تحسين ستايل الحقول عند القراءة فقط
    const inputClass = !isEditable 
        ? "bg-transparent border-transparent px-0 font-bold text-gray-800 shadow-none focus:ring-0" 
        : "bg-gray-50 border-gray-200 focus:bg-white";

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            
            {/* --- 1. Header Section (Banner) --- */}
            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-emerald-500 to-teal-600 opacity-10"></div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-bl-full opacity-5"></div>

                <div className="relative flex flex-col md:flex-row items-start md:items-end gap-6 mt-4">
                    {/* Profile Image */}
                    <div className="w-28 h-28 rounded-[2rem] bg-white p-1.5 shadow-lg -mt-8 md:mt-0 z-10">
                        {formData.photo_url ? (
                            <img src={formData.photo_url} alt="Profile" className="w-full h-full object-cover rounded-[1.7rem]" />
                        ) : (
                            <div className="w-full h-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl font-black rounded-[1.7rem]">
                                {formData.name.charAt(0)}
                            </div>
                        )}
                    </div>

                    {/* Basic Info */}
                    <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-2xl font-black text-gray-800">{formData.name}</h2>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${formData.status === 'نشط' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                <div className={`w-2 h-2 rounded-full ${formData.status === 'نشط' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                {formData.status}
                            </span>
                        </div>
                        <p className="text-gray-500 font-medium flex items-center gap-2">
                            <Briefcase className="w-4 h-4"/> {formData.specialty || 'غير محدد'}
                            <span className="text-gray-300">|</span>
                            <span className="text-emerald-600 font-mono font-bold">ID: {formData.employee_id}</span>
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 self-end">
                        {isEditable ? (
                            <button onClick={handleSave} disabled={loading} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 flex items-center gap-2 transition-all active:scale-95">
                                {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                                حفظ التعديلات
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 text-gray-400 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                                <Lock className="w-4 h-4"/> <span className="text-xs font-bold">للقراءة فقط</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* --- 2. Left Column (Details) --- */}
                <div className="lg:col-span-8 space-y-6">
                    
                    {/* A. Personal & Work Info */}
                    <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
                        <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><User className="w-5 h-5"/></div>
                            البيانات الأساسية
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            <Input label="الاسم الرباعي" value={formData.name} onChange={(v:any)=>setFormData({...formData, name: v})} {...commonProps} className={inputClass} />
                            <Input label="الرقم القومي" value={formData.national_id} onChange={(v:any)=>setFormData({...formData, national_id: v})} {...commonProps} className={inputClass} />
                            <Input label="تاريخ التعيين" type="date" value={formData.join_date} onChange={(v:any)=>setFormData({...formData, join_date: v})} {...commonProps} className={inputClass} />
                            
                            {isEditable ? (
                                <Select label="النوع" options={['ذكر', 'أنثى']} value={formData.gender} onChange={(v:any)=>setFormData({...formData, gender: v})} />
                            ) : (
                                <Input label="النوع" value={formData.gender} readOnly className={inputClass} />
                            )}
                            
                            <Input label="الدرجة الوظيفية" value={formData.grade} onChange={(v:any)=>setFormData({...formData, grade: v})} {...commonProps} className={inputClass} />
                            <Input label="الديانة" value={formData.religion} onChange={(v:any)=>setFormData({...formData, religion: v})} {...commonProps} className={inputClass} />
                        </div>
                    </div>

                    {/* B. Contact Info */}
                    <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
                        <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><Phone className="w-5 h-5"/></div>
                            معلومات التواصل
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            <Input label="رقم الهاتف" value={formData.phone} onChange={(v:any)=>setFormData({...formData, phone: v})} {...commonProps} className={inputClass} />
                            <Input label="البريد الإلكتروني" value={formData.email} onChange={(v:any)=>setFormData({...formData, email: v})} {...commonProps} className={inputClass} />
                            <div className="md:col-span-2">
                                <Input label="رابط الصورة الشخصية" value={formData.photo_url} onChange={(v:any)=>setFormData({...formData, photo_url: v})} {...commonProps} className={inputClass} />
                            </div>
                        </div>
                    </div>

                    {/* C. Additional Info */}
                    <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
                         <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <div className="p-2 bg-gray-50 rounded-lg text-gray-600"><FileText className="w-5 h-5"/></div>
                            ملفات وملاحظات
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="رابط البطاقة (وجه)" value={formData.id_front_url} onChange={(v:any)=>setFormData({...formData, id_front_url: v})} {...commonProps} className={inputClass} />
                            <Input label="رابط البطاقة (ظهر)" value={formData.id_back_url} onChange={(v:any)=>setFormData({...formData, id_back_url: v})} {...commonProps} className={inputClass} />
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-400 mb-2">ملاحظات إدارية</label>
                                <textarea 
                                    value={formData.notes} 
                                    onChange={(e)=>setFormData({...formData, notes: e.target.value})} 
                                    disabled={!isEditable}
                                    className={`w-full p-4 rounded-2xl border outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px] text-sm font-medium ${!isEditable ? 'bg-gray-50 border-transparent text-gray-600' : 'bg-white border-gray-200'}`}
                                ></textarea>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- 3. Right Column (Stats & Work) --- */}
                <div className="lg:col-span-4 space-y-6">
                    
                    {/* A. Leave Stats Cards */}
                    <div className="bg-gradient-to-br from-emerald-600 to-teal-800 p-6 rounded-[2.5rem] text-white shadow-xl shadow-emerald-100">
                        <h4 className="font-bold mb-6 flex items-center gap-2 text-emerald-100">
                            <Star className="w-5 h-5"/> أرصدة الإجازات
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                                <span className="text-xs text-emerald-200 block mb-1">متبقي اعتيادي</span>
                                <span className="text-3xl font-black">{formData.remaining_annual}</span>
                                <span className="text-[10px] opacity-70 block">من أصل {formData.leave_annual_balance}</span>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                                <span className="text-xs text-emerald-200 block mb-1">متبقي عارضة</span>
                                <span className="text-3xl font-black">{formData.remaining_casual}</span>
                                <span className="text-[10px] opacity-70 block">من أصل {formData.leave_casual_balance}</span>
                            </div>
                        </div>
                        
                        {/* Only show inputs when editing to fix balances */}
                        {isEditable && (
                            <div className="mt-6 pt-6 border-t border-white/20 grid gap-3">
                                <p className="text-xs font-bold text-emerald-200">تعديل الأرصدة:</p>
                                <input type="number" placeholder="رصيد سنوي" className="bg-white/20 border-none rounded-lg p-2 text-white placeholder-emerald-200 text-sm" value={formData.leave_annual_balance} onChange={e=>setFormData({...formData, leave_annual_balance: Number(e.target.value)})} />
                                <input type="number" placeholder="متبقي سنوي" className="bg-white/20 border-none rounded-lg p-2 text-white placeholder-emerald-200 text-sm" value={formData.remaining_annual} onChange={e=>setFormData({...formData, remaining_annual: Number(e.target.value)})} />
                            </div>
                        )}
                    </div>

                    {/* B. Work Schedule */}
                    <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
                        <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><Clock className="w-5 h-5"/></div>
                            مواعيد العمل
                        </h4>
                        
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl">
                                <div className="text-center flex-1 border-l border-gray-200">
                                    <span className="text-xs text-gray-400 block mb-1">الحضور</span>
                                    <span className="font-black text-gray-800 text-lg">{formData.start_time || '--:--'}</span>
                                </div>
                                <div className="text-center flex-1">
                                    <span className="text-xs text-gray-400 block mb-1">الانصراف</span>
                                    <span className="font-black text-gray-800 text-lg">{formData.end_time || '--:--'}</span>
                                </div>
                            </div>

                            {isEditable ? (
                                <div className="grid grid-cols-2 gap-2">
                                     <Input label="تعديل الحضور" type="time" value={formData.start_time} onChange={(v:any)=>setFormData({...formData, start_time: v})} className="text-xs"/>
                                     <Input label="تعديل الانصراف" type="time" value={formData.end_time} onChange={(v:any)=>setFormData({...formData, end_time: v})} className="text-xs"/>
                                </div>
                            ) : null}

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2">أيام العمل</label>
                                <div className="flex flex-wrap gap-2">
                                    {formData.work_days.split(/[,،]/).map((day, idx) => (
                                        day.trim() && (
                                            <span key={idx} className="bg-orange-50 text-orange-700 px-3 py-1 rounded-lg text-xs font-bold border border-orange-100">
                                                {day.trim()}
                                            </span>
                                        )
                                    ))}
                                    {!formData.work_days && <span className="text-xs text-gray-400">لم تحدد أيام عمل</span>}
                                </div>
                                {isEditable && (
                                    <input 
                                        type="text" 
                                        className="mt-2 w-full text-sm p-2 border rounded-xl" 
                                        placeholder="اكتب الأيام (السبت، الأحد...)" 
                                        value={formData.work_days} 
                                        onChange={(e)=>setFormData({...formData, work_days: e.target.value})}
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* C. Absense Stats */}
                    <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
                         <div className="flex items-center justify-between">
                             <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                <div className="p-2 bg-red-50 rounded-lg text-red-600"><ShieldCheck className="w-5 h-5"/></div>
                                إجمالي الغياب
                             </h4>
                             <span className="text-3xl font-black text-red-600">{formData.total_absence}</span>
                         </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
