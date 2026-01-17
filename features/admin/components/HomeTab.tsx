import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { 
  Users, Clock, AlertTriangle, Calendar, 
  Activity, UserPlus, Search 
} from 'lucide-react';

export default function HomeTab({ employees, setActiveTab }: { employees: Employee[], setActiveTab: (tab: string) => void }) {
  const [stats, setStats] = useState({
    presentToday: 0,
    ovrNew: 0,
    leavesPending: 0
  });

  useEffect(() => {
    const fetchQuickStats = async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // 1. عدد الحضور اليوم
      const { count: attendanceCount } = await supabase
        .from('attendance') // تأكد من اسم الجدول الصحيح لديك (سواء attendance أو attendance_records)
        .select('*', { count: 'exact', head: true })
        .eq('date', today);

      // 2. OVR جديد
      const { count: ovrCount } = await supabase
        .from('ovr_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new');

      // 3. إجازات معلقة
      const { count: leavesCount } = await supabase
        .from('leave_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'معلق');

      setStats({
        presentToday: attendanceCount || 0,
        ovrNew: ovrCount || 0,
        leavesPending: leavesCount || 0
      });
    };

    fetchQuickStats();
  }, []);

  const cards = [
    { title: 'إجمالي الموظفين', value: employees.length, icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50', tab: 'doctors' },
    { title: 'حضور اليوم', value: stats.presentToday, icon: Clock, color: 'text-emerald-600', bgColor: 'bg-emerald-50', tab: 'attendance' },
    { title: 'بلاغات OVR', value: stats.ovrNew, icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50', tab: 'quality' },
    { title: 'إجازات معلقة', value: stats.leavesPending, icon: Calendar, color: 'text-orange-600', bgColor: 'bg-orange-50', tab: 'leaves' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* ترويسة الترحيب المصغرة */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-600 rounded-[2rem] p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black mb-1">مرحباً بك، أيها المسؤول 👋</h1>
            <p className="text-emerald-100 font-medium text-sm">إليك ملخص سريع لأداء المركز الطبي اليوم.</p>
          </div>
          <Activity className="hidden md:block w-12 h-12 text-emerald-400 opacity-50" />
        </div>
      </div>

      {/* بطاقات الإحصائيات الأفقية (بيانات الكارت في صف واحد) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => (
          <div 
            key={idx} 
            onClick={() => setActiveTab(card.tab)}
            className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-100 transition-all cursor-pointer group flex items-center justify-between h-20"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${card.bgColor} ${card.color} transition-transform group-hover:scale-105`}>
                <card.icon className="w-5 h-5"/>
              </div>
              <h3 className="text-gray-600 font-bold text-xs md:text-sm whitespace-nowrap">{card.title}</h3>
            </div>
            <div className="flex items-center">
               <span className="text-2xl font-black text-gray-800">{card.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* الوصول السريع المصغر */}
      <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm">
        <h3 className="font-black text-lg text-gray-800 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600"/> اختصارات الإدارة
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'إضافة موظف', icon: UserPlus, tab: 'doctors', color: 'hover:bg-emerald-50 hover:text-emerald-700' },
              { label: 'سجل الحضور', icon: Clock, tab: 'attendance', color: 'hover:bg-blue-50 hover:text-blue-700' },
              { label: 'إدارة الجودة', icon: AlertTriangle, tab: 'quality', color: 'hover:bg-red-50 hover:text-red-700' },
              { label: 'بحث تقارير', icon: Search, tab: 'reports', color: 'hover:bg-purple-50 hover:text-purple-700' },
            ].map((btn, i) => (
              <button 
                key={i} 
                onClick={() => setActiveTab(btn.tab)} 
                className={`p-3 bg-gray-50 rounded-xl transition-all flex items-center justify-center gap-3 border border-gray-50 font-bold text-xs md:text-sm ${btn.color}`}
              >
                <btn.icon className="w-4 h-4"/>
                {btn.label}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
