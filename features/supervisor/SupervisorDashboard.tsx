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

// --- استيراد المكونات ---
import StaffNewsFeed from '../staff/components/StaffNewsFeed';
import StaffTrainingCenter from '../staff/components/StaffTrainingCenter';
import StaffLibrary from '../staff/components/StaffLibrary';
import StaffArcade from '../staff/components/StaffArcade';
import RewardsStore from '../staff/components/RewardsStore'; 
import NotificationBell from '../../components/ui/NotificationBell';
import LeaderboardWidget from '../../components/gamification/LeaderboardWidget';
import LevelProgressBar from '../../components/gamification/LevelProgressBar';
import ThemeOverlay from '../staff/components/ThemeOverlay';
import SupervisorForce from './components/SupervisorForce';
import SupervisorSchedules from './components/SupervisorSchedules';
import SupervisorStatistics from './components/SupervisorStatistics';
import SupervisorTasks from './components/SupervisorTasks';
import CompetitionsManager from '../admin/components/CompetitionsManager'; 
import { requestNotificationPermission } from '../../utils/pushNotifications';

export default function SupervisorDashboard() {
    const { user, signOut, loading: authLoading } = useAuth(); // أضفنا authLoading
    const queryClient = useQueryClient();
    
    // UI States
    const [activeTab, setActiveTab] = useState('home');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isThemeEnabled, setIsThemeEnabled] = useState(true);
    const [showLevelMenu, setShowLevelMenu] = useState(false);
    const [showLeaderboardMenu, setShowLeaderboardMenu] = useState(false);
    const [showNotifMenu, setShowNotifMenu] = useState(false);

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

    // 1. جلب بيانات المشرف (تم تحسين شرط الـ enabled)
    const { data: supervisor, isLoading: loadingDB, isError } = useQuery({
        queryKey: ['current_supervisor', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabase
                .from('supervisors')
                .select('*')
                .eq('id', user.id)
                .maybeSingle(); // استخدام maybeSingle لتجنب كراش Single
            
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
            employee_id: supervisor.id, // لضمان عمل الإشعارات بالـ UUID حالياً للمشرف
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

    const swipeHandlers = useSwipeable({
        onSwipedLeft: (e) => { if (e.initial[0] > window.innerWidth * 0.8) setIsSidebarOpen(true); },
        onSwipedRight: () => setIsSidebarOpen(false),
        trackMouse: true, delta: 50,
    });

    // ⛔ حالة الخطأ أو عدم وجود حساب مشرف
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

    // ⏳ حالة التحميل (Auth + Database)
    if (authLoading || loadingDB) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-white gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-purple-600"/>
                <p className="font-black text-gray-400 animate-pulse">جاري التحقق من صلاحيات الإشراف...</p>
            </div>
        );
    }

    // ⛔ إذا انتهى التحميل ولم نجد بيانات (أمان إضافي)
    if (!supervisor || !mockEmployee) {
         return <div className="h-screen flex items-center justify-center font-black text-red-500">حدث خطأ في تحميل البيانات</div>;
    }

    return (
        <div {...swipeHandlers} className="h-screen w-full bg-gray-50 flex overflow-hidden font-sans text-right" dir="rtl">
            
            {isThemeEnabled && <ThemeOverlay employee={mockEmployee} />}

            {/* Sidebar */}
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
                        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-gray-50 rounded-xl border"><Menu className="w-5 h-5" /></button>
                        <span className="font-black text-gray-800">بوابة المتابعة الإشرافية</span>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3">
                        <button onClick={() => setShowLeaderboardMenu(true)} className="p-2 bg-yellow-50 text-yellow-600 rounded-xl hover:bg-yellow-100 transition-all">
                            <Trophy className="w-5 h-5" />
                        </button>
                        
                        <div className="relative">
                            <NotificationBell onNavigate={(tab) => setActiveTab(tab)} />
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

            {/* Global Modals (Level & Leaderboard) */}
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

            {/* About & Completion Modals - (بقية الأكواد ثابتة) */}
        </div>
    );
}

