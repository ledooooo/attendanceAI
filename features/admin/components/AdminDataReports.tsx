import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { 
    Database, Users, BarChart3, Clock, CalendarX, 
    FileText, Printer, Download, Filter, ShieldAlert, 
    ChevronDown, Settings2, CheckSquare, Square, Type,
    TrendingUp, PieChart, Info, Calendar as CalendarIcon,
    ArrowRightLeft, FileSpreadsheet
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';

interface Props { employees: Employee[] }

type ReportView = 'staff_names' | 'staff_counts' | 'daily_io' | 'daily_absent' | 'monthly_absent' | 'overtime';

export default function AdminDataReports({ employees }: Props) {
    // --- 1. حالات إدارة الواجهة ---
    const [view, setView] = useState<ReportView>('staff_names');
    const [loading, setLoading] = useState(false);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    
    // --- 2. حالات التحكم في التقارير والطباعة ---
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [visibleColumns, setVisibleColumns] = useState<string[]>(['m', 'name', 'specialty', 'status', 'inTime', 'outTime', 'reportStatus', 'leaveNote']);
    const [fontSize, setFontSize] = useState(11);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [filterStatus, setFilterStatus] = useState('all');

    const printRef = useRef(null);

    // --- 3. جلب البيانات من Supabase ---
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
            
            // إعادة تحديد الكل عند تحميل بيانات جديدة
            if (employees) {
                setSelectedRows(employees.map(e => e.employee_id));
            }
        } finally {
            setLoading(false);
        }
    };

    // --- 4. محرك معالجة البيانات (The Engine) ---

    // أ. التقرير اليومي الشامل
    const dailyProcessed = useMemo(() => {
        return employees.map(emp => {
            const att = attendance.find(a => a.employee_id === emp.employee_id);
            const lve = leaves.find(l => 
                l.employee_id === emp.employee_id && 
                date >= l.start_date && date <= l.end_date
            );
            
            let status = 'غياب';
            let inT = '-', outT = '-';
            let leaveNote = '';
            
            if (att) {
                const times = att.times?.split(/\s+/).filter(t => t.includes(':')) || [];
                inT = times[0] || '-';
                outT = times.length > 1 ? times[times.length - 1] : '-';

                if (inT !== '-' && outT !== '-') status = 'حاضر';
                else if (inT !== '-' && outT === '-') status = 'ترك عمل';
            } else if (lve) {
                status = 'إجازة/طلب';
                leaveNote = `${lve.type} (${lve.status})`;
            }

            return { 
                ...emp, 
                reportStatus: status, 
                inTime: inT, 
                outTime: outT, 
                leaveNote 
            };
        }).filter(item => filterStatus === 'all' || item.status === filterStatus);
    }, [employees, attendance, leaves, date, filterStatus]);

    // ب. منطق بدل الراحات (أكثر من 10 ساعات أو عطلات)
    const overtimeReport = useMemo(() => {
        return dailyProcessed.filter(emp => {
            if (emp.inTime === '-' || emp.outTime === '-') return false;
            
            const [h1, m1] = emp.inTime.split(':').map(Number);
            const [h2, m2] = emp.outTime.split(':').map(Number);
            const totalHours = (h2 + m2/60) - (h1 + m1/60);
            
            const dayOfWeek = new Date(date).getDay();
            const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // الجمعة والسبت
            
            if (isWeekend) return totalHours >= 5;
            return totalHours >= 10;
        });
    }, [dailyProcessed, date]);

    // ج. تقرير الغياب الشهري
    const monthlyAbsentData = useMemo(() => {
        const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
        return employees.map(emp => {
            const empAttDates = attendance.filter(a => a.employee_id === emp.employee_id).map(a => a.date);
            const empLeaves = leaves.filter(l => l.employee_id === emp.employee_id && l.status === 'مقبول');
            
            let absentDays: number[] = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const checkDate = `${month}-${d.toString().padStart(2, '0')}`;
                const isFriday = new Date(checkDate).getDay() === 5;
                if (isFriday) continue;

                const hasAtt = empAttDates.includes(checkDate);
                const hasApprovedLeave = empLeaves.some(l => checkDate >= l.start_date && checkDate <= l.end_date);
                
                if (!hasAtt && !hasApprovedLeave) absentDays.push(d);
            }
            return { ...emp, absentCount: absentDays.length, daysList: absentDays.join(', ') };
        }).filter(e => e.absentCount > 0);
    }, [employees, attendance, leaves, month]);

    // --- 5. وظائف الطباعة والتصدير ---
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `تقرير_بيانات_${view}_${date}`,
    });

    const handleExportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(dailyProcessed.filter(r => selectedRows.includes(r.employee_id)));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DataReport");
        XLSX.writeFile(wb, `Report_${view}_${date}.xlsx`);
    };

    const toggleRow = (id: string) => {
        setSelectedRows(prev => prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]);
    };

    const toggleColumn = (col: string) => {
        setVisibleColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
    };

    return (
        <div className="space-y-6 text-right pb-20" dir="rtl">
            
            {/* 1. نظام التبويبات (Tabs) لاستغلال المساحة */}
            <div className="flex bg-gray-100 p-1.5 rounded-[1.5rem] no-print overflow-x-auto shadow-inner border border-gray-200">
                {[
                    { id: 'staff_names', label: 'أسماء القوة', icon: Users },
                    { id: 'staff_counts', label: 'أعداد القوة', icon: BarChart3 },
                    { id: 'daily_io', label: 'حضور وغياب', icon: Clock },
                    { id: 'daily_absent', label: 'غياب اليوم', icon: CalendarX },
                    { id: 'monthly_absent', label: 'غياب الشهر', icon: FileText },
                    { id: 'overtime', label: 'بدل راحات', icon: ShieldAlert },
                ].map(tab => (
                    <button 
                        key={tab.id} 
                        onClick={() => setView(tab.id as ReportView)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[11px] font-black transition-all whitespace-nowrap ${view === tab.id ? 'bg-white text-indigo-600 shadow-md scale-100' : 'text-gray-500 hover:bg-gray-200 scale-95'}`}
                    >
                        <tab.icon size={16} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* 2. شريط التحكم المتقدم */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm no-print space-y-6">
                <div className="flex flex-wrap gap-6 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-black text-gray-400 mb-2 mr-2 uppercase">تاريخ البيان</label>
                        {view === 'monthly_absent' ? (
                            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full p-3 bg-gray-50 rounded-2xl font-bold border-none ring-1 ring-gray-100 focus:ring-2 focus:ring-indigo-500" />
                        ) : (
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-3 bg-gray-50 rounded-2xl font-bold border-none ring-1 ring-gray-100 focus:ring-2 focus:ring-indigo-500" />
                        )}
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-black text-gray-400 mb-2 mr-2 uppercase">حالة القيد</label>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-3 bg-gray-50 rounded-2xl font-bold border-none ring-1 ring-gray-100">
                            <option value="all">كل الموظفين</option>
                            <option value="نشط">نشط</option>
                            <option value="موقوف">موقوف</option>
                            <option value="خارج المركز">خارج المركز</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="p-4 bg-gray-900 text-white rounded-2xl shadow-lg hover:scale-105 transition-transform"><Printer size={20}/></button>
                        <button onClick={handleExportExcel} className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg hover:scale-105 transition-transform"><FileSpreadsheet size={20}/></button>
                    </div>
                </div>

                {/* 3. تخصيص الأعمدة وحجم النص */}
                <div className="bg-indigo-50/50 p-4 rounded-3xl space-y-4">
                    <div className="flex flex-wrap gap-2 items-center">
                        <Settings2 size={16} className="text-indigo-600 ml-2" />
                        <span className="text-[10px] font-black text-indigo-700 ml-4">الأعمدة الظاهرة:</span>
                        {[
                            {id: 'm', l: 'مسلسل'}, {id: 'name', l: 'الاسم'}, {id: 'specialty', l: 'التخصص'}, 
                            {id: 'status', l: 'الحالة'}, {id: 'inTime', l: 'حضور'}, {id: 'outTime', l: 'انصراف'},
                            {id: 'reportStatus', l: 'حالة اليوم'}, {id: 'leaveNote', l: 'ملاحظات الطلب'}
                        ].map(col => (
                            <button key={col.id} onClick={() => toggleColumn(col.id)}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${visibleColumns.includes(col.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-400 border-gray-200'}`}>
                                {col.l}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-4 border-t border-indigo-100 pt-4">
                        <div className="flex items-center gap-3">
                            <Type size={16} className="text-indigo-600" />
                            <span className="text-[10px] font-black">حجم الخط:</span>
                            <input type="range" min="8" max="18" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="w-40 accent-indigo-600" />
                            <span className="font-bold text-indigo-600 text-xs">{fontSize}px</span>
                        </div>
                        <div className="mr-auto text-[10px] font-bold text-gray-400">
                            تم اختيار {selectedRows.length} موظف من إجمالي {employees.length}
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. إحصائيات سريعة للبيان الحالي */}
            {view === 'daily_io' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600"><CheckCircle2 /></div>
                        <div><p className="text-[10px] text-gray-400 font-bold">حاضر (بصمتين)</p><p className="text-xl font-black">{dailyProcessed.filter(r=>r.reportStatus==='حاضر').length}</p></div>
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600"><CalendarX /></div>
                        <div><p className="text-[10px] text-gray-400 font-bold">غائب كلياً</p><p className="text-xl font-black">{dailyProcessed.filter(r=>r.reportStatus==='غياب').length}</p></div>
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600"><Clock /></div>
                        <div><p className="text-[10px] text-gray-400 font-bold">ترك عمل</p><p className="text-xl font-black">{dailyProcessed.filter(r=>r.reportStatus==='ترك عمل').length}</p></div>
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600"><TrendingUp /></div>
                        <div><p className="text-[10px] text-gray-400 font-bold">نسبة الانضباط</p><p className="text-xl font-black">{((dailyProcessed.filter(r=>r.reportStatus==='حاضر').length / dailyProcessed.length)*100).toFixed(1)}%</p></div>
                    </div>
                </div>
            )}

            {/* 5. منطقة المعاينة والطباعة الفردية */}
            <div ref={printRef} className="bg-white p-12 rounded-[3.5rem] border shadow-sm min-h-[1100px] print:p-0 print:border-0 print:shadow-none">
                
                {/* الهيدر الرسمي للطباعة */}
                <div className="hidden print:block mb-10 border-b-2 border-black pb-8">
                    <div className="flex justify-between items-center">
                        <div className="text-right text-[12px] font-black space-y-1">
                            <p>وزارة الصحة والسكان</p>
                            <p>مديرية الشئون الصحية بالجيزة</p>
                            <p>إدارة شمال الجيزة الصحية</p>
                            <p>مركز طبي غرب المطار</p>
                        </div>
                        <div className="text-center">
                            <h1 className="text-2xl font-black">إدارة شمال الجيزة - مركز غرب المطار</h1>
                            <p className="text-sm font-bold mt-2">تقرير مصلحي رسمي: {view.replace('_', ' ')}</p>
                            <p className="text-[10px] mt-1 font-bold">التاريخ المرجعي: {view === 'monthly_absent' ? month : date}</p>
                        </div>
                        <div className="text-left text-[10px] font-bold">
                            <p>توقيت الطباعة: {new Date().toLocaleTimeString('ar-EG')}</p>
                            <p>تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</p>
                            <p className="mt-4 border border-black p-2 inline-block">ختم الإدارة</p>
                        </div>
                    </div>
                </div>

                {/* عرض الجداول حسب التبويب */}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse" style={{ fontSize: `${fontSize}px` }}>
                        <thead>
                            <tr className="bg-gray-100 border-y-2 border-black">
                                <th className="p-3 border text-center no-print w-12">
                                    <button onClick={() => setSelectedRows(selectedRows.length === dailyProcessed.length ? [] : dailyProcessed.map(e=>e.employee_id))} className="p-1">
                                        {selectedRows.length === dailyProcessed.length ? <CheckSquare size={16}/> : <Square size={16}/>}
                                    </button>
                                </th>
                                {visibleColumns.includes('m') && <th className="p-3 border text-center w-12">م</th>}
                                {visibleColumns.includes('name') && <th className="p-3 border text-right">الاسم الرباعي</th>}
                                {visibleColumns.includes('specialty') && <th className="p-3 border text-center">التخصص</th>}
                                
                                {/* أعمدة متغيرة حسب نوع التقرير */}
                                {view === 'staff_names' && (
                                    <>
                                        <th className="p-3 border text-center">الرقم القومي</th>
                                        <th className="p-3 border text-center">التليفون</th>
                                    </>
                                )}
                                
                                {visibleColumns.includes('inTime') && view !== 'staff_names' && <th className="p-3 border text-center">حضور</th>}
                                {visibleColumns.includes('outTime') && view !== 'staff_names' && <th className="p-3 border text-center">انصراف</th>}
                                
                                {view === 'monthly_absent' && (
                                    <>
                                        <th className="p-3 border text-center">عدد الأيام</th>
                                        <th className="p-3 border text-right">الأيام الفعلية</th>
                                    </>
                                )}

                                {view === 'overtime' && <th className="p-3 border text-center">السبب المستحق</th>}
                                {visibleColumns.includes('reportStatus') && <th className="p-3 border text-center">الحالة اليوم</th>}
                                {visibleColumns.includes('leaveNote') && <th className="p-3 border text-right">ملاحظات</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {(
                                view === 'overtime' ? overtimeReport : 
                                view === 'monthly_absent' ? monthlyAbsentData : 
                                view === 'daily_absent' ? dailyProcessed.filter(r => r.reportStatus === 'غياب') :
                                dailyProcessed
                            ).map((row: any, i: number) => {
                                const isSelected = selectedRows.includes(row.employee_id);
                                return (
                                    <tr key={row.employee_id || i} className={`border-b border-gray-300 ${!isSelected ? 'no-print bg-gray-50 opacity-40' : 'hover:bg-gray-50/50'}`}>
                                        <td className="p-3 border text-center no-print">
                                            <button onClick={() => toggleRow(row.employee_id)}>
                                                {isSelected ? <CheckSquare size={18} className="text-indigo-600" /> : <Square size={18} className="text-gray-300" />}
                                            </button>
                                        </td>
                                        {visibleColumns.includes('m') && <td className="p-3 border text-center font-mono">{i + 1}</td>}
                                        {visibleColumns.includes('name') && <td className="p-3 border font-black text-gray-800">{row.name}</td>}
                                        {visibleColumns.includes('specialty') && <td className="p-3 border text-center">{row.specialty}</td>}
                                        
                                        {view === 'staff_names' && (
                                            <>
                                                <td className="p-3 border text-center font-mono">{row.national_id}</td>
                                                <td className="p-3 border text-center font-mono">{row.phone}</td>
                                            </>
                                        )}

                                        {visibleColumns.includes('inTime') && view !== 'staff_names' && (
                                            <td className="p-3 border text-center font-mono text-blue-700">{row.inTime || '-'}</td>
                                        )}
                                        {visibleColumns.includes('outTime') && view !== 'staff_names' && (
                                            <td className="p-3 border text-center font-mono text-red-600">{row.outTime || '-'}</td>
                                        )}

                                        {view === 'monthly_absent' && (
                                            <>
                                                <td className="p-3 border text-center font-black text-red-600">{row.absentCount} يوم</td>
                                                <td className="p-3 border text-right font-mono text-[9px]">{row.daysList}</td>
                                            </>
                                        )}

                                        {view === 'overtime' && (
                                            <td className="p-3 border text-center font-bold text-purple-700">
                                                {new Date(date).getDay() === 5 || new Date(date).getDay() === 6 ? 'عطلة رسمية' : 'إضافي > 10س'}
                                            </td>
                                        )}

                                        {visibleColumns.includes('reportStatus') && (
                                            <td className="p-3 border text-center">
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black ${
                                                    row.reportStatus === 'حاضر' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                                                    row.reportStatus === 'غياب' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-indigo-50 text-indigo-700'
                                                }`}>
                                                    {row.reportStatus}
                                                </span>
                                            </td>
                                        )}
                                        {visibleColumns.includes('leaveNote') && <td className="p-3 border text-[9px] text-gray-500 italic">{row.leaveNote || '-'}</td>}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* التذييل الرسمي - التوقيعات */}
                <div className="mt-20 hidden print:flex justify-between px-16 text-sm font-black">
                    <div className="text-center space-y-16">
                        <p>مسئول شئون العاملين</p>
                        <p className="border-b border-black w-40 mx-auto pt-4"></p>
                    </div>
                    <div className="text-center space-y-16">
                        <p>مدير المركز</p>
                        <p className="border-b border-black w-40 mx-auto pt-4"></p>
                    </div>
                </div>

                <div className="hidden print:block mt-12 text-[8px] text-gray-400 text-center border-t pt-4 italic">
                    تم استخراج هذا البيان آلياً عبر نظام الإدارة الذكي لمركز طبي غرب المطار - قسم تكنولوجيا المعلومات
                </div>
            </div>
        </div>
    );
}
