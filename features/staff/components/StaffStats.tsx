import React, { useState, useMemo } from 'react';
import { BarChart3, Clock, CalendarX, Award, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AttendanceRecord, Evaluation, LeaveRequest } from '../../../types';

export default function StaffStats({ attendance, evals, requests, month }: { attendance: AttendanceRecord[], evals: Evaluation[], requests: LeaveRequest[], month: string }) {
    const [selectedMonth, setSelectedMonth] = useState(month);

    const stats = useMemo(() => {
        // 1. فلترة البيانات حسب الشهر
        const monthAtt = attendance.filter(a => a.date.startsWith(selectedMonth));
        const monthEval = evals.find(e => e.month === selectedMonth);
        const monthLeaves = requests.filter(r => r.start_date.startsWith(selectedMonth) && r.status === 'مقبول');

        // 2. حسابات الحضور والساعات
        let totalHours = 0;
        let latenessCount = 0; // مرات التأخير (فرضنا أن بعد 8:30 يعتبر تأخير)
        
        monthAtt.forEach(a => {
            const times = a.times.split(/\s+/).filter(t => t.includes(':'));
            if (times.length > 0) {
                // حساب التأخير (مثال: الحضور بعد 08:30)
                const [h, m] = times[0].split(':').map(Number);
                if (h > 8 || (h === 8 && m > 30)) latenessCount++;

                // حساب الساعات
                if (times.length >= 2) {
                    const [h1, m1] = times[0].split(':').map(Number);
                    const [h2, m2] = times[times.length-1].split(':').map(Number);
                    let diff = (new Date(0,0,0,h2,m2).getTime() - new Date(0,0,0,h1,m1).getTime()) / 3600000;
                    if (diff < 0) diff += 24;
                    totalHours += diff;
                }
            }
        });

        // 3. حساب الغياب التقريبي (أيام الشهر - الجمعة - الحضور - الإجازات)
        const daysInMonth = new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]), 0).getDate();
        let workDays = 0;
        for(let d=1; d<=daysInMonth; d++) {
            const date = new Date(selectedMonth + '-' + String(d).padStart(2,'0'));
            if (date.getDay() !== 5) workDays++; // استبعاد الجمعة
        }
        
        const leaveDays = monthLeaves.reduce((acc, curr) => {
             // منطق بسيط لحساب أيام الإجازة في هذا الشهر
             return acc + 1; // يحتاج تحسين لحساب الفرق بين التواريخ بدقة
        }, 0);

        const absence = Math.max(0, workDays - monthAtt.length - leaveDays);

        return {
            daysPresent: monthAtt.length,
            hours: totalHours.toFixed(1),
            lateness: latenessCount,
            leaves: leaveDays,
            absence: absence,
            eval: monthEval
        };
    }, [attendance, evals, requests, selectedMonth]);

    const StatCard = ({ title, value, sub, icon: Icon, color }: any) => (
        <div className={`p-6 rounded-3xl text-white shadow-lg relative overflow-hidden ${color}`}>
            <Icon className="absolute left-[-10px] bottom-[-10px] w-24 h-24 opacity-20 rotate-12" />
            <h4 className="text-4xl font-black mb-1 z-10 relative">{value}</h4>
            <p className="font-bold opacity-90 z-10 relative text-sm">{title}</p>
            {sub && <p className="text-[10px] mt-2 opacity-75 z-10 relative bg-black/10 inline-block px-2 py-1 rounded">{sub}</p>}
        </div>
    );

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
            <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800">
                    <BarChart3 className="text-emerald-600 w-7 h-7" /> لوحة الإحصائيات التحليلية
                </h3>
                <input 
                    type="month" 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)} 
                    className="p-2 border rounded-xl font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-emerald-500" 
                />
            </div>

            {/* الكروت العلوية */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard title="أيام الحضور" value={stats.daysPresent} sub="يوم عمل فعلي" icon={CheckCircle2} color="bg-emerald-500" />
                <StatCard title="ساعات العمل" value={stats.hours} sub="ساعة معتمدة" icon={Clock} color="bg-blue-500" />
                <StatCard title="أيام الغياب" value={stats.absence} sub="غياب بدون إذن" icon={AlertTriangle} color="bg-red-500" />
                <StatCard title="الإجازات" value={stats.leaves} sub="إجازة مقبولة" icon={CalendarX} color="bg-amber-500" />
                <StatCard title="التأخيرات" value={stats.lateness} sub="مرة تأخير" icon={Clock} color="bg-purple-500" />
            </div>

            {/* تفاصيل التقييم */}
            {stats.eval ? (
                <div className="bg-white border rounded-[30px] p-8 shadow-sm">
                    <h4 className="font-black text-xl mb-6 flex items-center gap-2 text-gray-800">
                        <Award className="text-yellow-500"/> تفاصيل التقييم الشهري ({stats.eval.total_score}%)
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                        {[
                            {l: 'المظهر', v: stats.eval.score_appearance, m: 10},
                            {l: 'الحضور', v: stats.eval.score_attendance, m: 20},
                            {l: 'الجودة', v: stats.eval.score_quality, m: 10},
                            {l: 'العدوى', v: stats.eval.score_infection, m: 10},
                            {l: 'التدريب', v: stats.eval.score_training, m: 20},
                            {l: 'الملفات', v: stats.eval.score_records, m: 20},
                            {l: 'المهام', v: stats.eval.score_tasks, m: 10},
                        ].map((s, i) => (
                            <div key={i} className="bg-gray-50 rounded-2xl p-4 text-center">
                                <div className="text-2xl font-black text-gray-800">{s.v}</div>
                                <div className="text-[10px] text-gray-400 font-bold">من {s.m}</div>
                                <div className="text-xs font-bold mt-1 text-emerald-600">{s.l}</div>
                            </div>
                        ))}
                    </div>
                    {stats.eval.notes && (
                        <div className="mt-6 bg-yellow-50 p-4 rounded-xl text-sm text-yellow-800 border border-yellow-100">
                            <b>ملاحظات المقيم:</b> {stats.eval.notes}
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center p-10 bg-gray-50 rounded-3xl border border-dashed text-gray-400">
                    لا يوجد تقييم معتمد لهذا الشهر حتى الآن
                </div>
            )}
        </div>
    );
}