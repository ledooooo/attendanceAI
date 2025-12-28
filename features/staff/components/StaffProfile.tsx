import React from 'react';
import { Employee } from '../../../types';
import { User, Hash, ShieldCheck, Briefcase, CalendarDays, Phone, Mail, Building, Activity, Star } from 'lucide-react';

const ProfileItem = ({ label, value, icon: Icon, fullWidth = false }: any) => (
    <div className={`p-4 bg-gray-50 rounded-2xl border flex items-center gap-4 group hover:bg-white hover:border-emerald-200 transition-all ${fullWidth ? 'md:col-span-2 lg:col-span-3' : ''}`}>
        <div className="p-3 bg-white rounded-xl text-emerald-600 shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
            {Icon && <Icon className="w-5 h-5" />}
        </div>
        <div className="flex-1">
            <label className="text-[10px] text-gray-400 font-black block mb-1 uppercase tracking-widest">{label}</label>
            <p className="font-bold text-gray-800 break-words">{value || <span className="text-gray-300 text-xs">غير مسجل</span>}</p>
        </div>
    </div>
);

export default function StaffProfile({ employee }: { employee: Employee }) {
    return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800 border-b pb-4">
                <User className="text-emerald-600 w-7 h-7" /> الملف الوظيفي الشامل
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* البيانات الأساسية */}
                <ProfileItem label="الاسم الرباعي" value={employee.name} icon={User} fullWidth />
                
                <ProfileItem label="الرقم القومي" value={employee.national_id} icon={ShieldCheck} />
                <ProfileItem label="الكود الوظيفي" value={employee.employee_id} icon={Hash} />
                <ProfileItem label="التخصص / المسمى الوظيفي" value={employee.specialty} icon={Briefcase} />
                
                <ProfileItem label="تاريخ التعيين" value={employee.join_date} icon={CalendarDays} />
                <ProfileItem label="حالة العمل" value={employee.status} icon={Activity} />
                <ProfileItem label="المركز الطبي التابع له" value={employee.center_id} icon={Building} />

                {/* بيانات الاتصال */}
                <ProfileItem label="رقم الهاتف" value={employee.phone} icon={Phone} />
                <ProfileItem label="البريد الإلكتروني" value={employee.email} icon={Mail} />
                
                {/* الأرصدة (إذا كانت متوفرة في قاعدة البيانات) */}
                <ProfileItem label="رصيد الإجازات الاعتيادية" value={`${employee.remaining_annual || 0} يوم`} icon={Star} />
                <ProfileItem label="رصيد الإجازات العارضة" value={`${employee.remaining_casual || 0} يوم`} icon={Star} />
            </div>
        </div>
    );
}