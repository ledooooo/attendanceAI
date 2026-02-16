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
    Calendar, Settings, ShoppingBag, Trophy, Star, Check, ShoppingCart, Gamepad2, Sparkles 
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

interface Props {
  employee: Employee;
}

export default function StaffDashboard({ employee }: Props) {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState('news');
  const [deepLinkTrainingId, setDeepLinkTrainingId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [ovrCount, setOvrCount] = useState(0);

  // حالات القوائم المنسدلة
  const [showLevelMenu, setShowLevelMenu] = useState(false);
  const [showLeaderboardMenu, setShowLeaderboardMenu] = useState(false);
  
  // ✅ حالة لتشغيل/إيقاف الثيم (المظهر)
  const [isThemeEnabled, setIsThemeEnabled] = useState(true);

  // حالة للتدريب الإجباري
  const [pendingMandatoryTraining, setPendingMandatoryTraining] = useState<any>(null);

  // ✅ تعديل: السماح بظهور لوحة الإدارة إذا كان أدمن أو لديه أي صلاحيات (بما فيها العهد)
  const hasAdminAccess = employee.role === 'admin' || (employee.permissions && employee.permissions.length > 0);
  
  // --- States ---
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  // PWA States
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // --- Effects ---
  useEffect(() => {
    if (employee?.employee_id) {
        requestNotificationPermission(employee.employee_id);
    }
  }, [employee.employee_id]);

  // قراءة الرابط عند تشغيل التطبيق
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const trainingIdParam = params.get('training_id');

    if (tabParam) {
        setActiveTab(tabParam); 
    }
    if (trainingIdParam) {
        setDeepLinkTrainingId(trainingIdParam); 
        window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);
  
  // منطق احتساب نقطة الزيارة اليومية
  useEffect(() => {
    const checkDailyVisitReward = async () => {
        const today = new Date().toISOString().split('T')[0];
        
        const { data: existing } = await supabase
            .from('daily_activities')
            .select('id')
            .eq('employee_id', employee.employee_id)
            .eq('activity_type', 'daily_login')
            .eq('activity_date', today)
            .maybeSingle();

        if (!existing) {
            await supabase.from('daily_activities').insert({
                employee_id: employee.employee_id,
                activity_type: 'daily_login',
                activity_date: today,
                is_completed: true
            });

            await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: 10 });
            
            await supabase.from('points_ledger').insert({
                employee_id: employee.employee_id,
                points: 10,
                reason: 'زيارة يومية للموقع 🚀'
            });

            toast.success('حصلت على 10 نقاط لزيارتك اليومية! ⭐', {
                icon: '👏',
                style: { borderRadius: '10px', background: '#333', color: '#fff' },
            });
            
            queryClient.invalidateQueries({ queryKey: ['admin_employees'] });
        }
    };

    checkDailyVisitReward();
  }, [employee.employee_id, queryClient]);

  // فحص التدريبات الإلزامية غير المكتملة
  useQuery({
    queryKey: ['check_mandatory_training', employee.employee_id],
    queryFn: async () => {
        const { data: mandatoryTrainings } = await supabase
            .from('trainings')
            .select('*')
            .eq('is_mandatory', true);

        if (!mandatoryTrainings || mandatoryTrainings.length === 0) return null;

        const { data: myCompleted } = await supabase
            .from('employee_trainings')
            .select('training_id')
            .eq('employee_id', employee.employee_id)
            .eq('status', 'completed');

        const completedIds = myCompleted?.map(c => c.training_id) || [];
        const pending = mandatoryTrainings.find(t => !completedIds.includes(t.id));

        if (pending) {
            setPendingMandatoryTraining(pending);
        }
        return pending;
    },
    enabled: !pendingMandatoryTraining,
    staleTime: 1000 * 60 * 5 
  });

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', employee.employee_id) 
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
  }, [employee.employee_id]);

  const markNotifsAsRead = useCallback(async () => {
    if (notifications.some(n => !n.is_read)) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', employee.employee_id);
      
      fetchNotifications();
      queryClient.invalidateQueries({ queryKey: ['staff_badges'] });
    }
    setShowNotifMenu(!showNotifMenu);
    setShowLevelMenu(false);
    setShowLeaderboardMenu(false);
  }, [notifications, employee.employee_id, showNotifMenu, fetchNotifications, queryClient]);

  // ✅ استعلام عدد طلبات الجوائز المعلقة (محسّن)
  const { data: pendingRewardsCount = 0 } = useQuery({
      queryKey: ['pending_rewards_count', employee.employee_id],
      queryFn: async () => {
          const { count } = await supabase
              .from('rewards_redemptions')
              .select('*', { count: 'exact', head: true })
              .eq('employee_id', employee.employee_id)
              .in('status', ['pending', 'قيد الانتظار', 'معلق', 'new']);

          return count || 0;
      },
      staleTime: 1000 * 45, // 45 ثانية
      refetchInterval: 45000, // كل 45 ثانية بدل 30
      refetchOnWindowFocus: false,
  });

  // استعلام العدادات المحسّن
  const { data: staffBadges = { messages: 0, tasks: 0, swaps: 0, news: 0, ovr_replies: 0, training: 0 } } = useQuery({
      queryKey: ['staff_badges', employee.employee_id],
      queryFn: async () => {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);

          // استخدام Promise.all للسرعة
          const [msg, tasks, swaps, news, ovrReplies, availableTrainings, myCompleted] = await Promise.all([
              supabase.from('messages').select('*', { count: 'exact', head: true }).eq('to_user', employee.employee_id).eq('is_read', false),
              supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('employee_id', employee.employee_id).eq('status', 'pending'),
              supabase.from('shift_swap_requests').select('*', { count: 'exact', head: true }).eq('target_employee_id', employee.employee_id).eq('status', 'pending_target'),
              supabase.from('news').select('*', { count: 'exact', head: true }).gte('created_at', yesterday.toISOString()),
              supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', employee.employee_id).eq('type', 'ovr_reply').eq('is_read', false),
              supabase.from('trainings').select('id, target_specialties'),
              supabase.from('employee_trainings').select('training_id').eq('employee_id', employee.employee_id).eq('status', 'completed')
          ]);

          const targetedTrainings = availableTrainings.data?.filter(t => 
             !t.target_specialties || 
             t.target_specialties.length === 0 || 
             t.target_specialties.includes(employee.specialty)
          ) || [];

          const completedIds = myCompleted.data?.map(c => c.training_id) || [];
          const pendingTrainingsCount = targetedTrainings.filter(t => !completedIds.includes(t.id)).length;

          return {
              messages: msg.count || 0,
              tasks: tasks.count || 0,
              swaps: swaps.count || 0,
              news: news.count || 0,
              ovr_replies: ovrReplies.count || 0,
              training: pendingTrainingsCount 
          };
      },
      staleTime: 1000 * 30, // 30 ثانية بدل 20 ثانية
      refetchInterval: 30000, // كل 30 ثانية
      refetchOnWindowFocus: false, // تقليل الطلبات غير الضرورية
  });

  const fetchAllData = async () => {
    try {
      const { data: att } = await supabase.from('attendance').select('*').eq('employee_id', employee.employee_id);
      const { data: reqs } = await supabase.from('leave_requests').select('*').eq('employee_id', employee.employee_id);
      const { data: evs } = await supabase.from('evaluations').select('*').eq('employee_id', employee.employee_id);

      if (att) setAttendanceData(att);
      if (reqs) setLeaveRequests(reqs);
      if (evs) setEvaluations(evs);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  useEffect(() => {
    fetchAllData();
    fetchNotifications();

    const channel = supabase.channel('staff_dashboard_updates')
      .on('postgres_changes', { 
        event: '*', schema: 'public', table: 'notifications', 
        filter: `user_id=eq.${employee.employee_id}` 
      }, (payload) => {
          fetchNotifications();
          queryClient.invalidateQueries({ queryKey: ['staff_badges'] });
          if (payload.eventType === 'INSERT') {
              const audio = new Audio('/notification.mp3'); 
              audio.play().catch(() => {}); 
          }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [employee.employee_id]);

  useEffect(() => {
    if (employee.role === 'quality_manager') {
        const checkNewReports = async () => {
            const { count } = await supabase.from('ovr_reports').select('*', { count: 'exact', head: true }).eq('status', 'new');
            setOvrCount(count || 0);
        };
        checkNewReports();
    }
  }, [employee.role]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: (eventData) => { 
        if (eventData.initial[0] > window.innerWidth * 0.75) {
            setIsSidebarOpen(true); 
        }
    },
    onSwipedRight: () => setIsSidebarOpen(false),
    trackMouse: true, delta: 50,
  });

  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
    };
    checkStandalone();
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); if (!isStandalone) setTimeout(() => setShowInstallPopup(true), 3000); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isStandalone]);

  const handleInstallClick = async () => {
    if (deferredPrompt) { deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; if (outcome === 'accepted') { setDeferredPrompt(null); setShowInstallPopup(false); } }
  };
  const handleShareApp = async () => { try { if (navigator.share) await navigator.share({ title: 'غرب المطار', url: window.location.origin }); else { navigator.clipboard.writeText(window.location.origin); alert('تم النسخ'); } } catch (err) { console.error(err); } };

  // ✅ ترتيب القائمة وتعيين البادجات (محسّن بـ useMemo)
  const menuItems = useMemo(() => [
    { id: 'news', label: 'الرئيسية', icon: LayoutDashboard, badge: staffBadges.news },
    { id: 'profile', label: 'الملف الشخصي', icon: User },
    ...(hasAdminAccess ? [{ id: 'admin', label: 'لوحة الإدارة', icon: Settings }] : []),
    { id: 'tasks', label: 'التكليفات', icon: ListTodo, badge: staffBadges.tasks },
    { id: 'shift-requests', label: 'طلبات التبديل', icon: ArrowLeftRight, badge: staffBadges.swaps },
    { id: 'messages', label: 'الرسائل', icon: Inbox, badge: staffBadges.messages },
    { id: 'ovr', label: 'إبلاغ OVR', icon: AlertTriangle, badge: staffBadges.ovr_replies },
    { id: 'training', label: 'مركز التدريب', icon: BookOpen, badge: staffBadges.training }, 
    { id: 'library', label: 'المكتبة والسياسات', icon: BookOpen },
    ...(employee.role === 'quality_manager' ? [{ id: 'quality-manager-tab', label: 'مسؤول الجودة', icon: ShieldCheck, badge: ovrCount }] : []),
    { id: 'attendance', label: 'سجل الحضور', icon: Clock },
    { id: 'arcade', label: 'صالة الألعاب', icon: Gamepad2, isNew: true },
    { id: 'evening-schedule', label: 'النوبتجيات المسائية', icon: Moon },
    { id: 'store', label: 'متجر الجوائز', icon: ShoppingBag },
    ...(employee.role === 'head_of_dept' ? [{ id: 'dept-requests', label: 'إدارة القسم', icon: FileText }] : []),
    { id: 'stats', label: 'الإحصائيات', icon: BarChart },
    { id: 'new-request', label: 'تقديم طلب', icon: FilePlus },
    { id: 'requests-history', label: 'سجل الطلبات', icon: List },
    { id: 'templates', label: 'نماذج رسمية', icon: Printer },
    { id: 'links', label: 'روابط هامة', icon: LinkIcon },
    { id: 'evaluations', label: 'التقييمات', icon: Award },
  ], [staffBadges, hasAdminAccess, employee.role, ovrCount]);

  const unreadNotifsCount = useMemo(() => 
    notifications.filter(n => !n.is_read).length, 
    [notifications]
  );

  return (
    <div {...swipeHandlers} className="h-screen w-full bg-gray-50 flex overflow-hidden font-sans text-right" dir="rtl">
      
      {/* مكون تحدي اليوم */}
      <DailyQuizModal employee={employee} />
      
      {/* ✅ إظهار مكون الثيم فقط إذا كان isThemeEnabled مفعل */}
      {isThemeEnabled && <ThemeOverlay employee={employee} />}

      {/* مكون التدريب الإجباري */}
      {pendingMandatoryTraining && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border-4 border-red-500 relative animate-in zoom-in-95">
                <div className="bg-red-500 text-white p-6 text-center">
                    <AlertTriangle className="w-16 h-16 mx-auto mb-3 text-yellow-300 animate-bounce" />
                    <h2 className="text-2xl font-black">تنبيه هام: تدريب إلزامي</h2>
                    <p className="text-sm font-bold opacity-90 mt-1">يوجد تدريب جديد يجب عليك إتمامه للمتابعة</p>
                </div>
                <div className="p-8 text-center space-y-6">
                    <div>
                        <h3 className="text-2xl font-black text-gray-800 mb-2">{pendingMandatoryTraining.title}</h3>
                        <div className="flex justify-center gap-4 text-sm text-gray-500 font-bold">
                            <span>📍 {pendingMandatoryTraining.type === 'online' ? 'Online' : pendingMandatoryTraining.location}</span>
                            <span className="text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-lg border border-yellow-100">⭐ {pendingMandatoryTraining.points} نقطة</span>
                        </div>
                    </div>
                    <p className="text-gray-600 text-sm bg-gray-50 p-4 rounded-xl border leading-relaxed">
                        هذا التدريب مطلوب من قبل إدارة المركز لضمان الجودة والسلامة المهنية. <br/>
                        لن تتمكن من استخدام التطبيق قبل مشاهدة المحتوى وتسجيل الإتمام.
                    </p>
                    <button 
                        onClick={() => {
                            setPendingMandatoryTraining(null); 
                            setActiveTab('training'); 
                        }}
                        className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-red-700 shadow-lg shadow-red-200 transition-transform active:scale-95 flex items-center justify-center gap-2"
                    >
                        الذهاب للتدريب الآن 🚀
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- تظليل الخلفية عند فتح القائمة --- */}
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
        <div className="h-20 flex items-center justify-between px-6 border-b shrink-0 bg-gradient-to-r from-emerald-50 to-white">
            <div className="flex items-center gap-3">
                <div className="bg-white p-1.5 rounded-xl shadow-sm border border-emerald-100">
                    <img src="/pwa-192x192.png" className="w-8 h-8 rounded-lg" alt="Logo" />
                </div>
                <div>
                    <h1 className="font-black text-gray-800 text-base">غرب المطار</h1>
                    <p className="text-[10px] text-gray-500 font-bold">بوابة الموظفين</p>
                </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                <X className="w-6 h-6"/>
            </button>
        </div>

        {/* عناصر القائمة (Scrollable) */}
{/* عناصر القائمة (Scrollable) */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2 custom-scrollbar pb-safe">
          {menuItems.map((item: any) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                className={`
                    w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 group relative
                    ${isActive 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 font-bold translate-x-[-5px]' 
                        : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 font-medium'
                    }
                `}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-emerald-600'}`} />
                <span className="text-sm">{item.label}</span>
                
                {/* ✅ الكود الخاص بكلمة NEW أو البادجات الرقمية */}
                {item.isNew && (
                    <span className="absolute left-4 bg-fuchsia-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse border border-white shadow-md">
                        NEW!
                    </span>
                )}
                
                {typeof item.badge !== 'undefined' && !item.isNew && (
                    item.badge > 0 ? (
                        <span className="absolute left-4 min-w-[20px] h-5 bg-gradient-to-tr from-rose-500 to-red-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full shadow-md border-[1.5px] border-white animate-pulse">
                            {item.badge > 99 ? '+99' : item.badge}
                        </span>
                    ) : (
                        <span className="absolute left-4 min-w-[20px] h-5 bg-gradient-to-tr from-emerald-400 to-green-500 text-white flex items-center justify-center rounded-full shadow-sm border-[1.5px] border-white">
                            <Check size={12} strokeWidth={3} />
                        </span>
                    )
                )}
              </button>
            );
          })}
          <div className="h-4 md:h-0"></div>
        </nav>

        {/* Footer القائمة */}
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
      <div className="flex-1 flex flex-col min-w-0 bg-gray-100/50 relative">
        <header className="h-16 bg-white border-b flex items-center justify-between px-3 md:px-6 sticky top-0 z-30 shadow-sm shrink-0 backdrop-blur-sm bg-white/95">
            <div className="flex items-center gap-2 md:gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl hover:from-gray-100 hover:to-gray-200 transition-all active:scale-95 shadow-sm">
                    <Menu className="w-5 h-5 text-gray-700"/>
                </button>
                <span className="font-black text-gray-800 hidden md:block">لوحة التحكم</span>
            </div>

            <div className="flex items-center gap-1 md:gap-2">
                
                {/* 1. تبديل المظهر (الثيم) - محسّن */}
                <div className="relative group">
                    <button 
                        onClick={() => setIsThemeEnabled(!isThemeEnabled)} 
                        className={`p-2 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 ${isThemeEnabled ? 'bg-gradient-to-br from-purple-100 to-purple-200 text-purple-700 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        title={isThemeEnabled ? "إيقاف المظهر الحالي" : "تشغيل المظهر"}
                    >
                        <Sparkles className={`w-4 h-4 md:w-5 md:h-5 ${isThemeEnabled ? 'animate-pulse' : ''}`} />
                    </button>
                    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {isThemeEnabled ? "إيقاف المظهر" : "تشغيل المظهر"}
                    </span>
                </div>

                {/* ✅ 2. متجر الجوائز السريع (مع تنبيه الطلبات المعلقة) - محسّن */}
                <div className="relative group">
                    <button 
                        onClick={() => setActiveTab('store')} 
                        className={`p-2 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 relative ${activeTab === 'store' ? 'bg-gradient-to-br from-pink-100 to-pink-200 text-pink-700 shadow-sm' : 'bg-pink-50 text-pink-600 hover:bg-pink-100'}`}
                        title="متجر الجوائز"
                    >
                        <ShoppingCart className="w-4 h-4 md:w-5 md:h-5" />
                        {/* إظهار نقطة حمراء نابضة برقم الطلبات */}
                        {pendingRewardsCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-gradient-to-br from-red-500 to-red-600 text-white text-[9px] md:text-[10px] font-black w-4 h-4 md:w-5 md:h-5 flex items-center justify-center rounded-full border-2 border-white animate-bounce shadow-lg">
                                {pendingRewardsCount}
                            </span>
                        )}
                    </button>
                    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        متجر الجوائز
                    </span>
                </div>

                {/* 3. المستوى - محسّن */}
                <div className="relative group">
                    <button 
                        onClick={() => { setShowLevelMenu(!showLevelMenu); setShowLeaderboardMenu(false); setShowNotifMenu(false); }} 
                        className={`p-2 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 ${showLevelMenu ? 'bg-gradient-to-br from-indigo-100 to-indigo-200 text-indigo-700 shadow-sm' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                    >
                        <Star className={`w-4 h-4 md:w-5 md:h-5 ${showLevelMenu ? 'animate-spin' : ''}`} style={{ animationDuration: '2s' }} />
                    </button>
                    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        مستواك
                    </span>
                    {showLevelMenu && (
                        <>
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm md:hidden animate-in fade-in duration-200" onClick={() => setShowLevelMenu(false)}>
                                <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-1 overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                                    <LevelProgressBar employee={employee} />
                                </div>
                            </div>
                            <div className="hidden md:block absolute left-0 top-full mt-2 w-80 z-50 bg-white rounded-3xl shadow-xl border border-gray-100 animate-in slide-in-from-top-2 duration-200 overflow-hidden">
                                <LevelProgressBar employee={employee} />
                            </div>
                        </>
                    )}
                </div>

                {/* 4. لوحة الشرف - محسّن */}
                <div className="relative group">
                    <button 
                        onClick={() => { setShowLeaderboardMenu(!showLeaderboardMenu); setShowLevelMenu(false); setShowNotifMenu(false); }} 
                        className={`p-2 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 ${showLeaderboardMenu ? 'bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-700 shadow-sm' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'}`}
                    >
                        <Trophy className={`w-4 h-4 md:w-5 md:h-5 ${showLeaderboardMenu ? 'animate-bounce' : ''}`} />
                    </button>
                    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        لوحة الشرف
                    </span>
                    {showLeaderboardMenu && (
                        <>
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm md:hidden animate-in fade-in duration-200" onClick={() => setShowLeaderboardMenu(false)}>
                                <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                                    <LeaderboardWidget />
                                </div>
                            </div>
                            <div className="hidden md:block absolute left-0 top-full mt-2 w-80 z-50 bg-white rounded-3xl shadow-xl border border-gray-100 animate-in slide-in-from-top-2 duration-200 overflow-hidden">
                                <LeaderboardWidget />
                            </div>
                        </>
                    )}
                </div>

                {/* 5. الإشعارات - محسّن */}
                <div className="relative group">
                    <button onClick={markNotifsAsRead} className={`p-2 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 relative ${showNotifMenu ? 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-800 shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                        <Bell className={`w-4 h-4 md:w-5 md:h-5 ${unreadNotifsCount > 0 ? 'text-emerald-600 animate-pulse' : 'text-gray-600'}`} />
                        {unreadNotifsCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-gradient-to-br from-red-500 to-red-600 text-white text-[9px] md:text-[10px] font-black w-4 h-4 md:w-5 md:h-5 flex items-center justify-center rounded-full border-2 border-white animate-bounce shadow-lg">{unreadNotifsCount}</span>
                        )}
                    </button>
                    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        الإشعارات
                    </span>
                    {showNotifMenu && (
                        <>
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm md:hidden animate-in fade-in duration-200" onClick={() => setShowNotifMenu(false)}>
                                <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                                    <div className="p-3 border-b bg-gradient-to-r from-gray-50 to-white font-black text-sm text-gray-800 flex justify-between items-center">
                                        <span className="flex items-center gap-2">
                                            <Bell className="w-4 h-4 text-emerald-600"/> آخر التنبيهات
                                        </span>
                                        <button onClick={() => setShowNotifMenu(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
                                            <X size={16}/>
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                                        {notifications.length === 0 ? (
                                            <div className="p-12 text-center">
                                                <Bell className="w-16 h-16 mx-auto text-gray-300 mb-3"/>
                                                <p className="text-gray-400 text-sm font-bold">لا توجد إشعارات حالياً</p>
                                            </div>
                                        ) : (
                                            notifications.map(n => (
                                                <div 
                                                    key={n.id} 
                                                    onClick={() => {
    // توجيه ذكي يشمل جميع أنواع الإشعارات الممكنة
    const type = n.type?.toLowerCase() || '';
    
    if(type.includes('task')) { setActiveTab('tasks'); }
    else if(type.includes('message')) { setActiveTab('messages'); }
    else if(type.includes('ovr')) { setActiveTab('ovr'); }
    else if(type.includes('training')) { setActiveTab('training'); }
    else if(type.includes('leave')) { setActiveTab('requests-history'); }
    else if(type.includes('reward') || type.includes('store')) { setActiveTab('store'); }
    else if(type.includes('shift') || type.includes('swap')) { setActiveTab('shift-requests'); }
    
    setShowNotifMenu(false);
}}
                                                    className={`p-3 border-b border-gray-50 flex gap-3 hover:bg-emerald-50/30 cursor-pointer transition-colors ${!n.is_read ? 'bg-emerald-50/50 border-l-4 border-l-emerald-500' : ''}`}
                                                >
                                                    <div className={`w-9 h-9 rounded-full ${!n.is_read ? 'bg-emerald-100' : 'bg-gray-100'} flex items-center justify-center ${!n.is_read ? 'text-emerald-600' : 'text-gray-500'} shrink-0 font-bold uppercase text-xs`}>
                                                        {n.type === 'task' ? <ListTodo size={16}/> : n.type === 'training' ? <BookOpen size={16}/> : <Bell size={16}/>}
                                                    </div>
                                                    <div className="space-y-0.5 flex-1">
                                                        <p className="text-xs text-gray-800 leading-relaxed font-bold">{n.title}</p>
                                                        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{n.message}</p>
                                                        <p className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={10}/> {new Date(n.created_at).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="hidden md:block absolute left-0 top-full mt-2 w-80 z-50 bg-white rounded-3xl shadow-xl border border-gray-100 animate-in slide-in-from-top-2 duration-200 overflow-hidden">
                                <div className="p-3 border-b bg-gradient-to-r from-gray-50 to-white font-black text-sm text-gray-800 flex justify-between items-center">
                                    <span className="flex items-center gap-2">
                                        <Bell className="w-4 h-4 text-emerald-600"/> آخر التنبيهات
                                    </span>
                                    <button onClick={() => setShowNotifMenu(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
                                        <X size={16}/>
                                    </button>
                                </div>
                                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                                    {notifications.length === 0 ? (
                                        <div className="p-12 text-center">
                                            <Bell className="w-16 h-16 mx-auto text-gray-300 mb-3"/>
                                            <p className="text-gray-400 text-sm font-bold">لا توجد إشعارات حالياً</p>
                                        </div>
                                    ) : (
                                        notifications.map(n => (
                                            <div 
                                                key={n.id} 
                                                onClick={() => {
                                                    if(n.type === 'task' || n.type === 'task_update') { setActiveTab('tasks'); }
                                                    else if(n.type === 'message') { setActiveTab('messages'); }
                                                    else if(n.type === 'ovr_reply') { setActiveTab('ovr'); }
                                                    else if(n.type === 'training') { setActiveTab('training'); }
                                                    setShowNotifMenu(false);
                                                }}
                                                className={`p-3 border-b border-gray-50 flex gap-3 hover:bg-gray-50 cursor-pointer ${!n.is_read ? 'bg-emerald-50/30' : ''}`}
                                            >
                                                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 font-bold uppercase text-xs">
                                                    {n.type === 'task' ? <ListTodo size={16}/> : n.type === 'training' ? <BookOpen size={16}/> : <Bell size={16}/>}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-xs text-gray-800 leading-relaxed font-bold">{n.title}</p>
                                                    <p className="text-xs text-gray-500 leading-relaxed truncate max-w-[200px]">{n.message}</p>
                                                    <p className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={10}/> {new Date(n.created_at).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-full border-2 border-emerald-100 p-0.5 overflow-hidden ml-1">
                    {employee.photo_url ? <img src={employee.photo_url} className="w-full h-full object-cover rounded-full" alt="Profile" /> : <div className="w-full h-full bg-emerald-200 flex items-center justify-center rounded-full text-emerald-700 font-bold text-sm">{employee.name.charAt(0)}</div>}
                </div>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-2 md:p-4 custom-scrollbar pb-24">
            <div className="max-w-6xl mx-auto space-y-4">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-200/60 p-3 md:p-6 min-h-[500px]">
                    {activeTab === 'news' && (
                        <div className="space-y-4">
                            <EOMVotingCard employee={employee} />
                            <StaffNewsFeed employee={employee} />
                        </div>
                    )}
                    
                    {activeTab === 'profile' && <StaffProfile employee={employee} isEditable={false} />}
                    {activeTab === 'admin' && hasAdminAccess && <AdministrationTab employee={employee} />}
                    {activeTab === 'library' && <StaffLibrary />}
                    {activeTab === 'attendance' && <StaffAttendance attendance={attendanceData} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} employee={employee} />}
                    {activeTab === 'evening-schedule' && <EmployeeEveningSchedule employeeId={employee.id} employeeCode={employee.employee_id} employeeName={employee.name} specialty={employee.specialty} />}
                    {activeTab === 'shift-requests' && <ShiftRequestsTab employee={employee} />}
                    {activeTab === 'dept-requests' && employee.role === 'head_of_dept' && <DepartmentRequests hod={employee} />}
                    {activeTab === 'quality-manager-tab' && employee.role === 'quality_manager' && <QualityDashboard />}
                    {activeTab === 'stats' && <StaffStats attendance={attendanceData} evals={evaluations} requests={leaveRequests} month={selectedMonth} employee={employee} />}
                    {activeTab === 'new-request' && <StaffNewRequest employee={employee} refresh={fetchAllData} />}
                    {activeTab === 'ovr' && <StaffOVR employee={employee} />}
                    {activeTab === 'arcade' && <StaffArcade employee={employee} />} {/* السطر الجديد */}
                    {activeTab === 'templates' && <StaffTemplatesTab employee={employee} />}
                    {activeTab === 'store' && <RewardsStore employee={employee} />}
                    {activeTab === 'training' && (
                        <StaffTrainingCenter 
                            employee={employee} 
                            deepLinkTrainingId={deepLinkTrainingId} 
                        />
                    )}
                    
                    {activeTab === 'links' && <StaffLinksTab />}
                    {activeTab === 'tasks' && <StaffTasks employee={employee} />}
                    {activeTab === 'requests-history' && <StaffRequestsHistory requests={leaveRequests} employee={employee} />}
                    {activeTab === 'evaluations' && <StaffEvaluations evals={evaluations} employee={employee} />}
                    {activeTab === 'messages' && <StaffMessages messages={[]} employee={employee} currentUserId={employee.employee_id} />}
                </div>
            </div>
        </main>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-2 flex justify-between items-center z-50 pb-safe md:hidden shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <button 
                onClick={() => setActiveTab('news')}
                className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'news' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
                <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'news' ? 'bg-emerald-50' : ''}`}>
                    <LayoutDashboard className={`w-6 h-6 ${activeTab === 'news' ? 'fill-current' : ''}`} />
                </div>
                <span className="text-[10px] font-bold">الرئيسية</span>
            </button>

            <button 
                onClick={() => setActiveTab('new-request')}
                className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'new-request' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
                <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'new-request' ? 'bg-emerald-50' : ''}`}>
                    <FilePlus className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold">طلب جديد</span>
            </button>

            <button 
                onClick={() => setActiveTab('profile')}
                className="relative -top-6 bg-emerald-600 text-white p-4 rounded-full shadow-xl shadow-emerald-200 border-4 border-gray-50 flex items-center justify-center hover:scale-105 transition-transform"
            >
                <User className="w-6 h-6" />
            </button>

            {hasAdminAccess && (
                <button 
                    onClick={() => setActiveTab('admin')}
                    className={`flex flex-col items-center gap-1 transition-colors ${
                        activeTab === 'admin' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'admin' ? 'bg-indigo-50' : ''}`}>
                        <Settings className={`w-6 h-6 ${activeTab === 'admin' ? 'fill-current' : ''}`} />
                    </div>
                    <span className="text-[10px] font-bold">الإدارة</span>
                </button>
            )}

            {!hasAdminAccess && (
                 <button 
                 onClick={() => setActiveTab('attendance')}
                 className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'attendance' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
             >
                 <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'attendance' ? 'bg-emerald-50' : ''}`}>
                     <Clock className="w-6 h-6" />
                 </div>
                 <span className="text-[10px] font-bold">حضوري</span>
             </button>
            )}

            <button 
                onClick={() => setIsSidebarOpen(true)}
                className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600"
            >
                <div className="p-1.5">
                    <Menu className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold">المزيد</span>
            </button>
        </div>

      </div>

      {showAboutModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center relative animate-in zoom-in-95">
                  <button onClick={() => setShowAboutModal(false)} className="absolute top-4 right-4 p-2 bg-gray-50 rounded-full hover:bg-gray-100"><X size={16}/></button>
                  <div className="w-16 h-16 bg-emerald-100 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-emerald-200">
                        <img src="/pwa-192x192.png" className="w-12 h-12 rounded-xl" alt="Logo" />
                  </div>
                  <h2 className="text-lg font-black text-gray-800">غرب المطار</h2>
                  <p className="text-xs text-gray-500 font-bold mb-4">نظام إدارة الموارد البشرية</p>
                  <div className="space-y-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-xl border">
                      <div className="flex justify-between"><span>الإصدار:</span><span className="font-bold">1.2.0</span></div>
                      <div className="flex justify-between"><span>التطوير:</span><span className="font-bold">IT Department</span></div>
                  </div>
              </div>
        </div>
      )}
    </div>
  );
}
