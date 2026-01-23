import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord } from '../../../types';
import { 
    Users, BarChart3, Clock, Printer, 
    CheckSquare, Square, Type, Loader2
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
// 1. ✅ استيراد React Query
import { useQuery } from '@tanstack/react-query';

interface Props { employees: Employee[] }

type ReportView = 'staff_names' | 'staff_counts' | 'daily_io';

export default function AdminDataReports({ employees }: Props) {
    const [view, setView] = useState<ReportView>('staff_names');
    
    // حالات الواجهة (UI State)
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [fontSize, setFontSize] = useState(8.5);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortBy, setSortBy] = useState<'name' | 'specialty'>('name');

    const printRef = useRef(null);

    // ------------------------------------------------------------------
    // 1. 📥 جلب بيانات الحضور باستخدام React Query
    // ------------------------------------------------------------------
    const { data: attendance = [], isLoading } = useQuery({
        queryKey: ['admin_daily_attendance', date], // مفتاح الكاش (يتغير بتغير التاريخ)
        queryFn: async () => {
            const { data } = await supabase
                .from('attendance')
                .select('*')
                .eq('date', date);
            return data as AttendanceRecord[] || [];
        },
        staleTime: 1000 * 60 * 5, // البيانات صالحة لمدة 5 دقائق
    });

    // ------------------------------------------------------------------
    // 2. 🔄 تحديث التحديد الافتراضي عند تغيير الفلاتر
    // ------------------------------------------------------------------
    useEffect(() => {
        if (employees) {
            const currentIds = employees
                .filter(e => filterStatus === 'all' || e.status === filterStatus)
                .map(e => e.employee_id);
            setSelectedRows(currentIds);
        }
    }, [employees, filterStatus]);

    // ------------------------------------------------------------------
    // 3. 🧮 العمليات الحسابية (Memoized Logic)
    // ------------------------------------------------------------------

    const toggleRow = (id: string) => {
        setSelectedRows(prev => 
            prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]
        );
    };

    const filteredEmployees = useMemo(() => {
        return employees
            .filter(e => filterStatus === 'all' || e.status === filterStatus)
            .sort((a, b) => {
                if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
                return a.specialty.localeCompare(b.specialty, 'ar');
            });
    }, [employees, filterStatus, sortBy]);

    const dailyProcessed = useMemo(() => {
        return filteredEmployees.map(emp => {
            const attRecord = attendance.find(a => String(a.employee_id) === String(emp.employee_id));
            let inT = '', outT = '';
            let isPresent = false;

            if (attRecord && attRecord.times) {
                const times = attRecord.times.split(/\s+/).filter(t => t.includes(':')) || [];
                if (times.length > 0) {
                    inT = times[0];
                    outT = times.length > 1 ? times[times.length - 1] : '';
                    isPresent = true; 
                }
            }
            return { ...emp, inTime: inT, outTime: outT, isPresent };
        });
    }, [filteredEmployees, attendance]);

    const stats = useMemo(() => {
        const activeList = dailyProcessed.filter(e => selectedRows.includes(e.employee_id));
        const total = activeList.length;
        const present = activeList.filter(e => e.isPresent).length;
        const absent = total - present;
        const ratio = total > 0 ? ((present / total) * 100).toFixed(1) : "0";
        return { total, present, absent, ratio };
    }, [dailyProcessed, selectedRows]);

    const dailySplit = useMemo(() => {
        const activeList = dailyProcessed.filter(e => selectedRows.includes(e.employee_id));
        const half = Math.ceil(activeList.length / 2);
        return {
            left: activeList.slice(0, half),
            right: activeList.slice(half)
        };
    }, [dailyProcessed, selectedRows]);

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
        documentTitle: `تقرير_اداري_${view}_${date}`,
    });

    return (
        <div className="space-y-4 text-right pb-10" dir="rtl">
            
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
            <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm no-print space-y-4">
                <div className="flex flex-wrap gap-6 items-end">
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-[10px] font-black text-gray-400 mb-1">ترتيب حسب</label>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="w-full p-2 bg-gray-50 rounded-xl font-bold border-none ring-1 ring-gray-100 text-sm">
                            <option value="name">الاسم الأبجدي</option>
                            <option value="specialty">التخصص</option>
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-black text-gray-400 mb-1">تاريخ التقرير</label>
                        <div className="relative">
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                                className="w-full p-2 bg-gray-50 rounded-xl font-bold border-none ring-1 ring-gray-100 text-sm focus:ring-2 focus:ring-indigo-500 pl-8" />
                            {isLoading && <Loader2 className="absolute left-2 top-2.5 w-4 h-4 animate-spin text-indigo-500" />}
                        </div>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-black text-gray-400 mb-1">حالة القيد</label>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-2 bg-gray-50 rounded-xl font-bold border-none ring-1 ring-gray-100 text-sm">
                            <option value="all">الكل</option>
                            <option value="نشط">قوة فعلية</option>
                            <option value="موقوف">موقوف</option>
                        </select>
                    </div>
                    <button onClick={handlePrint} className="p-3 bg-gray-900 text-white rounded-xl shadow-lg hover:scale-105 transition-transform"><Printer size={20}/></button>
                </div>

                <div className="flex items-center gap-4 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100">
                    <Type size={18} className="text-indigo-600" />
                    <span className="text-xs font-black text-indigo-700">تحكم في حجم خط الطباعة:</span>
                    <input type="range" min="6" max="12" step="0.5" value={fontSize} onChange={(e) => setFontSize(parseFloat(e.target.value))} className="w-48 accent-indigo-600" />
                    <span className="font-bold text-indigo-600 text-xs">{fontSize}px</span>
                </div>
            </div>

            {/* منطقة المعاينة والطباعة */}
            <div ref={printRef} className="bg-white p-6 rounded-[1.5rem] border shadow-sm min-h-[1100px] print:p-2 print:border-0 print:shadow-none text-right" dir="rtl">
                
                {/* هيدر الطباعة المحدث (سطر واحد) */}
                <div className="hidden print:block mb-4 border-b border-black pb-2 text-center">
                    <p className="text-[11px] font-black italic">
                        ادارة شمال الجيزة الصحية مركز غرب المطار - بيان التواجد يوم ({new Date(date).toLocaleDateString('ar-EG')}) الساعة ({new Date().toLocaleTimeString('ar-EG', {hour: '2-digit', minute: '2-digit'})})
                    </p>
                </div>

                <div className="overflow-x-auto">
                    {view === 'staff_counts' ? (
                        <div className="max-w-xl mx-auto">
                            <table className="w-full border-collapse border border-black" style={{ fontSize: `${fontSize + 1}px` }}>
                                <thead>
                                    <tr className="bg-gray-100 font-black">
                                        <th className="p-1 border border-black text-center w-12">م</th>
                                        <th className="p-1 border border-black text-right">التخصص الطبي</th>
                                        <th className="p-1 border border-black text-center w-24">العدد</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {specialtyReport.list.map((row, i) => (
                                        <tr key={i}>
                                            <td className="p-1 border border-black text-center font-mono">{row.m}</td>
                                            <td className="p-1 border border-black font-black pr-2">{row.specialty}</td>
                                            <td className="p-1 border border-black text-center font-black">{row.count}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-200 font-black border-t-2 border-black">
                                        <td className="p-1 border border-black text-center" colSpan={2}>الإجمالي العام للقوة المختارة</td>
                                        <td className="p-1 border border-black text-center">{specialtyReport.total}</td>
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
                                        <tr className="bg-gray-50 text-[9px] font-black">
                                            <th className="border border-black p-0.5 w-8">كود</th>
                                            <th className="border border-black p-0.5 text-right">اسم الموظف كاملاً</th>
                                            <th className="border border-black p-0.5 w-16">تخصص</th>
                                            <th className="border border-black p-0.5 w-12">حضور</th>
                                            <th className="border border-black p-0.5 w-12">انصراف</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dailySplit.left.map((row) => (
                                            <tr key={row.employee_id} className="h-[18px]">
                                                <td className="border border-black text-center font-mono text-[8px] p-0">{row.employee_id}</td>
                                                <td className="border border-black pr-1 font-bold whitespace-nowrap overflow-hidden text-[8px] p-0">{row.name}</td>
                                                <td className="border border-black text-center text-[7px] leading-none p-0">{row.specialty}</td>
                                                <td className="border border-black text-center font-mono text-blue-800 text-[8px] p-0">{row.inTime}</td>
                                                <td className="border border-black text-center font-mono text-red-800 text-[8px] p-0">{row.outTime}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* القسم الأيسر */}
                            <div className="w-1/2">
                                <table className="w-full border-collapse border border-black" style={{ fontSize: `${fontSize}px` }}>
                                    <thead>
                                        <tr className="bg-gray-50 text-[9px] font-black">
                                            <th className="border border-black p-0.5 w-8">كود</th>
                                            <th className="border border-black p-0.5 text-right">اسم الموظف كاملاً</th>
                                            <th className="border border-black p-0.5 w-16">تخصص</th>
                                            <th className="border border-black p-0.5 w-12">حضور</th>
                                            <th className="border border-black p-0.5 w-12">انصراف</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dailySplit.right.map((row) => (
                                            <tr key={row.employee_id} className="h-[18px]">
                                                <td className="border border-black text-center font-mono text-[8px] p-0">{row.employee_id}</td>
                                                <td className="border border-black pr-1 font-bold whitespace-nowrap overflow-hidden text-[8px] p-0">{row.name}</td>
                                                <td className="border border-black text-center text-[7px] leading-none p-0">{row.specialty}</td>
                                                <td className="border border-black text-center font-mono text-blue-800 text-[8px] p-0">{row.inTime}</td>
                                                <td className="border border-black text-center font-mono text-red-800 text-[8px] p-0">{row.outTime}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <table className="w-full border-collapse border border-black" style={{ fontSize: `${fontSize + 0.5}px` }}>
                            <thead>
                                <tr className="bg-gray-100 font-black h-8">
                                    <th className="p-1 border border-black text-center no-print w-10"><CheckSquare size={16} /></th>
                                    <th className="p-1 border border-black text-center w-10">م</th>
                                    <th className="p-1 border border-black text-right">اسم الموظف بالكامل</th>
                                    <th className="p-1 border border-black text-center font-mono w-32">الرقم القومي</th>
                                    <th className="p-1 border border-black text-center w-24">التخصص</th>
                                    <th className="p-1 border border-black text-center font-mono w-28">التليفون</th>
                                    <th className="p-1 border border-black text-center w-20">الحالة</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.map((row, i) => {
                                    const isSelected = selectedRows.includes(row.employee_id);
                                    return (
                                        <tr key={row.employee_id} className={`h-6 ${!isSelected ? 'no-print opacity-20' : ''}`}>
                                            <td className="p-0 border border-black text-center no-print">
                                                <button onClick={() => toggleRow(row.employee_id)}>
                                                    {isSelected ? <CheckSquare size={14} className="text-indigo-600" /> : <Square size={14} className="text-gray-300" />}
                                                </button>
                                            </td>
                                            <td className="p-0 border border-black text-center font-mono">{i + 1}</td>
                                            <td className="p-0 border border-black pr-2 font-bold">{row.name}</td>
                                            <td className="p-0 border border-black text-center font-mono">{row.national_id}</td>
                                            <td className="p-0 border border-black text-center">{row.specialty}</td>
                                            <td className="p-0 border border-black text-center font-mono">{row.phone}</td>
                                            <td className="p-0 border border-black text-center font-black text-[9px]">
                                                {row.status === 'نشط' ? 'قوة فعلية' : row.status}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* الإحصائيات السفلية (مضغوطة) */}
                {view === 'daily_io' && (
                    <div className="mt-2 border border-black p-1 bg-gray-50 flex justify-between px-10 text-center font-black text-[10px]">
                        <div>إجمالي القوة: {stats.total}</div>
                        <div className="text-emerald-800">المتواجدين: {stats.present}</div>
                        <div className="text-red-800">غير المتواجدين: {stats.absent}</div>
                        <div className="text-indigo-900 italic">نسبة الانضباط: {stats.ratio}%</div>
                    </div>
                )}

                {/* التوقيعات (مضغوطة) */}
                <div className="mt-6 flex justify-between px-16 text-[9px] font-black">
                    <div className="text-center">مسئول البصمة<br/>........</div>
                    <div className="text-center">شئون العاملين<br/>........</div>
                    <div className="text-center">مدير المركز<br/>........</div>
                </div>
            </div>
        </div>
    );
}
