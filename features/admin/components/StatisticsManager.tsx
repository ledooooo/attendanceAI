import React, { useState, useRef } from 'react';
import { supabase } from '../../../supabaseClient'; // تأكد من مسار الاستيراد
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Calendar, Loader2, BarChart3, Download, Upload, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext'; // تأكد من مسار الاستيراد
import * as XLSX from 'xlsx';
import { useReactToPrint } from 'react-to-print';

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
    const [isUploading, setIsUploading] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const printRef = useRef<HTMLDivElement>(null);

    // خريطة لربط العناوين العربية (Label) بالحقول البرمجية (Key) للاستيراد
    const labelToKeyMap = CATEGORIES.reduce((acc, cat) => {
        cat.fields.forEach(f => {
            acc[f.label] = { key: f.key, isDecimal: f.isDecimal };
        });
        return acc;
    }, {} as Record<string, { key: string, isDecimal?: boolean }>);

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

    // 2. دالة الحفظ (تعمل كـ Upsert لتحديث البيانات بدون تكرار السجل لليوم الواحد)
    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("غير مصرح");
            const payload = {
                record_date: date,
                created_by: user.id,
                updated_at: new Date().toISOString(),
                ...formData
            };
            
            // حذف المعرفات لتجنب مشاكل التحديث
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

    // --- دوال الإكسيل والطباعة ---

    // تحميل ملف عينة
    const handleDownloadSample = () => {
        const sampleData: Record<string, number> = {};
        CATEGORIES.forEach(cat => cat.fields.forEach(f => {
            sampleData[f.label] = 0; // جميع الأعمدة تبدأ بـ 0
        }));

        const ws = XLSX.utils.json_to_sheet([sampleData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "احصائيات_اليوم");
        XLSX.writeFile(wb, `نموذج_إحصائيات_المركز.xlsx`);
    };

    // رفع وقراءة الإكسيل
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                if (json.length > 0) {
                    const row: any = json[0]; // نأخذ أول صف فقط
                    const newFormData = { ...formData };
                    
                    // تحديث القيم بناءً على العناوين
                    Object.keys(row).forEach(label => {
                        const fieldConfig = labelToKeyMap[label];
                        if (fieldConfig) {
                            const val = fieldConfig.isDecimal ? parseFloat(row[label]) : parseInt(row[label], 10);
                            newFormData[fieldConfig.key] = isNaN(val) ? 0 : val;
                        }
                    });

                    setFormData(newFormData);
                    toast.success('تم قراءة الملف بنجاح! اضغط حفظ لتأكيد الإدخال.');
                } else {
                    toast.error('الملف فارغ أو غير صالح.');
                }
            } catch (err) {
                toast.error('حدث خطأ أثناء قراءة الملف.');
            } finally {
                setIsUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = ''; // تصفير الـ input
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // الطباعة A4
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `إحصائيات_مركز_غرب_المطار_${date}`,
    });

    return (
        <div className="space-y-6 animate-in fade-in pb-10">
            {/* Header Controls (لا يظهر في الطباعة) */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col lg:flex-row justify-between items-center gap-4 no-print">
                <div>
                    <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-blue-600"/> إحصائيات العمل
                    </h2>
                    <p className="text-gray-500 text-sm mt-1 font-bold">إدخال الإحصائيات اليومية والشهرية للمركز</p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                    
                    {/* اختيار التاريخ */}
                    <div className="relative bg-gray-50 rounded-xl border flex items-center px-3 py-2">
                        <Calendar className="w-5 h-5 text-gray-500 ml-2"/>
                        <input 
                            type="date" 
                            value={date} 
                            onChange={e => setDate(e.target.value)} 
                            className="bg-transparent outline-none font-bold text-gray-700"
                        />
                    </div>

                    <div className="h-6 w-px bg-gray-200 mx-2 hidden md:block"></div>

                    {/* أدوات الإكسيل والطباعة */}
                    <button onClick={handleDownloadSample} className="bg-gray-100 text-gray-700 px-3 py-2.5 rounded-xl font-bold hover:bg-gray-200 flex items-center gap-2 transition-all text-xs">
                        <Download className="w-4 h-4"/> نموذج
                    </button>

                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={isUploading}
                        className="bg-orange-50 text-orange-600 border border-orange-200 px-3 py-2.5 rounded-xl font-bold hover:bg-orange-100 flex items-center gap-2 transition-all text-xs"
                    >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>} رفع بيانات
                    </button>

                    <button onClick={handlePrint} className="bg-gray-800 text-white px-3 py-2.5 rounded-xl font-bold hover:bg-gray-900 flex items-center gap-2 shadow-lg transition-all text-xs">
                        <Printer className="w-4 h-4"/> طباعة التقرير
                    </button>

                    <div className="h-6 w-px bg-gray-200 mx-2 hidden md:block"></div>

                    {/* زر الحفظ الأساسي */}
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
                /* منطقة المحتوى القابلة للطباعة */
                <div ref={printRef} className="print:p-6 print:bg-white print:text-black">
                    
                    {/* ترويسة الطباعة (تظهر في الطباعة فقط) */}
                    <div className="hidden print:block text-center border-b-2 border-gray-800 pb-4 mb-6">
                        <h1 className="text-2xl font-black mb-1">بيان إحصائيات العمل اليومية</h1>
                        <h2 className="text-xl font-bold text-gray-700">إدارة شمال الجيزة - مركز غرب المطار</h2>
                        <p className="text-lg font-bold mt-2">عن يوم: {new Date(date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>

                    {/* شبكة الحقول (متجاوبة على الشاشة ومناسبة للورق) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 gap-4 print:gap-x-8 print:gap-y-6">
                        {CATEGORIES.map((category, idx) => (
                            <div key={idx} className={`bg-white rounded-3xl border print:border-gray-400 p-4 shadow-sm print:shadow-none print:break-inside-avoid`}>
                                <h3 className={`text-sm font-black mb-3 p-2 rounded-xl border text-center print:bg-gray-100 print:text-black print:border-gray-500 ${category.color}`}>
                                    {category.title}
                                </h3>
                                <div className="space-y-2">
                                    {category.fields.map(field => (
                                        <div key={field.key} className="flex justify-between items-center bg-gray-50 print:bg-transparent p-1.5 rounded-xl border border-transparent print:border-b-gray-300 print:rounded-none">
                                            <label className="text-[13px] font-bold text-gray-700 print:text-black flex-1">{field.label}</label>
                                            <input 
                                                type="number"
                                                min="0"
                                                step={field.isDecimal ? "0.01" : "1"}
                                                value={formData[field.key] === 0 ? '' : formData[field.key]} 
                                                onChange={(e) => handleChange(field.key, e.target.value, field.isDecimal)}
                                                placeholder="0"
                                                className="w-20 text-center p-1 border rounded-lg outline-none focus:border-blue-500 font-mono font-bold text-blue-700 print:text-black print:border-none print:bg-transparent"
                                                dir="ltr"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* توقيعات الطباعة (تظهر في الطباعة فقط) */}
                    <div className="hidden print:flex justify-between items-center mt-16 pt-8 px-10">
                        <div className="text-center font-bold">
                            <p>مسؤول الإحصاء</p>
                            <p className="mt-8">.......................</p>
                        </div>
                        <div className="text-center font-bold">
                            <p>مدير المركز</p>
                            <p className="mt-8">.......................</p>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
