import React, { useState, useMemo, useRef } from 'react';
import { 
    Clock, Calendar, CheckCircle2, XCircle, 
    AlertTriangle, Star, Info, FileCheck, Loader2, Baby, Printer
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRule } from '../../../types';
import StaffNewRequest from './StaffNewRequest';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DEFAULT_WORK_DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"]; 

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
    const printRef = useRef<HTMLDivElement>(null);
    const [viewMonth, setViewMonth] = useState(initialMonth || new Date().toISOString().slice(0, 7));
    const [selectedAbsenceDate, setSelectedAbsenceDate] = useState<string | null>(null);

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

    // 2. تحليل البيانات
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
        if (!monthData || !settingsData) return { tableRows: [], stats: { present: 0, absent: 0, late: 0, totalHours: 0, leavesCount: 0, weeklyHours: 0 } };

        let present = 0, absent = 0, late = 0, totalHours = 0, leavesCount = 0, weeklyHours = 0;
        const [y, m] = viewMonth.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        const rows = [];

        const joinDateObj = employee.join_date ? new Date(employee.join_date) : null;
        const resignDateObj = employee.resignation_date ? new Date(employee.resignation_date) : null;
        const nursingStart = employee.nursing_start_date ? new Date(employee.nursing_start_date) : null;
        const nursingEnd = employee.nursing_end_date ? new Date(employee.nursing_end_date) : null;
        const partTimeStart = employee.part_time_start_date ? new Date(employee.part_time_start_date) : null;
        const partTimeEnd = employee.part_time_end_date ? new Date(employee.part_time_end_date) : null;

        if (joinDateObj) joinDateObj.setHours(0,0,0,0);
        if (resignDateObj) resignDateObj.setHours(0,0,0,0);
        if (nursingStart) nursingStart.setHours(0,0,0,0);
        if (nursingEnd) nursingEnd.setHours(0,0,0,0);
        if (partTimeStart) partTimeStart.setHours(0,0,0,0);
        if (partTimeEnd) partTimeEnd.setHours(0,0,0,0);

        const customWorkDays = Array.isArray(employee.work_days) ? employee.work_days : [];

        // حساب تواريخ الأسبوع الحالي (من السبت للجمعة)
        const today = new Date();
        const currentDayIdx = today.getDay(); // الأحد = 0، السبت = 6
        const diffToSat = currentDayIdx === 6 ? 0 : currentDayIdx + 1;
        const startOfCurrentWeek = new Date(today);
        startOfCurrentWeek.setDate(today.getDate() - diffToSat);
        startOfCurrentWeek.setHours(0,0,0,0);
        const endOfCurrentWeek = new Date(startOfCurrentWeek);
        endOfCurrentWeek.setDate(startOfCurrentWeek.getDate() + 6);
        endOfCurrentWeek.setHours(23,59,59,999);

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${viewMonth}-${String(i).padStart(2, '0')}`;
            const currentDate = new Date(dateStr);
            currentDate.setHours(0,0,0,0);
            
            const isFuture = currentDate > new Date();
            const dayName = DAYS_AR[currentDate.getDay()];
            
            let isWorkDay = false;
            if (partTimeStart && partTimeEnd && currentDate >= partTimeStart && currentDate <= partTimeEnd) {
                isWorkDay = customWorkDays.includes(dayName);
            } else {
                isWorkDay = DEFAULT_WORK_DAYS.includes(dayName);
            }
            
            let isNotRequired = false;
            let notRequiredReason = '';

            if (joinDateObj && currentDate < joinDateObj) { isNotRequired = true; notRequiredReason = 'قبل الاستلام'; }
            if (resignDateObj && currentDate > resignDateObj) { isNotRequired = true; notRequiredReason = 'بعد الإخلاء'; }

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

            let rowData: any = { dateStr, dayName, isWorkDay, isFuture, isNursing, notRequiredReason };

            if (hasTimes) {
                present++;
                const info = analyzeDay(record, settingsData.rules);
                if (isWorkDay && (info.inStatusColor === 'orange' || info.inStatusColor === 'red')) late++;
                totalHours += info.hours;
                
                // إضافة ساعات هذا الأسبوع
                if (currentDate >= startOfCurrentWeek && currentDate <= endOfCurrentWeek) {
                    weeklyHours += info.hours;
                }
                
                rowData = { ...rowData, type: 'present', data: info };
            } else if (matchingLeave) {
                leavesCount++; 
                rowData = { ...rowData, type: 'leave', data: matchingLeave };
            } else if (officialHoliday) {
                rowData = { ...rowData, type: 'holiday', data: officialHoliday };
            } else if (isNotRequired) {
                rowData = { ...rowData, type: 'not_required' };
            } else if (isWorkDay && !isFuture) {
                absent++;
                rowData = { ...rowData, type: 'absent' };
            } else {
                rowData = { ...rowData, type: 'rest' };
            }
            
            rows.push(rowData);
        }

        return { 
            tableRows: rows, 
            stats: { present, absent, late, totalHours, leavesCount, weeklyHours: parseFloat(weeklyHours.toFixed(1)) } 
        };

    }, [monthData, settingsData, viewMonth, employee]);

    const handleMonthChange = (e: any) => {
        const val = e.target.value;
        setViewMonth(val);
        if (setSelectedMonth) setSelectedMonth(val);
    };

    const getColorClass = (colorName: string) => {
        const map: any = {
            'emerald': 'bg-emerald-50 text-emerald-700 border-emerald-100',
            'green': 'bg-green-50 text-green-700 border-green-100',
            'red': 'bg-red-50 text-red-700 border-red-100',
            'orange': 'bg-orange-50 text-orange-700 border-orange-100',
            'blue': 'bg-blue-50 text-blue-700 border-blue-100',
            'gray': 'bg-gray-50 text-gray-500 border-gray-100',
        };
        return map[colorName] || map['gray'];
    };

    const handleRequestRefresh = () => {
        setSelectedAbsenceDate(null);
        queryClient.invalidateQueries({ queryKey: ['staff_month_data'] });
    };

    const handlePrint = () => {
        if (!printRef.current) return;
        const printContent = printRef.current.innerHTML;
        const originalContent = document.body.innerHTML;
        
        document.body.innerHTML = `
            <div dir="rtl" style="font-family: 'Tajawal', sans-serif; margin: 0; padding: 0; width: 100%;">
                <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px;">
                    <h2 style="margin: 0; font-size: 20px; font-weight: bold;">تقرير الحضور والانصراف التفصيلي</h2>
                    <h4 style="margin: 5px 0; font-size: 16px;">الموظف: ${employee.name} | الكود: ${employee.employee_id}</h4>
                    <p style="margin: 0; font-size: 14px; font-weight: bold; color: #555;">تقرير شهر: ${viewMonth}</p>
                </div>
                ${printContent}
                
                <div style="display: flex; justify-content: space-between; margin-top: 30px; font-weight: bold; font-size: 14px; padding: 0 40px;">
                    <div>توقيع الموظف:<br/><br/>..............................</div>
                    <div>اعتماد شؤون العاملين:<br/><br/>..............................</div>
                </div>
            </div>
        `;
        window.print();
        document.body.innerHTML = originalContent;
        window.location.reload(); 
    };

    return (
        <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500 pb-20">
            
            {/* 🛠️ أدوات التحكم والطباعة */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-3 md:p-4 rounded-[2rem] border shadow-sm gap-3">
                <div>
                    <h3 className="font-black text-gray-800 text-base md:text-lg flex items-center gap-2">
                        <Calendar className="text-emerald-600 w-5 h-5"/> تقرير الحضور
                    </h3>
                    {settingsData?.lastUpdate && (
                        <div className="text-[9px] md:text-[10px] text-blue-600 font-bold mt-1.5 flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 w-fit">
                            <Info className="w-3 h-3"/> تحديث: {settingsData.lastUpdate}
                        </div>
                    )}
                </div>
                <div className="flex w-full md:w-auto items-center gap-2">
                    <div className="relative group w-full md:w-auto flex-1">
                        <div className="flex items-center justify-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 cursor-pointer hover:border-emerald-500 transition-colors">
                            <span className="text-xs md:text-sm font-bold text-gray-600">
                                 {new Date(viewMonth).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
                            </span>
                            <input type="month" value={viewMonth} onChange={handleMonthChange} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                        </div>
                    </div>
                    <button onClick={handlePrint} className="bg-gray-800 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-900 transition-all shadow-sm shrink-0">
                        <Printer className="w-4 h-4"/> <span className="hidden md:inline">طباعة PDF</span>
                    </button>
                </div>
            </div>

            {/* 📊 الكروت المصغرة والجديدة للموبايل */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
                <div className="bg-white p-2 md:p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center gap-0.5 md:gap-1">
                    <div className="p-1.5 bg-green-50 text-green-600 rounded-full"><CheckCircle2 className="w-4 h-4 md:w-5 md:h-5"/></div>
                    <span className="text-sm md:text-xl font-black text-gray-800">{stats.present}</span>
                    <span className="text-[9px] md:text-[10px] text-gray-400 font-bold">يوم حضور</span>
                </div>
                <div className="bg-white p-2 md:p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center gap-0.5 md:gap-1">
                    <div className="p-1.5 bg-red-50 text-red-600 rounded-full"><XCircle className="w-4 h-4 md:w-5 md:h-5"/></div>
                    <span className="text-sm md:text-xl font-black text-gray-800">{stats.absent}</span>
                    <span className="text-[9px] md:text-[10px] text-gray-400 font-bold">غياب</span>
                </div>
                <div className="bg-white p-2 md:p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center gap-0.5 md:gap-1">
                    <div className="p-1.5 bg-purple-50 text-purple-600 rounded-full"><FileCheck className="w-4 h-4 md:w-5 md:h-5"/></div>
                    <span className="text-sm md:text-xl font-black text-gray-800">{stats.leavesCount}</span>
                    <span className="text-[9px] md:text-[10px] text-gray-400 font-bold">إجازات</span>
                </div>
                <div className="bg-white p-2 md:p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center gap-0.5 md:gap-1">
                    <div className="p-1.5 bg-orange-50 text-orange-600 rounded-full"><AlertTriangle className="w-4 h-4 md:w-5 md:h-5"/></div>
                    <span className="text-sm md:text-xl font-black text-gray-800">{stats.late}</span>
                    <span className="text-[9px] md:text-[10px] text-gray-400 font-bold">تأخيرات</span>
                </div>
                {/* كارت ساعات العمل الأسبوعية (الجديد) */}
                <div className="bg-blue-50/50 border border-blue-100 p-2 md:p-3 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-0.5 md:gap-1">
                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded-full"><Clock className="w-4 h-4 md:w-5 md:h-5"/></div>
                    <span className="text-sm md:text-xl font-black text-blue-700">{stats.weeklyHours} <span className="text-[9px] font-normal">س</span></span>
                    <span className="text-[9px] md:text-[10px] text-blue-600 font-bold text-center leading-tight">ساعات هذا الأسبوع</span>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-2 md:p-3 rounded-2xl border border-yellow-100 shadow-sm flex flex-col items-center justify-center gap-0.5 md:gap-1">
                    <div className="p-1.5 bg-yellow-100 text-yellow-600 rounded-full"><Star className="w-4 h-4 md:w-5 md:h-5 fill-yellow-500"/></div>
                    <span className="text-sm md:text-xl font-black text-yellow-700">{monthData?.evaluation ? `${monthData.evaluation}%` : '-'}</span>
                    <span className="text-[9px] md:text-[10px] text-yellow-600 font-bold">التقييم</span>
                </div>
            </div>

            {/* 📋 جدول العرض مع خصائص التصغير (Mobile) والطباعة (Print) */}
            <div className="bg-white rounded-3xl md:rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden print-container" ref={printRef}>
                {/* CSS مخصص لترتيب الورقة المطبوعة */}
                <style type="text/css" media="print">
                    {`
                        @page { size: A4 portrait; margin: 1cm; }
                        .print-table { width: 100%; border-collapse: collapse; font-size: 11px; }
                        .print-table th, .print-table td { border: 1px solid #333 !important; padding: 4px !important; text-align: center !important; }
                        .print-table th { background-color: #f3f4f6 !important; font-weight: bold; }
                        .print-show { display: table-cell !important; }
                        .mobile-only-info { display: none !important; }
                    `}
                </style>
                <div className="w-full">
                    <table className="w-full text-center text-xs md:text-sm print-table">
                        <thead className="bg-gray-50/80 font-black text-gray-600 border-b">
                            <tr>
                                <th className="p-3 md:p-4">التاريخ</th>
                                <th className="p-3 md:p-4">اليوم</th>
                                <th className="p-3 md:p-4">الحضور</th>
                                <th className="p-3 md:p-4">الانصراف</th>
                                <th className="p-3 md:p-4 hidden md:table-cell print-show">حالة الحضور</th>
                                <th className="p-3 md:p-4 hidden md:table-cell print-show">حالة الانصراف</th>
                                <th className="p-3 md:p-4 hidden md:table-cell print-show">إجمالي الساعات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr><td colSpan={7} className="p-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2"/>جاري تحميل البيانات...</td></tr>
                            ) : tableRows.map((row: any) => (
                                <tr 
                                    key={row.dateStr} 
                                    className={`
                                        transition-colors
                                        ${!row.isWorkDay ? 'bg-gray-50/70' : 'hover:bg-gray-50'}
                                        ${row.type === 'absent' ? 'bg-red-50/40 cursor-pointer hover:bg-red-100/50' : ''}
                                        ${row.type === 'leave' ? 'bg-purple-50/30' : ''}
                                        ${row.type === 'holiday' ? 'bg-orange-50/30' : ''}
                                        ${row.type === 'not_required' ? 'bg-gray-100/50 opacity-60' : ''} 
                                    `}
                                    onClick={() => row.type === 'absent' && setSelectedAbsenceDate(row.dateStr)}
                                >
                                    <td className="p-2 md:p-4 font-bold text-gray-700">
                                        <span className="font-mono">{row.dateStr.split('-').reverse().join('/')}</span>
                                        {/* الموبايل: عرض الساعات أسفل التاريخ */}
                                        {row.type === 'present' && row.data.hours > 0 && (
                                            <div className="block md:hidden mobile-only-info text-[9px] text-blue-600 mt-0.5 bg-blue-50 rounded px-1 w-fit mx-auto border border-blue-100 font-black">
                                                {row.data.hours} ساعة
                                            </div>
                                        )}
                                        {row.isNursing && row.isWorkDay && (
                                            <span className="block text-[8px] md:text-[9px] bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded w-fit mx-auto mt-1 flex items-center gap-1 justify-center">
                                                <Baby className="w-2.5 h-2.5"/> رضاعة
                                            </span>
                                        )}
                                    </td>
                                    
                                    <td className={`p-2 md:p-4 font-bold ${!row.isWorkDay ? 'text-gray-400 text-[10px] md:text-sm' : 'text-gray-600 text-xs md:text-sm'}`}>
                                        {row.dayName}
                                    </td>
                                    
                                    <td className="p-2 md:p-4">
                                        {row.type === 'present' ? (
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className="font-mono font-black text-gray-800 text-xs md:text-sm">{row.data.cin}</span>
                                                {/* الموبايل: حالة الحضور أسفل التوقيت */}
                                                <span className={`block md:hidden mobile-only-info text-[8px] px-1.5 py-0.5 rounded border ${getColorClass(row.data.inStatusColor)}`}>
                                                    {row.data.inStatus}
                                                </span>
                                            </div>
                                        ) : row.type === 'leave' ? (
                                            <span className="text-purple-600 text-[9px] md:text-[10px] font-bold block bg-purple-50 p-1 rounded-md max-w-[80px] mx-auto truncate">إجازة: {row.data.type}</span>
                                        ) : row.type === 'holiday' ? (
                                            <span className="text-orange-600 text-[9px] md:text-[10px] font-bold block bg-orange-50 p-1 rounded-md max-w-[80px] mx-auto truncate">عطلة: {row.data.name}</span>
                                        ) : row.type === 'absent' ? (
                                            <span className="text-red-500 text-[10px] md:text-xs font-bold block">غياب</span>
                                        ) : row.type === 'not_required' ? (
                                            <span className="text-gray-400 text-[9px] md:text-xs font-bold">{row.notRequiredReason}</span>
                                        ) : !row.isWorkDay && !row.isFuture ? (
                                            <span className="text-gray-400 text-[9px] md:text-[10px] font-bold">راحة</span>
                                        ) : <span className="text-gray-300">-</span>}
                                    </td>

                                    <td className="p-2 md:p-4">
                                        {row.type === 'present' && row.data.cout ? (
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className="font-mono font-black text-gray-800 text-xs md:text-sm">{row.data.cout}</span>
                                                {/* الموبايل: حالة الانصراف أسفل التوقيت */}
                                                <span className={`block md:hidden mobile-only-info text-[8px] px-1.5 py-0.5 rounded border ${getColorClass(row.data.outStatusColor)}`}>
                                                    {row.data.outStatus}
                                                </span>
                                            </div>
                                        ) : <span className="text-gray-300">-</span>}
                                    </td>

                                    {/* الأعمدة الإضافية للديسكتوب والطباعة فقط */}
                                    <td className="p-4 hidden md:table-cell print-show">
                                        {row.type === 'present' && (
                                            <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${getColorClass(row.data.inStatusColor)}`}>{row.data.inStatus}</span>
                                        )}
                                    </td>
                                    
                                    <td className="p-4 hidden md:table-cell print-show">
                                        {row.type === 'present' && row.data.cout && (
                                            <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${getColorClass(row.data.outStatusColor)}`}>{row.data.outStatus}</span>
                                        )}
                                    </td>

                                    <td className="p-4 font-mono font-black text-blue-600 hidden md:table-cell print-show">
                                        {row.type === 'present' && row.data.hours > 0 ? (
                                            <span>{row.data.hours} س</span>
                                        ) : row.type === 'not_required' ? (
                                            <span className="text-gray-400 text-xs font-normal">غير مطالب</span>
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
                        <div className="p-6 md:p-8">
                            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-2 flex items-center gap-2"> تبرير غياب يوم {selectedAbsenceDate}</h3>
                            <StaffNewRequest employee={employee} refresh={handleRequestRefresh} initialDate={selectedAbsenceDate} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
