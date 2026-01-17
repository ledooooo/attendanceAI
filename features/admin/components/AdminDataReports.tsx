import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { 
    Database, Users, BarChart3, Clock, CalendarX, 
    FileText, Printer, Download, Settings2, CheckSquare, 
    Square, Type, ArrowUpDown, Info
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

interface Props { employees: Employee[] }

type ReportView = 'staff_names' | 'staff_counts' | 'daily_io' | 'monthly_absent';

export default function AdminDataReports({ employees }: Props) {
    const [view, setView] = useState<ReportView>('staff_names');
    const [loading, setLoading] = useState(false);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    
    // إعدادات العرض
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [fontSize, setFontSize] = useState(11);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortBy, setSortBy] = useState<'name' | 'specialty' | 'id'>('name');

    const printRef = useRef(null);

    // جلب البيانات الأساسية
    useEffect(() => {
        const isMonth = view === 'monthly_absent';
        fetchData(isMonth ? month : date, isMonth);
    }, [view, date, month]);

    const fetchData = async (targetDate: string, isMonth = false) => {
        setLoading(true);
        try {
            // جلب سجلات البصمة 
            let attQuery = supabase.from('attendance').select('*');
            if (isMonth) attQuery = attQuery.gte('date', `${targetDate}-01`).lte('date', `${targetDate}-31`);
            else attQuery = attQuery.eq('date', targetDate);
            
            const { data: att } = await attQuery;
            // جلب كافة الطلبات 
            const { data: lvs } = await supabase.from('leave_requests').select('*');
            
            setAttendance(att || []);
            setLeaves(lvs || []);
            if (employees) setSelectedRows(employees.map(e => e.employee_id));
        } finally { setLoading(false); }
    };

    // --- 1. بيان القوة الفعلية مع الترتيب ---
    const sortedEmployees = useMemo(() => {
        return [...employees]
            .filter(e => filterStatus === 'all' || e.status === filterStatus)
            .sort((a, b) => {
                if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
                if (sortBy === 'specialty') return a.specialty.localeCompare(b.specialty, 'ar');
                return 0;
            });
    }, [employees, filterStatus, sortBy]);

    // --- 2. بيان التخصصات المختصر ---
    const specialtyReport = useMemo(() => {
        const specs = Array.from(new Set(employees.map(e => e.specialty)));
        return specs.map((spec, idx) => {
            const count = employees.filter(e => e.specialty === spec && (filterStatus === 'all' || e.status === filterStatus)).length;
            return { m: idx + 1, specialty: spec, count };
        }).filter(item => item.count > 0);
    }, [employees, filterStatus]);

    // --- 3. بيان الحضور اليومي مع جلب الطلبات ---
    const dailyProcessed = useMemo(() => {
        return sortedEmployees.map(emp => {
            const att = attendance.find(a => a.employee_id === emp.employee_id);
            const lve = leaves.find(l => l.employee_id === emp.employee_id && date >= l.start_date && date <= l.end_date);
            
            let status = 'غائب', inT = '-', outT = '-';
            
            if (att) {
                const times = att.times?.split(/\s+/).filter(t => t.includes(':')) || []; 
                inT = times[0] || '-';
                outT = times.length > 1 ? times[times.length - 1] : '-';
                status = (inT !== '-' && outT !== '-') ? 'حاضر' : (inT !== '-' ? 'ترك عمل' : 'غائب');
            }
            
            // دمج حالة الطلب إذا وجد 
            const requestInfo = lve ? `${lve.type} (${lve.status})` : '';

            return { ...emp, reportStatus: status, inTime: inT, outTime: outT, requestInfo };
        });
    }, [sortedEmployees, attendance, leaves, date]);

    // --- 4. منطق الغياب الشهري الدقيق ---
    const monthlyAbsentReport = useMemo(() => {
        const parts = month.split('-');
        const year = parseInt(parts[0]);
        const monthNum = parseInt(parts[1]);
        const daysInMonth = new Date(year, monthNum, 0).getDate();

        return sortedEmployees.map(emp => {
            const empAttDates = attendance.filter(a => a.employee_id === emp.employee_id).map(a => a.date);
            const empApprovedLeaves = leaves.filter(l => l.employee_id === emp.employee_id && l.status === 'مقبول');
            
            let absentDays: number[] = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const checkDate = `${month}-${String(d).padStart(2, '0')}`;
                if (new Date(checkDate).getDay() === 5) continue; // استبعاد الجمعة

                const hasAtt = empAttDates.includes(checkDate);
                const hasLeave = empApprovedLeaves.some(l => checkDate >= l.start_date && checkDate <= l.end_date);

                if (!hasAtt && !hasLeave) absentDays.push(d);
            }
            return { ...emp, absentCount: absentDays.length, daysList: absentDays.join(', ') };
        }).filter(e => e.absentCount > 0);
    }, [sortedEmployees, attendance, leaves, month]);

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `تقرير_${view}_${date}`,
    });

    return (
        <div className="space-y-6 text-right pb-10" dir="rtl">
            {/* التبويبات */}
            <div className="flex bg-gray-100 p-1.5 rounded-2xl no-print overflow-x-auto shadow-inner border">
                {[
                    { id: 'staff_names', label: 'بيان القوة الفعلية', icon: Users },
                    { id: 'staff_counts', label: 'بيان التخصصات', icon: BarChart3 },
                    { id: 'daily_io', label: 'حضور وغياب يومي', icon: Clock },
                    { id: 'monthly_absent', label: 'غياب شهري', icon: FileText },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setView(tab.id as ReportView)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all ${view === tab.id ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}>
                        <tab.icon size={16} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* الفلاتر والتحكم */}
            <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm no-print space-y-6">
                <div className="flex flex-wrap gap-6 items-end">
                    {view !== 'staff_counts' && (
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-[10px] font-black text-gray-400 mb-2">ترتيب حسب</label>
                            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="w-full p-2.5 bg-gray-50 rounded-xl font-bold border-none ring-1 ring-gray-100">
                                <option value="name">الاسم</option>
                                <option value="specialty">التخصص</option>
                            </select>
                        </div>
                    )}
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-black text-gray-400 mb-2">التاريخ</label>
                        <input type={view === 'monthly_absent' ? "month" : "date"} value={view === 'monthly_absent' ? month : date} 
                               onChange={(e) => view === 'monthly_absent' ? setMonth(e.target.value) : setDate(e.target.value)} 
                               className="w-full p-2.5 bg-gray-50 rounded-2xl font-bold border-none ring-1 ring-gray-100" />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-black text-gray-400 mb-2">حالة الموظف</label>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-2.5 bg-gray-50 rounded-2xl font-bold border-none ring-1 ring-gray-100">
                            <option value="all">الكل</option>
                            <option value="نشط">نشط</option>
                            <option value="موقوف">موقوف</option>
                            <option value="اجازة">اجازة</option>
                            <option value="خارج المركز">خارج المركز</option>
                        </select>
                    </div>
                    <button onClick={handlePrint} className="p-3 bg-gray-900 text-white rounded-xl shadow-lg hover:scale-105 transition-transform"><Printer size={20}/></button>
                </div>

                <div className="flex items-center gap-4 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100">
                    <Type size={18} className="text-indigo-600" />
                    <span className="text-xs font-black text-indigo-700">مقاس الخط:</span>
                    <input type="range" min="8" max="16" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="w-32 accent-indigo-600" />
                    <span className="font-bold text-indigo-600 text-xs">{fontSize}px</span>
                </div>
            </div>

            {/* منطقة الطباعة */}
            <div ref={printRef} className="bg-white p-10 rounded-[3rem] border shadow-sm min-h-[1000px] print:p-0 print:border-0 print:shadow-none text-right" dir="rtl">
                <div className="hidden print:block mb-8 border-b-2 border-black pb-6 text-center">
                    <h1 className="text-2xl font-black italic">إدارة شمال الجيزة - مركز غرب المطار</h1>
                    <p className="text-sm font-bold mt-2">بيان: {view.replace('_', ' ')} | التاريخ: {view === 'monthly_absent' ? month : date}</p>
                </div>

                <div className="overflow-x-auto">
                    {view === 'staff_counts' ? (
                        <table className="w-full border-collapse" style={{ fontSize: `${fontSize}px` }}>
                            <thead>
                                <tr className="bg-gray-100 border-y-2 border-black">
                                    <th className="p-3 border text-center w-16">م</th>
                                    <th className="p-3 border text-right">التخصص</th>
                                    <th className="p-3 border text-center">عدد الأطباء</th>
                                </tr>
                            </thead>
                            <tbody>
                                {specialtyReport.map((row, i) => (
                                    <tr key={i} className="border-b">
                                        <td className="p-3 border text-center font-mono">{row.m}</td>
                                        <td className="p-3 border font-black">{row.specialty}</td>
                                        <td className="p-3 border text-center font-black text-indigo-600 bg-gray-50">{row.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full border-collapse" style={{ fontSize: `${fontSize}px` }}>
                            <thead>
                                <tr className="bg-gray-100 border-y-2 border-black">
                                    <th className="p-3 border text-center no-print w-10"><CheckSquare size={16} /></th>
                                    <th className="p-3 border text-center w-12">م</th>
                                    <th className="p-3 border text-right">الاسم</th>
                                    <th className="p-3 border text-center">التخصص</th>
                                    {view === 'staff_names' && (
                                        <>
                                            <th className="p-3 border text-center font-mono">الرقم القومي</th>
                                            <th className="p-3 border text-center font-mono">التليفون</th>
                                            <th className="p-3 border text-center">الحالة</th>
                                        </>
                                    )}
                                    {view === 'daily_io' && (
                                        <>
                                            <th className="p-3 border text-center font-mono text-blue-700">حضور</th>
                                            <th className="p-3 border text-center font-mono text-red-700">انصراف</th>
                                            <th className="p-3 border text-center">حالة اليوم / الطلبات</th>
                                        </>
                                    )}
                                    {view === 'monthly_absent' && (
                                        <>
                                            <th className="p-3 border text-center text-red-600 font-black">أيام الغياب</th>
                                            <th className="p-3 border text-right font-mono text-[9px]">تواريخ الغياب</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {(view === 'monthly_absent' ? monthlyAbsentReport : dailyProcessed).map((row: any, i: number) => {
                                    const isSelected = selectedRows.includes(row.employee_id);
                                    return (
                                        <tr key={row.employee_id} className={`border-b ${!isSelected ? 'no-print opacity-20 bg-gray-50' : 'hover:bg-gray-50/50'}`}>
                                            <td className="p-3 border text-center no-print">
                                                <button onClick={() => setSelectedRows(prev => prev.includes(row.employee_id) ? prev.filter(id => id !== row.employee_id) : [...prev, row.employee_id])}>
                                                    {isSelected ? <CheckSquare size={18} className="text-indigo-600" /> : <Square size={18} className="text-gray-300" />}
                                                </button>
                                            </td>
                                            <td className="p-3 border text-center font-mono">{i + 1}</td>
                                            <td className="p-3 border font-black">{row.name}</td>
                                            <td className="p-3 border text-center">{row.specialty}</td>
                                            {view === 'staff_names' && (
                                                <>
                                                    <td className="p-3 border text-center font-mono">{row.national_id}</td>
                                                    <td className="p-3 border text-center font-mono">{row.phone}</td>
                                                    <td className="p-3 border text-center text-[10px]">{row.status}</td>
                                                </>
                                            )}
                                            {view === 'daily_io' && (
                                                <>
                                                    <td className="p-3 border text-center font-mono text-blue-700">{row.inTime}</td>
                                                    <td className="p-3 border text-center font-mono text-red-700">{row.outTime}</td>
                                                    <td className="p-3 border text-center text-[10px]">
                                                        <span className={row.reportStatus === 'حاضر' ? 'text-emerald-600 font-black' : 'text-red-500 font-black'}>
                                                            {row.reportStatus}
                                                        </span>
                                                        {row.requestInfo && <div className="text-indigo-500 font-bold mt-1 border-t pt-1">{row.requestInfo}</div>}
                                                    </td>
                                                </>
                                            )}
                                            {view === 'monthly_absent' && (
                                                <>
                                                    <td className="p-3 border text-center font-black text-red-600">{row.absentCount} يوم</td>
                                                    <td className="p-3 border text-right font-mono text-[9px] text-gray-500">{row.daysList}</td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="mt-20 hidden print:flex justify-between px-16 text-sm font-black">
                    <div className="text-center space-y-16"><p>مسئول شئون العاملين</p><p>........................</p></div>
                    <div className="text-center space-y-16"><p>مدير المركز</p><p>........................</p></div>
                </div>
            </div>
        </div>
    );
}
