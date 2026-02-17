import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSwipeable } from 'react-swipeable';
import { 
    LogOut, Menu, X, Home, BookOpen, Library as LibraryIcon, 
    Gamepad2, CalendarRange, Gift, BarChart3, Loader2, Sparkles, 
    Award, ShieldCheck, Bell, ShoppingBag, Trophy, Share2, Info, Users, CheckSquare
} from 'lucide-react';
import toast from 'react-hot-toast';

// --- استيراد مكونات الموظف المشتركة ---
import StaffNewsFeed from '../staff/components/StaffNewsFeed';
import StaffTrainingCenter from '../staff/components/StaffTrainingCenter';
import StaffLibrary from '../staff/components/StaffLibrary';
import StaffArcade from '../staff/components/StaffArcade';
import RewardsStore from '../staff/components/RewardsStore'; 
import NotificationBell from '../../components/ui/NotificationBell';
import LeaderboardWidget from '../../components/gamification/LeaderboardWidget';
import LevelProgressBar from '../../components/gamification/LevelProgressBar';
import ThemeOverlay from '../staff/components/ThemeOverlay';

// --- استيراد المكونات المخصصة للمشرف ---
import SupervisorForce from './components/SupervisorForce';
import SupervisorSchedules from './components/SupervisorSchedules';
import SupervisorStatistics from './components/SupervisorStatistics';
import SupervisorTasks from './components/SupervisorTasks';

