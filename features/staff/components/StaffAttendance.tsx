import React, { useEffect, useState } from 'react';
import { Clock, Calendar, Info } from 'lucide-react';
import { supabase } from '../../../supabaseClient';

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function StaffAttendance({ attendance: initialAttendance, selectedMonth: initialMonth, setSelectedMonth, employee }: any) {
    const [attendanceData, setAttendanceData] = useState(initialAttendance || []);
    const [viewMonth, setViewMonth] = useState(initialMonth || new Date().toISOString().slice(0, 7));
    const [lastUpdate, setLastUpdate] = useState<string>('');

    useEffect(() => {
        const fetchMeta = async () => {
            const { data } = await supabase.from('general_settings').select('last_attendance_update').limit(1).maybeSingle();
            if (data && data.last_attendance_update) {
                setLastUpdate(new Date(data.last_attendance_update).toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' }));
            }
        };
        fetchMeta();

        if (initialAttendance && initialAttendance.length > 0) {
            setAttendanceData(initialAttendance);
        } else if (employee?.employee_id) {
            const fetchAtt = async () => {
                const { data } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('employee_id', employee.employee_id)
                    .gte('date', `${viewMonth}-01`)
                    .lte('date', `${viewMonth}-31`);
                if (data) setAttendanceData(data);
            };
            fetchAtt();
        }
    }, [viewMonth, employee, initialAttendance]);

    const handleMonthChange = (e: any) => {
        const val = e.target.value;
        setViewMonth(val);
        if (setSelectedMonth) setSelectedMonth(val);
    };

    const calculateHours = (inT: string, outT: string) => {
        if (!inT || !outT) return 0;
        const [h1, m1] = inT.split(':').map(Number);
        const [h2, m2] = outT.split(':').map(Number);
        let diff = (new Date(0,0,0,h2,m2).getTime() - new Date(0,0,0,h1,m1).getTime()) / 3600000;
        if (diff < 0) diff += 24;
        return diff;
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
            {/* الهيدر والفلاتر */}
            <div className="flex flex-col gap-4 mb-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg md:text-2xl font-black flex items-center gap-2 text-gray-800">
                        <Clock className="text-emerald-600 w-6 h-6" /> سجل الحضور
                    </h3>
                    <div className="bg-gray-100 px-3 py-2 rounded-xl flex items-center gap-2 border border-gray-200">
                        <Calendar className="w-4 h-4 text-gray-500"/>
                        <input 
                            type="month" 
                            value={viewMonth} 
                            onChange={handleMonthChange} 
                            className="bg-transparent font-bold text-sm text-gray-700 outline-none w-28" 
                        />
                    </div>
                </div>
                
                {lastUpdate && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5 flex items-center gap-2 text-xs font-bold text-blue-700">
                        <Info className="w-4 h-4 shrink-0"/> 
                        <span>تم تحديث البيانات: {lastUpdate}</span>
                    </div>
                )}
            </div>

            {/* الجدول المتجاوب */}
            <div className="border border-gray-100 rounded-3xl shadow-sm bg-white overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar pb-2">
                    <table className="w-full text-sm text-right min-w-[500px]">
                        <thead className="bg-gray-50/50 font-black text-gray-500 border-b">
                            <tr>
                                <th className="p-4 whitespace-nowrap">التاريخ</th>
                                <th className="p-4 whitespace-nowrap">اليوم</th>
                                <th className="p-4 whitespace-nowrap text-emerald-600">دخول</th>
                                <th className="p-4 whitespace-nowrap text-red-500">خروج</th>
                                <th className="p-4 whitespace-nowrap">ساعات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {Array.from({ length: 31 }, (_, i) => {
                                const day = i + 1;
                                const dateStr = `${viewMonth}-${String(day).padStart(2, '0')}`;
                                const daysInMonth = new Date(Number(viewMonth.split('-')[0]), Number(viewMonth.split('-')[1]), 0).getDate();
                                if (day > daysInMonth) return null;

                                const dObj = new Date(dateStr);
                                const att = attendanceData.find((a:any) => a.date === dateStr);
                                
                                const times = att?.times.match(/\d{1,2}:\d{2}/g) || [];
                                const cin = times[0] || '--';
                                const cout = times.length > 1 ? times[times.length - 1] : '--';
                                const hours = times.length >= 2 ? calculateHours(times[0], times[times.length-1]).toFixed(1) : '-';
                                
                                const isFriday = dObj.getDay() === 5;

                                return (
                                    <tr key={dateStr} className={`transition-colors ${isFriday ? 'bg-red-50/30' : 'hover:bg-emerald-50/30'}`}>
                                        <td className="p-4 font-bold text-gray-700 text-xs">{dateStr}</td>
                                        <td className={`p-4 font-bold text-xs ${isFriday ? 'text-red-400' : 'text-gray-500'}`}>{DAYS_AR[dObj.getDay()]}</td>
                                        <td className="p-4 font-black text-emerald-600 dir-ltr text-xs">{cin}</td>
                                        <td className="p-4 font-black text-red-500 dir-ltr text-xs">{cout}</td>
                                        <td className="p-4 font-mono font-bold text-blue-600 text-xs">{hours}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
