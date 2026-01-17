import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { 
    Users, BarChart3, Clock, CalendarX, ShieldAlert, 
    Printer, Download, Filter, Settings2, CheckSquare, 
    Square, Type, ListOrdered, Moon, LayoutGrid
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';

interface Props { employees: Employee[] }

type ReportView = 'staff_list' | 'daily_attendance' | 'monthly_absent' | 'evening_shift';

export default function AdminDataReports({ employees }: Props) {
    const [view, setView] = useState<ReportView>('staff_list');
    const [loading, setLoading] = useState(false);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    
    // إعدادات العرض والفلترة
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [visibleColumns, setVisibleColumns] = useState<string[]>(['m', 'id', 'name', 'national_id', 'specialty', 'phone', 'role', 'status']);
    const [filterStatus, setFilterStatus] = useState('نشط');
    const [sortKey, setSortKey] = useState<'employee_id' | 'name' | 'specialty'>('employee_id');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [fontSize, setFontSize] = useState(10);

    const printRef = useRef(null);

    // جلب البيانات اللازمة حسب نوع التقرير
    useEffect(() => {
        fetchSupportData();
    }, [view, date, month]);

    const fetchSupportData = async () => {
        setLoading(true);
        const isMonth = view === 'monthly_absent';
        let attQuery = supabase.from('attendance').select('*');
        
        if (isMonth) attQuery = attQuery.gte('date', `${month}-01`).lte('date', `${month}-31`);
        else attQuery = attQuery.eq('date', date);

        const { data: att } = await attQuery;
        const { data: lvs } = await supabase.from('leave_requests').select('*');
        
        setAttendance(att || []);
        setLeaves(lvs || []);
        if (employees) setSelectedRows(employees.map(e => e.employee_id));
        setLoading(false);
    };

    // --- المحرك البرمجي لمعالجة البيانات ---

    // 1. بيان القوة العاملة (مرتب ومفلتر)
    const processedEmployees = useMemo(() => {
        return [...employees]
            .filter(e => filterStatus === 'all' || e.status === filterStatus)
            .sort((a, b) => String(a[sortKey]).localeCompare(String(b[sortKey]), 'ar'));
    }, [employees, filterStatus, sortKey]);

    // 2. إحصائيات الأعداد (للطباعة المختصرة)
    const staffCounts = useMemo(() => {
        const specs = Array.from(new Set(employees.map(e => e.specialty)));
        return specs.map(spec => ({
            name: spec,
            total: employees.filter(e => e.specialty === spec && (filterStatus === 'all' || e.status === filterStatus)).length
        })).filter(s => s.total > 0);
    }, [employees, filterStatus]);

    // 3. الحضور والغياب اليومي الشامل
    const dailyStatus = useMemo(() => {
        return processedEmployees.map(emp => {
            const att = attendance.find(a => a.employee_id === emp.employee_id);
            const lve = leaves.find(l => l.employee_id === emp.employee_id && date >= l.start_date && date <= l.end_date);
            let status = 'غائب';
            if (att) status = (att.times?.split(/\s+/).length > 1) ? 'حاضر' : 'ترك عمل';
            else if (lve) status = `طلب (${lve.type})`;
            return { ...emp, dailyStatus: status };
        });
    }, [processedEmployees, attendance, leaves, date]);

    // 4. النوبتجيات (2م - 8م)
    const eveningShiftData = useMemo(() => {
        return dailyStatus.filter(emp => {
            const att = attendance.find(a => a.employee_id === emp.employee_id);
            if (!att || !att.times) return false;
            const times = att.times.split(/\s+/).filter(t => t.includes(':'));
            return times.some(t => {
                const hour = parseInt(t.split(':')[0]);
                return hour >= 14 && hour < 20; // من الساعة 2 ظهراً حتى 8 مساءً
            });
        });
    }, [dailyStatus, attendance]);

    // 5. الغياب الشهري (بدون بصمة وبدون طلبات)
    const monthlyAbsentData = useMemo(() => {
        const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
        return processedEmployees.map(emp => {
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
            return { ...emp, absentCount: absentDays.length, days: absentDays.join(',') };
        }).filter(e => e.absentCount > 0);
    }, [processedEmployees, attendance, leaves, month]);

    // --- وظائف التحكم ---
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `تقرير_مركز_غرب_المطار_${view}`,
    });

    const toggleColumn = (col: string) => setVisibleColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);

    return (
        <div className="space-y-6 text-right pb-20" dir="rtl">
            {/* التبويبات العلوية */}
            <div className="flex bg-gray-100 p-1.5 rounded-2xl no-print overflow-x-auto shadow-inner">
                {[
                    { id: 'staff_list', label: 'القوة العاملة', icon: Users },
                    { id: 'daily_attendance', label: 'الحضور اليومي', icon: Clock },
                    { id: 'monthly_absent', label: 'الغياب الشهري', icon: CalendarX },
                    { id: 'evening_shift', label: 'النوبتجيات', icon: Moon },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setView(tab.id as ReportView)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all whitespace-nowrap ${view === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>
                        <tab.icon size={16} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* أدوات الفلترة والتحكم */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm no-print space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 mb-2 mr-2">تصفية حسب الحالة</label>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-3 bg-gray-50 rounded-2xl font-bold border-none ring-1 ring-gray-100">
                            <option value="all">الكل</option>
                            <option value="نشط">نشط</option>
                            <option value="موقوف">موقوف</option>
                            <option value="اجازة">اجازة</option>
                            <option value="خارج المركز">خارج المركز</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 mb-2 mr-2">ترتيب حسب</label>
                        <select value={sortKey} onChange={e => setSortKey(e.target.value as any)} className="w-full p-3 bg-gray-50 rounded-2xl font-bold border-none ring-1 ring-gray-100">
                            <option value="employee_id">رقم الموظف</option>
                            <option value="name">الاسم</option>
                            <option value="specialty">التخصص</option>
                        </select>
                    </div>
                    {view === 'monthly_absent' ? (
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 mb-2 mr-2">اختر الشهر</label>
                            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-full p-3 bg-gray-50 rounded-2xl font-bold border-none ring-1 ring-gray-100" />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 mb-2 mr-2">اختر التاريخ</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-3 bg-gray-50 rounded-2xl font-bold border-none ring-1 ring-gray-100" />
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="flex-1 bg-gray-900 text-white p-3 rounded-2xl flex items-center justify-center gap-2 font-black hover:bg-black transition-all">
                            <Printer size={18}/> طباعة الشيت
                        </button>
                    </div>
                </div>

                {/* تخصيص الأعمدة */}
                <div className="bg-indigo-50/50 p-4 rounded-3xl">
                    <div className="flex flex-wrap gap-2 items-center">
                        <Settings2 size={16} className="text-indigo-600 ml-2" />
                        <span className="text-[10px] font-black text-indigo-700 ml-4">عرض الأعمدة:</span>
                        {[
                            {id: 'm', l: 'م'}, {id: 'id', l: 'الرقم'}, {id: 'name', l: 'الاسم'}, 
                            {id: 'national_id', l: 'القومي'}, {id: 'specialty', l: 'التخصص'},
                            {id: 'phone', l: 'التليفون'}, {id: 'role', l: 'المهام'}, {id: 'status', l: 'الحالة'}
                        ].map(col => (
                            <button key={col.id} onClick={() => toggleColumn(col.id)}
                                className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold transition-all ${visibleColumns.includes(col.id) ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400'}`}>
                                {col.l}
                            </button>
                        ))}
                        <div className="mr-auto flex items-center gap-2">
                            <Type size={14} className="text-gray-400"/>
                            <input type="range" min="7" max="14" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="w-24 accent-indigo-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* منطقة الطباعة (Layout A4) */}
            <div ref={printRef} className="bg-white p-8 rounded-[3rem] border shadow-sm min-h-[1000px] print:p-0 print:border-0 print:shadow-none" dir="rtl">
                
                {/* الهيدر الرسمي */}
                <div className="hidden print:flex justify-between items-center mb-8 border-b-2 border-black pb-4">
                    <div className="text-right text-[10px] font-black leading-tight">
                        <p>وزارة الصحة والسكان</p>
                        <p>مديرية الشئون الصحية بالجيزة</p>
                        <p>إدارة شمال الجيزة - مركز غرب المطار</p>
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-black italic underline">بيان مصلحي رسمي</h2>
                        <p className="text-[10px] font-bold mt-1">التقرير: {view === 'staff_list' ? 'بيان القوة العاملة' : view === 'daily_attendance' ? 'بيان الحضور اليومي' : 'بيان الغياب'}</p>
                    </div>
                    <div className="text-left text-[9px] font-bold">
                        <p>تاريخ البيان: {view === 'monthly_absent' ? month : date}</p>
                        <p>توقيت الطباعة: {new Date().toLocaleString('ar-EG')}</p>
                    </div>
                </div>

                {/* 1. قسم الأعداد (يظهر فقط في طباعة الأعداد أو أعلى الشيت) */}
                <div className="mb-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {staffCounts.map((s, i) => (
                        <div key={i} className="border border-gray-200 p-2 rounded-xl text-center flex flex-col">
                            <span className="text-[9px] text-gray-500 font-bold truncate">{s.name}</span>
                            <span className="text-sm font-black text-indigo-700">{s.total}</span>
                        </div>
                    ))}
                    <div className="border-2 border-black p-2 rounded-xl text-center bg-gray-50 flex flex-col">
                        <span className="text-[9px] font-black">الإجمالي العام</span>
                        <span className="text-sm font-black">{processedEmployees.length}</span>
                    </div>
                </div>

                {/* 2. الجدول الرئيسي */}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse" style={{ fontSize: `${fontSize}px` }}>
                        <thead>
                            <tr className="bg-gray-100 border-y-2 border-black">
                                <th className="p-2 border text-center no-print w-8">
                                    <button onClick={() => setSelectedRows(selectedRows.length === processedEmployees.length ? [] : processedEmployees.map(e=>e.employee_id))}><CheckSquare size={14}/></button>
                                </th>
                                {visibleColumns.includes('m') && <th className="p-2 border text-center w-8">م</th>}
                                {visibleColumns.includes('id') && <th className="p-2 border text-center">الكود</th>}
                                {visibleColumns.includes('name') && <th className="p-2 border text-right">الاسم الرباعي</th>}
                                {visibleColumns.includes('national_id') && <th className="p-2 border text-center">الرقم القومي</th>}
                                {visibleColumns.includes('specialty') && <th className="p-2 border text-center">التخصص</th>}
                                {visibleColumns.includes('phone') && <th className="p-2 border text-center">التليفون</th>}
                                {visibleColumns.includes('role') && <th className="p-2 border text-center">المهام</th>}
                                {visibleColumns.includes('status') && <th className="p-2 border text-center">الحالة</th>}
                                
                                {/* أعمدة الحضور والغياب الديناميكية */}
                                {view === 'daily_attendance' && <th className="p-2 border text-center bg-blue-50">حالة اليوم</th>}
                                {view === 'evening_shift' && <th className="p-2 border text-center bg-purple-50">نوبتجية (2-8)</th>}
                                {view === 'monthly_absent' && <th className="p-2 border text-center bg-red-50">أيام الغياب</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {(
                                view === 'staff_list' ? processedEmployees :
                                view === 'daily_attendance' ? dailyStatus :
                                view === 'evening_shift' ? eveningShiftData :
                                monthlyAbsentData
                            ).map((row: any, i: number) => {
                                const isSelected = selectedRows.includes(row.employee_id);
                                return (
                                    <tr key={row.employee_id} className={`border-b border-gray-300 ${!isSelected ? 'print:hidden opacity-30 bg-gray-100' : 'hover:bg-gray-50'}`}>
                                        <td className="p-2 border text-center no-print">
                                            <button onClick={() => setSelectedRows(prev => prev.includes(row.employee_id) ? prev.filter(id => id !== row.employee_id) : [...prev, row.employee_id])}>
                                                {isSelected ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} className="text-gray-300" />}
                                            </button>
                                        </td>
                                        {visibleColumns.includes('m') && <td className="p-2 border text-center font-mono">{i + 1}</td>}
                                        {visibleColumns.includes('id') && <td className="p-2 border text-center font-mono">{row.employee_id}</td>}
                                        {visibleColumns.includes('name') && <td className="p-2 border font-bold">{row.name}</td>}
                                        {visibleColumns.includes('national_id') && <td className="p-2 border text-center font-mono text-[9px]">{row.national_id}</td>}
                                        {visibleColumns.includes('specialty') && <td className="p-2 border text-center">{row.specialty}</td>}
                                        {visibleColumns.includes('phone') && <td className="p-2 border text-center font-mono">{row.phone}</td>}
                                        {visibleColumns.includes('role') && <td className="p-2 border text-center text-[9px]">{row.role || '-'}</td>}
                                        {visibleColumns.includes('status') && <td className="p-2 border text-center font-bold">{row.status}</td>}
                                        
                                        {view === 'daily_attendance' && <td className="p-2 border text-center font-black">{row.dailyStatus}</td>}
                                        {view === 'evening_shift' && <td className="p-2 border text-center font-black text-purple-700">حاضر نوبتجية</td>}
                                        {view === 'monthly_absent' && (
                                            <td className="p-2 border text-center">
                                                <span className="font-black text-red-600 block">{row.absentCount} يوم</span>
                                                <span className="text-[8px] text-gray-400 font-mono">أيام: {row.days}</span>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* تذييل الطباعة */}
                <div className="mt-16 hidden print:flex justify-between px-10 text-xs font-black">
                    <div className="text-center space-y-10"><p>شئون العاملين</p><p>........................</p></div>
                    <div className="text-center space-y-10"><p>يعتمد،، مدير المركز</p><p>........................</p></div>
                </div>
            </div>
        </div>
    );
}
