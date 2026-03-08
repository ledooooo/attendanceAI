import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    Settings, ShoppingBag, Trophy, Star, Check, CheckSquare, ShoppingCart, Gamepad2, Sparkles,
    Smartphone, BellRing, Calculator, DownloadCloud, Stethoscope // ✅ تمت إضافة Stethoscope
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

// ✅ استيراد تبويب عيادتي الجديد للأطباء
import DoctorClinic from './components/DoctorClinic';

import DailyQuizModal from '../../components/gamification/DailyQuizModal';
import LeaderboardWidget from '../../components/gamification/LeaderboardWidget';
import LevelProgressBar from '../../components/gamification/LevelProgressBar';
import CalculatorsMenu from '../../calculators/CalculatorsMenu';

interface Props {
  employee: Employee;
}

export default function StaffDashboard({ employee }: Props) {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState('news');
  const [deepLinkTrainingId, setDeepLinkTrainingId] = useState<string | null>(null);
  const [deepLinkRoomId, setDeepLinkRoomId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [ovrCount, setOvrCount] = useState(0);

  const [isScrolled, setIsScrolled] = useState(false);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLeaderboardMenu, setShowLeaderboardMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  
  const [isThemeEnabled, setIsThemeEnabled] = useState(true);

  const [pendingMandatoryTraining, setPendingMandatoryTraining] = useState<any>(null);

  const hasAdminAccess = employee.role === 'admin' || (employee.permissions && employee.permissions.length > 0);
  
  // ✅ دالة بسيطة للتحقق مما إذا كان الموظف طبيباً (لعرض تبويب عيادتي)
  const isDoctor = ['طب الأسرة', 'الأطفال', 'النساء والتوليد', 'الباطنة', 'الأسنان'].includes(employee.specialty || '');

  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'default'
  );
  const [showNotifPrompt, setShowNotifPrompt] = useState(true);

  useEffect(() => {
    if ('Notification' in window) {
      const interval = setInterval(() => {
        if (Notification.permission !== notificationStatus) {
          setNotificationStatus(Notification.permission);
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [notificationStatus]);

  useEffect(() => {
    if (employee?.employee_id) {
        requestNotificationPermission(employee.employee_id);
    }
  }, [employee.employee_id]);

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
      const hash = window.location.hash;
    if (hash.startsWith('#room=')) {
        const roomId = hash.replace('#room=', '').trim();
        if (roomId) {
            setDeepLinkRoomId(roomId);
            setActiveTab('arcade');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
  }, []);
  
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

  const handleToggleNotifMenu = useCallback(async () => {
    const nextState = !showNotifMenu;
    setShowNotifMenu(nextState);
    
    if (nextState) {
        setShowProfileMenu(false); 
        setShowLeaderboardMenu(false);
        
        if (notifications.some(n => !n.is_read)) {
            await supabase
              .from('notifications')
              .update({ is_read: true })
              .eq('user_id', employee.employee_id);
            
            fetchNotifications();
            queryClient.invalidateQueries({ queryKey: ['staff_badges'] });
        }
    }
  }, [showNotifMenu, notifications, employee.employee_id, fetchNotifications, queryClient]);

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
      staleTime: 1000 * 45,
      refetchInterval: 45000,
      refetchOnWindowFocus: false,
  });

  const { data: staffBadges = { messages: 0, tasks: 0, swaps: 0, news: 0, ovr_replies: 0, training: 0 } } = useQuery({
      queryKey: ['staff_badges', employee.employee_id],
      queryFn: async () => {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);

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
      staleTime: 1000 * 30,
      refetchInterval: 30000,
      refetchOnWindowFocus: false,
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
        event: 'INSERT', schema: 'public', table: 'notifications', 
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

  const handleEnableNotifications = async () => {
    const result = await requestNotificationPermission(employee.employee_id);
    if (result) {
      setNotificationStatus('granted');
      toast.success('تم تفعيل التنبيهات بنجاح! 🔔');
    } else {
      toast.error('يرجى تفعيل الإذن من إعدادات المتصفح ⚙️');
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const scrollTop = e.currentTarget.scrollTop;
      if (scrollTop > 40 && !isScrolled) setIsScrolled(true);
      else if (scrollTop <= 40 && isScrolled) setIsScrolled(false);
  };

  const menuItems = useMemo(() => [
    { id: 'news', label: 'الرئيسية', icon: LayoutDashboard, badge: staffBadges.news },
    { id: 'profile', label: 'الملف الشخصي', icon: User },
    ...(hasAdminAccess ? [{ id: 'admin', label: 'لوحة الإدارة', icon: Settings }] : []),
    ...(isDoctor ? [{ id: 'clinic', label: 'عيادتي', icon: Stethoscope }] : []), // ✅ إضافة زر العيادة للأطباء فقط
    { id: 'tasks', label: 'التكليفات', icon: ListTodo, badge: staffBadges.tasks },
    { id: 'shift-requests', label: 'طلبات التبديل', icon: ArrowLeftRight, badge: staffBadges.swaps },
    { id: 'messages', label: 'الرسائل', icon: Inbox, badge: staffBadges.messages },
    { id: 'ovr', label: 'إبلاغ OVR', icon: AlertTriangle, badge: staffBadges.ovr_replies },
    { id: 'training', label: 'مركز التدريب', icon: BookOpen, badge: staffBadges.training }, 
    { id: 'library', label: 'المكتبة والسياسات', icon: BookOpen },
    ...(employee.role === 'quality_manager' ? [{ id: 'quality-manager-tab', label: 'مسؤول الجودة', icon: ShieldCheck, badge: ovrCount }] : []),
    { id: 'attendance', label: 'سجل الحضور', icon: Clock },
    { id: 'arcade', label: 'صالة الألعاب', icon: Gamepad2, isNew: true },
    { id: 'calculators', label: 'حاسبات هامة', icon: Calculator, isNew: true },
    { id: 'evening-schedule', label: 'النوبتجيات المسائية', icon: Moon },
    { id: 'store', label: 'متجر الجوائز', icon: ShoppingBag },
    ...(employee.role === 'head_of_dept' ? [{ id: 'dept-requests', label: 'إدارة القسم', icon: FileText }] : []),
    { id: 'stats', label: 'الإحصائيات', icon: BarChart },
    { id: 'new-request', label: 'تقديم طلب', icon: FilePlus },
    { id: 'requests-history', label: 'سجل الطلبات', icon: List },
    { id: 'templates', label: 'نماذج رسمية', icon: Printer },
    { id: 'links', label: 'روابط هامة', icon: LinkIcon },
    { id: 'evaluations', label: 'التقييمات', icon: Award },
  ], [staffBadges, hasAdminAccess, employee.role, ovrCount, isDoctor]);

  const unreadNotifsCount = useMemo(() => 
    notifications.filter(n => !n.is_read).length, 
    [notifications]
  );

  return (
    <div {...swipeHandlers} className="min-h-screen w-full bg-gray-50 flex overflow-visible font-sans text-right" dir="rtl">
      
      <DailyQuizModal employee={employee} />
      {isThemeEnabled && <ThemeOverlay employee={employee} />}

      <div className="fixed top-0 left-0 right-0 z-[60] flex flex-col gap-2 p-2 md:px-6 pointer-events-none">
          {!isStandalone && showInstallPopup && (
            <div className="pointer-events-auto w-full max-w-xl mx-auto bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-3 rounded-2xl shadow-xl flex items-center justify-between animate-in slide-in-from-top-10 duration-500 border border-white/20">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-xl">
                        <DownloadCloud className="w-5 h-5 animate-bounce" />
                    </div>
                    <div>
                        <p className="text-xs font-black">ثبّت تطبيق غرب المطار</p>
                        <p className="text-[10px] opacity-80">لتجربة أسرع وسهولة في الوصول للخدمات</p>
                    </div>
                </div>
                <div className="flex gap-2 shrink-0">
                    <button onClick={() => setShowInstallPopup(false)} className="text-[10px] font-bold px-2 py-1 hover:bg-white/10 rounded-lg">لاحقاً</button>
                    <button onClick={handleInstallClick} className="bg-white text-emerald-600 text-xs font-black px-4 py-2 rounded-xl shadow-sm active:scale-95 transition-transform">تثبيت</button>
                </div>
            </div>
          )}

          {notificationStatus !== 'granted' && showNotifPrompt && (
            <div className="pointer-events-auto w-full max-w-xl mx-auto bg-gradient-to-r from-orange-500 to-pink-500 text-white p-3 rounded-2xl shadow-xl flex items-center justify-between animate-in slide-in-from-top-4 duration-700 border border-white/20 relative mt-16 md:mt-20">
                <button 
                    onClick={() => setShowNotifPrompt(false)} 
                    className="absolute -top-2 -right-2 bg-black/20 hover:bg-black/40 rounded-full p-1 transition-colors"
                >
                    <X size={14} className="text-white" />
                </button>
                
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-xl">
                        <BellRing className="w-5 h-5 animate-ring" />
                    </div>
                    <div>
                        <p className="text-xs font-black">فعّل التنبيهات اللحظية</p>
                        <p className="text-[10px] opacity-80">لتصلك المهام والجوائز فور صدورها</p>
                    </div>
                </div>
                <button onClick={handleEnableNotifications} className="bg-white text-orange-600 text-xs font-black px-5 py-2 rounded-xl shadow-sm active:scale-95 transition-transform shrink-0">تفعيل</button>
            </div>
          )}
      </div>

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

      {isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/60 z-[60] md:hidden backdrop-blur-sm transition-opacity duration-300" 
            onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      <aside className={`
          fixed inset-y-0 right-0 z-[70] w-[85vw] max-w-[300px] bg-white border-l shadow-2xl 
          transform transition-transform duration-300 ease-in-out flex flex-col 
          ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} 
          md:translate-x-0 md:static md:w-72 md:shadow-none h-[100dvh]
      `}>
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
        </nav>

        <div className="p-3 border-t bg-gray-50 flex items-center justify-between shrink-0 pb-safe gap-1">
            <button onClick={handleShareApp} className="flex-1 p-2 rounded-xl text-gray-500 hover:bg-emerald-100 hover:text-emerald-600 transition-colors flex flex-col items-center gap-1">
                <Share2 className="w-5 h-5" />
                <span className="text-[9px] font-bold">مشاركة</span>
            </button>
            <button onClick={() => setShowAboutModal(true)} className="flex-1 p-2 rounded-xl text-gray-500 hover:bg-orange-100 hover:text-orange-600 transition-colors flex flex-col items-center gap-1">
                <Info className="w-5 h-5" />
                <span className="text-[9px] font-bold">حول</span>
            </button>
            <button onClick={() => setIsThemeEnabled(!isThemeEnabled)} className={`flex-1 p-2 rounded-xl transition-colors flex flex-col items-center gap-1 ${isThemeEnabled ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500 hover:bg-gray-100'}`}>
                <Sparkles className="w-5 h-5" />
                <span className="text-[9px] font-bold">الثيم</span>
            </button>
            <button onClick={signOut} className="flex-1 p-2 rounded-xl text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors flex flex-col items-center gap-1">
                <LogOut className="w-5 h-5" />
                <span className="text-[9px] font-bold">خروج</span>
            </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-gray-100/50 relative">
        <header className="h-16 bg-white border-b flex items-center justify-between px-3 md:px-6 sticky top-0 z-30 shadow-sm shrink-0 bg-white/95">
            <div className="flex items-center gap-2 md:gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all">
                    <Menu className="w-5 h-5 text-gray-700"/>
                </button>
                <span className="font-black text-gray-800 hidden md:block">لوحة التحكم</span>
            </div>

            <div className="flex items-center justify-end gap-1.5 md:gap-2 mr-auto">
                
                <button 
                    onClick={() => setActiveTab('store')} 
                    className={`p-2 rounded-xl transition-transform duration-200 hover:scale-105 active:scale-95 relative ${activeTab === 'store' ? 'bg-gradient-to-br from-pink-100 to-pink-200 text-pink-700 shadow-sm' : 'bg-pink-50 text-pink-600 hover:bg-pink-100'}`}
                >
                    <ShoppingCart className="w-4 h-4 md:w-5 md:h-5" />
                    {pendingRewardsCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-gradient-to-br from-red-500 to-red-600 text-white text-[9px] md:text-[10px] font-black w-4 h-4 flex items-center justify-center rounded-full animate-bounce shadow-md">
                            {pendingRewardsCount}
                        </span>
                    )}
                </button>

                <button 
                    onClick={() => { setShowLeaderboardMenu(!showLeaderboardMenu); setShowProfileMenu(false); setShowNotifMenu(false); }} 
                    className={`p-2 rounded-xl transition-transform duration-200 hover:scale-105 active:scale-95 ${showLeaderboardMenu ? 'bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-700 shadow-sm' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'}`}
                >
                    <Trophy className="w-4 h-4 md:w-5 md:h-5" />
                </button>

                <button 
                    onClick={handleToggleNotifMenu} 
                    className={`p-2 rounded-xl transition-transform duration-200 hover:scale-105 active:scale-95 relative ${showNotifMenu ? 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-800 shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                >
                    <Bell className={`w-4 h-4 md:w-5 md:h-5 ${unreadNotifsCount > 0 ? 'text-emerald-600 animate-pulse' : ''}`} />
                    {unreadNotifsCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-gradient-to-br from-red-500 to-red-600 text-white text-[9px] md:text-[10px] font-black w-4 h-4 flex items-center justify-center rounded-full animate-bounce shadow-md">
                            {unreadNotifsCount}
                        </span>
                    )}
                </button>
                
                <button 
                    onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifMenu(false); setShowLeaderboardMenu(false); }}
                    className="w-8 h-8 md:w-9 md:h-9 rounded-full border-2 border-emerald-100 p-0.5 overflow-hidden ml-1 hover:scale-105 transition-transform active:scale-95 outline-none focus:ring-2 focus:ring-emerald-400 bg-emerald-50"
                >
                    {employee.photo_url ? (
                        <img src={employee.photo_url} className="w-full h-full object-cover rounded-full" alt="Profile" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center rounded-full text-emerald-700 font-black text-xs md:text-sm">
                            {employee.name.charAt(0)}
                        </div>
                    )}
                </button>

            </div>
        </header>

        <main onScroll={handleScroll} className="flex-1 overflow-y-auto p-2 md:p-4 custom-scrollbar pb-24 relative">
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
                    {/* ✅ إضافة عرض مكون العيادة */}
                    {activeTab === 'clinic' && isDoctor && <DoctorClinic employee={employee} />}
                    {activeTab === 'library' && <StaffLibrary />}
                    {activeTab === 'attendance' && <StaffAttendance attendance={attendanceData} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} employee={employee} />}
                    {activeTab === 'evening-schedule' && <EmployeeEveningSchedule employeeId={employee.id} employeeCode={employee.employee_id} employeeName={employee.name} specialty={employee.specialty} />}
                    {activeTab === 'shift-requests' && <ShiftRequestsTab employee={employee} />}
                    {activeTab === 'dept-requests' && employee.role === 'head_of_dept' && <DepartmentRequests hod={employee} />}
                    {activeTab === 'quality-manager-tab' && employee.role === 'quality_manager' && <QualityDashboard />}
                    {activeTab === 'calculators' && <CalculatorsMenu />}
                    {activeTab === 'stats' && <StaffStats attendance={attendanceData} evals={evaluations} requests={leaveRequests} month={selectedMonth} employee={employee} />}
                    {activeTab === 'new-request' && <StaffNewRequest employee={employee} refresh={fetchAllData} />}
                    {activeTab === 'ovr' && <StaffOVR employee={employee} />}
                    {activeTab === 'arcade' && <StaffArcade employee={employee} deepLinkRoomId={deepLinkRoomId} />}
                    {activeTab === 'templates' && <StaffTemplatesTab employee={employee} />}
                    {activeTab === 'store' && <RewardsStore employee={employee} />}
                    {activeTab === 'training' && <StaffTrainingCenter employee={employee} deepLinkTrainingId={deepLinkTrainingId} />}
                    {activeTab === 'links' && <StaffLinksTab />}
                    {activeTab === 'tasks' && <StaffTasks employee={employee} />}
                    {activeTab === 'requests-history' && <StaffRequestsHistory requests={leaveRequests} employee={employee} />}
                    {activeTab === 'evaluations' && <StaffEvaluations evals={evaluations} employee={employee} />}
                    {activeTab === 'messages' && <StaffMessages messages={[]} employee={employee} currentUserId={employee.employee_id} />}
                </div>
            </div>
        </main>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-2 flex justify-between items-center z-50 pb-safe md:hidden shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <button onClick={() => setActiveTab('news')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'news' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}>
                <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'news' ? 'bg-emerald-50' : ''}`}>
                    <LayoutDashboard className={`w-6 h-6 ${activeTab === 'news' ? 'fill-current' : ''}`} />
                </div>
                <span className="text-[10px] font-bold">الرئيسية</span>
            </button>

            <button onClick={() => setActiveTab('new-request')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'new-request' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}>
                <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'new-request' ? 'bg-emerald-50' : ''}`}>
                    <FilePlus className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold">طلب جديد</span>
            </button>

            <button onClick={() => { setShowProfileMenu(true); setShowLeaderboardMenu(false); setShowNotifMenu(false); }} className="relative -top-6 bg-emerald-600 text-white p-4 rounded-full shadow-xl shadow-emerald-200 border-4 border-gray-50 flex items-center justify-center hover:scale-105 transition-transform">
                <User className="w-6 h-6" />
            </button>

            {hasAdminAccess && (
                <button onClick={() => setActiveTab('admin')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'admin' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
                    <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'admin' ? 'bg-indigo-50' : ''}`}>
                        <Settings className={`w-6 h-6 ${activeTab === 'admin' ? 'fill-current' : ''}`} />
                    </div>
                    <span className="text-[10px] font-bold">الإدارة</span>
                </button>
            )}

            {!hasAdminAccess && (
                 <button onClick={() => setActiveTab('attendance')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'attendance' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}>
                 <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'attendance' ? 'bg-emerald-50' : ''}`}>
                     <Clock className="w-6 h-6" />
                 </div>
                 <span className="text-[10px] font-bold">حضوري</span>
             </button>
            )}

            <button onClick={() => setIsSidebarOpen(true)} className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600">
                <div className="p-1.5"><Menu className="w-6 h-6" /></div>
                <span className="text-[10px] font-bold">المزيد</span>
            </button>
        </div>
      </div>

      {showNotifMenu && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowNotifMenu(false)}>
              <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                      <h3 className="font-black text-gray-800 flex items-center gap-2"><Bell className="w-5 h-5 text-emerald-600"/> التنبيهات</h3>
                      <button onClick={()=>setShowNotifMenu(false)} className="p-1 bg-white rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"><X size={18}/></button>
                  </div>
                  <div className="overflow-y-auto custom-scrollbar flex-1">
                      {notifications.length === 0 ? (
                          <div className="p-10 text-center text-gray-400 font-bold italic">لا توجد إشعارات حالياً ✨</div>
                      ) : (
                          notifications.map(n => (
                              <button 
                                  key={n.id} 
                                  type="button"
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      const type = n.type?.toLowerCase() || '';
                                      if(type.includes('task')) setActiveTab('tasks');
                                      else if(type.includes('message')) setActiveTab('messages');
                                      else if(type.includes('ovr')) setActiveTab('ovr');
                                      else if(type.includes('training')) setActiveTab('training');
                                      else if(type.includes('leave')) setActiveTab('requests-history');
                                      else if(type.includes('reward') || type.includes('store')) setActiveTab('store');
                                      else if(type.includes('shift') || type.includes('swap')) setActiveTab('shift-requests');
                                      
                                      setShowNotifMenu(false);
                                  }}
                                  className={`w-full text-right block p-4 border-b last:border-0 cursor-pointer transition-colors hover:bg-emerald-50 active:bg-emerald-100 outline-none ${!n.is_read ? 'bg-emerald-50/40' : 'bg-white'}`}
                              >
                                  <div className="flex justify-between items-start mb-1">
                                      <h4 className="font-black text-xs text-gray-800">{n.title}</h4>
                                      {!n.is_read && <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0 shadow-sm"></span>}
                                  </div>
                                  <p className="text-[11px] text-gray-600 leading-relaxed mt-1">{n.message}</p>
                                  <p className="text-[9px] text-gray-400 mt-2 flex items-center gap-1"><Clock size={10}/> {new Date(n.created_at).toLocaleString('ar-EG')}</p>
                              </button>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

      {showProfileMenu && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowProfileMenu(false)}>
              <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col" onClick={e => e.stopPropagation()}>
                  
                  <div className="p-6 pb-4 bg-gradient-to-br from-emerald-500 to-teal-600 flex flex-col items-center relative text-white">
                      <button onClick={()=>setShowProfileMenu(false)} className="absolute top-4 right-4 p-1.5 bg-black/10 rounded-full hover:bg-black/20 transition-colors text-white outline-none"><X size={18}/></button>
                      
                      <div className="w-20 h-20 bg-white rounded-full border-4 border-emerald-100 shadow-md overflow-hidden mb-3">
                           {employee.photo_url ? (
                               <img src={employee.photo_url} className="w-full h-full object-cover" alt="Profile" />
                           ) : (
                               <div className="w-full h-full flex items-center justify-center text-3xl font-black text-emerald-600">
                                   {employee.name.charAt(0)}
                               </div>
                           )}
                      </div>
                      
                      <h3 className="font-black text-lg">{employee.name}</h3>
                      <p className="text-xs text-emerald-50 font-bold mt-1 bg-black/10 px-3 py-1 rounded-full">{employee.specialty || 'موظف'}</p>
                  </div>

                  <div className="p-5 pt-4 space-y-4">
                      <div className="bg-emerald-50/80 rounded-2xl p-4 border border-emerald-100 shadow-sm relative overflow-hidden">
                          <LevelProgressBar employee={employee} />
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                          <button 
                              onClick={() => { setActiveTab('profile'); setShowProfileMenu(false); }} 
                              className="flex items-center justify-center gap-2 py-3 bg-emerald-100 text-emerald-700 rounded-xl font-bold hover:bg-emerald-200 transition-all active:scale-95 text-sm outline-none"
                          >
                              <User size={18}/> ملفي الشخصي
                          </button>
                          <button 
                              onClick={signOut} 
                              className="flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all active:scale-95 text-sm outline-none"
                          >
                              <LogOut size={18}/> تسجيل خروج
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showLeaderboardMenu && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowLeaderboardMenu(false)}>
              <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b flex justify-between items-center bg-emerald-50 shrink-0">
                      <h3 className="font-black text-emerald-800 flex items-center gap-2 text-sm"><Trophy className="w-5 h-5 text-yellow-500"/> لوحة الشرف</h3>
                      <button onClick={()=>setShowLeaderboardMenu(false)} className="p-1 bg-white rounded-full hover:bg-red-50 hover:text-red-500 transition-colors text-emerald-700"><X className="w-5 h-5"/></button>
                  </div>
                  
                  <div className="overflow-y-auto custom-scrollbar flex-1 flex flex-col">
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 m-3 rounded-2xl border border-emerald-100 shadow-sm shrink-0">
                          <h4 className="text-xs font-black text-emerald-800 mb-3 flex items-center gap-1">
                              <Sparkles size={16} className="text-yellow-500 animate-pulse"/> كيف تجمع النقاط؟
                          </h4>
                          <div className="flex flex-wrap gap-2 text-[10px] font-bold text-gray-700">
                              <span className="bg-white px-2.5 py-1.5 rounded-lg border border-emerald-100 shadow-sm flex items-center gap-1"><Clock size={12} className="text-blue-500"/> الحضور المبكر</span>
                              <span className="bg-white px-2.5 py-1.5 rounded-lg border border-emerald-100 shadow-sm flex items-center gap-1"><CheckSquare size={12} className="text-emerald-500"/> تنفيذ التكليفات</span>
                              <span className="bg-white px-2.5 py-1.5 rounded-lg border border-emerald-100 shadow-sm flex items-center gap-1"><LayoutDashboard size={12} className="text-orange-500"/> الزيارة اليومية</span>
                              <span className="bg-white px-2.5 py-1.5 rounded-lg border border-emerald-100 shadow-sm flex items-center gap-1"><Award size={12} className="text-emerald-500"/> التحديات اليومية</span>
                              <span className="bg-white px-2.5 py-1.5 rounded-lg border border-emerald-100 shadow-sm flex items-center gap-1"><Gamepad2 size={12} className="text-purple-500"/> صالة الألعاب</span>
                              <span className="bg-white px-2.5 py-1.5 rounded-lg border border-emerald-100 shadow-sm flex items-center gap-1"><AlertTriangle size={12} className="text-red-500"/> إرسال OVR</span>
                          </div>
                      </div>

                      <div className="px-2 pb-2">
                          <LeaderboardWidget />
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showAboutModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm text-center relative animate-in zoom-in-95 shadow-2xl">
                  <button onClick={() => setShowAboutModal(false)} className="absolute top-4 right-4 p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors"><X size={16}/></button>
                  <div className="w-20 h-20 bg-emerald-100 rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-emerald-200 rotate-3 hover:rotate-0 transition-transform duration-300">
                        <img src="/pwa-192x192.png" className="w-14 h-14 rounded-xl" alt="Logo" />
                  </div>
                  <h2 className="text-xl font-black text-gray-800">غرب المطار</h2>
                  <p className="text-xs text-gray-500 font-bold mb-6 tracking-widest uppercase">نظام إدارة الموارد البشرية</p>
                  <div className="space-y-3 text-xs text-gray-600 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <div className="flex justify-between border-b border-gray-200 pb-2"><span>الإصدار:</span><span className="font-black text-gray-800">2.6.0</span></div>
                      <div className="flex justify-between pt-1"><span>التطوير:</span><span className="font-black text-emerald-600">IT Department</span></div>
                  </div>
              </div>
        </div>
      )}
    </div>
  );
}
