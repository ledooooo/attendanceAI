import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../supabaseClient';
import { useReactToPrint } from 'react-to-print';
import { 
    Search, Printer, Upload, Calendar, Loader2, RefreshCw, 
    Filter, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AttendanceRecord, Employee, LeaveRequest } from '../../../../types';
import * as XLSX from 'xlsx';

// أنواع التقارير المطلوبة
type ReportType = 'force' | 'daily' | 'absence' | 'specialties';

export default function StaffAttendanceManager() {
    const queryClient = useQueryClient();
    const componentRef = useRef(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- State ---
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [activeReport, setActiveReport] = useState<ReportType>('daily');
    const [isProcessing, setIsProcessing] = useState(false);

    // Filters
    const [searchTerm, setSearchTerm] = useState(''); // اسم أو كود
    const [filterSpecialty, setFilterSpecialty] = useState('all');
    const [filterStatus, setFilterStatus] = useState('active_only'); // الافتراضي: القوة الفعلية فقط

    // --- 1. Queries (جلب البيانات) ---
    
    // أ) الموظفين
    const { data: employees = [] } = useQuery({
        queryKey: ['staff_manager_employees'],
        queryFn: async () => {
            const { data } = await supabase.from('employees').select('*').order('name');
            return data as Employee[] || [];
        },
        staleTime: 1000 * 60 * 10 // 10 دقائق
    });

    // ب) الحضور لليوم المحدد
    const { data: attendance = [], refetch: refetchAtt, isRefetching } = useQuery({
        queryKey: ['staff_manager_attendance', date],
        queryFn: async () => {
            const { data } = await supabase.from('attendance').select('*').eq('date', date);
            return data as AttendanceRecord[] || [];
        }
    });

    // ج) الإجازات السارية في هذا اليوم
    const { data: leaves = [] } = useQuery({
        queryKey: ['staff_manager_leaves', date],
        queryFn: async () => {
            const { data } = await supabase.from('leave_requests')
                .select('*')
                .eq('status', 'approved') // المقبول فقط
                .lte('start_date', date)
                .gte('end_date', date);
            return data as LeaveRequest[] || [];
        }
    });

    // --- 2. Data Processing (المنطق الرئيسي) ---
    const processedData = useMemo(() => {
        return employees.map(emp => {
            // 1. البحث عن سجل الحضور
            const attRecord = attendance.find(a => a.employee_id === emp.employee_id);
            // 2. البحث عن إجازة
            const leaveRecord = leaves.find(l => l.employee_id === emp.employee_id);
            
            // 3. تحليل الأوقات
            let inTime = '-';
            let outTime = '-';
            let status = 'غياب'; // الحالة الافتراضية
            let note = '';

            if (attRecord && attRecord.times) {
                // تنظيف الأوقات وترتيبها
                const times = attRecord.times.split(/\s+/).filter(t => t.includes(':')).sort();
                if (times.length > 0) inTime = times[0];
                if (times.length > 1) outTime = times[times.length - 1];

                if (inTime !== '-' && outTime !== '-') status = 'حضور';
                else if (inTime !== '-') status = 'ترك عمل'; // بصمة واحدة
            }

            // 4. أولويات الحالة (الإجازة تغلب الغياب)
            if (leaveRecord) {
                status = 'إجازة';
                note = leaveRecord.request_type;
            }

            // 5. التحقق من العمل الجزئي (Part Time)
            const isPartTime = emp.part_time_start_date && emp.part_time_end_date && 
                               date >= emp.part_time_start_date && date <= emp.part_time_end_date;
            
            if (isPartTime) {
                // هل اليوم من أيام عمله؟
                const dayName = new Date(date).toLocaleDateString('ar-EG', { weekday: 'long' });
                const empWorkDays = typeof emp.work_days === 'string' ? JSON.parse(emp.work_days) : emp.work_days || [];
                
                if (empWorkDays.includes(dayName)) {
                    note = note ? `${note} (جزء وقت)` : 'جزء من الوقت';
                } else {
                    status = 'راحة'; // ليس يوم عمله
                    note = 'جزء من الوقت (راحة)';
                }
            }

            return {
                ...emp,
                attRecord,
                inTime,
                outTime,
                finalStatus: status,
                note
            };
        }).filter(item => {
            // --- الفلترة ---
            // 1. بحث بالاسم أو الكود
            const search = searchTerm.toLowerCase();
            const matchesSearch = item.name.toLowerCase().includes(search) || item.employee_id.includes(search);
            
            // 2. التخصص
            const matchesSpec = filterSpecialty === 'all' || item.specialty === filterSpecialty;

            // 3. حالة الموظف (نشط/موقوف..)
            let matchesStatus = true;
            if (filterStatus === 'active_only') matchesStatus = item.status === 'نشط';
            else if (filterStatus !== 'all') matchesStatus = item.status === filterStatus;

            return matchesSearch && matchesSpec && matchesStatus;
        });
    }, [employees, attendance, leaves, searchTerm, filterSpecialty, filterStatus, date]);

    // --- 3. Statistics Calculation ---
    const stats = useMemo(() => {
        const total = processedData.length;
        const present = processedData.filter(d => d.finalStatus === 'حضور').length;
        const absent = processedData.filter(d => d.finalStatus === 'غياب').length;
        const leave = processedData.filter(d => d.finalStatus === 'إجازة').length;
        const leftWork = processedData.filter(d => d.finalStatus === 'ترك عمل').length;
        const percent = total > 0 ? Math.round((present / (total - leave)) * 100) : 0; // نسبة الحضور (باستثناء المجازين)

        // إحصائيات التخصصات
        const bySpecialty: any = {};
        processedData.forEach(d => {
            if (!bySpecialty[d.specialty]) {
                bySpecialty[d.specialty] = { total: 0, present: 0, absent: 0, leave: 0 };
            }
            bySpecialty[d.specialty].total++;
            if (d.finalStatus === 'حضور') bySpecialty[d.specialty].present++;
            if (d.finalStatus === 'غياب') bySpecialty[d.specialty].absent++;
            if (d.finalStatus === 'إجازة') bySpecialty[d.specialty].leave++;
        });

        return { total, present, absent, leave, leftWork, percent, bySpecialty };
    }, [processedData]);

    // --- 4. File Upload Logic (.dat) ---
    const rawMutation = useMutation({
        mutationFn: async (payload: any[]) => {
            const { error } = await supabase.from('attendance').upsert(payload, { onConflict: 'employee_id,date' });
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم رفع البيانات بنجاح');
            queryClient.invalidateQueries({ queryKey: ['staff_manager_attendance'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    const handleRawFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsProcessing(true);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const lines = text.split('\n');
                const groupedData: { [key: string]: { id: string, date: string, times: string[] } } = {};

                lines.forEach(line => {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length < 3) return;
                    // Format: ID Date Time ...
                    const empId = parts[0];
                    const rawDate = parts[1]; // e.g., 2026-01-27 or 27/01/2026
                    const rawTime = parts[2];

                    // توحيد تنسيق التاريخ إلى YYYY-MM-DD
                    let formattedDate = rawDate;
                    if (rawDate.includes('/')) {
                        const [d, m, y] = rawDate.split('/');
                        formattedDate = `${y}-${m}-${d}`;
                    }

                    const key = `${empId}_${formattedDate}`;
                    if (!groupedData[key]) groupedData[key] = { id: empId, date: formattedDate, times: [] };
                    groupedData[key].times.push(rawTime);
                });

                const payload = Object.values(groupedData).map(g => ({
                    employee_id: g.id,
                    date: g.date,
                    times: g.times.sort().join(' '),
                    status: g.times.length > 1 ? 'حضور' : 'ترك عمل' // حالة مبدئية
                }));

                if (payload.length > 0) rawMutation.mutate(payload);
                else toast.error("الملف فارغ أو التنسيق غير صحيح");

            } catch (err) {
                console.error(err);
                toast.error("فشل قراءة الملف");
            } finally {
                setIsProcessing(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    // --- 5. Print & Export ---
    const handlePrint = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: `Report_${activeReport}_${date}`,
    });

    // Helper for "Daily Presence" Split View
    const halfIndex = Math.ceil(processedData.length / 2);
    const rightColumnData = processedData.slice(0, halfIndex);
    const leftColumnData = processedData.slice(halfIndex);

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            
            {/* --- شريط التحكم العلوي --- */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col xl:flex-row gap-4 justify-between items-center no-print">
                <div className="flex items-center gap-3 w-full xl:w-auto">
                    <div className="relative bg-gray-50 rounded-xl border flex items-center px-3 py-2">
                        <Calendar className="w-5 h-5 text-gray-500 ml-2"/>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent outline-none font-bold text-gray-700"/>
                    </div>
                    <button onClick={() => refetchAtt()} disabled={isRefetching} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors">
                        <RefreshCw className={`w-5 h-5 ${isRefetching ? 'animate-spin' : ''}`}/>
                    </button>
                </div>

                <div className="flex bg-gray-100 p-1.5 rounded-xl shadow-inner overflow-x-auto max-w-full gap-1">
                    {[
                        {id: 'daily', label: 'التمام اليومي'},
                        {id: 'force', label: 'القوة الفعلية'},
                        {id: 'absence', label: 'الغياب'},
                        {id: 'specialties', label: 'إحصاء التخصصات'}
                    ].map(r => (
                        <button 
                            key={r.id} 
                            onClick={() => setActiveReport(r.id as ReportType)}
                            className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${activeReport === r.id ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleRawFileChange} className="hidden" accept=".dat,.txt" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="bg-orange-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-orange-700">
                        {isProcessing ? <Loader2 className="animate-spin w-4 h-4"/> : <Upload className="w-4 h-4"/>} رفع البصمة
                    </button>
                    <button onClick={handlePrint} className="bg-gray-800 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-900">
                        <Printer className="w-4 h-4"/> طباعة
                    </button>
                </div>
            </div>

            {/* --- شريط الفلترة --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm no-print">
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"/>
                    <input 
                        placeholder="بحث بالاسم أو الكود..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pr-9 pl-4 py-2 rounded-xl border bg-gray-50 outline-none focus:bg-white transition-colors text-sm"
                    />
                </div>
                <select 
                    value={filterSpecialty} 
                    onChange={e => setFilterSpecialty(e.target.value)}
                    className="p-2 rounded-xl border bg-gray-50 outline-none text-sm font-bold"
                >
                    <option value="all">كل التخصصات</option>
                    {Array.from(new Set(employees.map(e => e.specialty))).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select 
                    value={filterStatus} 
                    onChange={e => setFilterStatus(e.target.value)}
                    className="p-2 rounded-xl border bg-gray-50 outline-none text-sm font-bold"
                >
                    <option value="active_only">القوة الفعلية (نشط)</option>
                    <option value="all">الكل</option>
                    <option value="موقوف">موقوف</option>
                    <option value="إجازة">إجازة طويلة</option>
                    <option value="خارج المركز">خارج المركز</option>
                </select>
            </div>

            {/* --- منطقة التقرير (للطباعة) --- */}
            <div ref={componentRef} className="bg-white p-8 rounded-[30px] shadow-sm min-h-[800px] print:p-2 print:shadow-none" dir="rtl">
                
                {/* ترويسة الطباعة الموحدة */}
                <div className="hidden print:flex flex-col items-center mb-6 border-b-2 border-black pb-2">
                    <h1 className="text-2xl font-black">مركز طب أسرة غرب المطار</h1>
                    <h2 className="text-lg font-bold mt-1">
                        {activeReport === 'daily' && 'بيان التمام اليومي للعاملين'}
                        {activeReport === 'force' && 'سجل القوة الفعلية للمركز'}
                        {activeReport === 'absence' && 'كشف الغياب اليومي'}
                        {activeReport === 'specialties' && 'إحصائية أعداد التخصصات'}
                    </h2>
                    <div className="flex justify-between w-full mt-2 text-xs font-bold px-4">
                        <span>التاريخ: {new Date(date).toLocaleDateString('ar-EG')}</span>
                        <span>اليوم: {new Date(date).toLocaleDateString('ar-EG', {weekday: 'long'})}</span>
                    </div>
                </div>

                {/* --- 1. تقرير التمام اليومي (Daily Presence) --- */}
                {activeReport === 'daily' && (
                    <div className="w-full">
                        <div className="flex flex-row gap-4 print:gap-2">
                            {/* العمود الأيمن */}
                            <div className="w-1/2">
                                <DailyTable data={rightColumnData} />
                            </div>
                            {/* الخط الفاصل في الطباعة */}
                            <div className="w-px bg-black hidden print:block"></div>
                            {/* العمود الأيسر */}
                            <div className="w-1/2">
                                <DailyTable data={leftColumnData} startIndex={halfIndex} />
                            </div>
                        </div>

                        {/* الفوتر الإحصائي للتقرير اليومي */}
                        <div className="mt-4 pt-2 border-t-2 border-black text-[10px] print:text-[9px] font-bold">
                            <div className="flex justify-between mb-1 bg-gray-100 print:bg-gray-200 p-1 rounded">
                                <span>إجمالي القوة: {stats.total}</span>
                                <span>حضور: {stats.present}</span>
                                <span>غياب: {stats.absent}</span>
                                <span>إجازات: {stats.leave}</span>
                                <span>نسبة الحضور: {stats.percent}%</span>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                                {Object.entries(stats.bySpecialty).map(([spec, s]: any) => (
                                    <span key={spec} className="bg-white px-1 border rounded border-gray-300">
                                        {spec}: {s.present}/{s.total}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- 2. تقرير القوة الفعلية (Force) --- */}
                {activeReport === 'force' && (
                    <table className="w-full text-sm text-right border-collapse">
                        <thead className="bg-gray-100 font-bold border-b-2 border-black">
                            <tr>
                                <th className="p-2 border border-gray-300">م</th>
                                <th className="p-2 border border-gray-300">الكود</th>
                                <th className="p-2 border border-gray-300">الاسم</th>
                                <th className="p-2 border border-gray-300">التخصص</th>
                                <th className="p-2 border border-gray-300">الرقم القومي</th>
                                <th className="p-2 border border-gray-300">الهاتف</th>
                                <th className="p-2 border border-gray-300">ملاحظات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedData.map((emp, idx) => (
                                <tr key={emp.id} className="border-b border-gray-300">
                                    <td className="p-2 border border-gray-300 text-center">{idx + 1}</td>
                                    <td className="p-2 border border-gray-300 text-center font-mono">{emp.employee_id}</td>
                                    <td className="p-2 border border-gray-300 font-bold">{emp.name}</td>
                                    <td className="p-2 border border-gray-300">{emp.specialty}</td>
                                    <td className="p-2 border border-gray-300 text-center font-mono">{emp.national_id}</td>
                                    <td className="p-2 border border-gray-300 text-center">{emp.phone}</td>
                                    <td className="p-2 border border-gray-300 text-xs">{emp.admin_tasks}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* --- 3. تقرير الغياب (Absence) --- */}
                {activeReport === 'absence' && (
                    <div className="w-full">
                        <table className="w-full text-sm text-right border-collapse">
                            <thead className="bg-red-50 font-bold border-b-2 border-red-800 text-red-900">
                                <tr>
                                    <th className="p-3 border border-red-200">الكود</th>
                                    <th className="p-3 border border-red-200">الاسم</th>
                                    <th className="p-3 border border-red-200">التخصص</th>
                                    <th className="p-3 border border-red-200">الحالة</th>
                                    <th className="p-3 border border-red-200">التوقيع</th>
                                </tr>
                            </thead>
                            <tbody>
                                {processedData.filter(d => d.finalStatus === 'غياب').map((emp, idx) => (
                                    <tr key={emp.id} className="border-b border-red-100">
                                        <td className="p-3 border border-red-100 text-center font-mono">{emp.employee_id}</td>
                                        <td className="p-3 border border-red-100 font-bold">{emp.name}</td>
                                        <td className="p-3 border border-red-100">{emp.specialty}</td>
                                        <td className="p-3 border border-red-100 text-red-600 font-bold text-center">غياب</td>
                                        <td className="p-3 border border-red-100"></td>
                                    </tr>
                                ))}
                                {processedData.filter(d => d.finalStatus === 'غياب').length === 0 && (
                                    <tr><td colSpan={5} className="p-10 text-center font-bold text-green-600">لا يوجد غياب اليوم!</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* --- 4. تقرير إحصاء التخصصات (Specialties) --- */}
                {activeReport === 'specialties' && (
                    <div className="w-full max-w-2xl mx-auto">
                        <table className="w-full text-sm text-right border-collapse">
                            <thead className="bg-gray-800 text-white font-bold">
                                <tr>
                                    <th className="p-3 border border-gray-600">التخصص</th>
                                    <th className="p-3 border border-gray-600 text-center">القوة</th>
                                    <th className="p-3 border border-gray-600 text-center">متواجد</th>
                                    <th className="p-3 border border-gray-600 text-center">غياب</th>
                                    <th className="p-3 border border-gray-600 text-center">إجازات</th>
                                    <th className="p-3 border border-gray-600 text-center">نسبة الحضور</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(stats.bySpecialty).map(([spec, s]: any) => (
                                    <tr key={spec} className="border-b border-gray-300">
                                        <td className="p-3 border border-gray-300 font-bold bg-gray-50">{spec}</td>
                                        <td className="p-3 border border-gray-300 text-center font-bold">{s.total}</td>
                                        <td className="p-3 border border-gray-300 text-center text-green-700 font-bold">{s.present}</td>
                                        <td className="p-3 border border-gray-300 text-center text-red-600 font-bold">{s.absent}</td>
                                        <td className="p-3 border border-gray-300 text-center text-orange-600 font-bold">{s.leave}</td>
                                        <td className="p-3 border border-gray-300 text-center font-mono">
                                            {s.total > 0 ? Math.round((s.present / (s.total - s.leave)) * 100) : 0}%
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-gray-200 font-black border-t-2 border-black">
                                    <td className="p-3 border border-gray-400">الإجمالي</td>
                                    <td className="p-3 border border-gray-400 text-center">{stats.total}</td>
                                    <td className="p-3 border border-gray-400 text-center">{stats.present}</td>
                                    <td className="p-3 border border-gray-400 text-center">{stats.absent}</td>
                                    <td className="p-3 border border-gray-400 text-center">{stats.leave}</td>
                                    <td className="p-3 border border-gray-400 text-center">{stats.percent}%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer for print */}
                <div className="hidden print:flex justify-between mt-10 pt-8 px-10 font-bold text-sm">
                    <div className="text-center">
                        <p>مسؤول شئون العاملين</p>
                        <p className="mt-8 text-gray-400">....................</p>
                    </div>
                    <div className="text-center">
                        <p>مدير المركز</p>
                        <p className="mt-8 text-gray-400">....................</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Sub-component for Daily Report Table ---
const DailyTable = ({ data, startIndex = 0 }: { data: any[], startIndex?: number }) => {
    return (
        <table className="w-full text-[10px] print:text-[9px] text-right border-collapse">
            <thead className="bg-gray-100 border-b border-black font-bold">
                <tr>
                    <th className="p-1 border border-gray-400 w-6">م</th>
                    <th className="p-1 border border-gray-400">الاسم</th>
                    <th className="p-1 border border-gray-400 w-16">الوظيفة</th>
                    <th className="p-1 border border-gray-400 w-10 text-center">حضور</th>
                    <th className="p-1 border border-gray-400 w-10 text-center">انصراف</th>
                    <th className="p-1 border border-gray-400 w-12 text-center">ملاحظات</th>
                </tr>
            </thead>
            <tbody>
                {data.map((row, idx) => (
                    <tr key={row.id} className="border-b border-gray-300">
                        <td className="p-1 border border-gray-300 text-center">{startIndex + idx + 1}</td>
                        <td className="p-1 border border-gray-300 font-bold truncate max-w-[100px]">{row.name}</td>
                        <td className="p-1 border border-gray-300 truncate max-w-[60px]">{row.specialty}</td>
                        
                        <td className="p-1 border border-gray-300 text-center font-mono">
                            {row.inTime !== '-' ? row.inTime : (row.finalStatus === 'غياب' ? 'غ' : '-')}
                        </td>
                        <td className="p-1 border border-gray-300 text-center font-mono">{row.outTime}</td>
                        
                        <td className="p-1 border border-gray-300 text-center truncate max-w-[60px] font-bold">
                            {row.finalStatus === 'إجازة' ? row.note : 
                             row.finalStatus === 'غياب' ? 'غياب' : 
                             row.note ? row.note : ''}
                        </td>
                    </tr>
                ))}
                {/* تعبئة صفوف فارغة للحفاظ على التنسيق إذا لزم الأمر */}
                {data.length === 0 && <tr><td colSpan={6} className="p-2 text-center">-</td></tr>}
            </tbody>
        </table>
    );
};
