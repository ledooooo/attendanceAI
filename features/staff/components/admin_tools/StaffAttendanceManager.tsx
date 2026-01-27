import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../supabaseClient';
import { useReactToPrint } from 'react-to-print';
import { 
    Search, Printer, Upload, Calendar, Loader2, RefreshCw, 
    Filter, ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AttendanceRecord, Employee, LeaveRequest } from '../../../../types';
import * as XLSX from 'xlsx';

type ReportType = 'daily' | 'force' | 'absence' | 'specialties';

export default function StaffAttendanceManager() {
    const queryClient = useQueryClient();
    const componentRef = useRef(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- State ---
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [activeReport, setActiveReport] = useState<ReportType>('daily');
    const [isProcessing, setIsProcessing] = useState(false);

    // Filters & Sorting
    const [searchTerm, setSearchTerm] = useState(''); 
    const [filterSpecialty, setFilterSpecialty] = useState('all');
    const [filterStatus, setFilterStatus] = useState('active_only'); 
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'specialty'; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    // --- 1. Queries ---
    
    const { data: employees = [] } = useQuery({
        queryKey: ['staff_manager_employees'],
        queryFn: async () => {
            const { data } = await supabase.from('employees').select('*'); // جلبنا الكل وسنرتب لاحقاً
            return data as Employee[] || [];
        },
        staleTime: 1000 * 60 * 10 
    });

    const { data: attendance = [], refetch: refetchAtt, isRefetching } = useQuery({
        queryKey: ['staff_manager_attendance', date],
        queryFn: async () => {
            const { data } = await supabase.from('attendance').select('*').eq('date', date);
            return data as AttendanceRecord[] || [];
        }
    });

    // إصلاح جلب الإجازات: التأكد من صيغة التاريخ ومطابقة الحالة
    const { data: leaves = [] } = useQuery({
        queryKey: ['staff_manager_leaves', date],
        queryFn: async () => {
            const { data, error } = await supabase.from('leave_requests')
                .select('*')
                .eq('status', 'approved') // تأكد أن الحالة في القاعدة approved (lowercase)
                .lte('start_date', date)
                .gte('end_date', date);
            
            if (error) console.error("Error fetching leaves:", error);
            return data as LeaveRequest[] || [];
        }
    });

    // --- 2. Data Processing ---
    const processedData = useMemo(() => {
        let data = employees.map(emp => {
            const attRecord = attendance.find(a => a.employee_id === emp.employee_id);
            const leaveRecord = leaves.find(l => l.employee_id === emp.employee_id);
            
            let inTime = '-';
            let outTime = '-';
            let status = 'غير متواجد'; 
            let displayText = ''; // النص الذي سيظهر في خانة الحضور إذا كان إجازة

            // تحليل البصمة
            if (attRecord && attRecord.times) {
                const times = attRecord.times.split(/\s+/).filter(t => t.includes(':')).sort();
                if (times.length > 0) {
                    inTime = times[0];
                    status = 'متواجد'; // مجرد وجود بصمة واحدة = متواجد
                }
                if (times.length > 1) {
                    const lastTime = times[times.length - 1];
                    
                    // حساب فرق التوقيت (أكبر من ساعة؟)
                    const [inH, inM] = inTime.split(':').map(Number);
                    const [outH, outM] = lastTime.split(':').map(Number);
                    const diffMinutes = (outH * 60 + outM) - (inH * 60 + inM);

                    if (diffMinutes >= 60) {
                        outTime = lastTime;
                    } else {
                        // تفريغ الانصراف لو الفرق أقل من ساعة
                        outTime = '-';
                    }
                }
            }

            // منطق جزء من الوقت
            const isPartTimePeriod = emp.part_time_start_date && emp.part_time_end_date && 
                                     date >= emp.part_time_start_date && date <= emp.part_time_end_date;
            
            if (isPartTimePeriod) {
                const dayName = new Date(date).toLocaleDateString('ar-EG', { weekday: 'long' });
                const empWorkDays = typeof emp.work_days === 'string' ? JSON.parse(emp.work_days) : emp.work_days || [];
                
                if (!empWorkDays.includes(dayName)) {
                    // ليس يوم عمله
                    if (status === 'غير متواجد') {
                        status = 'جزء من الوقت';
                        displayText = 'جزء من الوقت';
                    }
                }
            }

            // منطق الإجازات (تكتب في التقرير)
            if (leaveRecord) {
                // لو الموظف بصم، يظل "متواجد"، لو مابصمش نكتب نوع الإجازة
                if (status === 'غير متواجد') {
                    status = 'إجازة'; // للتصنيف الإحصائي
                    displayText = leaveRecord.request_type; // يظهر في الجدول "عارضة" مثلاً
                }
            }

            return {
                ...emp,
                inTime,
                outTime,
                finalStatus: status,
                displayText
            };
        });

        // الفلترة
        data = data.filter(item => {
            const search = searchTerm.toLowerCase();
            const matchesSearch = item.name.toLowerCase().includes(search) || item.employee_id.includes(search);
            const matchesSpec = filterSpecialty === 'all' || item.specialty === filterSpecialty;
            
            let matchesStatus = true;
            if (filterStatus === 'active_only') matchesStatus = item.status === 'نشط';
            else if (filterStatus !== 'all') matchesStatus = item.status === filterStatus;

            return matchesSearch && matchesSpec && matchesStatus;
        });

        // الترتيب (Sorting)
        data.sort((a, b) => {
            const valA = a[sortConfig.key] || '';
            const valB = b[sortConfig.key] || '';
            
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return data;
    }, [employees, attendance, leaves, searchTerm, filterSpecialty, filterStatus, date, sortConfig]);

    // --- 3. Statistics ---
    const stats = useMemo(() => {
        const total = processedData.length;
        const present = processedData.filter(d => d.finalStatus === 'متواجد').length;
        const absent = processedData.filter(d => d.finalStatus === 'غير متواجد').length;
        const partTime = processedData.filter(d => d.finalStatus === 'جزء من الوقت').length;
        const leave = processedData.filter(d => d.finalStatus === 'إجازة').length;
        
        const effectiveTotal = total - leave - partTime;
        const percent = effectiveTotal > 0 ? Math.round((present / effectiveTotal) * 100) : 0;

        const bySpecialty: any = {};
        processedData.forEach(d => {
            if (!bySpecialty[d.specialty]) bySpecialty[d.specialty] = { total: 0, present: 0, absent: 0, leave: 0 };
            bySpecialty[d.specialty].total++;
            if (d.finalStatus === 'متواجد') bySpecialty[d.specialty].present++;
            else if (d.finalStatus === 'غير متواجد') bySpecialty[d.specialty].absent++;
            else bySpecialty[d.specialty].leave++;
        });

        return { total, present, absent, leave, partTime, percent, bySpecialty };
    }, [processedData]);

    // --- 4. File Upload (.dat) ---
    const rawMutation = useMutation({
        mutationFn: async (payload: any[]) => {
            const { error } = await supabase.from('attendance').upsert(payload, { onConflict: 'employee_id,date' });
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم التحديث');
            queryClient.invalidateQueries({ queryKey: ['staff_manager_attendance'] });
        },
        onError: () => toast.error('خطأ في الرفع')
    });

    const handleRawFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsProcessing(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const lines = (event.target?.result as string).split('\n');
                const groupedData: any = {};
                lines.forEach(line => {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length < 3) return;
                    const [empId, rawDate, rawTime] = parts;
                    let formattedDate = rawDate;
                    if (rawDate.includes('/')) {
                        const [d, m, y] = rawDate.split('/');
                        formattedDate = `${y}-${m}-${d}`;
                    }
                    const key = `${empId}_${formattedDate}`;
                    if (!groupedData[key]) groupedData[key] = { id: empId, date: formattedDate, times: [] };
                    groupedData[key].times.push(rawTime);
                });
                const payload = Object.values(groupedData).map((g:any) => ({
                    employee_id: g.id, date: g.date, times: g.times.sort().join(' '), status: 'حضور'
                }));
                if (payload.length > 0) rawMutation.mutate(payload);
            } catch (err) { toast.error("خطأ في الملف"); } 
            finally { setIsProcessing(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
        };
        reader.readAsText(file);
    };

    const handlePrint = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: `Report_${date}`,
    });

    // تقسيم البيانات للتقرير اليومي
    const halfIndex = Math.ceil(processedData.length / 2);
    const rightColumnData = processedData.slice(0, halfIndex);
    const leftColumnData = processedData.slice(halfIndex);

    // دالة مساعدة لتبديل الترتيب
    const toggleSort = (key: 'name' | 'specialty') => {
        setSortConfig(curr => ({
            key,
            direction: curr.key === key && curr.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            {/* Controls (No Print) */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border flex flex-col xl:flex-row gap-4 justify-between items-center no-print">
                <div className="flex items-center gap-3">
                    <div className="relative bg-gray-50 rounded-xl border flex items-center px-3 py-2">
                        <Calendar className="w-5 h-5 text-gray-500 ml-2"/>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent outline-none font-bold text-gray-700"/>
                    </div>
                    <button onClick={() => { refetchAtt(); toast.success('تم التحديث'); }} disabled={isRefetching} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100">
                        <RefreshCw className={`w-5 h-5 ${isRefetching ? 'animate-spin' : ''}`}/>
                    </button>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                    {[{id: 'daily', label: 'التمام اليومي'}, {id: 'force', label: 'القوة الفعلية'}, {id: 'absence', label: 'الغياب'}, {id: 'specialties', label: 'إحصاء التخصصات'}].map(r => (
                        <button key={r.id} onClick={() => setActiveReport(r.id as ReportType)} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeReport === r.id ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>{r.label}</button>
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

            {/* Filters & Sorting (No Print) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border shadow-sm no-print">
                <div className="relative md:col-span-2">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"/>
                    <input placeholder="بحث..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pr-9 pl-4 py-2 rounded-xl border bg-gray-50 outline-none text-sm"/>
                </div>
                <select value={filterSpecialty} onChange={e => setFilterSpecialty(e.target.value)} className="p-2 rounded-xl border bg-gray-50 outline-none text-sm font-bold">
                    <option value="all">كل التخصصات</option>
                    {Array.from(new Set(employees.map(e => e.specialty))).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                
                {/* أزرار الترتيب */}
                <div className="flex gap-2">
                    <button onClick={() => toggleSort('name')} className={`flex-1 flex items-center justify-center gap-1 rounded-xl border text-xs font-bold ${sortConfig.key === 'name' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50'}`}>
                        الاسم <ArrowUpDown className="w-3 h-3"/>
                    </button>
                    <button onClick={() => toggleSort('specialty')} className={`flex-1 flex items-center justify-center gap-1 rounded-xl border text-xs font-bold ${sortConfig.key === 'specialty' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50'}`}>
                        التخصص <ArrowUpDown className="w-3 h-3"/>
                    </button>
                </div>
            </div>

            {/* Printable Report */}
            <div ref={componentRef} className="bg-white p-8 rounded-[30px] shadow-sm min-h-[800px] print:p-2 print:shadow-none" dir="rtl">
                
                {/* Header: One Line */}
                <div className="hidden print:block text-center border-b-2 border-black pb-2 mb-4">
                    <p className="text-[12px] font-bold font-mono text-black">
                        مركز غرب المطار - تقرير تواجد العاملين بالمركز - التاريخ: {new Date(date).toLocaleDateString('ar-EG')} - التوقيت: {new Date().toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}
                    </p>
                </div>

                {/* 1. Daily Report */}
                {activeReport === 'daily' && (
                    <div className="w-full">
                        <div className="flex flex-row gap-4 print:gap-1">
                            <div className="w-1/2"><DailyTable data={rightColumnData} /></div>
                            <div className="w-px bg-black hidden print:block mx-1"></div>
                            <div className="w-1/2"><DailyTable data={leftColumnData} startIndex={halfIndex} /></div>
                        </div>

                        {/* Footer Stats */}
                        <div className="mt-4 pt-2 border-t-2 border-black text-[10px] print:text-[9px] font-bold">
                            <div className="flex justify-between mb-1 bg-gray-100 print:bg-transparent p-1 rounded">
                                <span>إجمالي القوة: {stats.total}</span>
                                <span>متواجد: {stats.present}</span>
                                <span>غير متواجد: {stats.absent}</span>
                                <span>إجازات: {stats.leave}</span>
                                <span>جزء وقت: {stats.partTime}</span>
                                <span>نسبة الحضور: {stats.percent}%</span>
                            </div>
                            <div className="flex flex-wrap gap-x-2 gap-y-1">
                                {Object.entries(stats.bySpecialty).map(([spec, s]: any) => (
                                    <span key={spec} className="print:border-l pl-2 ml-1 border-gray-400">
                                        {spec}: {s.present}/{s.total}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Force Report */}
                {activeReport === 'force' && (
                    <table className="w-full text-sm text-right border-collapse">
                        <thead className="bg-gray-100 font-bold border-b-2 border-black">
                            <tr>
                                <th className="p-2 border border-gray-400">م</th>
                                <th className="p-2 border border-gray-400">الكود</th>
                                <th className="p-2 border border-gray-400">الاسم</th>
                                <th className="p-2 border border-gray-400">التخصص</th>
                                <th className="p-2 border border-gray-400">الرقم القومي</th>
                                <th className="p-2 border border-gray-400">الهاتف</th>
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
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* 3. Absence Report */}
                {activeReport === 'absence' && (
                    <table className="w-full text-sm text-right border-collapse">
                        <thead className="bg-red-50 font-bold border-b-2 border-black text-red-900">
                            <tr>
                                <th className="p-2 border border-gray-400">الكود</th>
                                <th className="p-2 border border-gray-400">الاسم</th>
                                <th className="p-2 border border-gray-400">التخصص</th>
                                <th className="p-2 border border-gray-400 text-center">الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedData.filter(d => d.finalStatus === 'غير متواجد').map((emp) => (
                                <tr key={emp.id} className="border-b border-gray-300">
                                    <td className="p-2 border border-gray-300 text-center font-mono">{emp.employee_id}</td>
                                    <td className="p-2 border border-gray-300 font-bold">{emp.name}</td>
                                    <td className="p-2 border border-gray-300">{emp.specialty}</td>
                                    <td className="p-2 border border-gray-300 text-center font-bold text-red-600">غير متواجد</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* 4. Specialties Report */}
                {activeReport === 'specialties' && (
                    <table className="w-full text-sm text-right border-collapse max-w-2xl mx-auto">
                        <thead className="bg-gray-800 text-white font-bold">
                            <tr>
                                <th className="p-2 border border-gray-600">التخصص</th>
                                <th className="p-2 border border-gray-600 text-center">القوة</th>
                                <th className="p-2 border border-gray-600 text-center">متواجد</th>
                                <th className="p-2 border border-gray-600 text-center">غير متواجد</th>
                                <th className="p-2 border border-gray-600 text-center">إجازات</th>
                                <th className="p-2 border border-gray-600 text-center">النسبة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(stats.bySpecialty).map(([spec, s]: any) => (
                                <tr key={spec} className="border-b border-gray-300">
                                    <td className="p-2 border border-gray-300 font-bold bg-gray-50">{spec}</td>
                                    <td className="p-2 border border-gray-300 text-center font-bold">{s.total}</td>
                                    <td className="p-2 border border-gray-300 text-center text-green-700 font-bold">{s.present}</td>
                                    <td className="p-2 border border-gray-300 text-center text-red-600 font-bold">{s.absent}</td>
                                    <td className="p-2 border border-gray-300 text-center text-orange-600">{s.leave}</td>
                                    <td className="p-2 border border-gray-300 text-center font-mono">
                                        {s.total > 0 ? Math.round((s.present / (s.total - s.leave - s.partTime)) * 100) : 0}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// Table Component (Columns Updated: No Status Column)
const DailyTable = ({ data, startIndex = 0 }: { data: any[], startIndex?: number }) => {
    return (
        <table className="w-full text-[10px] print:text-[9px] text-right border-collapse">
            <thead className="bg-gray-100 border-b border-black font-bold">
                <tr>
                    <th className="p-1 border border-gray-400 w-6 text-center">م</th>
                    <th className="p-1 border border-gray-400 w-10 text-center">كود</th>
                    <th className="p-1 border border-gray-400">الاسم</th>
                    <th className="p-1 border border-gray-400 w-16">التخصص</th>
                    <th className="p-1 border border-gray-400 w-12 text-center">حضور</th>
                    <th className="p-1 border border-gray-400 w-12 text-center">انصراف</th>
                </tr>
            </thead>
            <tbody>
                {data.map((row, idx) => (
                    <tr key={row.id} className="border-b border-gray-300">
                        <td className="p-1 border border-gray-300 text-center">{startIndex + idx + 1}</td>
                        <td className="p-1 border border-gray-300 text-center font-mono">{row.employee_id}</td>
                        <td className="p-1 border border-gray-300 font-bold truncate max-w-[110px]">{row.name}</td>
                        <td className="p-1 border border-gray-300 truncate max-w-[70px]">{row.specialty}</td>
                        
                        {/* خانة الحضور: تظهر الوقت، أو نوع الإجازة، أو جزء من الوقت */}
                        <td className="p-1 border border-gray-300 text-center font-bold">
                            {row.inTime !== '-' ? row.inTime : 
                             row.displayText ? <span className="text-[8px]">{row.displayText}</span> : '-'}
                        </td>
                        
                        <td className="p-1 border border-gray-300 text-center font-mono">{row.outTime}</td>
                    </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={6} className="p-2 text-center">-</td></tr>}
            </tbody>
        </table>
    );
};
