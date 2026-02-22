import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSwipeable } from 'react-swipeable';
import { 
    LogOut, Menu, X, Home, BookOpen, Library as LibraryIcon, 
    Gamepad2, CalendarRange, Gift, BarChart3, Loader2, Sparkles, 
    Award, ShieldCheck, Bell, ShoppingBag, Trophy, Share2, Info, 
    Users, CheckSquare, Swords, Smartphone, BellRing, DownloadCloud 
} from 'lucide-react';
import toast from 'react-hot-toast';

// --- استيراد مكونات الموظف المشتركة ---
import StaffNewsFeed from '../staff/components/StaffNewsFeed';
import StaffTrainingCenter from '../staff/components/StaffTrainingCenter';
import StaffLibrary from '../staff/components/StaffLibrary';
import StaffArcade from '../staff/components/StaffArcade';
import RewardsStore from '../staff/components/RewardsStore'; 
import LeaderboardWidget from '../../components/gamification/LeaderboardWidget';
import LevelProgressBar from '../../components/gamification/LevelProgressBar';
import ThemeOverlay from '../staff/components/ThemeOverlay';

// --- استيراد المكونات المخصصة للمشرف ---
import SupervisorForce from './components/SupervisorForce';
import SupervisorSchedules from './components/SupervisorSchedules';
import SupervisorStatistics from './components/SupervisorStatistics';
import SupervisorTasks from './components/SupervisorTasks';
import CompetitionsManager from '../admin/components/CompetitionsManager'; 

import { requestNotificationPermission } from '../../utils/pushNotifications';

