import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest, Evaluation } from '../../types';
import { useSwipeable } from 'react-swipeable';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { requestNotificationPermission } from '../../utils/pushNotifications';
import toast from 'react-hot-toast';

import { 
    LogOut, User, Clock, Printer, FilePlus, 
    List, Award, Inbox, BarChart, Menu, X, LayoutDashboard,
    Share2, Info, Moon, FileText, ListTodo, 
    Link as LinkIcon, AlertTriangle, ShieldCheck, ArrowLeftRight, Bell, BookOpen, 
    Calendar, Settings, ShoppingBag, Trophy, Star, Check, ShoppingCart, Gamepad2, Sparkles, Palette
} from 'lucide-react';

// استيراد المكونات الفرعية
import StaffProfile from './components/StaffProfile';
import StaffAttendance from './components/StaffAttendance';
import StaffNewRequest from './components/StaffNewRequest';
import StaffTemplatesTab from './components/StaffTemplatesTab';
import StaffRequestsHistory from './components/StaffRequestsHistory';
import StaffEvaluations from './components/StaffEvaluations';
import StaffMessages from './components/StaffMessages';
import StaffStats from './components/StaffStats';
import StaffNewsFeed from './components/StaffNewsFeed';
import EOMVotingCard from './components/EOMVotingCard';
import EmployeeEveningSchedule from './components/EmployeeEveningSchedule';
import DepartmentRequests from './components/DepartmentRequests';
import StaffLinksTab from './components/StaffLinksTab';
import StaffOVR from './components/StaffOVR';
import ShiftRequestsTab from './components/ShiftRequestsTab';
import QualityDashboard from '../admin/components/QualityDashboard';
import StaffLibrary from './components/StaffLibrary';
import StaffTasks from './components/StaffTasks';
import AdministrationTab from './components/AdministrationTab';
import RewardsStore from './components/RewardsStore';
import StaffTrainingCenter from './components/StaffTrainingCenter';
import ThemeOverlay from './components/ThemeOverlay';
import StaffArcade from './components/StaffArcade';

// استيراد مكونات التحفيز
import DailyQuizModal from '../../components/gamification/DailyQuizModal';
import LeaderboardWidget from '../../components/gamification/LeaderboardWidget';
import LevelProgressBar from '../../components/gamification/LevelProgressBar';
import NotificationBell from '../../components/ui/NotificationBell';

