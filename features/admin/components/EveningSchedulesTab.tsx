'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { ExcelUploadButton } from '../../../components/ui/ExcelUploadButton';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { 
    CalendarRange, Save, Users, Search, Download, 
    Trash2, CheckCircle2, AlertCircle, Calendar, Loader2, Printer, X, Eye
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface DoctorObj {
    id: string;
    name: string;
    code: string;
}

const normalizeString = (str: string) => {
    if (!str) return '';
    const englishDigits = str.replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
    return String(englishDigits).trim().toLowerCase();
};

const formatDateForDB = (val: any): string | null => {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val.toISOString().split('T')[0];
    const num = Number(val);
    if (!isNaN(num) && num > 30000 && num < 60000) {
        return new Date(Math.round((num - 25569) * 86400 * 1000)).toISOString().split('T')[0];
    }
    const str = String(val).trim();
    const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    try {
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
    } catch { return null; }
};

export default function EveningSchedulesTab({ employees }: { employees: Employee[] }) {
    const queryClient = useQueryClient();
    const printRef = useRef<HTMLDivElement>(null);

    // UI State
    const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [selectedDoctors, setSelectedDoctors] = useState<DoctorObj[]>([]);
    const [notes, setNotes] = useState('');

    // Filter State
    const [fName, setFName] = useState('');
    const [fId, setFId] = useState('');
    const [fSpec, setFSpec] = useState('all');
    const [fStatus, setFStatus] = useState('نشط');

    // ------------------------------------------------------------------
    // 1. 📥 جلب الجداول (Query) - معطل افتراضياً لتوفير الاستهلاك
    // ------------------------------------------------------------------
    const { data: schedules = [], isLoading, refetch, isFetching } = useQuery({
        queryKey: ['evening_schedules_list', selectedMonth],
        queryFn: async () => {
            const startDate = `${selectedMonth}-01`;
            const [year, month] = selectedMonth.split('-');
            const lastDay = new Date(Number(year), Number(month), 0).getDate();
            const endDate = `${selectedMonth}-${lastDay}`;

            const { data, error } = await supabase
                .from('evening_schedules')
                .select('*')
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: true });
            
            if (error) throw error;
            return data;
        },
        enabled: false, 
    });

    // ------------------------------------------------------------------
    // 2. 🔄 مزامنة النموذج مع التاريخ المختار
    // ------------------------------------------------------------------
    useEffect(() => {
        if (viewMode === 'daily') {
            const existing = schedules.find((s: any) => s.date === selectedDate);
            if (existing) {
                const mappedDoctors: DoctorObj[] = (existing.doctors || []).map((d: any) => {
                    if (typeof d === 'string') {
                        const found = employees.find(e => e.name === d || e.employee_id === d);
                        return found 
                            ? { id: found.id, name: found.name, code: found.employee_id } 
                            : { id: 'unknown', name: d, code: '?' };
                    }
                    return d;
                });
                
                setSelectedDoctors(mappedDoctors);
                setNotes(existing.notes || '');
            } else {
                setSelectedDoctors([]);
                setNotes('');
            }
        }
    }, [selectedDate, schedules, employees, viewMode]);

    // ------------------------------------------------------------------
    // 3. 🛠️ العمليات (Mutations)
    // ------------------------------------------------------------------
    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!selectedDate) throw new Error("اختر التاريخ");
            if (selectedDoctors.length === 0) throw new Error("اختر طبيباً واحداً على الأقل");

            const payload = {
                date: selectedDate,
                doctors: selectedDoctors,
                notes: notes
            };

            const existing = schedules.find((s: any) => s.date === selectedDate);
            const finalPayload = existing ? { ...payload, id: existing.id } : payload;

            const { error } = await supabase.from('evening_schedules').upsert(finalPayload);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("تم حفظ الجدول بنجاح ✅");
            refetch();
        },
        onError: (err: any) => toast.error(err.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('evening_schedules').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("تم حذف الجدول");
            refetch();
        },
        onError: (err: any) => toast.error(err.message)
    });

    const excelMutation = useMutation({
        mutationFn: async (data: any[]) => {
            let inserted = 0, updated = 0, skipped = 0;
            let errors: string[] = [];

            const { data: currentDbSchedules } = await supabase.from('evening_schedules').select('*');
            const dbSchedules = currentDbSchedules || [];
            const rowsToUpsert: any[] = [];
            const processedDates = new Set();

            for (const row of data) {
                const dateKey = Object.keys(row).find(k => k.includes('تاريخ') || k.toLowerCase().includes('date'));
                const dateVal = dateKey ? row[dateKey] : (row['التاريخ'] || row['date'] || row['Date']);
                const date = formatDateForDB(dateVal);
                
                if (!date || processedDates.has(date)) continue;
                processedDates.add(date);

                const inputValues: string[] = [];
                Object.keys(row).forEach(key => {
                    const lowerKey = key.toLowerCase();
                    if (lowerKey.includes('تاريخ') || lowerKey.includes('date') || lowerKey.includes('ملاحظات') || lowerKey.includes('note')) return;
                    
                    const val = row[key];
                    if (val !== undefined && val !== null && String(val).trim() !== '') {
                        inputValues.push(String(val));
                    }
                });
                
                const doctorsObjects = inputValues.map(val => {
                    const searchVal = normalizeString(val);
                    const emp = employees.find(e => 
                        normalizeString(e.name) === searchVal || 
                        normalizeString(e.employee_id) === searchVal
                    );
                    if (emp) return { id: emp.id, name: emp.name, code: emp.employee_id };
                    return null; 
                }).filter(Boolean);

                if (doctorsObjects.length === 0 && inputValues.length > 0) {
                     errors.push(`تاريخ ${date}: لم يتم التعرف على: ${inputValues.join(', ')}`);
                }

                const notesKey = Object.keys(row).find(k => k.includes('ملاحظات') || k.toLowerCase().includes('note'));
                const rowNotes = notesKey ? String(row[notesKey]).trim() : '';

                const payload = { date, doctors: doctorsObjects, notes: rowNotes };
                const existingRecord = dbSchedules.find(s => s.date === date);

                if (existingRecord) {
                    const isDiff = JSON.stringify(payload.doctors) !== JSON.stringify(existingRecord.doctors) || 
                                   payload.notes !== existingRecord.notes;
                    
                    if (isDiff) {
                        rowsToUpsert.push({ ...payload, id: existingRecord.id });
                        updated++;
                    } else {
                        skipped++;
                    }
                } else {
                    rowsToUpsert.push(payload);
                    inserted++;
                }
            }

            if (rowsToUpsert.length > 0) {
                const { error } = await supabase.from('evening_schedules').upsert(rowsToUpsert);
                if (error) throw error;
            }

            return { inserted, updated, skipped, errors };
        },
        onSuccess: (res) => {
            refetch();
            let msg = `✅ إضافة: ${res.inserted} | 🔄 تحديث: ${res.updated} | ⏭️ تجاهل: ${res.skipped}`;
            toast.success(msg, { duration: 5000 });
            if (res.errors.length > 0) alert(`⚠️ تنبيهات:\n` + res.errors.join('\n'));
        },
        onError: (err: any) => toast.error('فشل الاستيراد: ' + err.message)
    });

    // ------------------------------------------------------------------
    // 4. 🎨 دوال العرض والطباعة والمصفوفة الشهرية
    // ------------------------------------------------------------------

    const handleDownloadSample = () => {
        const headers = ["التاريخ", "طبيب 1", "طبيب 2", "طبيب 3", "ملاحظات"];
        const data = [
            ["2023-11-01", "101", "د. سارة علي", "", "مثال: كود أو اسم"],
            ["2023-11-02", "د. محمد حسن", "102", "103", ""]
        ];
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Schedules");
        XLSX.writeFile(wb, "نموذج_جداول_النوبتجية.xlsx");
    };

    const toggleDoctor = (emp: Employee) => {
        const exists = selectedDoctors.find(d => d.id === emp.id);
        if (exists) {
            setSelectedDoctors(prev => prev.filter(d => d.id !== emp.id));
        } else {
            setSelectedDoctors(prev => [...prev, { id: emp.id, name: emp.name, code: emp.employee_id }]);
        }
    };

    const filteredEmployees = employees.filter(e => 
        (e.name.includes(fName)) &&
        (e.employee_id.includes(fId)) &&
        (fSpec === 'all' || e.specialty === fSpec) &&
        (fStatus === 'all' || e.status === fStatus)
    );

    // ✅ دالة توليد الجدول الشهري
    const getMonthlyMatrix = () => {
        const [year, month] = selectedMonth.split('-');
        const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
        
        let matrix = [];
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${selectedMonth}-${String(i).padStart(2, '0')}`;
            const dateObj = new Date(dateStr);
            const dayName = dateObj.toLocaleDateString('ar-EG', { weekday: 'long' });
            
            const daySchedule = schedules.find((s:any) => s.date === dateStr);
            
            let humanDoctors: string[] = [];
            let dentists: string[] = [];
            let pharmacists: string[] = [];
            let labTechs: string[] = [];
            let physiotherapists: string[] = [];
            let nurses: string[] = [];
            let clerks: string[] = [];
            let admins: string[] = [];
            let others: string[] = []; 

            if (daySchedule && daySchedule.doctors) {
                daySchedule.doctors.forEach((d: any) => {
                    const emp = employees.find(e => e.id === d.id);
                    const shortName = emp ? emp.name.split(' ').slice(0, 2).join(' ') : d.name;
                    const spec = emp ? (emp.specialty || '') : '';
                    
                    if (spec.includes('بشر') || spec === 'طبيب') humanDoctors.push(shortName);
                    else if (spec.includes('سنان')) dentists.push(shortName);
                    else if (spec.includes('صيدل')) pharmacists.push(shortName);
                    else if (spec.includes('معمل') || spec.includes('مختبر') || spec.includes('فني') || spec.includes('فنى')) labTechs.push(shortName);
                    else if (spec.includes('طبيع')) physiotherapists.push(shortName);
                    else if (spec.includes('تمريض') || spec.includes('ممرض')) nurses.push(shortName);
                    else if (spec.includes('كاتب')) clerks.push(shortName);
                    else if (spec.includes('ادار') || spec.includes('إدار')) admins.push(shortName);
                    else others.push(shortName);
                });
            }

            const finalNotes = [daySchedule?.notes, ...others].filter(Boolean).join(' - ');

            matrix.push({
                date: dateStr,
                dayNum: i,
                dayName,
                humanDoc1: humanDoctors[0] || '-',
                humanDoc2: humanDoctors.slice(1).join(' / ') || '-',
                dentist1: dentists[0] || '-',
                dentist2: dentists.slice(1).join(' / ') || '-',
                pharmacist: pharmacists.join(' / ') || '-',
                labTech: labTechs.join(' / ') || '-',
                physio: physiotherapists.join(' / ') || '-',
                nurse: nurses.join(' / ') || '-',
                clerk: clerks.join(' / ') || '-',
                admin: admins.join(' / ') || '-',
                notes: finalNotes || '-'
            });
        }
        return matrix;
    };

    // ✅ دالة الطباعة الاحترافية للورقة الرسمية
    const handlePrint = () => {
        if (!printRef.current) return;
        const printContent = printRef.current.innerHTML;
        const originalContent = document.body.innerHTML;
        const [year, month] = selectedMonth.split('-');
        
        document.body.innerHTML = `
            <div dir="rtl" style="font-family: 'Tajawal', Arial, sans-serif; padding: 0; margin: 0; font-size: 12px; font-weight: bold; width: 100%;">
                
                <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 10px;">
                    <div style="text-align: right; line-height: 1.4;">
                        <div>وزارة الصحة والسكان</div>
                        <div>إدارة شمال الجيزة الطبية</div>
                        <div>مركز طب أسرة غرب المطار</div>
                    </div>
                    <div style="text-align: center; font-size: 16px;">
                        <span style="border: 2px solid #000; padding: 5px 15px; border-radius: 8px;">
                            جدول نوبتجية شهر ( ${month} ) لعام ( ${year} )
                        </span>
                    </div>
                    <div style="text-align: left; width: 150px; font-size: 10px;">
                        تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}
                    </div>
                </div>

                ${printContent}
                
                <div style="display: flex; justify-content: space-between; margin-top: 15px; padding: 0 40px; font-size: 13px;">
                    <div>الموظف المختص:<br/><br/>..............................</div>
                    <div>مدير المركز:<br/><br/>..............................</div>
                </div>
            </div>
        `;
        window.print();
        document.body.innerHTML = originalContent;
        window.location.reload(); 
    };


    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            
            {/* Header & View Toggles */}
            <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4">
                <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800">
                    <CalendarRange className="w-7 h-7 text-indigo-600"/> جداول النوبتجية
                </h2>
                <div className="flex items-center bg-gray-100 p-1 rounded-xl">
                    <button onClick={() => setViewMode('daily')} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${viewMode === 'daily' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        إعداد يومي
                    </button>
                    <button onClick={() => { setViewMode('monthly'); refetch(); }} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${viewMode === 'monthly' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        عرض شهري / طباعة
                    </button>
                </div>
            </div>

            {/* =======================================================
                VIEW 1: الإعداد اليومي (Daily Setup)
            ======================================================= */}
            {viewMode === 'daily' && (
                <>
                    <div className="flex justify-end gap-2">
                        <button onClick={handleDownloadSample} className="bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm text-sm">
                            <Download className="w-4 h-4"/> نموذج العينة
                        </button>
                        <ExcelUploadButton onData={(data) => excelMutation.mutate(data)} label={excelMutation.isPending ? "جاري المعالجة..." : "رفع من ملف إكسيل"} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* 1. لوحة الحفظ */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-white p-6 rounded-[30px] border shadow-sm sticky top-4">
                                <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-indigo-600"/> إعداد اليوم
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <Input type="date" label="التاريخ" value={selectedDate} onChange={setSelectedDate} />
                                        </div>
                                        <button onClick={() => refetch()} className="mt-6 bg-indigo-50 text-indigo-600 px-3 rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-colors flex items-center justify-center" title="استدعاء بيانات هذا اليوم">
                                            {isFetching ? <Loader2 className="w-5 h-5 animate-spin"/> : <Eye className="w-5 h-5"/>}
                                        </button>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">الأطباء المختارون ({selectedDoctors.length})</label>
                                        <div className="min-h-[100px] p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex flex-wrap gap-2 content-start">
                                            {selectedDoctors.length === 0 && <span className="text-gray-400 text-xs w-full text-center py-4">لم يتم اختيار أحد</span>}
                                            {selectedDoctors.map((doc, idx) => (
                                                <span key={idx} className="bg-white text-indigo-700 px-3 py-1.5 rounded-full text-xs font-bold border border-indigo-200 flex items-center gap-2 shadow-sm animate-in zoom-in">
                                                    <span>{doc.name}</span>
                                                    <button onClick={() => setSelectedDoctors(prev => prev.filter(d => d.id !== doc.id))} className="hover:text-red-500 transition-colors"><X className="w-3 h-3"/></button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات</label>
                                        <textarea 
                                            className="w-full p-3 rounded-xl border bg-gray-50 outline-none focus:border-indigo-500 min-h-[80px] text-sm font-medium"
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            placeholder="مثال: د.سارة (بديل)..."
                                        />
                                    </div>

                                    <button 
                                        onClick={() => saveMutation.mutate()}
                                        disabled={saveMutation.isPending}
                                        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex justify-center items-center gap-2 disabled:opacity-50"
                                    >
                                        {saveMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                                        حفظ جدول اليوم
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 2. قائمة الموظفين للاختيار */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3 shadow-inner">
                                <Input label="الاسم" value={fName} onChange={setFName} placeholder="بحث..." />
                                <Input label="الكود" value={fId} onChange={setFId} placeholder="101..." />
                                <Select label="التخصص" options={['all', ...Array.from(new Set(employees.map(e=>e.specialty)))]} value={fSpec} onChange={setFSpec} />
                                <Select label="الحالة" options={['all', 'نشط', 'موقوف']} value={fStatus} onChange={setFStatus} />
                            </div>

                            <div className="bg-white border rounded-[30px] shadow-sm overflow-hidden h-[550px] flex flex-col">
                                <div className="p-4 border-b bg-gray-50 font-bold text-gray-600 flex justify-between items-center">
                                    <span>قائمة الموظفين للاختيار ({filteredEmployees.length})</span>
                                </div>
                                <div className="overflow-y-auto custom-scrollbar p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
                                    {filteredEmployees.map(emp => {
                                        const isSelected = selectedDoctors.some(d => d.id === emp.id);
                                        return (
                                            <div 
                                                key={emp.id} 
                                                onClick={() => toggleDoctor(emp)}
                                                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                                                    isSelected ? 'bg-indigo-50 border-indigo-400 shadow-sm' : 'bg-white border-gray-100 hover:border-indigo-200'
                                                }`}
                                            >
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white"/>}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm text-gray-800">{emp.name}</div>
                                                    <div className="text-xs text-gray-500 font-mono">{emp.specialty} • {emp.employee_id}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* =======================================================
                VIEW 2: العرض الشهري والطباعة (Monthly Matrix & Print)
            ======================================================= */}
            {viewMode === 'monthly' && (
                <div className="space-y-4 animate-in slide-in-from-right duration-300">
                    <div className="bg-white p-4 rounded-3xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Input type="month" label="اختر الشهر" value={selectedMonth} onChange={(v) => { setSelectedMonth(v); }} />
                            <button onClick={() => refetch()} disabled={isFetching} className="mt-6 bg-indigo-50 text-indigo-600 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-100 transition-colors disabled:opacity-50">
                                {isFetching ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>} جلب الشهر
                            </button>
                        </div>
                        <button onClick={handlePrint} className="bg-gray-800 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-900 transition-all shadow-lg active:scale-95">
                            <Printer className="w-5 h-5"/> طباعة الجدول (A4)
                        </button>
                    </div>

                    <div className="bg-white rounded-3xl border shadow-sm overflow-hidden p-2 md:p-4">
                        {isFetching ? (
                            <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto"/></div>
                        ) : (
                            <div className="overflow-x-auto print-container" ref={printRef}>
                                {/* ✅ ستايل طباعة رسمي فائق الدقة بـ هوامش 0.5 سم */}
                                <style type="text/css" media="print">
                                    {`
                                        @page { size: A4 landscape; margin: 0.5cm; }
                                        body { -webkit-print-color-adjust: exact; background: white; margin: 0; padding: 0; }
                                        .print-table { width: 100%; border-collapse: collapse; font-size: 10px; line-height: 1.1; table-layout: fixed; }
                                        .print-table th, .print-table td { border: 1px solid #333; padding: 1px 2px; text-align: center; height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                                        .print-table th { background-color: #e5e7eb !important; font-weight: bold; font-size: 10px; }
                                        .bg-red-50 { background-color: #fef2f2 !important; }
                                        
                                        /* تحديد النسب المئوية للأعمدة للتأكد من احتوائها في الورقة */
                                        .col-day { width: 4%; }
                                        .col-date { width: 6%; }
                                        .col-doc { width: 9%; }
                                        .col-notes { width: 10%; }
                                    `}
                                </style>
                                <table className="print-table w-full text-center whitespace-nowrap min-w-[1000px]">
                                    <thead>
                                        <tr className="bg-gray-100 text-gray-700">
                                            <th className="p-2 col-day">اليوم</th>
                                            <th className="p-2 col-date">التاريخ</th>
                                            <th className="p-2 col-doc text-blue-700">طبيب بشرى 1</th>
                                            <th className="p-2 col-doc text-blue-700">طبيب بشرى 2</th>
                                            <th className="p-2 col-doc text-purple-700">طبيب اسنان 1</th>
                                            <th className="p-2 col-doc text-purple-700">طبيب اسنان 2</th>
                                            <th className="p-2 col-doc text-emerald-700">صيدلى</th>
                                            <th className="p-2 col-doc text-amber-700">فنى معمل</th>
                                            <th className="p-2 col-doc text-orange-700">علاج طبيعى</th>
                                            <th className="p-2 col-doc text-rose-700">تمريض</th>
                                            <th className="p-2 col-doc text-teal-700">كاتب</th>
                                            <th className="p-2 col-doc text-gray-700">ادارى</th>
                                            <th className="p-2 col-notes">ملاحظات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {getMonthlyMatrix().map((day) => (
                                            <tr key={day.date} className={`border-t border-gray-200 ${day.dayName === 'الجمعة' ? 'bg-red-50 text-red-900 font-bold' : 'hover:bg-gray-50'}`}>
                                                <td className="font-bold text-[10px]">{day.dayName.replace('ال', '')}</td>
                                                <td className="font-mono text-[10px]">{day.date}</td>
                                                <td className="text-blue-800 font-bold text-[10px]">{day.humanDoc1}</td>
                                                <td className="text-blue-800 font-bold text-[10px]">{day.humanDoc2}</td>
                                                <td className="text-purple-800 font-bold text-[10px]">{day.dentist1}</td>
                                                <td className="text-purple-800 font-bold text-[10px]">{day.dentist2}</td>
                                                <td className="text-emerald-800 font-bold text-[10px]">{day.pharmacist}</td>
                                                <td className="text-amber-800 font-bold text-[10px]">{day.labTech}</td>
                                                <td className="text-orange-800 font-bold text-[10px]">{day.physio}</td>
                                                <td className="text-rose-800 font-bold text-[10px]">{day.nurse}</td>
                                                <td className="text-teal-800 font-bold text-[10px]">{day.clerk}</td>
                                                <td className="text-gray-800 font-bold text-[10px]">{day.admin}</td>
                                                <td className="text-[9px] text-gray-500 truncate">{day.notes}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
