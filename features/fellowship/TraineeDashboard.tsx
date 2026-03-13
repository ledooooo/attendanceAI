'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { useSwipeable } from 'react-swipeable';
import { useQuery } from '@tanstack/react-query';

import {
  LogOut, User, Clock, Menu, X, LayoutDashboard, Share2, Info,
  Bell, Trophy, Gamepad2, Sparkles, Calculator,
  GraduationCap, BookOpen, FileText, CheckCircle, DownloadCloud,
  Presentation, ChevronRight, Activity, Home, MoreHorizontal
} from 'lucide-react';

import StaffAttendance from '../staff/components/StaffAttendance';
import StaffNewsFeed from '../staff/components/StaffNewsFeed';
import EOMVotingCard from '../staff/components/EOMVotingCard';
import StaffArcade from '../staff/components/StaffArcade';
import DailyQuizModal from '../../components/gamification/DailyQuizModal';
import LeaderboardWidget from '../../components/gamification/LeaderboardWidget';
import LevelProgressBar from '../../components/gamification/LevelProgressBar';
import CalculatorsMenu from '../../calculators/CalculatorsMenu';
import ThemeOverlay from '../staff/components/ThemeOverlay';

import TraineeOverviewTab from './tabs/TraineeOverviewTab';
import TraineeLogbookTab from './tabs/TraineeLogbookTab';
import TraineePortfolioTab from './tabs/TraineePortfolioTab';
import TraineeDopsTab from './tabs/TraineeDopsTab';
import TraineeProfileTab from './tabs/TraineeProfileTab';
import TraineeLecturesTab from './tabs/TraineeLecturesTab';
import TraineeSkillsTab    from './tabs/TraineeSkillsTab';
import TraineeRotationsTab from './tabs/TraineeRotationsTab';
import TraineeTARTab       from './tabs/TraineeTARTab';
import TraineeExamsTab     from './tabs/TraineeExamsTab';

interface Props { employee: any; }

// ─── Tab label map ────────────────────────────────────────────────────────────
const TAB_LABELS: Record<string, string> = {
  overview: 'نظرة عامة', profile: 'الملف الأكاديمي', logbook: 'سجل الحالات',
  portfolio: 'ملف الإنجاز', dops: 'تقييم DOPS', lectures: 'المحاضرات',
  news: 'الأخبار', attendance: 'الحضور', arcade: 'صالة الألعاب', calculators: 'حاسبات طبية',
};

