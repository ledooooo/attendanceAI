import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { Clock, Calendar, AlertTriangle, Briefcase, Calculator, Coffee, UserX } from 'lucide-react';
import { Employee, AttendanceRecord, LeaveRequest, Evaluation } from '../../../types';

interface Props {
    attendance: AttendanceRecord[];
    evals: Evaluation[];
    requests: LeaveRequest[];
    month: string;
    employee?: Employee;
}

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#3B82F6'];

export default function StaffStats({ attendance, evals, requests, month, employee }: Props) {
    
    const stats = useMemo(() => {
        const fiscalStart = new Date(new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0), 6, 1);
        const fiscalEnd = new Date(fiscalStart.getFullYear() + 1, 5, 30, 23, 59, 59);

        const data = {
            annual: { used: 0, balance: employee?.leave_annual_balance || 21 },
            casual: { used: 0, balance: employee?.leave_casual_balance || 7 },
            rest: { earned: 0, requested: 0 },
            monthly: { hours: 0, late: 0, present: 0 }
        };

        // 1. حساب الإجازات (السنة المالية)
        requests.forEach(req => {
            const isApproved = req.status?.trim() === 'مقبول';
            const s = new Date(req.start_date);
            const e = new Date(req.end_date);
            
            if (isApproved && s >= fiscalStart && s <= fiscalEnd) {
                const diff = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                if (req.type?.includes('اعتياد')) data.annual.used += diff;
                else if (req.type?.includes('عارض')) data.casual.used += diff;
                else if (req.type?.includes('راحة')) data.rest.requested += diff;
            }
        });

        // 2. حساب الحضور (الشهر الحالي)
        attendance.filter(a => a.date.startsWith(month)).forEach(att => {
            data.monthly.present++;
            const times = att.times.match(/\d{1,2}:\d{2}/g) || [];
            if (times.length >= 2) {
                const [h1, m1] = times[0].split(':').map(Number);
                const [h2, m2] = times[times.length - 1].split(':').map(Number);
                const hrs = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
                data.monthly.hours += hrs;
                if (hrs > 9) data.rest.earned++;
                if (h1 > 8 || (h1 === 8 && m1 > 30)) data.monthly.late++;
            }
        });

        return data;
    }, [requests, attendance, employee, month]);

    const absenceDays = Math.max(0, 26 - stats.monthly.present - requests.filter(r => r.status === 'مقبول' && r.start_date.startsWith(month)).length);

    return (
        <div className="space-y-6 text-right" dir="rtl">
            <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-xl">
                <h3 className="text-xl font-black mb-6 flex items-center gap-2"><Calculator className="text-indigo-400"/> الأرصدة السنوية (يوليو - يونيو)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                        <p className="text-emerald-400 text-xs font-bold mb-1">إجازة اعتيادية</p>
                        <span className="text-3xl font-black">{stats.annual.balance - stats.annual.used}</span>
                        <p className="text-[10px] opacity-50">متبقي من {stats.annual.balance} (مستهلك: {stats.annual.used})</p>
                    </div>
                    <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                        <p className="text-orange-400 text-xs font-bold mb-1">إجازة عارضة</p>
                        <span className="text-3xl font-black">{stats.casual.balance - stats.casual.used}</span>
                        <p className="text-[10px] opacity-60">متبقي من {stats.casual.balance} (مستهلك: {stats.casual.used})</p>
                    </div>
                    <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                        <p className="text-blue-400 text-xs font-bold mb-1">بدل الراحات</p>
                        <span className="text-3xl font-black">{stats.rest.earned - stats.rest.requested}</span>
                        <p className="text-[10px] opacity-60">مستحق: {stats.rest.earned} | مطلوب: {stats.rest.requested}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl border shadow-sm">
                    <Clock className="text-blue-500 mb-2"/>
                    <div className="text-xl font-black">{stats.monthly.hours.toFixed(1)}</div>
                    <p className="text-[10px] text-gray-400 font-bold">ساعة عمل / شهر</p>
                </div>
                <div className="bg-white p-5 rounded-3xl border shadow-sm">
                    <AlertTriangle className="text-red-500 mb-2"/>
                    <div className="text-xl font-black">{stats.monthly.late}</div>
                    <p className="text-[10px] text-gray-400 font-bold">تأخيرات الشهر</p>
                </div>
                <div className="bg-white p-5 rounded-3xl border shadow-sm">
                    <UserX className="text-purple-500 mb-2"/>
                    <div className="text-xl font-black">{absenceDays}</div>
                    <p className="text-[10px] text-gray-400 font-bold">أيام غياب</p>
                </div>
                <div className="bg-white p-5 rounded-3xl border shadow-sm">
                    <Coffee className="text-emerald-500 mb-2"/>
                    <div className="text-xl font-black">{stats.rest.earned}</div>
                    <p className="text-[10px] text-gray-400 font-bold">استحقاق راحة</p>
                </div>
            </div>
        </div>
    );
}
