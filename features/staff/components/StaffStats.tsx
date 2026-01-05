import React, { useMemo } from 'react';
import { 
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
    BarChart, Bar, XAxis, YAxis, CartesianGrid 
} from 'recharts';
import { 
    Clock, Calendar, CheckCircle2, XCircle, AlertTriangle, 
    Briefcase, Activity, FileText, Calculator 
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

// دالة توحيد مسميات الإجازات (الحصر الذكي)
const normalizeLeaveType = (type: string) => {
    const t = type?.trim().toLowerCase() || '';
    if (t.match(/عارض/)) return 'casual';
    if (t.match(/اعتياد/)) return 'annual';
    if (t.match(/مرض/)) return 'sick';
    if (t.match(/صباح/)) return 'morning';
    if (t.match(/مسائ/)) return 'evening';
    if (t.match(/وضع/)) return 'maternity';
    return 'other';
};

// دالة مساعدة لحساب فرق الساعات بدقة
const calcHours = (t1: string, t2: string) => {
    if (!t1 || !t2) return 0;
    const [h1, m1] = t1.split(':').map(Number);
    const [h2, m2] = t2.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    return diff > 0 ? diff / 60 : 0;
};

export default function StaffStats({ attendance, evals, requests, month, employee }: Props) {
    
    // 1. حساب حصر الإجازات والأرصدة مع معالجة إزاحة التاريخ
    const leavesStats = useMemo(() => {
        const stats = {
            annual: { used: 0, balance: employee?.leave_annual_balance || 21, label: 'اعتيادي' },
            casual: { used: 0, balance: employee?.leave_casual_balance || 7, label: 'عارضة' },
            sick: { used: 0, balance: employee?.leave_sick_balance || 0, label: 'مرضي' },
            morning: { used: 0, balance: employee?.leave_morning_perm_balance || 0, label: 'إذن صباحي' },
            evening: { used: 0, balance: employee?.leave_evening_perm_balance || 0, label: 'إذن مسائي' },
            other: { used: 0, balance: 0, label: 'أخرى' }
        };

        requests.filter(r => r.status === 'مقبول').forEach(req => {
            const typeKey = normalizeLeaveType(req.type) as keyof typeof stats;
            
            let count = 1;
            if (req.start_date && req.end_date) {
                const start = new Date(req.start_date);
                const end = new Date(req.end_date);
                
                // تصحيح إزاحة المنطقة الزمنية لضمان حساب الأيام بشكل صحيح
                const diffTime = Math.abs(end.getTime() - start.getTime());
                count = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
            }

            if (stats[typeKey]) {
                stats[typeKey].used += count;
            }
        });

        return stats;
    }, [requests, employee]);

    // 2. حساب إحصائيات الحضور (ربطها بموعد حضور الموظف الفعلي)
    const attendanceStats = useMemo(() => {
        let totalHours = 0;
        let lateCount = 0;
        let overtimeDays = 0; 
        let presentDays = 0;
        
        // جلب وقت الحضور الرسمي من بيانات الموظف (الافتراضي 08:30)
        const officialStartTime = employee?.start_time || "08:30";
        const [offH, offM] = officialStartTime.split(':').map(Number);

        const workDays = employee?.work_days && employee.work_days.length > 0 
            ? employee.work_days 
            : ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

        attendance.forEach(att => {
            const times = att.times.match(/\d{1,2}:\d{2}/g) || [];
            if (times.length >= 2) {
                const hours = calcHours(times[0], times[times.length - 1]);
                totalHours += hours;
                
                // حساب التأخير بناءً على وقت الموظف الخاص
                const [h, m] = times[0].split(':').map(Number);
                if (h > offH || (h === offH && m > offM)) lateCount++;
            }

            const dateObj = new Date(att.date);
            const dayName = DAYS_AR[dateObj.getDay()];
            if (!workDays.includes(dayName)) {
                overtimeDays++;
            }

            presentDays++;
        });

        return { totalHours, lateCount, overtimeDays, presentDays };
    }, [attendance, employee]);

    // تجهيز بيانات الرسم البياني
    const chartData = useMemo(() => [
        { name: 'حضور فعلي', value: attendanceStats.presentDays },
        { name: 'أيام إجازة', value: Object.values(leavesStats).reduce((acc, curr) => acc + (curr.label !== 'أخرى' ? curr.used : 0), 0) },
        { name: 'غياب/غير مسجل', value: Math.max(0, 30 - attendanceStats.presentDays - (leavesStats.annual.used + leavesStats.casual.used)) },
    ], [attendanceStats, leavesStats]);

    const currentEval = evals.find(e => e.month === month);

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500 text-right" dir="rtl">
            
            {/* بطاقات الأرصدة */}
            <div className="bg-white p-6 rounded-[30px] shadow-sm border border-gray-100">
                <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-purple-600"/> حصر أرصدة الإجازات المتبقية
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(leavesStats).map(([key, stat]) => (
                        key !== 'other' && (
                            <div key={key} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 relative overflow-hidden group hover:bg-white transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-sm font-bold text-gray-500">{stat.label}</span>
                                    {key === 'annual' && <Briefcase className="w-4 h-4 text-emerald-500"/>}
                                    {key === 'casual' && <Activity className="w-4 h-4 text-orange-500"/>}
                                    {key === 'sick' && <AlertTriangle className="w-4 h-4 text-red-500"/>}
                                    {(key === 'morning' || key === 'evening') && <Clock className="w-4 h-4 text-blue-500"/>}
                                </div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <div className="text-2xl font-black text-gray-800">
                                            {Math.max(0, stat.balance - stat.used)}
                                        </div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">المتبقي</div>
                                    </div>
                                    <div className="text-left">
                                        <div className="text-sm font-bold text-red-500">-{stat.used}</div>
                                        <div className="text-[10px] text-gray-400">مستهلك</div>
                                    </div>
                                    <div className="text-left border-r pr-3 mr-3 border-gray-200">
                                        <div className="text-sm font-bold text-emerald-600">{stat.balance}</div>
                                        <div className="text-[10px] text-gray-400">الرصيد</div>
                                    </div>
                                </div>
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-100">
                                    <div 
                                        className={`h-full transition-all duration-1000 ${stat.used > stat.balance ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                        style={{ width: `${Math.min(100, (stat.used / (stat.balance || 1)) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        )
                    ))}
                </div>
            </div>

            {/* الإحصائيات الرقمية */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'ساعات العمل', value: attendanceStats.totalHours.toFixed(0), icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'مرات التأخير', value: attendanceStats.lateCount, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'عمل بالعطلات', value: attendanceStats.overtimeDays, icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
                    { label: 'تقييم الشهر', value: currentEval?.total_score ? `${currentEval.total_score}%` : '-', icon: FileText, color: 'text-yellow-600', bg: 'bg-yellow-50' }
                ].map((item, i) => (
                    <div key={i} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 text-center">
                        <div className={`w-10 h-10 ${item.bg} rounded-full flex items-center justify-center mx-auto mb-2 ${item.color}`}>
                            <item.icon className="w-5 h-5"/>
                        </div>
                        <div className="text-2xl font-black text-gray-800">{item.value}</div>
                        <div className="text-xs text-gray-500 font-bold">{item.label}</div>
                    </div>
                ))}
            </div>

            {/* الرسم البياني */}
            <div className="bg-white p-6 rounded-[30px] shadow-sm border border-gray-100 h-80">
                <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-600"/> تحليل النشاط الشهري (30 يوم)
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12, fontWeight: 'bold', fill: '#6b7280'}} />
                        <RechartsTooltip 
                            contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', textAlign: 'right' }}
                            cursor={{fill: '#f9fafb'}}
                        />
                        <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={35}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
