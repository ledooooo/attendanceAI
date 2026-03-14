'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { Employee } from '../../types';
import { useSwipeable } from 'react-swipeable';
import { 
    Users, Clock, CalendarRange, ClipboardList, 
    Activity, Settings, LogOut, Menu, X, Mail, FileBarChart,
    Newspaper, Trophy, AlertTriangle, MessageCircle, Home, FileArchive, 
    Database, BellRing, Smartphone, FileX, Loader2, Box, CheckSquare, Syringe, 
    LayoutDashboard, UserCog, ShieldCheck, BarChart3, BookOpen, MapPin, Swords,
    Trash2, UserPlus, GraduationCap, Gamepad2, Stethoscope, ChevronLeft, ShieldAlert
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Imports (Components)
import HomeTab from './components/HomeTab';
import DoctorsTab from './components/DoctorsTab';
import AttendanceTab from './components/AttendanceTab';
import EveningSchedulesTab from './components/EveningSchedulesTab';
import LeavesTab from './components/LeavesTab';
import EvaluationsTab from './components/EvaluationsTab';
import SettingsTab from './components/SettingsTab';
import ReportsTab from './components/ReportsTab';
import SendReportsTab from './components/SendReportsTab';
import NewsManagementTab from './components/NewsManagementTab';
import BirthdayWidget from './components/BirthdayWidget';
import EOMManager from './components/EOMManager';
import AdminMessagesTab from './components/AdminMessagesTab';
import QualityDashboard from './components/QualityDashboard'; 
import AdminLibraryManager from './components/AdminLibraryManager'; 
import AdminDataReports from './components/AdminDataReports'; 
import AbsenceReportTab from './components/AbsenceReportTab';
import TasksManager from './components/TasksManager';
import VaccinationsTab from './components/VaccinationsTab';
import GamificationManager from './components/GamificationManager';
import TrainingManager from './components/TrainingManager';
import AssetsManager from './components/AssetsManager'; 
import AdministrationTab from '../staff/components/AdministrationTab';
import SupervisorsManager from './components/SupervisorsManager';
import StatisticsManager from './components/StatisticsManager';
import CompetitionsManager from './components/CompetitionsManager';
import AdminSupervisorRounds from './components/AdminSupervisorRounds';
import AdminVisitorsDashboard from './components/AdminVisitorsDashboard';
import AdminFellowshipTab from './components/AdminFellowshipTab'; 

const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'منذ لحظات';
    if (diffInSeconds < 3600) return `منذ ${Math.floor(diffInSeconds / 60)} دقيقة`;
    if (diffInSeconds < 86400) return `منذ ${Math.floor(diffInSeconds / 3600)} ساعة`;
    if (diffInSeconds < 604800) return `منذ ${Math.floor(diffInSeconds / 86400)} يوم`;
    return date.toLocaleDateString('ar-EG');
};

