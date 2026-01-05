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
    month: string;
    employee?: Employee;
}

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];
const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// دالة تحديد نطاق السنة المالية (1 يوليو - 30 يونيو)
const getFiscalYearRange = () => {
    const now = new Date();
    let startYear = now.getFullYear();
    // إذا كنا قبل يوليو، فنحن نتبع السنة المالية التي بدأت العام الماضي
    if (now.getMonth() < 6) startYear -= 1;
    
    return {
        startDate: new Date(startYear, 6, 1), // 1 يوليو
        endDate: new Date(startYear + 1, 5, 30, 23, 59, 59), // 30 يونيو
        startYear
    };
};

const normalizeLeaveType = (type: string) => {
    const t = type?.trim() || '';
    if (t.includes('عارض')) return 'casual';
    if (t.includes('اعتياد')) return 'annual';
    if (t.includes('مرض')) return 'sick';
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

    // 1. حصر الإجازات التراكمي للسنة المالية
    const fiscalLeaves = useMemo(() => {
        const stats = {
            annual: { used: 0, balance: employee?.leave_annual_balance || 21, label: 'اعتيادي' },
            casual: { used: 0, balance: employee?.leave_casual_balance || 7, label: 'عارضة' }
        };

        // تصحيح الفلترة لتكون أكثر مرونة مع النصوص والتواريخ
        requests.forEach(req => {
            const reqStatus = req.status?.trim();
            const typeKey = normalizeLeaveType(req.type) as 'annual' | 'casual';
            
            // التأكد من أن الحالة "مقبول" وأن النوع صحيح
            if (reqStatus === 'مقبول' && stats[typeKey]) {
                const reqStart = new Date(req.start_date);
                
                // فحص ما إذا كانت الإجازة تقع ضمن السنة المالية الحالية
                if (reqStart >= startDate && reqStart <= endDate) {
                    const start = new Date(req.start_date);
                    const end = new Date(req.end_date);
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    const count = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                    stats[typeKey].used += count;
                }
            }
        });
        return stats;
    }, [requests, employee, startDate, endDate]);

    // 2. إحصائيات الحضور وبدل الراحة
    const attendanceStats = useMemo(() => {
        let totalHours = 0;
        let lateCount = 0;
        let holidayWorkDays = 0; 
        let restAllowanceDays = 0;
        
        const officialStart = employee?.start_time || "08:30";
        const [offH, offM] = officialStart.split(':').map(Number);
        const workDays = employee?.work_days || ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

        const monthlyAttendance = attendance.filter(a => a.date.startsWith(month));

        monthlyAttendance.forEach(att => {
            const times = att.times.match(/\d{1,2}:\d{2}/g) || [];
            if (times.length >= 2) {
                const hours = calcHours(times[0], times[times.length - 1]);
                totalHours += hours;
                if (hours > 9) restAllowanceDays++;

                const [h, m] = times[0].split(':').map(Number);
                if (h > offH || (h === offH && m > offM)) lateCount++;
            }

            const dayName = DAYS_AR[new Date(att.date).getDay()];
            if (!workDays.includes(dayName)) holidayWorkDays++;
        });

        return { 
            totalHours, 
            lateCount, 
            holidayWorkDays, 
            restAllowanceDays, 
            presentDays: monthlyAttendance.length 
        };
    }, [attendance, employee, month]);

    const chartData = [
        { name: 'حضور الشهر', value: attendanceStats.presentDays },
        { name: 'إجازات السنة', value: fiscalLeaves.annual.used + fiscalLeaves.casual.used },
        { name: 'بدل راحة', value: attendanceStats.restAllowanceDays },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-700 text-right" dir="rtl">
            
            {/* بطاقة السنة المالية الاحترافية */}
            <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-900 p-8 rounded-[40px] shadow-2xl relative overflow-hidden text-white border border-white/10">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                
                <div className="relative z-10">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
                        <div>
                            <h3 className="text-2xl font-black flex items-center gap-3">
                                <Briefcase className="w-8 h-8 text-indigo-300"/> 
                                حصاد السنة المالية
                            </h3>
                            <p className="text-indigo-200 text-sm font-bold mt-1">
                                الدورة الحالية: يوليو {startYear} - يونيو {startYear + 1}
                            </p>
                        </div>
                        <div className="bg-white/20 backdrop-blur-md px-5 py-2 rounded-2xl border border-white/20 text-xs font-black">
                            {attendanceStats.presentDays} يوم عمل هذا الشهر
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {Object.values(fiscalLeaves).map((stat, i) => (
                            <div key={i} className="bg-black/20 rounded-[30px] p-6 border border-white/5 hover:bg-black/30 transition-all">
                                <div className="flex justify-between items-end mb-4">
                                    <div>
                                        <p className="text-indigo-300 text-xs font-black mb-1 uppercase tracking-widest">{stat.label}</p>
                                        <h4 className="text-4xl font-black">{stat.balance - stat.used}</h4>
                                        <p className="text-[10px] opacity-50 mt-1">يوم متبقي في الرصيد</p>
                                    </div>
                                    <div className="text-left">
                                        <span className="text-xl font-bold text-red-400">-{stat.used}</span>
                                        <p className="text-[10px] opacity-50">تم استهلاكه</p>
                                    </div>
                                </div>
                                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-indigo-400 to-blue-400 transition-all duration-1000" 
                                        style={{ width: `${Math.min(100, (stat.used / stat.balance) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* الإحصائيات الرقمية */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'ساعات العمل', value: attendanceStats.totalHours.toFixed(0), icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'تأخيرات الشهر', value: attendanceStats.lateCount, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'استحقاق بدل راحة', value: attendanceStats.restAllowanceDays, icon: Coffee, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'عمل بالعطلات', value: attendanceStats.holidayWorkDays, icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' }
                ].map((item, i) => (
                    <div key={i} className="bg-white p-6 rounded-[35px] shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                        <div className={`w-12 h-12 ${item.bg} rounded-2xl flex items-center justify-center mb-4 ${item.color} group-hover:scale-110 transition-transform`}>
                            <item.icon className="w-6 h-6"/>
                        </div>
                        <div className="text-3xl font-black text-gray-800">{item.value}</div>
                        <div className="text-xs text-gray-400 font-black mt-1">{item.label}</div>
                    </div>
                ))}
            </div>

            {/* الرسم البياني */}
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                <h3 className="text-lg font-black text-gray-800 mb-8 flex items-center gap-2">
                    <Activity className="w-6 h-6 text-indigo-600"/> تحليل الأداء العام والمشاركة
                </h3>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold', fill: '#9ca3af'}} />
                            <YAxis hide />
                            <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)'}} />
                            <Bar dataKey="value" radius={[20, 20, 0, 0]} barSize={60}>
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