export default function TraineeDashboard({ employee }: Props) {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [prevTab, setPrevTab]   = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isScrolled, setIsScrolled]       = useState(false);
  const [showProfileMenu, setShowProfileMenu]       = useState(false);
  const [showLeaderboardMenu, setShowLeaderboardMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu]             = useState(false);
  const [isThemeEnabled, setIsThemeEnabled] = useState(true);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone]     = useState(false);
  const [tabKey, setTabKey] = useState(0); // force remount on tab change for animation
  const notifRef = useRef<HTMLDivElement>(null);

  // ── Notifications ──────────────────────────────────────────────────────────
  const { data: notifications = [] } = useQuery({
    queryKey: ['trainee_notifications', employee.employee_id],
    queryFn: async () => {
      const { data } = await supabase.from('notifications').select('*')
        .eq('user_id', employee.employee_id)
        .order('created_at', { ascending: false }).limit(20);
      return data || [];
    },
    refetchInterval: 30000,
  });
  const unreadCount = useMemo(() => notifications.filter((n: any) => !n.is_read).length, [notifications]);

  // ── Attendance ─────────────────────────────────────────────────────────────
  const { data: attendanceData = [] } = useQuery({
    queryKey: ['trainee_attendance', employee.employee_id],
    queryFn: async () => {
      const { data } = await supabase.from('attendance').select('*').eq('employee_id', employee.employee_id);
      return data || [];
    },
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // ── Click outside notif ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: any) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Swipe ──────────────────────────────────────────────────────────────────
  const swipeHandlers = useSwipeable({
    onSwipedLeft:  (e) => { if (e.initial[0] > window.innerWidth * 0.75) setIsSidebarOpen(true); },
    onSwipedRight: () => setIsSidebarOpen(false),
    trackMouse: true, delta: 50,
  });

  // ── PWA install ────────────────────────────────────────────────────────────
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
    const handler = (e: any) => {
      e.preventDefault(); setDeferredPrompt(e);
      if (!standalone) setTimeout(() => setShowInstallPopup(true), 3000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') { setDeferredPrompt(null); setShowInstallPopup(false); }
    }
  };

  // ── Tab switch ─────────────────────────────────────────────────────────────
  const switchTab = (id: string) => {
    if (id === activeTab) return;
    setPrevTab(activeTab);
    setActiveTab(id);
    setTabKey(k => k + 1);
    setIsSidebarOpen(false);
  };

  // ── Menu items ─────────────────────────────────────────────────────────────
  const menuItems = useMemo(() => [
    { id: 'divider1', label: '🎓 أكاديمية الزمالة', isHeader: true },
    { id: 'overview',   label: 'نظرة عامة',        icon: GraduationCap },
    { id: 'profile',    label: 'الملف الأكاديمي',  icon: User },
    { id: 'logbook',    label: 'سجل الحالات',       icon: BookOpen },
    { id: 'portfolio',  label: 'ملف الإنجاز',       icon: FileText },
    { id: 'dops',       label: 'تقييم DOPS',        icon: CheckCircle },
    { id: 'lectures',   label: 'المحاضرات العلمية', icon: Presentation },
    { id: 'skills',    label: 'المهارات السريرية', icon: Stethoscope },
    { id: 'rotations', label: 'جدول الدورات',      icon: MapPin      },
    { id: 'tar',       label: 'تقارير التقييم TAR', icon: ClipboardList },
    { id: 'exams',     label: 'الامتحانات',         icon: GraduationCap },
    { id: 'divider2', label: '🏥 الخدمات العامة', isHeader: true },
    { id: 'news',        label: 'الرئيسية والأخبار', icon: LayoutDashboard },
    { id: 'attendance',  label: 'سجل الحضور',        icon: Clock },
    { id: 'arcade',      label: 'صالة الألعاب',      icon: Gamepad2, isNew: true },
    { id: 'calculators', label: 'حاسبات طبية',       icon: Calculator },
  ], []);

  // ── Render tab ─────────────────────────────────────────────────────────────
  const renderTab = () => {
    switch (activeTab) {
      case 'overview':    return <TraineeOverviewTab  employeeId={employee.id} />;
      case 'profile':     return <TraineeProfileTab   employeeId={employee.id} />;
      case 'logbook':     return <TraineeLogbookTab   employeeId={employee.id} />;
      case 'portfolio':   return <TraineePortfolioTab employeeId={employee.id} />;
      case 'dops':        return <TraineeDopsTab      employeeId={employee.id} />;
      case 'lectures':    return <TraineeLecturesTab  employeeId={employee.id} />;
      case 'skills':    return <TraineeSkillsTab    employeeId={employee.id} />;
      case 'rotations': return <TraineeRotationsTab employeeId={employee.id} />;
      case 'tar':       return <TraineeTARTab       employeeId={employee.id} />;
      case 'exams':     return <TraineeExamsTab     employeeId={employee.id} />;
      case 'news':        return <div className="space-y-4"><EOMVotingCard employee={employee} /><StaffNewsFeed employee={employee} /></div>;
      case 'attendance':  return <StaffAttendance attendance={attendanceData} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} employee={employee} />;
      case 'arcade':      return <StaffArcade employee={employee} deepLinkRoomId={null} />;
      case 'calculators': return <CalculatorsMenu />;
      default:            return <TraineeOverviewTab employeeId={employee.id} />;
    }
  };

  const closeAll = () => { setShowProfileMenu(false); setShowLeaderboardMenu(false); setShowNotifMenu(false); };

  // ── first name ─────────────────────────────────────────────────────────────
  const firstName = employee?.name?.split(' ')[0] || '';

  return (
    <div {...swipeHandlers} className="min-h-screen w-full bg-[#f4f6fb] flex overflow-hidden font-sans text-right" dir="rtl">

      <DailyQuizModal employee={employee} />
      {isThemeEnabled && <ThemeOverlay employee={employee} />}

      {/* ─── PWA Banner ─────────────────────────────────────────────────── */}
      {!isStandalone && showInstallPopup && (
        <div className="fixed top-3 left-3 right-3 z-[200] max-w-lg mx-auto">
          <div className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between border border-white/20 animate-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl"><DownloadCloud className="w-5 h-5 animate-bounce" /></div>
              <div>
                <p className="text-xs font-black">ثبّت التطبيق</p>
                <p className="text-[10px] opacity-75">لتجربة أسرع وسهولة أكثر</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowInstallPopup(false)} className="text-[10px] font-bold px-2 py-1 hover:bg-white/10 rounded-lg">لاحقاً</button>
              <button onClick={handleInstall} className="bg-white text-emerald-600 text-xs font-black px-4 py-2 rounded-xl active:scale-95 transition-transform shadow-sm">تثبيت</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Sidebar Overlay ────────────────────────────────────────────── */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ─── Sidebar ────────────────────────────────────────────────────── */}
      <aside className={`
        fixed inset-y-0 right-0 z-[70] w-[82vw] max-w-[290px] flex flex-col
        bg-white border-l border-gray-100 shadow-2xl
        transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
        md:translate-x-0 md:static md:w-64 md:shadow-none h-[100dvh]
      `}>
        {/* Logo */}
        <div className="h-[68px] flex items-center justify-between px-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-gray-800 text-sm leading-tight">برنامج الزمالة</h1>
              <p className="text-[10px] text-gray-400 font-semibold">بوابة المتدربين</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Trainee mini-card */}
        <div className="mx-3 mt-3 p-3 bg-gradient-to-l from-indigo-50 to-violet-50 rounded-2xl border border-indigo-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm overflow-hidden shadow">
            {employee?.photo_url
              ? <img src={employee.photo_url} className="w-full h-full object-cover" alt="" />
              : firstName.charAt(0)
            }
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-gray-800 truncate">د. {firstName}</p>
            <p className="text-[10px] font-bold text-indigo-500 truncate">{employee?.specialty}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5 mt-2 custom-scrollbar">
          {menuItems.map((item: any, i) => {
            if (item.isHeader) return (
              <p key={`h-${i}`} className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 pt-4 pb-1.5">
                {item.label}
              </p>
            );
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => switchTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative group text-sm
                  ${active
                    ? 'bg-indigo-600 text-white font-black shadow-md shadow-indigo-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-semibold'
                  }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-gray-400 group-hover:text-indigo-500'}`} />
                <span className="flex-1 text-right">{item.label}</span>
                {item.isNew && (
                  <span className="text-[9px] font-black bg-fuchsia-500 text-white px-1.5 py-0.5 rounded-full">NEW</span>
                )}
                {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
              </button>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-gray-100 shrink-0 space-y-1">
          <div className="flex gap-1">
            <button onClick={() => { try { navigator.share({ title: 'برنامج الزمالة', url: window.location.origin }); } catch {} }}
              className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-indigo-600 transition-colors">
              <Share2 className="w-4 h-4" />
              <span className="text-[9px] font-bold">مشاركة</span>
            </button>
            <button onClick={() => setShowAboutModal(true)}
              className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-orange-500 transition-colors">
              <Info className="w-4 h-4" />
              <span className="text-[9px] font-bold">حول</span>
            </button>
            <button onClick={() => setIsThemeEnabled(!isThemeEnabled)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-colors ${isThemeEnabled ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:bg-gray-50'}`}>
              <Sparkles className="w-4 h-4" />
              <span className="text-[9px] font-bold">الثيم</span>
            </button>
            <button onClick={signOut}
              className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
              <LogOut className="w-4 h-4" />
              <span className="text-[9px] font-bold">خروج</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 relative">

        {/* Header */}
        <header className={`h-[68px] bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30 shrink-0 transition-shadow duration-200 ${isScrolled ? 'shadow-md' : 'shadow-sm'}`}>
          {/* Left: menu + breadcrumb */}
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors border border-gray-100">
              <Menu className="w-4 h-4 text-gray-600" />
            </button>
            <div className="hidden md:flex items-center gap-1.5 text-sm">
              <span className="font-black text-gray-800">لوحة المتدرب</span>
              {activeTab !== 'overview' && (
                <>
                  <ChevronRight className="w-3 h-3 text-gray-300" />
                  <span className="font-semibold text-indigo-600">{TAB_LABELS[activeTab] || activeTab}</span>
                </>
              )}
            </div>
            <div className="md:hidden font-black text-gray-800 text-sm">{TAB_LABELS[activeTab] || 'لوحة المتدرب'}</div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5" ref={notifRef}>

            {/* Leaderboard */}
            <button onClick={() => { closeAll(); setShowLeaderboardMenu(v => !v); }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95
                ${showLeaderboardMenu ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-50 text-yellow-600 hover:bg-yellow-50 border border-gray-100'}`}>
              <Trophy className="w-4 h-4" />
            </button>

            {/* Notifications */}
            <button onClick={() => { closeAll(); setShowNotifMenu(v => !v); }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center relative transition-all hover:scale-105 active:scale-95
                ${showNotifMenu ? 'bg-gray-100 text-gray-800' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100'}`}>
              <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'text-indigo-600' : ''}`} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-bounce shadow">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Avatar */}
            <button onClick={() => { closeAll(); setShowProfileMenu(v => !v); }}
              className="w-9 h-9 rounded-xl border-2 border-indigo-100 overflow-hidden hover:scale-105 transition-transform active:scale-95 bg-indigo-50 flex items-center justify-center text-indigo-700 font-black text-sm">
              {employee?.photo_url
                ? <img src={employee.photo_url} className="w-full h-full object-cover" alt="" />
                : firstName.charAt(0)
              }
            </button>
          </div>
        </header>

        {/* Content */}
        <main
          onScroll={(e) => setIsScrolled(e.currentTarget.scrollTop > 30)}
          className="flex-1 overflow-y-auto pb-24 md:pb-6 custom-scrollbar bg-[#f4f6fb]"
        >
          <div className="max-w-6xl mx-auto p-3 md:p-5">
            <div
              key={tabKey}
              className="bg-white rounded-3xl shadow-sm border border-gray-100/80 min-h-[500px] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              {renderTab()}
            </div>
          </div>
        </main>

        {/* ─── Mobile Bottom Nav ───────────────────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-100 px-2 py-2 flex justify-around items-center z-50 pb-safe shadow-[0_-1px_20px_rgba(0,0,0,0.05)]">
          <MobileNavItem icon={Home}         label="الرئيسية"   active={activeTab === 'overview'}  onClick={() => switchTab('overview')} />
          <MobileNavItem icon={BookOpen}     label="سجلاتي"    active={activeTab === 'logbook'}   onClick={() => switchTab('logbook')} />

          {/* FAB center */}
          <button onClick={() => switchTab('arcade')}
            className={`relative -top-4 w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl border-4 border-[#f4f6fb] transition-all active:scale-95
              ${activeTab === 'arcade' ? 'bg-indigo-700' : 'bg-indigo-600'} text-white`}>
            <Gamepad2 className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 text-[8px] font-black bg-fuchsia-500 text-white px-1 py-0.5 rounded-full">HOT</span>
          </button>

          <MobileNavItem icon={Clock}        label="حضوري"     active={activeTab === 'attendance'} onClick={() => switchTab('attendance')} />
          <MobileNavItem icon={MoreHorizontal} label="المزيد"  active={false}                      onClick={() => setIsSidebarOpen(true)} />
        </nav>
      </div>

      {/* ─── Modals ──────────────────────────────────────────────────────── */}

      {/* Notifications */}
      {showNotifMenu && (
        <Modal onClose={() => setShowNotifMenu(false)}>
          <ModalHeader icon={Bell} title="التنبيهات" iconColor="text-indigo-600" onClose={() => setShowNotifMenu(false)} />
          {notifications.length === 0 ? (
            <div className="p-10 text-center">
              <Bell className="w-12 h-12 mx-auto text-gray-100 mb-3" />
              <p className="text-sm font-black text-gray-400">لا توجد إشعارات حالياً</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-80 divide-y divide-gray-50">
              {notifications.map((n: any) => (
                <div key={n.id} className={`p-4 text-sm font-bold text-gray-700 ${!n.is_read ? 'bg-indigo-50/40' : ''}`}>
                  <p>{n.message || n.title}</p>
                  <p className="text-[10px] font-semibold text-gray-400 mt-1">{new Date(n.created_at).toLocaleDateString('ar-EG')}</p>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Profile */}
      {showProfileMenu && (
        <Modal onClose={() => setShowProfileMenu(false)}>
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 pb-5 relative text-white">
            <button onClick={() => setShowProfileMenu(false)} className="absolute top-4 left-4 w-8 h-8 bg-black/10 rounded-full flex items-center justify-center hover:bg-black/20">
              <X size={16} />
            </button>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-3xl font-black mb-3 overflow-hidden shadow-xl">
                {employee?.photo_url ? <img src={employee.photo_url} className="w-full h-full object-cover" alt="" /> : firstName.charAt(0)}
              </div>
              <h3 className="font-black text-lg">د. {employee?.name}</h3>
              <span className="mt-1 text-[11px] font-bold bg-white/15 px-3 py-1 rounded-full">متدرب زمالة · {employee?.specialty}</span>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <LevelProgressBar employee={employee} />
            </div>
            <button onClick={signOut}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-xl font-black text-sm hover:bg-red-100 transition-colors active:scale-[0.99]">
              <LogOut size={16} /> تسجيل الخروج
            </button>
          </div>
        </Modal>
      )}

      {/* Leaderboard */}
      {showLeaderboardMenu && (
        <Modal onClose={() => setShowLeaderboardMenu(false)}>
          <ModalHeader icon={Trophy} title="لوحة الشرف" iconColor="text-yellow-500" onClose={() => setShowLeaderboardMenu(false)} bg="bg-amber-50" />
          <div className="overflow-y-auto max-h-[70vh] p-2 custom-scrollbar">
            <LeaderboardWidget />
          </div>
        </Modal>
      )}

      {/* About */}
      {showAboutModal && (
        <Modal onClose={() => setShowAboutModal(false)}>
          <div className="p-8 text-center relative">
            <button onClick={() => setShowAboutModal(false)} className="absolute top-4 left-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200">
              <X size={15} />
            </button>
            <div className="w-20 h-20 bg-indigo-50 rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-indigo-100 rotate-3 hover:rotate-0 transition-transform duration-300">
              <img src="/pwa-192x192.png" className="w-14 h-14 rounded-xl" alt="Logo" />
            </div>
            <h2 className="text-xl font-black text-gray-800">برنامج الزمالة</h2>
            <p className="text-xs text-gray-400 font-bold mt-1 mb-4 tracking-widest uppercase">تطبيق إدارة المتدربين</p>
            <p className="text-xs font-semibold text-gray-500 leading-relaxed">
              منصة متكاملة لإدارة برنامج زمالة طب الأسرة، تشمل سجل الحالات، ملف الإنجاز، تقييمات DOPS، والمحاضرات العلمية.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Reusable Modal ────────────────────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ icon: Icon, title, iconColor, onClose, bg = 'bg-gray-50' }: any) {
  return (
    <div className={`p-4 border-b border-gray-100 flex items-center justify-between ${bg}`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${iconColor}`} />
        <h3 className="font-black text-gray-800 text-sm">{title}</h3>
      </div>
      <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 hover:text-red-500 text-gray-400 transition-colors">
        <X size={16} />
      </button>
    </div>
  );
}

// ─── Mobile Nav Item ───────────────────────────────────────────────────────────
function MobileNavItem({ icon: Icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-0.5 transition-all w-12 ${active ? 'text-indigo-600' : 'text-gray-400'}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-indigo-50' : ''}`}>
        <Icon className={`w-5 h-5 ${active ? 'fill-current' : ''}`} />
      </div>
      <span className="text-[9px] font-bold leading-none">{label}</span>
    </button>
  );
}
