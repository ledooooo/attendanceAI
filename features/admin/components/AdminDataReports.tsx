import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord } from '../../../types';
import { 
    Users, BarChart3, Clock, CalendarX, 
    Printer, Type, Settings2, CheckSquare, Square
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

interface Props { employees: Employee[] }

type ReportView = 'staff_names' | 'staff_counts' | 'daily_io' | 'monthly_absent';

export default function AdminDataReports({ employees }: Props) {
    const [view, setView] = useState<ReportView>('daily_io');
    const [loading, setLoading] = useState(false);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    
    const [fontSize, setFontSize] = useState(9);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortBy, setSortBy] = useState<'name' | 'specialty'>('name');

    const printRef = useRef(null);

    useEffect(() => {
        fetchData();
    }, [date, month]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: att } = await supabase.from('attendance')
                .select('*')
                .eq('date', date);
            setAttendance(att || []);
        } finally { setLoading(false); }
    };

    // معالجة البيانات والترتيب
    const processedData = useMemo(() => {
        return [...employees]
            .filter(e => filterStatus === 'all' || e.status === filterStatus)
            .sort((a, b) => {
                if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
                return a.specialty.localeCompare(b.specialty, 'ar');
            })
            .map(emp => {
                const att = attendance.find(a => a.employee_id === emp.employee_id);
                const times = att?.times?.split(/\s+/).filter(t => t.includes(':')) || [];
                return {
                    ...emp,
                    inTime: times[0] || '',
                    outTime: times.length > 1 ? times[times.length - 1] : ''
                };
            });
    }, [employees, attendance, date, filterStatus, sortBy]);

    // تقسيم البيانات لنصفين (يمين ويسار) للطباعة
    const splitData = useMemo(() => {
        const mid = Math.ceil(processedData.length / 2);
        return {
            left: processedData.slice(0, mid),
            right: processedData.slice(mid)
        };
    }, [processedData]);

    const stats = useMemo(() => ({
        total: processedData.length,
        present: processedData.filter(e => e.inTime !== '').length,
        absent: processedData.filter(e => e.inTime === '').length
    }), [processedData]);

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `الحضور_اليومي_${date}`,
    });

    return (
        <div className="space-y-4 text-right pb-10" dir="rtl">
            {/* التبويبات */}
            <div className="flex bg-gray-100 p-1 rounded-xl no-print overflow-x-auto border">
                {[
                    { id: 'daily_io', label: 'حضور وغياب يومي (A4)', icon: Clock },
                    { id: 'staff_names', label: 'بيان القوة الفعلية', icon: Users },
                    { id: 'staff_counts', label: 'بيان التخصصات', icon: BarChart3 },
                    { id: 'monthly_absent', label: 'غياب شهري', icon: CalendarX },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setView(tab.id as ReportView)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${view === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>
                        <tab.icon size={14} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* الفلاتر */}
            <div className="bg-white p-4 rounded-2xl border shadow-sm no-print flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[150px]">
                    <label className="block text-[10px] font-black text-gray-400 mb-1">ترتيب حسب</label>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="w-full p-2 bg-gray-50 rounded-lg text-xs font-bold border-none ring-1 ring-gray-100">
                        <option value="name">الاسم</option>
                        <option value="specialty">التخصص</option>
                    </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="block text-[10px] font-black text-gray-400 mb-1">التاريخ</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-2 bg-gray-50 rounded-lg text-xs font-bold border-none ring-1 ring-gray-100" />
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg border border-indigo-100">
                    <Type size={14} className="text-indigo-600" />
                    <input type="range" min="7" max="12" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="w-20 accent-indigo-600" />
                    <span className="text-[10px] font-bold text-indigo-600">{fontSize}px</span>
                </div>
                <button onClick={handlePrint} className="p-2.5 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors"><Printer size={18}/></button>
            </div>

            {/* منطقة الطباعة A4 */}
            <div ref={printRef} className="bg-white p-4 print:p-2 min-h-[297mm] text-right" dir="rtl">
                {/* هيدر الطباعة */}
                <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-4">
                    <div className="text-[10px] font-black leading-tight">
                        <p>مديرية الشئون الصحية بالجيزة</p>
                        <p>إدارة شمال الجيزة الصحية</p>
                        <p>مركز طبي غرب المطار</p>
                    </div>
                    <div className="text-center">
                        <h1 className="text-sm font-black underline">بيان الحضور والانصراف اليومي</h1>
                        <p className="text-[10px] mt-1 font-bold">التاريخ: {new Date(date).toLocaleDateString('ar-EG')}</p>
                    </div>
                    <div className="text-[9px] text-left font-bold">
                        <p>توقيت الطباعة: {new Date().toLocaleTimeString('ar-EG')}</p>
                    </div>
                </div>

                {/* الجداول بنظام النصفين */}
                <div className="flex gap-4 items-start">
                    {/* النصف الأيمن */}
                    <div className="flex-1">
                        <table className="w-full border-collapse" style={{ fontSize: `${fontSize}px` }}>
                            <thead>
                                <tr className="bg-gray-100 border-y border-black">
                                    <th className="border border-black p-1 w-8">كود</th>
                                    <th className="border border-black p-1 text-right">الاسم</th>
                                    <th className="border border-black p-1 text-center">التخصص</th>
                                    <th className="border border-black p-1 text-center">حضور</th>
                                    <th className="border border-black p-1 text-center">انصراف</th>
                                </tr>
                            </thead>
                            <tbody>
                                {splitData.left.map((row, i) => (
                                    <tr key={i} className="border-b border-black h-6">
                                        <td className="border border-black p-1 text-center font-mono">{row.employee_id}</td>
                                        <td className="border border-black p-1 font-bold text-[95%]">{row.name}</td>
                                        <td className="border border-black p-1 text-center truncate max-w-[60px]">{row.specialty}</td>
                                        <td className="border border-black p-1 text-center font-mono text-blue-800">{row.inTime}</td>
                                        <td className="border border-black p-1 text-center font-mono text-red-800">{row.outTime}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* النصف الأيسر */}
                    <div className="flex-1">
                        <table className="w-full border-collapse" style={{ fontSize: `${fontSize}px` }}>
                            <thead>
                                <tr className="bg-gray-100 border-y border-black">
                                    <th className="border border-black p-1 w-8">كود</th>
                                    <th className="border border-black p-1 text-right">الاسم</th>
                                    <th className="border border-black p-1 text-center">التخصص</th>
                                    <th className="border border-black p-1 text-center">حضور</th>
                                    <th className="border border-black p-1 text-center">انصراف</th>
                                </tr>
                            </thead>
                            <tbody>
                                {splitData.right.map((row, i) => (
                                    <tr key={i} className="border-b border-black h-6">
                                        <td className="border border-black p-1 text-center font-mono">{row.employee_id}</td>
                                        <td className="border border-black p-1 font-bold text-[95%]">{row.name}</td>
                                        <td className="border border-black p-1 text-center truncate max-w-[60px]">{row.specialty}</td>
                                        <td className="border border-black p-1 text-center font-mono text-blue-800">{row.inTime}</td>
                                        <td className="border border-black p-1 text-center font-mono text-red-800">{row.outTime}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* الإحصائيات والتوقيعات في الأسفل */}
                <div className="mt-6 border-t-2 border-black pt-4">
                    <div className="flex justify-around text-[11px] font-black bg-gray-50 py-2 border border-black rounded-lg">
                        <p>إجمالي الموظفين: {stats.total}</p>
                        <p>إجمالي الحضور: {stats.present}</p>
                        <p>إجمالي الغياب: {stats.absent}</p>
                    </div>

                    <div className="flex justify-between mt-12 px-10 text-[10px] font-black">
                        <div className="text-center">
                            <p>مسئول شئون العاملين</p>
                            <p className="mt-8">........................</p>
                        </div>
                        <div className="text-center">
                            <p>يعتمد،، مدير المركز</p>
                            <p className="mt-8">د/ ........................</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
