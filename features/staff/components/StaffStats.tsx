import React, { useMemo } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Cell 
} from 'recharts';
import { 
    Clock, Calendar, AlertTriangle, Briefcase, Activity, FileText, Calculator, Star, Coffee 
} from 'lucide-react';
import { Employee, AttendanceRecord, LeaveRequest, Evaluation } from '../../../types';

interface Props {
    attendance: AttendanceRecord[];
    evals: Evaluation[];
    requests: LeaveRequest[];
    month: string; // الشهر المختار حالياً للعرض الشهري
    employee?: Employee;
}

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];
const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// دالة تحديد نطاق السنة المالية الحالية (1 يوليو - 30 يونيو)
const getFiscalYearRange = () => {
    const now = new Date();
    let startYear = now.getFullYear();
    if (now.getMonth() < 6) { // إذا كنا قبل شهر يوليو (0-5)
        startYear -= 1;
    }
    const startDate = `${startYear}-07-01`;
    const endDate = `${startYear + 1}-06-30`;
    return { startDate, endDate, startYear };
};

const normalizeLeaveType = (type: string) => {
    const t = type?.trim().toLowerCase() || '';
    if (t.match(/عارض/)) return 'casual';
    if (t.match(/اعتياد/)) return 'annual';
    if (t.match(/مرض/)) return 'sick';
    return 'other';
};

const calcHours = (t1: string, t2: string) => {
    if (!t1 || !t2) return 0;
    const [h1, m1] = t1.split(':').map(Number);
    const [h2, m2] = t2.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    return diff > 0 ? diff / 60 : 0;
};

export default function StaffStats({ attendance, evals, requests, month, employee }: Props) {
    const { startDate, endDate, startYear } = useMemo(() => getFiscalYearRange(), []);

    // 1. حصر الإجازات التراكمي (للسنة المالية كاملة)
    const fiscalLeaves = useMemo(() => {
        const stats = {
            annual: { used: 0, balance: employee?.leave_annual_balance || 21, label: 'اعتيادي' },
            casual: { used: 0, balance: employee?.leave_casual_balance || 7, label: 'عارضة' }
        };

        requests.filter(r => 
            r.status === 'مقبول' && 
            r.start_date >= startDate && 
            r.start_date <= endDate
        ).forEach(req => {
            const typeKey = normalizeLeaveType(req.type) as 'annual' | 'casual';
            if (stats[typeKey]) {
                const start = new Date(req.start_date);
                const end = new Date(req.end_date);
                const count = Math.floor(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                stats[typeKey].used += count;
            }
        });
        return stats;
    }, [requests, employee, startDate, endDate]);

    // 2. إحصائيات الحضور (شهرية + بدل الراحة)
    const attendanceStats = useMemo(() => {
        let totalHours = 0;
        let lateCount = 0;
        let holidayWorkDays = 0; 
        let restAllowanceDays = 0; // أيام تخطت 9 ساعات عمل
        
        const officialStart = employee?.start_time || "08:30";
        const [offH, offM] = officialStart.split(':').map(Number);
        const workDays = employee?.work_days || ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

        // تصفية الحضور للشهر المختار فقط
        attendance.filter(a => a.date.startsWith(month)).forEach(att => {
            const times = att.times.match(/\d{1,2}:\d{2}/g) || [];
            if (times.length >= 2) {
                const hours = calcHours(times[0], times[times.length - 1]);
                totalHours += hours;
                if (hours > 9) restAllowanceDays++; // استحقاق بدل راحة

                const [h, m] = times[0].split(':').map(Number);
                if (h > offH || (h === offH && m > offM)) lateCount++;
            }

            const dayName = DAYS_AR[new Date(att.date).getDay()];
            if (!workDays.includes(dayName)) holidayWorkDays++;
        });

        return { totalHours, lateCount, holidayWorkDays, restAllowanceDays, presentDays: attendance.length };
    }, [attendance, employee, month]);

    const chartData = [
        { name: 'حضور الشهر', value: attendanceStats.presentDays },
        { name: 'إجازات (سنة)', value: fiscalLeaves.annual.used + fiscalLeaves.casual.used },
        { name: 'بدل راحة', value: attendanceStats.restAllowanceDays },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-700 text-right" dir="rtl">
            
            {/* قسم أرصدة السنة المالية */}
            <div className="bg-gradient-to-l from-indigo-900 to-indigo-800 p-6 rounded-[35px] shadow-2xl relative overflow-hidden text-white">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <Calculator className="w-64 h-64 -ml-20 -mt-20 rotate-12"/>
                </div>
                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black flex items-center gap-2">
                            <Briefcase className="w-6 h-6 text-indigo-300"/> 
                            الأرصدة التراكمية ({startYear} - {startYear + 1})
                        </h3>
                        <span className="bg-indigo-700/50 px-4 py-1 rounded-full text-xs font-bold border border-indigo-500">سنة مالية</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Object.values(fiscalLeaves).map((stat, i) => (
                            <div key={i} className="bg-white/10 backdrop-blur-md rounded-3xl p-5 border border-white/10">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="font-bold">{stat.label}</span>
                                    <span className="text-2xl font-black">{stat.balance - stat.used} <small className="text-xs opacity-60">متبقي</small></span>
                                </div>
                                <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-indigo-400 transition-all duration-1000" 
                                        style={{ width: `${(stat.used / stat.balance) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between mt-3 text-[10px] font-bold opacity-80 uppercase">
                                    <span>مستهلك: {stat.used}</span>
                                    <span>الإجمالي: {stat.balance}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* الإحصائيات الشهرية التفصيلية */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'ساعات العمل', value: attendanceStats.totalHours.toFixed(0), icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'تأخيرات الشهر', value: attendanceStats.lateCount, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'بدل راحة استحقاق', value: attendanceStats.restAllowanceDays, icon: Coffee, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'عمل بالعطلات', value: attendanceStats.holidayWorkDays, icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' }
                ].map((item, i) => (
                    <div key={i} className="bg-white p-5 rounded-[30px] shadow-sm border border-gray-100 transition-transform hover:scale-105">
                        <div className={`w-12 h-12 ${item.bg} rounded-2xl flex items-center justify-center mb-3 ${item.color}`}>
                            <item.icon className="w-6 h-6"/>
                        </div>
                        <div className="text-3xl font-black text-gray-800">{item.value}</div>
                        <div className="text-xs text-gray-500 font-bold mt-1">{item.label}</div>
                    </div>
                ))}
            </div>

            {/* التحليل البياني */}
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                <h3 className="text-lg font-black text-gray-800 mb-8 flex items-center gap-2">
                    <Activity className="w-6 h-6 text-indigo-600"/> تحليل الأداء العام
                </h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} barGap={20}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} />
                            <YAxis hide />
                            <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.05)'}} />
                            <Bar dataKey="value" radius={[15, 15, 0, 0]} barSize={50}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
