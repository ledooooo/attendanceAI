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

const getFiscalYearRange = () => {
    const now = new Date();
    let startYear = now.getFullYear();
    if (now.getMonth() < 6) startYear -= 1;
    const startDate = new Date(startYear, 6, 1, 0, 0, 0);
    const endDate = new Date(startYear + 1, 5, 30, 23, 59, 59);
    return { startDate, endDate, startYear };
};

const parseDate = (d: any) => {
    if (!d) return null;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
};

export default function StaffStats({ attendance, evals, requests, month, employee }: Props) {
    const { startDate, endDate, startYear } = useMemo(() => getFiscalYearRange(), []);

    // الحصر الشامل للأرصدة
    const stats = useMemo(() => {
        const data = {
            annual: { used: 0, balance: employee?.leave_annual_balance || 21 },
            casual: { used: 0, balance: employee?.leave_casual_balance || 7 },
            restRequested: 0,
            restEarned: 0,
            lateCount: 0,
            monthlyHours: 0,
            presentDays: 0
        };

        // 1. حساب الإجازات (السنة المالية)
        requests.forEach(req => {
            const isApproved = req.status?.includes('مقبول');
            const s = parseDate(req.start_date);
            const e = parseDate(req.end_date);
            
            if (isApproved && s && s >= startDate && s <= endDate) {
                const diff = Math.ceil(Math.abs((e?.getTime() || s.getTime()) - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                if (req.type?.includes('اعتياد')) data.annual.used += diff;
                else if (req.type?.includes('عارض')) data.casual.used += diff;
                else if (req.type?.includes('راحة')) data.restRequested += diff;
            }
        });

        // 2. حساب الحضور (الشهر الحالي)
        attendance.filter(a => a.date.startsWith(month)).forEach(att => {
            data.presentDays++;
            const times = att.times.match(/\d{1,2}:\d{2}/g) || [];
            if (times.length >= 2) {
                const [h1, m1] = times[0].split(':').map(Number);
                const [h2, m2] = times[times.length - 1].split(':').map(Number);
                const hours = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
                
                if (hours > 0) data.monthlyHours += hours;
                if (hours > 9) data.restEarned += 1; // استحقاق بدل راحة
                if (h1 > 8 || (h1 === 8 && m1 > 30)) data.lateCount++;
            }
        });

        return data;
    }, [requests, attendance, employee, month, startDate, endDate]);

    const absenceDays = Math.max(0, 26 - stats.presentDays - requests.filter(r => r.status?.includes('مقبول') && r.start_date.startsWith(month)).length);

    return (
        <div className="space-y-6 text-right" dir="rtl">
            {/* كارت الأرصدة التراكمية */}
            <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl">
                <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                    <Calculator className="text-indigo-400"/> تقرير السنة المالية {startYear} / {startYear + 1}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                        <p className="text-emerald-400 text-xs font-bold mb-1">إجازة اعتيادية</p>
                        <span className="text-3xl font-black">{stats.annual.balance - stats.annual.used}</span>
                        <div className="flex justify-between text-[10px] mt-2 opacity-60">
                            <span>المستهلك: {stats.annual.used}</span>
                            <span>الإجمالي: {stats.annual.balance}</span>
                        </div>
                    </div>
                    <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                        <p className="text-orange-400 text-xs font-bold mb-1">إجازة عارضة</p>
                        <span className="text-3xl font-black">{stats.casual.balance - stats.casual.used}</span>
                        <div className="flex justify-between text-[10px] mt-2 opacity-60">
                            <span>المستهلك: {stats.casual.used}</span>
                            <span>الإجمالي: {stats.casual.balance}</span>
                        </div>
                    </div>
                    <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                        <p className="text-blue-400 text-xs font-bold mb-1">رصيد بدل الراحات</p>
                        <span className="text-3xl font-black">{stats.restEarned - stats.restRequested}</span>
                        <div className="flex justify-between text-[10px] mt-2 opacity-60">
                            <span>المستحق: {stats.restEarned}</span>
                            <span>المطلوب: {stats.restRequested}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* الإحصائيات الشهرية */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                    <Clock className="w-5 h-5 text-blue-500 mb-2"/>
                    <div className="text-xl font-black">{stats.monthlyHours.toFixed(1)}</div>
                    <p className="text-[10px] text-gray-400 font-bold">ساعة عمل / شهر</p>
                    <p className="text-[9px] text-gray-300">أسبوعياً: {(stats.monthlyHours/4).toFixed(1)}</p>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                    <AlertTriangle className="w-5 h-5 text-red-500 mb-2"/>
                    <div className="text-xl font-black">{stats.lateCount}</div>
                    <p className="text-[10px] text-gray-400 font-bold">تأخيرات الشهر</p>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                    <UserX className="w-5 h-5 text-purple-500 mb-2"/>
                    <div className="text-xl font-black">{absenceDays}</div>
                    <p className="text-[10px] text-gray-400 font-bold">أيام الغياب</p>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                    <Coffee className="w-5 h-5 text-emerald-500 mb-2"/>
                    <div className="text-xl font-black">{stats.restEarned}</div>
                    <p className="text-[10px] text-gray-400 font-bold">استحقاق بدل راحة</p>
                </div>
            </div>
        </div>
    );
}
