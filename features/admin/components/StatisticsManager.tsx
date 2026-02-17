import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Calendar, Loader2, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../../context/AuthContext';

// ترتيب الحقول في مجموعات لسهولة الإدخال
const CATEGORIES = [
    {
        title: "العيادات والتردد", color: "bg-blue-50 text-blue-800 border-blue-200",
        fields: [
            { key: 'outpatient_clinics', label: 'عيادات خارجية' },
            { key: 'family_planning', label: 'تنمية الاسرة' },
            { key: 'dental_clinic', label: 'عيادة الاسنان' },
            { key: 'ophthalmology_clinic', label: 'عيادة الرمد' },
            { key: 'emergency', label: 'الطوارئ' },
            { key: 'physiotherapy_total', label: 'العلاج الطبيعي' },
            { key: 'family_medicine_clinic', label: 'طب اسرة' },
            { key: 'evening_shift', label: 'مسائى' },
        ]
    },
    {
        title: "المعمل والتحاليل", color: "bg-purple-50 text-purple-800 border-purple-200",
        fields: [
            { key: 'blood_endemic_lab_total', label: 'اجمالى معمل الدم' },
            { key: 'urine_test', label: 'بول' },
            { key: 'stool_test', label: 'براز' },
            { key: 'blood_pregnancy_test', label: 'حمل بالدم' },
            { key: 'cbc_test', label: 'صورة دم كاملة' },
            { key: 'anemia_test', label: 'انيميا' },
            { key: 'thyroid_test', label: 'تحليل الغدة' },
        ]
    },
    {
        title: "المبادرات الرئاسية", color: "bg-emerald-50 text-emerald-800 border-emerald-200",
        fields: [
            { key: 'hearing_initiative', label: 'السمعيات' },
            { key: 'womens_health_initiative', label: 'صحة المراة' },
            { key: 'mother_fetus_initiative', label: 'الام والجنين' },
            { key: 'thousand_days_initiative', label: 'الالف يوم' },
            { key: 'tumors_initiative', label: 'الأورام' },
            { key: 'glaucoma_initiative', label: 'جلوكوما' },
            { key: 'heart_initiative', label: 'قلبك امانة' },
            { key: 'chronic_diseases_initiative', label: 'الامراض المزمنة' },
            { key: 'renal_impairment_initiative', label: 'اعتلال كلوى' },
        ]
    },
    {
        title: "رعاية الأم والطفل", color: "bg-pink-50 text-pink-800 border-pink-200",
        fields: [
            { key: 'child_vaccinations', label: 'تطعيمات الاطفال' },
            { key: 'child_followup', label: 'متابعة الاطفال' },
            { key: 'new_pregnancies', label: 'حوامل جدد' },
            { key: 'followup_pregnancies', label: 'حوامل مترددة' },
            { key: 'natural_births', label: 'ولادة طبيعية' },
            { key: 'integrated_care_under_2m', label: 'رعاية < شهرين' },
            { key: 'integrated_care_2m_to_5y', label: 'رعاية شهرين لـ 5س' },
            { key: 'milk_stage_1', label: 'البان مرحلة 1' },
            { key: 'milk_stage_2', label: 'البان مرحلة 2' },
        ]
    },
    {
        title: "تنمية الأسرة والوسائل", color: "bg-rose-50 text-rose-800 border-rose-200",
        fields: [
            { key: 'family_planning_new', label: 'جديد' },
            { key: 'family_planning_followup', label: 'متردد' },
            { key: 'iud_method', label: 'لولب' },
            { key: 'injection_method', label: 'حقن' },
            { key: 'capsule_method', label: 'كبسولة' },
            { key: 'condom_method', label: 'واقى' },
            { key: 'pills_method', label: 'حبوب' },
        ]
    },
    {
        title: "الأسنان", color: "bg-cyan-50 text-cyan-800 border-cyan-200",
        fields: [
            { key: 'dental_extraction', label: 'خلع' },
            { key: 'dental_filling', label: 'حشو' },
            { key: 'dental_cleaning', label: 'تنظيف' },
        ]
    },
    {
        title: "المواليد والوفيات", color: "bg-slate-100 text-slate-800 border-slate-300",
        fields: [
            { key: 'male_births_internal', label: 'ذكور داخلى' },
            { key: 'male_births_external', label: 'ذكور خارجى' },
            { key: 'female_births_internal', label: 'اناث داخلى' },
            { key: 'female_births_external', label: 'اناث خارجى' },
            { key: 'deaths', label: 'وفيات' },
        ]
    },
    {
        title: "خدمات وملفات متنوعة", color: "bg-amber-50 text-amber-800 border-amber-200",
        fields: [
            { key: 'referrals', label: 'احالة' },
            { key: 'feedback', label: 'تغذية راجعة' },
            { key: 'new_files', label: 'ملفات جدد' },
            { key: 'active_files', label: 'ملفات متحركة' },
            { key: 'inactive_files', label: 'ملفات راكدة' },
            { key: 'internal_seminars', label: 'ندوات داخلية' },
            { key: 'teenagers', label: 'مراهقين' },
            { key: 'refugees_adults', label: 'لاجئين كبار' },
            { key: 'refugees_children', label: 'لاجئين اطفال' },
            { key: 'conditionality', label: 'مشروطية' },
            { key: 'unable_to_pay', label: 'غير قادرين' },
            { key: 'psychological_support', label: 'دعم نفسي' },
        ]
    },
    {
        title: "التذاكر والإيرادات (بالجنيه)", color: "bg-green-100 text-green-800 border-green-300",
        fields: [
            { key: 'tickets_count', label: 'عدد التذاكر' },
            { key: 'tickets_revenue', label: 'ايراد التذاكر', isDecimal: true },
            { key: 'collection_revenue', label: 'أيراد التحصيل', isDecimal: true },
            { key: 'milk_revenue', label: 'ايراد الالبان', isDecimal: true },
            { key: 'total_revenue', label: 'اجمالى الايراد', isDecimal: true },
        ]
    }
];

