import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
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

// واجهة لبيانات الزميل
interface Colleague {
    id: string; // UUID للتنبيهات
    name: string;
    employee_id: string;
}

export default function StaffNewRequest({ employee, refresh, initialDate }: Props) {
    const { sendNotification } = useNotifications();
    const [submitting, setSubmitting] = useState(false);
    const [suggestions, setSuggestions] = useState<DateSuggestion[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(true);

    // حالة لقائمة الزملاء
    const [colleagues, setColleagues] = useState<Colleague[]>([]);
    const [loadingColleagues, setLoadingColleagues] = useState(false);
    
    // تخزين معرف الموظف البديل لإرسال الإشعار له
    const [selectedBackupId, setSelectedBackupId] = useState<string>('');

    const [formData, setFormData] = useState({
        type: LEAVE_TYPES[0], 
        start: initialDate || '', 
        end: initialDate || '',    
        returnDate: '', 
        backup: '', 
        notes: ''
    });

    // 1. منطق تحديد التخصصات المتشابهة
    const getTargetSpecialties = (currentSpec: string) => {
        const spec = currentSpec.trim();
        
        // مجموعة المعمل
        const labGroup = ['فنى معمل', 'اخصائى مختبرات', 'كيميائى', 'كيميائية', 'فني معمل', 'أخصائي مختبرات', 'اخصائي مختبرات'];
        if (labGroup.includes(spec)) return labGroup;

        // مجموعة الأسنان
        const dentistGroup = ['طبيب اسنان', 'طيبب أسنان', 'طبيب أسنان'];
        if (dentistGroup.includes(spec)) return dentistGroup;

        // مجموعة الإداريين
        const adminGroup = ['ادارى', 'إدارى', 'أدارى', 'فنى احصاء', 'فنى إحصاء', 'مسئول ملفات', 'كاتب'];
        if (adminGroup.includes(spec)) return adminGroup;

        // الافتراضي: نفس التخصص بالضبط
        return [spec];
    };

    // 2. جلب قائمة الزملاء بناءً على التخصص
    useEffect(() => {
        const fetchColleagues = async () => {
            setLoadingColleagues(true);
            try {
                const targetSpecs = getTargetSpecialties(employee.specialty);
                
                const { data } = await supabase
                    .from('employees')
                    .select('id, name, employee_id')
                    .in('specialty', targetSpecs) // البحث في المصفوفة المحددة
                    .neq('employee_id', employee.employee_id) // استبعاد الموظف الحالي
                    .eq('status', 'نشط'); // فقط الموظفين النشطين

                if (data) {
                    setColleagues(data);
                }
            } catch (error) {
                console.error("Error fetching colleagues", error);
            } finally {
                setLoadingColleagues(false);
            }
        };

        if (employee.specialty) {
            fetchColleagues();
        }
    }, [employee.specialty, employee.employee_id]);

    // دوال التاريخ (كما هي)
    const normalizeDate = (dateStr: string) => {
        const d = new Date(dateStr);
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
    };

    const toStandardDate = (d: Date) => {
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
    };

    // جلب الاقتراحات (كما هي)
    useEffect(() => {
        const fetchIrregularities = async () => {
            setLoadingSuggestions(true);
            try {
                const today = new Date();
                const sixtyDaysAgo = new Date();
                sixtyDaysAgo.setDate(today.getDate() - 60);

                const { data: empData } = await supabase.from('employees').select('work_days').eq('employee_id', employee.employee_id).single();
                const workDays = empData?.work_days || []; 

                const { data: records } = await supabase.from('attendance').select('date, times').eq('employee_id', employee.employee_id).order('date', { ascending: false }).limit(100);
                const { data: leaves } = await supabase.from('leave_requests').select('start_date, end_date').eq('employee_id', employee.employee_id).neq('status', 'مرفوض');
                const { data: settings } = await supabase.from('settings').select('holidays_date').single();

                const holidays = settings?.holidays_date || [];
                const validLeaves = leaves || [];

                const statusMap = new Map<string, string>();
                if (records) {
                    records.forEach((r: any) => {
                        const stdDate = normalizeDate(r.date);
                        const t = r.times ? r.times.trim() : '';
                        if (!t) {
                            statusMap.set(stdDate, 'absent');
                        } else {
                            const punches = t.split(/\s+/);
                            statusMap.set(stdDate, punches.length === 1 ? 'incomplete' : 'present');
                        }
                    });
                }

                const foundSuggestions: DateSuggestion[] = [];
                for (let d = new Date(sixtyDaysAgo); d < today; d.setDate(d.getDate() + 1)) {
                    const dateStr = toStandardDate(d);
                    const dayNameEn = d.toLocaleDateString('en-US', { weekday: 'long' });
                    let isWorkDay = false;
                    const dayMap: { [key: string]: string } = { 'Saturday': 'سبت', 'Sunday': 'حد', 'Monday': 'ثنين', 'Tuesday': 'ثلاثاء', 'Wednesday': 'ربعاء', 'Thursday': 'خميس', 'Friday': 'جمعة' };
                    const arabicKey = dayMap[dayNameEn];

                    if (!workDays || workDays.length === 0) {
                        if (dayNameEn !== 'Friday') isWorkDay = true;
                    } else {
                        isWorkDay = workDays.some((wd: string) => wd.includes(arabicKey));
                    }

                    if (!isWorkDay) continue;
                    if (holidays.includes(dateStr)) continue;
                    const isLeave = validLeaves.some((leave: any) => dateStr >= leave.start_date && dateStr <= leave.end_date);
                    if (isLeave) continue;

                    const status = statusMap.get(dateStr);
                    if (status === 'absent') {
                        foundSuggestions.push({ date: dateStr, label: formatDateArabic(dateStr), type: 'absence' });
                    } else if (status === 'incomplete') {
                        foundSuggestions.push({ date: dateStr, label: formatDateArabic(dateStr), type: 'incomplete' });
                    } else if (status === undefined) {
                        foundSuggestions.push({ date: dateStr, label: formatDateArabic(dateStr), type: 'absence' });
                    }
                }
                foundSuggestions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setSuggestions(foundSuggestions);
            } catch (err) {
                console.error("Error checking attendance:", err);
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
            setFormData(prev => ({ ...prev, start: initialDate, end: initialDate }));
        }
    }, [initialDate]);

    const formatDateArabic = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ar-EG', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    };

    // معالجة تغيير الموظف البديل
    const handleBackupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = e.target.value;
        const selectedColleague = colleagues.find(c => c.id === selectedId);
        
        if (selectedColleague) {
            setFormData({ ...formData, backup: selectedColleague.name }); // نخزن الاسم لقاعدة البيانات
            setSelectedBackupId(selectedColleague.id); // نخزن الـ UUID للإشعار
        } else {
            setFormData({ ...formData, backup: '' });
            setSelectedBackupId('');
        }
    };

    const submit = async () => {
        if (!formData.type || !formData.start || !formData.end || !formData.returnDate || !formData.backup) {
            return alert('⚠️ عفواً، جميع الحقول الموضحة بعلامة (*) إجبارية.');
        }
        if (new Date(formData.end) < new Date(formData.start)) {
            return alert('⚠️ تاريخ النهاية يجب أن يكون بعد تاريخ البداية!');
        }

        setSubmitting(true);
        try {
            // 1. حفظ الطلب في قاعدة البيانات
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

            // 2. إشعار للمدير
            await sendNotification('admin', 'طلب جديد 📄', `قام ${employee.name} بتقديم طلب ${formData.type}`);

            // 3. 🔥 إشعار للموظف البديل
            if (selectedBackupId) {
                await sendNotification(
                    selectedBackupId, 
                    'تنبيه قائم بالعمل 🔄', 
                    `قام ${employee.name} باختيارك كبديل (قائم بالعمل) في طلب ${formData.type} من ${formData.start}`
                );
            }

            alert('✅ تم إرسال الطلب وإبلاغ الزميل بنجاح'); 
            setFormData({ type: LEAVE_TYPES[0], start: '', end: '', returnDate: '', backup: '', notes: '' }); 
            setSelectedBackupId('');
            refresh();
        } catch (error: any) {
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
                
                {/* قسم الاقتراحات - كما هو */}
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
                            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-4 flex items-center justify-center gap-2 text-emerald-700 font-bold text-sm animate-in fade-in">
                                <CheckCircle2 className="w-5 h-5" />
                                لا توجد أيام غياب أو ترك عمل في الـ 60 يوماً الماضية 👏
                            </div>
                        )}
                    </>
                )}

                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-blue-800 text-sm font-bold flex items-center gap-2">
                    <UserCheck className="w-5 h-5"/>
                    سيتم إرسال إشعار تلقائي للموظف البديل عند تقديم الطلب.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <Select label="نوع الطلب *" options={LEAVE_TYPES} value={formData.type} onChange={(v:any)=>setFormData({...formData, type: v})} />
                    </div>
                    <Input label="من تاريخ *" type="date" value={formData.start} onChange={(v:any)=>setFormData({...formData, start: v})} />
                    <Input label="إلى تاريخ *" type="date" value={formData.end} onChange={(v:any)=>setFormData({...formData, end: v})} />
                    <div className="relative">
                         <Input label="تاريخ العودة للعمل *" type="date" value={formData.returnDate} onChange={(v:any)=>setFormData({...formData, returnDate: v})} />
                        <Calendar className="absolute left-3 top-9 text-gray-400 w-4 h-4 pointer-events-none"/>
                    </div>
                    
                    {/* ✅ خانة الموظف البديل - قائمة منسدلة ذكية */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">الموظف البديل (القائم بالعمل) *</label>
                        <div className="relative">
                            <select 
                                className="w-full p-3 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-bold text-gray-700 appearance-none"
                                value={selectedBackupId} 
                                onChange={handleBackupChange}
                                disabled={loadingColleagues}
                            >
                                <option value="">اختر زميلاً من القسم...</option>
                                {colleagues.map(colleague => (
                                    <option key={colleague.id} value={colleague.id}>
                                        {colleague.name}
                                    </option>
                                ))}
                            </select>
                            {loadingColleagues && (
                                <div className="absolute left-3 top-3">
                                    <Loader2 className="w-5 h-5 animate-spin text-gray-400"/>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 mb-1">ملاحظات إضافية (اختياري)</label>
                        <textarea value={formData.notes} onChange={(e)=>setFormData({...formData, notes: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all min-h-[100px] text-sm font-medium" placeholder="اكتب أي تفاصيل أخرى..." />
                    </div>
                </div>

                <button onClick={submit} disabled={submitting} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black shadow-lg hover:bg-emerald-700 hover:shadow-emerald-200 transition-all flex justify-center items-center gap-2 active:scale-95 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none">
                    {submitting ? <span className="flex items-center gap-2">جاري الإرسال... <span className="animate-spin">⏳</span></span> : <><Send className="w-5 h-5" /> إرسال الطلب للاعتماد</>}
                </button>
            </div>
        </div>
    );
}
