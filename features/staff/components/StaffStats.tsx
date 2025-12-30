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
    employee?: Employee; // جعلناه اختياري ليعمل مع صفحة الموظف والمدير
}

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];
const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// دالة توحيد مسميات الإجازات (الحصر الذكي)
const normalizeLeaveType = (type: string) => {
    const t = type.trim().toLowerCase();
    if (t.match(/عارض/)) return 'casual';      // عارضة، اجازة عارضة، عارضه
    if (t.match(/اعتياد/)) return 'annual';    // اعتيادي، اجازة اعتيادية
    if (t.match(/مرض/)) return 'sick';         // مرضي، اجازة مرضية
    if (t.match(/صباح/)) return 'morning';     // اذن صباحي
    if (t.match(/مسائ/)) return 'evening';     // اذن مسائي
    if (t.match(/وضع/)) return 'maternity';
    return 'other';
};

// دالة مساعدة لحساب فرق الساعات
const calcHours = (t1: string, t2: string) => {
    if (!t1 || !t2) return 0;
    const [h1, m1] = t1.split(':').map(Number);
    const [h2, m2] = t2.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    return diff > 0 ? diff / 60 : 0;
};

export default function StaffStats({ attendance, evals, requests, month, employee }: Props) {
    
    // 1. حساب حصر الإجازات والأرصدة
    const leavesStats = useMemo(() => {
        const stats = {
            annual: { used: 0, balance: employee?.leave_annual_balance || 21, label: 'اعتيادي' },
            casual: { used: 0, balance: employee?.leave_casual_balance || 7, label: 'عارضة' },
            sick: { used: 0, balance: employee?.leave_sick_balance || 0, label: 'مرضي' },
            morning: { used: 0, balance: employee?.leave_morning_perm_balance || 0, label: 'إذن صباحي' },
            evening: { used: 0, balance: employee?.leave_evening_perm_balance || 0, label: 'إذن مسائي' },
            other: { used: 0, balance: 0, label: 'أخرى' }
        };

        // تصفية الطلبات المقبولة فقط وحسابها
        requests.filter(r => r.status === 'مقبول').forEach(req => {
            const typeKey = normalizeLeaveType(req.type) as keyof typeof stats;
            
            // حساب عدد الأيام (أو مرات الإذن)
            let count = 1;
            if (req.start_date && req.end_date && req.start_date !== req.end_date) {
                const start = new Date(req.start_date);
                const end = new Date(req.end_date);
                count = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            }

            if (stats[typeKey]) {
                stats[typeKey].used += count;
            }
        });

        return stats;
    }, [requests, employee]);

    // 2. حساب إحصائيات الحضور التفصيلية
    const attendanceStats = useMemo(() => {
        let totalHours = 0;
        let lateCount = 0;
        let overtimeDays = 0; // العمل في العطلات
        let presentDays = 0;
        
        // أيام العمل الرسمية للموظف
        const workDays = employee?.work_days && employee.work_days.length > 0 
            ? employee.work_days 
            : ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

        attendance.forEach(att => {
            // استخراج الوقت
            const times = att.times.match(/\d{1,2}:\d{2}/g) || [];
            if (times.length >= 2) {
                const hours = calcHours(times[0], times[times.length - 1]);
                totalHours += hours;
                
                // حساب التأخير (إذا كان الدخول بعد 8:30) - مثال للقاعدة
                const [h, m] = times[0].split(':').map(Number);
                if (h > 8 || (h === 8 && m > 30)) lateCount++;
            }

            // التحقق من العمل في العطلات
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
    const chartData = [
        { name: 'حضور', value: attendanceStats.presentDays },
        { name: 'إجازات', value: requests.filter(r => r.status === 'مقبول').length },
        { name: 'غياب', value: Math.max(0, 26 - attendanceStats.presentDays - requests.filter(r => r.status === 'مقبول').length) },
    ];

    const currentEval = evals.find(e => e.month === month);

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
            
            {/* قسم 1: بطاقات الأرصدة (الحصر الشامل) */}
            <div className="bg-white p-6 rounded-[30px] shadow-sm border border-gray-100">
                <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-purple-600"/> حصر أرصدة الإجازات والأذونات
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(leavesStats).map(([key, stat]) => (
                        key !== 'other' && (
                            <div key={key} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 relative overflow-hidden">
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
                                        <div className="text-[10px] text-gray-400 font-bold">المتبقي</div>
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
                                {/* شريط التقدم */}
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-200">
                                    <div 
                                        className={`h-full ${stat.used > stat.balance ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                        style={{ width: `${Math.min(100, (stat.used / (stat.balance || 1)) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        )
                    ))}
                </div>
            </div>

            {/* قسم 2: إحصائيات الحضور الرقمية */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 text-center">
                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2 text-blue-600">
                        <Clock className="w-5 h-5"/>
                    </div>
                    <div className="text-2xl font-black text-gray-800">{attendanceStats.totalHours.toFixed(0)}</div>
                    <div className="text-xs text-gray-500 font-bold">ساعات العمل</div>
                </div>
                
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 text-center">
                    <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-2 text-red-600">
                        <AlertTriangle className="w-5 h-5"/>
                    </div>
                    <div className="text-2xl font-black text-gray-800">{attendanceStats.lateCount}</div>
                    <div className="text-xs text-gray-500 font-bold">مرات التأخير</div>
                </div>

                <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 text-center">
                    <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-2 text-purple-600">
                        <Calendar className="w-5 h-5"/>
                    </div>
                    <div className="text-2xl font-black text-gray-800">{attendanceStats.overtimeDays}</div>
                    <div className="text-xs text-gray-500 font-bold">عمل بالعطلات</div>
                </div>

                <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 text-center">
                    <div className="w-10 h-10 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-2 text-yellow-600">
                        <FileText className="w-5 h-5"/>
                    </div>
                    <div className="text-2xl font-black text-gray-800">{currentEval?.total_score || '-'}%</div>
                    <div className="text-xs text-gray-500 font-bold">تقييم الشهر</div>
                </div>
            </div>

            {/* قسم 3: الرسم البياني */}
            <div className="bg-white p-6 rounded-[30px] shadow-sm border border-gray-100 h-80">
                <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-600"/> تحليل النشاط الشهري
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12, fontWeight: 'bold'}} />
                        <RechartsTooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            cursor={{fill: '#f3f4f6'}}
                        />
                        <Bar dataKey="value" fill="#8884d8" radius={[0, 10, 10, 0]} barSize={30}>
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
