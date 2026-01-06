import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { 
    Database, Users, BarChart3, Clock, CalendarX, 
    FileText, Printer, Download, Search, Filter, ShieldAlert, X, CheckCircle2
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
    
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [filterStatus, setFilterStatus] = useState('all');

    const printRef = useRef(null);

    // تحديث البيانات تلقائياً عند تغيير التاريخ أو نوع التقرير
    useEffect(() => {
        if (['daily_io', 'daily_absent', 'overtime'].includes(view)) {
            fetchData(date, false);
        } else if (view === 'monthly_absent') {
            fetchData(month, true);
        }
    }, [view, date, month]);

    const fetchData = async (targetDate: string, isMonth = false) => {
        setLoading(true);
        try {
            let attQuery = supabase.from('attendance').select('*');
            if (isMonth) {
                attQuery = attQuery.gte('date', `${targetDate}-01`).lte('date', `${targetDate}-31`);
            } else {
                attQuery = attQuery.eq('date', targetDate);
            }
            
            const { data: att } = await attQuery;
            const { data: lvs } = await supabase.from('leave_requests').select('*').eq('status', 'مقبول');
            
            setAttendance(att || []);
            setLeaves(lvs || []);
        } finally {
            setLoading(false);
        }
    };

    // --- منطق التقارير ---

    // 1. بيان القوة (أسماء)
    const staffNamesData = useMemo(() => employees.filter(e => filterStatus === 'all' || e.status === filterStatus), [employees, filterStatus]);

    // 2. بيان القوة (أعداد)
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

    // 3. تقرير الحضور والغياب اليومي + الغياب اليومي
    const dailyFullReport = useMemo(() => {
        return employees.map(emp => {
            const att = attendance.find(a => a.employee_id === emp.employee_id);
            const lve = leaves.find(l => l.employee_id === emp.employee_id && date >= l.start_date && date <= l.end_date);
            
            let status = 'غياب';
            let inTime = '-', outTime = '-';
            
            if (att) {
                const times = att.times?.split(/\s+/).filter(t => t.includes(':')) || [];
                inTime = times[0] || '-';
                outTime = times.length > 1 ? times[times.length - 1] : '-';
                status = outTime !== '-' ? 'حاضر' : 'ترك عمل';
            } else if (lve) {
                status = 'إجازة';
            }
            return { ...emp, reportStatus: status, inTime, outTime, leaveType: lve?.type };
        }).filter(item => filterStatus === 'all' || item.status === filterStatus);
    }, [employees, attendance, leaves, date, filterStatus]);

    // 4. تقرير بدل الراحات (أكثر من 9 ساعات أو عطلات)
    const overtimeReport = useMemo(() => {
        return dailyFullReport.filter(emp => {
            if (emp.inTime === '-' || emp.outTime === '-') return false;
            const start = new Date(`${date}T${emp.inTime}`);
            const end = new Date(`${date}T${emp.outTime}`);
            const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            const isWeekend = new Date(date).getDay() === 5 || new Date(date).getDay() === 6; // جمعة وسبت
            return diffHours > 9 || isWeekend;
        });
    }, [dailyFullReport, date]);

    // --- وظائف الطباعة والتصدير ---
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `تقرير_${view}_${Date.now()}`,
    });

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(dailyFullReport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, `Report_${view}.xlsx`);
    };

    return (
        <div className="space-y-6 text-right" dir="rtl">
            {/* أزرار التنقل */}
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
                        onClick={() => setView(btn.id as ReportView)}
                        className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${view === btn.id ? 'bg-white border-indigo-500 shadow-lg ring-2 ring-indigo-50' : 'bg-gray-50 border-transparent hover:bg-white'}`}
                    >
                        <btn.icon className={view === btn.id ? `text-indigo-600` : `text-gray-400`} size={24} />
                        <span className="text-[11px] font-black text-gray-700">{btn.label}</span>
                    </button>
                ))}
            </div>

            {/* الفلاتر */}
            <div className="bg-white p-5 rounded-[2rem] border border-gray-100 flex flex-wrap gap-4 items-end no-print shadow-sm">
                {['daily_io', 'daily_absent', 'overtime'].includes(view) && (
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-[10px] font-black text-gray-400 mb-1 mr-2">تاريخ اليوم</label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-2.5 bg-gray-50 rounded-xl font-bold border-none" />
                    </div>
                )}
                {view === 'monthly_absent' && (
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-[10px] font-black text-gray-400 mb-1 mr-2">اختر الشهر</label>
                        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full p-2.5 bg-gray-50 rounded-xl font-bold border-none" />
                    </div>
                )}
                <div className="flex-1 min-w-[150px]">
                    <label className="block text-[10px] font-black text-gray-400 mb-1 mr-2">حالة القيد</label>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-2.5 bg-gray-50 rounded-xl font-bold border-none">
                        <option value="all">كل الحالات</option>
                        <option value="نشط">نشط</option>
                        <option value="موقوف">موقوف</option>
                        <option value="خارج المركز">خارج المركز</option>
                    </select>
                </div>
                <div className="flex gap-2">
                    <button onClick={handlePrint} className="p-3 bg-gray-800 text-white rounded-xl shadow-lg"><Printer size={20}/></button>
                    <button onClick={exportToExcel} className="p-3 bg-emerald-600 text-white rounded-xl shadow-lg"><Download size={20}/></button>
                </div>
            </div>

            {/* منطقة الطباعة */}
            <div ref={printRef} className="bg-white p-10 rounded-[2.5rem] border shadow-sm min-h-[1000px] print:p-0">
                
                {/* الترويسة الرسمية */}
                <div className="hidden print:block mb-10">
                    <div className="flex justify-between items-start border-b-2 border-gray-900 pb-6">
                        <div className="text-right text-xs font-black space-y-1">
                            <p>محافظة الجيزة</p>
                            <p>مديرية الشئون الصحية</p>
                            <p>إدارة شمال الجيزة الصحية</p>
                            <p>مركز طبي غرب المطار</p>
                        </div>
                        <div className="text-center">
                            <h1 className="text-xl font-black">بيان مصلحي رسمي</h1>
                            <p className="text-sm font-bold mt-2">نوع البيان: {view}</p>
                        </div>
                        <div className="text-left text-xs font-black space-y-1">
                            <p>تاريخ البيان: {view === 'monthly_absent' ? month : date}</p>
                            <p>وقت الطباعة: {new Date().toLocaleTimeString('ar-EG')}</p>
                        </div>
                    </div>
                </div>

                {/* 1. أسماء القوة */}
                {view === 'staff_names' && (
                    <table className="w-full text-xs border-collapse">
                        <thead>
                            <tr className="bg-gray-100 border-y-2 border-black">
                                <th className="p-3 border">الاسم</th>
                                <th className="p-3 border">التخصص</th>
                                <th className="p-3 border">الحالة</th>
                                <th className="p-3 border">الرقم القومي</th>
                                <th className="p-3 border">التليفون</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staffNamesData.map((e, i) => (
                                <tr key={i} className="border-b">
                                    <td className="p-3 border font-bold">{e.name}</td>
                                    <td className="p-3 border">{e.specialty}</td>
                                    <td className="p-3 border text-center">{e.status}</td>
                                    <td className="p-3 border font-mono">{e.national_id}</td>
                                    <td className="p-3 border font-mono">{e.phone}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* 2. أعداد القوة */}
                {view === 'staff_counts' && (
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-y-2 border-black">
                                <th className="p-4 border text-right">التخصص</th>
                                <th className="p-4 border">إجمالي العدد</th>
                                <th className="p-4 border text-emerald-600">نشط</th>
                                <th className="p-4 border text-red-500">موقوف/خارج</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staffCountsData.map((row, i) => (
                                <tr key={i} className="border-b font-bold">
                                    <td className="p-4 border">{row.specialty}</td>
                                    <td className="p-4 border text-center">{row.total}</td>
                                    <td className="p-4 border text-center">{row.active}</td>
                                    <td className="p-4 border text-center">{row.inactive}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* 3. حضور وغياب يومي شامل */}
                {view === 'daily_io' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-4 mb-8 text-center no-print">
                            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                <span className="block text-2xl font-black text-emerald-700">{dailyFullReport.filter(r=>r.reportStatus==='حاضر').length}</span>
                                <span className="text-xs font-bold">إجمالي الحضور</span>
                            </div>
                            <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                                <span className="block text-2xl font-black text-red-700">{dailyFullReport.filter(r=>r.reportStatus==='غياب').length}</span>
                                <span className="text-xs font-bold">إجمالي الغياب</span>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                <span className="block text-2xl font-black text-blue-700">{dailyFullReport.filter(r=>r.reportStatus==='إجازة').length}</span>
                                <span className="text-xs font-bold">إجمالي الإجازات</span>
                            </div>
                        </div>
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-100 border-y-2 border-black">
                                    <th className="p-3 border">الاسم</th>
                                    <th className="p-3 border">التخصص</th>
                                    <th className="p-3 border">الحضور</th>
                                    <th className="p-3 border">الانصراف</th>
                                    <th className="p-3 border">الحالة</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailyFullReport.map((r, i) => (
                                    <tr key={i} className="border-b">
                                        <td className="p-3 border font-bold">{r.name}</td>
                                        <td className="p-3 border">{r.specialty}</td>
                                        <td className="p-3 border text-center font-mono">{r.inTime}</td>
                                        <td className="p-3 border text-center font-mono">{r.outTime}</td>
                                        <td className={`p-3 border text-center font-black ${r.reportStatus==='حاضر'?'text-emerald-600':r.reportStatus==='غياب'?'text-red-600':'text-blue-600'}`}>{r.reportStatus}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* 4. غياب يومي فقط */}
                {view === 'daily_absent' && (
                    <table className="w-full text-xs border-collapse">
                        <thead>
                            <tr className="bg-red-50 border-y-2 border-red-900">
                                <th className="p-3 border text-red-900">الاسم</th>
                                <th className="p-3 border text-red-900">التخصص</th>
                                <th className="p-3 border text-red-900">الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dailyFullReport.filter(r => r.reportStatus === 'غياب').map((r, i) => (
                                <tr key={i} className="border-b">
                                    <td className="p-3 border font-bold">{r.name}</td>
                                    <td className="p-3 border">{r.specialty}</td>
                                    <td className="p-3 border text-center text-red-600 font-black">غائب</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* 5. بدل راحات */}
                {view === 'overtime' && (
                    <table className="w-full text-xs border-collapse">
                        <thead>
                            <tr className="bg-purple-50 border-y-2 border-purple-900">
                                <th className="p-3 border text-purple-900">الاسم</th>
                                <th className="p-3 border text-purple-900">التخصص</th>
                                <th className="p-3 border text-purple-900">ساعات العمل</th>
                                <th className="p-3 border text-purple-900">السبب</th>
                            </tr>
                        </thead>
                        <tbody>
                            {overtimeReport.map((r, i) => {
                                const isWeekend = new Date(date).getDay() === 5 || new Date(date).getDay() === 6;
                                return (
                                    <tr key={i} className="border-b font-bold">
                                        <td className="p-3 border">{r.name}</td>
                                        <td className="p-3 border">{r.specialty}</td>
                                        <td className="p-3 border text-center">{r.inTime} - {r.outTime}</td>
                                        <td className="p-3 border text-center">{isWeekend ? 'عمل بعطلة رسمية' : 'ساعات إضافية'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}

                {/* التذييل */}
                <div className="mt-20 hidden print:flex justify-between px-10 text-sm font-black">
                    <div className="text-center space-y-12">
                        <p>مسئول شئون العاملين</p>
                        <p>........................</p>
                    </div>
                    <div className="text-center space-y-12">
                        <p>مدير المركز</p>
                        <p>........................</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
