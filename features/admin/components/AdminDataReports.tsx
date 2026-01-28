import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../supabaseClient';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import { 
    Search, Printer, Upload, Calendar, Loader2, RefreshCw, 
    ArrowUpDown, PlusCircle, Save, X, UserCheck, FilePlus, Clock, Moon, Sun, FileSpreadsheet, XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AttendanceRecord, Employee, LeaveRequest } from '../../../types';
import { ExcelUploadButton, downloadSample } from '../../../components/ui/ExcelUploadButton';
type ReportType = 'daily' | 'force' | 'absence' | 'specialties' | 'monthly';

const REQUEST_TYPES = [
    "اجازة عارضة", "اجازة اعتيادية", "اجازة مرضى", "دورة تدريبية", 
    "خط سير", "مأمورية", "بدل راحة", "اذن صباحى", "اذن مسائي", "تأمين صحي"
];

export default function AdminDataReports({ employees }: { employees: Employee[] }) {
    const queryClient = useQueryClient();
    const componentRef = useRef(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- State ---
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // للتقرير الشهري
    const [activeReport, setActiveReport] = useState<ReportType>('daily');
    const [isProcessing, setIsProcessing] = useState(false);

    // حالة لتخزين التعديلات المؤقتة للطباعة
    const [printOverrides, setPrintOverrides] = useState<Record<string, string>>({});

    // Filters & Sorting
    const [searchTerm, setSearchTerm] = useState(''); 
    const [filterSpecialty, setFilterSpecialty] = useState('all');
    const [filterStatus, setFilterStatus] = useState('active_only'); 
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'specialty'; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    // --- Modal States ---
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualData, setManualData] = useState({
        employee_id: '',
        date: new Date().toISOString().split('T')[0],
        timeIn: '',
        timeOut: '',
        responsible: ''
    });

    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestData, setRequestData] = useState({
        employee_id: '',
        request_type: REQUEST_TYPES[0],
        start_date: date,
        end_date: date,
        reason: ''
    });

    // --- 1. Queries ---
    // الموظفين تأتي من الـ Props لتقليل الطلبات، أو يمكن استخدام useQuery إذا لم تكن ممررة

    // جلب الحضور (يومي أو شهري حسب التقرير)
    const { data: attendance = [], refetch: refetchAtt, isRefetching } = useQuery({
        queryKey: ['report_attendance', activeReport, date, month],
        queryFn: async () => {
            let query = supabase.from('attendance').select('*');
            
            if (activeReport === 'monthly' || activeReport === 'absence') { // تقرير الغياب يحتاج بيانات الشهر لحساب الأيام
                const startOfMonth = `${month}-01`;
                const d = new Date(month);
                const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                const endOfMonth = `${month}-${lastDay}`;
                query = query.gte('date', startOfMonth).lte('date', endOfMonth);
            } else {
                query = query.eq('date', date);
            }
            
            const { data } = await query;
            return data as AttendanceRecord[] || [];
        }
    });

    // جلب الإجازات
    const { data: leaves = [] } = useQuery({
        queryKey: ['report_leaves', activeReport, date, month],
        queryFn: async () => {
            let query = supabase.from('leave_requests').select('*').eq('status', 'مقبول');

            if (activeReport === 'monthly' || activeReport === 'absence') {
                const startOfMonth = `${month}-01`;
                const d = new Date(month);
                const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                const endOfMonth = `${month}-${lastDay}`;
                query = query.or(`start_date.gte.${startOfMonth},end_date.lte.${endOfMonth}`);
            } else {
                query = query.lte('start_date', date).gte('end_date', date);
            }

            const { data, error } = await query;
            if (error) { console.error(error); return []; }
            return data as LeaveRequest[] || [];
        }
    });

    // --- 2. Data Processing ---
    const processedData = useMemo(() => {
        // --- معالجة التقارير الشهرية (شامل + غياب) ---
        if (activeReport === 'monthly' || activeReport === 'absence') {
            const daysInMonth = new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 0).getDate();
            const allDays = Array.from({length: daysInMonth}, (_, i) => {
                const d = new Date(month);
                d.setDate(i + 1);
                return d.toISOString().split('T')[0];
            });

            return employees.map(emp => {
                const empAtts = attendance.filter(a => a.employee_id === emp.employee_id);
                const empLeaves = leaves.filter(l => String(l.employee_id) === String(emp.employee_id));
                
                // حساب أيام الغياب وتواريخها
                const absenceDates: string[] = [];
                let absenceCount = 0;

                allDays.forEach(day => {
                    const dayName = new Date(day).toLocaleDateString('ar-EG', { weekday: 'long' });
                    // هل اليوم يوم عمل؟
                    const empWorkDays = typeof emp.work_days === 'string' ? JSON.parse(emp.work_days) : emp.work_days || [];
                    const isWorkDay = empWorkDays.includes(dayName);

                    // هل هو جزء وقت غير مطالب بالحضور اليوم؟
                    const isPartTime = emp.part_time_start_date && emp.part_time_end_date && 
                                       day >= emp.part_time_start_date && day <= emp.part_time_end_date;
                    
                    if (isPartTime && !isWorkDay) return; // لا يحسب غياب

                    // هل حضر؟
                    const hasAtt = empAtts.some(a => a.date === day);
                    // هل في إجازة؟
                    const hasLeave = empLeaves.some(l => day >= l.start_date && day <= l.end_date);

                    if (!hasAtt && !hasLeave && emp.status === 'نشط') {
                        absenceCount++;
                        absenceDates.push(day.slice(8)); // اليوم فقط
                    }
                });

                return { 
                    ...emp, 
                    daysPresent: empAtts.length, 
                    daysLeaves: empLeaves.length, // عدد الطلبات وليس الأيام بدقة
                    absenceCount,
                    absenceDates: absenceDates.join(', ')
                };
            }).filter(item => {
                // الفلاتر
                const term = searchTerm.toLowerCase();
                const matchesSearch = item.name.toLowerCase().includes(term) || item.employee_id.includes(term);
                const matchesSpec = filterSpecialty === 'all' || item.specialty === filterSpecialty;
                let matchesStatus = true;
                if (filterStatus === 'active_only') matchesStatus = item.status === 'نشط';
                else if (filterStatus !== 'all') matchesStatus = item.status === filterStatus;
                
                // لتقرير الغياب، نعرض فقط من لديه غياب
                if (activeReport === 'absence' && item.absenceCount === 0) return false;

                return matchesSearch && matchesSpec && matchesStatus;
            });
        }

        // --- المعالجة اليومية ---
        let data = employees.map(emp => {
            const attRecord = attendance.find(a => a.employee_id === emp.employee_id);
            const leaveRecord = leaves.find(l => String(l.employee_id) === String(emp.employee_id));
            
            let displayIn = '-';  
            let displayOut = '-'; 
            let statsStatus = 'غير متواجد'; 

            if (printOverrides[emp.employee_id]) {
                displayIn = printOverrides[emp.employee_id];
                displayOut = '';
                // تصنيف للحالة الإحصائية بناءً على النص
                if (displayIn === 'غياب') statsStatus = 'غياب';
                else if (displayIn === 'مسائي' || displayIn === 'مبيت') statsStatus = displayIn; 
                else statsStatus = 'متواجد'; 
            } else {
                let hasPunch = false;
                if (attRecord && attRecord.times) {
                    const times = attRecord.times.split(/\s+/).filter(t => t.includes(':')).sort();
                    if (times.length > 0) {
                        hasPunch = true;
                        displayIn = times[0]; 
                        statsStatus = 'متواجد';
                        if (times.length > 1) {
                            const lastTime = times[times.length - 1];
                            const [h1, m1] = displayIn.split(':').map(Number);
                            const [h2, m2] = lastTime.split(':').map(Number);
                            const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
                            if (diff >= 60) displayOut = lastTime;
                            else displayOut = ''; 
                        } else { displayOut = ''; }
                    }
                }

                if (!hasPunch) {
                    if (leaveRecord) {
                        statsStatus = 'إجازة';
                        let typeText = leaveRecord.type || (leaveRecord.notes ? leaveRecord.notes.split('-')[0] : 'إجازة');
                        displayIn = typeText.replace('اجازة ', '').replace('إجازة ', ''); 
                        displayOut = '';
                    } else {
                        const isPartTimeContract = emp.part_time_start_date && emp.part_time_end_date && 
                                                   date >= emp.part_time_start_date && date <= emp.part_time_end_date;
                        if (isPartTimeContract) {
                            const dayName = new Date(date).toLocaleDateString('ar-EG', { weekday: 'long' });
                            const empWorkDays = typeof emp.work_days === 'string' ? JSON.parse(emp.work_days) : emp.work_days || [];
                            if (empWorkDays.includes(dayName)) {
                                statsStatus = 'غير متواجد'; // غياب عادي (مطالب ولم يحضر)
                                displayIn = '-'; 
                            } else {
                                statsStatus = 'جزء وقت'; // غير مطالب
                                displayIn = 'جزء وقت';
                                displayOut = '';
                            }
                        }
                    }
                }
            }
            return { ...emp, displayIn, displayOut, statsStatus };
        });

        // Filter & Sort
        data = data.filter(item => {
            const term = searchTerm.toLowerCase();
            const matchesSearch = item.name.toLowerCase().includes(term) || item.employee_id.includes(term);
            const matchesSpec = filterSpecialty === 'all' || item.specialty === filterSpecialty;
            let matchesStatus = true;
            if (filterStatus === 'active_only') matchesStatus = item.status === 'نشط';
            else if (filterStatus !== 'all') matchesStatus = item.status === filterStatus;
            return matchesSearch && matchesSpec && matchesStatus;
        });

        data.sort((a, b) => {
            const valA = a[sortConfig.key] || '';
            const valB = b[sortConfig.key] || '';
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return data;
    }, [employees, attendance, leaves, searchTerm, filterSpecialty, filterStatus, date, month, activeReport, sortConfig, printOverrides]);

    // --- 3. Statistics ---
    const stats = useMemo(() => {
        if (activeReport === 'monthly' || activeReport === 'absence') return { bySpecialty: {} }; // لا حاجة للإحصاء هنا

        const bySpecialty: any = {};
        
        processedData.forEach((d: any) => {
            if (!bySpecialty[d.specialty]) {
                bySpecialty[d.specialty] = { 
                    total: 0, present: 0, absent: 0, leave: 0, partTimeOff: 0, evening: 0 
                };
            }
            
            const s = bySpecialty[d.specialty];
            s.total++;

            if (d.statsStatus === 'متواجد') s.present++;
            else if (d.statsStatus === 'غير متواجد' || d.statsStatus === 'غياب') s.absent++;
            else if (d.statsStatus === 'إجازة') s.leave++;
            else if (d.statsStatus === 'جزء وقت') s.partTimeOff++;
            else if (d.statsStatus === 'مسائي' || d.statsStatus === 'مبيت') s.evening++;
        });

        return { bySpecialty };
    }, [processedData, activeReport]);

    // --- Mutations ---
    const manualEntryMutation = useMutation({
        mutationFn: async (data: typeof manualData) => {
            if (!data.employee_id || !data.date || !data.timeIn) throw new Error("يرجى ملء البيانات");
            const timesString = [data.timeIn, data.timeOut].filter(Boolean).join(' ');
            const payload = {
                employee_id: data.employee_id, date: data.date, times: timesString,
                status: 'حضور', responsible: data.responsible, is_manual: true
            };
            const { error } = await supabase.from('attendance').upsert(payload, { onConflict: 'employee_id,date' });
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم إضافة البصمة');
            setShowManualModal(false);
            setManualData({ ...manualData, employee_id: '', timeIn: '', timeOut: '', responsible: '' });
            queryClient.invalidateQueries({ queryKey: ['report_attendance'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    const requestMutation = useMutation({
        mutationFn: async (data: typeof requestData) => {
            const payload = { 
                employee_id: data.employee_id, start_date: data.start_date, end_date: data.end_date,
                status: 'مقبول', type: data.request_type, notes: data.reason || '' 
            };
            const { error } = await supabase.from('leave_requests').insert([payload]);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم إضافة الطلب');
            setShowRequestModal(false);
            queryClient.invalidateQueries({ queryKey: ['report_leaves'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    const handleQuickAction = (action: 'attendance' | 'request' | 'evening' | 'overnight' | 'absence', empId: string) => {
        if (action === 'attendance') {
            setManualData(prev => ({ ...prev, employee_id: empId, date: date }));
            setShowManualModal(true);
        } else if (action === 'request') {
            setRequestData(prev => ({ ...prev, employee_id: empId, start_date: date, end_date: date, reason: '' }));
            setShowRequestModal(true);
        } else if (action === 'evening') {
            setPrintOverrides(prev => ({ ...prev, [empId]: 'مسائي' }));
            toast('تم التعيين: مسائي', { icon: '🌙' });
        } else if (action === 'overnight') {
            setPrintOverrides(prev => ({ ...prev, [empId]: 'مبيت' }));
            toast('تم التعيين: مبيت', { icon: '🛌' });
        } else if (action === 'absence') {
            // ✅ إضافة خيار غياب للطباعة فقط
            setPrintOverrides(prev => ({ ...prev, [empId]: 'غياب' }));
            toast('تم التعيين: غياب (للطباعة)', { icon: '❌' });
        }
    };

    const handlePrint = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: `Report_${activeReport}_${date}`,
    });

    const handleExportExcel = () => {
        // ... (Export Logic same as before)
    };

    const toggleSort = (key: 'name' | 'specialty') => {
        setSortConfig(curr => ({ key, direction: curr.key === key && curr.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const halfIndex = Math.ceil(processedData.length / 2);
    const rightColumnData = processedData.slice(0, halfIndex);
    const leftColumnData = processedData.slice(halfIndex);

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            {/* --- Controls Bar (No Print) --- */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border flex flex-col xl:flex-row gap-4 justify-between items-center no-print">
                <div className="flex bg-gray-100 p-1.5 rounded-xl shadow-inner overflow-x-auto max-w-full gap-1">
                    {[{id: 'daily', label: 'يومي'}, {id: 'monthly', label: 'شهري'}, {id: 'force', label: 'قوة'}, {id: 'absence', label: 'غياب'}, {id: 'specialties', label: 'إحصاء'}].map(r => (
                        <button key={r.id} onClick={() => setActiveReport(r.id as ReportType)} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeReport === r.id ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>{r.label}</button>
                    ))}
                </div>
                <div className="flex gap-2 items-center">
                    {(activeReport === 'monthly' || activeReport === 'absence') ? (
                        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="bg-gray-50 border px-3 py-2 rounded-xl text-sm font-bold outline-none"/>
                    ) : (
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-gray-50 border px-3 py-2 rounded-xl text-sm font-bold outline-none"/>
                    )}
                    <button onClick={() => { refetchAtt(); queryClient.invalidateQueries({queryKey: ['report_leaves']}); toast.success('تم التحديث'); }} disabled={isRefetching} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100"><RefreshCw className={`w-5 h-5 ${isRefetching ? 'animate-spin' : ''}`}/></button>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowManualModal(true)} className="bg-indigo-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-indigo-700"><PlusCircle className="w-4 h-4"/> يدوي</button>
                    <button onClick={handlePrint} className="bg-gray-800 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-gray-900"><Printer className="w-4 h-4"/> طباعة</button>
                </div>
            </div>

            {/* --- Filters (No Print) --- */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border shadow-sm no-print">
                <div className="relative md:col-span-2">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"/>
                    <input placeholder="بحث..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pr-9 pl-4 py-2 rounded-xl border bg-gray-50 outline-none text-sm"/>
                </div>
                <select value={filterSpecialty} onChange={e => setFilterSpecialty(e.target.value)} className="p-2 rounded-xl border bg-gray-50 outline-none text-sm font-bold">
                    <option value="all">كل التخصصات</option>
                    {Array.from(new Set(employees.map(e => e.specialty))).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="flex gap-2">
                    <button onClick={() => toggleSort('name')} className={`flex-1 flex items-center justify-center gap-1 rounded-xl border text-xs font-bold ${sortConfig.key === 'name' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50'}`}>الاسم <ArrowUpDown className="w-3 h-3"/></button>
                    <button onClick={() => toggleSort('specialty')} className={`flex-1 flex items-center justify-center gap-1 rounded-xl border text-xs font-bold ${sortConfig.key === 'specialty' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50'}`}>التخصص <ArrowUpDown className="w-3 h-3"/></button>
                </div>
            </div>

            {/* --- Printable Report Area --- */}
            <div ref={componentRef} className="bg-white p-4 rounded-[30px] shadow-sm min-h-[800px] print:p-2 print:shadow-none print:w-full" dir="rtl">
                
                {/* Print Header */}
                <div className="hidden print:block text-center border-b border-black pb-1 mb-2">
                    <p className="text-[12px] font-bold font-mono text-black leading-tight">
                        إدارة شمال الجيزة - مركز غرب المطار - {
                            activeReport === 'daily' ? 'تقرير التواجد اليومي' : 
                            activeReport === 'monthly' ? `تقرير الحضور الشهري (${month})` :
                            activeReport === 'force' ? 'بيان القوة الفعلية' : 
                            activeReport === 'absence' ? `بيان الغياب (${month})` : 'إحصاء التخصصات'
                        } 
                        {activeReport !== 'monthly' && activeReport !== 'absence' && ` - التاريخ: ${new Date(date).toLocaleDateString('ar-EG')}`}
                    </p>
                </div>

                {/* 1. Daily Report */}
                {activeReport === 'daily' && (
                    <div className="w-full">
                        <div className="block print:flex print:flex-row print:gap-1">
                            <div className="w-full print:w-1/2">
                                <DailyTable data={rightColumnData} onQuickAction={handleQuickAction} />
                            </div>
                            <div className="w-px bg-black hidden print:block mx-1"></div>
                            <div className="w-full print:w-1/2 mt-4 print:mt-0">
                                <DailyTable data={leftColumnData} startIndex={halfIndex} onQuickAction={handleQuickAction} />
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Monthly Report (Updated) */}
                {activeReport === 'monthly' && (
                    <table className="w-full text-sm text-right border-collapse">
                        <thead className="bg-gray-100 font-bold border-b border-black">
                            <tr>
                                <th className="p-1 border border-gray-400">م</th>
                                <th className="p-1 border border-gray-400">الاسم</th>
                                <th className="p-1 border border-gray-400">الكود</th>
                                <th className="p-1 border border-gray-400">التخصص</th>
                                <th className="p-1 border border-gray-400 text-center">أيام الحضور</th>
                                <th className="p-1 border border-gray-400 text-center">الإجازات</th>
                                <th className="p-1 border border-gray-400 text-center">عدد الغياب</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedData.map((row: any, idx: number) => (
                                <tr key={row.id} className="border-b border-gray-300">
                                    <td className="p-1 border border-gray-300 text-center">{idx + 1}</td>
                                    <td className="p-1 border border-gray-300 font-bold">{row.name}</td>
                                    <td className="p-1 border border-gray-300 font-mono text-center">{row.employee_id}</td>
                                    <td className="p-1 border border-gray-300">{row.specialty}</td>
                                    <td className="p-1 border border-gray-300 text-center">{row.daysPresent}</td>
                                    <td className="p-1 border border-gray-300 text-center">{row.daysLeaves}</td>
                                    <td className="p-1 border border-gray-300 text-center text-red-600 font-bold">{row.absenceCount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* Other Reports */}
                {activeReport === 'force' && ( <ForceTable data={processedData} /> )}
                {activeReport === 'absence' && ( <AbsenceTable data={processedData} /> )}
                {activeReport === 'specialties' && ( <SpecialtiesTable stats={stats} /> )}
            </div>

            {/* Modals are kept the same... (تم اختصارها هنا للتركيز على التعديلات المطلوبة) */}
            {showManualModal && <ManualModal show={showManualModal} onClose={()=>setShowManualModal(false)} onSave={manualEntryMutation.mutate} data={manualData} setData={setManualData} employees={employees} isLoading={manualEntryMutation.isPending}/>}
            {showRequestModal && <RequestModal show={showRequestModal} onClose={()=>setShowRequestModal(false)} onSave={requestMutation.mutate} data={requestData} setData={setRequestData} employees={employees} isLoading={requestMutation.isPending}/>}
        </div>
    );
}

// --- Helper Components ---
const DailyTable = ({ data, startIndex = 0, onQuickAction }: { data: any[], startIndex?: number, onQuickAction: any }) => {
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    return (
        <table className="w-full text-[10px] print:text-[9px] text-right border-collapse relative">
            <thead className="bg-gray-100 border-b border-black font-bold">
                <tr>
                    <th className="p-0.5 border border-gray-400 w-6 text-center">م</th>
                    <th className="p-0.5 border border-gray-400 w-10 text-center">كود</th>
                    <th className="p-0.5 border border-gray-400">الاسم</th>
                    <th className="p-0.5 border border-gray-400 w-16">التخصص</th>
                    <th className="p-0.5 border border-gray-400 w-12 text-center">حضور</th>
                    <th className="p-0.5 border border-gray-400 w-12 text-center">انصراف</th>
                    {/* ✅ إخفاء العمود بالكامل في الطباعة */}
                    <th className="w-6 print:hidden"></th>
                </tr>
            </thead>
            <tbody>
                {data.map((row, idx) => (
                    <tr key={row.id} className="border-b border-gray-300 relative">
                        <td className="p-0.5 border border-gray-300 text-center">{startIndex + idx + 1}</td>
                        <td className="p-0.5 border border-gray-300 text-center font-mono">{row.employee_id}</td>
                        <td className="p-0.5 border border-gray-300 font-bold truncate max-w-[110px]">{row.name}</td>
                        <td className="p-0.5 border border-gray-300 truncate max-w-[70px]">{row.specialty}</td>
                        <td className="p-0.5 border border-gray-300 text-center font-bold">{row.displayIn}</td>
                        <td className="p-0.5 border border-gray-300 text-center font-mono">{row.displayOut}</td>
                        <td className="p-0 text-center print:hidden relative">
                            {row.statsStatus === 'غير متواجد' && (
                                <>
                                    <button onClick={() => setOpenMenuId(openMenuId === row.id ? null : row.id)} className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-indigo-600"><PlusCircle className="w-4 h-4"/></button>
                                    {openMenuId === row.id && (
                                        <div className="absolute left-0 top-6 w-40 bg-white shadow-xl rounded-xl border z-50 overflow-hidden animate-in zoom-in-95">
                                            <button onClick={() => { onQuickAction('attendance', row.employee_id); setOpenMenuId(null); }} className="w-full text-right px-4 py-2 hover:bg-gray-50 text-xs font-bold flex items-center gap-2 text-indigo-700"><Clock className="w-3 h-3"/> بصمة يدوية</button>
                                            <button onClick={() => { onQuickAction('request', row.employee_id); setOpenMenuId(null); }} className="w-full text-right px-4 py-2 hover:bg-gray-50 text-xs font-bold flex items-center gap-2 text-orange-700 border-t"><FilePlus className="w-3 h-3"/> إضافة طلب</button>
                                            <button onClick={() => { onQuickAction('evening', row.employee_id); setOpenMenuId(null); }} className="w-full text-right px-4 py-2 hover:bg-gray-50 text-xs font-bold flex items-center gap-2 text-purple-700 border-t"><Moon className="w-3 h-3"/> مسائي</button>
                                            <button onClick={() => { onQuickAction('overnight', row.employee_id); setOpenMenuId(null); }} className="w-full text-right px-4 py-2 hover:bg-gray-50 text-xs font-bold flex items-center gap-2 text-blue-700 border-t"><Sun className="w-3 h-3"/> مبيت</button>
                                            {/* ✅ الخيار الجديد: غياب للطباعة */}
                                            <button onClick={() => { onQuickAction('absence', row.employee_id); setOpenMenuId(null); }} className="w-full text-right px-4 py-2 hover:bg-gray-50 text-xs font-bold flex items-center gap-2 text-red-700 border-t"><XCircle className="w-3 h-3"/> غياب (طباعة)</button>
                                            <div className="bg-gray-50 p-1 text-center border-t"><button onClick={() => setOpenMenuId(null)} className="text-[9px] text-gray-400">إغلاق</button></div>
                                        </div>
                                    )}
                                    {openMenuId === row.id && <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>}
                                </>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

// --- Force Table (Updated Header) ---
const ForceTable = ({data}: {data:any[]}) => (
    <table className="w-full text-sm text-right border-collapse">
        <thead className="bg-gray-100 font-bold border-b border-black">
            <tr>
                <th className="p-1 border border-gray-400 w-8 text-center">م</th>
                <th className="p-1 border border-gray-400 w-16 text-center">الكود</th>
                <th className="p-1 border border-gray-400">الاسم</th>
                <th className="p-1 border border-gray-400 w-24">الوظيفة</th>
                <th className="p-1 border border-gray-400 w-28 text-center">الرقم القومي</th>
                <th className="p-1 border border-gray-400 w-24 text-center">التليفون</th>
                <th className="p-1 border border-gray-400 w-32">المهام الادارية</th>
            </tr>
        </thead>
        <tbody>
            {data.map((emp, idx) => (
                <tr key={emp.id} className="border-b border-gray-300">
                    <td className="p-1 border border-gray-300 text-center">{idx+1}</td>
                    <td className="p-1 border border-gray-300 text-center font-mono">{emp.employee_id}</td>
                    <td className="p-1 border border-gray-300 font-bold">{emp.name}</td>
                    <td className="p-1 border border-gray-300 text-xs">{emp.specialty}</td>
                    <td className="p-1 border border-gray-300 text-center font-mono text-xs">{emp.national_id}</td>
                    <td className="p-1 border border-gray-300 text-center font-mono text-xs">{emp.phone}</td>
                    <td className="p-1 border border-gray-300 text-xs">{emp.admin_tasks}</td>
                </tr>
            ))}
        </tbody>
    </table>
);

// --- Absence Table (Updated) ---
const AbsenceTable = ({data}: {data:any[]}) => (
    <table className="w-full text-sm text-right border-collapse">
        <thead className="bg-red-50 font-bold border-b border-black text-red-900">
            <tr>
                <th className="p-1 border border-gray-400">كود الموظف</th>
                <th className="p-1 border border-gray-400">اسم الموظف</th>
                <th className="p-1 border border-gray-400 text-center">عدد الغياب</th>
                <th className="p-1 border border-gray-400">تواريخ أيام الغياب</th>
            </tr>
        </thead>
        <tbody>
            {data.filter(d => d.absenceCount > 0).map(emp => (
                <tr key={emp.id} className="border-b border-gray-300">
                    <td className="p-1 border border-gray-300 text-center font-mono">{emp.employee_id}</td>
                    <td className="p-1 border border-gray-300 font-bold">{emp.name}</td>
                    <td className="p-1 border border-gray-300 text-center font-bold text-red-600">{emp.absenceCount}</td>
                    <td className="p-1 border border-gray-300 text-xs font-mono">{emp.absenceDates}</td>
                </tr>
            ))}
        </tbody>
    </table>
);

// --- Specialties Table (Updated) ---
const SpecialtiesTable = ({stats}: {stats:any}) => (
    <table className="w-full text-sm text-right border-collapse max-w-3xl mx-auto">
        <thead className="bg-gray-800 text-white font-bold">
            <tr>
                <th className="p-1 border border-gray-600">التخصص</th>
                <th className="p-1 border border-gray-600 text-center">اجمالى</th>
                <th className="p-1 border border-gray-600 text-center">متواجد</th>
                <th className="p-1 border border-gray-600 text-center">غير متواجد</th>
                <th className="p-1 border border-gray-600 text-center">اجازات</th>
                <th className="p-1 border border-gray-600 text-center">مسائي</th>
                <th className="p-1 border border-gray-600 text-center">غياب</th>
                <th className="p-1 border border-gray-600 text-center">جزء وقت</th>
                <th className="p-1 border border-gray-600 text-center">نسبة الحضور</th>
                <th className="p-1 border border-gray-600 text-center">نسبة الاجازات</th>
            </tr>
        </thead>
        <tbody>
            {Object.entries(stats.bySpecialty).map(([spec, s]: any) => {
                const total = s.total || 1;
                const attendanceRate = Math.round((s.present / total) * 100);
                const leaveRate = Math.round((s.leave / total) * 100);
                return (
                    <tr key={spec} className="border-b border-gray-300">
                        <td className="p-1 border border-gray-300 font-bold bg-gray-50">{spec}</td>
                        <td className="p-1 border border-gray-300 text-center font-bold">{s.total}</td>
                        <td className="p-1 border border-gray-300 text-center text-green-700 font-bold">{s.present}</td>
                        <td className="p-1 border border-gray-300 text-center text-red-600 font-bold">{s.absent + s.partTimeOff}</td>
                        <td className="p-1 border border-gray-300 text-center text-orange-600">{s.leave}</td>
                        <td className="p-1 border border-gray-300 text-center text-purple-600">{s.evening}</td>
                        <td className="p-1 border border-gray-300 text-center text-red-800">{s.absent}</td>
                        <td className="p-1 border border-gray-300 text-center text-gray-500">{s.partTimeOff}</td>
                        <td className="p-1 border border-gray-300 text-center font-mono">{attendanceRate}%</td>
                        <td className="p-1 border border-gray-300 text-center font-mono">{leaveRate}%</td>
                    </tr>
                );
            })}
        </tbody>
    </table>
);

// --- Modals Components (Simple Wrapper) ---
const ManualModal = ({show, onClose, onSave, data, setData, employees, isLoading}: any) => {
    if(!show) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6">
                <div className="flex justify-between items-center border-b pb-4 mb-4">
                    <h3 className="text-lg font-black text-gray-800">إضافة بصمة يدوية</h3>
                    <button onClick={onClose}><X className="w-5 h-5"/></button>
                </div>
                <div className="space-y-4">
                    <select value={data.employee_id} onChange={e=>setData({...data, employee_id:e.target.value})} className="w-full p-3 border rounded-xl"><option value="">اختر الموظف...</option>{employees.map((e:any)=><option key={e.id} value={e.employee_id}>{e.name}</option>)}</select>
                    <input type="date" value={data.date} onChange={e=>setData({...data, date:e.target.value})} className="w-full p-3 border rounded-xl"/>
                    <div className="grid grid-cols-2 gap-2"><input type="time" value={data.timeIn} onChange={e=>setData({...data, timeIn:e.target.value})} className="w-full p-3 border rounded-xl"/><input type="time" value={data.timeOut} onChange={e=>setData({...data, timeOut:e.target.value})} className="w-full p-3 border rounded-xl"/></div>
                    <input placeholder="المسؤول" value={data.responsible} onChange={e=>setData({...data, responsible:e.target.value})} className="w-full p-3 border rounded-xl"/>
                    <button onClick={()=>onSave(data)} disabled={isLoading} className="w-full bg-indigo-600 text-white p-3 rounded-xl font-bold">{isLoading ? 'جاري...' : 'حفظ'}</button>
                </div>
            </div>
        </div>
    );
};

const RequestModal = ({show, onClose, onSave, data, setData, employees, isLoading}: any) => {
    if(!show) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6">
                <div className="flex justify-between items-center border-b pb-4 mb-4">
                    <h3 className="text-lg font-black text-gray-800">إضافة طلب سريع</h3>
                    <button onClick={onClose}><X className="w-5 h-5"/></button>
                </div>
                <div className="space-y-4">
                    <select disabled value={data.employee_id} className="w-full p-3 border rounded-xl bg-gray-100"><option>{employees.find((e:any)=>e.employee_id===data.employee_id)?.name}</option></select>
                    <select value={data.request_type} onChange={e=>setData({...data, request_type:e.target.value})} className="w-full p-3 border rounded-xl">{REQUEST_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select>
                    <input placeholder="ملاحظات..." value={data.reason} onChange={e=>setData({...data, reason:e.target.value})} className="w-full p-3 border rounded-xl"/>
                    <button onClick={()=>onSave(data)} disabled={isLoading} className="w-full bg-orange-600 text-white p-3 rounded-xl font-bold">{isLoading ? 'جاري...' : 'حفظ'}</button>
                </div>
            </div>
        </div>
    );
};
