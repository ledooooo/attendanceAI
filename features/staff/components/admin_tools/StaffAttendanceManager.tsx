import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../supabaseClient';
import { useReactToPrint } from 'react-to-print';
import { 
    Search, Printer, Upload, Calendar, Loader2, RefreshCw, 
    ArrowUpDown, PlusCircle, Save, X, UserCheck, MoreVertical, FilePlus, Clock, Moon, Sun, XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AttendanceRecord, Employee, LeaveRequest } from '../../../../types';

type ReportType = 'daily' | 'force' | 'absence' | 'specialties';

const REQUEST_TYPES = [
    "اجازة عارضة", "اجازة اعتيادية", "اجازة مرضى", "دورة تدريبية", 
    "خط سير", "مأمورية", "بدل راحة", "اذن صباحى", "اذن مسائي", "تأمين صحي"
];

export default function StaffAttendanceManager() {
    const queryClient = useQueryClient();
    const componentRef = useRef(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- State ---
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
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
            const { data, error } = await supabase.from('leave_requests')
                .select('*')
                .eq('status', 'مقبول') 
                .lte('start_date', date) 
                .gte('end_date', date);
            
            if (error) {
                console.error("Error fetching leaves:", error);
                return [];
            }
            return data as LeaveRequest[] || [];
        }
    });

    // --- 2. Data Processing ---
    const processedData = useMemo(() => {
        let data = employees.map(emp => {
            const attRecord = attendance.find(a => a.employee_id === emp.employee_id);
            const leaveRecord = leaves.find(l => String(l.employee_id) === String(emp.employee_id));
            
            let displayIn = '-';  
            let displayOut = '-'; 
            let statsStatus = 'غير متواجد'; 
            let leaveType = ''; // متغير جديد لتخزين نوع الإجازة الفعلي للإحصائيات

            // 1. التحقق من التعديلات اليدوية المؤقتة
            if (printOverrides[emp.employee_id]) {
                displayIn = printOverrides[emp.employee_id];
                displayOut = '';
                // تصنيف الحالة بناءً على النص المدخل
                if (displayIn === 'غياب') statsStatus = 'غياب';
                else if (displayIn === 'مسائي' || displayIn === 'مبيت') statsStatus = displayIn;
                else statsStatus = 'متواجد'; 
            } else {
                // المنطق العادي
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
                        } else {
                            displayOut = ''; 
                        }
                    }
                }

                if (!hasPunch) {
                    if (leaveRecord) {
                        statsStatus = 'إجازة'; // سيتم تفصيلها لاحقاً في الـ stats
                        let typeText = leaveRecord.type || (leaveRecord.notes ? leaveRecord.notes.split('-')[0] : 'إجازة');
                        leaveType = leaveRecord.type || ''; // حفظ النوع الفعلي للإحصائيات
                        displayIn = typeText.replace('اجازة ', '').replace('إجازة ', ''); 
                        displayOut = '';
                    } 
                    else {
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
                    }
                }
            }

            return { ...emp, displayIn, displayOut, statsStatus, leaveType };
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
    }, [employees, attendance, leaves, searchTerm, filterSpecialty, filterStatus, date, sortConfig, printOverrides]);

    // --- 3. Statistics (Updated for detailed leave types) ---
    const stats = useMemo(() => {
        const bySpecialty: any = {};
        
        // عدادات تفصيلية للإجازات والمهام
        let totalNormalLeaves = 0; // عارضة + اعتيادية فقط
        let totalMissions = 0; // مأموريات
        let totalItineraries = 0; // خطوط سير
        let totalOtherLeaves = 0; // باقي أنواع الإجازات (مرضي، تدريب، بدل راحة...)
        
        processedData.forEach(d => {
            if (!bySpecialty[d.specialty]) {
                bySpecialty[d.specialty] = { 
                    total: 0, present: 0, absent: 0, leave: 0, // leave هنا تعني (عارضة + اعتيادي) للجدول
                    evening: 0, markedAbsence: 0, partTimeOff: 0 
                };
            }
            
            const s = bySpecialty[d.specialty];
            s.total++;

            if (d.statsStatus === 'متواجد') {
                s.present++;
            } else if (d.statsStatus === 'مسائي' || d.statsStatus === 'مبيت') {
                s.evening++;
            } else if (d.statsStatus === 'غياب') {
                s.markedAbsence++; // الغياب المحدد يدوياً
            } else if (d.statsStatus === 'غير متواجد') {
                s.absent++; // الغياب التلقائي
            } else if (d.statsStatus === 'إجازة') {
                // تفصيل أنواع الطلبات المقبولة
                const type = d.leaveType || '';
                if (type.includes('اعتيادية') || type.includes('عارضة')) {
                    s.leave++; // إضافة للإجازات المحددة في الجدول حسب التخصص
                    totalNormalLeaves++; // إضافة للإجمالي العام للإجازات
                } else if (type.includes('مأمورية')) {
                    totalMissions++;
                } else if (type.includes('خط سير')) {
                    totalItineraries++;
                } else {
                    totalOtherLeaves++; // أي نوع آخر مثل مرضي، بدل راحة، إلخ
                }
            } else if (d.statsStatus === 'جزء وقت') {
                s.partTimeOff++;
            }
        });

        // Totals for top bar and print summary
        const total = processedData.length;
        const present = processedData.filter(d => d.statsStatus === 'متواجد' || d.statsStatus === 'مسائي' || d.statsStatus === 'مبيت').length;
        // تجميع كل حالات الغياب (تلقائي + يدوي) تحت بند واحد "غياب"
        const absent = processedData.filter(d => d.statsStatus === 'غير متواجد' || d.statsStatus === 'غياب').length;
        const partTime = processedData.filter(d => d.statsStatus === 'جزء وقت').length;
        
        const effectiveTotal = total - partTime; // القوة الفعالة مطروحاً منها من هم خارج أيام عملهم (جزء الوقت)
        // حساب نسبة الحضور (حضور + مأموريات + خطوط سير) من القوة الفعالة
        const percent = effectiveTotal > 0 ? Math.round(((present + totalMissions + totalItineraries) / effectiveTotal) * 100) : 0;

        return { 
            total, present, absent, partTime, percent, bySpecialty,
            totalNormalLeaves, totalMissions, totalItineraries, totalOtherLeaves 
        };
    }, [processedData]);

    // --- Mutations ---
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
            queryClient.invalidateQueries({ queryKey: ['staff_manager_attendance'] });
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
            queryClient.invalidateQueries({ queryKey: ['staff_manager_leaves'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    // --- Actions ---
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
            setPrintOverrides(prev => ({ ...prev, [empId]: 'غياب' }));
            toast('تم التعيين: غياب (للطباعة)', { icon: '❌' });
        }
    };

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
                    if (!groupedData[key]) groupedData[key] = { id: empId, date: formattedDate, times: [] };
                    if (!groupedData[key].times.includes(rawTime)) groupedData[key].times.push(rawTime);
                });
                const payload = Object.values(groupedData).map((g:any) => ({
                    employee_id: g.id, date: g.date, times: g.times.sort().join(' '), status: 'حضور'
                }));
                if (payload.length > 0) rawMutation.mutate(payload);
                else toast.error("لا توجد بيانات");
            } catch (err: any) {
                toast.error("خطأ: " + err.message);
            } finally {
                setIsProcessing(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

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
            {/* Controls */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border flex flex-col xl:flex-row gap-4 justify-between items-center no-print">
                <div className="flex items-center gap-3">
                    <div className="relative bg-gray-50 rounded-xl border flex items-center px-3 py-2">
                        <Calendar className="w-5 h-5 text-gray-500 ml-2"/>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent outline-none font-bold text-gray-700"/>
                    </div>
                    <button onClick={() => { refetchAtt(); queryClient.invalidateQueries({queryKey: ['staff_manager_leaves']}); toast.success('تم التحديث'); }} disabled={isRefetching} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100">
                        <RefreshCw className={`w-5 h-5 ${isRefetching ? 'animate-spin' : ''}`}/>
                    </button>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                    {[{id: 'daily', label: 'التمام اليومي'}, {id: 'force', label: 'القوة الفعلية'}, {id: 'absence', label: 'الغياب'}, {id: 'specialties', label: 'إحصاء التخصصات'}].map(r => (
                        <button key={r.id} onClick={() => setActiveReport(r.id as ReportType)} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeReport === r.id ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>{r.label}</button>
                    ))}
                </div>

                <div className="flex gap-2">
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

            {/* Filters */}
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

            {/* Printable Report */}
            <div ref={componentRef} className="bg-white p-4 rounded-[30px] shadow-sm min-h-[800px] print:p-2 print:shadow-none print:w-full" dir="rtl">
                
                {/* Header for Force Report and Others */}
                <div className="hidden print:block text-center border-b border-black pb-1 mb-2">
                    <p className="text-[12px] font-bold font-mono text-black leading-tight">
                        إدارة شمال الجيزة - مركز غرب المطار - {
                            activeReport === 'daily' ? 'تقرير التواجد اليومي' : 
                            activeReport === 'force' ? 'بيان القوة الفعلية' : 
                            activeReport === 'absence' ? 'بيان الغياب' : 'إحصاء التخصصات'
                        } - تحريراً في ({new Date(date).toLocaleDateString('ar-EG')})
                    </p>
                </div>

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
                        
                        {/* ✅ الشريط السفلي المفصل للطباعة */}
                        <div className="mt-4 pt-2 border-t border-black text-[10px] print:text-[10px] font-bold">
                            <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center md:justify-between mb-2 bg-gray-100 print:bg-transparent border border-gray-300 print:border-black p-1.5 rounded-lg shadow-sm print:shadow-none">
                                <span className="text-gray-800">إجمالي القوة: <span className="text-black">{stats.total}</span></span>
                                <span className="text-green-700">حضور: <span className="text-black">{stats.present}</span></span>
                                <span className="text-orange-600">إجازات (اعتيادي/عارضة): <span className="text-black">{stats.totalNormalLeaves}</span></span>
                                <span className="text-indigo-600">مأموريات: <span className="text-black">{stats.totalMissions}</span></span>
                                <span className="text-teal-600">خطوط سير: <span className="text-black">{stats.totalItineraries}</span></span>
                                {stats.totalOtherLeaves > 0 && <span className="text-purple-600">إجازات أخرى: <span className="text-black">{stats.totalOtherLeaves}</span></span>}
                                <span className="text-red-600">غياب: <span className="text-black">{stats.absent}</span></span>
                                <span className="text-gray-500">جزء وقت: <span className="text-black">{stats.partTime}</span></span>
                                <span className="text-blue-700">نسبة الحضور: <span className="text-black">{stats.percent}%</span></span>
                            </div>
                            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[9px] print:text-[8px]">
                                {Object.entries(stats.bySpecialty).map(([spec, s]: any) => (
                                    <span key={spec} className="print:border-l pl-2 ml-1 border-gray-400">
                                        {spec}: {s.present}/{s.total}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeReport === 'force' && ( <ForceTable data={processedData} /> )}
                {activeReport === 'absence' && ( <AbsenceTable data={processedData} /> )}
                {activeReport === 'specialties' && ( <SpecialtiesTable stats={stats} /> )}
            </div>

            {/* --- Modals (Manual & Request) --- */}
            {showManualModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 relative animate-in zoom-in-95">
                        <div className="flex justify-between items-center border-b pb-4 mb-4">
                            <h3 className="text-lg font-black text-gray-800 flex items-center gap-2"><PlusCircle className="w-5 h-5 text-indigo-600"/> إضافة بصمة</h3>
                            <button onClick={() => setShowManualModal(false)} className="p-2 bg-gray-100 rounded-full hover:bg-red-100"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">الموظف</label>
                                <select value={manualData.employee_id} onChange={e => setManualData({...manualData, employee_id: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 font-bold text-gray-800 outline-none">
                                    <option value="">اختر الموظف...</option>
                                    {employees.map(emp => <option key={emp.id} value={emp.employee_id}>{emp.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">التاريخ</label>
                                <input type="date" value={manualData.date} onChange={e => setManualData({...manualData, date: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none font-mono"/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">وقت الحضور</label>
                                    <input type="time" value={manualData.timeIn} onChange={e => setManualData({...manualData, timeIn: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none font-mono"/>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">وقت الانصراف</label>
                                    <input type="time" value={manualData.timeOut} onChange={e => setManualData({...manualData, timeOut: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none font-mono"/>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">المسؤول</label>
                                <input type="text" placeholder="اسم المدخل..." value={manualData.responsible} onChange={e => setManualData({...manualData, responsible: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none"/>
                            </div>
                            <button onClick={() => manualEntryMutation.mutate(manualData)} disabled={manualEntryMutation.isPending} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg flex items-center justify-center gap-2 mt-4">
                                {manualEntryMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} حفظ البصمة
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showRequestModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 relative animate-in zoom-in-95">
                        <div className="flex justify-between items-center border-b pb-4 mb-4">
                            <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                                <FilePlus className="w-5 h-5 text-orange-600"/> إضافة طلب سريع
                            </h3>
                            <button onClick={() => setShowRequestModal(false)} className="p-2 bg-gray-100 rounded-full hover:bg-red-100"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">الموظف</label>
                                <select value={requestData.employee_id} disabled className="w-full p-3 border rounded-xl bg-gray-100 font-bold text-gray-500 outline-none">
                                    <option value={requestData.employee_id}>{employees.find(e => e.employee_id === requestData.employee_id)?.name}</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">نوع الطلب</label>
                                <select value={requestData.request_type} onChange={e => setRequestData({...requestData, request_type: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 font-bold text-gray-800 outline-none">
                                    {REQUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">ملاحظات إضافية</label>
                                <input value={requestData.reason} onChange={e => setRequestData({...requestData, reason: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 outline-none" placeholder="اختياري..."/>
                            </div>
                            <button onClick={() => requestMutation.mutate(requestData)} disabled={requestMutation.isPending} className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 shadow-lg flex items-center justify-center gap-2 mt-4">
                                {requestMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} حفظ الطلب
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Daily Table (Updated: No Print for Action Column) ---
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

// --- Force Table (Updated Columns) ---
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
                    <td className="p-1 border border-gray-300 text-xs">{emp.admin_tasks || ''}</td>
                </tr>
            ))}
        </tbody>
    </table>
);

// --- Absence Table (Updated Header) ---
const AbsenceTable = ({data}: {data:any[]}) => (
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
            {data.filter(d => d.statsStatus === 'غير متواجد' || d.statsStatus === 'غياب').map(emp => (
                <tr key={emp.id} className="border-b border-gray-300">
                    <td className="p-1 border border-gray-300 text-center">{emp.employee_id}</td>
                    <td className="p-1 border border-gray-300 font-bold">{emp.name}</td>
                    <td className="p-1 border border-gray-300">{emp.specialty}</td>
                    <td className="p-1 border border-gray-300 text-center text-red-600 font-bold">غياب</td>
                </tr>
            ))}
        </tbody>
    </table>
);

// --- Specialties Table (Updated with Grand Total) ---
const SpecialtiesTable = ({ stats }: { stats: any }) => {
    
    // 1. حساب الإجماليات لكل الأعمدة
    const totals = Object.values(stats.bySpecialty || {}).reduce((acc: any, curr: any) => ({
        total: (acc.total || 0) + (curr.total || 0),
        present: (acc.present || 0) + (curr.present || 0),
        absent: (acc.absent || 0) + (curr.absent || 0), // الغياب التلقائي (غير متواجد)
        partTimeOff: (acc.partTimeOff || 0) + (curr.partTimeOff || 0),
        leave: (acc.leave || 0) + (curr.leave || 0),
        evening: (acc.evening || 0) + (curr.evening || 0),
        markedAbsence: (acc.markedAbsence || 0) + (curr.markedAbsence || 0)
    }), { total: 0, present: 0, absent: 0, partTimeOff: 0, leave: 0, evening: 0, markedAbsence: 0 });

    // 2. حساب النسب المئوية الكلية
    const grandTotal = totals.total || 1; // لتجنب القسمة على صفر
    const totalAttRate = Math.round(((totals.present + totals.evening) / grandTotal) * 100);
    const totalLeaveRate = Math.round((totals.leave / grandTotal) * 100);

    return (
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
                    // حساب النسب
                    const attendanceRate = Math.round(((s.present + s.evening) / total) * 100);
                    const leaveRate = Math.round((s.leave / total) * 100);
                    
                    return (
                        <tr key={spec} className="border-b border-gray-300">
                            <td className="p-1 border border-gray-300 font-bold bg-gray-50">{spec}</td>
                            <td className="p-1 border border-gray-300 text-center font-bold">{s.total}</td>
                            <td className="p-1 border border-gray-300 text-center text-green-700 font-bold">{s.present}</td>
                            {/* غير متواجد (يشمل الغياب التلقائي + جزء الوقت) حسب المعادلة السابقة */}
                            <td className="p-1 border border-gray-300 text-center text-red-600 font-bold">{s.absent + s.partTimeOff}</td>
                            <td className="p-1 border border-gray-300 text-center text-orange-600">{s.leave}</td>
                            <td className="p-1 border border-gray-300 text-center text-purple-600">{s.evening}</td>
                            <td className="p-1 border border-gray-300 text-center text-red-800">{s.markedAbsence || 0}</td>
                            <td className="p-1 border border-gray-300 text-center text-gray-500">{s.partTimeOff}</td>
                            <td className="p-1 border border-gray-300 text-center font-mono">{attendanceRate}%</td>
                            <td className="p-1 border border-gray-300 text-center font-mono">{leaveRate}%</td>
                        </tr>
                    );
                })}
            </tbody>
            
            {/* ✅ صف الإجمالي */}
            <tfoot>
                <tr className="bg-gray-700 text-white font-bold border-t-2 border-gray-900">
                    <td className="p-2 border border-gray-600">الإجمالي الكلي</td>
                    <td className="p-2 border border-gray-600 text-center">{totals.total}</td>
                    <td className="p-2 border border-gray-600 text-center text-green-300">{totals.present}</td>
                    <td className="p-2 border border-gray-600 text-center text-red-300">{totals.absent + totals.partTimeOff}</td>
                    <td className="p-2 border border-gray-600 text-center text-orange-300">{totals.leave}</td>
                    <td className="p-2 border border-gray-600 text-center text-purple-300">{totals.evening}</td>
                    <td className="p-2 border border-gray-600 text-center text-red-400">{totals.markedAbsence}</td>
                    <td className="p-2 border border-gray-600 text-center text-gray-300">{totals.partTimeOff}</td>
                    <td className="p-2 border border-gray-600 text-center font-mono" dir="ltr">{totalAttRate}%</td>
                    <td className="p-2 border border-gray-600 text-center font-mono" dir="ltr">{totalLeaveRate}%</td>
                </tr>
            </tfoot>
        </table>
    );
};
