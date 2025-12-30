import React, { useEffect, useState } from 'react';
import { 
    Clock, Calendar, CheckCircle2, XCircle, 
    AlertTriangle, Star, Timer, Briefcase
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRule } from '../../../types';
import StaffNewRequest from './StaffNewRequest';

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// تحويل الوقت "HH:MM" إلى دقائق للحسابات
const toMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

// حساب الفرق بالساعات
const calcHours = (t1: string, t2: string) => {
    if (!t1 || !t2) return 0;
    const diff = toMinutes(t2) - toMinutes(t1);
    return diff > 0 ? parseFloat((diff / 60).toFixed(1)) : 0;
};

export default function StaffAttendance({ attendance: initialAttendance, selectedMonth: initialMonth, setSelectedMonth, employee }: { attendance: any[], selectedMonth: string, setSelectedMonth: any, employee: Employee }) {
    const [attendanceData, setAttendanceData] = useState<any[]>(initialAttendance || []);
    const [rules, setRules] = useState<AttendanceRule[]>([]);
    const [viewMonth, setViewMonth] = useState(initialMonth || new Date().toISOString().slice(0, 7));
    const [loading, setLoading] = useState(false);
    const [monthlyEval, setMonthlyEval] = useState<number | null>(null);
    const [selectedAbsenceDate, setSelectedAbsenceDate] = useState<string | null>(null);

    // إحصائيات الشهر
    const [stats, setStats] = useState({
        present: 0,
        absent: 0,
        late: 0,
        leaves: 0, // سنعتبر الإجازات من جدول الطلبات المقبولة (إذا توفرت) أو الحالة
        totalHours: 0
    });

    // 1. جلب البيانات والقواعد
    useEffect(() => {
        const fetchData = async () => {
            if (!employee?.employee_id) return;
            setLoading(true);

            // أ) جلب بصمات الشهر
            // تصحيح: نضمن أننا نجلب كل أيام الشهر
            const startOfMonth = `${viewMonth}-01`;
            const endOfMonth = `${viewMonth}-31`; // SQL سيتعامل بذكاء مع الأيام الزائدة

            const { data: attData } = await supabase
                .from('attendance')
                .select('*')
                .eq('employee_id', employee.employee_id)
                .gte('date', startOfMonth)
                .lte('date', endOfMonth);
            
            if (attData) setAttendanceData(attData);

            // ب) جلب القواعد
            const { data: rulesData } = await supabase.from('attendance_rules').select('*');
            if (rulesData) setRules(rulesData);

            // ج) جلب التقييم الشهري
            const { data: evalData } = await supabase
                .from('evaluations')
                .select('total_score')
                .eq('employee_id', employee.employee_id)
                .eq('month', viewMonth)
                .maybeSingle();
            
            setMonthlyEval(evalData ? evalData.total_score : null);

            setLoading(false);
        };

        fetchData();
    }, [viewMonth, employee]);

    // 2. حساب الإحصائيات بعد تحميل البيانات
    useEffect(() => {
        let present = 0;
        let late = 0;
        let totalHours = 0;
        
        // نحتاج لحساب عدد أيام الشهر الحالية لمعرفة الغياب
        const daysInMonth = new Date(Number(viewMonth.split('-')[0]), Number(viewMonth.split('-')[1]), 0).getDate();
        let validDays = 0;

        // نقوم بعمل Loop لحساب الغياب بدقة
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${viewMonth}-${String(i).padStart(2, '0')}`;
            const dateObj = new Date(dateStr);
            if (dateObj.getDay() === 5) continue; // تخطي الجمعة
            if (dateObj > new Date()) continue; // تخطي المستقبل

            validDays++;
            const record = attendanceData.find(a => a.date === dateStr);
            
            if (record) {
                present++;
                const info = analyzeDay(record, rules);
                if (info.inStatus.includes('تأخير') || info.inStatusColor === 'orange' || info.inStatusColor === 'red') {
                    late++;
                }
                totalHours += info.hours;
            }
        }

        setStats({
            present,
            absent: validDays - present, // أيام العمل الماضية - أيام الحضور
            late,
            leaves: 0, // يمكن ربطها بجدول الإجازات لاحقاً
            totalHours
        });

    }, [attendanceData, rules, viewMonth]);

    const handleMonthChange = (e: any) => {
        const val = e.target.value;
        setViewMonth(val);
        if (setSelectedMonth) setSelectedMonth(val);
    };

    // 3. دالة تحليل اليوم بناءً على القواعد
    const analyzeDay = (attRecord: any, rulesList: AttendanceRule[]) => {
        const times = attRecord?.times?.match(/\d{1,2}:\d{2}/g) || [];
        // نفترض أن أول وقت هو دخول وآخر وقت هو خروج
        // ملاحظة: قد تحتاج لترتيب الأوقات if they come unsorted
        const sortedTimes = times.sort(); 
        const cin = sortedTimes[0];
        const cout = sortedTimes.length > 1 ? sortedTimes[sortedTimes.length - 1] : null;
        
        let inStatus = 'غير محدد';
        let inStatusColor = 'gray';
        let outStatus = 'غير محدد';
        let outStatusColor = 'gray';
        let hours = 0;

        if (cin) {
            const cinMins = toMinutes(cin);
            // البحث عن القاعدة المناسبة
            const rule = rulesList.find(r => r.type === 'in' && cinMins >= toMinutes(r.start_time) && cinMins <= toMinutes(r.end_time));
            if (rule) {
                inStatus = rule.name;
                inStatusColor = rule.color;
            } else {
                inStatus = 'خارج النطاق';
            }
        }

        if (cout) {
            const coutMins = toMinutes(cout);
            const rule = rulesList.find(r => r.type === 'out' && coutMins >= toMinutes(r.start_time) && coutMins <= toMinutes(r.end_time));
            if (rule) {
                outStatus = rule.name;
                outStatusColor = rule.color;
            } else {
                outStatus = 'خارج النطاق';
            }
            hours = calcHours(cin, cout);
        }

        return { cin, cout, inStatus, inStatusColor, outStatus, outStatusColor, hours };
    };

    // دالة مساعدة للألوان
    const getColorClass = (colorName: string) => {
        const map: any = {
            'emerald': 'bg-emerald-50 text-emerald-700',
            'green': 'bg-green-50 text-green-700',
            'red': 'bg-red-50 text-red-700',
            'orange': 'bg-orange-50 text-orange-700',
            'blue': 'bg-blue-50 text-blue-700',
            'gray': 'bg-gray-50 text-gray-500',
        };
        return map[colorName] || map['gray'];
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            
            {/* Header: اختيار الشهر */}
            <div className="flex justify-between items-center bg-white p-4 rounded-3xl border shadow-sm">
                <h3 className="font-black text-gray-800 text-lg flex items-center gap-2">
                    <Calendar className="text-emerald-600"/> تقرير الحضور
                </h3>
                <div className="relative group">
                     {/* تنسيق مخصص لمدخل الشهر */}
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 cursor-pointer hover:border-emerald-500 transition-colors">
                        <span className="text-sm font-bold text-gray-600">
                             {new Date(viewMonth).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
                        </span>
                        <input 
                            type="month" 
                            value={viewMonth} 
                            onChange={handleMonthChange}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                    </div>
                </div>
            </div>

            {/* Top Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-white p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center gap-1">
                    <div className="p-2 bg-green-50 text-green-600 rounded-full"><CheckCircle2 className="w-5 h-5"/></div>
                    <span className="text-xl font-black text-gray-800">{stats.present}</span>
                    <span className="text-[10px] text-gray-400 font-bold">حضور</span>
                </div>
                <div className="bg-white p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center gap-1">
                    <div className="p-2 bg-red-50 text-red-600 rounded-full"><XCircle className="w-5 h-5"/></div>
                    <span className="text-xl font-black text-gray-800">{stats.absent}</span>
                    <span className="text-[10px] text-gray-400 font-bold">غياب</span>
                </div>
                <div className="bg-white p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center gap-1">
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-full"><AlertTriangle className="w-5 h-5"/></div>
                    <span className="text-xl font-black text-gray-800">{stats.late}</span>
                    <span className="text-[10px] text-gray-400 font-bold">تأخيرات</span>
                </div>
                <div className="bg-white p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center gap-1">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-full"><Timer className="w-5 h-5"/></div>
                    <span className="text-xl font-black text-gray-800">{stats.totalHours.toFixed(0)}</span>
                    <span className="text-[10px] text-gray-400 font-bold">ساعات عمل</span>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-3 rounded-2xl border border-yellow-100 shadow-sm flex flex-col items-center justify-center gap-1 col-span-2 md:col-span-1">
                    <div className="p-2 bg-yellow-100 text-yellow-600 rounded-full"><Star className="w-5 h-5 fill-yellow-500"/></div>
                    <span className="text-xl font-black text-yellow-700">{monthlyEval ? `${monthlyEval}%` : '-'}</span>
                    <span className="text-[10px] text-yellow-600 font-bold">التقييم الشهري</span>
                </div>
            </div>

            {/* Attendance Table */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-right min-w-[800px]">
                        <thead className="bg-gray-50/80 font-black text-gray-600 border-b text-xs">
                            <tr>
                                <th className="p-4 w-32">التاريخ</th>
                                <th className="p-4">اليوم</th>
                                <th className="p-4">الحضور</th>
                                <th className="p-4">الانصراف</th>
                                <th className="p-4">حالة الحضور</th>
                                <th className="p-4">حالة الانصراف</th>
                                <th className="p-4">الساعات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={7} className="p-10 text-center text-gray-400">جاري تحميل البيانات...</td></tr>
                            ) : Array.from({ length: new Date(Number(viewMonth.split('-')[0]), Number(viewMonth.split('-')[1]), 0).getDate() }, (_, i) => {
                                const day = i + 1;
                                // BUG FIX: padStart ensures '05' instead of '5'
                                const dateStr = `${viewMonth}-${String(day).padStart(2, '0')}`;
                                const dObj = new Date(dateStr);
                                const isFriday = dObj.getDay() === 5;
                                const att = attendanceData.find((a:any) => a.date === dateStr);
                                const { cin, cout, inStatus, inStatusColor, outStatus, outStatusColor, hours } = analyzeDay(att, rules);

                                // حالة الغياب
                                const isAbsent = !att && !isFriday && dObj < new Date();

                                return (
                                    <tr 
                                        key={dateStr} 
                                        className={`
                                            ${isFriday ? 'bg-red-50/10' : 'hover:bg-gray-50'}
                                            ${isAbsent ? 'bg-red-50/30 cursor-pointer hover:bg-red-100/30' : ''}
                                            transition-colors
                                        `}
                                        onClick={() => isAbsent && setSelectedAbsenceDate(dateStr)}
                                    >
                                        <td className="p-4 font-bold text-gray-700">{dateStr}</td>
                                        <td className={`p-4 font-bold ${isFriday ? 'text-red-400' : 'text-gray-500'}`}>{DAYS_AR[dObj.getDay()]}</td>
                                        
                                        <td className="p-4">
                                            {cin ? <span className="font-mono font-black text-gray-800">{cin}</span> : '--'}
                                        </td>
                                        <td className="p-4">
                                            {cout ? <span className="font-mono font-black text-gray-800">{cout}</span> : '--'}
                                        </td>

                                        {/* Dynamic Status */}
                                        <td className="p-4">
                                            {cin ? (
                                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getColorClass(inStatusColor)}`}>
                                                    {inStatus}
                                                </span>
                                            ) : isAbsent ? (
                                                <span className="text-red-500 text-xs font-bold flex items-center gap-1">
                                                    <XCircle className="w-3 h-3"/> غياب
                                                </span>
                                            ) : '-'}
                                        </td>

                                        <td className="p-4">
                                             {cout ? (
                                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getColorClass(outStatusColor)}`}>
                                                    {outStatus}
                                                </span>
                                            ) : '-'}
                                        </td>

                                        <td className="p-4 font-mono font-bold text-blue-600">
                                            {hours > 0 ? hours + ' س' : '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal for Requesting Leave on Absent Day */}
            {selectedAbsenceDate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <button onClick={() => setSelectedAbsenceDate(null)} className="absolute top-6 left-6 p-2 bg-gray-100 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors">
                            <XCircle className="w-6 h-6"/>
                        </button>
                        <div className="p-8">
                            <h3 className="text-xl font-black text-gray-800 mb-2 flex items-center gap-2">
                                <Briefcase className="text-red-500 w-6 h-6"/> تبرير غياب يوم {selectedAbsenceDate}
                            </h3>
                            <StaffNewRequest 
                                employee={employee} 
                                refresh={() => { setSelectedAbsenceDate(null); }} 
                                initialDate={selectedAbsenceDate} 
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