// --- الثيمات (الألوان) ---
const THEMES = [
    { id: 'emerald', name: 'زمردي', bg: 'bg-emerald-600', text: 'text-emerald-600', light: 'bg-emerald-50', gradient: 'from-emerald-600 to-teal-600' },
    { id: 'blue', name: 'أزرق', bg: 'bg-blue-600', text: 'text-blue-600', light: 'bg-blue-50', gradient: 'from-blue-600 to-cyan-600' },
    { id: 'purple', name: 'بنفسجي', bg: 'bg-purple-600', text: 'text-purple-600', light: 'bg-purple-50', gradient: 'from-purple-600 to-indigo-600' },
    { id: 'rose', name: 'وردي', bg: 'bg-rose-600', text: 'text-rose-600', light: 'bg-rose-50', gradient: 'from-rose-600 to-pink-600' },
    { id: 'amber', name: 'كهرماني', bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50', gradient: 'from-amber-500 to-orange-500' },
];

export default function StaffDashboard({ employee }: { employee: Employee }) {
    const { signOut } = useAuth();
    const queryClient = useQueryClient();

    // States
    const [activeTab, setActiveTab] = useState('home');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeTheme, setActiveTheme] = useState(THEMES[0]);
    const [showThemeSelector, setShowThemeSelector] = useState(false);

    // حساب المستوى (Level) بناءً على النقاط
    const level = Math.floor((employee?.total_points || 0) / 100) + 1;

    // قراءة التبويب من الرابط (للإشعارات)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (tabParam) {
            setActiveTab(tabParam); 
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const swipeHandlers = useSwipeable({
        onSwipedLeft: (eventData) => { if (eventData.initial[0] > window.innerWidth / 2) setIsSidebarOpen(true); },
        onSwipedRight: () => setIsSidebarOpen(false),
        trackMouse: true, delta: 50,
    });

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'تطبيق موظفي مركز غرب المطار',
                    text: 'حمل التطبيق الآن لمتابعة حضورك وإجازاتك وتقييماتك!',
                    url: window.location.origin,
                });
            } catch (error) {
                console.log('Error sharing', error);
            }
        } else {
            toast.success('ميزة المشاركة غير مدعومة في هذا المتصفح');
        }
    };

    const handleAbout = () => {
        toast((t) => (
            <div className="text-center space-y-2">
                <div className="bg-emerald-100 p-3 rounded-full inline-block mb-2">
                    <Info className="w-8 h-8 text-emerald-600"/>
                </div>
                <h3 className="font-black text-lg">تطبيق موظفي مركز غرب المطار</h3>
                <p className="text-sm text-gray-500">الإصدار 2.5</p>
                <p className="text-xs text-gray-400 mt-2 border-t pt-2">تم التطوير بواسطة إدارة الجودة والنظم</p>
                <button onClick={() => toast.dismiss(t.id)} className="w-full mt-3 bg-gray-100 py-2 rounded-lg font-bold text-gray-700 hover:bg-gray-200">إغلاق</button>
            </div>
        ), { duration: Infinity });
    };

    // القائمة الجانبية (Sidebar)
    const menuItems = [
        { id: 'home', label: 'الرئيسية', icon: Home },
        { id: 'profile', label: 'ملفي الشخصي', icon: User },
        { id: 'attendance', label: 'سجل البصمة', icon: Clock },
        { id: 'new-request', label: 'طلب جديد', icon: FilePlus },
        { id: 'requests-history', label: 'متابعة طلباتي', icon: List },
        { id: 'evaluations', label: 'تقييماتي', icon: Award },
        { id: 'messages', label: 'الرسائل الداخلية', icon: Inbox },
        { id: 'stats', label: 'إحصائياتي', icon: BarChart },
        { id: 'evening-schedule', label: 'النوبتجيات', icon: Moon },
        { id: 'department-requests', label: 'طلبات قسمي', icon: ListTodo, hidden: employee.role !== 'head_of_dept' && employee.role !== 'admin' },
        { id: 'templates', label: 'النماذج المتاحة', icon: Printer },
        { id: 'training', label: 'مركز التدريب', icon: BookOpen },
        { id: 'library', label: 'المكتبة والسياسات', icon: LibraryIcon },
        { id: 'ovr', label: 'نظام OVR', icon: AlertTriangle },
        { id: 'shift-requests', label: 'طلبات التبديل', icon: ArrowLeftRight },
        { id: 'tasks', label: 'تكليفاتي', icon: Check },
        { id: 'links', label: 'روابط هامة', icon: LinkIcon },
        { id: 'administration', label: 'أدوات الإدارة', icon: LayoutDashboard, hidden: !employee.permissions || employee.permissions.length === 0 },
    ].filter(item => !item.hidden);

    // الشريط السفلي (Bottom Nav)
    const bottomNavItems = [
        { id: 'home', label: 'الرئيسية', icon: Home },
        { id: 'attendance', label: 'البصمة', icon: Clock },
        { id: 'new-request', label: 'طلب إجازة', icon: FilePlus },
        { id: 'evaluations', label: 'التقييم', icon: Award },
    ];

    return (
        <div {...swipeHandlers} className="h-screen w-full bg-gray-50 flex overflow-hidden font-sans text-right" dir="rtl">
            <ThemeOverlay /> 

            {/* --- القائمة الجانبية --- */}
            {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-[60] md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}
            <aside className={`fixed inset-y-0 right-0 z-[70] w-72 bg-white border-l shadow-2xl transform transition-transform duration-300 md:translate-x-0 md:static flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                <div className={`h-24 flex items-center justify-between px-6 border-b text-white bg-gradient-to-r ${activeTheme.gradient}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl border border-white/30 shadow-inner overflow-hidden">
                            {employee?.photo_url ? <img src={employee.photo_url} alt="" className="w-full h-full object-cover"/> : <User className="w-6 h-6"/>}
                        </div>
                        <div>
                            <h1 className="font-black text-sm drop-shadow-md line-clamp-1">{employee?.name}</h1>
                            <p className="text-[10px] font-bold opacity-90">{employee?.specialty}</p>
                            <p className="text-[9px] opacity-75 font-mono">{employee?.employee_id}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 bg-black/10 rounded-full"><X className="w-5 h-5"/></button>
                </div>

                <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar pb-24 md:pb-4">
                    {menuItems.map(item => {
                        const isActive = activeTab === item.id;
                        return (
                            <button 
                                key={item.id} 
                                onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all group
                                    ${isActive ? `${activeTheme.bg} text-white shadow-md translate-x-[-5px]` : `text-gray-600 hover:${activeTheme.light} hover:${activeTheme.text}`}
                                `}
                            >
                                <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:'+activeTheme.text}`}/> 
                                <span className="text-sm">{item.label}</span>
                            </button>
                        );
                    })}

                    <div className="my-4 border-t pt-4">
                        <button onClick={handleShare} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all text-gray-600 hover:${activeTheme.light} hover:${activeTheme.text} group`}>
                            <Share2 className={`w-5 h-5 text-gray-400 group-hover:${activeTheme.text}`}/>
                            <span className="text-sm">مشاركة التطبيق</span>
                        </button>
                        <button onClick={handleAbout} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all text-gray-600 hover:${activeTheme.light} hover:${activeTheme.text} group`}>
                            <Info className={`w-5 h-5 text-gray-400 group-hover:${activeTheme.text}`}/>
                            <span className="text-sm">عن التطبيق</span>
                        </button>
                    </div>
                </nav>

                <div className="p-4 border-t bg-gray-50 pb-safe shrink-0">
                    <button onClick={signOut} className="w-full py-3 rounded-xl text-red-500 font-bold hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors flex items-center justify-center gap-2">
                        <LogOut className="w-5 h-5"/> تسجيل الخروج
                    </button>
                </div>
            </aside>

            {/* --- المحتوى الرئيسي --- */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
                
                {/* الشريط العلوي (Top Bar) */}
                <header className="h-16 md:h-20 bg-white border-b flex items-center justify-between px-3 md:px-6 shrink-0 shadow-sm z-30">
                    <div className="flex items-center gap-2 md:gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-gray-50 rounded-xl hover:bg-gray-100 border"><Menu className="w-6 h-6 text-gray-700"/></button>
                        
                        {/* محدد الثيمات */}
                        <div className="relative hidden md:block">
                            <button onClick={() => setShowThemeSelector(!showThemeSelector)} className="p-2 bg-gray-50 rounded-xl hover:bg-gray-100 border text-gray-600">
                                <Palette className="w-5 h-5"/>
                            </button>
                            {showThemeSelector && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowThemeSelector(false)}></div>
                                    <div className="absolute right-0 top-full mt-2 bg-white p-2 rounded-2xl shadow-xl border flex gap-2 z-50 animate-in zoom-in-95">
                                        {THEMES.map(t => (
                                            <button key={t.id} onClick={() => { setActiveTheme(t); setShowThemeSelector(false); }} className={`w-8 h-8 rounded-full ${t.bg} border-2 ${activeTheme.id === t.id ? 'border-gray-800 scale-110' : 'border-transparent opacity-70 hover:opacity-100'} transition-all`}></button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* بادجات النقاط والمستوى والإشعارات */}
                    <div className="flex items-center gap-1.5 md:gap-3">
                        {/* أبطال النقاط */}
                        <button onClick={() => setActiveTab('leaderboard')} className="p-2 bg-orange-50 text-orange-600 rounded-xl border border-orange-100 hover:bg-orange-100 transition-colors" title="أبطال النقاط">
                            <Trophy className="w-5 h-5"/>
                        </button>
                        
                        {/* متجر الجوائز */}
                        <button onClick={() => setActiveTab('store')} className="p-2 bg-purple-50 text-purple-600 rounded-xl border border-purple-100 hover:bg-purple-100 transition-colors relative" title="متجر الجوائز">
                            <ShoppingBag className="w-5 h-5"/>
                        </button>

                        <div className="hidden md:flex items-center gap-1 bg-gray-100 px-3 py-1.5 rounded-xl border">
                            <Star className="w-4 h-4 text-gray-500 fill-current"/>
                            <span className="text-xs font-bold text-gray-700">مستوى: {level}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-yellow-50 px-2.5 md:px-3 py-1.5 rounded-xl border border-yellow-200">
                            <Sparkles className="w-4 h-4 text-yellow-500"/>
                            <span className="text-xs md:text-sm font-black text-yellow-700">{employee?.total_points || 0}</span>
                        </div>
                        <NotificationBell onNavigate={(tab) => setActiveTab(tab)} />
                    </div>
                </header>

                {/* منطقة العرض */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/50 custom-scrollbar pb-24 md:pb-6 relative">
                    
                    {/* شريط التقدم (يظهر فقط في الرئيسية) */}
                    {activeTab === 'home' && (
                        <div className="max-w-7xl mx-auto mb-6">
                            <LevelProgressBar totalPoints={employee?.total_points || 0} />
                        </div>
                    )}

                    <div className="max-w-7xl mx-auto space-y-6">
                        
                        {activeTab === 'home' && (
                            <>
                                <DailyQuizModal employeeId={employee.employee_id} />
                                <StaffNewsFeed employee={employee} />
                                <div className="mt-8">
                                    <EOMVotingCard currentEmployeeId={employee.employee_id} />
                                </div>
                            </>
                        )}
                        {activeTab === 'profile' && <StaffProfile employee={employee} />}
                        {activeTab === 'attendance' && <StaffAttendance employee={employee} />}
                        {activeTab === 'new-request' && <StaffNewRequest employee={employee} />}
                        {activeTab === 'requests-history' && <StaffRequestsHistory employee={employee} />}
                        {activeTab === 'evaluations' && <StaffEvaluations employee={employee} />}
                        {activeTab === 'messages' && <StaffMessages employee={employee} currentUserId={employee.employee_id} />}
                        {activeTab === 'stats' && <StaffStats employee={employee} />}
                        {activeTab === 'evening-schedule' && <EmployeeEveningSchedule employee={employee} />}
                        {activeTab === 'templates' && <StaffTemplatesTab />}
                        {activeTab === 'department-requests' && <DepartmentRequests employee={employee} />}
                        {activeTab === 'links' && <StaffLinksTab />}
                        {activeTab === 'ovr' && <StaffOVR employee={employee} />}
                        {activeTab === 'shift-requests' && <ShiftRequestsTab employee={employee} />}
                        {activeTab === 'library' && <StaffLibrary employee={employee} />}
                        {activeTab === 'tasks' && <StaffTasks employee={employee} />}
                        {activeTab === 'administration' && <AdministrationTab employee={employee} />}
                        {activeTab === 'store' && <RewardsStore employee={employee} />}
                        {activeTab === 'training' && <StaffTrainingCenter employee={employee} />}
                        {activeTab === 'arcade' && <StaffArcade employee={employee} />}
                        {activeTab === 'leaderboard' && (
                            <div className="bg-white rounded-3xl p-6 shadow-sm border border-orange-100">
                                <h2 className="text-xl font-black text-gray-800 flex items-center gap-2 mb-6"><Trophy className="text-orange-500"/> لوحة الشرف وأبطال النقاط</h2>
                                <LeaderboardWidget currentUserId={employee.employee_id} />
                            </div>
                        )}
                    </div>
                </main>

                {/* --- الشريط السفلي (Mobile Bottom Nav) --- */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t px-2 py-2 flex justify-between items-center z-50 pb-safe shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
                    {bottomNavItems.map(item => {
                        const isActive = activeTab === item.id;
                        return (
                            <button 
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`flex flex-col items-center gap-1 w-16 transition-colors ${isActive ? activeTheme.text : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <div className={`p-1.5 rounded-xl transition-all ${isActive ? activeTheme.light : 'bg-transparent'}`}>
                                    <item.icon className={`w-6 h-6 ${isActive ? 'fill-current opacity-20' : ''}`} />
                                </div>
                                <span className="text-[9px] font-black truncate w-full text-center">{item.label}</span>
                            </button>
                        );
                    })}
                    <button onClick={() => setIsSidebarOpen(true)} className="flex flex-col items-center gap-1 w-16 text-gray-400 hover:text-gray-600">
                        <div className="p-1.5"><Menu className="w-6 h-6" /></div>
                        <span className="text-[9px] font-black">المزيد</span>
                    </button>
                </div>

            </div>
        </div>
    );
}
