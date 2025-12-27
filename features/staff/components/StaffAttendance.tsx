import React from 'react';
import { Clock } from 'lucide-react';

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function StaffAttendance({ attendance, selectedMonth, setSelectedMonth, employee }: any) {
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
            <div className="flex justify-between items-center mb-6 no-print">
                <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><Clock className="text-emerald-600 w-7 h-7" /> سجل الحضور</h3>
                <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="p-2.5 border rounded-2xl font-bold bg-gray-50 outline-none" />
            </div>
            <div className="overflow-x-auto border rounded-3xl shadow-sm bg-white">
                <table className="w-full text-sm text-right">
                    <thead className="bg-gray-100 font-black"><tr className="border-b"><th className="p-4">التاريخ</th><th className="p-4">اليوم</th><th className="p-4 text-emerald-600">حضور</th><th className="p-4 text-red-500">انصراف</th><th className="p-4">ساعات</th></tr></thead>
                    <tbody>
                        {Array.from({ length: 31 }, (_, i) => {
                            const day = i + 1;
                            const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                            const att = attendance.find((a:any) => a.date === dateStr);
                            const dObj = new Date(dateStr);
                            if (day > new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]), 0).getDate()) return null;
                            const times = att?.times.split(/\s+/).filter((t:string) => t.includes(':')) || [];
                            const cin = times[0] || '--';
                            const cout = times.length > 1 ? times[times.length - 1] : '--';
                            const hours = times.length >= 2 ? calculateHours(times[0], times[times.length-1]).toFixed(1) : '0.0';
                            return (
                                <tr key={dateStr} className="border-b hover:bg-gray-50 transition-colors">
                                    <td className="p-4 font-bold">{dateStr}</td>
                                    <td className="p-4 font-bold">{DAYS_AR[dObj.getDay()]}</td>
                                    <td className="p-4 text-emerald-600 font-black">{cin}</td>
                                    <td className="p-4 text-red-500 font-black">{cout}</td>
                                    <td className="p-4 font-mono font-black">{hours}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}