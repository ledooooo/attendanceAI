import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { 
  Users, Clock, AlertTriangle, Calendar, 
  ArrowLeft, Activity, UserPlus, Search 
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
        .from('attendance_records')
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
    { title: 'إجمالي الموظفين', value: employees.length, icon: Users, color: 'bg-blue-500', tab: 'doctors' },
    { title: 'حضور اليوم', value: stats.presentToday, icon: Clock, color: 'bg-emerald-500', tab: 'attendance' },
    { title: 'بلاغات OVR جديدة', value: stats.ovrNew, icon: AlertTriangle, color: 'bg-red-500', tab: 'quality' },
    { title: 'إجازات معلقة', value: stats.leavesPending, icon: Calendar, color: 'bg-orange-500', tab: 'leaves' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* ترويسة الترحيب */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-600 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-black mb-2">مرحباً بك في لوحة القيادة 👋</h1>
          <p className="text-emerald-100 font-medium text-lg">نظرة عامة على سير العمل في المركز اليوم.</p>
        </div>
      </div>

      {/* بطاقات الإحصائيات السريعة */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => (
          <div 
            key={idx} 
            onClick={() => setActiveTab(card.tab)}
            className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl ${card.color} text-white shadow-lg shadow-gray-200 group-hover:scale-110 transition-transform`}>
                <card.icon className="w-6 h-6"/>
              </div>
              {card.value > 0 && (
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-bold">
                  {card.value}
                </span>
              )}
            </div>
            <h3 className="text-gray-400 font-bold text-xs mb-1">{card.title}</h3>
            <p className="text-3xl font-black text-gray-800">{card.value}</p>
          </div>
        ))}
      </div>

      {/* الوصول السريع */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <h3 className="font-black text-xl text-gray-800 mb-6 flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-600"/> وصول سريع
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button onClick={() => setActiveTab('doctors')} className="p-4 bg-gray-50 rounded-2xl hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex flex-col items-center gap-2 border border-gray-100">
                <UserPlus className="w-6 h-6"/>
                <span className="font-bold text-sm">إضافة موظف</span>
            </button>
            <button onClick={() => setActiveTab('attendance')} className="p-4 bg-gray-50 rounded-2xl hover:bg-blue-50 hover:text-blue-700 transition-colors flex flex-col items-center gap-2 border border-gray-100">
                <Clock className="w-6 h-6"/>
                <span className="font-bold text-sm">سجل الحضور</span>
            </button>
            <button onClick={() => setActiveTab('quality')} className="p-4 bg-gray-50 rounded-2xl hover:bg-red-50 hover:text-red-700 transition-colors flex flex-col items-center gap-2 border border-gray-100">
                <AlertTriangle className="w-6 h-6"/>
                <span className="font-bold text-sm">إدارة الجودة</span>
            </button>
            <button onClick={() => setActiveTab('reports')} className="p-4 bg-gray-50 rounded-2xl hover:bg-purple-50 hover:text-purple-700 transition-colors flex flex-col items-center gap-2 border border-gray-100">
                <Search className="w-6 h-6"/>
                <span className="font-bold text-sm">بحث تقارير</span>
            </button>
        </div>
      </div>
    </div>
  );
}
