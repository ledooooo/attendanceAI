import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { 
    Users, BarChart3, Clock, Printer, 
    CheckSquare, Square, Type, Info
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

interface Props { employees: Employee[] }

type ReportView = 'staff_names' | 'staff_counts' | 'daily_io';

export default function AdminDataReports({ employees }: Props) {
    const [view, setView] = useState<ReportView>('staff_names');
    const [loading, setLoading] = useState(false);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [fontSize, setFontSize] = useState(10); 
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortBy, setSortBy] = useState<'name' | 'specialty'>('name');

    const printRef = useRef(null);

    useEffect(() => {
        fetchData();
    }, [date]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: att } = await supabase.from('attendance')
                .select('*')
                .eq('date', date);
            
            setAttendance(att || []);
            if (employees) setSelectedRows(employees.map(e => e.employee_id));
        } finally { setLoading(false); }
    };

    // --- معالجة القوة المفلترة والترتيب ---
    const staffReport = useMemo(() => {
        return [...employees]
            .filter(e => filterStatus === 'all' || e.status === filterStatus)
            .map(e => ({
                ...e,
                displayStatus: e.status === 'نشط' ? 'قوة فعلية' : e.status
            }))
            .sort((a, b) => {
                if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
                return a.specialty.localeCompare(b.specialty, 'ar');
            });
    }, [employees, filterStatus, sortBy]);

    // --- معالجة بيانات الحضور اليومي (بدون نصوص للغياب) ---
    const dailyProcessed = useMemo(() => {
        return staffReport.map(emp => {
            const att = attendance.find(a => a.employee_id === emp.employee_id);
            let inT = '', outT = '';
            
            if (att) {
                const times = att.times?.split(/\s+/).filter(t => t.includes(':')) || [];
                inT = times[0] || '';
                outT = times.length > 1 ? times[times.length - 1] : '';
            }
            // الموظف متواجد إذا وجد سجل بصمة (حتى لو بصمة واحدة)
            return { ...emp, inTime: inT, outTime: outT, isPresent: !!att };
        });
    }, [staffReport, attendance]);

    // الإحصائيات المطلوبة (تعتمد على الموظفين المختارين حالياً)
    const stats = useMemo(() => {
        const total = dailyProcessed.length;
        const present = dailyProcessed.filter(e => e.isPresent).length;
        const absent = total - present;
        const ratio = total > 0 ? ((present / total) * 100).toFixed(1) : "0";

        return { total, present, absent, ratio };
    }, [dailyProcessed]);

    // تقسيم البيانات لنصفين (أيمن وأيسر) للتقرير المزدوج
    const dailySplit = useMemo(() => {
        const half = Math.ceil(dailyProcessed.length / 2);
        return {
            left: dailyProcessed.slice(0, half),
            right: dailyProcessed.slice(half)
        };
    }, [dailyProcessed]);

    // --- بيان التخصصات ---
    const specialtyReport = useMemo(() => {
        const specs = Array.from(new Set(employees.map(e => e.specialty)));
        return specs.map((spec, idx) => {
            const count = employees.filter(e => e.specialty === spec && (filterStatus === 'all' || e.status === filterStatus)).length;
            return { m: idx + 1, specialty: spec, count };
        }).filter(item => item.count > 0);
    }, [employees, filterStatus]);

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `تقرير_${view}_${date}`,
    });

    const toggleRow = (id: string) => {
        setSelectedRows(prev => prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]);
    };

    return (
        <div className="space-y-6 text-right pb-10" dir="rtl">
            {/* التبويبات */}
            <div className="flex bg-gray-100 p-1.5 rounded-2xl no-print overflow-x-auto shadow-inner border">
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
                        <label className="block text-[10px] font-black text-gray-400 mb-2">ترتيب حسب</label>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="w-full p-2.5 bg-gray-50 rounded-xl font-bold border-none ring-1 ring-gray-100">
                            <option value="name">الاسم</option>
                            <option value="specialty">التخصص</option>
                        </select>
                    </div>
                    {view === 'daily_io' && (
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-[10px] font-black text-gray-400 mb-2">تاريخ اليوم</label>
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                                className="w-full p-2.5 bg-gray-50 rounded-xl font-bold border-none ring-1 ring-gray-100 focus:ring-2 focus:ring-indigo-500" />
                        </div>
                    )}
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-black text-gray-400 mb-2">حالة الموظف</label>
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
                    <span className="text-xs font-black text-indigo-700">تعديل مقاس الخط للطباعة:</span>
                    <input type="range" min="7" max="14" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="w-32 accent-indigo-600" />
                    <span className="font-bold text-indigo-600 text-xs">{fontSize}px</span>
                </div>
            </div>

            {/* منطقة الطباعة */}
            <div ref={printRef} className="bg-white p-8 rounded-[2rem] border shadow-sm min-h-[1000px] print:p-0 print:border-0 print:shadow-none text-right" dir="rtl">
                <div className="hidden print:block mb-4 border-b-2 border-black pb-4 text-center">
                    <h1 className="text-xl font-black italic tracking-tighter">إدارة شمال الجيزة - مركز غرب المطار</h1>
                    <p className="text-sm font-bold mt-1">بيان: {view === 'daily_io' ? 'الحضور والغياب اليومي (تنسيق مزدوج)' : view.replace('_', ' ')} | التاريخ: {date}</p>
                </div>

                <div className="overflow-x-auto">
                    {view === 'staff_counts' ? (
                        <table className="w-full border-collapse border border-black" style={{ fontSize: `${fontSize}px` }}>
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="p-2 border border-black text-center w-16">م</th>
                                    <th className="p-2 border border-black text-right">التخصص</th>
                                    <th className="p-2 border border-black text-center">عدد الأطباء</th>
                                </tr>
                            </thead>
                            <tbody>
                                {specialtyReport.map((row, i) => (
                                    <tr key={i}>
                                        <td className="p-2 border border-black text-center font-mono">{row.m}</td>
                                        <td className="p-2 border border-black font-black">{row.specialty}</td>
                                        <td className="p-2 border border-black text-center font-black">{row.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : view === 'daily_io' ? (
                        <div className="flex gap-2 w-full">
                            {/* القسم الأيمن */}
                            <div className="w-1/2">
                                <table className="w-full border-collapse border border-black" style={{ fontSize: `${fontSize}px` }}>
                                    <thead>
                                        <tr className="bg-gray-100 text-[9px] font-black">
                                            <th className="border border-black p-1 w-10">كود</th>
                                            <th className="border border-black p-1 text-right">الاسم</th>
                                            <th className="border border-black p-1">تخصص</th>
                                            <th className="border border-black p-1">حضور</th>
                                            <th className="border border-black p-1">انصراف</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dailySplit.left.map((row) => (
                                            <tr key={row.employee_id} className={`h-6 ${!selectedRows.includes(row.employee_id) ? 'no-print hidden' : ''}`}>
                                                <td className="border border-black text-center font-mono">{row.employee_id}</td>
                                                <td className="border border-black pr-1 font-bold whitespace-nowrap overflow-hidden">{row.name.split(' ').slice(0,3).join(' ')}</td>
                                                <td className="border border-black text-center text-[8px]">{row.specialty.substring(0,10)}</td>
                                                <td className="border border-black text-center font-mono text-blue-800">{row.inTime}</td>
                                                <td className="border border-black text-center font-mono text-red-800">{row.outTime}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* القسم الأيسر */}
                            <div className="w-1/2">
                                <table className="w-full border-collapse border border-black" style={{ fontSize: `${fontSize}px` }}>
                                    <thead>
                                        <tr className="bg-gray-100 text-[9px] font-black">
                                            <th className="border border-black p-1 w-10">كود</th>
                                            <th className="border border-black p-1 text-right">الاسم</th>
                                            <th className="border border-black p-1">تخصص</th>
                                            <th className="border border-black p-1">حضور</th>
                                            <th className="border border-black p-1">انصراف</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dailySplit.right.map((row) => (
                                            <tr key={row.employee_id} className={`h-6 ${!selectedRows.includes(row.employee_id) ? 'no-print hidden' : ''}`}>
                                                <td className="border border-black text-center font-mono">{row.employee_id}</td>
                                                <td className="border border-black pr-1 font-bold whitespace-nowrap overflow-hidden">{row.name.split(' ').slice(0,3).join(' ')}</td>
                                                <td className="border border-black text-center text-[8px]">{row.specialty.substring(0,10)}</td>
                                                <td className="border border-black text-center font-mono text-blue-800">{row.inTime}</td>
                                                <td className="border border-black text-center font-mono text-red-800">{row.outTime}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        /* بيان القوة الفعلية */
                        <table className="w-full border-collapse border border-black" style={{ fontSize: `${fontSize}px` }}>
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="p-2 border border-black text-center no-print w-10"><CheckSquare size={16} /></th>
                                    <th className="p-2 border border-black text-center w-12">م</th>
                                    <th className="p-2 border border-black text-right">الاسم</th>
                                    <th className="p-2 border border-black text-center font-mono">الرقم القومي</th>
                                    <th className="p-2 border border-black text-center">التخصص</th>
                                    <th className="p-2 border border-black text-center font-mono">التليفون</th>
                                    <th className="p-2 border border-black text-center">الحالة</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staffReport.map((row, i) => {
                                    const isSelected = selectedRows.includes(row.employee_id);
                                    return (
                                        <tr key={row.employee_id} className={`${!isSelected ? 'no-print opacity-20' : ''}`}>
                                            <td className="p-2 border border-black text-center no-print">
                                                <button onClick={() => toggleRow(row.employee_id)}>
                                                    {isSelected ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} className="text-gray-300" />}
                                                </button>
                                            </td>
                                            <td className="p-2 border border-black text-center font-mono">{i + 1}</td>
                                            <td className="p-2 border border-black font-black">{row.name}</td>
                                            <td className="p-2 border border-black text-center font-mono">{row.national_id}</td>
                                            <td className="p-2 border border-black text-center">{row.specialty}</td>
                                            <td className="p-2 border border-black text-center font-mono">{row.phone}</td>
                                            <td className="p-2 border border-black text-center text-[10px] font-bold">{row.displayStatus}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* الإحصائيات المحدثة المطلوبة */}
                {view === 'daily_io' && (
                    <div className="mt-4 border-2 border-black p-3 bg-gray-50 grid grid-cols-4 gap-2 text-center font-black text-xs leading-relaxed">
                        <div className="border-l border-black">إجمالي الموظفين: {stats.total}</div>
                        <div className="border-l border-black text-emerald-700">إجمالي المتواجدين: {stats.present}</div>
                        <div className="border-l border-black text-red-700">إجمالي غير المتواجدين: {stats.absent}</div>
                        <div className="text-indigo-700 italic">نسبة التواجد: {stats.ratio}%</div>
                    </div>
                )}

                {/* التوقيعات */}
                <div className="mt-8 flex justify-between px-16 text-[10px] font-black">
                    <div className="text-center space-y-12"><p>مسئول البصمة</p><p className="border-b border-black w-24 mx-auto"></p></div>
                    <div className="text-center space-y-12"><p>شئون العاملين</p><p className="border-b border-black w-24 mx-auto"></p></div>
                    <div className="text-center space-y-12"><p>مدير المركز</p><p className="border-b border-black w-24 mx-auto"></p></div>
                </div>
            </div>
        </div>
    );
}
