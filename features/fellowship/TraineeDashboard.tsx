'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { useSwipeable } from 'react-swipeable';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { 
  LogOut, User, Clock, Menu, X, LayoutDashboard, Share2, Info, 
  Bell, Settings, Trophy, Gamepad2, Sparkles, BellRing, Calculator, 
  GraduationCap, BookOpen, FileText, CheckCircle, DownloadCloud
} from 'lucide-react';

// استيراد المكونات الفرعية (من Staff & Admin & Gamification)
import StaffAttendance from '../staff/components/StaffAttendance';
import StaffNewsFeed from '../staff/components/StaffNewsFeed';
import EOMVotingCard from '../staff/components/EOMVotingCard';
import StaffArcade from '../staff/components/StaffArcade';
import DailyQuizModal from '../../components/gamification/DailyQuizModal';
import LeaderboardWidget from '../../components/gamification/LeaderboardWidget';
import LevelProgressBar from '../../components/gamification/LevelProgressBar';
import CalculatorsMenu from '../../calculators/CalculatorsMenu';
import ThemeOverlay from '../staff/components/ThemeOverlay';
import TraineeProfileTab from './tabs/TraineeProfileTab';
import TraineeLecturesTab from './tabs/TraineeLecturesTab';
// استيراد تبويبات الزمالة (التي برمجناها)
import TraineeOverviewTab from './tabs/TraineeOverviewTab';
import TraineeLogbookTab from './tabs/TraineeLogbookTab';
import TraineePortfolioTab from './tabs/TraineePortfolioTab';
import TraineeDopsTab from './tabs/TraineeDopsTab';

interface Props {
  employee: any;
}

