import React, { useState, useEffect } from 'react';
import { User, Save, Upload, Camera, Calendar, Briefcase, FileText, Phone, Mail, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';

interface Props {
    employee: Employee;
    isEditable?: boolean;
    onUpdate?: () => void;
}

const DAYS_OPTIONS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

export default function StaffProfile({ employee, isEditable = false, onUpdate }: Props) {
    const [formData, setFormData] = useState<any>({ ...employee });
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        // التأكد من أن work_days هي مصفوفة وليست نصاً
        let wd = employee.work_days;
        if (typeof wd === 'string') wd = (wd as string).split(',');
        if (!Array.isArray(wd)) wd = [];

        setFormData({ ...employee, work_days: wd });
    }, [employee]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleWorkDayToggle = (day: string) => {
        let currentDays = formData.work_days || [];
        if (currentDays.includes(day)) {
            setFormData({ ...formData, work_days: currentDays.filter((d: string) => d !== day) });
        } else {
            setFormData({ ...formData, work_days: [...currentDays, day] });
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setUploading(true);
        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${employee.employee_id}_${Date.now()}.${fileExt}`; // اسم فريد
        const filePath = `${fileName}`;

        try {
            const { error: uploadError } = await supabase.storage
                .from('staff-photos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('staff-photos').getPublicUrl(filePath);
            
            // تحديث الواجهة فوراً
            setFormData((prev: any) => ({ ...prev, photo_url: urlData.publicUrl }));
            alert('تم رفع الصورة بنجاح! لا تنس حفظ التعديلات.');
        } catch (error: any) {
            console.error(error);
            alert('فشل رفع الصورة: تأكد من إنشاء bucket باسم "staff-photos" في Supabase وجعله Public.');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEditable) return;
        setLoading(true);
        try {
            const payload = {
                ...formData,
                work_days: formData.work_days, // Supabase سيقبل المصفوفة إذا كان العمود نصي (سيحولها JSON) أو مصفوفة نصية
                leave_annual_balance: Number(formData.leave_annual_balance),
                leave_casual_balance: Number(formData.leave_casual_balance),
                remaining_annual: Number(formData.remaining_annual),
                remaining_casual: Number(formData.remaining_casual),
                total_absence: Number(formData.total_absence),
            };

            const { error } = await supabase
                .from('employees')
                .update(payload)
                .eq('id', employee.id);

            if (error) throw error;
            alert('✅ تم تحديث البيانات بنجاح');
            if (onUpdate) onUpdate();
        } catch (error: any) {
            alert('❌ خطأ: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-500 pb-10">
            
            {/* 1. Header & Image */}
            <div className="flex flex-col md:flex-row items-center gap-6 bg-gradient-to-br from-blue-50 to-white p-8 rounded-[30px] border border-blue-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 rounded-bl-full opacity-50 pointer-events-none"></div>
                
                <div className="relative group shrink-0">
                    <div className="w-36 h-36 rounded-[2rem] border-4 border-white shadow-xl overflow-hidden bg-white">
                        {formData.photo_url ? (
                            <img src={formData.photo_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                                <User className="w-16 h-16" />
                            </div>
                        )}
                    </div>
                    {isEditable && (
                        <label className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-3 rounded-2xl cursor-pointer hover:bg-blue-700 shadow-lg transition-transform transform hover:scale-110 border-4 border-white">
                            {uploading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Camera className="w-5 h-5" />}
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                    )}
                </div>

                <div className="text-center md:text-right flex-1 z-10">
                    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                        <h2 className="text-3xl font-black text-gray-800">{formData.name}</h2>
                        <span className={`px-3 py-1 rounded-lg text-xs font-black w-fit mx-auto md:mx-0 ${formData.status === 'نشط' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {formData.status}
                        </span>
                    </div>
                    <p className="text-gray-500 font-bold flex items-center justify-center md:justify-start gap-2 mb-4">
                        <Briefcase className="w-4 h-4"/> {formData.specialty}
                        <span className="text-gray-300">|</span>
                        <span className="font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">#{formData.employee_id}</span>
                    </p>
                    
                    {isEditable && (
                        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg hover:shadow-blue-200 transition-all flex items-center gap-2 mx-auto md:mx-0">
                            {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                            حفظ التعديلات
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                
                {/* 2. Personal Info */}
                <Section title="البيانات الشخصية" icon={User}>
                    <Field label="الاسم بالكامل" name="name" value={formData.name} onChange={handleChange} disabled={!isEditable} />
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="الرقم القومي" name="national_id" value={formData.national_id} onChange={handleChange} disabled={!isEditable} />
                        <Field label="تاريخ التعيين" type="date" name="join_date" value={formData.join_date} onChange={handleChange} disabled={!isEditable} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="الجنس" name="gender" value={formData.gender} onChange={handleChange} disabled={!isEditable} as="select" options={['ذكر', 'أنثى']} />
                        <Field label="الديانة" name="religion" value={formData.religion} onChange={handleChange} disabled={!isEditable} as="select" options={['مسلم', 'مسيحي']} />
                    </div>
                </Section>

                {/* 3. Job Details */}
                <Section title="تفاصيل الوظيفة" icon={Briefcase}>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="الكود الوظيفي" name="employee_id" value={formData.employee_id} onChange={handleChange} disabled={!isEditable} />
                        <Field label="الدرجة الوظيفية" name="grade" value={formData.grade} onChange={handleChange} disabled={!isEditable} />
                    </div>
                    <Field label="التخصص" name="specialty" value={formData.specialty} onChange={handleChange} disabled={!isEditable} />
                    <Field label="المركز التابع له" name="center_id" value={formData.center_id} onChange={handleChange} disabled={!isEditable} />
                    <Field label="المهام الإدارية" name="admin_tasks" value={formData.admin_tasks} onChange={handleChange} disabled={!isEditable} />
                </Section>

                {/* 4. Contact Info */}
                <Section title="بيانات الاتصال" icon={Phone}>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="رقم الهاتف" name="phone" value={formData.phone} onChange={handleChange} disabled={!isEditable} />
                        <Field label="البريد الإلكتروني" name="email" value={formData.email} onChange={handleChange} disabled={!isEditable} />
                    </div>
                    <Field label="الدورات التدريبية" name="training_courses" value={formData.training_courses} onChange={handleChange} disabled={!isEditable} as="textarea" />
                </Section>

                {/* 5. Schedule & Work Days */}
                <Section title="المواعيد وأيام العمل" icon={Calendar}>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <Field label="وقت الحضور" type="time" name="start_time" value={formData.start_time} onChange={handleChange} disabled={!isEditable} />
                        <Field label="وقت الانصراف" type="time" name="end_time" value={formData.end_time} onChange={handleChange} disabled={!isEditable} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-2">أيام العمل الأسبوعية</label>
                        <div className="flex flex-wrap gap-2">
                            {DAYS_OPTIONS.map(day => (
                                <button
                                    type="button"
                                    key={day}
                                    onClick={() => isEditable && handleWorkDayToggle(day)}
                                    disabled={!isEditable}
                                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                                        (formData.work_days || []).includes(day)
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                    </div>
                </Section>

                {/* 6. Leaves Balance */}
                <div className="xl:col-span-2">
                    <Section title="أرصدة الإجازات والغياب" icon={FileText}>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            <BalanceCard label="رصيد اعتيادي" value={formData.leave_annual_balance} name="leave_annual_balance" onChange={handleChange} editable={isEditable} color="blue" />
                            <BalanceCard label="متبقي اعتيادي" value={formData.remaining_annual} name="remaining_annual" onChange={handleChange} editable={isEditable} color="blue" />
                            
                            <BalanceCard label="رصيد عارضة" value={formData.leave_casual_balance} name="leave_casual_balance" onChange={handleChange} editable={isEditable} color="orange" />
                            <BalanceCard label="متبقي عارضة" value={formData.remaining_casual} name="remaining_casual" onChange={handleChange} editable={isEditable} color="orange" />
                            
                            <BalanceCard label="إجمالي الغياب" value={formData.total_absence} name="total_absence" onChange={handleChange} editable={isEditable} color="red" />
                            
                            <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200">
                                <label className="block text-[10px] font-bold text-gray-500 mb-1">إجازة وضع؟</label>
                                <select 
                                    name="maternity" 
                                    value={formData.maternity} 
                                    onChange={handleChange} 
                                    disabled={!isEditable}
                                    className="w-full bg-transparent font-black text-gray-800 outline-none"
                                >
                                    <option value="لا">لا</option>
                                    <option value="نعم">نعم</option>
                                </select>
                            </div>
                        </div>
                    </Section>
                </div>

                {/* 7. Files & Notes */}
                <div className="xl:col-span-2">
                    <Section title="مرفقات وملاحظات" icon={FileText}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="رابط البطاقة (وجه)" name="id_front_url" value={formData.id_front_url} onChange={handleChange} disabled={!isEditable} />
                            <Field label="رابط البطاقة (ظهر)" name="id_back_url" value={formData.id_back_url} onChange={handleChange} disabled={!isEditable} />
                            <div className="md:col-span-2">
                                <Field label="ملاحظات إضافية" name="notes" value={formData.notes} onChange={handleChange} disabled={!isEditable} as="textarea" />
                            </div>
                        </div>
                    </Section>
                </div>

            </div>
        </form>
    );
}

// Sub-components
const Section = ({ title, icon: Icon, children }: any) => (
    <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
        <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2 pb-3 border-b border-gray-50">
            <div className="p-2 bg-gray-50 rounded-xl text-gray-600"><Icon className="w-5 h-5"/></div>
            {title}
        </h4>
        <div className="space-y-4">{children}</div>
    </div>
);

const Field = ({ label, as = 'input', options, ...props }: any) => (
    <div>
        <label className="block text-xs font-bold text-gray-400 mb-1.5 mr-1">{label}</label>
        {as === 'select' ? (
            <select className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-gray-700 text-sm" {...props}>
                <option value="">اختر...</option>
                {options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        ) : as === 'textarea' ? (
            <textarea className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-blue-500 outline-none transition-all font-medium text-sm min-h-[80px]" {...props} />
        ) : (
            <input className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-gray-700 text-sm" {...props} />
        )}
    </div>
);

const BalanceCard = ({ label, value, name, onChange, editable, color }: any) => (
    <div className={`p-4 rounded-2xl border ${editable ? 'bg-white' : 'bg-gray-50'} border-${color}-100 relative overflow-hidden group`}>
        <div className={`absolute top-0 right-0 w-1 h-full bg-${color}-500`}></div>
        <span className="text-[10px] font-bold text-gray-400 block mb-1">{label}</span>
        {editable ? (
            <input 
                type="number" 
                name={name} 
                value={value} 
                onChange={onChange} 
                className="w-full bg-transparent font-black text-2xl text-gray-800 outline-none border-b border-transparent focus:border-gray-300"
            />
        ) : (
            <span className="font-black text-2xl text-gray-800">{value}</span>
        )}
    </div>
);
