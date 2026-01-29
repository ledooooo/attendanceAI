import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { 
  Users, Clock, AlertTriangle, Calendar, 
  Activity, UserPlus, Search 
} from 'lucide-react';

// ✅ 1. استيراد ويدجت المتواجدين
import OnlineUsersWidget from './OnlineUsersWidget';

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
        .from('attendance')
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
        .eq('status', 'قيد الانتظار'); // تأكد أن الحالة مطابقة لقاعدة البيانات (معلق أو قيد الانتظار)

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

      {/* بطاقات الإحصائيات الأفقية */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => (
          <div 
            key={idx} 
            onClick={() => setActiveTab(card.tab)}
            className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-100 transition-all cursor-pointer group flex items-center justify-between h-24"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${card.bgColor} ${card.color} transition-transform group-hover:scale-105`}>
                <card.icon className="w-6 h-6"/>
              </div>
              <h3 className="text-gray-600 font-bold text-sm whitespace-nowrap">{card.title}</h3>
            </div>
            <div className="flex items-center">
               <span className="text-3xl font-black text-gray-800">{card.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ✅ تقسيم الشاشة: اختصارات + المتواجدون الآن */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* العمود الأكبر: اختصارات الإدارة */}
          <div className="lg:col-span-2 bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
            <h3 className="font-black text-lg text-gray-800 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600"/> اختصارات الإدارة
            </h3>
            <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'إضافة موظف', icon: UserPlus, tab: 'doctors', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
                  { label: 'سجل الحضور', icon: Clock, tab: 'attendance', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
                  { label: 'إدارة الجودة', icon: AlertTriangle, tab: 'quality', color: 'bg-red-50 text-red-700 hover:bg-red-100' },
                  { label: 'بحث تقارير', icon: Search, tab: 'reports', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
                ].map((btn, i) => (
                  <button 
                    key={i} 
                    onClick={() => setActiveTab(btn.tab)} 
                    className={`p-4 rounded-2xl transition-all flex flex-col items-center justify-center gap-2 border border-transparent font-bold text-sm ${btn.color}`}
                  >
                    <btn.icon className="w-6 h-6"/>
                    {btn.label}
                  </button>
                ))}
            </div>
          </div>

          {/* العمود الأصغر: المتواجدون الآن */}
          <div className="lg:col-span-1">
             <OnlineUsersWidget />
          </div>

      </div>
    </div>
  );
}