export default function SupervisorDashboard() {
    const { user, signOut } = useAuth();
    const queryClient = useQueryClient();
    
    // States
    const [activeTab, setActiveTab] = useState('home');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isThemeEnabled, setIsThemeEnabled] = useState(true);

    const [showLevelMenu, setShowLevelMenu] = useState(false);
    const [showLeaderboardMenu, setShowLeaderboardMenu] = useState(false);

    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [showAboutModal, setShowAboutModal] = useState(false);
    const [formData, setFormData] = useState({
        national_id: '', start_date: '', qualification: '', specialty: '', training_courses: '', notes: ''
    });

    // 1. جلب بيانات المشرف
    const { data: supervisor, isLoading } = useQuery({
        queryKey: ['current_supervisor', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabase.from('supervisors').select('*').eq('id', user.id).single();
            if (error) throw error;
            return data;
        },
        enabled: !!user?.id
    });

    useEffect(() => {
        if (supervisor && !supervisor.profile_completed) setShowCompletionModal(true);
    }, [supervisor]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (tabParam) {
            setActiveTab(tabParam); 
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const completeProfileMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            if (!user?.id) throw new Error("User not found");
            const newPoints = (supervisor?.total_points || 0) + 150;
            const { error } = await supabase.from('supervisors').update({
                ...data, profile_completed: true, total_points: newPoints
            }).eq('id', user.id);
            if (error) throw error;
            await supabase.from('points_ledger').insert({ employee_id: user.id, points: 150, reason: 'هدية الاستكمال' });
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
            const { count } = await supabase.from('rewards_redemptions').select('*', { count: 'exact', head: true }).eq('employee_id', user.id).in('status', ['pending', 'قيد الانتظار', 'معلق', 'new']);
            return count || 0;
        }
    });

    // --- Data Adapter ---
    const mockEmployee = useMemo(() => {
        if (!supervisor) return null;
        return {
            id: supervisor.id, employee_id: supervisor.id, name: supervisor.name,
            specialty: supervisor.role_title, photo_url: supervisor.avatar_url || '', 
            total_points: supervisor.total_points || 0, role: 'supervisor'
        } as any;
    }, [supervisor]);

    const level = Math.floor((supervisor?.total_points || 0) / 100) + 1;

    const swipeHandlers = useSwipeable({
        onSwipedLeft: (e) => { if (e.initial[0] > window.innerWidth / 2) setIsSidebarOpen(true); },
        onSwipedRight: () => setIsSidebarOpen(false),
        trackMouse: true, delta: 50,
    });

    const handleShareApp = async () => { 
        try { 
            if (navigator.share) await navigator.share({ title: 'غرب المطار', url: window.location.origin }); 
            else { navigator.clipboard.writeText(window.location.origin); toast.success('تم نسخ الرابط'); } 
        } catch (err) {} 
    };

    // القوائم الجانبية
    const menuItems = [
        { id: 'home', label: 'الرئيسية', icon: Home },
        { id: 'force', label: 'القوة الفعلية', icon: Users },
        { id: 'tasks', label: 'التكليفات الصادرة', icon: CheckSquare },
        { id: 'schedule', label: 'النوبتجيات', icon: CalendarRange },
        { id: 'statistics', label: 'إحصائيات العمل', icon: BarChart3 },
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

    if (isLoading || !mockEmployee) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-10 h-10 animate-spin text-purple-600"/></div>;
    }

    return (
        <div {...swipeHandlers} className="h-screen w-full bg-gray-50 flex overflow-hidden font-sans text-right" dir="rtl">
            
            {isThemeEnabled && <ThemeOverlay employee={mockEmployee} />}

            {/* Sidebar */}
            {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-[60] md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}
            <aside className={`fixed inset-y-0 right-0 z-[70] w-72 bg-white border-l shadow-2xl transform transition-transform duration-300 md:translate-x-0 md:static flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                <div className="h-24 flex items-center justify-between px-6 border-b text-white bg-gradient-to-r from-purple-600 to-indigo-600">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl border border-white/30 shadow-inner">
                            {supervisor?.avatar_url || "👨‍💼"}
                        </div>
                        <div>
                            <h1 className="font-black text-sm drop-shadow-md line-clamp-1">{supervisor?.name}</h1>
                            <p className="text-[10px] font-bold opacity-90">{supervisor?.role_title}</p>
                            <p className="text-[9px] opacity-75">{supervisor?.organization}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 bg-black/10 rounded-full"><X className="w-5 h-5"/></button>
                </div>

                <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar pb-24 md:pb-4">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-2 px-2">لوحة المتابعة الإشرافية</p>
                    {menuItems.map(item => {
                        const isActive = activeTab === item.id;
                        return (
                            <button 
                                key={item.id} 
                                onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all group
                                    ${isActive ? 'bg-purple-600 text-white shadow-md translate-x-[-5px]' : 'text-gray-600 hover:bg-purple-50 hover:text-purple-600'}
                                `}
                            >
                                <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-purple-600'}`}/> 
                                <span className="text-sm">{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* ✅ أزرار المشاركة، حول التطبيق، الخروج مرتبة جنباً إلى جنب */}
                <div className="p-4 border-t bg-gray-50 flex items-center justify-around shrink-0 pb-safe">
                    <button onClick={handleShareApp} className="p-3 rounded-2xl text-gray-500 hover:bg-purple-100 hover:text-purple-600 transition-colors flex flex-col items-center gap-1">
                        <Share2 className="w-5 h-5" />
                        <span className="text-[9px] font-bold">مشاركة</span>
                    </button>
                    <button onClick={() => setShowAboutModal(true)} className="p-3 rounded-2xl text-gray-500 hover:bg-orange-100 hover:text-orange-600 transition-colors flex flex-col items-center gap-1">
                        <Info className="w-5 h-5" />
                        <span className="text-[9px] font-bold">حول</span>
                    </button>
                    <button onClick={signOut} className="p-3 rounded-2xl text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors flex flex-col items-center gap-1">
                        <LogOut className="w-5 h-5" />
                        <span className="text-[9px] font-bold">خروج</span>
                    </button>
                </div>
            </aside>

            {/* --- المحتوى الرئيسي --- */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
                
                {/* الشريط العلوي (تم ضبط المقاسات للموبايل) */}
                <header className="h-16 md:h-20 bg-white border-b flex items-center justify-between px-2 md:px-6 sticky top-0 z-30 shadow-sm bg-white/95 backdrop-blur-sm gap-1">
                    
                    <div className="flex items-center gap-1 md:gap-3 shrink-0">
                        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-1.5 md:p-2 bg-gray-50 rounded-xl hover:bg-gray-100 border">
                            <Menu className="w-5 h-5 text-gray-700"/>
                        </button>
                        <span className="font-black text-gray-800 hidden lg:block">المتابعة الإشرافية</span>
                        
                        <div className="relative group hidden md:block">
                            <button 
                                onClick={() => setIsThemeEnabled(!isThemeEnabled)} 
                                className={`p-2 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 ${isThemeEnabled ? 'bg-gradient-to-br from-purple-100 to-purple-200 text-purple-700 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            >
                                <Sparkles className={`w-4 h-4 md:w-5 md:h-5 ${isThemeEnabled ? 'animate-pulse' : ''}`} />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 md:gap-3">
                        <div className="relative group">
                            <button 
                                onClick={() => { setShowLeaderboardMenu(!showLeaderboardMenu); setShowLevelMenu(false); }} 
                                className={`p-1.5 md:p-2 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 ${showLeaderboardMenu ? 'bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-700 shadow-sm' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'}`}
                            >
                                <Trophy className={`w-4 h-4 md:w-5 md:h-5 ${showLeaderboardMenu ? 'animate-bounce' : ''}`} />
                            </button>
                            {showLeaderboardMenu && (
                                <>
                                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 bg-black/50 backdrop-blur-sm md:hidden animate-in fade-in duration-200" onClick={() => setShowLeaderboardMenu(false)}>
                                        <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                                            <div className="p-2 border-b flex justify-between items-center"><span className="font-bold">لوحة الشرف</span><button onClick={()=>setShowLeaderboardMenu(false)}><X className="w-5 h-5"/></button></div>
                                            <div className="overflow-y-auto custom-scrollbar p-2 flex-1"><LeaderboardWidget currentUserId={supervisor?.id} /></div>
                                        </div>
                                    </div>
                                    <div className="hidden md:block absolute left-0 top-full mt-2 w-80 z-50 bg-white rounded-3xl shadow-xl border border-gray-100 animate-in slide-in-from-top-2 max-h-[80vh] overflow-y-auto">
                                        <LeaderboardWidget currentUserId={supervisor?.id} />
                                    </div>
                                </>
                            )}
                        </div>

                        <button onClick={() => setActiveTab('rewards')} className={`p-1.5 md:p-2 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 relative ${activeTab === 'rewards' ? 'bg-gradient-to-br from-pink-100 to-pink-200 text-pink-700 shadow-sm' : 'bg-pink-50 text-pink-600 hover:bg-pink-100'}`}>
                            <ShoppingBag className="w-4 h-4 md:w-5 md:h-5" />
                            {pendingRewardsCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-gradient-to-br from-red-500 to-red-600 text-white text-[9px] md:text-[10px] font-black w-4 h-4 md:w-5 md:h-5 flex items-center justify-center rounded-full border-2 border-white animate-bounce shadow-lg">
                                    {pendingRewardsCount}
                                </span>
                            )}
                        </button>

                        <div className="relative group">
                            <button 
                                onClick={() => { setShowLevelMenu(!showLevelMenu); setShowLeaderboardMenu(false); }} 
                                className={`flex items-center gap-1 px-2 md:px-3 py-1.5 rounded-xl border transition-all ${showLevelMenu ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                            >
                                <ShieldCheck className="w-4 h-4"/>
                                <span className="text-[10px] md:text-xs font-bold hidden sm:block">مستوى: {level}</span>
                                <span className="text-[10px] font-bold sm:hidden">{level}</span>
                            </button>
                            {showLevelMenu && (
                                <>
                                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 bg-black/50 backdrop-blur-sm md:hidden animate-in fade-in duration-200" onClick={() => setShowLevelMenu(false)}>
                                        <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-2 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                                            <LevelProgressBar employee={mockEmployee} />
                                        </div>
                                    </div>
                                    <div className="hidden md:block absolute left-0 top-full mt-2 w-80 z-50 bg-white rounded-3xl shadow-xl border border-gray-100 animate-in slide-in-from-top-2 p-2">
                                        <LevelProgressBar employee={mockEmployee} />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-1 bg-yellow-50 px-2 md:px-3 py-1.5 rounded-xl border border-yellow-200">
                            <Sparkles className="w-3 h-3 md:w-4 md:h-4 text-yellow-500"/>
                            <span className="text-[10px] md:text-sm font-black text-yellow-700">{supervisor?.total_points || 0}</span>
                        </div>

                        <div className="scale-90 md:scale-100 origin-left">
                            <NotificationBell onNavigate={(tab) => setActiveTab(tab)} />
                        </div>
                    </div>
                </header>

                {/* منطقة العرض */}
                <main className="flex-1 overflow-y-auto p-3 md:p-6 bg-gray-50/50 custom-scrollbar pb-24 md:pb-6 relative z-10">
                    <div className="max-w-7xl mx-auto space-y-6">
                        
                        {activeTab === 'home' && (
                            <>
                                <div className="md:hidden mb-4"><LevelProgressBar employee={mockEmployee} /></div>
                                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-[2rem] p-6 md:p-8 text-white shadow-lg relative overflow-hidden mb-6">
                                    <div className="relative z-10">
                                        <h2 className="text-xl md:text-3xl font-black mb-2 flex items-center gap-2">مرحباً بك، {supervisor?.name} 👋</h2>
                                        <p className="text-white/80 font-bold text-xs md:text-base">تصفح أحدث الأخبار والأنشطة الإشرافية في المركز.</p>
                                    </div>
                                    <ShieldCheck className="absolute -left-6 -bottom-6 w-40 h-40 text-white opacity-10 transform -rotate-12" />
                                </div>
                            </>
                        )}

                        {activeTab === 'home' && <StaffNewsFeed employee={mockEmployee} />}
                        {activeTab === 'force' && <SupervisorForce />}
                        {activeTab === 'tasks' && <SupervisorTasks />}
                        {activeTab === 'schedule' && <SupervisorSchedules />}
                        {activeTab === 'statistics' && <SupervisorStatistics />}
                        {activeTab === 'training' && <StaffTrainingCenter employee={mockEmployee} />}
                        {activeTab === 'library' && <StaffLibrary employee={mockEmployee} />}
                        {activeTab === 'arcade' && <StaffArcade employee={mockEmployee} />}
                        {activeTab === 'rewards' && <RewardsStore employee={mockEmployee} />}
                        
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
                                className={`flex flex-col items-center gap-1 w-16 transition-colors ${isActive ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-purple-50' : 'bg-transparent'}`}>
                                    <item.icon className={`w-5 h-5 ${isActive ? 'fill-current opacity-20' : ''}`} />
                                </div>
                                <span className="text-[9px] font-black truncate w-full text-center">{item.label}</span>
                            </button>
                        );
                    })}
                    <button onClick={() => setIsSidebarOpen(true)} className="flex flex-col items-center gap-1 w-16 text-gray-400 hover:text-gray-600">
                        <div className="p-1.5"><Menu className="w-5 h-5" /></div>
                        <span className="text-[9px] font-black">المزيد</span>
                    </button>
                </div>

            </div>

            {/* --- نافذة عن التطبيق (About) --- */}
            {showAboutModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center relative animate-in zoom-in-95">
                        <button onClick={() => setShowAboutModal(false)} className="absolute top-4 right-4 p-2 bg-gray-50 rounded-full hover:bg-gray-100"><X size={16}/></button>
                        <div className="w-16 h-16 bg-purple-100 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-purple-200">
                            <img src="/pwa-192x192.png" className="w-12 h-12 rounded-xl" alt="Logo" />
                        </div>
                        <h2 className="text-lg font-black text-gray-800">غرب المطار</h2>
                        <p className="text-xs text-gray-500 font-bold mb-4">بوابة المتابعة الإشرافية</p>
                        <div className="space-y-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-xl border">
                            <div className="flex justify-between"><span>الإصدار:</span><span className="font-bold">2.5.0</span></div>
                            <div className="flex justify-between"><span>التطوير:</span><span className="font-bold">IT Department</span></div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- نافذة استكمال البيانات (Modal) --- */}
            {showCompletionModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl p-6 md:p-8 animate-in zoom-in-95 border-t-8 border-purple-500 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-full -z-10"></div>
                        <div className="text-center mb-6 relative z-10">
                            <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-200">
                                <Award className="w-10 h-10"/>
                            </div>
                            <h2 className="text-2xl font-black text-gray-800">خطوة واحدة للبدء!</h2>
                            <p className="text-sm text-gray-500 mt-2 font-bold leading-relaxed bg-gray-50 p-3 rounded-xl border">
                                أكمل بياناتك الأساسية الآن واحصل على <span className="text-purple-600 font-black text-lg">150 نقطة</span> ترحيبية كهدية مجانية في متجر الجوائز! 🎁
                            </p>
                        </div>
                        <div className="space-y-4 max-h-[45vh] overflow-y-auto custom-scrollbar p-2 relative z-10">
                            <div><label className="block text-xs font-bold text-gray-600 mb-1">الرقم القومي (اختياري)</label><input type="text" maxLength={14} value={formData.national_id} onChange={e => setFormData({...formData, national_id: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl font-mono text-left outline-none" dir="ltr" placeholder="14 رقم"/></div>
                            <div><label className="block text-xs font-bold text-gray-600 mb-1">تاريخ استلام العمل بالجهة</label><input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl outline-none"/></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-gray-600 mb-1">المؤهل الدراسي</label><input type="text" value={formData.qualification} onChange={e => setFormData({...formData, qualification: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl outline-none"/></div>
                                <div><label className="block text-xs font-bold text-gray-600 mb-1">التخصص الدقيق</label><input type="text" value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl outline-none"/></div>
                            </div>
                            <div><label className="block text-xs font-bold text-gray-600 mb-1">دورات تدريبية حاصل عليها</label><input type="text" value={formData.training_courses} onChange={e => setFormData({...formData, training_courses: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl outline-none" placeholder="مثال: دورة مكافحة العدوى، جودة..."/></div>
                            <div><label className="block text-xs font-bold text-gray-600 mb-1">ملاحظات أخرى</label><textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl resize-none h-20 outline-none"></textarea></div>
                        </div>
                        <div className="mt-6 flex gap-3 relative z-10">
                            <button onClick={() => setShowCompletionModal(false)} className="px-6 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold hover:bg-gray-200 transition-colors">تخطي مؤقتاً</button>
                            <button onClick={() => completeProfileMutation.mutate(formData)} disabled={completeProfileMutation.isPending} className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl font-black shadow-lg hover:shadow-xl active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-50">
                                {completeProfileMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : 'حفظ واستلام الهدية 🎁'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