export default function StatisticsManager() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [formData, setFormData] = useState<Record<string, number | string>>({});

    // 1. جلب بيانات اليوم المحدد
    const { isLoading, isFetching } = useQuery({
        queryKey: ['center_statistics', date],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('center_statistics')
                .select('*')
                .eq('record_date', date)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;
            
            if (data) {
                setFormData(data);
            } else {
                // تصفير الحقول إذا لم يوجد سجل
                const emptyData: any = {};
                CATEGORIES.forEach(cat => cat.fields.forEach(f => emptyData[f.key] = 0));
                setFormData(emptyData);
            }
            return data;
        },
    });

    // 2. دالة الحفظ
    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("غير مصرح");
            const payload = {
                record_date: date,
                created_by: user.id,
                updated_at: new Date().toISOString(),
                ...formData
            };
            
            // حذف المعرف إذا كان موجوداً لتجنب مشاكل التحديث
            delete payload.id;
            delete payload.created_at;

            const { error } = await supabase
                .from('center_statistics')
                .upsert(payload, { onConflict: 'record_date' });
            
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم حفظ إحصائيات اليوم بنجاح ✅');
            queryClient.invalidateQueries({ queryKey: ['center_statistics'] });
        },
        onError: (err: any) => toast.error(`خطأ: ${err.message}`)
    });

    const handleChange = (key: string, value: string, isDecimal?: boolean) => {
        const numVal = isDecimal ? parseFloat(value) : parseInt(value, 10);
        setFormData(prev => ({
            ...prev,
            [key]: isNaN(numVal) ? '' : numVal
        }));
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-10">
            {/* Header */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-blue-600"/> إحصائيات العمل
                    </h2>
                    <p className="text-gray-500 text-sm mt-1 font-bold">إدخال الإحصائيات اليومية والشهرية للمركز</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative bg-gray-50 rounded-xl border flex items-center px-3 py-2">
                        <Calendar className="w-5 h-5 text-gray-500 ml-2"/>
                        <input 
                            type="date" 
                            value={date} 
                            onChange={e => setDate(e.target.value)} 
                            className="bg-transparent outline-none font-bold text-gray-700"
                        />
                    </div>
                    <button 
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending || isFetching}
                        className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
                    >
                        {saveMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} حفظ 
                    </button>
                </div>
            </div>

            {isLoading || isFetching ? (
                <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-blue-600"/></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {CATEGORIES.map((category, idx) => (
                        <div key={idx} className={`bg-white rounded-3xl border p-5 shadow-sm`}>
                            <h3 className={`text-sm font-black mb-4 p-2 rounded-xl border text-center ${category.color}`}>
                                {category.title}
                            </h3>
                            <div className="space-y-3">
                                {category.fields.map(field => (
                                    <div key={field.key} className="flex justify-between items-center bg-gray-50 p-2 rounded-xl border border-transparent hover:border-gray-200 transition-colors">
                                        <label className="text-xs font-bold text-gray-700 flex-1">{field.label}</label>
                                        <input 
                                            type="number"
                                            min="0"
                                            step={field.isDecimal ? "0.01" : "1"}
                                            value={formData[field.key] === 0 ? '' : formData[field.key]} 
                                            onChange={(e) => handleChange(field.key, e.target.value, field.isDecimal)}
                                            placeholder="0"
                                            className="w-24 text-center p-1.5 border rounded-lg outline-none focus:border-blue-500 font-mono font-bold text-blue-700"
                                            dir="ltr"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
