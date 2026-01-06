import React, { useState, useMemo, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { 
    Database, Users, BarChart3, Clock, CalendarX, 
    FileText, Printer, Download, Search, Filter, ShieldAlert 
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
    
    // فلاتر
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [filterStatus, setFilterStatus] = useState('all');

    const printRef = useRef(null);

    // دالة جلب البيانات المساندة
    const fetchData = async (targetDate: string, isMonth = false) => {
        setLoading(true);
        const { data: att } = isMonth 
            ? await supabase.from('attendance').select('*').gte('date', `${targetDate}-01`).lte('date', `${targetDate}-31`)
            : await supabase.from('attendance').select('*').eq('date', targetDate);
        
        const { data: lvs } = await supabase.from('leave_requests').select('*').eq('status', 'مقبول');
        
        setAttendance(att || []);
        setLeaves(lvs || []);
        setLoading(false);
    };

    // --- 1. بيان القوة العاملة أسماء ---
    const staffNamesData = useMemo(() => {
        return employees.filter(e => filterStatus === 'all' || e.status === filterStatus);
    }, [employees, filterStatus]);

    // --- 2. بيان القوة العاملة أعداد ---
    const staffCountsData = useMemo(() => {
        const specs = Array.from(new Set(employees.map(e => e.specialty)));
        return specs.map(spec => {
            const list = employees.filter(e => e.specialty === spec);
            return {
                specialty: spec,
                total: list.length,
                active: list.filter(e => e.status === 'نشط').length,
                inactive: list.filter(e => e.status !== 'نشط').length
            };
        });
    }, [employees]);

    // --- 3. تقرير الحضور والغياب اليومي الشامل ---
    const dailyReport = useMemo(() => {
        return employees.map(emp => {
            const att = attendance.find(a => a.employee_id === emp.employee_id);
            const lve = leaves.find(l => l.employee_id === emp.employee_id && date >= l.start_date && date <= l.end_date);
            let status = 'غياب';
            if (att) status = (att.times?.split(' ').length > 1) ? 'حاضر' : 'ترك عمل';
            else if (lve) status = 'إجازة';
            return { ...emp, reportStatus: status };
        });
    }, [employees, attendance, leaves, date]);

    // --- وظائف الطباعة والتصدير ---
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `تقرير_${view}_${Date.now()}`,
    });

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(staffNamesData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, `Report_${view}.xlsx`);
    };

    return (
        <div className="space-y-6 text-right" dir="rtl">
            {/* أزرار التنقل الرئيسية */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 no-print">
                {[
                    { id: 'staff_names', label: 'أسماء القوة', icon: Users, color: 'blue' },
                    { id: 'staff_counts', label: 'أعداد القوة', icon: BarChart3, color: 'emerald' },
                    { id: 'daily_io', label: 'حضور وغياب', icon: Clock, color: 'indigo' },
                    { id: 'daily_absent', label: 'غياب يومي', icon: CalendarX, color: 'red' },
                    { id: 'monthly_absent', label: 'غياب شهري', icon: FileText, color: 'orange' },
                    { id: 'overtime', label: 'بدل راحات', icon: ShieldAlert, color: 'purple' },
                ].map(btn => (
                    <button 
                        key={btn.id}
                        onClick={() => { setView(btn.id as ReportView); if(btn.id.includes('daily')) fetchData(date); }}
                        className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${view === btn.id ? 'bg-white border-indigo-500 shadow-lg ring-2 ring-indigo-50' : 'bg-gray-50 border-transparent hover:bg-white'}`}
                    >
                        <btn.icon className={`w-6 h-6 text-${btn.color}-600`} />
                        <span className="text-[11px] font-black text-gray-700">{btn.label}</span>
                    </button>
                ))}
            </div>

            {/* أدوات التحكم (التاريخ والفلترة) */}
            <div className="bg-white p-4 rounded-[2rem] border border-gray-100 flex flex-wrap gap-4 items-end no-print">
                {(view.includes('daily') || view === 'overtime') && (
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-[10px] font-black text-gray-400 mb-1 mr-2">تاريخ البيان</label>
                        <input type="date" value={date} onChange={(e) => { setDate(e.target.value); fetchData(e.target.value); }} className="w-full p-2.5 bg-gray-50 rounded-xl font-bold border-none focus:ring-2 focus:ring-indigo-500/20" />
                    </div>
                )}
                {view === 'monthly_absent' && (
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-[10px] font-black text-gray-400 mb-1 mr-2">اختر الشهر</label>
                        <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); fetchData(e.target.value, true); }} className="w-full p-2.5 bg-gray-50 rounded-xl font-bold border-none focus:ring-2 focus:ring-indigo-500/20" />
                    </div>
                )}
                <div className="flex-1 min-w-[150px]">
                    <label className="block text-[10px] font-black text-gray-400 mb-1 mr-2">حالة القيد</label>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-2.5 bg-gray-50 rounded-xl font-bold border-none">
                        <option value="all">الكل</option>
                        <option value="نشط">نشط</option>
                        <option value="موقوف">موقوف</option>
                        <option value="خارج المركز">خارج المركز</option>
                    </select>
                </div>
                <div className="flex gap-2">
                    <button onClick={handlePrint} className="p-3 bg-gray-800 text-white rounded-xl hover:bg-black transition-all shadow-lg shadow-gray-200"><Printer size={20}/></button>
                    <button onClick={exportToExcel} className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"><Download size={20}/></button>
                </div>
            </div>

            {/* منطقة المعاينة والطباعة */}
            <div ref={printRef} className="bg-white p-8 rounded-[2.5rem] border shadow-sm min-h-[800px] print:p-0 print:border-0 print:shadow-none">
                
                {/* هيدر الطباعة الرسمي */}
                <div className="hidden print:flex flex-col items-center mb-10 border-b-4 border-double border-gray-800 pb-6 text-center">
                    <div className="flex justify-between w-full mb-4 items-center">
                        <div className="text-right text-xs font-black">
                            <p>وزارة الصحة والسكان</p>
                            <p>مديرية الشئون الصحية بالجيزة</p>
                            <p>إدارة شمال الجيزة الصحية</p>
                        </div>
                        <div className="w-20 h-20 border-2 border-gray-800 rounded-full flex items-center justify-center font-black text-xs">ختم المركز</div>
                        <div className="text-left text-xs font-black">
                            <p>مركز طبي غرب المطار</p>
                            <p>بيان: {view}</p>
                            <p>بتاريخ: {view.includes('monthly') ? month : date}</p>
                        </div>
                    </div>
                    <h1 className="text-2xl font-black underline decoration-2 underline-offset-8">ادارة شمال الجيزة - مركز غرب المطار</h1>
                    <p className="mt-4 text-[10px] text-gray-500">تم استخراج هذا التقرير بتاريخ {new Date().toLocaleString('ar-EG')}</p>
                </div>

                {/* عرض المحتوى حسب الزر المختار */}
                {view === 'staff_names' && (
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="bg-gray-100 border-y-2 border-gray-800">
                                <th className="p-3 border">الاسم</th>
                                <th className="p-3 border">التخصص</th>
                                <th className="p-3 border">الحالة</th>
                                <th className="p-3 border">الرقم القومي</th>
                                <th className="p-3 border">التليفون</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staffNamesData.map(e => (
                                <tr key={e.id} className="border-b">
                                    <td className="p-3 border font-black">{e.name}</td>
                                    <td className="p-3 border">{e.specialty}</td>
                                    <td className="p-3 border text-center">{e.status}</td>
                                    <td className="p-3 border font-mono">{e.national_id}</td>
                                    <td className="p-3 border font-mono text-center">{e.phone}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {view === 'staff_counts' && (
                    <div className="space-y-8">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-gray-100 border-y-2 border-gray-800">
                                    <th className="p-3 border text-right">التخصص</th>
                                    <th className="p-3 border text-center">العدد الإجمالي</th>
                                    <th className="p-3 border text-center">نشط</th>
                                    <th className="p-3 border text-center">أخرى (موقوف/خارج)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staffCountsData.map((row, i) => (
                                    <tr key={i} className="border-b">
                                        <td className="p-3 border font-black">{row.specialty}</td>
                                        <td className="p-3 border text-center font-black text-indigo-600">{row.total}</td>
                                        <td className="p-3 border text-center text-emerald-600 font-bold">{row.active}</td>
                                        <td className="p-3 border text-center text-red-400">{row.inactive}</td>
                                    </tr>
                                ))}
                                <tr className="bg-gray-50 font-black">
                                    <td className="p-4 border">الإجمالي العام</td>
                                    <td className="p-4 border text-center">{employees.length}</td>
                                    <td className="p-4 border text-center text-emerald-700">{employees.filter(e=>e.status==='نشط').length}</td>
                                    <td className="p-4 border text-center text-red-700">{employees.filter(e=>e.status!=='نشط').length}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {view === 'daily_io' && (
                    <div className="space-y-6">
                        {/* إحصائيات علوية سريعة للبيان */}
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <div className="p-4 bg-blue-50 border rounded-2xl text-center">
                                <span className="block text-2xl font-black text-blue-700">{dailyReport.filter(r=>r.reportStatus==='حاضر').length}</span>
                                <span className="text-[10px] font-bold">حضور</span>
                            </div>
                            <div className="p-4 bg-red-50 border rounded-2xl text-center">
                                <span className="block text-2xl font-black text-red-700">{dailyReport.filter(r=>r.reportStatus==='غياب').length}</span>
                                <span className="text-[10px] font-bold">غياب</span>
                            </div>
                            <div className="p-4 bg-orange-50 border rounded-2xl text-center">
                                <span className="block text-2xl font-black text-orange-700">{dailyReport.filter(r=>r.reportStatus==='إجازة').length}</span>
                                <span className="text-[10px] font-bold">إجازات</span>
                            </div>
                            <div className="p-4 bg-gray-50 border rounded-2xl text-center">
                                <span className="block text-2xl font-black text-gray-700">{((dailyReport.filter(r=>r.reportStatus==='غياب').length / employees.length)*100).toFixed(1)}%</span>
                                <span className="text-[10px] font-bold">نسبة الغياب</span>
                            </div>
                        </div>
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-100 border-y border-gray-800">
                                    <th className="p-2 border text-right">الاسم</th>
                                    <th className="p-2 border">التخصص</th>
                                    <th className="p-2 border">الحالة اليوم</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailyReport.map((r, i) => (
                                    <tr key={i} className="border-b">
                                        <td className="p-2 border font-bold">{r.name}</td>
                                        <td className="p-2 border">{r.specialty}</td>
                                        <td className={`p-2 border text-center font-black ${r.reportStatus==='حاضر'?'text-emerald-600':r.reportStatus==='غياب'?'text-red-600':'text-orange-500'}`}>{r.reportStatus}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* رسالة تذييل لجميع التقارير */}
                <div className="mt-12 hidden print:flex justify-between items-start px-10 font-black text-sm">
                    <div className="text-center">
                        <p>شئون العاملين</p>
                        <p className="mt-8">........................</p>
                    </div>
                    <div className="text-center">
                        <p>يعتمد،، مدير المركز</p>
                        <p className="mt-8">د/ ........................</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
