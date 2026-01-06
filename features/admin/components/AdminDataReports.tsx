import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { 
    Database, Users, BarChart3, Clock, CalendarX, 
    FileText, Printer, Download, Search, Filter, ShieldAlert, 
    TrendingUp, PieChart, Info
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

    // --- جلب البيانات ---
    useEffect(() => {
        const isMonth = view === 'monthly_absent';
        fetchData(isMonth ? month : date, isMonth);
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
            const { data: lvs } = await supabase.from('leave_requests').select('*');
            setAttendance(att || []);
            setLeaves(lvs || []);
        } finally {
            setLoading(false);
        }
    };

    // --- المحرك البرمجي (Data Logic) ---

    // 1. بيان القوة أسماء
    const staffNamesReport = useMemo(() => {
        return employees
            .filter(e => filterStatus === 'all' || e.status === filterStatus)
            .map((e, idx) => ({ ...e, index: idx + 1 }));
    }, [employees, filterStatus]);

    // 2. بيان القوة أعداد
    const staffCountsReport = useMemo(() => {
        const specs = Array.from(new Set(employees.map(e => e.specialty)));
        return specs.map((spec, idx) => {
            const list = employees.filter(e => e.specialty === spec);
            return {
                m: idx + 1,
                specialty: spec,
                total: list.length,
                active: list.filter(e => e.status === 'نشط').length,
                suspended: list.filter(e => e.status === 'موقوف').length,
                vacation: list.filter(e => e.status === 'اجازة').length,
                outside: list.filter(e => e.status === 'خارج المركز').length
            };
        });
    }, [employees]);

    // 3. التقرير اليومي الشامل (حضور/غياب/طلبات)
    const dailyProcessed = useMemo(() => {
        return employees.map(emp => {
            const att = attendance.find(a => a.employee_id === emp.employee_id);
            const lve = leaves.find(l => 
                l.employee_id === emp.employee_id && 
                date >= l.start_date && date <= l.end_date
            );
            
            let status = 'غياب';
            let inT = '-', outT = '-';
            
            if (att) {
                const times = att.times?.split(/\s+/).filter(t => t.includes(':')) || [];
                inT = times[0] || '-';
                outT = times.length > 1 ? times[times.length - 1] : '-';
                status = (inT !== '-' && outT !== '-') ? 'حاضر' : (inT !== '-' ? 'ترك عمل' : 'غياب');
            } else if (lve) {
                status = 'طلب/إجازة';
            }

            return { ...emp, reportStatus: status, inTime: inT, outTime: outT, leaveNote: lve ? `${lve.type} (${lve.status})` : '' };
        }).filter(e => filterStatus === 'all' || e.status === filterStatus);
    }, [employees, attendance, leaves, date, filterStatus]);

    // إحصائيات التخصصات (نسبة الغياب)
    const specialtyStats = useMemo(() => {
        const specs = Array.from(new Set(dailyProcessed.map(e => e.specialty)));
        return specs.map(s => {
            const group = dailyProcessed.filter(e => e.specialty === s);
            const absent = group.filter(e => e.reportStatus === 'غياب').length;
            return { name: s, ratio: ((absent / group.length) * 100).toFixed(1) };
        });
    }, [dailyProcessed]);

    // 4. تقرير الغياب الشهري (استبعاد الطلبات المقبولة فقط)
    const monthlyAbsentReport = useMemo(() => {
        const daysInMonth = new Date(month.split('-')[0] as any, month.split('-')[1] as any, 0).getDate();
        return employees.map((emp, idx) => {
            const empAttDates = attendance.filter(a => a.employee_id === emp.employee_id).map(a => a.date);
            const empLeaveDates = leaves
                .filter(l => l.employee_id === emp.employee_id && l.status === 'مقبول')
                .flatMap(l => {
                    const dates = [];
                    let curr = new Date(l.start_date);
                    while (curr <= new Date(l.end_date)) {
                        dates.push(curr.toISOString().split('T')[0]);
                        curr.setDate(curr.getDate() + 1);
                    }
                    return dates;
                });

            const absentDays: string[] = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const checkDate = `${month}-${d.toString().padStart(2, '0')}`;
                const dayOfWeek = new Date(checkDate).getDay();
                if (dayOfWeek === 5) continue; // استبعاد الجمعة من الغياب
                
                if (!empAttDates.includes(checkDate) && !empLeaveDates.includes(checkDate)) {
                    absentDays.push(d.toString());
                }
            }
            return { ...emp, m: idx + 1, absentCount: absentDays.length, days: absentDays.join(', ') };
        }).filter(e => e.absentCount > 0);
    }, [employees, attendance, leaves, month]);

    // 5. بدل الراحات
    const overtimeReport = useMemo(() => {
        return dailyProcessed.filter(emp => {
            if (emp.inTime === '-' || emp.outTime === '-') return false;
            const [h1, m1] = emp.inTime.split(':').map(Number);
            const [h2, m2] = emp.outTime.split(':').map(Number);
            const diff = (h2 + m2/60) - (h1 + m1/60);
            const isWeekend = new Date(date).getDay() === 5 || new Date(date).getDay() === 6;
            return diff > 9 || isWeekend;
        }).map((e, idx) => ({ ...e, m: idx + 1 }));
    }, [dailyProcessed, date]);

    // --- الطباعة والتصدير ---
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `مركز_غرب_المطار_${view}`,
    });

    const exportToExcel = () => {
        const data = view === 'monthly_absent' ? monthlyAbsentReport : dailyProcessed;
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, `Report_${view}_${date}.xlsx`);
    };

    return (
        <div className="space-y-6 text-right pb-10" dir="rtl">
            {/* القائمة العلوية (Buttons) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 no-print">
                {[
                    { id: 'staff_names', label: 'أسماء القوة', icon: Users, color: 'blue' },
                    { id: 'staff_counts', label: 'أعداد القوة', icon: BarChart3, color: 'emerald' },
                    { id: 'daily_io', label: 'حضور وغياب', icon: Clock, color: 'indigo' },
                    { id: 'daily_absent', label: 'غياب اليوم', icon: CalendarX, color: 'red' },
                    { id: 'monthly_absent', label: 'غياب الشهر', icon: FileText, color: 'orange' },
                    { id: 'overtime', label: 'بدل الراحات', icon: ShieldAlert, color: 'purple' },
                ].map(btn => (
                    <button key={btn.id} onClick={() => setView(btn.id as ReportView)}
                        className={`p-4 rounded-[1.5rem] border-2 flex flex-col items-center gap-3 transition-all ${view === btn.id ? 'bg-white border-indigo-600 shadow-xl scale-105' : 'bg-gray-50 border-transparent hover:bg-white'}`}>
                        <div className={`p-2 rounded-xl bg-${btn.color}-50 text-${btn.color}-600`}><btn.icon size={28} /></div>
                        <span className="text-xs font-black text-gray-800">{btn.label}</span>
                    </button>
                ))}
            </div>

            {/* الفلاتر الذكية */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 flex flex-wrap gap-6 items-end no-print shadow-sm">
                {view !== 'monthly_absent' && view !== 'staff_names' && view !== 'staff_counts' && (
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-black text-gray-400 mb-2 mr-2">تاريخ التقرير</label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-3 bg-gray-50 rounded-2xl font-bold border-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500" />
                    </div>
                )}
                {view === 'monthly_absent' && (
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-black text-gray-400 mb-2 mr-2">اختر الشهر</label>
                        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full p-3 bg-gray-50 rounded-2xl font-bold border-none ring-1 ring-gray-200" />
                    </div>
                )}
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-black text-gray-400 mb-2 mr-2">تصفية حسب الحالة</label>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-3 bg-gray-50 rounded-2xl font-bold border-none ring-1 ring-gray-200">
                        <option value="all">كل الموظفين</option>
                        <option value="نشط">نشط</option>
                        <option value="موقوف">موقوف</option>
                        <option value="اجازة">اجازة</option>
                        <option value="خارج المركز">خارج المركز</option>
                    </select>
                </div>
                <div className="flex gap-3">
                    <button onClick={handlePrint} className="p-4 bg-gray-900 text-white rounded-2xl shadow-lg hover:bg-black transition-all"><Printer size={22}/></button>
                    <button onClick={exportToExcel} className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg hover:bg-emerald-700 transition-all"><Download size={22}/></button>
                </div>
            </div>

            {/* --- منطقة المعاينة والطباعة (Layout A4) --- */}
            <div ref={printRef} className="bg-white p-12 rounded-[3rem] border shadow-sm min-h-[1000px] print:p-0 print:border-0 print:shadow-none">
                
                {/* هيدر الطباعة الرسمي */}
                <div className="hidden print:block mb-12 border-b-4 border-double border-black pb-8">
                    <div className="flex justify-between items-start">
                        <div className="text-right text-[12px] font-black space-y-1">
                            <p>وزارة الصحة والسكان</p>
                            <p>مديرية الشئون الصحية بالجيزة</p>
                            <p>إدارة شمال الجيزة الصحية</p>
                            <p>مركز طبي غرب المطار</p>
                        </div>
                        <div className="text-center space-y-2">
                            <h1 className="text-2xl font-black">إدارة شمال الجيزة - مركز غرب المطار</h1>
                            <div className="px-4 py-1 bg-gray-100 rounded-full inline-block text-sm font-black">
                                {view === 'staff_names' ? 'بيان القوة العاملة (أسماء)' : 
                                 view === 'staff_counts' ? 'بيان القوة العاملة (إحصائي)' :
                                 view === 'daily_io' ? 'بيان الحضور والغياب اليومي' :
                                 view === 'daily_absent' ? 'بيان المتغيبين عن العمل' :
                                 view === 'monthly_absent' ? 'بيان غياب الموظفين الشهري' : 'بيان ساعات العمل الإضافية'}
                            </div>
                        </div>
                        <div className="text-left text-[11px] font-bold space-y-1">
                            <p>تاريخ البيان: {view === 'monthly_absent' ? month : date}</p>
                            <p>توقيت الاستخراج: {new Date().toLocaleTimeString('ar-EG')}</p>
                            <p>تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG')}</p>
                        </div>
                    </div>
                </div>

                {/* 1. أسماء القوة العاملة */}
                {view === 'staff_names' && (
                    <table className="w-full text-[11px] border-collapse">
                        <thead>
                            <tr className="bg-gray-100 border-y-2 border-black">
                                <th className="p-2 border">م</th>
                                <th className="p-2 border text-right">الاسم</th>
                                <th className="p-2 border">التخصص</th>
                                <th className="p-2 border">الوظيفة</th>
                                <th className="p-2 border">الحالة</th>
                                <th className="p-2 border">الرقم القومي</th>
                                <th className="p-2 border">التليفون</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staffNamesReport.map((e, i) => (
                                <tr key={i} className="border-b">
                                    <td className="p-2 border text-center">{i+1}</td>
                                    <td className="p-2 border font-black">{e.name}</td>
                                    <td className="p-2 border text-center">{e.specialty}</td>
                                    <td className="p-2 border text-center">{e.role}</td>
                                    <td className="p-2 border text-center">{e.status}</td>
                                    <td className="p-2 border text-center font-mono">{e.national_id}</td>
                                    <td className="p-2 border text-center font-mono">{e.phone}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* 2. أعداد القوة العاملة */}
                {view === 'staff_counts' && (
                    <div className="space-y-10">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-gray-100 border-y-2 border-black">
                                    <th className="p-3 border">م</th>
                                    <th className="p-3 border text-right">التخصص</th>
                                    <th className="p-3 border text-center">الإجمالي</th>
                                    <th className="p-3 border text-emerald-600">نشط</th>
                                    <th className="p-3 border text-red-600">موقوف</th>
                                    <th className="p-3 border text-orange-600">إجازة</th>
                                    <th className="p-3 border text-gray-500">خارج المركز</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staffCountsReport.map((row, i) => (
                                    <tr key={i} className="border-b font-bold text-center">
                                        <td className="p-3 border">{i+1}</td>
                                        <td className="p-3 border text-right">{row.specialty}</td>
                                        <td className="p-3 border bg-gray-50">{row.total}</td>
                                        <td className="p-3 border">{row.active}</td>
                                        <td className="p-3 border">{row.suspended}</td>
                                        <td className="p-3 border">{row.vacation}</td>
                                        <td className="p-3 border">{row.outside}</td>
                                    </tr>
                                ))}
                                <tr className="bg-gray-900 text-white font-black text-center">
                                    <td className="p-4 border" colSpan={2}>الإجمالي العام للمركز</td>
                                    <td className="p-4 border">{employees.length}</td>
                                    <td className="p-4 border">{employees.filter(e=>e.status==='نشط').length}</td>
                                    <td className="p-4 border">{employees.filter(e=>e.status==='موقوف').length}</td>
                                    <td className="p-4 border">{employees.filter(e=>e.status==='اجازة').length}</td>
                                    <td className="p-4 border">{employees.filter(e=>e.status==='خارج المركز').length}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* 3. حضور وغياب يومي شامل */}
                {view === 'daily_io' && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <div className="p-4 border-2 border-indigo-600 rounded-3xl text-center">
                                <span className="block text-2xl font-black">{dailyProcessed.filter(r=>r.reportStatus==='حاضر').length}</span>
                                <span className="text-xs font-bold text-indigo-600">حاضر (بصمتين)</span>
                            </div>
                            <div className="p-4 border-2 border-red-600 rounded-3xl text-center">
                                <span className="block text-2xl font-black">{dailyProcessed.filter(r=>r.reportStatus==='غياب').length}</span>
                                <span className="text-xs font-bold text-red-600">غائب (بدون بصمة)</span>
                            </div>
                            <div className="p-4 border-2 border-orange-500 rounded-3xl text-center">
                                <span className="block text-2xl font-black">{dailyProcessed.filter(r=>r.reportStatus==='طلب/إجازة').length}</span>
                                <span className="text-xs font-bold text-orange-600">طلبات وإجازات</span>
                            </div>
                            <div className="p-4 border-2 border-gray-400 rounded-3xl text-center">
                                <span className="block text-2xl font-black">{((dailyProcessed.filter(r=>r.reportStatus==='غياب').length / dailyProcessed.length)*100).toFixed(1)}%</span>
                                <span className="text-xs font-bold text-gray-500">نسبة الغياب العامة</span>
                            </div>
                        </div>

                        {/* إحصائيات التخصصات (طلب إضافي) */}
                        <div className="bg-gray-50 p-4 rounded-2xl grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] font-black">
                            {specialtyStats.map((s, i) => (
                                <div key={i} className="flex justify-between border-b pb-1">
                                    <span className="text-gray-500">{s.name}:</span>
                                    <span className="text-red-600">غياب {s.ratio}%</span>
                                </div>
                            ))}
                        </div>

                        <table className="w-full text-[10px] border-collapse">
                            <thead>
                                <tr className="bg-gray-100 border-y-2 border-black">
                                    <th className="p-2 border">م</th>
                                    <th className="p-2 border text-right">الاسم</th>
                                    <th className="p-2 border">التخصص</th>
                                    <th className="p-2 border">الحضور</th>
                                    <th className="p-2 border">الانصراف</th>
                                    <th className="p-2 border">الحالة اليوم</th>
                                    <th className="p-2 border">ملاحظات الطلب</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailyProcessed.map((r, i) => (
                                    <tr key={i} className="border-b">
                                        <td className="p-2 border text-center">{i+1}</td>
                                        <td className="p-2 border font-bold text-gray-800">{r.name}</td>
                                        <td className="p-2 border text-center">{r.specialty}</td>
                                        <td className="p-2 border text-center font-mono">{r.inTime}</td>
                                        <td className="p-2 border text-center font-mono">{r.outTime}</td>
                                        <td className={`p-2 border text-center font-black ${r.reportStatus==='حاضر'?'text-emerald-600':r.reportStatus==='غياب'?'text-red-600':'text-blue-600'}`}>{r.reportStatus}</td>
                                        <td className="p-2 border text-[9px] text-gray-500">{r.leaveNote}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* 4. غياب شهري تفصيلي */}
                {view === 'monthly_absent' && (
                    <div className="space-y-6">
                        <div className="p-4 bg-orange-50 rounded-2xl border border-orange-200 text-orange-800 text-xs font-bold flex gap-2 items-center">
                            <Info size={16}/> ملاحظة: تم استبعاد أيام الجمعة والطلبات المعتمدة (مقبول) من حساب أيام الغياب.
                        </div>
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-100 border-y-2 border-black">
                                    <th className="p-3 border">م</th>
                                    <th className="p-3 border text-right">اسم الموظف</th>
                                    <th className="p-3 border">التخصص</th>
                                    <th className="p-3 border text-center">إجمالي أيام الغياب</th>
                                    <th className="p-3 border text-right">تواريخ أيام الغياب (أيام الشهر)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {monthlyAbsentReport.map((r, i) => (
                                    <tr key={i} className="border-b">
                                        <td className="p-3 border text-center">{i+1}</td>
                                        <td className="p-3 border font-black text-gray-800">{r.name}</td>
                                        <td className="p-3 border text-center">{r.specialty}</td>
                                        <td className="p-3 border text-center font-black text-red-600">{r.absentCount} يوم</td>
                                        <td className="p-3 border text-right font-mono text-gray-600">{r.days}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* 5. بدل راحات (9 ساعات أو جمعة/سبت) */}
                {view === 'overtime' && (
                    <table className="w-full text-xs border-collapse">
                        <thead>
                            <tr className="bg-purple-50 border-y-2 border-purple-900">
                                <th className="p-3 border text-purple-900">م</th>
                                <th className="p-3 border text-purple-900 text-right">الاسم</th>
                                <th className="p-3 border text-purple-900">التخصص</th>
                                <th className="p-3 border text-purple-900">فترة العمل</th>
                                <th className="p-3 border text-purple-900">السبب المستحق</th>
                            </tr>
                        </thead>
                        <tbody>
                            {overtimeReport.map((r, i) => {
                                const isWeekend = new Date(date).getDay() === 5 || new Date(date).getDay() === 6;
                                return (
                                    <tr key={i} className="border-b font-bold text-center">
                                        <td className="p-3 border">{i+1}</td>
                                        <td className="p-3 border text-right">{r.name}</td>
                                        <td className="p-3 border">{r.specialty}</td>
                                        <td className="p-3 border font-mono">{r.inTime} إلى {r.outTime}</td>
                                        <td className="p-3 border text-purple-700">{isWeekend ? 'عمل بعطلة رسمية' : 'تجاوز 9 ساعات عمل'}</td>
                                    </tr>
                                );
                            })}
                            {overtimeReport.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-gray-400">لا يوجد مستحقين لبدل راحات في هذا التاريخ</td></tr>}
                        </tbody>
                    </table>
                )}

                {/* التذييل الرسمي */}
                <div className="mt-20 hidden print:flex justify-between px-12 text-sm font-black">
                    <div className="text-center space-y-16">
                        <p>مسئول شئون العاملين</p>
                        <p>........................</p>
                    </div>
                    <div className="text-center space-y-16">
                        <p>يعتمد،، مدير المركز</p>
                        <p>د/ ........................</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
