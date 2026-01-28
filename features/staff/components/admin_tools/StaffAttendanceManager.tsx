import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../supabaseClient';
import { useReactToPrint } from 'react-to-print';
import { 
    Search, Printer, Upload, Calendar, Loader2, RefreshCw, 
    ArrowUpDown, PlusCircle, Save, X, UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AttendanceRecord, Employee, LeaveRequest } from '../../../../types';

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

    // --- Manual Entry State ---
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualData, setManualData] = useState({
        employee_id: '',
        date: new Date().toISOString().split('T')[0],
        timeIn: '',
        timeOut: '',
        responsible: '' // اسم المسؤول (للعرض أو التسجيل إذا وجد حقل له مستقبلاً)
    });

    // --- 1. Queries (جلب البيانات) ---
    const { data: employees = [] } = useQuery({
        queryKey: ['staff_manager_employees'],
        queryFn: async () => {
            const { data } = await supabase.from('employees').select('*');
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

    const { data: leaves = [] } = useQuery({
        queryKey: ['staff_manager_leaves', date],
        queryFn: async () => {
            const { data } = await supabase.from('leave_requests')
                .select('*')
                .eq('status', 'approved') 
                .lte('start_date', date)
                .gte('end_date', date);
            return data as LeaveRequest[] || [];
        }
    });

    // --- 2. Data Processing ---
    const processedData = useMemo(() => {
        let data = employees.map(emp => {
            const attRecord = attendance.find(a => a.employee_id === emp.employee_id);
            const leaveRecord = leaves.find(l => l.employee_id === emp.employee_id);
            
            let displayIn = '-';  
            let displayOut = '-'; 
            let statsStatus = 'غير متواجد'; 

            // 1. بصمة
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
                        
                        if (diff >= 60) {
                            displayOut = lastTime;
                        } else {
                            displayOut = ''; 
                        }
                    } else {
                        displayOut = ''; 
                    }
                }
            }

            // 2. حالات أخرى
            if (!hasPunch) {
                const isPartTimeContract = emp.part_time_start_date && emp.part_time_end_date && 
                                           date >= emp.part_time_start_date && date <= emp.part_time_end_date;
                
                if (isPartTimeContract) {
                    const dayName = new Date(date).toLocaleDateString('ar-EG', { weekday: 'long' });
                    const empWorkDays = typeof emp.work_days === 'string' ? JSON.parse(emp.work_days) : emp.work_days || [];
                    
                    if (empWorkDays.includes(dayName)) {
                        statsStatus = 'غير متواجد';
                        displayIn = '-'; 
                    } else {
                        statsStatus = 'جزء وقت';
                        displayIn = 'جزء وقت';
                        displayOut = '';
                    }
                } 
                else if (leaveRecord) {
                    statsStatus = 'إجازة';
                    displayIn = leaveRecord.request_type; 
                    displayOut = '';
                }
            }

            return { ...emp, displayIn, displayOut, statsStatus };
        });

        // Filter
        data = data.filter(item => {
            const search = searchTerm.toLowerCase();
            const matchesSearch = item.name.toLowerCase().includes(search) || item.employee_id.includes(search);
            const matchesSpec = filterSpecialty === 'all' || item.specialty === filterSpecialty;
            let matchesStatus = true;
            if (filterStatus === 'active_only') matchesStatus = item.status === 'نشط';
            else if (filterStatus !== 'all') matchesStatus = item.status === filterStatus;
            return matchesSearch && matchesSpec && matchesStatus;
        });

        // Sort
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
        const present = processedData.filter(d => d.statsStatus === 'متواجد').length;
        const absent = processedData.filter(d => d.statsStatus === 'غير متواجد').length;
        const partTime = processedData.filter(d => d.statsStatus === 'جزء وقت').length;
        const leave = processedData.filter(d => d.statsStatus === 'إجازة').length;
        
        const effectiveTotal = total - leave - partTime;
        const percent = effectiveTotal > 0 ? Math.round((present / effectiveTotal) * 100) : 0;

        const bySpecialty: any = {};
        processedData.forEach(d => {
            if (!bySpecialty[d.specialty]) bySpecialty[d.specialty] = { total: 0, present: 0, absent: 0, leave: 0 };
            bySpecialty[d.specialty].total++;
            if (d.statsStatus === 'متواجد') bySpecialty[d.specialty].present++;
            else if (d.statsStatus === 'غير متواجد') bySpecialty[d.specialty].absent++;
            else bySpecialty[d.specialty].leave++;
        });

        return { total, present, absent, leave, partTime, percent, bySpecialty };
    }, [processedData]);

    // --- 4. File Upload (Raw) ---
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
                const text = event.target?.result as string;
                if (!text) throw new Error("الملف فارغ");
                const lines = text.split(/\r\n|\n/);
                const groupedData: any = {};
                lines.forEach(line => {
                    const cleanLine = line.trim();
                    if (!cleanLine) return;
                    const parts = cleanLine.split(/\s+/);
                    if (parts.length < 3) return;
                    const empId = parts[0];
                    const rawDate = parts[1]; 
                    const rawTime = parts[2];
                    let formattedDate = rawDate;
                    if (rawDate.includes('/')) {
                        const [d, m, y] = rawDate.split('/');
                        const fullYear = y.length === 2 ? `20${y}` : y;
                        formattedDate = `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                    }
                    const key = `${empId}_${formattedDate}`;
                    if (!groupedData[key]) {
                        groupedData[key] = { id: empId, date: formattedDate, times: [] };
                    }
                    if (!groupedData[key].times.includes(rawTime)) {
                        groupedData[key].times.push(rawTime);
                    }
                });
                const payload = Object.values(groupedData).map((g:any) => ({
                    employee_id: g.id, date: g.date, times: g.times.sort().join(' '), status: 'حضور'
                }));
                if (payload.length > 0) rawMutation.mutate(payload);
                else toast.error("لم يتم العثور على بيانات صالحة");
            } catch (err: any) {
                toast.error("خطأ في قراءة الملف: " + err.message);
            } finally {
                setIsProcessing(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    // --- 5. Manual Entry Mutation ---
    const manualEntryMutation = useMutation({
        mutationFn: async (data: typeof manualData) => {
            if (!data.employee_id || !data.date || !data.timeIn) {
                throw new Error("يرجى ملء البيانات الأساسية (الموظف، التاريخ، وقت الحضور)");
            }

            // دمج الأوقات في نص واحد (text) ليناسب قاعدة البيانات
            const timesArray = [data.timeIn];
            if (data.timeOut) timesArray.push(data.timeOut);
            const timesString = timesArray.join(' ');

            const payload = {
                employee_id: data.employee_id,
                date: data.date,
                times: timesString,
                status: 'حضور'
            };

            const { error } = await supabase.from('attendance').upsert(payload, { onConflict: 'employee_id,date' });
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم إضافة البصمة بنجاح');
            setShowManualModal(false);
            setManualData({ ...manualData, employee_id: '', timeIn: '', timeOut: '' });
            queryClient.invalidateQueries({ queryKey: ['staff_manager_attendance'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    const handlePrint = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: `Report_${date}`,
    });

    const halfIndex = Math.ceil(processedData.length / 2);
    const rightColumnData = processedData.slice(0, halfIndex);
    const leftColumnData = processedData.slice(halfIndex);

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

                <div className="flex bg-gray-100 p-1 rounded-xl gap-1 overflow-x-auto">
                    {[{id: 'daily', label: 'التمام اليومي'}, {id: 'force', label: 'القوة الفعلية'}, {id: 'absence', label: 'الغياب'}, {id: 'specialties', label: 'إحصاء التخصصات'}].map(r => (
                        <button key={r.id} onClick={() => setActiveReport(r.id as ReportType)} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeReport === r.id ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>{r.label}</button>
                    ))}
                </div>

                <div className="flex gap-2">
                    {/* ✅ زر إضافة يدوية */}
                    <button onClick={() => setShowManualModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                        <PlusCircle className="w-4 h-4"/> إضافة يدوية
                    </button>

                    <input type="file" ref={fileInputRef} onChange={handleRawFileChange} className="hidden" accept=".dat,.txt" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="bg-orange-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-orange-700 shadow-lg shadow-orange-200">
                        {isProcessing ? <Loader2 className="animate-spin w-4 h-4"/> : <Upload className="w-4 h-4"/>} رفع ملف
                    </button>
                    <button onClick={handlePrint} className="bg-gray-800 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-900 shadow-lg shadow-gray-400">
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
            <div ref={componentRef} className="bg-white p-4 rounded-[30px] shadow-sm min-h-[800px] print:p-2 print:shadow-none print:w-full" dir="rtl">
                <div className="hidden print:block text-center border-b border-black pb-1 mb-2">
                    <p className="text-[12px] font-bold font-mono text-black leading-tight">
                        مركز غرب المطار - {activeReport === 'daily' ? 'تقرير التواجد اليومي' : activeReport === 'force' ? 'بيان القوة الفعلية' : activeReport === 'absence' ? 'بيان الغياب' : 'إحصاء التخصصات'} - التاريخ: {new Date(date).toLocaleDateString('ar-EG')} - التوقيت: {new Date().toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}
                    </p>
                </div>

                {activeReport === 'daily' && (
                    <div className="w-full">
                        <div className="block print:flex print:flex-row print:gap-1">
                            <div className="w-full print:w-1/2">
                                <DailyTable data={rightColumnData} />
                            </div>
                            <div className="w-px bg-black hidden print:block mx-1"></div>
                            <div className="w-full print:w-1/2 mt-4 print:mt-0">
                                <DailyTable data={leftColumnData} startIndex={halfIndex} />
                            </div>
                        </div>
                        <div className="mt-4 pt-2 border-t border-black text-[10px] print:text-[9px] font-bold">
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

                {activeReport === 'force' && (
                    <table className="w-full text-sm text-right border-collapse">
                        <thead className="bg-gray-100 font-bold border-b border-black">
                            <tr>
                                <th className="p-1 border border-gray-400">م</th>
                                <th className="p-1 border border-gray-400">الكود</th>
                                <th className="p-1 border border-gray-400">الاسم</th>
                                <th className="p-1 border border-gray-400">التخصص</th>
                                <th className="p-1 border border-gray-400">الرقم القومي</th>
                                <th className="p-1 border border-gray-400">الهاتف</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedData.map((emp, idx) => (
                                <tr key={emp.id} className="border-b border-gray-300">
                                    <td className="p-1 border border-gray-300 text-center">{idx + 1}</td>
                                    <td className="p-1 border border-gray-300 text-center font-mono">{emp.employee_id}</td>
                                    <td className="p-1 border border-gray-300 font-bold">{emp.name}</td>
                                    <td className="p-1 border border-gray-300">{emp.specialty}</td>
                                    <td className="p-1 border border-gray-300 text-center font-mono">{emp.national_id}</td>
                                    <td className="p-1 border border-gray-300 text-center">{emp.phone}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {activeReport === 'absence' && (
                    <table className="w-full text-sm text-right border-collapse">
                        <thead className="bg-red-50 font-bold border-b border-black text-red-900">
                            <tr>
                                <th className="p-1 border border-gray-400">الكود</th>
                                <th className="p-1 border border-gray-400">الاسم</th>
                                <th className="p-1 border border-gray-400">التخصص</th>
                                <th className="p-1 border border-gray-400 text-center">الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedData.filter(d => d.statsStatus === 'غير متواجد').map((emp) => (
                                <tr key={emp.id} className="border-b border-gray-300">
                                    <td className="p-1 border border-gray-300 text-center font-mono">{emp.employee_id}</td>
                                    <td className="p-1 border border-gray-300 font-bold">{emp.name}</td>
                                    <td className="p-1 border border-gray-300">{emp.specialty}</td>
                                    <td className="p-1 border border-gray-300 text-center font-bold text-red-600">غير متواجد</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {activeReport === 'specialties' && (
                    <table className="w-full text-sm text-right border-collapse max-w-2xl mx-auto">
                        <thead className="bg-gray-800 text-white font-bold">
                            <tr>
                                <th className="p-1 border border-gray-600">التخصص</th>
                                <th className="p-1 border border-gray-600 text-center">القوة</th>
                                <th className="p-1 border border-gray-600 text-center">متواجد</th>
                                <th className="p-1 border border-gray-600 text-center">غير متواجد</th>
                                <th className="p-1 border border-gray-600 text-center">إجازات</th>
                                <th className="p-1 border border-gray-600 text-center">النسبة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(stats.bySpecialty).map(([spec, s]: any) => (
                                <tr key={spec} className="border-b border-gray-300">
                                    <td className="p-1 border border-gray-300 font-bold bg-gray-50">{spec}</td>
                                    <td className="p-1 border border-gray-300 text-center font-bold">{s.total}</td>
                                    <td className="p-1 border border-gray-300 text-center text-green-700 font-bold">{s.present}</td>
                                    <td className="p-1 border border-gray-300 text-center text-red-600 font-bold">{s.absent}</td>
                                    <td className="p-1 border border-gray-300 text-center text-orange-600">{s.leave}</td>
                                    <td className="p-1 border border-gray-300 text-center font-mono">
                                        {s.total > 0 ? Math.round((s.present / (s.total - s.leave - s.partTime)) * 100) : 0}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* --- Modal إضافة بصمة يدوية --- */}
            {showManualModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 relative animate-in zoom-in-95">
                        <div className="flex justify-between items-center border-b pb-4 mb-4">
                            <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                                <PlusCircle className="w-5 h-5 text-indigo-600"/> إضافة بصمة يدوية
                            </h3>
                            <button onClick={() => setShowManualModal(false)} className="p-2 bg-gray-100 rounded-full hover:bg-red-100"><X className="w-5 h-5"/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">الموظف</label>
                                <select 
                                    value={manualData.employee_id} 
                                    onChange={e => setManualData({...manualData, employee_id: e.target.value})}
                                    className="w-full p-3 border rounded-xl bg-gray-50 font-bold text-gray-800 outline-none"
                                >
                                    <option value="">اختر الموظف...</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.employee_id}>{emp.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">التاريخ</label>
                                <input 
                                    type="date" 
                                    value={manualData.date} 
                                    onChange={e => setManualData({...manualData, date: e.target.value})}
                                    className="w-full p-3 border rounded-xl bg-gray-50 outline-none font-mono"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">وقت الحضور</label>
                                    <input 
                                        type="time" 
                                        value={manualData.timeIn} 
                                        onChange={e => setManualData({...manualData, timeIn: e.target.value})}
                                        className="w-full p-3 border rounded-xl bg-gray-50 outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">وقت الانصراف (اختياري)</label>
                                    <input 
                                        type="time" 
                                        value={manualData.timeOut} 
                                        onChange={e => setManualData({...manualData, timeOut: e.target.value})}
                                        className="w-full p-3 border rounded-xl bg-gray-50 outline-none font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">المسؤول عن الإدخال</label>
                                <div className="relative">
                                    <UserCheck className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"/>
                                    <input 
                                        type="text" 
                                        placeholder="اسم المدخل..." 
                                        value={manualData.responsible} 
                                        onChange={e => setManualData({...manualData, responsible: e.target.value})}
                                        className="w-full pr-10 pl-4 py-3 border rounded-xl bg-gray-50 outline-none"
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={() => manualEntryMutation.mutate(manualData)} 
                                disabled={manualEntryMutation.isPending}
                                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg flex items-center justify-center gap-2 mt-4"
                            >
                                {manualEntryMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} حفظ البصمة
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Table Component (Compact Rows for Printing) ---
const DailyTable = ({ data, startIndex = 0 }: { data: any[], startIndex?: number }) => {
    return (
        <table className="w-full text-[10px] print:text-[9px] text-right border-collapse">
            <thead className="bg-gray-100 border-b border-black font-bold">
                <tr>
                    <th className="p-0.5 border border-gray-400 w-6 text-center">م</th>
                    <th className="p-0.5 border border-gray-400 w-10 text-center">كود</th>
                    <th className="p-0.5 border border-gray-400">الاسم</th>
                    <th className="p-0.5 border border-gray-400 w-16">التخصص</th>
                    <th className="p-0.5 border border-gray-400 w-12 text-center">حضور</th>
                    <th className="p-0.5 border border-gray-400 w-12 text-center">انصراف</th>
                </tr>
            </thead>
            <tbody>
                {data.map((row, idx) => (
                    <tr key={row.id} className="border-b border-gray-300">
                        <td className="p-0.5 border border-gray-300 text-center">{startIndex + idx + 1}</td>
                        <td className="p-0.5 border border-gray-300 text-center font-mono">{row.employee_id}</td>
                        <td className="p-0.5 border border-gray-300 font-bold truncate max-w-[110px]">{row.name}</td>
                        <td className="p-0.5 border border-gray-300 truncate max-w-[70px]">{row.specialty}</td>
                        <td className="p-0.5 border border-gray-300 text-center font-bold">{row.displayIn}</td>
                        <td className="p-0.5 border border-gray-300 text-center font-mono">{row.displayOut}</td>
                    </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={6} className="p-2 text-center">-</td></tr>}
            </tbody>
        </table>
    );
};
