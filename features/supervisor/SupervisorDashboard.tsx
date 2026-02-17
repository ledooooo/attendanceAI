import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSwipeable } from 'react-swipeable';
import { 
    LogOut, Menu, X, Home, BookOpen, Library as LibraryIcon, 
    Gamepad2, CalendarRange, Gift, BarChart3, Loader2, Sparkles, 
    Award, ShieldCheck, Palette, Bell
} from 'lucide-react';
import toast from 'react-hot-toast';

// --- الاستيرادات الصحيحة المتطابقة مع مشروعك ✅ ---
import StaffNewsFeed from '../staff/components/StaffNewsFeed';
import StaffTrainingCenter from '../staff/components/StaffTrainingCenter';
import StaffLibrary from '../staff/components/StaffLibrary';
import StaffArcade from '../staff/components/StaffArcade';
import EmployeeEveningSchedule from '../staff/components/EmployeeEveningSchedule';
import RewardsStore from '../staff/components/RewardsStore'; 
import StatisticsManager from '../admin/components/StatisticsManager'; 
import NotificationBell from '../../components/ui/NotificationBell';

// --- الثيمات (الألوان) ---
const THEMES = [
    { id: 'purple', name: 'بنفسجي', bg: 'bg-purple-600', text: 'text-purple-600', light: 'bg-purple-50', gradient: 'from-purple-600 to-indigo-600' },
    { id: 'blue', name: 'أزرق', bg: 'bg-blue-600', text: 'text-blue-600', light: 'bg-blue-50', gradient: 'from-blue-600 to-cyan-600' },
    { id: 'emerald', name: 'زمردي', bg: 'bg-emerald-600', text: 'text-emerald-600', light: 'bg-emerald-50', gradient: 'from-emerald-600 to-teal-600' },
    { id: 'rose', name: 'وردي', bg: 'bg-rose-600', text: 'text-rose-600', light: 'bg-rose-50', gradient: 'from-rose-600 to-pink-600' },
    { id: 'amber', name: 'كهرماني', bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50', gradient: 'from-amber-500 to-orange-500' },
];

export default function SupervisorDashboard() {
    const { user, signOut } = useAuth();
    const queryClient = useQueryClient();
    
    // States
    const [activeTab, setActiveTab] = useState('home');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeTheme, setActiveTheme] = useState(THEMES[0]);
    const [showThemeSelector, setShowThemeSelector] = useState(false);
    
    // Modal الاستكمال
    const [showCompletionModal, setShowCompletionModal] = useState(false);
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

    // إظهار نافذة الاستكمال
    useEffect(() => {
        if (supervisor && !supervisor.profile_completed) setShowCompletionModal(true);
    }, [supervisor]);

    // قراءة التبويب من الرابط (للإشعارات)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (tabParam) {
            setActiveTab(tabParam); 
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    // 2. تحديث بيانات المشرف وإضافة النقاط
    const completeProfileMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            if (!user?.id) throw new Error("User not found");
            const newPoints = (supervisor?.total_points || 0) + 150;

            const { error } = await supabase.from('supervisors').update({
                ...data, profile_completed: true, total_points: newPoints
            }).eq('id', user.id);
            if (error) throw error;

            await supabase.from('points_ledger').insert({
                employee_id: user.id, points: 150, reason: 'هدية ترحيبية + استكمال الملف الشخصي 🎉'
            });
        },
        onSuccess: () => {
            toast.success('تم استكمال الملف بنجاح! حصلت على 150 نقطة 🎁', { duration: 5000 });
            setShowCompletionModal(false);
            queryClient.invalidateQueries({ queryKey: ['current_supervisor'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    // --- الحيلة الذكية: Data Adapter ---
    const mockEmployee = useMemo(() => {
        if (!supervisor) return null;
        return {
            id: supervisor.id,
            employee_id: supervisor.id,
            name: supervisor.name,
            specialty: supervisor.role_title,
            photo_url: '', 
            total_points: supervisor.total_points,
            role: 'supervisor'
        } as any;
    }, [supervisor]);

    // حساب المستوى (Level)
    const level = Math.floor((supervisor?.total_points || 0) / 100) + 1;

    const swipeHandlers = useSwipeable({
        onSwipedLeft: (eventData) => { if (eventData.initial[0] > window.innerWidth / 2) setIsSidebarOpen(true); },
        onSwipedRight: () => setIsSidebarOpen(false),
        trackMouse: true, delta: 50,
    });

    // --- القوائم (الجانبية والسفلية) ---
    const menuItems = [
        { id: 'home', label: 'الرئيسية', icon: Home },
        { id: 'training', label: 'مركز التدريب', icon: BookOpen },
        { id: 'library', label: 'السياسات والأدلة', icon: LibraryIcon },
        { id: 'arcade', label: 'صالة الألعاب', icon: Gamepad2 },
        { id: 'schedule', label: 'النوبتجيات', icon: CalendarRange },
        { id: 'rewards', label: 'متجر الجوائز', icon: Gift },
        { id: 'statistics', label: 'إحصائيات العمل', icon: BarChart3 },
    ];

    const bottomNavItems = [
        { id: 'home', label: 'الرئيسية', icon: Home },
        { id: 'training', label: 'التدريب', icon: BookOpen },
        { id: 'arcade', label: 'الألعاب', icon: Gamepad2 },
        { id: 'rewards', label: 'الجوائز', icon: Gift },
        { id: 'statistics', label: 'إحصائيات', icon: BarChart3 },
    ];

    if (isLoading || !mockEmployee) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-10 h-10 animate-spin text-purple-600"/></div>;
    }

    return (
        <div {...swipeHandlers} className="h-screen w-full bg-gray-50 flex overflow-hidden font-sans text-right" dir="rtl">
            
            {/* --- القائمة الجانبية (Desktop) --- */}
            {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-[60] md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}
            <aside className={`fixed inset-y-0 right-0 z-[70] w-72 bg-white border-l shadow-2xl transform transition-transform duration-300 md:translate-x-0 md:static flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                <div className={`h-24 flex items-center justify-between px-6 border-b text-white bg-gradient-to-r ${activeTheme.gradient}`}>
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

                <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar pb-24 md:pb-4">
                    <div className="mb-4 px-2">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">القائمة الإشرافية</p>
                    </div>
                    {menuItems.map(item => {
                        const isActive = activeTab === item.id;
                        return (
                            <button 
                                key={item.id} 
                                onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} 
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all group
                                    ${isActive ? `${activeTheme.bg} text-white shadow-lg translate-x-[-5px]` : `text-gray-600 hover:${activeTheme.light} hover:${activeTheme.text}`}
                                `}
                            >
                                <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:'+activeTheme.text}`}/> 
                                <span className="text-sm">{item.label}</span>
                            </button>
                        );
                    })}
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
                <header className="h-20 bg-white border-b flex items-center justify-between px-4 md:px-6 shrink-0 shadow-sm z-30">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-gray-50 rounded-xl hover:bg-gray-100 border"><Menu className="w-6 h-6 text-gray-700"/></button>
                        
                        {/* محدد الثيمات */}
                        <div className="relative">
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
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="hidden md:flex items-center gap-1 bg-gray-100 px-3 py-1.5 rounded-xl border">
                            <ShieldCheck className="w-4 h-4 text-gray-500"/>
                            <span className="text-xs font-bold text-gray-700">مستوى المشرف: {level}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-yellow-50 px-3 py-1.5 rounded-xl border border-yellow-200">
                            <Sparkles className="w-4 h-4 text-yellow-500"/>
                            <span className="text-xs md:text-sm font-black text-yellow-700">{supervisor?.total_points || 0}</span>
                        </div>
                        <NotificationBell onNavigate={(tab) => setActiveTab(tab)} />
                    </div>
                </header>

                {/* منطقة العرض */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/50 custom-scrollbar pb-24 md:pb-6">
                    <div className="max-w-7xl mx-auto space-y-6">
                        
                        {/* رسالة الترحيب في الصفحة الرئيسية */}
                        {activeTab === 'home' && (
                            <div className={`bg-gradient-to-r ${activeTheme.gradient} rounded-[2rem] p-6 md:p-8 text-white shadow-lg relative overflow-hidden mb-6`}>
                                <div className="relative z-10">
                                    <h2 className="text-2xl md:text-3xl font-black mb-2 flex items-center gap-2">
                                        مرحباً بك، {supervisor?.name} 👋
                                    </h2>
                                    <p className="text-white/80 font-bold text-sm md:text-base">تصفح أحدث الأخبار والأنشطة الإشرافية في المركز.</p>
                                </div>
                                <ShieldCheck className="absolute -left-6 -bottom-6 w-40 h-40 text-white opacity-10 transform -rotate-12" />
                            </div>
                        )}

                        {/* استدعاء المكونات (مررنا mockEmployee كأنه الموظف) ✅ */}
                        {activeTab === 'home' && <StaffNewsFeed />}
                        {activeTab === 'training' && <StaffTrainingCenter employee={mockEmployee} />}
                        {activeTab === 'library' && <StaffLibrary />}
                        {activeTab === 'arcade' && <StaffArcade employee={mockEmployee} />}
                        {activeTab === 'schedule' && <EmployeeEveningSchedule />}
                        {activeTab === 'rewards' && <RewardsStore employee={mockEmployee} />}
                        {activeTab === 'statistics' && <StatisticsManager />}
                        
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
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">الرقم القومي (اختياري)</label>
                                <input type="text" maxLength={14} value={formData.national_id} onChange={e => setFormData({...formData, national_id: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-left focus:border-purple-500 outline-none transition-colors" dir="ltr" placeholder="14 رقم"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">تاريخ استلام العمل بالجهة</label>
                                <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-purple-500 outline-none transition-colors"/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">المؤهل الدراسي</label>
                                    <input type="text" value={formData.qualification} onChange={e => setFormData({...formData, qualification: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-purple-500 outline-none transition-colors"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">التخصص الدقيق</label>
                                    <input type="text" value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-purple-500 outline-none transition-colors"/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">دورات تدريبية حاصل عليها</label>
                                <input type="text" value={formData.training_courses} onChange={e => setFormData({...formData, training_courses: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-purple-500 outline-none transition-colors" placeholder="مثال: دورة مكافحة العدوى، جودة..."/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">ملاحظات أخرى</label>
                                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl resize-none h-20 focus:border-purple-500 outline-none transition-colors"></textarea>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3 relative z-10">
                            <button 
                                onClick={() => setShowCompletionModal(false)}
                                className="px-6 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                            >
                                تخطي مؤقتاً
                            </button>
                            <button 
                                onClick={() => completeProfileMutation.mutate(formData)}
                                disabled={completeProfileMutation.isPending}
                                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl font-black shadow-lg shadow-purple-200 hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                {completeProfileMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : 'حفظ واستلام الهدية 🎁'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
