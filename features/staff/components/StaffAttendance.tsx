import React, { useEffect, useState } from 'react';
import { 
    Clock, Calendar, Info, AlertCircle, CheckCircle2, 
    XCircle, Timer, CalendarX, ArrowUpRight, Send
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import StaffNewRequest from './StaffNewRequest'; // استيراد مكون الطلبات

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// دالة مساعدة لحساب الفرق بين وقتين
const getTimeDiff = (t1: string, t2: string) => {
    if (!t1 || !t2) return 0;
    const [h1, m1] = t1.split(':').map(Number);
    const [h2, m2] = t2.split(':').map(Number);
    return (h2 * 60 + m2) - (h1 * 60 + m1); // الفرق بالدقائق
};

export default function StaffAttendance({ attendance: initialAttendance, selectedMonth: initialMonth, setSelectedMonth, employee }: { attendance: any[], selectedMonth: string, setSelectedMonth: any, employee: Employee }) {
    const [attendanceData, setAttendanceData] = useState<any[]>(initialAttendance || []);
    const [viewMonth, setViewMonth] = useState(initialMonth || new Date().toISOString().slice(0, 7));
    const [lastUpdate, setLastUpdate] = useState<string>('');
    const [loading, setLoading] = useState(false);
    
    // للنافذة المنبثقة عند الضغط على يوم غياب
    const [selectedAbsenceDate, setSelectedAbsenceDate] = useState<string | null>(null);

    // 1. جلب البيانات
    useEffect(() => {
        const fetchMeta = async () => {
            const { data } = await supabase.from('general_settings').select('last_attendance_update').limit(1).maybeSingle();
            if (data?.last_attendance_update) {
                setLastUpdate(new Date(data.last_attendance_update).toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' }));
            }
        };
        fetchMeta();

        const fetchAtt = async () => {
            if (!employee?.employee_id) return;
            setLoading(true);
            const { data } = await supabase
                .from('attendance')
                .select('*')
                .eq('employee_id', employee.employee_id)
                .gte('date', `${viewMonth}-01`)
                .lte('date', `${viewMonth}-31`);
            
            if (data) setAttendanceData(data);
            setLoading(false);
        };

        if (employee?.employee_id) fetchAtt();
        else if (initialAttendance) setAttendanceData(initialAttendance);

    }, [viewMonth, employee]);

    const handleMonthChange = (e: any) => {
        const val = e.target.value;
        setViewMonth(val);
        if (setSelectedMonth) setSelectedMonth(val);
    };

    // 2. تحليل حالة الحضور والانصراف
    const analyzeDay = (dateStr: string, attRecord: any) => {
        const times = attRecord?.times?.match(/\d{1,2}:\d{2}/g) || [];
        const cin = times[0];
        const cout = times.length > 1 ? times[times.length - 1] : null;
        
        let inStatus = '-';
        let outStatus = '-';
        let hours = 0;

        // تحليل التأخير (بناءً على مواعيد الموظف أو الافتراضي 8:30)
        const workStart = employee.start_time || "08:30";
        const workEnd = employee.end_time || "14:30";

        if (cin) {
            const diff = getTimeDiff(workStart, cin);
            inStatus = diff > 15 ? `تأخير ${diff} د` : 'منتظم'; // سماحية 15 دقيقة
        }

        if (cout) {
            const diff = getTimeDiff(cout, workEnd);
            outStatus = diff > 15 ? `انصراف مبكر ${diff} د` : 'منتظم';
            
            // حساب ساعات العمل
            const workedMins = getTimeDiff(cin, cout);
            hours = workedMins > 0 ? parseFloat((workedMins / 60).toFixed(1)) : 0;
        }

        return { cin, cout, inStatus, outStatus, hours };
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            
            {/* --- Header Section --- */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                        <Calendar className="text-emerald-600 w-6 h-6" /> سجل الحضور الشهرى
                    </h3>
                    {lastUpdate && (
                        <p className="text-xs text-gray-400 mt-1 font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3"/> آخر تحديث: {lastUpdate}
                        </p>
                    )}
                </div>
                
                <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                    <span className="text-xs font-bold text-gray-500 px-2">اختر الشهر:</span>
                    <input 
                        type="month" 
                        value={viewMonth} 
                        onChange={handleMonthChange} 
                        className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500 transition-colors" 
                    />
                </div>
            </div>

            {/* --- Stats Summary (Optional) --- */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center">
                    <span className="text-xs text-emerald-600 font-bold block mb-1">أيام الحضور</span>
                    <span className="text-2xl font-black text-emerald-800">{attendanceData.length}</span>
                </div>
                <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-center">
                    <span className="text-xs text-red-600 font-bold block mb-1">تأخيرات</span>
                    <span className="text-2xl font-black text-red-800">
                        {attendanceData.filter(a => analyzeDay('', a).inStatus.includes('تأخير')).length}
                    </span>
                </div>
                 {/* يمكن إضافة المزيد هنا */}
            </div>

            {/* --- Attendance List --- */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-right min-w-[700px]">
                        <thead className="bg-gray-50/80 font-black text-gray-600 border-b text-xs uppercase tracking-wider">
                            <tr>
                                <th className="p-5 w-32">التاريخ</th>
                                <th className="p-5 w-24">اليوم</th>
                                <th className="p-5 text-emerald-700">توقيت الحضور</th>
                                <th className="p-5 text-red-600">توقيت الانصراف</th>
                                <th className="p-5 text-blue-600">حالة الحضور</th>
                                <th className="p-5 text-orange-600">حالة الانصراف</th>
                                <th className="p-5 w-24">ساعات العمل</th>
                                <th className="p-5 w-20">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={8} className="p-10 text-center text-gray-400">جاري تحميل البيانات...</td></tr>
                            ) : Array.from({ length: new Date(Number(viewMonth.split('-')[0]), Number(viewMonth.split('-')[1]), 0).getDate() }, (_, i) => {
                                const day = i + 1;
                                const dateStr = `${viewMonth}-${String(day).padStart(2, '0')}`;
                                const dObj = new Date(dateStr);
                                const isFriday = dObj.getDay() === 5;
                                const att = attendanceData.find((a:any) => a.date === dateStr);
                                const { cin, cout, inStatus, outStatus, hours } = analyzeDay(dateStr, att);
                                
                                // تحديد الحالة العامة لليوم (غياب/حضور/عطلة)
                                let rowClass = "hover:bg-gray-50 transition-colors";
                                let dayStatus = "normal";

                                if (isFriday) {
                                    rowClass = "bg-red-50/20"; // عطلة
                                    dayStatus = "weekend";
                                } else if (!att) {
                                    rowClass = "bg-red-50/50 hover:bg-red-100/50 cursor-pointer group"; // غياب
                                    dayStatus = "absent";
                                }

                                return (
                                    <tr 
                                        key={dateStr} 
                                        className={rowClass}
                                        onClick={() => dayStatus === 'absent' && setSelectedAbsenceDate(dateStr)}
                                    >
                                        <td className="p-5 font-bold text-gray-700">{dateStr}</td>
                                        <td className={`p-5 font-bold ${isFriday ? 'text-red-400' : 'text-gray-500'}`}>{DAYS_AR[dObj.getDay()]}</td>
                                        
                                        {/* الحضور */}
                                        <td className="p-5">
                                            {cin ? (
                                                <span className="font-mono font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{cin}</span>
                                            ) : dayStatus === 'absent' ? (
                                                <span className="text-xs font-bold text-red-400 flex items-center gap-1 group-hover:text-red-600 transition-colors">
                                                    <XCircle className="w-3 h-3"/> غياب
                                                </span>
                                            ) : (
                                                <span className="text-gray-300">--</span>
                                            )}
                                        </td>

                                        {/* الانصراف */}
                                        <td className="p-5">
                                            {cout ? (
                                                <span className="font-mono font-black text-red-500 bg-red-50 px-2 py-1 rounded-lg">{cout}</span>
                                            ) : (
                                                <span className="text-gray-300">--</span>
                                            )}
                                        </td>

                                        {/* حالة الحضور */}
                                        <td className="p-5">
                                            {inStatus.includes('تأخير') ? (
                                                <div className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full w-fit">
                                                    <AlertCircle className="w-3 h-3"/> {inStatus}
                                                </div>
                                            ) : cin ? (
                                                <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full w-fit">
                                                    <CheckCircle2 className="w-3 h-3"/> {inStatus}
                                                </div>
                                            ) : '-'}
                                        </td>

                                        {/* حالة الانصراف */}
                                        <td className="p-5">
                                            {outStatus.includes('مبكر') ? (
                                                <div className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full w-fit">
                                                    <ArrowUpRight className="w-3 h-3"/> {outStatus}
                                                </div>
                                            ) : cout ? (
                                                <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full w-fit">
                                                    <CheckCircle2 className="w-3 h-3"/> {inStatus}
                                                </div>
                                            ) : '-'}
                                        </td>

                                        {/* الساعات */}
                                        <td className="p-5">
                                            {hours > 0 ? (
                                                <span className="font-mono font-bold text-blue-600">{hours} س</span>
                                            ) : '-'}
                                        </td>

                                        {/* الإجراءات */}
                                        <td className="p-5 text-center">
                                            {dayStatus === 'absent' && (
                                                <button 
                                                    className="p-2 bg-white border border-gray-200 rounded-full hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm group-hover:scale-110"
                                                    title="تبرير الغياب"
                                                >
                                                    <Send className="w-4 h-4"/>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- نافذة تقديم الطلب عند الضغط على يوم غياب --- */}
            {selectedAbsenceDate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <button 
                            onClick={() => setSelectedAbsenceDate(null)}
                            className="absolute top-6 left-6 p-2 bg-gray-100 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                            <XCircle className="w-6 h-6"/>
                        </button>
                        
                        <div className="p-8">
                            <h3 className="text-xl font-black text-gray-800 mb-2 flex items-center gap-2">
                                <CalendarX className="text-red-500 w-6 h-6"/> تبرير غياب يوم {selectedAbsenceDate}
                            </h3>
                            <p className="text-gray-500 text-sm mb-6 font-medium">يمكنك تقديم طلب إجازة أو مأمورية أو تبرير لهذا اليوم مباشرة.</p>
                            
                            {/* استدعاء مكون الطلبات مع تمرير التاريخ تلقائياً */}
                            <StaffNewRequest 
                                employee={employee} 
                                refresh={() => { setSelectedAbsenceDate(null); /* هنا يمكن تحديث البيانات */ }} 
                                initialDate={selectedAbsenceDate} // ميزة نحتاج إضافتها في StaffNewRequest
                            />
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