export default function SupervisorDashboard() {
    const { user, signOut, loading: authLoading } = useAuth();
    const queryClient = useQueryClient();
    
    // UI States
    const [activeTab, setActiveTab] = useState('home');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isThemeEnabled, setIsThemeEnabled] = useState(true);
    const [showLevelMenu, setShowLevelMenu] = useState(false);
    const [showLeaderboardMenu, setShowLeaderboardMenu] = useState(false);
    
    // ✅ حالة قائمة الإشعارات
    const [showNotifMenu, setShowNotifMenu] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);

    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [showAboutModal, setShowAboutModal] = useState(false);
    const [formData, setFormData] = useState({
        national_id: '', start_date: '', qualification: '', specialty: '', training_courses: '', notes: ''
    });

    // PWA & Notif States
    const [isStandalone, setIsStandalone] = useState(false);
    const [showInstallPopup, setShowInstallPopup] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [notificationStatus, setNotificationStatus] = useState<NotificationPermission>(
        'Notification' in window ? Notification.permission : 'default'
    );

    // 1. جلب بيانات المشرف
    const { data: supervisor, isLoading: loadingDB, isError } = useQuery({
        queryKey: ['current_supervisor', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabase
                .from('supervisors')
                .select('*')
                .eq('id', user.id)
                .maybeSingle(); 
            
            if (error) throw error;
            if (!data) throw new Error("لم يتم العثور على بيانات المشرف");
            return data;
        },
        enabled: !!user?.id && !authLoading,
        retry: 1
    });

    // 2. محول البيانات للمكونات المشتركة
    const mockEmployee = useMemo(() => {
        if (!supervisor) return null;
        return {
            id: supervisor.id, 
            employee_id: supervisor.id, 
            name: supervisor.name,
            specialty: supervisor.role_title, 
            photo_url: supervisor.avatar_url || '', 
            total_points: supervisor.total_points || 0, 
            role: 'supervisor',
            created_at: supervisor.created_at
        } as any;
    }, [supervisor]);

    useEffect(() => {
        if (supervisor && !supervisor.profile_completed) {
            setShowCompletionModal(true);
        }
    }, [supervisor]);

    useEffect(() => {
        const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
        setIsStandalone(isStandaloneMode);
        
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            if (!isStandaloneMode) setShowInstallPopup(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleEnableNotifications = async () => {
        if (!user?.id) return;
        const result = await requestNotificationPermission(user.id);
        if (result) {
            setNotificationStatus('granted');
            toast.success('تم تفعيل التنبيهات! 🔔');
        }
    };

    const completeProfileMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const newPoints = (supervisor?.total_points || 0) + 150;
            const { error } = await supabase
                .from('supervisors')
                .update({ ...data, profile_completed: true, total_points: newPoints })
                .eq('id', user?.id);
            
            if (error) throw error;
            await supabase.from('points_ledger').insert({ 
                employee_id: user?.id, 
                points: 150, 
                reason: 'هدية الاستكمال' 
            });
        },
        onSuccess: () => {
            toast.success('تم استكمال الملف بنجاح! 🎁');
            setShowCompletionModal(false);
            queryClient.invalidateQueries({ queryKey: ['current_supervisor'] });
        }
    });

    const { data: pendingRewardsCount = 0 } = useQuery({
        queryKey: ['pending_rewards_count', user?.id],
        queryFn: async () => {
            if (!user?.id) return 0;
            const { count } = await supabase
                .from('rewards_redemptions')
                .select('*', { count: 'exact', head: true })
                .eq('employee_id', user.id)
                .in('status', ['pending', 'new']);
            return count || 0;
        },
        enabled: !!user?.id
    });

    // ✅ جلب الإشعارات الخاصة بالمشرف
    const fetchNotifications = useCallback(async () => {
        if (!supervisor?.id) return;
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', supervisor.id)
            .order('created_at', { ascending: false })
            .limit(20);
        if (data) setNotifications(data);
    }, [supervisor?.id]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // ✅ دالة تحديث وعرض الإشعارات (مصممة لتعمل مع زر الجرس الجديد)
    const handleToggleNotifMenu = useCallback(async () => {
        const nextState = !showNotifMenu;
        setShowNotifMenu(nextState);
        
        if (nextState) {
            setShowLevelMenu(false);
            setShowLeaderboardMenu(false);
            
            if (notifications.some(n => !n.is_read)) {
                await supabase
                  .from('notifications')
                  .update({ is_read: true })
                  .eq('user_id', supervisor?.id);
                
                fetchNotifications();
            }
        }
    }, [showNotifMenu, notifications, supervisor?.id, fetchNotifications]);

    const unreadNotifsCount = useMemo(() => 
        notifications.filter(n => !n.is_read).length, 
        [notifications]
    );

    const swipeHandlers = useSwipeable({
        onSwipedLeft: (e) => { if (e.initial[0] > window.innerWidth * 0.8) setIsSidebarOpen(true); },
        onSwipedRight: () => setIsSidebarOpen(false),
        trackMouse: true, delta: 50,
    });

    const handleShareApp = async () => { 
        try { 
            if (navigator.share) await navigator.share({ title: 'غرب المطار', url: window.location.origin }); 
            else { navigator.clipboard.writeText(window.location.origin); toast.success('تم نسخ الرابط'); } 
        } catch (err) {} 
    };

    if (isError) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
                <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-xl font-black text-gray-800">عذراً، لا نجد لك حساب مشرف!</h1>
                <p className="text-gray-500 mt-2">تأكد من تسجيل الدخول بالحساب الصحيح أو تواصل مع الإدارة.</p>
                <button onClick={() => signOut()} className="mt-6 bg-red-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg">تسجيل خروج</button>
            </div>
        );
    }

    if (authLoading || loadingDB) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-white gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-purple-600"/>
                <p className="font-black text-gray-400 animate-pulse">جاري التحقق من الصلاحيات...</p>
            </div>
        );
    }

    if (!supervisor || !mockEmployee) {
         return <div className="h-screen flex items-center justify-center font-black text-red-500">حدث خطأ في تحميل البيانات</div>;
    }

    const menuItems = [
        { id: 'home', label: 'الرئيسية', icon: Home },
        { id: 'force', label: 'القوة الفعلية', icon: Users },
        { id: 'tasks', label: 'التكليفات الصادرة', icon: CheckSquare },
        { id: 'schedule', label: 'النوبتجيات', icon: CalendarRange },
        { id: 'statistics', label: 'إحصائيات العمل', icon: BarChart3 },
        { id: 'competitions', label: 'المسابقات', icon: Swords },
        { id: 'training', label: 'مركز التدريب', icon: BookOpen },
        { id: 'library', label: 'السياسات والأدلة', icon: LibraryIcon },
        { id: 'arcade', label: 'صالة الألعاب', icon: Gamepad2 },
        { id: 'rewards', label: 'متجر الجوائز', icon: Gift },
    ];

    const bottomNavItems = [
        { id: 'home', label: 'الرئيسية', icon: Home },
        { id: 'force', label: 'القوة الفعلية', icon: Users },
        { id: 'tasks', label: 'التكليفات', icon: CheckSquare },
        { id: 'statistics', label: 'الإحصائيات', icon: BarChart3 },
    ];

    const level = Math.floor((supervisor?.total_points || 0) / 100) + 1;

    return (
        <div {...swipeHandlers} className="h-screen w-full bg-gray-50 flex overflow-hidden font-sans text-right" dir="rtl">
            
            {isThemeEnabled && <ThemeOverlay employee={mockEmployee} />}

            {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-[60] md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}
            
            <aside className={`fixed inset-y-0 right-0 z-[70] w-72 bg-white border-l shadow-2xl transform transition-transform duration-300 md:translate-x-0 md:static flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="h-24 flex items-center justify-between px-6 border-b text-white bg-gradient-to-r from-purple-600 to-indigo-600">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl border border-white/30 shadow-inner overflow-hidden shrink-0">
                             {supervisor?.avatar_url ? <img src={supervisor.avatar_url} className="w-full h-full object-cover" /> : "👨‍💼"}
                        </div>
                        <div className="min-w-0">
                            <h1 className="font-black text-sm drop-shadow-md truncate">{supervisor?.name}</h1>
                            <p className="text-[10px] font-bold opacity-90">{supervisor?.role_title}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 bg-black/10 rounded-full"><X className="w-5 h-5"/></button>
                </div>

                <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar pb-24 md:pb-4">
                    {menuItems.map(item => (
                        <button key={item.id} onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${activeTab === item.id ? 'bg-purple-600 text-white shadow-md' : 'text-gray-600 hover:bg-purple-50'}`}>
                            <item.icon className="w-5 h-5"/> <span className="text-sm">{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-3 border-t bg-gray-50 flex items-center justify-between shrink-0 gap-1">
                    <button onClick={handleShareApp} className="flex-1 p-2 rounded-xl text-gray-500 flex flex-col items-center gap-1 hover:bg-purple-100"><Share2 className="w-5 h-5" /><span className="text-[9px] font-bold">مشاركة</span></button>
                    <button onClick={() => setShowAboutModal(true)} className="flex-1 p-2 rounded-xl text-gray-500 flex flex-col items-center gap-1 hover:bg-orange-100"><Info className="w-5 h-5" /><span className="text-[9px] font-bold">حول</span></button>
                    <button onClick={signOut} className="flex-1 p-2 rounded-xl text-red-400 flex flex-col items-center gap-1 hover:bg-red-100"><LogOut className="w-5 h-5" /><span className="text-[9px] font-bold">خروج</span></button>
                </div>
            </aside>

            {/* Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
                
                {/* 🔔 شريط الحث الذكي */}
                <div className="fixed top-0 left-0 right-0 z-[60] flex flex-col gap-2 p-2 pointer-events-none">
                    {!isStandalone && showInstallPopup && (
                        <div className="pointer-events-auto w-full max-w-xl mx-auto bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-3 rounded-2xl shadow-xl flex items-center justify-between animate-in slide-in-from-top-10 border border-white/20">
                            <div className="flex items-center gap-3">
                                <DownloadCloud className="w-6 h-6 animate-bounce" />
                                <div><p className="text-xs font-black">ثبّت تطبيق المشرف</p><p className="text-[10px] opacity-80">لمتابعة العمل بشكل أسرع</p></div>
                            </div>
                            <button onClick={handleInstallClick} className="bg-white text-purple-600 text-xs font-black px-4 py-2 rounded-xl">تثبيت</button>
                        </div>
                    )}
                </div>

                <header className="h-16 md:h-20 bg-white border-b flex items-center justify-between px-3 md:px-6 sticky top-0 z-30 shadow-sm shrink-0">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-gray-50 rounded-xl border">
                            <Menu className="w-5 h-5 text-gray-700"/>
                        </button>
                        <span className="font-black text-gray-800 text-sm md:text-base">بوابة المشرف</span>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3">
                        <button onClick={() => { setShowLeaderboardMenu(true); setShowLevelMenu(false); setShowNotifMenu(false); }} className="p-2 bg-yellow-50 text-yellow-600 rounded-xl hover:bg-yellow-100 transition-all">
                            <Trophy className="w-5 h-5" />
                        </button>

                        <button onClick={() => { setShowLevelMenu(true); setShowLeaderboardMenu(false); setShowNotifMenu(false); }} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all flex items-center gap-1">
                            <Star className="w-5 h-5" />
                            <span className="text-xs font-black hidden sm:block">{level}</span>
                        </button>

                        {/* ✅ زر الإشعارات المربوط بالقائمة الجديدة - تم إزالة NotificationBell القديم */}
                        <div className="relative">
                            <button onClick={handleToggleNotifMenu} className="p-2 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 relative transition-all">
                                <Bell className="w-5 h-5" />
                                {unreadNotifsCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full border-2 border-white font-bold animate-pulse">
                                        {unreadNotifsCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-3 md:p-6 bg-gray-50/50 custom-scrollbar">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {activeTab === 'home' && (
                             <>
                                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-[2rem] p-6 md:p-8 text-white shadow-lg relative overflow-hidden mb-6">
                                    <div className="relative z-10">
                                        <h2 className="text-xl md:text-3xl font-black mb-2 flex items-center gap-2">مرحباً بك، {supervisor?.name} 👋</h2>
                                        <p className="text-white/80 font-bold text-xs md:text-base">إدارة القسم ومتابعة التكليفات من مكان واحد.</p>
                                    </div>
                                    <ShieldCheck className="absolute -left-6 -bottom-6 w-40 h-40 text-white opacity-10 transform -rotate-12" />
                                </div>
                                <StaffNewsFeed employee={mockEmployee} />
                             </>
                        )}

                        {activeTab === 'force' && <SupervisorForce />}
                        {activeTab === 'tasks' && <SupervisorTasks />}
                        {activeTab === 'schedule' && <SupervisorSchedules />}
                        {activeTab === 'statistics' && <SupervisorStatistics />}
                        {activeTab === 'competitions' && <CompetitionsManager />}
                        {activeTab === 'training' && <StaffTrainingCenter employee={mockEmployee} />}
                        {activeTab === 'library' && <StaffLibrary employee={mockEmployee} />}
                        {activeTab === 'arcade' && <StaffArcade employee={mockEmployee} />}
                        {activeTab === 'rewards' && <RewardsStore employee={mockEmployee} />}
                    </div>
                </main>

                {/* Navbar Mobile */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t px-2 py-2 flex justify-between items-center z-50 pb-safe shadow-lg">
                    {bottomNavItems.map(item => (
                        <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center gap-1 w-16 transition-colors ${activeTab === item.id ? 'text-purple-600' : 'text-gray-400'}`}>
                            <div className={`p-1.5 rounded-xl ${activeTab === item.id ? 'bg-purple-50' : ''}`}><item.icon className="w-5 h-5" /></div>
                            <span className="text-[9px] font-black">{item.label}</span>
                        </button>
                    ))}
                    <button onClick={() => setIsSidebarOpen(true)} className="flex flex-col items-center gap-1 w-16 text-gray-400"><div className="p-1.5"><Menu className="w-5 h-5" /></div><span className="text-[9px] font-black">المزيد</span></button>
                </div>
            </div>

            {/* ========== GLOBAL MODALS (Fixed Mobile Layout) ========== */}

            {/* ✅ مودال الإشعارات المستقل والمتجاوب */}
            {showNotifMenu && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowNotifMenu(false)}>
                    <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 font-black text-gray-800 text-sm">
                            <span className="flex items-center gap-2"><Bell className="w-4 h-4 text-purple-600"/> التنبيهات الأخيرة</span>
                            <button onClick={()=>setShowNotifMenu(false)} className="p-1 hover:bg-red-50 hover:text-red-500 transition-colors rounded-full"><X size={18}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                             {notifications.length === 0 ? (
                                <div className="p-10 text-center text-gray-400 font-bold italic text-xs">
                                    <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    لا توجد تنبيهات جديدة حالياً ✨
                                </div>
                             ) : (
                                notifications.map(n => (
                                    <div key={n.id} className="p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors text-right">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-bold text-xs text-gray-800">{n.title}</h4>
                                            {!n.is_read && <span className="w-2 h-2 bg-purple-500 rounded-full shrink-0"></span>}
                                        </div>
                                        <p className="text-[11px] text-gray-500 leading-relaxed mt-1">{n.message}</p>
                                    </div>
                                ))
                             )}
                        </div>
                    </div>
                </div>
            )}

            {showLeaderboardMenu && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowLeaderboardMenu(false)}>
                    <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b flex justify-between items-center bg-yellow-50">
                            <h3 className="font-black text-gray-800 flex items-center gap-2 text-sm"><Trophy className="w-5 h-5 text-yellow-600"/> لوحة الشرف</h3>
                            <button onClick={()=>setShowLeaderboardMenu(false)} className="p-1 bg-white rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar p-2 flex-1">
                            <LeaderboardWidget currentUserId={supervisor?.id} />
                        </div>
                    </div>
                </div>
            )}

            {showLevelMenu && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowLevelMenu(false)}>
                    <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-6 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6 font-black text-gray-800 text-sm">
                            <h3 className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-indigo-600"/> مستواك الحالي</h3>
                            <button onClick={()=>setShowLevelMenu(false)} className="p-1 bg-gray-100 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"><X size={18}/></button>
                        </div>
                        <LevelProgressBar employee={mockEmployee} />
                    </div>
                </div>
            )}

            {showAboutModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm text-center relative animate-in zoom-in-95 shadow-2xl">
                        <button onClick={() => setShowAboutModal(false)} className="absolute top-4 right-4 p-2 bg-gray-50 rounded-full hover:bg-gray-100"><X size={16}/></button>
                        <div className="w-20 h-20 bg-purple-100 rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-purple-200 rotate-3 transition-transform">
                            <img src="/pwa-192x192.png" className="w-14 h-14 rounded-xl" alt="Logo" />
                        </div>
                        <h2 className="text-xl font-black text-gray-800">غرب المطار</h2>
                        <p className="text-xs text-gray-500 font-bold mb-6 tracking-widest uppercase">بوابة المتابعة الإشرافية</p>
                        <div className="space-y-3 text-xs text-gray-600 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <div className="flex justify-between border-b border-gray-200 pb-2"><span>الإصدار:</span><span className="font-black text-gray-800">2.6.0</span></div>
                            <div className="flex justify-between pt-1"><span>التطوير:</span><span className="font-black text-purple-600">IT Department</span></div>
                        </div>
                    </div>
                </div>
            )}

            {showCompletionModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl p-6 md:p-8 animate-in zoom-in-95 border-t-8 border-purple-500 relative overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-full -z-10"></div>
                        <div className="text-center mb-6 relative z-10 shrink-0">
                            <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-200">
                                <Award className="w-10 h-10"/>
                            </div>
                            <h2 className="text-2xl font-black text-gray-800">خطوة واحدة للبدء!</h2>
                        </div>
                        
                        <div className="space-y-4 overflow-y-auto custom-scrollbar p-2 flex-1 relative z-10 text-right">
                            <div><label className="block text-xs font-bold text-gray-600 mb-1">الرقم القومي</label><input type="text" maxLength={14} value={formData.national_id} onChange={e => setFormData({...formData, national_id: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl font-mono text-left outline-none" dir="ltr" placeholder="14 رقم"/></div>
                            <div><label className="block text-xs font-bold text-gray-600 mb-1">تاريخ استلام العمل</label><input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl outline-none"/></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-gray-600 mb-1">المؤهل</label><input type="text" value={formData.qualification} onChange={e => setFormData({...formData, qualification: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl outline-none"/></div>
                                <div><label className="block text-xs font-bold text-gray-600 mb-1">التخصص</label><input type="text" value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl outline-none"/></div>
                            </div>
                            <div><label className="block text-xs font-bold text-gray-600 mb-1">ملاحظات أخرى</label><textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl resize-none h-20 outline-none"></textarea></div>
                        </div>

                        <div className="mt-6 flex gap-3 relative z-10 shrink-0">
                            <button onClick={() => setShowCompletionModal(false)} className="px-6 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold hover:bg-gray-200 transition-colors">تخطي</button>
                            <button onClick={() => completeProfileMutation.mutate(formData)} disabled={completeProfileMutation.isPending} className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl font-black shadow-lg hover:shadow-xl transition-all flex justify-center items-center gap-2">
                                {completeProfileMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : 'حفظ واستلام 150 نقطة 🎁'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
