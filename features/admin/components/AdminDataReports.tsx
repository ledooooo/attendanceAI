import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { 
    Database, Users, BarChart3, Clock, CalendarX, 
    FileText, Printer, Download, Filter, ShieldAlert, 
    ChevronDown, Settings2, CheckSquare, Square, Type,
    TrendingUp, PieChart, Info, Calendar as CalendarIcon,
    ArrowRightLeft, CheckCircle2, FileSpreadsheet
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';

interface Props { employees: Employee[] }

type ReportView = 'staff_names' | 'staff_counts' | 'daily_io' | 'daily_absent' | 'monthly_absent' | 'overtime';

export default function AdminDataReports({ employees }: Props) {
    const [view, setView] = useState<ReportView>('staff_names');
    const [loading, setLoading] = useState(false);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [visibleColumns, setVisibleColumns] = useState<string[]>(['m', 'name', 'specialty', 'status', 'inTime', 'outTime', 'reportStatus', 'leaveNote']);
    const [fontSize, setFontSize] = useState(11);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [filterStatus, setFilterStatus] = useState('all');

    const printRef = useRef(null);

    useEffect(() => {
        const isMonth = view === 'monthly_absent';
        fetchData(isMonth ? month : date, isMonth);
    }, [view, date, month]);

    const fetchData = async (targetDate: string, isMonth = false) => {
        setLoading(true);
        try {
            let attQuery = supabase.from('attendance').select('*');
            if (isMonth) attQuery = attQuery.gte('date', `${targetDate}-01`).lte('date', `${targetDate}-31`);
            else attQuery = attQuery.eq('date', targetDate);
            
            const { data: att } = await attQuery;
            const { data: lvs } = await supabase.from('leave_requests').select('*');
            
            setAttendance(att || []);
            setLeaves(lvs || []);
            if (employees) setSelectedRows(employees.map(e => e.employee_id));
        } finally { setLoading(false); }
    };

    // --- محرك البيانات المطور ---
    
    // 1. التقرير اليومي المعالج
    const dailyProcessed = useMemo(() => {
        return employees.map(emp => {
            const att = attendance.find(a => a.employee_id === emp.employee_id);
            const lve = leaves.find(l => l.employee_id === emp.employee_id && date >= l.start_date && date <= l.end_date);
            let status = 'غياب', inT = '-', outT = '-';
            
            if (att) {
                const times = att.times?.split(/\s+/).filter(t => t.includes(':')) || [];
                inT = times[0] || '-';
                outT = times.length > 1 ? times[times.length - 1] : '-';
                status = (inT !== '-' && outT !== '-') ? 'حاضر' : (inT !== '-' ? 'ترك عمل' : 'غياب');
            } else if (lve) {
                status = 'إجازة/طلب';
            }
            return { ...emp, reportStatus: status, inTime: inT, outTime: outT, leaveNote: lve ? `${lve.type} (${lve.status})` : '' };
        }).filter(item => filterStatus === 'all' || item.status === filterStatus);
    }, [employees, attendance, leaves, date, filterStatus]);

    // 2. بيان الأعداد (إحصائي)
    const staffCountsReport = useMemo(() => {
        const specs = Array.from(new Set(employees.map(e => e.specialty)));
        return specs.map((spec, idx) => {
            const list = employees.filter(e => e.specialty === spec && (filterStatus === 'all' || e.status === filterStatus));
            return { m: idx + 1, specialty: spec, total: list.length, 
                     active: list.filter(e => e.status === 'نشط').length,
                     suspended: list.filter(e => e.status === 'موقوف').length };
        });
    }, [employees, filterStatus]);

    // 3. بيان بدل الراحات (منطق الوقت الصحيح)
    const overtimeReport = useMemo(() => {
        return dailyProcessed.filter(emp => {
            if (emp.inTime === '-' || emp.outTime === '-') return false;
            const parseTime = (t: string) => {
                const [h, m] = t.split(':').map(Number);
                return h + m / 60;
            };
            const totalHours = parseTime(emp.outTime) - parseTime(emp.inTime);
            const isWeekend = [5, 6].includes(new Date(date).getDay());
            return isWeekend ? totalHours >= 5 : totalHours >= 10;
        });
    }, [dailyProcessed, date]);

    // 4. الغياب الشهري
    const monthlyAbsentData = useMemo(() => {
        const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
        return employees.map(emp => {
            const empAttDates = attendance.filter(a => a.employee_id === emp.employee_id).map(a => a.date);
            const empLeaves = leaves.filter(l => l.employee_id === emp.employee_id && l.status === 'مقبول');
            let absentDays: number[] = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const checkDate = `${month}-${d.toString().padStart(2, '0')}`;
                if (new Date(checkDate).getDay() === 5) continue;
                if (!empAttDates.includes(checkDate) && !empLeaves.some(l => checkDate >= l.start_date && checkDate <= l.end_date)) absentDays.push(d);
            }
            return { ...emp, absentCount: absentDays.length, daysList: absentDays.join(', ') };
        }).filter(e => e.absentCount > 0 && (filterStatus === 'all' || e.status === filterStatus));
    }, [employees, attendance, leaves, month, filterStatus]);

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `تقرير_${view}_${date}`,
    });

    const toggleRow = (id: string) => setSelectedRows(prev => prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]);
    const toggleColumn = (col: string) => setVisibleColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);

    return (
        <div className="space-y-6 text-right pb-20" dir="rtl">
            {/* التبويبات */}
            <div className="flex bg-gray-100 p-1.5 rounded-[1.5rem] no-print overflow-x-auto shadow-inner border border-gray-200">
                {[
                    { id: 'staff_names', label: 'أسماء القوة', icon: Users },
                    { id: 'staff_counts', label: 'أعداد القوة', icon: BarChart3 },
                    { id: 'daily_io', label: 'حضور وغياب', icon: Clock },
                    { id: 'daily_absent', label: 'غياب اليوم', icon: CalendarX },
                    { id: 'monthly_absent', label: 'غياب الشهر', icon: FileText },
                    { id: 'overtime', label: 'بدل راحات', icon: ShieldAlert },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setView(tab.id as ReportView)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[11px] font-black transition-all whitespace-nowrap ${view === tab.id ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}>
                        <tab.icon size={16} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* أدوات التحكم */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm no-print space-y-6">
                <div className="flex flex-wrap gap-6 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-black text-gray-400 mb-2 mr-2">التاريخ المرجعي</label>
                        <input type={view === 'monthly_absent' ? "month" : "date"} value={view === 'monthly_absent' ? month : date} 
                               onChange={(e) => view === 'monthly_absent' ? setMonth(e.target.value) : setDate(e.target.value)} 
                               className="w-full p-3 bg-gray-50 rounded-2xl font-bold border-none ring-1 ring-gray-100 focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-black text-gray-400 mb-2 mr-2">حالة الموظفين</label>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-3 bg-gray-50 rounded-2xl font-bold border-none ring-1 ring-gray-100">
                            <option value="all">الكل</option>
                            <option value="نشط">نشط</option>
                            <option value="موقوف">موقوف</option>
                            <option value="خارج المركز">خارج المركز</option>
                        </select>
                    </div>
                    <button onClick={handlePrint} className="p-4 bg-gray-900 text-white rounded-2xl shadow-lg hover:scale-105 transition-transform"><Printer size={20}/></button>
                </div>

                {/* تخصيص الطباعة */}
                <div className="bg-indigo-50/50 p-4 rounded-3xl space-y-4">
                    <div className="flex flex-wrap gap-2 items-center text-[10px] font-black">
                        <span className="text-indigo-700 ml-4">الأعمدة:</span>
                        {['m', 'name', 'specialty', 'status', 'inTime', 'outTime', 'reportStatus'].map(col => (
                            <button key={col} onClick={() => toggleColumn(col)}
                                className={`px-3 py-1.5 rounded-xl border transition-all ${visibleColumns.includes(col) ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400'}`}>
                                {col === 'm' ? 'م' : col === 'name' ? 'الاسم' : col === 'specialty' ? 'التخصص' : col === 'status' ? 'الحالة' : col === 'inTime' ? 'حضور' : col === 'outTime' ? 'انصراف' : 'حالة اليوم'}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-4 border-t border-indigo-100 pt-4">
                        <Type size={16} className="text-indigo-600" />
                        <input type="range" min="8" max="18" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="w-40 accent-indigo-600" />
                        <span className="font-bold text-indigo-600 text-xs">{fontSize}px</span>
                    </div>
                </div>
            </div>

            {/* منطقة المعاينة والطباعة */}
            <div ref={printRef} className="bg-white p-10 rounded-[3.5rem] border shadow-sm min-h-[1100px] print:p-0 print:border-0 print:shadow-none text-right" dir="rtl">
                <div className="hidden print:block mb-10 border-b-2 border-black pb-8 text-center">
                    <h1 className="text-2xl font-black italic">إدارة شمال الجيزة - مركز غرب المطار</h1>
                    <p className="text-sm font-bold mt-2">بيان: {view} | بتاريخ: {view === 'monthly_absent' ? month : date}</p>
                </div>

                <div className="overflow-x-auto">
                    {view === 'staff_counts' ? (
                        /* جدول الأعداد الإحصائي */
                        <table className="w-full border-collapse" style={{ fontSize: `${fontSize}px` }}>
                            <thead>
                                <tr className="bg-gray-100 border-y-2 border-black">
                                    <th className="p-3 border">م</th>
                                    <th className="p-3 border text-right">التخصص</th>
                                    <th className="p-3 border text-center">الإجمالي</th>
                                    <th className="p-3 border text-center text-emerald-600">نشط</th>
                                    <th className="p-3 border text-center text-red-600">موقوف</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staffCountsReport.map((row, i) => (
                                    <tr key={i} className="border-b">
                                        <td className="p-3 border text-center">{i+1}</td>
                                        <td className="p-3 border font-black">{row.specialty}</td>
                                        <td className="p-3 border text-center font-bold bg-gray-50">{row.total}</td>
                                        <td className="p-3 border text-center text-emerald-600">{row.active}</td>
                                        <td className="p-3 border text-center text-red-600">{row.suspended}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        /* جداول الأسماء والتقارير الأخرى */
                        <table className="w-full border-collapse" style={{ fontSize: `${fontSize}px` }}>
                            <thead>
                                <tr className="bg-gray-100 border-y-2 border-black">
                                    <th className="p-3 border text-center no-print w-10">
                                        <CheckSquare size={16} />
                                    </th>
                                    {visibleColumns.includes('m') && <th className="p-3 border text-center w-12">م</th>}
                                    {visibleColumns.includes('name') && <th className="p-3 border text-right">الاسم</th>}
                                    {visibleColumns.includes('specialty') && <th className="p-3 border text-center">التخصص</th>}
                                    {view === 'monthly_absent' ? (
                                        <>
                                            <th className="p-3 border text-center text-red-600">أيام الغياب</th>
                                            <th className="p-3 border text-right">التواريخ</th>
                                        </>
                                    ) : (
                                        <>
                                            {visibleColumns.includes('inTime') && <th className="p-3 border text-center">حضور</th>}
                                            {visibleColumns.includes('outTime') && <th className="p-3 border text-center">انصراف</th>}
                                            {visibleColumns.includes('reportStatus') && <th className="p-3 border text-center">الحالة</th>}
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {(view === 'overtime' ? overtimeReport : 
                                  view === 'monthly_absent' ? monthlyAbsentData : 
                                  view === 'daily_absent' ? dailyProcessed.filter(r => r.reportStatus === 'غياب') : 
                                  dailyProcessed).map((row: any, i: number) => (
                                    <tr key={row.employee_id} className={`border-b ${!selectedRows.includes(row.employee_id) ? 'no-print opacity-20 bg-gray-100' : ''}`}>
                                        <td className="p-3 border text-center no-print">
                                            <button onClick={() => toggleRow(row.employee_id)}>
                                                {selectedRows.includes(row.employee_id) ? <CheckSquare size={18} className="text-indigo-600" /> : <Square size={18} className="text-gray-300" />}
                                            </button>
                                        </td>
                                        {visibleColumns.includes('m') && <td className="p-3 border text-center font-mono">{i + 1}</td>}
                                        {visibleColumns.includes('name') && <td className="p-3 border font-black">{row.name}</td>}
                                        {visibleColumns.includes('specialty') && <td className="p-3 border text-center">{row.specialty}</td>}
                                        
                                        {view === 'monthly_absent' ? (
                                            <>
                                                <td className="p-3 border text-center font-black text-red-600">{row.absentCount}</td>
                                                <td className="p-3 border text-right font-mono text-[9px]">{row.daysList}</td>
                                            </>
                                        ) : (
                                            <>
                                                {visibleColumns.includes('inTime') && <td className="p-3 border text-center font-mono text-blue-700">{row.inTime}</td>}
                                                {visibleColumns.includes('outTime') && <td className="p-3 border text-center font-mono text-red-700">{row.outTime}</td>}
                                                {visibleColumns.includes('reportStatus') && (
                                                    <td className="p-3 border text-center font-black">
                                                        {view === 'overtime' ? (new Date(date).getDay() >= 5 ? 'عطلة رسمية' : 'إضافي > 10س') : row.reportStatus}
                                                    </td>
                                                )}
                                            </>
                                        )}
                                    </tr>
                                ))}
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
