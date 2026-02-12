import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { 
    Users, Clock, AlertTriangle, Calendar, 
    Activity, UserPlus, Search, User, CheckCircle2
} from 'lucide-react';

// دالة مساعدة لتنسيق الوقت
const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'غير معروف';
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffInMinutes < 1) return 'الآن';
    if (diffInMinutes < 60) return `منذ ${diffInMinutes} دقيقة`;
    if (diffInMinutes < 1440) return `منذ ${Math.floor(diffInMinutes / 60)} ساعة`;
    return date.toLocaleDateString('ar-EG');
};

export default function HomeTab({ employees, setActiveTab }: { employees: Employee[], setActiveTab: (tab: string) => void }) {
    
    // --- 1. حالة الإحصائيات السريعة ---
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
                .eq('status', 'قيد الانتظار');

            setStats({
                presentToday: attendanceCount || 0,
                ovrNew: ovrCount || 0,
                leavesPending: leavesCount || 0
            });
        };

        fetchQuickStats();
    }, []);

    // --- 2. منطق فرز المتواجدين والزوار ---
    const { onlineUsers, lastVisitors } = useMemo(() => {
        const now = new Date().getTime();
        const FIVE_MINUTES = 5 * 60 * 1000;

        // ترتيب الموظفين حسب آخر ظهور (الأحدث أولاً)
        const sortedBySeen = [...employees].sort((a, b) => {
            const timeA = a.last_seen ? new Date(a.last_seen).getTime() : 0;
            const timeB = b.last_seen ? new Date(b.last_seen).getTime() : 0;
            return timeB - timeA;
        });

        // استخراج المتواجدين الآن (خلال آخر 5 دقائق)
        const online = sortedBySeen.filter(emp => {
            if (!emp.last_seen) return false;
            const diff = now - new Date(emp.last_seen).getTime();
            return diff <= FIVE_MINUTES;
        });

        // استخراج آخر 10 زوار (مع استبعاد المتواجدين حالياً)
        const visitors = sortedBySeen
            .filter(emp => emp.last_seen && !online.includes(emp))
            .slice(0, 10);

        return { onlineUsers: online, lastVisitors: visitors };
    }, [employees]);

    const cards = [
        { title: 'إجمالي الموظفين', value: employees.length, icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50', tab: 'doctors' },
        { title: 'حضور اليوم', value: stats.presentToday, icon: Clock, color: 'text-emerald-600', bgColor: 'bg-emerald-50', tab: 'attendance' },
        { title: 'بلاغات OVR', value: stats.ovrNew, icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50', tab: 'quality' },
        { title: 'إجازات معلقة', value: stats.leavesPending, icon: Calendar, color: 'text-orange-600', bgColor: 'bg-orange-50', tab: 'leaves' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            
            {/* ترويسة الترحيب */}
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

            {/* بطاقات الإحصائيات */}
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

            {/* التقسيم الرئيسي للشاشة */}
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

                {/* العمود الأصغر: المتواجدون وآخر الزوار (تم دمج الكود هنا) */}
                <div className="lg:col-span-1 bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[400px]">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center sticky top-0 z-10">
                        <h3 className="font-black text-gray-800 flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-emerald-600"/>
                            نشاط المستخدمين
                        </h3>
                        {onlineUsers.length > 0 && (
                            <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                {onlineUsers.length} متصل
                            </span>
                        )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
                        
                        {/* 1. المتواجدون الآن */}
                        {onlineUsers.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-green-600 mb-1 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3"/> متصل الآن
                                </p>
                                {onlineUsers.map(user => (
                                    <div key={user.id} className="flex items-center justify-between p-2.5 rounded-2xl bg-green-50/50 border border-green-100">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden border border-green-200">
                                                    {user.photo_url ? <img src={user.photo_url} className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-green-700"/>}
                                                </div>
                                                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full animate-pulse"></span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-800">{user.name}</span>
                                                <span className="text-[9px] text-green-600 font-medium">نشط الآن</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 2. آخر الزوار */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-gray-400 mb-1 px-1">آخر 10 زوار</p>
                            {lastVisitors.length === 0 ? (
                                <div className="text-center py-10 text-gray-300 text-xs">لا يوجد نشاط مسجل</div>
                            ) : (
                                lastVisitors.map(user => (
                                    <div key={user.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden text-gray-400 group-hover:bg-white group-hover:shadow-sm transition-all">
                                                {user.photo_url ? <img src={user.photo_url} className="w-full h-full object-cover" /> : <User className="w-4 h-4"/>}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-700 group-hover:text-blue-600 transition-colors">{user.name}</span>
                                                <span className="text-[10px] text-gray-400">{user.specialty}</span>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all">
                                            {formatRelativeTime(user.last_seen)}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
