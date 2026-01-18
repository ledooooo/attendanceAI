import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { FilePlus, Send, Calendar, UserCheck, AlertCircle, Clock, XCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { useNotifications } from '../../../context/NotificationContext';

const LEAVE_TYPES = [
  "اجازة عارضة", "اجازة اعتيادية", "اجازة مرضى", "دورة تدريبية", "خط سير", "مأمورية", "بدل راحة", "اذن صباحى", "اذن مسائي", "تأمين صحي"
];

interface Props { 
    employee: Employee; 
    refresh: () => void;
    initialDate?: string | null; 
}

interface DateSuggestion {
    date: string;
    label: string;
    type: 'absence' | 'incomplete';
}

export default function StaffNewRequest({ employee, refresh, initialDate }: Props) {
    const { sendNotification } = useNotifications();
    const [submitting, setSubmitting] = useState(false);
    
    // حالات الاقتراحات
    const [suggestions, setSuggestions] = useState<DateSuggestion[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(true);

    // حالة النموذج
    const [formData, setFormData] = useState({
        type: LEAVE_TYPES[0], 
        start: initialDate || '', 
        end: initialDate || '',   
        returnDate: '', 
        backup: '', 
        notes: ''
    });

    // 1. جلب المخالفات (غياب / بصمة ناقصة) لآخر 60 يوم
    useEffect(() => {
        const fetchIrregularities = async () => {
            setLoadingSuggestions(true);
            try {
                const today = new Date();
                const sixtyDaysAgo = new Date();
                sixtyDaysAgo.setDate(today.getDate() - 60); // ✅ تعديل الفترة لـ 60 يوم

                // جلب سجلات الحضور
                const { data: records } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('employee_id', employee.employee_id)
                    .gte('date', sixtyDaysAgo.toISOString().split('T')[0])
                    .lte('date', today.toISOString().split('T')[0]);

                if (!records) {
                    setLoadingSuggestions(false);
                    return;
                }

                const foundSuggestions: DateSuggestion[] = [];
                const recordDates = new Set(records.map(r => r.date));

                // أ) استخراج أيام البصمة الواحدة (ترك عمل)
                records.forEach((record: AttendanceRecord) => {
                    // نفترض أن التوقيتات "08:00 14:00". إذا كان هناك توقيت واحد فقط فهو غير مكتمل
                    const punches = record.times ? record.times.trim().split(' ') : [];
                    if (punches.length === 1) {
                        foundSuggestions.push({
                            date: record.date,
                            label: formatDateArabic(record.date),
                            type: 'incomplete'
                        });
                    }
                });

                // ب) استخراج أيام الغياب
                // نمر على كل يوم في الـ 60 يوم الماضية
                for (let d = new Date(sixtyDaysAgo); d < today; d.setDate(d.getDate() + 1)) {
                    const dateStr = d.toISOString().split('T')[0];
                    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });

                    // تجاهل أيام الجمعة
                    if (dayName === 'Friday') continue;

                    // إذا لم يكن التاريخ موجوداً في السجلات، فهو غياب
                    if (!recordDates.has(dateStr)) {
                        foundSuggestions.push({
                            date: dateStr,
                            label: formatDateArabic(dateStr),
                            type: 'absence'
                        });
                    }
                }

                // ترتيب النتائج: الأحدث أولاً
                foundSuggestions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                
                setSuggestions(foundSuggestions);
            } catch (err) {
                console.error("Error fetching suggestions:", err);
            } finally {
                setLoadingSuggestions(false);
            }
        };

        fetchIrregularities();
    }, [employee.employee_id]);

    const handleSuggestionClick = (suggestion: DateSuggestion) => {
        setFormData(prev => ({
            ...prev,
            start: suggestion.date,
            end: suggestion.date,
            type: suggestion.type === 'incomplete' ? 'اذن مسائي' : 'اجازة عارضة' 
        }));
    };

    useEffect(() => {
        if (initialDate) {
            setFormData(prev => ({
                ...prev,
                start: initialDate,
                end: initialDate
            }));
        }
    }, [initialDate]);

    const formatDateArabic = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ar-EG', {
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
        });
    };

    const submit = async () => {
        if (!formData.type || !formData.start || !formData.end || !formData.returnDate || !formData.backup) {
            return alert('⚠️ عفواً، جميع الحقول الموضحة بعلامة (*) إجبارية.');
        }

        if (new Date(formData.end) < new Date(formData.start)) {
            return alert('⚠️ تاريخ النهاية يجب أن يكون بعد تاريخ البداية!');
        }
        if (new Date(formData.returnDate) <= new Date(formData.end)) {
            return alert('⚠️ تاريخ العودة للعمل يجب أن يكون بعد انتهاء الإجازة!');
        }

        setSubmitting(true);
        
        try {
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

            await sendNotification('admin', 'طلب جديد 📄', `قام ${employee.name} بتقديم طلب ${formData.type}`);

            alert('✅ تم إرسال الطلب بنجاح'); 
            
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
                
                {/* قسم الاقتراحات (تسوية الموقف) */}
                {loadingSuggestions ? (
                    <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-4 bg-gray-50 rounded-2xl border border-dashed">
                        <Loader2 className="w-4 h-4 animate-spin"/> جاري فحص السجلات (آخر 60 يوم)...
                    </div>
                ) : (
                    <>
                        {suggestions.length > 0 ? (
                            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 mb-4 animate-in fade-in">
                                <h4 className="text-orange-800 font-bold text-sm mb-3 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4"/> تسوية المواقف المعلقة (آخر 60 يوم):
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {suggestions.map((sugg, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSuggestionClick(sugg)}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border shadow-sm active:scale-95 ${
                                                sugg.type === 'absence' 
                                                ? 'bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300' 
                                                : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50 hover:border-amber-300'
                                            }`}
                                        >
                                            {sugg.type === 'absence' ? <XCircle className="w-3 h-3"/> : <Clock className="w-3 h-3"/>}
                                            {sugg.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            // ✅ الرسالة المطلوبة عند عدم وجود غياب
                            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-4 flex items-center justify-center gap-2 text-emerald-700 font-bold text-sm animate-in fade-in">
                                <CheckCircle2 className="w-5 h-5" />
                                لا توجد أيام غياب أو ترك عمل في الـ 60 يوماً الماضية 👏
                            </div>
                        )}
                    </>
                )}

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
