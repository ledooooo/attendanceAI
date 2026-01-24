import React, { useState, useMemo } from 'react';
import { 
    Clock, Calendar, CheckCircle2, XCircle, 
    AlertTriangle, Star, Info, FileCheck, Loader2, Baby
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRule } from '../../../types';
import StaffNewRequest from './StaffNewRequest';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

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
    attendance?: any[], 
    selectedMonth: string, 
    setSelectedMonth: any, 
    employee: Employee 
}) {
    const queryClient = useQueryClient();
    const [viewMonth, setViewMonth] = useState(initialMonth || new Date().toISOString().slice(0, 7));
    const [selectedAbsenceDate, setSelectedAbsenceDate] = useState<string | null>(null);

    const workDays = employee.work_days && employee.work_days.length > 0 
        ? employee.work_days 
        : ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
    
    // 1. جلب البيانات
    const { data: settingsData } = useQuery({
        queryKey: ['attendance_settings_rules'],
        queryFn: async () => {
            const { data: settings } = await supabase.from('general_settings').select('*').limit(1).single();
            const { data: rules } = await supabase.from('attendance_rules').select('*');
            
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
        staleTime: 1000 * 60 * 10 
    });

    const { data: monthData, isLoading } = useQuery({
        queryKey: ['staff_month_data', employee.employee_id, viewMonth],
        queryFn: async () => {
            const [y, m] = viewMonth.split('-').map(Number);
            const daysInMonth = new Date(y, m, 0).getDate();
            const startOfMonth = `${viewMonth}-01`;
            const endOfMonth = `${viewMonth}-${daysInMonth}`;

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

    // 2. تحليل البيانات (المنطق المحدث)
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

    const { tableRows, stats } = useMemo(() => {
        if (!monthData || !settingsData) return { tableRows: [], stats: { present: 0, absent: 0, late: 0, totalHours: 0, leavesCount: 0 } };

        let present = 0, absent = 0, late = 0, totalHours = 0, leavesCount = 0;
        const [y, m] = viewMonth.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        const rows = [];

        // تحويل تواريخ الموظف لكائنات Date للمقارنة
        const joinDateObj = employee.join_date ? new Date(employee.join_date) : null;
        const resignDateObj = employee.resignation_date ? new Date(employee.resignation_date) : null;
        const nursingStart = employee.nursing_start_date ? new Date(employee.nursing_start_date) : null;
        const nursingEnd = employee.nursing_end_date ? new Date(employee.nursing_end_date) : null;

        if (joinDateObj) joinDateObj.setHours(0,0,0,0);
        if (resignDateObj) resignDateObj.setHours(0,0,0,0);
        if (nursingStart) nursingStart.setHours(0,0,0,0);
        if (nursingEnd) nursingEnd.setHours(0,0,0,0);

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${viewMonth}-${String(i).padStart(2, '0')}`;
            const currentDate = new Date(dateStr);
            currentDate.setHours(0,0,0,0);
            
            const isFuture = currentDate > new Date();
            const dayName = DAYS_AR[currentDate.getDay()];
            const isWorkDay = workDays.includes(dayName);
            
            // 1. التحقق من تاريخ الاستلام والإخلاء
            let isNotRequired = false;
            let notRequiredReason = '';

            if (joinDateObj && currentDate < joinDateObj) {
                isNotRequired = true;
                notRequiredReason = 'قبل الاستلام';
            }
            if (resignDateObj && currentDate > resignDateObj) {
                isNotRequired = true;
                notRequiredReason = 'بعد الإخلاء';
            }

            // 2. التحقق من فترة الرضاعة
            let isNursing = false;
            if (nursingStart && nursingEnd && currentDate >= nursingStart && currentDate <= nursingEnd) {
                isNursing = true;
            }

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
                rows.push({ dateStr, dayName, isWorkDay, isFuture, type: 'present', data: info, isNursing, notRequiredReason });
            } else if (matchingLeave) {
                leavesCount++; 
                rows.push({ dateStr, dayName, isWorkDay, isFuture, type: 'leave', data: matchingLeave, isNursing });
            } else if (officialHoliday) {
                rows.push({ dateStr, dayName, isWorkDay, isFuture, type: 'holiday', data: officialHoliday, isNursing });
            } else if (isNotRequired) {
                // ✅ حالة جديدة: غير مطالب
                rows.push({ dateStr, dayName, isWorkDay, isFuture, type: 'not_required', notRequiredReason });
            } else if (isWorkDay && !isFuture) {
                absent++;
                rows.push({ dateStr, dayName, isWorkDay, isFuture, type: 'absent', isNursing });
            } else {
                rows.push({ dateStr, dayName, isWorkDay, isFuture, type: 'rest', isNursing });
            }
        }

        return { 
            tableRows: rows, 
            stats: { present, absent, late, totalHours, leavesCount } 
        };

    }, [monthData, settingsData, viewMonth, workDays, employee]); // تمت إضافة employee للاعتماديات

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

    const handleRequestRefresh = () => {
        setSelectedAbsenceDate(null);
        queryClient.invalidateQueries({ queryKey: ['staff_month_data'] });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
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
                    <span className="text-[10px] text-gray-400 font-bold">إجازات</span>
                </div>
                <div className="bg-white p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center gap-1">
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-full"><AlertTriangle className="w-5 h-5"/></div>
                    <span className="text-xl font-black text-gray-800">{stats.late}</span>
                    <span className="text-[10px] text-gray-400 font-bold">تأخيرات</span>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-3 rounded-2xl border border-yellow-100 shadow-sm flex flex-col items-center justify-center gap-1 col-span-2 md:col-span-1">
                    <div className="p-2 bg-yellow-100 text-yellow-600 rounded-full"><Star className="w-5 h-5 fill-yellow-500"/></div>
                    <span className="text-xl font-black text-yellow-700">{monthData?.evaluation ? `${monthData.evaluation}%` : '-'}</span>
                    <span className="text-[10px] text-yellow-600 font-bold">التقييم</span>
                </div>
            </div>

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
                                        ${row.type === 'not_required' ? 'bg-gray-100/50 opacity-60' : ''} 
                                    `}
                                    onClick={() => row.type === 'absent' && setSelectedAbsenceDate(row.dateStr)}
                                >
                                    <td className="p-4 font-bold text-gray-700">
                                        {row.dateStr}
                                        {/* شارة الرضاعة */}
                                        {row.isNursing && row.isWorkDay && (
                                            <span className="block text-[9px] bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded w-fit mt-1 flex items-center gap-1">
                                                <Baby className="w-3 h-3"/> ساعة رضاعة
                                            </span>
                                        )}
                                    </td>
                                    <td className={`p-4 font-bold ${!row.isWorkDay ? 'text-gray-400' : 'text-gray-600'}`}>{row.dayName}</td>
                                    
                                    <td className="p-4">{row.type === 'present' ? <span className="font-mono font-black text-gray-800">{row.data.cin}</span> : '--'}</td>
                                    <td className="p-4">{row.type === 'present' && row.data.cout ? <span className="font-mono font-black text-gray-800">{row.data.cout}</span> : '--'}</td>

                                    <td className="p-4">
                                        {row.type === 'present' ? (
                                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getColorClass(row.data.inStatusColor)}`}>{row.data.inStatus}</span>
                                        ) : row.type === 'leave' ? (
                                            <span className="text-purple-600 text-[10px] font-bold flex items-center gap-1"><FileCheck className="w-3 h-3"/> {row.data.type}</span>
                                        ) : row.type === 'holiday' ? (
                                            <span className="text-orange-600 text-[10px] font-bold flex items-center gap-1"><Star className="w-3 h-3"/> {row.data.name}</span>
                                        ) : row.type === 'absent' ? (
                                            <span className="text-red-500 text-xs font-bold flex items-center gap-1"><XCircle className="w-3 h-3"/> غياب</span>
                                        ) : row.type === 'not_required' ? (
                                            <span className="text-gray-400 text-xs font-bold">{row.notRequiredReason}</span>
                                        ) : !row.isWorkDay && !row.isFuture ? (
                                            <span className="text-gray-400 text-[10px] font-bold">راحة</span>
                                        ) : '-'}
                                    </td>

                                    <td className="p-4">
                                        {row.type === 'present' && row.data.cout ? (
                                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getColorClass(row.data.outStatusColor)}`}>{row.data.outStatus}</span>
                                        ) : '-'}
                                    </td>

                                    <td className="p-4 font-mono font-bold text-blue-600">
                                        {row.type === 'present' && row.data.hours > 0 ? (
                                            <span>{row.data.hours} س</span>
                                        ) : row.type === 'not_required' ? (
                                            <span className="text-gray-400 text-xs">غير مطالب</span>
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
