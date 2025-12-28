import React, { useEffect, useState } from 'react'; // أضفنا useEffect لجلب البيانات إذا لزم الأمر
import { Clock, Calendar } from 'lucide-react';
import { supabase } from '../../../supabaseClient'; // استيراد supabase لجلب البيانات

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function StaffAttendance({ attendance: initialAttendance, selectedMonth: initialMonth, setSelectedMonth, employee }: any) {
    // حالة محلية للبيانات في حال لم يتم تمريرها من الأب
    const [attendanceData, setAttendanceData] = useState(initialAttendance || []);
    const [viewMonth, setViewMonth] = useState(initialMonth || new Date().toISOString().slice(0, 7));

    // دالة لجلب البيانات (إذا لم تمرر من الأب)
    useEffect(() => {
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

    // دالة تحديث الشهر (للمزامنة مع الأب أو محلياً)
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
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 no-print">
                <h3 className="text-xl md:text-2xl font-black flex items-center gap-3 text-gray-800">
                    <Clock className="text-emerald-600 w-6 h-6 md:w-7 md:h-7" /> سجل الحضور
                </h3>
                <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border w-full md:w-auto">
                    <Calendar className="w-5 h-5 text-gray-400"/>
                    <input 
                        type="month" 
                        value={viewMonth} 
                        onChange={handleMonthChange} 
                        className="bg-transparent font-bold text-gray-700 outline-none w-full" 
                    />
                </div>
            </div>

            {/* 👇 هذا هو الغلاف المهم للتجاوب */}
            <div className="overflow-x-auto border rounded-3xl shadow-sm bg-white custom-scrollbar">
                <table className="w-full text-sm text-right min-w-[600px]"> {/* أضفنا min-w */}
                    <thead className="bg-gray-100 font-black text-gray-600">
                        <tr className="border-b">
                            <th className="p-4 whitespace-nowrap">التاريخ</th>
                            <th className="p-4 whitespace-nowrap">اليوم</th>
                            <th className="p-4 text-emerald-600 whitespace-nowrap">حضور</th>
                            <th className="p-4 text-red-500 whitespace-nowrap">انصراف</th>
                            <th className="p-4 whitespace-nowrap">ساعات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: 31 }, (_, i) => {
                            const day = i + 1;
                            const dateStr = `${viewMonth}-${String(day).padStart(2, '0')}`;
                            // التأكد من صحة التاريخ
                            const daysInMonth = new Date(Number(viewMonth.split('-')[0]), Number(viewMonth.split('-')[1]), 0).getDate();
                            if (day > daysInMonth) return null;

                            const dObj = new Date(dateStr);
                            const att = attendanceData.find((a:any) => a.date === dateStr);
                            
                            const times = att?.times.match(/\d{1,2}:\d{2}/g) || []; // استخراج أفضل للوقت
                            const cin = times[0] || '--';
                            const cout = times.length > 1 ? times[times.length - 1] : '--';
                            const hours = times.length >= 2 ? calculateHours(times[0], times[times.length-1]).toFixed(1) : '0.0';
                            
                            const isFriday = dObj.getDay() === 5;

                            return (
                                <tr key={dateStr} className={`border-b transition-colors ${isFriday ? 'bg-gray-50/50' : 'hover:bg-blue-50/30'}`}>
                                    <td className="p-4 font-bold text-gray-700">{dateStr}</td>
                                    <td className={`p-4 font-bold ${isFriday ? 'text-red-400' : 'text-gray-600'}`}>{DAYS_AR[dObj.getDay()]}</td>
                                    <td className="p-4 text-emerald-600 font-black dir-ltr">{cin}</td>
                                    <td className="p-4 text-red-500 font-black dir-ltr">{cout}</td>
                                    <td className="p-4 font-mono font-black text-blue-600">{hours}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
