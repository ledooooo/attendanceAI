import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { Employee } from '../../types';
import { useSwipeable } from 'react-swipeable';
import { 
    Users, Clock, CalendarRange, ClipboardList, 
    Activity, Settings, LogOut, Menu, X, Mail, FileBarChart,
    Newspaper, Trophy, AlertTriangle, MessageCircle, Home, FileArchive, 
    Database, BellRing, Smartphone, FileX, Loader2, CheckSquare, Syringe
} from 'lucide-react';

// استيراد التبويبات والمكونات
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
import NotificationBell from '../../components/ui/NotificationBell';
import AdminMessagesTab from './components/AdminMessagesTab';
import QualityDashboard from './components/QualityDashboard'; 
import AdminLibraryManager from './components/AdminLibraryManager'; 
import AdminDataReports from './components/AdminDataReports'; 
import AbsenceReportTab from './components/AbsenceReportTab';
import TasksManager from './components/TasksManager';
import VaccinationsTab from './components/VaccinationsTab';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function AdminDashboard() {
    const { signOut, user } = useAuth();
    const queryClient = useQueryClient();
    
    // UI State
    const [activeTab, setActiveTab] = useState('home');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [testResult, setTestResult] = useState('');

    // --- Queries ---
    const { data: employees = [], refetch: refetchEmployees } = useQuery({
        queryKey: ['admin_employees'],
        queryFn: async () => {
            const { data } = await supabase.from('employees').select('*').order('name');
            return data as Employee[] || [];
        },
        staleTime: 1000 * 60 * 15, 
    });

    const { data: settings } = useQuery({
        queryKey: ['general_settings'],
        queryFn: async () => {
            const { data } = await supabase.from('general_settings').select('center_name, id').maybeSingle();
            return data || { center_name: 'المركز الطبي', id: '' };
        },
        staleTime: Infinity,
    });

    const { data: badges = { messages: 0, leaves: 0, ovr: 0, tasks: 0 } } = useQuery({
        queryKey: ['admin_badges'],
        queryFn: async () => {
            const [msg, leaves, ovr, taskUpdates] = await Promise.all([
                supabase.from('messages').select('*', { count: 'exact', head: true }).eq('to_user', 'admin').eq('is_read', false),
                supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'قيد الانتظار'),
                supabase.from('ovr_reports').select('*', { count: 'exact', head: true }).eq('status', 'new'),
                supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('type', 'task_update').eq('is_read', false)
            ]);
            return {
                messages: msg.count || 0,
                leaves: leaves.count || 0,
                ovr: ovr.count || 0,
                tasks: taskUpdates.count || 0
            };
        },
        refetchInterval: 5000, 
    });

    useEffect(() => {
        if (activeTab === 'tasks' && badges.tasks > 0) {
            const markTasksAsRead = async () => {
                await supabase.from('notifications').update({ is_read: true }).eq('type', 'task_update').eq('is_read', false);
                queryClient.invalidateQueries({ queryKey: ['admin_badges'] });
            };
            markTasksAsRead();
        }
    }, [activeTab, badges.tasks, queryClient]);

    // --- Mutations ---
    const testPushMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("User not found");
            const { data, error } = await supabase.functions.invoke('send-push-notification', {
                body: { userId: user.id, title: '🔔 تنبيه تجريبي', body: `تم إرسال هذا التنبيه في: ${new Date().toLocaleTimeString('ar-EG')}`, url: '/admin' }
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => setTestResult('✅ تم الإرسال بنجاح! راقب هاتفك الآن.'),
        onError: (err: any) => setTestResult(`❌ فشل الإرسال: ${err.message}`)
    });

    // --- Swipe & Menu ---
    const swipeHandlers = useSwipeable({
        onSwipedLeft: (eventData) => { if (eventData.initial[0] > window.innerWidth / 2) setIsSidebarOpen(true); },
        onSwipedRight: () => setIsSidebarOpen(false),
        trackMouse: true, delta: 50,
    });

    const menuItems = [
        { id: 'home', label: 'الرئيسية', icon: Home },
        { id: 'doctors', label: 'شئون الموظفين', icon: Users },
        { id: 'news', label: 'إدارة الأخبار', icon: Newspaper },
        { id: 'motivation', label: 'التحفيز والجوائز', icon: Trophy },
        { id: 'all_messages', label: 'المحادثات والرسائل', icon: MessageCircle, badge: badges.messages },
        { id: 'leaves', label: 'طلبات الإجازات', icon: ClipboardList, badge: badges.leaves },
        { id: 'quality', label: 'إدارة الجودة (OVR)', icon: AlertTriangle, badge: badges.ovr },
        { id: 'tasks', label: 'التكليفات والإشارات', icon: CheckSquare, badge: badges.tasks }, 
        { id: 'attendance', label: 'سجلات البصمة', icon: Clock },
        { id: 'schedules', label: 'جداول النوبتجية', icon: CalendarRange },
        { id: 'reports', label: 'التقارير والإحصائيات', icon: FileBarChart },
        { id: 'evaluations', label: 'التقييمات الطبية', icon: Activity },
        { id: 'data-reports', label: 'بيانات وتقارير', icon: Database }, 
        { id: 'library-manager', label: 'إدارة المكتبة والسياسات', icon: FileArchive },
        { id: 'absence-report', label: 'تقرير الغياب', icon: FileX },
        { id: 'vaccinations', label: 'التطعيمات (Virus B)', icon: Syringe },
        { id: 'send_reports', label: 'إرسال بالبريد', icon: Mail },
        { id: 'test_push', label: 'اختبار التنبيهات', icon: BellRing },
        { id: 'settings', label: 'إعدادات النظام', icon: Settings },
    ];

    return (
        <div {...swipeHandlers} className="h-screen w-full bg-gray-50 flex overflow-hidden font-sans text-right" dir="rtl">
            
            {/* الخلفية المظللة للموبايل */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 z-[60] md:hidden backdrop-blur-sm transition-opacity duration-300" 
                    onClick={() => setIsSidebarOpen(false)} 
                />
            )}

            {/* --- القائمة الجانبية (Sidebar) --- */}
            <aside className={`
                fixed inset-y-0 right-0 z-[70] w-[85vw] max-w-[300px] bg-white border-l shadow-2xl 
                transform transition-transform duration-300 ease-in-out flex flex-col 
                ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} 
                md:translate-x-0 md:static md:w-72 md:shadow-none h-[100dvh]
            `}>
                {/* Header القائمة */}
                <div className="h-20 flex items-center justify-between px-6 border-b shrink-0 bg-gradient-to-r from-blue-50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-1.5 rounded-xl shadow-sm border border-blue-100">
                            <img src="/pwa-192x192.png" className="w-8 h-8 rounded-lg" alt="Logo" />
                        </div>
                        <div>
                            <h1 className="font-black text-gray-800 text-base">لوحة الإدارة</h1>
                            <p className="text-[10px] text-gray-500 font-bold">مركز غرب المطار</p>
                        </div>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                        <X className="w-6 h-6"/>
                    </button>
                </div>

                {/* عناصر القائمة (Scrollable) */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2 custom-scrollbar pb-safe">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                                className={`
                                    w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 group relative
                                    ${isActive 
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 font-bold translate-x-[-5px]' 
                                        : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700 font-medium'
                                    }
                                `}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-blue-600'}`} />
                                <span className="text-sm">{item.label}</span>
                                
                                {/* Badge */}
                                {item.badge && item.badge > 0 && (
                                    <span className="absolute left-4 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-sm border border-white">
                                        {item.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                    <div className="h-4 md:h-0"></div> {/* مسافة أمان */}
                </nav>

                {/* Footer القائمة */}
                <div className="p-4 border-t bg-gray-50 flex items-center justify-between shrink-0 pb-safe">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border-2 border-white shadow-sm">
                            AD
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-gray-800">Admin User</p>
                            <p className="text-[10px] text-gray-500">System Administrator</p>
                        </div>
                    </div>
                    <button onClick={signOut} className="p-2.5 rounded-xl text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors bg-white shadow-sm border border-gray-100">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </aside>

            {/* --- المحتوى الرئيسي --- */}
            <div className="flex-1 flex flex-col min-w-0 bg-gray-100/50 relative">
                
                {/* Navbar (الشريط العلوي) */}
                <header className="h-20 bg-white border-b flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 shadow-sm shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2.5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors active:scale-95 border border-gray-200">
                            <Menu className="w-6 h-6 text-gray-700"/>
                        </button>
                        <div>
                            <h2 className="text-lg font-black text-gray-800 hidden md:block">لوحة التحكم المركزية</h2>
                            <h2 className="text-lg font-black text-gray-800 md:hidden">{settings?.center_name}</h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <NotificationBell />
                    </div>
                </header>

                {/* منطقة المحتوى */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar pb-24">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {activeTab === 'home' && <HomeTab />}
                        {activeTab === 'doctors' && <DoctorsTab employees={employees} onRefresh={refetchEmployees} centerId={settings?.id} />}
                        {activeTab === 'attendance' && <AttendanceTab onRefresh={()=>{}} />}
                        {activeTab === 'schedules' && <EveningSchedulesTab employees={employees} />}
                        {activeTab === 'leaves' && <LeavesTab onRefresh={()=>{}} />}
                        {activeTab === 'evaluations' && <EvaluationsTab employees={employees} />}
                        {activeTab === 'settings' && <SettingsTab onUpdateName={() => queryClient.invalidateQueries({ queryKey: ['general_settings'] })} />}
                        {activeTab === 'reports' && <ReportsTab />}
                        {activeTab === 'send_reports' && <SendReportsTab />}
                        {activeTab === 'news' && <NewsManagementTab />}
                        {activeTab === 'motivation' && (
                            <div className="space-y-6">
                                <BirthdayWidget employees={employees} />
                                <EOMManager />
                            </div>
                        )}
                        {activeTab === 'all_messages' && <AdminMessagesTab employees={employees} />}
                        {activeTab === 'quality' && <QualityDashboard />}
                        {activeTab === 'library-manager' && <AdminLibraryManager />} 
                        {activeTab === 'data-reports' && <AdminDataReports employees={employees} />}
                        {activeTab === 'absence-report' && <AbsenceReportTab />}      
                        {activeTab === 'tasks' && <TasksManager employees={employees} />}
                        {activeTab === 'vaccinations' && <VaccinationsTab employees={employees} />}
                        
                        {/* واجهة اختبار التنبيهات */}
                        {activeTab === 'test_push' && (
                            <div className="max-w-md mx-auto bg-white p-8 rounded-[30px] shadow-sm border border-gray-100 text-center space-y-6 mt-10">
                                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-600 shadow-inner">
                                    <Smartphone className="w-10 h-10" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-800">اختبار الإشعارات</h2>
                                    <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                                        إرسال إشعار تجريبي فوري لجميع الأجهزة المتصلة بحسابك للتحقق من الخدمة.
                                    </p>
                                </div>
                                <button 
                                    onClick={() => { setTestResult(''); testPushMutation.mutate(); }} 
                                    disabled={testPushMutation.isPending}
                                    className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                                >
                                    {testPushMutation.isPending ? <><Loader2 className="animate-spin w-5 h-5"/> جاري الإرسال...</> : '🚀 إرسال الآن'}
                                </button>
                                {testResult && (
                                    <div className={`p-4 rounded-xl text-sm font-bold animate-in fade-in zoom-in ${testResult.includes('نجح') ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                        {testResult}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
