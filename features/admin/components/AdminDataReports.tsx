import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { 
    Database, Users, BarChart3, Clock, CalendarX, 
    FileText, Printer, Download, Settings2, CheckSquare, 
    Square, Type, CheckCircle2, TrendingUp, Info
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';

interface Props { employees: Employee[] }

type ReportView = 'staff_names' | 'staff_counts' | 'daily_io' | 'monthly_absent';

export default function AdminDataReports({ employees }: Props) {
    const [view, setView] = useState<ReportView>('staff_names');
    const [loading, setLoading] = useState(false);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    
    // إعدادات العرض والطباعة
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [visibleColumns, setVisibleColumns] = useState<string[]>(['m', 'name', 'specialty', 'status', 'inTime', 'outTime', 'reportStatus']);
    const [fontSize, setFontSize] = useState(11);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [filterStatus, setFilterStatus] = useState('all');

    const printRef = useRef(null);

    // جلب البيانات تلقائياً عند تغيير نوع التقرير أو التاريخ
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

    // --- محرك معالجة البيانات ---

    // 1. بيان الحضور والغياب اليومي (بناءً على البصمات والطلبات)
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
                status = `طلب (${lve.type})`;
            }
            return { ...emp, reportStatus: status, inTime: inT, outTime: outT };
        }).filter(item => filterStatus === 'all' || item.status === filterStatus);
    }, [employees, attendance, leaves, date, filterStatus]);

    // 2. بيان غياب الشهر (استبعاد الجمعة والطلبات المقبولة)
    const monthlyAbsentReport = useMemo(() => {
        const parts = month.split('-');
        const daysInMonth = new Date(parseInt(parts[0]), parseInt(parts[1]), 0).getDate();

        return employees.map(emp => {
            const empAttDates = attendance.filter(a => a.employee_id === emp.employee_id).map(a => a.date);
            const empApprovedLeaves = leaves.filter(l => l.employee_id === emp.employee_id && l.status === 'مقبول');
            
            let absentDays: number[] = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const checkDate = `${month}-${d.toString().padStart(2, '0')}`;
                if (new Date(checkDate).getDay() === 5) continue; // استبعاد الجمعة

                if (!empAttDates.includes(checkDate) && !empApprovedLeaves.some(l => checkDate >= l.start_date && checkDate <= l.end_date)) {
                    absentDays.push(d);
                }
            }
            return { ...emp, absentCount: absentDays.length, daysList: absentDays.join(', ') };
        }).filter(e => e.absentCount > 0 && (filterStatus === 'all' || e.status === filterStatus));
    }, [employees, attendance, leaves, month, filterStatus]);

    // 3. بيان التخصصات (أعداد)
    const staffCountsReport = useMemo(() => {
        const specs = Array.from(new Set(employees.map(e => e.specialty)));
        return specs.map((spec, idx) => {
            const list = employees.filter(e => e.specialty === spec && (filterStatus === 'all' || e.status === filterStatus));
            return { m: idx + 1, specialty: spec, total: list.length, active: list.filter(e => e.status === 'نشط').length };
        });
    }, [employees, filterStatus]);

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `تقرير_${view}_${date}`,
    });

    const toggleRow = (id: string) => setSelectedRows(prev => prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]);

    return (
        <div className="space-y-6 text-right pb-10" dir="rtl">
            {/* التبويبات العلوية */}
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

            {/* أدوات التحكم والفلاتر */}
            <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm no-print space-y-6">
                <div className="flex flex-wrap gap-6 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-black text-gray-400 mb-2 mr-1">التاريخ المرجعي</label>
                        <input type={view === 'monthly_absent' ? "month" : "date"} value={view === 'monthly_absent' ? month : date} 
                               onChange={(e) => view === 'monthly_absent' ? setMonth(e.target.value) : setDate(e.target.value)} 
                               className="w-full p-3 bg-gray-50 rounded-2xl font-bold border-none ring-1 ring-gray-100" />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-black text-gray-400 mb-2 mr-1">تصفية حسب الحالة</label>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-3 bg-gray-50 rounded-2xl font-bold border-none ring-1 ring-gray-100">
                            <option value="all">الكل</option>
                            <option value="نشط">نشط</option>
                            <option value="موقوف">موقوف</option>
                            <option value="اجازة">اجازة</option>
                            <option value="خارج المركز">خارج المركز</option>
                        </select>
                    </div>
                    <button onClick={handlePrint} className="p-4 bg-gray-900 text-white rounded-2xl shadow-lg hover:scale-105 transition-transform"><Printer size={20}/></button>
                </div>

                {/* تخصيص الطباعة */}
                <div className="bg-indigo-50/50 p-4 rounded-3xl flex items-center justify-between border border-indigo-100">
                    <div className="flex items-center gap-4">
                        <Type size={18} className="text-indigo-600" />
                        <span className="text-xs font-black text-indigo-700">حجم الخط:</span>
                        <input type="range" min="8" max="16" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="w-32 accent-indigo-600" />
                        <span className="font-bold text-indigo-600 text-xs">{fontSize}px</span>
                    </div>
                    <div className="text-[10px] font-bold text-gray-400">سيتم استثناء أي صف غير محدد من ورقة الطباعة تلقائياً</div>
                </div>
            </div>

            {/* منطقة المعاينة والطباعة */}
            <div ref={printRef} className="bg-white p-10 rounded-[3rem] border shadow-sm min-h-[1000px] print:p-0 print:border-0 print:shadow-none text-right" dir="rtl">
                <div className="hidden print:block mb-8 border-b-2 border-black pb-6 text-center">
                    <h1 className="text-2xl font-black">إدارة شمال الجيزة - مركز غرب المطار</h1>
                    <p className="text-sm font-bold mt-2">بيان: {view.replace('_', ' ')} | التاريخ: {view === 'monthly_absent' ? month : date}</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse" style={{ fontSize: `${fontSize}px` }}>
                        <thead>
                            <tr className="bg-gray-100 border-y-2 border-black">
                                <th className="p-3 border text-center no-print w-10"><CheckSquare size={16} /></th>
                                <th className="p-3 border text-center w-12">م</th>
                                <th className="p-3 border text-right">الاسم</th>
                                <th className="p-3 border text-center">التخصص</th>
                                {view === 'staff_names' && (
                                    <>
                                        <th className="p-3 border text-center">الرقم القومي</th>
                                        <th className="p-3 border text-center">التليفون</th>
                                        <th className="p-3 border text-center">الحالة</th>
                                    </>
                                )}
                                {view === 'daily_io' && (
                                    <>
                                        <th className="p-3 border text-center">حضور</th>
                                        <th className="p-3 border text-center">انصراف</th>
                                        <th className="p-3 border text-center">الحالة اليوم</th>
                                    </>
                                )}
                                {view === 'monthly_absent' && (
                                    <>
                                        <th className="p-3 border text-center text-red-600">أيام الغياب</th>
                                        <th className="p-3 border text-right font-mono">تفاصيل التواريخ</th>
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
                                            <button onClick={() => toggleRow(row.employee_id)}>
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
                                                <td className="p-3 border text-center">{row.status}</td>
                                            </>
                                        )}
                                        {view === 'daily_io' && (
                                            <>
                                                <td className="p-3 border text-center font-mono text-blue-700">{row.inTime}</td>
                                                <td className="p-3 border text-center font-mono text-red-700">{row.outTime}</td>
                                                <td className={`p-3 border text-center font-black ${row.reportStatus === 'حاضر' ? 'text-emerald-600' : 'text-red-600'}`}>{row.reportStatus}</td>
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
                </div>

                <div className="mt-20 hidden print:flex justify-between px-16 text-sm font-black">
                    <div className="text-center space-y-16"><p>مسئول شئون العاملين</p><p>........................</p></div>
                    <div className="text-center space-y-16"><p>مدير المركز</p><p>........................</p></div>
                </div>
            </div>
        </div>
    );
}