export default function AdminDashboard() {
    const { signOut, user } = useAuth();
    const queryClient = useQueryClient();
    
    // UI State
    const [activeTab, setActiveTab] = useState('home');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: any) {
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [notifRef]);

    // --- Data Queries ---
    const { data: employees = [], isLoading: isLoadingEmployees, refetch: refetchEmployees } = useQuery({
        queryKey: ['admin_employees'],
        queryFn: async () => {
            const { data, error } = await supabase.from('employees').select('*').order('name');
            if (error) throw error;
            return data as Employee[] || [];
        },
        staleTime: 1000 * 60 * 2, 
    });

    const { data: supervisors = [] } = useQuery({
        queryKey: ['active_supervisors'],
        queryFn: async () => {
            const { data } = await supabase.from('supervisors').select('*');
            return data || [];
        },
        staleTime: 1000 * 60 * 5
    });

    const allActiveUsers = useMemo(() => {
        const formattedSupervisors = supervisors.map((s: any) => ({
            ...s, role: 'supervisor', specialty: s.role_title || 'مشرف'
        }));
        const combined = [...employees, ...formattedSupervisors];
        return combined.sort((a, b) => new Date(b.last_seen || 0).getTime() - new Date(a.last_seen || 0).getTime());
    }, [employees, supervisors]);

    const currentAdminEmployee = employees.find(e => e.id === user?.id) || ({} as Employee);

    // --- Notifications Query ---
    const { data: notifications = [] } = useQuery({
        queryKey: ['admin_notifications_list'],
        queryFn: async () => {
            const { data } = await supabase.from('notifications')
                .select('*')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false })
                .limit(20);
            return data || [];
        },
        enabled: showNotifications
    });

    const markAsReadMutation = useMutation({
        mutationFn: async (id: string) => {
            await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin_notifications_list'] })
    });

    const clearNotificationsMutation = useMutation({
        mutationFn: async () => {
            await supabase.from('notifications').delete().eq('user_id', user?.id);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin_notifications_list'] })
    });

    // --- Badges & Settings ---
    const { data: settings } = useQuery({
        queryKey: ['general_settings'],
        queryFn: async () => {
            const { data } = await supabase.from('general_settings').select('center_name, id').maybeSingle();
            return data || { center_name: 'المركز الطبي', id: '' };
        },
        staleTime: Infinity,
    });

    const { data: badges = { messages: 0, leaves: 0, ovr: 0, tasks: 0, supervisors: 0, notifs: 0 } } = useQuery({
        queryKey: ['admin_badges'],
        queryFn: async () => {
            const [msg, leaves, ovr, taskUpdates, pendingSupervisors, unreadNotifs] = await Promise.all([
                supabase.from('messages').select('*', { count: 'exact', head: true }).eq('to_user', 'admin').eq('is_read', false),
                supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'قيد الانتظار'),
                supabase.from('ovr_reports').select('*', { count: 'exact', head: true }).eq('status', 'new'),
                supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('type', 'task_update').eq('is_read', false),
                supabase.from('supervisors').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
                supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user?.id).eq('is_read', false)
            ]);
            return {
                messages: msg.count || 0,
                leaves: leaves.count || 0,
                ovr: ovr.count || 0,
                tasks: taskUpdates.count || 0,
                supervisors: pendingSupervisors.count || 0,
                notifs: unreadNotifs.count || 0
            };
        },
        refetchInterval: 30000, 
    });

    const swipeHandlers = useSwipeable({
        onSwipedLeft: (eventData) => { if (eventData.initial[0] > window.innerWidth / 2) setIsSidebarOpen(true); },
        onSwipedRight: () => setIsSidebarOpen(false),
        trackMouse: true, delta: 50,
    });


    // =====================================
    // 📊 دالة تصميم شاشة الرئيسية (Advanced Dashboard)
    // =====================================
    const renderAdvancedHome = () => {
        // حساب الإحصائيات (القوة الفعلية النشطة فقط)
        const activeEmployees = employees.filter(e => e.is_active !== false);
        const onlineThreshold = 1000 * 60 * 15; // 15 دقيقة
        const now = new Date().getTime();
        
        const onlineUsers = allActiveUsers.filter(u => u.last_seen && (now - new Date(u.last_seen).getTime() < onlineThreshold));
        
        // تجميع الموظفين حسب التخصص
        const specialtyStats = activeEmployees.reduce((acc, emp) => {
            const spec = emp.specialty || 'أخرى';
            if (!acc[spec]) acc[spec] = { total: 0, online: 0, absent: 0 };
            acc[spec].total += 1;
            if (emp.last_seen && (now - new Date(emp.last_seen).getTime() < onlineThreshold)) {
                acc[spec].online += 1;
            } else {
                acc[spec].absent += 1;
            }
            return acc;
        }, {} as Record<string, {total: number, online: number, absent: number}>);

        return (
            <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
                {/* 1. رأس اللوحة (Header Cards) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-5 rounded-3xl text-white shadow-lg shadow-indigo-200 relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full blur-2xl"></div>
                        <Users className="w-8 h-8 text-indigo-200 mb-3" />
                        <p className="text-indigo-100 text-xs font-bold mb-1">القوة الفعلية (نشط)</p>
                        <h3 className="text-3xl font-black">{activeEmployees.length} <span className="text-sm font-normal opacity-80">موظف</span></h3>
                    </div>
                    
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 rounded-3xl text-white shadow-lg shadow-emerald-200 relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full blur-2xl"></div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-300"></span>
                            </span>
                            <Smartphone className="w-6 h-6 text-emerald-200" />
                        </div>
                        <p className="text-emerald-100 text-xs font-bold mb-1">متصل الآن (Online)</p>
                        <h3 className="text-3xl font-black">{onlineUsers.length} <span className="text-sm font-normal opacity-80">عضو</span></h3>
                    </div>

                    <div onClick={() => setActiveTab('leaves')} className="bg-gradient-to-br from-amber-500 to-amber-700 p-5 rounded-3xl text-white shadow-lg shadow-amber-200 relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform">
                        <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full blur-2xl"></div>
                        <ClipboardList className="w-8 h-8 text-amber-200 mb-3" />
                        <p className="text-amber-100 text-xs font-bold mb-1">طلبات معلقة</p>
                        <div className="flex items-end justify-between">
                            <h3 className="text-3xl font-black">{badges.leaves}</h3>
                            <ChevronLeft className="w-5 h-5 text-amber-200" />
                        </div>
                    </div>

                    <div onClick={() => setActiveTab('quality')} className="bg-gradient-to-br from-rose-500 to-rose-700 p-5 rounded-3xl text-white shadow-lg shadow-rose-200 relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform">
                        <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full blur-2xl"></div>
                        <ShieldAlert className="w-8 h-8 text-rose-200 mb-3" />
                        <p className="text-rose-100 text-xs font-bold mb-1">بلاغات OVR جديدة</p>
                        <div className="flex items-end justify-between">
                            <h3 className="text-3xl font-black">{badges.ovr}</h3>
                            <ChevronLeft className="w-5 h-5 text-rose-200" />
                        </div>
                    </div>
                </div>

                {/* 2. الإحصائيات التفصيلية للتخصصات */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6 border-b border-gray-50 pb-4">
                        <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                            <Stethoscope className="text-blue-600 w-5 h-5" /> تفصيل القوة العاملة (حسب التخصص)
                        </h3>
                        <span className="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1 rounded-lg border border-blue-100">تحديث مباشر</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(specialtyStats).sort((a,b) => b[1].total - a[1].total).map(([spec, stats]) => (
                            <div key={spec} className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100 hover:border-blue-200 transition-colors group">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-gray-700 text-sm group-hover:text-blue-700 transition-colors">{spec}</h4>
                                    <span className="bg-white shadow-sm border border-gray-200 text-gray-800 text-xs font-black px-2 py-0.5 rounded-md">
                                        {stats.total} موظف
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-2">
                                    <div className="flex-1 bg-emerald-50 rounded-xl p-2 border border-emerald-100/50 flex flex-col items-center">
                                        <span className="text-[10px] text-emerald-600 font-bold mb-1">متصل</span>
                                        <span className="text-lg font-black text-emerald-700">{stats.online}</span>
                                    </div>
                                    <div className="flex-1 bg-gray-100 rounded-xl p-2 border border-gray-200/50 flex flex-col items-center">
                                        <span className="text-[10px] text-gray-500 font-bold mb-1">غير متصل</span>
                                        <span className="text-lg font-black text-gray-600">{stats.absent}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. قائمة المتصلين حالياً */}
                {onlineUsers.length > 0 && (
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                        <h3 className="text-base font-black text-gray-800 mb-4 flex items-center gap-2">
                            <Activity className="text-emerald-500 w-5 h-5" /> المتواجدون على النظام الآن
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {onlineUsers.map(user => (
                                <div key={user.id} className="flex items-center gap-2 bg-emerald-50/50 border border-emerald-100 px-3 py-1.5 rounded-full">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <span className="text-xs font-bold text-gray-700">{user.name?.split(' ')[0]} {user.name?.split(' ')[1]}</span>
                                    <span className="text-[9px] bg-white text-gray-500 px-1.5 py-0.5 rounded-md shadow-sm">{user.specialty}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };


    // --- Content Renderer ---
    const renderContent = () => {
        switch (activeTab) {
            case 'home': return renderAdvancedHome(); // ✅ استخدام الشاشة الجديدة
            case 'doctors': return <DoctorsTab employees={employees || []} onRefresh={refetchEmployees} centerId={settings?.id} />;
            case 'supervisors': return <SupervisorsManager />;
            case 'staff_admin': return <AdministrationTab employee={currentAdminEmployee} />;
            case 'attendance': return <AttendanceTab onRefresh={()=>{}} />;
            case 'schedules': return <EveningSchedulesTab employees={employees || []} />;
            case 'leaves': return <LeavesTab onRefresh={()=>{}} />;
            case 'evaluations': return <EvaluationsTab employees={employees || []} />;
            case 'settings': return <SettingsTab onUpdateName={() => queryClient.invalidateQueries({ queryKey: ['general_settings'] })} />;
            case 'reports': return <ReportsTab />;
            case 'statistics': return <StatisticsManager />;
            case 'send_reports': return <SendReportsTab />;
            case 'news': return <NewsManagementTab />;
            case 'supervisor-rounds': return <AdminSupervisorRounds />;
            case 'competitions': return <CompetitionsManager />;
            case 'motivation': return <div className="space-y-4"><BirthdayWidget employees={employees || []} /><EOMManager /></div>;
            case 'all_messages': return <AdminMessagesTab employees={employees || []} />;
            case 'quality': return <QualityDashboard />;
            case 'assets': return <AssetsManager />;
            case 'training': return <TrainingManager />;
            case 'library-manager': return <AdminLibraryManager />;
            case 'data-reports': return <AdminDataReports employees={employees || []} />;
            case 'absence-report': return <AbsenceReportTab />;
            case 'tasks': return <TasksManager employees={employees || []} />;
            case 'vaccinations': return <VaccinationsTab employees={employees || []} />;
            case 'gamification': return <div className="space-y-4"><GamificationManager /><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><BirthdayWidget employees={employees || []} /><EOMManager /></div></div>;
            case 'fellowship': return <AdminFellowshipTab />;
            default: return renderAdvancedHome();
        }
    };

    if (isLoadingEmployees) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-gray-500 text-sm font-bold">جاري تحميل النظام...</p>
            </div>
        );
    }

    return (
        <div {...swipeHandlers} className="h-screen w-full bg-gray-50 flex overflow-hidden font-sans text-right" dir="rtl">
            
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-[60] md:hidden backdrop-blur-sm transition-opacity duration-300" onClick={() => setIsSidebarOpen(false)} />
            )}

            {/* --- Compact Sidebar --- */}
            <aside className={`
                fixed inset-y-0 right-0 z-[70] w-[80vw] max-w-[260px] bg-white border-l shadow-xl 
                transform transition-transform duration-300 ease-in-out flex flex-col 
                ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} 
                md:translate-x-0 md:static md:w-64 md:shadow-none h-[100dvh]
            `}>
                <div className="h-16 flex items-center justify-between px-4 border-b shrink-0 bg-gradient-to-l from-gray-50 to-white">
                    <div className="flex items-center gap-2">
                        <div className="bg-white p-1 rounded-lg shadow-sm border border-blue-100">
                            <img src="/pwa-192x192.png" className="w-7 h-7 rounded-md" alt="Logo" />
                        </div>
                        <div>
                            <h1 className="font-black text-gray-800 text-sm">لوحة الإدارة</h1>
                            <p className="text-[9px] text-gray-500 font-bold truncate max-w-[120px]">{settings?.center_name}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1.5 text-gray-400 hover:text-red-500 bg-gray-50 rounded-full transition-colors">
                        <X className="w-5 h-5"/>
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-1 custom-scrollbar pb-safe">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                                className={`
                                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative text-right
                                    ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-100 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-blue-700 font-medium'}
                                `}
                            >
                                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-blue-600'}`} />
                                <span className="text-xs">{item.label}</span>
                                {item.badge && item.badge > 0 && (
                                    <span className="absolute left-3 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm border border-white">
                                        {item.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-3 border-t bg-gray-50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs border border-white shadow-sm">AD</div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-gray-800">المدير</p>
                        </div>
                    </div>
                    <button onClick={signOut} title="تسجيل الخروج" className="p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors bg-white shadow-sm border border-gray-100">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </aside>

            {/* --- Main Content --- */}
            <div className="flex-1 flex flex-col min-w-0 bg-gray-100/30 relative">
                
                {/* Header */}
                <header className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-6 sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)] shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors active:scale-95 border border-gray-200">
                            <Menu className="w-5 h-5 text-gray-700"/>
                        </button>
                        <h2 className="text-base font-black text-gray-800">{menuItems.find(i => i.id === activeTab)?.label || 'الرئيسية'}</h2>
                    </div>

                    <div className="flex items-center gap-3" ref={notifRef}>
                        <div className="relative">
                            <button 
                                onClick={() => setShowNotifications(!showNotifications)}
                                className={`p-2 rounded-full transition-colors relative ${showNotifications ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-500'}`}
                            >
                                <BellRing className="w-5 h-5" />
                                {badges.notifs > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
                                )}
                            </button>

                            {showNotifications && (
                                <div className="absolute left-0 mt-3 w-80 md:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in slide-in-from-top-2">
                                    <div className="p-3 border-b bg-gray-50/50 flex justify-between items-center">
                                        <h4 className="text-sm font-bold text-gray-700">الإشعارات</h4>
                                        {notifications.length > 0 && (
                                            <button onClick={() => clearNotificationsMutation.mutate()} className="text-[10px] text-red-500 hover:underline flex items-center gap-1">
                                                <Trash2 className="w-3 h-3"/> مسح الكل
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {notifications.length === 0 ? (
                                            <div className="py-8 text-center text-gray-400 text-xs font-bold">لا توجد إشعارات جديدة</div>
                                        ) : (
                                            notifications.map((notif: any) => (
                                                <div 
                                                    key={notif.id} 
                                                    onClick={() => !notif.is_read && markAsReadMutation.mutate(notif.id)}
                                                    className={`p-3 border-b last:border-0 hover:bg-gray-50 transition-colors cursor-pointer ${notif.is_read ? 'opacity-60' : 'bg-blue-50/30'}`}
                                                >
                                                    <div className="flex gap-3">
                                                        <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${notif.is_read ? 'bg-gray-300' : 'bg-blue-500'}`}></div>
                                                        <div>
                                                            <h5 className="text-xs font-bold text-gray-800">{notif.title}</h5>
                                                            <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{notif.message}</p>
                                                            <span className="text-[9px] text-gray-400 mt-1 block">{formatTimeAgo(notif.created_at)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar pb-24 scroll-smooth">
                    {renderContent()}
                </main>

                {/* Bottom Navbar (Mobile Only) */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-1.5 flex justify-between items-center z-50 pb-safe shadow-[0_-4px_15px_rgba(0,0,0,0.03)]">
                    <MobileNavItem icon={LayoutDashboard} label="الرئيسية" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
                    <MobileNavItem icon={Users} label="الموظفين" active={activeTab === 'doctors'} onClick={() => setActiveTab('doctors')} />
                    
                    <button onClick={() => setActiveTab('reports')} className="relative -top-5 bg-blue-600 text-white p-3.5 rounded-2xl shadow-lg shadow-blue-200 border-4 border-gray-50 flex items-center justify-center transform active:scale-95 transition-transform">
                        <FileBarChart className="w-5 h-5" />
                    </button>

                    <MobileNavItem icon={ClipboardList} label="الطلبات" active={activeTab === 'leaves'} badge={badges?.leaves} onClick={() => setActiveTab('leaves')} />
                    <MobileNavItem icon={Menu} label="المزيد" active={false} onClick={() => setIsSidebarOpen(true)} />
                </div>

            </div>
        </div>
    );
}

// قائمة القائمة الجانبية المحدثة (تم إضافة تبويب الألعاب)
const menuItems = [
    { id: 'home', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'fellowship', label: 'أكاديمية الزمالة', icon: GraduationCap },
    { id: 'gamification', label: 'النقاط والمسابقات', icon: Trophy }, 
    { id: 'competitions', label: 'صالة الألعاب', icon: Gamepad2 }, // ✅ تبويب الألعاب الجديد
    { id: 'doctors', label: 'شئون الموظفين', icon: Users },
    { id: 'attendance', label: 'سجلات البصمة', icon: Clock },
    { id: 'schedules', label: 'جداول النوبتجية', icon: CalendarRange },
    { id: 'leaves', label: 'طلبات الإجازات', icon: ClipboardList, badge: 0 },
    { id: 'tasks', label: 'التكليفات', icon: CheckSquare, badge: 0 },
    { id: 'all_messages', label: 'الرسائل', icon: MessageCircle, badge: 0 },
    { id: 'quality', label: 'الجودة (OVR)', icon: AlertTriangle, badge: 0 },
    { id: 'supervisors', label: 'المشرفين', icon: ShieldCheck, badge: 0 },
    { id: 'supervisor-rounds', label: 'المرور', icon: MapPin },
    { id: 'reports', label: 'التقارير', icon: FileBarChart },
    { id: 'statistics', label: 'الإحصائيات', icon: BarChart3 },
    { id: 'evaluations', label: 'التقييمات', icon: Activity },
    { id: 'news', label: 'الأخبار', icon: Newspaper },
    { id: 'vaccinations', label: 'التطعيمات', icon: Syringe },
    { id: 'training', label: 'التدريب', icon: BookOpen },
    { id: 'assets', label: 'العهد', icon: Box },
    { id: 'absence-report', label: 'الغياب', icon: FileX },
    { id: 'library-manager', label: 'المكتبة', icon: FileArchive },
    { id: 'data-reports', label: 'البيانات', icon: Database },
    { id: 'staff_admin', label: 'إدارة', icon: UserCog },
    { id: 'send_reports', label: 'بريد', icon: Mail },
    { id: 'settings', label: 'الإعدادات', icon: Settings },
];

const MobileNavItem = ({ icon: Icon, label, active, onClick, badge }: any) => (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-colors w-14 ${active ? 'text-blue-600' : 'text-gray-400'}`}>
        <div className={`p-1 rounded-lg transition-all relative ${active ? 'bg-blue-50' : ''}`}>
            <Icon className={`w-5 h-5 ${active ? 'fill-current' : ''}`} />
            {badge > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>}
        </div>
        <span className="text-[9px] font-bold">{label}</span>
    </button>
);
