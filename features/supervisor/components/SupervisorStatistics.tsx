import React, { useState } from 'react';
import { supabase } from '../../../../supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Loader2, BarChart3, Info } from 'lucide-react';

// استيراد نفس الفئات من ملف الإحصائيات
const CATEGORIES = [
    { title: "العيادات والتردد", fields: [{ key: 'outpatient_clinics', label: 'عيادات خارجية' }, { key: 'family_planning', label: 'تنمية الاسرة' }, { key: 'dental_clinic', label: 'عيادة الاسنان' }, { key: 'ophthalmology_clinic', label: 'عيادة الرمد' }, { key: 'emergency', label: 'الطوارئ' }, { key: 'physiotherapy_total', label: 'العلاج الطبيعي' }, { key: 'family_medicine_clinic', label: 'طب اسرة' }, { key: 'evening_shift', label: 'مسائى' }] },
    { title: "المعمل والتحاليل", fields: [{ key: 'blood_endemic_lab_total', label: 'اجمالى معمل الدم' }, { key: 'urine_test', label: 'بول' }, { key: 'stool_test', label: 'براز' }, { key: 'blood_pregnancy_test', label: 'حمل بالدم' }, { key: 'cbc_test', label: 'صورة دم كاملة' }, { key: 'anemia_test', label: 'انيميا' }, { key: 'thyroid_test', label: 'تحليل الغدة' }] },
    { title: "المبادرات الرئاسية", fields: [{ key: 'hearing_initiative', label: 'السمعيات' }, { key: 'womens_health_initiative', label: 'صحة المراة' }, { key: 'mother_fetus_initiative', label: 'الام والجنين' }, { key: 'thousand_days_initiative', label: 'الالف يوم' }, { key: 'tumors_initiative', label: 'الأورام' }, { key: 'glaucoma_initiative', label: 'جلوكوما' }, { key: 'heart_initiative', label: 'قلبك امانة' }, { key: 'chronic_diseases_initiative', label: 'الامراض المزمنة' }, { key: 'renal_impairment_initiative', label: 'اعتلال كلوى' }] },
    { title: "التذاكر والإيرادات", fields: [{ key: 'tickets_count', label: 'عدد التذاكر' }, { key: 'tickets_revenue', label: 'ايراد التذاكر' }, { key: 'collection_revenue', label: 'أيراد التحصيل' }, { key: 'milk_revenue', label: 'ايراد الالبان' }, { key: 'total_revenue', label: 'اجمالى الايراد' }] }
];

export default function SupervisorStatistics() {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const { data: stats, isLoading } = useQuery({
        queryKey: ['supervisor_statistics', date],
        queryFn: async () => {
            const { data } = await supabase.from('center_statistics').select('*').eq('record_date', date).maybeSingle();
            return data || null;
        }
    });

    return (
        <div className="space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border">
                <h2 className="font-black text-lg flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-600"/> إحصائيات المركز</h2>
                <div className="relative bg-gray-50 rounded-xl border flex items-center px-3 py-2">
                    <Calendar className="w-5 h-5 text-gray-500 ml-2"/>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent outline-none font-bold text-gray-700"/>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>
            ) : !stats ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed text-gray-400 font-bold">
                    <Info className="w-12 h-12 mx-auto mb-2 opacity-50"/>
                    لم يتم إدخال إحصائيات لهذا اليوم بعد.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {CATEGORIES.map((cat, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-2xl border shadow-sm">
                            <h3 className="text-sm font-black mb-3 border-b pb-2 text-gray-800">{cat.title}</h3>
                            <div className="space-y-2">
                                {cat.fields.map(field => (
                                    <div key={field.key} className="flex justify-between text-xs font-bold p-1 border-b border-gray-50 last:border-0">
                                        <span className="text-gray-500">{field.label}</span>
                                        <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-mono">{stats[field.key] || 0}</span>
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
