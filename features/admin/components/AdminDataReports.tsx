import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { 
    Users, BarChart3, Clock, Printer, 
    CheckSquare, Square, Type
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

interface Props { employees: Employee[] }

type ReportView = 'staff_names' | 'staff_counts' | 'daily_io';

export default function AdminDataReports({ employees }: Props) {
    const [view, setView] = useState<ReportView>('staff_names');
    const [loading, setLoading] = useState(false);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [fontSize, setFontSize] = useState(9); 
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortBy, setSortBy] = useState<'name' | 'specialty'>('name');

    const printRef = useRef(null);

    // جلب البيانات عند تغيير التاريخ
    useEffect(() => {
        fetchAttendance();
    }, [date]);

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const { data: att } = await supabase.from('attendance')
                .select('*')
                .eq('date', date);
            
            setAttendance(att || []);
            // عند التحميل الأول، نحدد جميع الموظفين المفلترين حالياً
            if (employees) setSelectedRows(employees.map(e => e.employee_id));
        } finally { setLoading(false); }
    };

    // --- 1. معالجة القوة المفلترة والترتيب ---
    const filteredEmployees = useMemo(() => {
        return employees
            .filter(e => filterStatus === 'all' || e.status === filterStatus)
            .sort((a, b) => {
                if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
                return a.specialty.localeCompare(b.specialty, 'ar');
            });
    }, [employees, filterStatus, sortBy]);

    // --- 2. محرك بيانات الحضور والغياب اليومي (دقة 100%) ---
    const dailyProcessed = useMemo(() => {
        return filteredEmployees.map(emp => {
            // البحث عن سجل الموظف في البصمات لهذا اليوم تحديداً
            const attRecord = attendance.find(a => String(a.employee_id) === String(emp.employee_id));
            
            let inT = '', outT = '';
            let isPresent = false;

            if (attRecord && attRecord.times) {
                const times = attRecord.times.split(/\s+/).filter(t => t.includes(':')) || [];
                if (times.length > 0) {
                    inT = times[0];
                    outT = times.length > 1 ? times[times.length - 1] : '';
                    isPresent = true; // الموظف يعتبر متواجداً إذا وُجد له سجل بصمة واحد على الأقل
                }
            }

            return { ...emp, inTime: inT, outTime: outT, isPresent };
        });
    }, [filteredEmployees, attendance]);

    // --- 3. إحصائيات التواجد (تعتمد على القوة المفلترة) ---
    const stats = useMemo(() => {
        const total = dailyProcessed.length;
        const present = dailyProcessed.filter(e => e.isPresent).length;
        const absent = total - present;
        const ratio = total > 0 ? ((present / total) * 100).toFixed(1) : "0";

        return { total, present, absent, ratio };
    }, [dailyProcessed]);

    // تقسيم البيانات لنصفين للطباعة المزدوجة
    const dailySplit = useMemo(() => {
        const half = Math.ceil(dailyProcessed.length / 2);
        return {
            left: dailyProcessed.slice(0, half),
            right: dailyProcessed.slice(half)
        };
    }, [dailyProcessed]);

    // --- 4. بيان التخصصات مع الإجمالي ---
    const specialtyReport = useMemo(() => {
        const specs = Array.from(new Set(employees.map(e => e.specialty)));
        const data = specs.map((spec, idx) => {
            const count = employees.filter(e => e.specialty === spec && (filterStatus === 'all' || e.status === filterStatus)).length;
            return { m: idx + 1, specialty: spec, count };
        }).filter(item => item.count > 0);

        const totalDoctors = data.reduce((sum, item) => sum + item.count, 0);
        return { list: data, total: totalDoctors };
    }, [employees, filterStatus]);

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `تقرير_${view}_${date}`,
    });

    return (
        <div className="space-y-6 text-right pb-10" dir="rtl">
            {/* التبويبات */}
            <div className="flex bg-gray-100 p-1.5 rounded-2xl no-print overflow-x-auto shadow-inner border border-gray-200">
                {[
                    { id: 'staff_names', label: 'بيان القوة الفعلية', icon: Users },
                    { id: 'staff_counts', label: 'بيان التخصصات', icon: BarChart3 },
                    { id: 'daily_io', label: 'حضور وغياب يومي', icon: Clock },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setView(tab.id as ReportView)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all ${view === tab.id ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}>
                        <tab.icon size={16} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* الفلاتر */}
            <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm no-print space-y-6">
                <div className="flex flex-wrap gap-6 items-end">
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-[10px] font-black text-gray-400 mb-2">ترتيب الأسماء حسب</label>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="w-full p-2.5 bg-gray-50 rounded-xl font-bold border-none ring-1 ring-gray-100">
                            <option value="name">الاسم الأبجدي</option>
                            <option value="specialty">التخصص</option>
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-black text-gray-400 mb-2">تاريخ البيان</label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                               className="w-full p-2.5 bg-gray-50 rounded-xl font-bold border-none ring-1 ring-gray-100 focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-black text-gray-400 mb-2">حالة القيد</label>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-2.5 bg-gray-50 rounded-xl font-bold border-none ring-1 ring-gray-100">
                            <option value="all">الكل</option>
                            <option value="نشط">قوة فعلية</option>
                            <option value="موقوف">موقوف</option>
                        </select>
                    </div>
                    <button onClick={handlePrint} className="p-3 bg-gray-900 text-white rounded-xl shadow-lg hover:scale-105 transition-transform"><Printer size={20}/></button>
                </div>

                <div className="flex items-center gap-4 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100">
                    <Type size={18} className="text-indigo-600" />
                    <span className="text-xs font-black text-indigo-700">تحكم في عرض الجدول (حجم الخط):</span>
                    <input type="range" min="6" max="14" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="w-48 accent-indigo-600" />
                    <span className="font-bold text-indigo-600 text-xs">{fontSize}px</span>
                </div>
            </div>

            {/* منطقة المعاينة والطباعة */}
            <div ref={printRef} className="bg-white p-6 rounded-[2rem] border shadow-sm min-h-[1100px] print:p-0 print:border-0 print:shadow-none text-right" dir="rtl">
                <div className="hidden print:block mb-4 border-b-2 border-black pb-4 text-center">
                    <h1 className="text-xl font-black italic tracking-tighter">إدارة شمال الجيزة - مركز غرب المطار</h1>
                    <p className="text-sm font-bold mt-1">بيان: {view === 'daily_io' ? 'مسير الحضور والغياب اليومي' : view.replace('_', ' ')} | التاريخ: {date}</p>
                </div>

                <div className="overflow-x-auto">
                    {view === 'staff_counts' ? (
                        <div className="max-w-2xl mx-auto">
                            <table className="w-full border-collapse border border-black" style={{ fontSize: `${fontSize + 2}px` }}>
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="p-2 border border-black text-center w-16">م</th>
                                        <th className="p-2 border border-black text-right">اسم التخصص</th>
                                        <th className="p-2 border border-black text-center w-32">العدد</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {specialtyReport.list.map((row, i) => (
                                        <tr key={i} className="h-8">
                                            <td className="p-2 border border-black text-center font-mono">{row.m}</td>
                                            <td className="p-2 border border-black font-black">{row.specialty}</td>
                                            <td className="p-2 border border-black text-center font-black">{row.count}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-200 font-black border-t-2 border-black h-10">
                                        <td className="p-2 border border-black text-center" colSpan={2}>الإجمالي العام</td>
                                        <td className="p-2 border border-black text-center">{specialtyReport.total}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ) : view === 'daily_io' ? (
                        <div className="flex gap-2 w-full items-start">
                            {/* القسم الأيمن */}
                            <div className="w-1/2">
                                <table className="w-full border-collapse border border-black" style={{ fontSize: `${fontSize}px` }}>
                                    <thead>
                                        <tr className="bg-gray-100 text-[9px] font-black h-8">
                                            <th className="border border-black p-1 w-8">كود</th>
                                            <th className="border border-black p-1 text-right">الاسم الكامل للموظف</th>
                                            <th className="border border-black p-1 w-16">تخصص</th>
                                            <th className="border border-black p-1 w-12">حضور</th>
                                            <th className="border border-black p-1 w-12">انصراف</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dailySplit.left.map((row) => (
                                            <tr key={row.employee_id} className={`h-6 ${!selectedRows.includes(row.employee_id) ? 'no-print hidden' : ''}`}>
                                                <td className="border border-black text-center font-mono text-[8px]">{row.employee_id}</td>
                                                <td className="border border-black pr-1 font-bold whitespace-nowrap overflow-hidden leading-tight text-[8px]">{row.name}</td>
                                                <td className="border border-black text-center text-[7px] leading-none">{row.specialty}</td>
                                                <td className="border border-black text-center font-mono text-blue-800 text-[8px]">{row.inTime}</td>
                                                <td className="border border-black text-center font-mono text-red-800 text-[8px]">{row.outTime}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* القسم الأيسر */}
                            <div className="w-1/2">
                                <table className="w-full border-collapse border border-black" style={{ fontSize: `${fontSize}px` }}>
                                    <thead>
                                        <tr className="bg-gray-100 text-[9px] font-black h-8">
                                            <th className="border border-black p-1 w-8">كود</th>
                                            <th className="border border-black p-1 text-right">الاسم الكامل للموظف</th>
                                            <th className="border border-black p-1 w-16">تخصص</th>
                                            <th className="border border-black p-1 w-12">حضور</th>
                                            <th className="border border-black p-1 w-12">انصراف</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dailySplit.right.map((row) => (
                                            <tr key={row.employee_id} className={`h-6 ${!selectedRows.includes(row.employee_id) ? 'no-print hidden' : ''}`}>
                                                <td className="border border-black text-center font-mono text-[8px]">{row.employee_id}</td>
                                                <td className="border border-black pr-1 font-bold whitespace-nowrap overflow-hidden leading-tight text-[8px]">{row.name}</td>
                                                <td className="border border-black text-center text-[7px] leading-none">{row.specialty}</td>
                                                <td className="border border-black text-center font-mono text-blue-800 text-[8px]">{row.inTime}</td>
                                                <td className="border border-black text-center font-mono text-red-800 text-[8px]">{row.outTime}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        /* بيان القوة الفعلية */
                        <table className="w-full border-collapse border border-black" style={{ fontSize: `${fontSize + 1}px` }}>
                            <thead>
                                <tr className="bg-gray-100 h-10">
                                    <th className="p-2 border border-black text-center no-print w-10"><CheckSquare size={16} /></th>
                                    <th className="p-2 border border-black text-center w-12">م</th>
                                    <th className="p-2 border border-black text-right">الاسم الكامل</th>
                                    <th className="p-2 border border-black text-center font-mono w-40">الرقم القومي</th>
                                    <th className="p-2 border border-black text-center">التخصص</th>
                                    <th className="p-2 border border-black text-center font-mono">التليفون</th>
                                    <th className="p-2 border border-black text-center w-24">الحالة</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.map((row, i) => {
                                    const isSelected = selectedRows.includes(row.employee_id);
                                    return (
                                        <tr key={row.employee_id} className={`h-8 ${!isSelected ? 'no-print opacity-20' : ''}`}>
                                            <td className="p-1 border border-black text-center no-print">
                                                <button onClick={() => toggleRow(row.employee_id)}>
                                                    {isSelected ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} className="text-gray-300" />}
                                                </button>
                                            </td>
                                            <td className="p-1 border border-black text-center font-mono">{i + 1}</td>
                                            <td className="p-1 border border-black pr-2 font-bold">{row.name}</td>
                                            <td className="p-1 border border-black text-center font-mono">{row.national_id}</td>
                                            <td className="p-1 border border-black text-center">{row.specialty}</td>
                                            <td className="p-1 border border-black text-center font-mono">{row.phone}</td>
                                            <td className="p-1 border border-black text-center font-black text-[10px]">
                                                {row.status === 'نشط' ? 'قوة فعلية' : row.status}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* الإحصائيات المحدثة */}
                {view === 'daily_io' && (
                    <div className="mt-4 border-2 border-black p-3 bg-gray-50 grid grid-cols-4 gap-2 text-center font-black text-[11px] leading-relaxed">
                        <div className="border-l border-black">إجمالي القوة المستهدفة: {stats.total}</div>
                        <div className="border-l border-black text-emerald-800 bg-emerald-50/50">إجمالي المتواجدين (بصمة واحدة فأكثر): {stats.present}</div>
                        <div className="border-l border-black text-red-800 bg-red-50/50">إجمالي غير المتواجدين (بدون بصمة): {stats.absent}</div>
                        <div className="text-indigo-900 font-black italic underline">نسبة الانضباط اليومي: {stats.ratio}%</div>
                    </div>
                )}

                {/* التوقيعات */}
                <div className="mt-8 flex justify-between px-16 text-[10px] font-black">
                    <div className="text-center space-y-10"><p>مسئول البصمة</p><p className="border-b border-black w-32 mx-auto"></p></div>
                    <div className="text-center space-y-10"><p>شئون العاملين</p><p className="border-b border-black w-32 mx-auto"></p></div>
                    <div className="text-center space-y-10"><p>مدير المركز</p><p className="border-b border-black w-32 mx-auto"></p></div>
                </div>
            </div>
        </div>
    );
}
