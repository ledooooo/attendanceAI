import React, { useMemo } from 'react';
import { BarChart } from 'lucide-react';

export default function StaffStats({ attendance, month }: any) {
    const stats = useMemo(() => {
        const atts = attendance.filter((a:any) => a.date.startsWith(month));
        let totalHours = 0;
        atts.forEach((a:any) => {
            const times = a.times.split(/\s+/).filter((t:string) => t.includes(':'));
            if (times.length >= 2) {
                const [h1, m1] = times[0].split(':').map(Number);
                const [h2, m2] = times[times.length-1].split(':').map(Number);
                let diff = (new Date(0,0,0,h2,m2).getTime() - new Date(0,0,0,h1,m1).getTime()) / 3600000;
                if (diff < 0) diff += 24;
                totalHours += diff;
            }
        });
        return { days: atts.length, hours: totalHours.toFixed(1) };
    }, [attendance, month]);

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><BarChart className="text-emerald-600 w-7 h-7" /> إحصائيات الأداء لشهر {month}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-emerald-600 p-8 rounded-3xl text-white shadow-xl transform hover:scale-105 transition-transform cursor-default">
                    <h4 className="text-6xl font-black mb-2">{stats.hours}</h4>
                    <p className="font-bold opacity-80">ساعة عمل فعلية</p>
                </div>
                <div className="bg-blue-600 p-8 rounded-3xl text-white shadow-xl transform hover:scale-105 transition-transform cursor-default">
                    <h4 className="text-6xl font-black mb-2">{stats.days}</h4>
                    <p className="font-bold opacity-80">يوم حضور</p>
                </div>
            </div>
            
            <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 text-center">
                <p className="text-amber-800 font-bold text-sm">يتم احتساب الساعات بناءً على أول بصمة دخول وآخر بصمة خروج في اليوم.</p>
            </div>
        </div>
    );
}