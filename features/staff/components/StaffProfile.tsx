import React, { useState, useEffect } from 'react';
import { User, Save, Camera, Calendar, Briefcase, FileText, Phone, Loader2, Baby, Clock, Timer, Syringe, Building2, ShieldCheck, PhoneCall } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { useQuery } from '@tanstack/react-query';

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
    const [isPartTimeEnabled, setIsPartTimeEnabled] = useState(false);

    // جلب اسم المركز
    const { data: centerName } = useQuery({
        queryKey: ['center_name', employee.center_id],
        queryFn: async () => {
            if (!employee.center_id) return 'غير محدد';
            // نفترض أن هناك جدول للإعدادات أو المراكز، وإلا نعرض الـ ID مؤقتاً إذا لم يكن هناك جدول
            // هنا سأحاول جلبه من general_settings كما ذكرت
            const { data } = await supabase.from('general_settings').select('center_name').eq('id', employee.center_id).maybeSingle();
            return data?.center_name || employee.center_id;
        },
        enabled: !!employee.center_id
    });

    useEffect(() => {
        let wd = employee.work_days;
        if (typeof wd === 'string') wd = (wd as string).split(',');
        if (!Array.isArray(wd)) wd = [];

        setFormData({ ...employee, work_days: wd });
        
        if (employee.part_time_start_date || employee.part_time_end_date) {
            setIsPartTimeEnabled(true);
        }
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

    const togglePartTime = (enabled: boolean) => {
        setIsPartTimeEnabled(enabled);
        if (!enabled) {
            setFormData({ ...formData, part_time_start_date: null, part_time_end_date: null });
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setUploading(true);
        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${employee.employee_id}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        try {
            const { error: uploadError } = await supabase.storage
                .from('staff-photos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('staff-photos').getPublicUrl(filePath);
            
            setFormData((prev: any) => ({ ...prev, photo_url: urlData.publicUrl }));
            alert('تم رفع الصورة بنجاح! لا تنس حفظ التعديلات.');
        } catch (error: any) {
            console.error(error);
            alert('فشل رفع الصورة');
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
                work_days: formData.work_days,
                leave_annual_balance: Number(formData.leave_annual_balance),
                leave_casual_balance: Number(formData.leave_casual_balance),
                remaining_annual: Number(formData.remaining_annual),
                remaining_casual: Number(formData.remaining_casual),
                total_absence: Number(formData.total_absence),
                // سيتم إرسال emergency_phone و insurance_number تلقائياً
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
        <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in duration-500 pb-10">
            
            {/* 1. Compact Header */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full opacity-60 pointer-events-none"></div>
                
                <div className="relative group shrink-0">
                    <div className="w-24 h-24 rounded-2xl border-2 border-white shadow-md overflow-hidden bg-gray-50">
                        {formData.photo_url ? (
                            <img src={formData.photo_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <User className="w-10 h-10" />
                            </div>
                        )}
                    </div>
                    {isEditable && (
                        <label className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2 rounded-xl cursor-pointer hover:bg-blue-700 shadow-lg transition-transform transform hover:scale-105 border-2 border-white">
                            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Camera className="w-3.5 h-3.5" />}
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                    )}
                </div>

                <div className="text-center md:text-right flex-1 z-10">
                    <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                        <h2 className="text-2xl font-black text-gray-800">{formData.name}</h2>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black w-fit mx-auto md:mx-0 ${formData.status === 'نشط' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                            {formData.status}
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs text-gray-500 font-bold">
                        <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5"/> {formData.specialty}</span>
                        <span className="text-gray-300">|</span>
                        <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5"/> {centerName || 'جاري التحميل...'}</span>
                        <span className="text-gray-300">|</span>
                        <span className="font-mono bg-gray-100 px-1.5 rounded text-gray-600">#{formData.employee_id}</span>
                    </div>
                    
                    {isEditable && (
                        <div className="mt-3 flex justify-center md:justify-start">
                            <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-md hover:shadow-blue-100 transition-all flex items-center gap-2">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                                حفظ التعديلات
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                
                {/* 2. Personal & Contact Info (Combined) */}
                <Section title="البيانات الشخصية والاتصال" icon={User}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                        <Field label="الاسم بالكامل" name="name" value={formData.name} onChange={handleChange} disabled={!isEditable} className="col-span-full"/>
                        <Field label="الرقم القومي" name="national_id" value={formData.national_id} onChange={handleChange} disabled={!isEditable} />
                        <Field label="الرقم التأميني" name="insurance_number" value={formData.insurance_number} onChange={handleChange} disabled={!isEditable} icon={<ShieldCheck className="w-3 h-3"/>} />
                        <Field label="رقم الهاتف" name="phone" value={formData.phone} onChange={handleChange} disabled={!isEditable} />
                        <Field label="رقم الطوارئ" name="emergency_phone" value={formData.emergency_phone} onChange={handleChange} disabled={!isEditable} icon={<PhoneCall className="w-3 h-3 text-red-400"/>} />
                        <Field label="الجنس" name="gender" value={formData.gender} onChange={handleChange} disabled={!isEditable} as="select" options={['ذكر', 'أنثى']} />
                        <Field label="الديانة" name="religion" value={formData.religion} onChange={handleChange} disabled={!isEditable} as="select" options={['مسلم', 'مسيحي']} />
                        <Field label="البريد الإلكتروني" name="email" value={formData.email} onChange={handleChange} disabled={!isEditable} className="col-span-full" />
                    </div>
                </Section>

                {/* 3. Job Details */}
                <Section title="التفاصيل الوظيفية" icon={Briefcase}>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <Field label="الكود الوظيفي" name="employee_id" value={formData.employee_id} onChange={handleChange} disabled={!isEditable} />
                        <Field label="الدرجة الوظيفية" name="grade" value={formData.grade} onChange={handleChange} disabled={!isEditable} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100 mb-3">
                        <Field label="تاريخ استلام العمل" type="date" name="join_date" value={formData.join_date} onChange={handleChange} disabled={!isEditable} />
                        <Field label="تاريخ إخلاء الطرف" type="date" name="resignation_date" value={formData.resignation_date} onChange={handleChange} disabled={!isEditable} />
                    </div>
                    {/* حقل المركز مخفي في التعديل لأنه يفضل تعديله من الإدارة، لكن يمكن عرضه للقراءة */}
                    <div className="mb-3">
                        <label className="block text-[10px] font-bold text-gray-400 mb-1">المركز التابع له</label>
                        <div className="w-full p-2.5 rounded-xl border bg-gray-50 text-gray-700 font-bold text-sm">
                            {centerName || formData.center_id}
                        </div>
                    </div>
                    <Field label="المهام الإدارية" name="admin_tasks" value={formData.admin_tasks} onChange={handleChange} disabled={!isEditable} />
                </Section>

                {/* 4. Schedule */}
                <Section title="مواعيد العمل" icon={Calendar}>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <Field label="وقت الحضور" type="time" name="start_time" value={formData.start_time} onChange={handleChange} disabled={!isEditable} />
                        <Field label="وقت الانصراف" type="time" name="end_time" value={formData.end_time} onChange={handleChange} disabled={!isEditable} />
                    </div>

                    <div className={`p-3 rounded-2xl border transition-all ${isPartTimeEnabled ? 'bg-indigo-50/50 border-indigo-100' : 'bg-white border-gray-100'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-xs font-bold text-gray-700 flex items-center gap-2">
                                <Timer className={`w-4 h-4 ${isPartTimeEnabled ? 'text-indigo-500' : 'text-gray-400'}`}/>
                                نظام العمل الجزئي (Part-time)
                            </label>
                            <input type="checkbox" className="toggle-checkbox w-4 h-4 accent-indigo-600" checked={isPartTimeEnabled} onChange={(e) => isEditable && togglePartTime(e.target.checked)} disabled={!isEditable} />
                        </div>

                        {isPartTimeEnabled ? (
                            <div className="animate-in fade-in space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <Field label="من" type="date" name="part_time_start_date" value={formData.part_time_start_date} onChange={handleChange} disabled={!isEditable} />
                                    <Field label="إلى" type="date" name="part_time_end_date" value={formData.part_time_end_date} onChange={handleChange} disabled={!isEditable} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-indigo-400 mb-1.5">أيام الحضور:</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {DAYS_OPTIONS.map(day => (
                                            <button type="button" key={day} onClick={() => isEditable && handleWorkDayToggle(day)} disabled={!isEditable}
                                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                                                    (formData.work_days || []).includes(day) ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                                }`}>
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-[10px] text-gray-400 text-center py-1">دوام كامل افتراضي (السبت - الخميس)</p>
                        )}
                    </div>
                </Section>

                {/* 5. Leaves & Maternity */}
                <div className="xl:col-span-2">
                    <Section title="أرصدة الإجازات والأمومة" icon={Baby}>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="lg:col-span-2 grid grid-cols-4 gap-2">
                                <BalanceCard label="رصيد اعتيادي" value={formData.leave_annual_balance} name="leave_annual_balance" onChange={handleChange} editable={isEditable} color="blue" />
                                <BalanceCard label="متبقي اعتيادي" value={formData.remaining_annual} name="remaining_annual" onChange={handleChange} editable={isEditable} color="blue" />
                                <BalanceCard label="رصيد عارضة" value={formData.leave_casual_balance} name="leave_casual_balance" onChange={handleChange} editable={isEditable} color="orange" />
                                <BalanceCard label="متبقي عارضة" value={formData.remaining_casual} name="remaining_casual" onChange={handleChange} editable={isEditable} color="orange" />
                            </div>

                            <div className="bg-pink-50/30 p-3 rounded-2xl border border-pink-100 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5"><Baby className="w-3.5 h-3.5 text-pink-500"/> وضع/رضاعة</label>
                                    <select name="maternity" value={formData.maternity ? 'نعم' : 'لا'} onChange={(e) => setFormData({...formData, maternity: e.target.value === 'نعم'})} disabled={!isEditable} className="bg-white border border-pink-200 text-pink-600 font-bold text-xs rounded-lg px-2 py-0.5 outline-none">
                                        <option value="لا">لا</option> <option value="نعم">نعم</option>
                                    </select>
                                </div>
                                {(formData.maternity === true || formData.maternity === 'نعم') && (
                                    <div className="space-y-2 pt-1">
                                        <div className="grid grid-cols-2 gap-2">
                                            <Field label="بداية" type="date" name="nursing_start_date" value={formData.nursing_start_date} onChange={handleChange} disabled={!isEditable} />
                                            <Field label="نهاية" type="date" name="nursing_end_date" value={formData.nursing_end_date} onChange={handleChange} disabled={!isEditable} />
                                        </div>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => isEditable && setFormData({...formData, nursing_time: 'morning'})} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border ${formData.nursing_time === 'morning' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-gray-500'}`}>صباحاً</button>
                                            <button type="button" onClick={() => isEditable && setFormData({...formData, nursing_time: 'evening'})} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border ${formData.nursing_time === 'evening' ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-500'}`}>مساءً</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Section>
                </div>

                {/* 6. Health & Additional */}
                <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Section title="تطعيم فيروس B" icon={Syringe}>
                        <div className="grid grid-cols-3 gap-2">
                            <Field label="جرعة 1" type="date" name="hep_b_dose1" value={formData.hep_b_dose1} onChange={handleChange} disabled={!isEditable} />
                            <Field label="جرعة 2" type="date" name="hep_b_dose2" value={formData.hep_b_dose2} onChange={handleChange} disabled={!isEditable} />
                            <Field label="جرعة 3" type="date" name="hep_b_dose3" value={formData.hep_b_dose3} onChange={handleChange} disabled={!isEditable} />
                        </div>
                        <Field label="ملاحظات التطعيم" name="hep_b_notes" value={formData.hep_b_notes} onChange={handleChange} disabled={!isEditable} className="mt-2"/>
                    </Section>

                    <Section title="ملاحظات وملفات" icon={FileText}>
                         <div className="grid grid-cols-2 gap-2 mb-2">
                            <Field label="رابط البطاقة (وجه)" name="id_front_url" value={formData.id_front_url} onChange={handleChange} disabled={!isEditable} />
                            <Field label="رابط البطاقة (ظهر)" name="id_back_url" value={formData.id_back_url} onChange={handleChange} disabled={!isEditable} />
                         </div>
                        <Field label="ملاحظات إضافية" name="notes" value={formData.notes} onChange={handleChange} disabled={!isEditable} as="textarea" />
                    </Section>
                </div>

            </div>
        </form>
    );
}

// Compact Sub-components
const Section = ({ title, icon: Icon, children }: any) => (
    <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] h-full">
        <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 pb-2 border-b border-gray-50 text-sm">
            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><Icon className="w-4 h-4"/></div>
            {title}
        </h4>
        <div className="space-y-0">{children}</div>
    </div>
);

const Field = ({ label, as = 'input', options, className = "", icon, ...props }: any) => (
    <div className={className}>
        <label className="flex items-center gap-1 text-[10px] font-bold text-gray-400 mb-1">
            {icon} {label}
        </label>
        {as === 'select' ? (
            <select className="w-full p-2.5 rounded-xl border bg-gray-50 focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-gray-700 text-xs" {...props}>
                <option value="">اختر...</option>
                {options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        ) : as === 'textarea' ? (
            <textarea className="w-full p-2.5 rounded-xl border bg-gray-50 focus:bg-white focus:border-blue-500 outline-none transition-all font-medium text-xs min-h-[60px]" {...props} />
        ) : (
            <input className="w-full p-2.5 rounded-xl border bg-gray-50 focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-gray-700 text-xs disabled:opacity-70 disabled:bg-gray-50" {...props} />
        )}
    </div>
);

const BalanceCard = ({ label, value, name, onChange, editable, color }: any) => (
    <div className={`p-2.5 rounded-xl border ${editable ? 'bg-white' : 'bg-gray-50'} border-${color}-100 relative overflow-hidden text-center`}>
        <span className="text-[9px] font-bold text-gray-400 block mb-0.5">{label}</span>
        {editable ? (
            <input type="number" name={name} value={value} onChange={onChange} className="w-full bg-transparent font-black text-lg text-center text-gray-800 outline-none border-b border-transparent focus:border-gray-200 p-0" />
        ) : (
            <span className={`font-black text-lg text-${color}-600`}>{value}</span>
        )}
    </div>
);
