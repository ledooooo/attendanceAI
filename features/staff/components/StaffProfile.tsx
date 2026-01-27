import React, { useState, useEffect } from 'react';
import { User, Save, Camera, Calendar, Briefcase, FileText, Phone, Loader2, Baby, Clock, Timer, Syringe } from 'lucide-react';
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
    const [isPartTimeEnabled, setIsPartTimeEnabled] = useState(false);

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
                // يتم إرسال الحقول الجديدة تلقائياً لأنها في formData
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
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="الجنس" name="gender" value={formData.gender} onChange={handleChange} disabled={!isEditable} as="select" options={['ذكر', 'أنثى']} />
                            <Field label="الديانة" name="religion" value={formData.religion} onChange={handleChange} disabled={!isEditable} as="select" options={['مسلم', 'مسيحي']} />
                        </div>
                    </div>
                </Section>

                {/* 3. Job Details */}
                <Section title="تفاصيل الوظيفة والتواريخ" icon={Briefcase}>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="الكود الوظيفي" name="employee_id" value={formData.employee_id} onChange={handleChange} disabled={!isEditable} />
                        <Field label="الدرجة الوظيفية" name="grade" value={formData.grade} onChange={handleChange} disabled={!isEditable} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <Field label="تاريخ استلام العمل" type="date" name="join_date" value={formData.join_date} onChange={handleChange} disabled={!isEditable} />
                        <Field label="تاريخ إخلاء الطرف" type="date" name="resignation_date" value={formData.resignation_date} onChange={handleChange} disabled={!isEditable} placeholder="dd/mm/yyyy" />
                    </div>
                    <Field label="المركز التابع له" name="center_id" value={formData.center_id} onChange={handleChange} disabled={!isEditable} />
                    <Field label="المهام الإدارية" name="admin_tasks" value={formData.admin_tasks} onChange={handleChange} disabled={!isEditable} />
                </Section>

                {/* 4. Schedule */}
                <Section title="المواعيد ونظام العمل" icon={Calendar}>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <Field label="وقت الحضور" type="time" name="start_time" value={formData.start_time} onChange={handleChange} disabled={!isEditable} />
                        <Field label="وقت الانصراف" type="time" name="end_time" value={formData.end_time} onChange={handleChange} disabled={!isEditable} />
                    </div>

                    <div className={`p-4 rounded-2xl border transition-all ${isPartTimeEnabled ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <Timer className={`w-5 h-5 ${isPartTimeEnabled ? 'text-indigo-600' : 'text-gray-400'}`}/>
                                تفعيل نظام العمل الجزئي (أيام محددة)؟
                            </label>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold ${isPartTimeEnabled ? 'text-indigo-600' : 'text-gray-400'}`}>
                                    {isPartTimeEnabled ? 'مفعل' : 'غير مفعل'}
                                </span>
                                <input 
                                    type="checkbox" 
                                    className="toggle-checkbox w-5 h-5 accent-indigo-600"
                                    checked={isPartTimeEnabled}
                                    onChange={(e) => isEditable && togglePartTime(e.target.checked)}
                                    disabled={!isEditable}
                                />
                            </div>
                        </div>

                        {isPartTimeEnabled && (
                            <div className="animate-in fade-in space-y-4">
                                <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-indigo-100">
                                    <Field label="من تاريخ" type="date" name="part_time_start_date" value={formData.part_time_start_date} onChange={handleChange} disabled={!isEditable} />
                                    <Field label="إلى تاريخ" type="date" name="part_time_end_date" value={formData.part_time_end_date} onChange={handleChange} disabled={!isEditable} />
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-indigo-700 mb-2">
                                        اختر أيام الحضور (خلال الفترة المحددة فقط):
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {DAYS_OPTIONS.map(day => (
                                            <button
                                                type="button"
                                                key={day}
                                                onClick={() => isEditable && handleWorkDayToggle(day)}
                                                disabled={!isEditable}
                                                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                                                    (formData.work_days || []).includes(day)
                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'
                                                }`}
                                            >
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
                                        <InfoIcon className="w-3 h-3"/>
                                        ملاحظة: خارج هذه الفترة، يعود الموظف للعمل "دوام كامل" (من السبت إلى الخميس).
                                    </p>
                                </div>
                            </div>
                        )}

                        {!isPartTimeEnabled && (
                            <p className="text-[10px] text-gray-400 text-center">
                                الموظف يعمل بنظام الدوام الكامل الافتراضي (السبت - الخميس)
                            </p>
                        )}
                    </div>
                </Section>

                {/* 5. Leaves & Maternity */}
                <div className="xl:col-span-2">
                    <Section title="الإجازات وإعدادات الأمومة" icon={Baby}>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <BalanceCard label="رصيد اعتيادي" value={formData.leave_annual_balance} name="leave_annual_balance" onChange={handleChange} editable={isEditable} color="blue" />
                                <BalanceCard label="متبقي اعتيادي" value={formData.remaining_annual} name="remaining_annual" onChange={handleChange} editable={isEditable} color="blue" />
                                <BalanceCard label="رصيد عارضة" value={formData.leave_casual_balance} name="leave_casual_balance" onChange={handleChange} editable={isEditable} color="orange" />
                                <BalanceCard label="متبقي عارضة" value={formData.remaining_casual} name="remaining_casual" onChange={handleChange} editable={isEditable} color="orange" />
                            </div>

                            <div className="bg-pink-50/50 p-4 rounded-2xl border border-pink-100 space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                        <Baby className="w-4 h-4 text-pink-500"/>
                                        إجازة وضع / رضاعة؟
                                    </label>
                                    <select 
                                        name="maternity" 
                                        value={formData.maternity ? 'نعم' : 'لا'} 
                                        onChange={(e) => setFormData({...formData, maternity: e.target.value === 'نعم'})}
                                        disabled={!isEditable}
                                        className="bg-white border border-pink-200 text-pink-600 font-bold text-sm rounded-lg px-3 py-1 outline-none"
                                    >
                                        <option value="لا">لا</option>
                                        <option value="نعم">نعم</option>
                                    </select>
                                </div>

                                {(formData.maternity === true || formData.maternity === 'نعم') && (
                                    <div className="space-y-3 animate-in slide-in-from-top-2 pt-2 border-t border-pink-100">
                                        <div className="grid grid-cols-2 gap-2">
                                            <Field label="بداية الرضاعة" type="date" name="nursing_start_date" value={formData.nursing_start_date} onChange={handleChange} disabled={!isEditable} />
                                            <Field label="نهاية الرضاعة" type="date" name="nursing_end_date" value={formData.nursing_end_date} onChange={handleChange} disabled={!isEditable} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 mb-1.5">توقيت ساعة الرضاعة</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => isEditable && setFormData({...formData, nursing_time: 'morning'})}
                                                    className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition-all ${
                                                        formData.nursing_time === 'morning' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-gray-500 border-gray-200'
                                                    }`}
                                                >
                                                    <Clock className="w-3 h-3"/> صباحاً (تأخير)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => isEditable && setFormData({...formData, nursing_time: 'evening'})}
                                                    className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition-all ${
                                                        formData.nursing_time === 'evening' ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-500 border-gray-200'
                                                    }`}
                                                >
                                                    <Clock className="w-3 h-3"/> مساءً (انصراف)
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Section>
                </div>

                {/* ✅ 6. Vaccination Info (New Section) */}
                <div className="xl:col-span-2">
                    <Section title="التطعيمات الصحية (التهاب كبدي B)" icon={Syringe}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Field label="تاريخ الجرعة الأولى" type="date" name="hep_b_dose1" value={formData.hep_b_dose1} onChange={handleChange} disabled={!isEditable} />
                            <Field label="تاريخ الجرعة الثانية" type="date" name="hep_b_dose2" value={formData.hep_b_dose2} onChange={handleChange} disabled={!isEditable} />
                            <Field label="تاريخ الجرعة الثالثة" type="date" name="hep_b_dose3" value={formData.hep_b_dose3} onChange={handleChange} disabled={!isEditable} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <Field label="مكان التطعيم" name="hep_b_location" value={formData.hep_b_location} onChange={handleChange} disabled={!isEditable} placeholder="اسم المستشفى أو المركز..." />
                            <Field label="ملاحظات التطعيم" name="hep_b_notes" value={formData.hep_b_notes} onChange={handleChange} disabled={!isEditable} placeholder="أي أعراض أو ملاحظات إضافية..." />
                        </div>
                    </Section>
                </div>

                {/* 7. Contact & Files */}
                <div className="xl:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Section title="بيانات الاتصال" icon={Phone}>
                            <Field label="رقم الهاتف" name="phone" value={formData.phone} onChange={handleChange} disabled={!isEditable} />
                            <Field label="البريد الإلكتروني" name="email" value={formData.email} onChange={handleChange} disabled={!isEditable} />
                            <Field label="الدورات التدريبية" name="training_courses" value={formData.training_courses} onChange={handleChange} disabled={!isEditable} as="textarea" />
                        </Section>

                        <Section title="مرفقات وملاحظات" icon={FileText}>
                            <Field label="رابط البطاقة (وجه)" name="id_front_url" value={formData.id_front_url} onChange={handleChange} disabled={!isEditable} />
                            <Field label="رابط البطاقة (ظهر)" name="id_back_url" value={formData.id_back_url} onChange={handleChange} disabled={!isEditable} />
                            <Field label="ملاحظات إضافية" name="notes" value={formData.notes} onChange={handleChange} disabled={!isEditable} as="textarea" />
                        </Section>
                    </div>
                </div>

            </div>
        </form>
    );
}

// Sub-components (Reused)
const Section = ({ title, icon: Icon, children }: any) => (
    <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow h-full">
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
            <input className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-gray-700 text-sm disabled:opacity-60" {...props} />
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

// Simple Info Icon Component
const InfoIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
);
