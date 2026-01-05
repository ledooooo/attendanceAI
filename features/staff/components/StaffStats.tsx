import React, { useMemo } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Cell 
} from 'recharts';
import { 
    Clock, Calendar, AlertTriangle, Briefcase, Activity, Calculator, Coffee, UserX
} from 'lucide-react';
import { Employee, AttendanceRecord, LeaveRequest, Evaluation } from '../../../types';

interface Props {
    attendance: AttendanceRecord[];
    evals: Evaluation[];
    requests: LeaveRequest[];
    month: string;
    employee?: Employee;
}

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];
const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// دالة تحديد نطاق السنة المالية (1 يوليو - 30 يونيو)
const getFiscalYearRange = () => {
    const now = new Date();
    let startYear = now.getFullYear();
    if (now.getMonth() < 6) startYear -= 1;
    
    // ضبط الوقت ليكون في بداية اليوم تماماً لتجنب إزاحة التوقيت
    const startDate = new Date(startYear, 6, 1, 0, 0, 0);
    const endDate = new Date(startYear + 1, 5, 30, 23, 59, 59);
    return { startDate, endDate, startYear };
};

const normalizeLeaveType = (type: string) => {
    const t = type?.trim() || '';
    if (t.includes('عارض')) return 'casual';
    if (t.includes('اعتياد')) return 'annual';
    if (t.includes('بدل راحة') || t.includes('راحة')) return 'rest';
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

    // 1. حصر الإجازات والأرصدة (سنوي وتراكمي)
    const fiscalLeaves = useMemo(() => {
        const stats = {
            annual: { used: 0, balance: employee?.leave_annual_balance || 21, label: 'اعتيادي' },
            casual: { used: 0, balance: employee?.leave_casual_balance || 7, label: 'عارضة' },
            rest: { used: 0, requested: 0, label: 'بدل راحة' }
        };

        requests.forEach(req => {
            const reqStatus = req.status?.trim();
            const typeKey = normalizeLeaveType(req.type);
            
            if (reqStatus === 'مقبول') {
                const reqStart = new Date(req.start_date);
                if (reqStart >= startDate && reqStart <= endDate) {
                    const s = new Date(req.start_date);
                    const e = new Date(req.end_date);
                    const count = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    
                    if (typeKey === 'annual' || typeKey === 'casual') {
                        stats[typeKey].used += count;
                    } else if (typeKey === 'rest') {
                        stats.rest.requested += count;
                    }
                }
            }
        });
        return stats;
    }, [requests, employee, startDate, endDate]);

    // 2. إحصائيات الحضور والغياب
    const attendanceStats = useMemo(() => {
        let totalMonthlyHours = 0;
        let lateCount = 0;
        let restEarnedDays = 0; 
        let presentDays = 0;

        const officialStart = employee?.start_time || "08:30";
        const [offH, offM] = officialStart.split(':').map(Number);

        const monthlyRecords = attendance.filter(a => a.date.startsWith(month));
        
        monthlyRecords.forEach(att => {
            const times = att.times.match(/\d{1,2}:\d{2}/g) || [];
            if (times.length >= 2) {
                const hours = calcHours(times[0], times[times.length - 1]);
                totalMonthlyHours += hours;
                if (hours > 9) restEarnedDays++; 

                const [h, m] = times[0].split(':').map(Number);
                if (h > offH || (h === offH && m > offM)) lateCount++;
                presentDays++;
            }
        });

        const monthlyLeaves = requests.filter(r => r.status === 'مقبول' && r.start_date.startsWith(month)).length;
        const absenceDays = Math.max(0, 26 - presentDays - monthlyLeaves);

        return { 
            totalMonthlyHours, 
            totalWeeklyHours: totalMonthlyHours / 4, 
            lateCount, 
            restEarnedDays, 
            absenceDays,
            presentDays 
        };
    }, [attendance, employee, month, requests]);

    const chartData = [
        { name: 'حضور الشهر', value: attendanceStats.presentDays },
        { name: 'إجازات السنة', value: fiscalLeaves.annual.used + fiscalLeaves.casual.used },
        { name: 'بدل راحة', value: attendanceStats.restEarnedDays },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-700 text-right" dir="rtl">
            
            {/* بطاقة الأرصدة التراكمية (السنة المالية) */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-900 p-8 rounded-[40px] shadow-2xl relative overflow-hidden text-white border border-white/10">
                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-2xl font-black flex items-center gap-3">
                            <Calculator className="w-8 h-8 text-indigo-400"/> تقرير السنة المالية {startYear} / {startYear + 1}
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white/10 p-6 rounded-[30px] border border-white/10">
                            <p className="text-emerald-400 text-xs font-black mb-2 uppercase">إجازة اعتيادية</p>
                            <div className="flex justify-between items-end">
                                <div>
                                    <span className="text-4xl font-black">{fiscalLeaves.annual.balance - fiscalLeaves.annual.used}</span>
                                    <p className="text-[10px] opacity-60">يوم متبقي</p>
                                </div>
                                <div className="text-left text-xs">
                                    <p>الإجمالي: {fiscalLeaves.annual.balance}</p>
                                    <p className="text-red-400">المستهلك: {fiscalLeaves.annual.used}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/10 p-6 rounded-[30px] border border-white/10">
                            <p className="text-orange-400 text-xs font-black mb-2 uppercase">إجازة عارضة</p>
                            <div className="flex justify-between items-end">
                                <div>
                                    <span className="text-4xl font-black">{fiscalLeaves.casual.balance - fiscalLeaves.casual.used}</span>
                                    <p className="text-[10px] opacity-60">يوم متبقي</p>
                                </div>
                                <div className="text-left text-xs">
                                    <p>الإجمالي: {fiscalLeaves.casual.balance}</p>
                                    <p className="text-red-400">المستهلك: {fiscalLeaves.casual.used}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/10 p-6 rounded-[30px] border border-white/10">
                            <p className="text-blue-400 text-xs font-black mb-2 uppercase">بدلات الراحة</p>
                            <div className="flex justify-between items-end">
                                <div>
                                    <span className="text-4xl font-black">{attendanceStats.restEarnedDays - fiscalLeaves.rest.requested}</span>
                                    <p className="text-[10px] opacity-60">رصيد متاح</p>
                                </div>
                                <div className="text-left text-xs">
                                    <p className="text-emerald-400">المستحق: {attendanceStats.restEarnedDays}</p>
                                    <p className="text-red-400">المطلوب: {fiscalLeaves.rest.requested}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* إحصائيات الشهر التفصيلية */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                    <Clock className="w-6 h-6 text-blue-500 mb-2"/>
                    <div className="text-2xl font-black">{attendanceStats.totalMonthlyHours.toFixed(1)}</div>
                    <p className="text-xs text-gray-400 font-bold">ساعة عمل / شهر</p>
                    <p className="text-[10px] text-gray-300">أسبوعياً: {attendanceStats.totalWeeklyHours.toFixed(1)}</p>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                    <AlertTriangle className="w-6 h-6 text-red-500 mb-2"/>
                    <div className="text-2xl font-black">{attendanceStats.lateCount}</div>
                    <p className="text-xs text-gray-400 font-bold">تأخيرات الشهر</p>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                    <UserX className="w-6 h-6 text-purple-500 mb-2"/>
                    <div className="text-2xl font-black">{attendanceStats.absenceDays}</div>
                    <p className="text-xs text-gray-400 font-bold">أيام الغياب</p>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                    <Coffee className="w-6 h-6 text-emerald-500 mb-2"/>
                    <div className="text-2xl font-black">{attendanceStats.restEarnedDays}</div>
                    <p className="text-xs text-gray-400 font-bold">أيام تستحق بدل راحة</p>
                </div>
            </div>

            {/* التحليل البياني */}
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 h-80">
                <h3 className="text-lg font-black text-gray-800 mb-8">تحليل الأداء</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} />
                        <YAxis hide />
                        <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.05)'}} />
                        <Bar dataKey="value" radius={[15, 15, 0, 0]} barSize={50}>
                            {chartData.map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