export default function TraineeDashboard({ employee }: Props) {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // States للقوائم العلوية
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLeaderboardMenu, setShowLeaderboardMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  
  const [isThemeEnabled, setIsThemeEnabled] = useState(true);

  // States للتطبيق والتثبيت
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  // 🌟 جلب الإشعارات
  const { data: notifications = [] } = useQuery({
      queryKey: ['trainee_notifications', employee.id],
      queryFn: async () => {
          const { data } = await supabase.from('notifications').select('*').eq('user_id', employee.id).order('created_at', { ascending: false }).limit(20);
          return data || [];
      },
      refetchInterval: 30000
  });

  const unreadNotifsCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  // 🌟 إغلاق القوائم عند النقر خارجها
  useEffect(() => {
      function handleClickOutside(event: any) {
          if (notifRef.current && !notifRef.current.contains(event.target)) setShowNotifMenu(false);
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifRef]);

  // 🌟 Swipe لفتح القائمة الجانبية في الموبايل
  const swipeHandlers = useSwipeable({
    onSwipedLeft: (eventData) => { if (eventData.initial[0] > window.innerWidth * 0.75) setIsSidebarOpen(true); },
    onSwipedRight: () => setIsSidebarOpen(false),
    trackMouse: true, delta: 50,
  });

  // 🌟 التحقق من تثبيت التطبيق
  useEffect(() => {
    const checkStandalone = () => { setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true); };
    checkStandalone();
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); if (!isStandalone) setTimeout(() => setShowInstallPopup(true), 3000); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isStandalone]);

  const handleInstallClick = async () => {
    if (deferredPrompt) { deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; if (outcome === 'accepted') { setDeferredPrompt(null); setShowInstallPopup(false); } }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const scrollTop = e.currentTarget.scrollTop;
      setIsScrolled(scrollTop > 40);
  };

  // تعريف القائمة الجانبية (مقسمة لأكاديمي وعام)
  const menuItems = useMemo(() => [
    { id: 'divider1', label: 'أكاديمية الزمالة', isHeader: true },
    { id: 'overview', label: 'نظرة عامة', icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'logbook', label: 'سجل الحالات', icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'portfolio', label: 'ملف الإنجاز', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'dops', label: 'تقييم DOPS', icon: CheckCircle, color: 'text-purple-600', bg: 'bg-purple-50' },
    { id: 'profile', label: 'الملف الأكاديمي', icon: User, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'lectures', label: 'المحاضرات العلمية', icon: Presentation, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'divider2', label: 'الخدمات العامة', isHeader: true },
    { id: 'news', label: 'الرئيسية والأخبار', icon: LayoutDashboard, color: 'text-gray-600', bg: 'bg-gray-50' },
    { id: 'attendance', label: 'سجل الحضور', icon: Clock, color: 'text-rose-600', bg: 'bg-rose-50' },
    { id: 'arcade', label: 'صالة الألعاب', icon: Gamepad2, color: 'text-orange-600', bg: 'bg-orange-50', isNew: true },
    { id: 'calculators', label: 'حاسبات طبية', icon: Calculator, color: 'text-teal-600', bg: 'bg-teal-50' },
  ], []);

  // دالة عرض المحتوى
  const renderActiveTabContent = () => {
    switch (activeTab) {
      // تبويبات الزمالة
      case 'overview': return <TraineeOverviewTab employeeId={employee?.id} />;
      case 'logbook': return <TraineeLogbookTab employeeId={employee?.id} />;
      case 'portfolio': return <TraineePortfolioTab employeeId={employee?.id} />;
      case 'dops': return <TraineeDopsTab employeeId={employee?.id} />;
      
      // التبويبات العامة (بنفس تصميم StaffDashboard)
      case 'news': return <div className="space-y-4"><EOMVotingCard employee={employee} /><StaffNewsFeed employee={employee} /></div>;
      case 'attendance': return <StaffAttendance attendance={[]} selectedMonth={new Date().toISOString().slice(0, 7)} setSelectedMonth={()=>{}} employee={employee} />;
      case 'arcade': return <StaffArcade employee={employee} deepLinkRoomId={null} />;
      case 'calculators': return <CalculatorsMenu />;
      
      default: return <TraineeOverviewTab employeeId={employee?.id} />;
    }
  };

  return (
    <div {...swipeHandlers} className="min-h-screen w-full bg-gray-50 flex overflow-visible font-sans text-right" dir="rtl">
      
      <DailyQuizModal employee={employee} />
      {isThemeEnabled && <ThemeOverlay employee={employee} />}

      {/* رسالة تثبيت التطبيق */}
      <div className="fixed top-0 left-0 right-0 z-[60] flex flex-col gap-2 p-2 md:px-6 pointer-events-none">
          {!isStandalone && showInstallPopup && (
            <div className="pointer-events-auto w-full max-w-xl mx-auto bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-3 rounded-2xl shadow-xl flex items-center justify-between animate-in slide-in-from-top-10 duration-500 border border-white/20">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-xl"><DownloadCloud className="w-5 h-5 animate-bounce" /></div>
                    <div><p className="text-xs font-black">ثبّت تطبيق غرب المطار</p><p className="text-[10px] opacity-80">لتجربة أسرع وسهولة في الوصول للخدمات</p></div>
                </div>
                <div className="flex gap-2 shrink-0">
                    <button onClick={() => setShowInstallPopup(false)} className="text-[10px] font-bold px-2 py-1 hover:bg-white/10 rounded-lg">لاحقاً</button>
                    <button onClick={handleInstallClick} className="bg-white text-emerald-600 text-xs font-black px-4 py-2 rounded-xl shadow-sm active:scale-95 transition-transform">تثبيت</button>
                </div>
            </div>
          )}
      </div>

      {/* خلفية القائمة الجانبية للموبايل */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-[60] md:hidden backdrop-blur-sm transition-opacity duration-300" onClick={() => setIsSidebarOpen(false)} />}

      {/* القائمة الجانبية (Sidebar) */}
      <aside className={`
          fixed inset-y-0 right-0 z-[70] w-[85vw] max-w-[300px] bg-white border-l shadow-2xl 
          transform transition-transform duration-300 ease-in-out flex flex-col 
          ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} 
          md:translate-x-0 md:static md:w-72 md:shadow-none h-[100dvh]
      `}>
        <div className="h-20 flex items-center justify-between px-6 border-b shrink-0 bg-gradient-to-r from-indigo-50 to-white">
            <div className="flex items-center gap-3">
                <div className="bg-white p-1.5 rounded-xl shadow-sm border border-indigo-100">
                    <GraduationCap className="w-8 h-8 text-indigo-600" />
                </div>
                <div>
                    <h1 className="font-black text-gray-800 text-base">برنامج الزمالة</h1>
                    <p className="text-[10px] text-gray-500 font-bold">بوابة المتدربين</p>
                </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><X className="w-6 h-6"/></button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2 custom-scrollbar pb-safe">
          {menuItems.map((item: any, index) => {
            if (item.isHeader) return <h3 key={`hdr-${index}`} className="text-xs font-black text-gray-400 mt-4 mb-2 px-2">{item.label}</h3>;
            
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                className={`
                    w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 group relative
                    ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 font-bold translate-x-[-5px]' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 font-medium'}
                `}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-indigo-600'}`} />
                <span className="text-sm">{item.label}</span>
                {item.isNew && <span className="absolute left-4 bg-fuchsia-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse border border-white shadow-md">NEW!</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t bg-gray-50 flex items-center justify-between shrink-0 pb-safe gap-1">
            <button onClick={() => { try { navigator.share({ title: 'غرب المطار', url: window.location.origin }) }catch(e){} }} className="flex-1 p-2 rounded-xl text-gray-500 hover:bg-indigo-100 hover:text-indigo-600 transition-colors flex flex-col items-center gap-1"><Share2 className="w-5 h-5" /><span className="text-[9px] font-bold">مشاركة</span></button>
            <button onClick={() => setShowAboutModal(true)} className="flex-1 p-2 rounded-xl text-gray-500 hover:bg-orange-100 hover:text-orange-600 transition-colors flex flex-col items-center gap-1"><Info className="w-5 h-5" /><span className="text-[9px] font-bold">حول</span></button>
            <button onClick={() => setIsThemeEnabled(!isThemeEnabled)} className={`flex-1 p-2 rounded-xl transition-colors flex flex-col items-center gap-1 ${isThemeEnabled ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:bg-gray-100'}`}><Sparkles className="w-5 h-5" /><span className="text-[9px] font-bold">الثيم</span></button>
            <button onClick={signOut} className="flex-1 p-2 rounded-xl text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors flex flex-col items-center gap-1"><LogOut className="w-5 h-5" /><span className="text-[9px] font-bold">خروج</span></button>
        </div>
      </aside>

      {/* المحتوى الرئيسي */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-100/50 relative">
        <header className={`h-16 bg-white border-b flex items-center justify-between px-3 md:px-6 sticky top-0 z-30 transition-shadow duration-300 shrink-0 ${isScrolled ? 'shadow-md' : 'shadow-sm'}`}>
            <div className="flex items-center gap-2 md:gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all"><Menu className="w-5 h-5 text-gray-700"/></button>
                <span className="font-black text-gray-800 hidden md:block">لوحة المتدرب</span>
            </div>

            <div className="flex items-center justify-end gap-1.5 md:gap-2 mr-auto" ref={notifRef}>
                <button onClick={() => { setShowLeaderboardMenu(!showLeaderboardMenu); setShowProfileMenu(false); setShowNotifMenu(false); }} className={`p-2 rounded-xl transition-transform duration-200 hover:scale-105 active:scale-95 ${showLeaderboardMenu ? 'bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-700 shadow-sm' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'}`}>
                    <Trophy className="w-4 h-4 md:w-5 md:h-5" />
                </button>

                <button onClick={() => { setShowNotifMenu(!showNotifMenu); setShowProfileMenu(false); setShowLeaderboardMenu(false); }} className={`p-2 rounded-xl transition-transform duration-200 hover:scale-105 active:scale-95 relative ${showNotifMenu ? 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-800 shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                    <Bell className={`w-4 h-4 md:w-5 md:h-5 ${unreadNotifsCount > 0 ? 'text-indigo-600 animate-pulse' : ''}`} />
                    {unreadNotifsCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] md:text-[10px] font-black w-4 h-4 flex items-center justify-center rounded-full animate-bounce shadow-md">{unreadNotifsCount}</span>}
                </button>
                
                <button onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifMenu(false); setShowLeaderboardMenu(false); }} className="w-8 h-8 md:w-9 md:h-9 rounded-full border-2 border-indigo-100 p-0.5 overflow-hidden ml-1 hover:scale-105 transition-transform active:scale-95 outline-none focus:ring-2 focus:ring-indigo-400 bg-indigo-50">
                    {employee?.photo_url ? <img src={employee.photo_url} className="w-full h-full object-cover rounded-full" alt="Profile" /> : <div className="w-full h-full flex items-center justify-center rounded-full text-indigo-700 font-black text-xs md:text-sm">{employee?.name?.charAt(0)}</div>}
                </button>
            </div>
        </header>

        <main onScroll={handleScroll} className="flex-1 overflow-y-auto p-2 md:p-4 custom-scrollbar pb-24 relative">
            <div className="max-w-6xl mx-auto space-y-4">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-200/60 p-3 md:p-6 min-h-[500px]">
                    {renderActiveTabContent()}
                </div>
            </div>
        </main>

        {/* شريط التنقل السفلي للموبايل (Bottom Navbar) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-1.5 flex justify-between items-center z-50 pb-safe shadow-[0_-4px_15px_rgba(0,0,0,0.03)]">
            <MobileNavItem icon={LayoutDashboard} label="الرئيسية" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
            <MobileNavItem icon={BookOpen} label="سجل الحالات" active={activeTab === 'logbook'} onClick={() => setActiveTab('logbook')} />
            
            <button onClick={() => setActiveTab('arcade')} className="relative -top-5 bg-indigo-600 text-white p-3.5 rounded-2xl shadow-lg shadow-indigo-200 border-4 border-gray-50 flex items-center justify-center transform active:scale-95 transition-transform">
                <Gamepad2 className="w-5 h-5" />
            </button>

            <MobileNavItem icon={Clock} label="حضوري" active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')} />
            <MobileNavItem icon={Menu} label="المزيد" active={false} onClick={() => setIsSidebarOpen(true)} />
        </div>

      </div>

      {/* --- القوائم المنبثقة (Modals) --- */}
      {showNotifMenu && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowNotifMenu(false)}>
              <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                      <h3 className="font-black text-gray-800 flex items-center gap-2"><Bell className="w-5 h-5 text-indigo-600"/> التنبيهات</h3>
                      <button onClick={()=>setShowNotifMenu(false)} className="p-1 bg-white rounded-full hover:bg-red-50 hover:text-red-500"><X size={18}/></button>
                  </div>
                  <div className="p-10 text-center text-gray-400 font-bold italic">لا توجد إشعارات حالياً ✨</div>
              </div>
          </div>
      )}

      {showProfileMenu && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowProfileMenu(false)}>
              <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="p-6 pb-4 bg-gradient-to-br from-indigo-500 to-purple-600 flex flex-col items-center relative text-white">
                      <button onClick={()=>setShowProfileMenu(false)} className="absolute top-4 right-4 p-1.5 bg-black/10 rounded-full hover:bg-black/20 text-white"><X size={18}/></button>
                      <div className="w-20 h-20 bg-white rounded-full border-4 border-indigo-100 shadow-md overflow-hidden mb-3 text-indigo-600 flex items-center justify-center text-3xl font-black">
                           {employee?.name?.charAt(0)}
                      </div>
                      <h3 className="font-black text-lg">{employee?.name}</h3>
                      <p className="text-xs text-indigo-50 font-bold mt-1 bg-black/10 px-3 py-1 rounded-full">متدرب زمالة - {employee?.specialty}</p>
                  </div>
                  <div className="p-5 pt-4 space-y-4">
                      <div className="bg-indigo-50/80 rounded-2xl p-4 border border-indigo-100 shadow-sm relative overflow-hidden"><LevelProgressBar employee={employee} /></div>
                      <button onClick={signOut} className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all active:scale-95 text-sm"><LogOut size={18}/> تسجيل خروج</button>
                  </div>
              </div>
          </div>
      )}

      {showLeaderboardMenu && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowLeaderboardMenu(false)}>
              <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b flex justify-between items-center bg-indigo-50">
                      <h3 className="font-black text-indigo-800 flex items-center gap-2 text-sm"><Trophy className="w-5 h-5 text-yellow-500"/> لوحة الشرف</h3>
                      <button onClick={()=>setShowLeaderboardMenu(false)} className="p-1 bg-white rounded-full hover:bg-red-50 hover:text-red-500 text-indigo-700"><X className="w-5 h-5"/></button>
                  </div>
                  <div className="overflow-y-auto custom-scrollbar flex-1 flex flex-col p-2">
                      <LeaderboardWidget />
                  </div>
              </div>
          </div>
      )}

      {showAboutModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm text-center relative animate-in zoom-in-95 shadow-2xl">
                  <button onClick={() => setShowAboutModal(false)} className="absolute top-4 right-4 p-2 bg-gray-50 rounded-full hover:bg-gray-100"><X size={16}/></button>
                  <div className="w-20 h-20 bg-indigo-100 rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-indigo-200 rotate-3 hover:rotate-0 transition-transform duration-300"><img src="/pwa-192x192.png" className="w-14 h-14 rounded-xl" alt="Logo" /></div>
                  <h2 className="text-xl font-black text-gray-800">برنامج الزمالة</h2>
                  <p className="text-xs text-gray-500 font-bold mb-6 tracking-widest uppercase">تطبيق إدارة المتدربين</p>
              </div>
        </div>
      )}

    </div>
  );
}

const MobileNavItem = ({ icon: Icon, label, active, onClick }: any) => (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-colors w-14 ${active ? 'text-indigo-600' : 'text-gray-400'}`}>
        <div className={`p-1 rounded-lg transition-all relative ${active ? 'bg-indigo-50' : ''}`}>
            <Icon className={`w-5 h-5 ${active ? 'fill-current' : ''}`} />
        </div>
        <span className="text-[9px] font-bold">{label}</span>
    </button>
);
