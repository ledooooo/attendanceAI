import React, { useState, useMemo } from 'react';
import { 
    Clock, Calendar, CheckCircle2, XCircle, 
    AlertTriangle, Star, Info, FileCheck, PartyPopper, Loader2
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRule } from '../../../types';
import StaffNewRequest from './StaffNewRequest';
// 1. ✅ استيراد React Query
import { useQuery, useQueryClient } from '@tanstack/react-query';

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// دوال مساعدة (خارج المكون لمنع إعادة تعريفها)
const toMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

const calcHours = (t1: string, t2: string) => {
    if (!t1 || !t2) return 0;
    const diff = toMinutes(t2) - toMinutes(t1);
    return diff > 0 ? parseFloat((diff / 60).toFixed(1)) : 0;
};

export default function StaffAttendance({ 
    selectedMonth: initialMonth, 
    setSelectedMonth, 
    employee 
}: { 
    attendance?: any[], // لم نعد بحاجة له لأننا سنجلب الأحدث
    selectedMonth: string, 
    setSelectedMonth: any, 
    employee: Employee 
}) {
    const queryClient = useQueryClient();
    const [viewMonth, setViewMonth] = useState(initialMonth || new Date().toISOString().slice(0, 7));
    const [selectedAbsenceDate, setSelectedAbsenceDate] = useState<string | null>(null);

    // أيام العمل
    const workDays = employee.work_days && employee.work_days.length > 0 
        ? employee.work_days 
        : ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
    
    const isPartTime = workDays.length < 5;

    // ------------------------------------------------------------------
    // 1. 📥 جلب البيانات (Queries)
    // ------------------------------------------------------------------

    // أ) جلب الإعدادات والقواعد والعطلات (بيانات عامة)
    const { data: settingsData } = useQuery({
        queryKey: ['attendance_settings_rules'],
        queryFn: async () => {
            const { data: settings } = await supabase.from('general_settings').select('*').limit(1).single();
            const { data: rules } = await supabase.from('attendance_rules').select('*');
            
            // معالجة العطلات
            let formattedHolidays: {name: string, date: string}[] = [];
            if (settings?.holidays_name && settings?.holidays_date) {
                formattedHolidays = settings.holidays_name.map((name: string, i: number) => ({
                    name: name,
                    date: settings.holidays_date[i]
                }));
            }

            return {
                rules: rules as AttendanceRule[] || [],
                holidays: formattedHolidays,
                lastUpdate: settings?.last_attendance_update 
                    ? new Date(settings.last_attendance_update).toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' }) 
                    : ''
            };
        },
        staleTime: 1000 * 60 * 10 // تحديث كل 10 دقائق
    });

    // ب) جلب بيانات الشهر (حضور، إجازات، تقييم)
    const { data: monthData, isLoading } = useQuery({
        queryKey: ['staff_month_data', employee.employee_id, viewMonth],
        queryFn: async () => {
            const [y, m] = viewMonth.split('-').map(Number);
            const daysInMonth = new Date(y, m, 0).getDate();
            const startOfMonth = `${viewMonth}-01`;
            const endOfMonth = `${viewMonth}-${daysInMonth}`;

            // طلبات متوازية (Parallel Fetching) لسرعة أكبر
            const [attRes, leavesRes, evalRes] = await Promise.all([
                supabase.from('attendance').select('*')
                    .eq('employee_id', employee.employee_id)
                    .gte('date', startOfMonth).lte('date', endOfMonth),
                
                supabase.from('leave_requests').select('*')
                    .eq('employee_id', employee.employee_id)
                    .eq('status', 'مقبول')
                    .lte('start_date', endOfMonth).gte('end_date', startOfMonth),

                supabase.from('evaluations').select('total_score')
                    .eq('employee_id', employee.employee_id)
                    .eq('month', viewMonth).maybeSingle()
            ]);

            return {
                attendance: attRes.data || [],
                leaves: leavesRes.data || [],
                evaluation: evalRes.data?.total_score || null
            };
        }
    });

    // ------------------------------------------------------------------
    // 2. 🧮 معالجة البيانات والحسابات (Logic Layer)
    // ------------------------------------------------------------------

    // دالة تحليل اليوم (Memoized Logic)
    const analyzeDay = (attRecord: any, rulesList: AttendanceRule[]) => {
        const times = attRecord?.times?.match(/\d{1,2}:\d{2}/g) || [];
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
            const rule = rulesList.find(r => r.type === 'in' && cinMins >= toMinutes(r.start_time) && cinMins <= toMinutes(r.end_time));
            if (rule) { inStatus = rule.name; inStatusColor = rule.color; } 
            else { inStatus = 'خارج القواعد'; }
        }

        if (cout) {
            const coutMins = toMinutes(cout);
            const rule = rulesList.find(r => r.type === 'out' && coutMins >= toMinutes(r.start_time) && coutMins <= toMinutes(r.end_time));
            if (rule) { outStatus = rule.name; outStatusColor = rule.color; } 
            else { outStatus = 'خارج القواعد'; }
            hours = calcHours(cin, cout);
        }

        return { cin, cout, inStatus, inStatusColor, outStatus, outStatusColor, hours };
    };

    // حساب الجدول والإحصائيات (Computed Data)
    const { tableRows, stats } = useMemo(() => {
        if (!monthData || !settingsData) return { tableRows: [], stats: { present: 0, absent: 0, late: 0, totalHours: 0, leavesCount: 0 } };

        let present = 0, absent = 0, late = 0, totalHours = 0, leavesCount = 0;
        const [y, m] = viewMonth.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        const rows = [];

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${viewMonth}-${String(i).padStart(2, '0')}`;
            const currentDate = new Date(dateStr);
            currentDate.setHours(0,0,0,0);
            
            const isFuture = currentDate > new Date();
            const dayName = DAYS_AR[currentDate.getDay()];
            const isWorkDay = workDays.includes(dayName);
            
            const record = monthData.attendance.find((a: any) => a.date === dateStr);
            const hasTimes = record && record.times && record.times.trim().length > 0;

            const matchingLeave = monthData.leaves.find((l: any) => {
                const start = new Date(l.start_date); start.setHours(0,0,0,0);
                const end = new Date(l.end_date); end.setHours(0,0,0,0);
                return currentDate >= start && currentDate <= end;
            });

            const officialHoliday = settingsData.holidays.find(h => h.date === dateStr);

            if (hasTimes) {
                present++;
                const info = analyzeDay(record, settingsData.rules);
                if (isWorkDay && (info.inStatusColor === 'orange' || info.inStatusColor === 'red')) {
                    late++;
                }
                totalHours += info.hours;
                rows.push({ dateStr, dayName, isWorkDay, isFuture, type: 'present', data: info });
            } else if (matchingLeave) {
                leavesCount++; 
                rows.push({ dateStr, dayName, isWorkDay, isFuture, type: 'leave', data: matchingLeave });
            } else if (officialHoliday) {
                rows.push({ dateStr, dayName, isWorkDay, isFuture, type: 'holiday', data: officialHoliday });
            } else if (isWorkDay && !isFuture) {
                absent++;
                rows.push({ dateStr, dayName, isWorkDay, isFuture, type: 'absent' });
            } else {
                rows.push({ dateStr, dayName, isWorkDay, isFuture, type: 'rest' });
            }
        }

        return { 
            tableRows: rows, 
            stats: { present, absent, late, totalHours, leavesCount } 
        };

    }, [monthData, settingsData, viewMonth, workDays]);

    // ------------------------------------------------------------------
    // 3. 🎨 واجهة المستخدم (UI)
    // ------------------------------------------------------------------

    const handleMonthChange = (e: any) => {
        const val = e.target.value;
        setViewMonth(val);
        if (setSelectedMonth) setSelectedMonth(val);
    };

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

    // إعادة تحديث البيانات عند إغلاق طلب التبرير
    const handleRequestRefresh = () => {
        setSelectedAbsenceDate(null);
        queryClient.invalidateQueries({ queryKey: ['staff_month_data'] });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-3xl border shadow-sm gap-4">
                <div>
                    <h3 className="font-black text-gray-800 text-lg flex items-center gap-2">
                        <Calendar className="text-emerald-600"/> تقرير الحضور
                    </h3>
                    {settingsData?.lastUpdate && (
                        <div className="text-[10px] md:text-xs text-blue-600 font-bold mt-2 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 w-fit">
                            <Info className="w-3 h-3"/> آخر تحديث: {settingsData.lastUpdate}
                        </div>
                    )}
                </div>
                <div className="relative group w-full md:w-auto">
                    <div className="flex items-center justify-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 cursor-pointer hover:border-emerald-500 transition-colors">
                        <span className="text-sm font-bold text-gray-600">
                             {new Date(viewMonth).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
                        </span>
                        <input type="month" value={viewMonth} onChange={handleMonthChange} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-white p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center gap-1">
                    <div className="p-2 bg-green-50 text-green-600 rounded-full"><CheckCircle2 className="w-5 h-5"/></div>
                    <span className="text-xl font-black text-gray-800">{stats.present}</span>
                    <span className="text-[10px] text-gray-400 font-bold">يوم حضور</span>
                </div>
                <div className="bg-white p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center gap-1">
                    <div className="p-2 bg-red-50 text-red-600 rounded-full"><XCircle className="w-5 h-5"/></div>
                    <span className="text-xl font-black text-gray-800">{stats.absent}</span>
                    <span className="text-[10px] text-gray-400 font-bold">غياب</span>
                </div>
                <div className="bg-white p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center gap-1">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-full"><FileCheck className="w-5 h-5"/></div>
                    <span className="text-xl font-black text-gray-800">{stats.leavesCount}</span>
                    <span className="text-[10px] text-gray-400 font-bold">إجازات/مأموريات</span>
                </div>
                <div className="bg-white p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center gap-1">
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-full"><AlertTriangle className="w-5 h-5"/></div>
                    <span className="text-xl font-black text-gray-800">{stats.late}</span>
                    <span className="text-[10px] text-gray-400 font-bold">تأخيرات</span>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-3 rounded-2xl border border-yellow-100 shadow-sm flex flex-col items-center justify-center gap-1 col-span-2 md:col-span-1">
                    <div className="p-2 bg-yellow-100 text-yellow-600 rounded-full"><Star className="w-5 h-5 fill-yellow-500"/></div>
                    <span className="text-xl font-black text-yellow-700">{monthData?.evaluation ? `${monthData.evaluation}%` : '-'}</span>
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
                                <th className="p-4">الحالة العامة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? (
                                <tr><td colSpan={7} className="p-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2"/>جاري تحميل البيانات...</td></tr>
                            ) : tableRows.map((row: any) => (
                                <tr 
                                    key={row.dateStr} 
                                    className={`
                                        transition-colors
                                        ${!row.isWorkDay ? 'bg-gray-50/50' : 'hover:bg-gray-50'}
                                        ${row.type === 'absent' ? 'bg-red-50/30 cursor-pointer hover:bg-red-100/30' : ''}
                                        ${row.type === 'leave' ? 'bg-purple-50/30' : ''}
                                        ${row.type === 'holiday' ? 'bg-orange-50/30' : ''}
                                    `}
                                    onClick={() => row.type === 'absent' && setSelectedAbsenceDate(row.dateStr)}
                                >
                                    <td className="p-4 font-bold text-gray-700">{row.dateStr}</td>
                                    <td className={`p-4 font-bold ${!row.isWorkDay ? 'text-gray-400' : 'text-gray-600'}`}>{row.dayName}</td>
                                    
                                    {/* تفاصيل الحضور والانصراف */}
                                    <td className="p-4">{row.type === 'present' ? <span className="font-mono font-black text-gray-800">{row.data.cin}</span> : '--'}</td>
                                    <td className="p-4">{row.type === 'present' && row.data.cout ? <span className="font-mono font-black text-gray-800">{row.data.cout}</span> : '--'}</td>

                                    {/* حالة الحضور */}
                                    <td className="p-4">
                                        {row.type === 'present' ? (
                                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getColorClass(row.data.inStatusColor)}`}>{row.data.inStatus}</span>
                                        ) : row.type === 'leave' ? (
                                            <span className="text-purple-600 text-[10px] font-bold flex items-center gap-1">
                                                <FileCheck className="w-3 h-3"/> {row.data.type}
                                            </span>
                                        ) : row.type === 'holiday' ? (
                                            <span className="text-orange-600 text-[10px] font-bold flex items-center gap-1">
                                                <PartyPopper className="w-3 h-3"/> {row.data.name}
                                            </span>
                                        ) : row.type === 'absent' ? (
                                            <span className="text-red-500 text-xs font-bold flex items-center gap-1"><XCircle className="w-3 h-3"/> غياب</span>
                                        ) : !row.isWorkDay && !row.isFuture ? (
                                            <span className="text-gray-400 text-[10px] font-bold">راحة</span>
                                        ) : '-'}
                                    </td>

                                    {/* حالة الانصراف */}
                                    <td className="p-4">
                                        {row.type === 'present' && row.data.cout ? (
                                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getColorClass(row.data.outStatusColor)}`}>{row.data.outStatus}</span>
                                        ) : '-'}
                                    </td>

                                    {/* الحالة العامة */}
                                    <td className="p-4 font-mono font-bold text-blue-600">
                                        {row.type === 'present' && row.data.hours > 0 ? (
                                            <span>{row.data.hours} س {!row.isWorkDay && <span className="text-[10px] text-orange-500 mr-1">(إضافي)</span>}</span>
                                        ) : row.type === 'leave' ? (
                                            <span className="text-purple-400 text-xs">طلب مقبول</span>
                                        ) : row.type === 'holiday' ? (
                                            <span className="text-orange-400 text-xs">عطلة رسمية</span>
                                        ) : row.type === 'rest' ? (
                                            <span className="text-gray-400 text-xs">
                                                {!row.isWorkDay && !row.isFuture ? (isPartTime ? 'غير مطالب' : 'عطلة') : '-'}
                                            </span>
                                        ) : ''}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedAbsenceDate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <button onClick={() => setSelectedAbsenceDate(null)} className="absolute top-6 left-6 p-2 bg-gray-100 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"><XCircle className="w-6 h-6"/></button>
                        <div className="p-8">
                            <h3 className="text-xl font-black text-gray-800 mb-2 flex items-center gap-2"> تبرير غياب يوم {selectedAbsenceDate}</h3>
                            <StaffNewRequest employee={employee} refresh={handleRequestRefresh} initialDate={selectedAbsenceDate} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
