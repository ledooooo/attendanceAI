import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest, Evaluation } from '../../types';
import { useSwipeable } from 'react-swipeable';
import { useNotifications as usePush } from '../../hooks/useNotifications';
import { 
  LogOut, User, Clock, Printer, FilePlus, 
  List, Award, Inbox, BarChart, Menu, X, LayoutDashboard,
  Share2, Download, Info, Heart, Smartphone, HelpCircle, Moon, FileText, 
  Link as LinkIcon, AlertTriangle, ShieldCheck, ArrowLeftRight, Bell, BookOpen
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

interface Props {
  employee: Employee;
}

export default function StaffDashboard({ employee }: Props) {
  // 1. استدعاء user من الـ AuthContext
  const { signOut, user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('news');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [ovrCount, setOvrCount] = useState(0);

  // --- 1. حالات تخزين البيانات (States) ---
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  // 2. استخدام user.id بدلاً من employee.employee_id لربط الإشعارات بشكل آمن
  const { requestPermission } = usePush(user?.id || '');

  useEffect(() => {
    // طلب الإذن تلقائياً بعد 4 ثواني من دخول الموظف إذا لم يسأل من قبل
    const timer = setTimeout(() => {
      if (Notification.permission === 'default') {
        requestPermission();
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [user?.id]); // 3. تحديث التبعية هنا لتعتمد على user.id

  // حالات PWA
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // --- 2. وظائف الإشعارات الداخلية ---
  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', employee.employee_id)
      .order('created_at', { ascending: false })
      .limit(15);
    if (data) setNotifications(data);
  };

  const markNotifsAsRead = async () => {
    if (notifications.some(n => !n.is_read)) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', employee.employee_id);
      fetchNotifications();
    }
    setShowNotifMenu(!showNotifMenu);
  };

  // --- 3. جلب البيانات الأساسية ---
  const fetchAllData = async () => {
    try {
      const { data: att } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee.employee_id);
      
      const { data: reqs } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', employee.employee_id);

      const { data: evs } = await supabase
        .from('evaluations')
        .select('*')
        .eq('employee_id', employee.employee_id);

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

    const channel = supabase.channel('dashboard_realtime_staff')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications', 
        filter: `recipient_id=eq.${employee.employee_id}` 
      }, () => fetchNotifications())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [employee.employee_id]);

  // إعدادات السحب (Swipe)
  const swipeHandlers = useSwipeable({
    onSwipedLeft: (eventData) => {
      if (eventData.initial[0] > window.innerWidth / 2) setIsSidebarOpen(true);
    },
    onSwipedRight: () => setIsSidebarOpen(false),
    trackMouse: true,
    delta: 50,
  });

  // فحص تقارير الجودة الجديدة (لمسؤول الجودة فقط)
  useEffect(() => {
    if (employee.role === 'quality_manager') {
        const checkNewReports = async () => {
            const { count } = await supabase
                .from('ovr_reports')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'new');
            setOvrCount(count || 0);
        };
        checkNewReports();
    }
  }, [employee.role]);

  // منطق تثبيت التطبيق (PWA)
  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                               (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
    };
    checkStandalone();
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isStandalone) setTimeout(() => setShowInstallPopup(true), 3000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isStandalone]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') { setDeferredPrompt(null); setShowInstallPopup(false); }
    }
  };

  const handleShareApp = async () => {
    try {
        if (navigator.share) await navigator.share({ title: 'غرب المطار', url: window.location.origin });
        else { navigator.clipboard.writeText(window.location.origin); alert('تم النسخ'); }
    } catch (err) { console.error(err); }
  };

  const menuItems = [
    { id: 'news', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'profile', label: 'الملف الشخصي', icon: User },
    { id: 'library', label: 'المكتبة والسياسات', icon: BookOpen },
    ...(employee.role === 'quality_manager' ? [{ id: 'quality-manager-tab', label: 'مسؤول الجودة', icon: ShieldCheck, badge: ovrCount }] : []),
    { id: 'attendance', label: 'سجل الحضور', icon: Clock },
    { id: 'evening-schedule', label: 'النوبتجيات المسائية', icon: Moon },
    { id: 'shift-requests', label: 'طلبات التبديل', icon: ArrowLeftRight },
    ...(employee.role === 'head_of_dept' ? [{ id: 'dept-requests', label: 'إدارة القسم', icon: FileText }] : []),
    { id: 'stats', label: 'الإحصائيات', icon: BarChart },
    { id: 'new-request', label: 'تقديم طلب', icon: FilePlus },
    { id: 'ovr', label: 'إبلاغ OVR', icon: AlertTriangle },
    { id: 'requests-history', label: 'سجل الطلبات', icon: List },
    { id: 'templates', label: 'نماذج رسمية', icon: Printer },
    { id: 'links', label: 'روابط هامة', icon: LinkIcon },
    { id: 'evaluations', label: 'التقييمات', icon: Award },
    { id: 'messages', label: 'الرسائل', icon: Inbox },
  ];

  const unreadNotifsCount = notifications.filter(n => !n.is_read).length;

  return (
    <div {...swipeHandlers} className="h-screen w-full bg-gray-50 flex overflow-hidden font-sans text-right" dir="rtl">
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* القائمة الجانبية */}
      <aside className={`
          fixed inset-y-0 right-0 z-50 w-72 bg-white border-l shadow-2xl 
          transform transition-transform duration-300 ease-in-out flex flex-col
          ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} 
          md:translate-x-0 md:static md:shadow-none
      `}>
        {/* ترويسة القائمة */}
        <div className="h-24 flex items-center justify-between px-6 border-b shrink-0 bg-emerald-50/50">
            <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-xl shadow-sm border border-emerald-100">
                    <img src="/pwa-192x192.png" className="w-8 h-8 rounded-lg" alt="Logo" />
                </div>
                <div>
                    <h1 className="font-black text-gray-800 text-sm">غرب المطار</h1>
                    <p className="text-[10px] text-gray-500 font-bold mt-0.5">بوابة الموظفين</p>
                </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-gray-400">
                <X className="w-5 h-5"/>
            </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                  isActive 
                    ? 'bg-emerald-600 text-white shadow-lg font-bold' 
                    : 'text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span className="text-sm">{item.label}</span>
                {item.badge && item.badge > 0 && (
                    <span className="absolute left-4 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {item.badge}
                    </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t bg-gray-50 flex items-center justify-around shrink-0">
            <button onClick={handleShareApp} className="p-3 rounded-xl text-gray-500 hover:bg-purple-100"><Share2 className="w-5 h-5" /></button>
            <button onClick={() => setShowAboutModal(true)} className="p-3 rounded-xl text-gray-500 hover:bg-orange-100"><Info className="w-5 h-5" /></button>
            <button onClick={signOut} className="p-3 rounded-xl text-red-400 hover:bg-red-100"><LogOut className="w-5 h-5" /></button>
        </div>
      </aside>

      {/* المحتوى الرئيسي */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50/50">
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 shadow-sm shrink-0">
            <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-gray-100 rounded-xl">
                    <Menu className="w-6 h-6"/>
                </button>
                <span className="font-black text-gray-800 hidden md:block">لوحة التحكم</span>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative">
                    <button 
                      onClick={markNotifsAsRead}
                      className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors relative"
                    >
                        <Bell className="w-6 h-6 text-gray-600" />
                        {unreadNotifsCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white animate-bounce">
                                {unreadNotifsCount}
                            </span>
                        )}
                    </button>

                    {showNotifMenu && (
                        <div className="absolute left-0 mt-3 w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 z-[100] overflow-hidden animate-in fade-in zoom-in-95">
                            <div className="p-4 border-b bg-gray-50/50 font-black text-sm text-gray-800 flex justify-between">
                                <span>آخر التنبيهات</span>
                                <button onClick={() => setShowNotifMenu(false)} className="text-gray-400"><X size={16}/></button>
                            </div>
                            <div className="max-h-96 overflow-y-auto custom-scrollbar">
                                {notifications.length === 0 ? (
                                    <p className="p-10 text-center text-gray-400 text-xs">لا توجد إشعارات حالياً</p>
                                ) : (
                                    notifications.map(n => (
                                        <div key={n.id} className={`p-4 border-b border-gray-50 flex gap-3 hover:bg-gray-50 ${!n.is_read ? 'bg-emerald-50/30' : ''}`}>
                                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 font-bold uppercase">{n.sender_name[0]}</div>
                                            <div className="space-y-1">
                                                <p className="text-xs text-gray-800 leading-relaxed"><span className="font-bold">{n.sender_name}</span> {n.message}</p>
                                                <p className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={10}/> {new Date(n.created_at).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-10 h-10 rounded-full border-2 border-emerald-100 p-0.5 overflow-hidden">
                    {employee.photo_url ? <img src={employee.photo_url} className="w-full h-full object-cover rounded-full" alt="Profile" /> : <div className="w-full h-full bg-emerald-200 flex items-center justify-center rounded-full text-emerald-700 font-bold">{employee.name.charAt(0)}</div>}
                </div>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-5 md:p-8 min-h-[500px]">
                    {activeTab === 'news' && (
                        <>
                            <EOMVotingCard employee={employee} />
                            <StaffNewsFeed employee={employee} />
                        </>
                    )}
                    
                    {activeTab === 'profile' && <StaffProfile employee={employee} isEditable={false} />}
                    {activeTab === 'library' && <StaffLibrary />}
                    
                    {activeTab === 'attendance' && (
                        <StaffAttendance attendance={attendanceData} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} employee={employee} /> 
                    )}
                    {activeTab === 'evening-schedule' && (
                        <EmployeeEveningSchedule employeeId={employee.id} employeeCode={employee.employee_id} employeeName={employee.name} specialty={employee.specialty} />
                    )}
                    {activeTab === 'shift-requests' && <ShiftRequestsTab employee={employee} />}
                    {activeTab === 'dept-requests' && employee.role === 'head_of_dept' && <DepartmentRequests hod={employee} />}
                    {activeTab === 'quality-manager-tab' && employee.role === 'quality_manager' && <QualityDashboard />}
                    
                    {activeTab === 'stats' && (
                        <StaffStats attendance={attendanceData} evals={evaluations} requests={leaveRequests} month={selectedMonth} employee={employee} />
                    )}

                    {activeTab === 'new-request' && <StaffNewRequest employee={employee} refresh={fetchAllData} />}
                    {activeTab === 'ovr' && <StaffOVR employee={employee} />}
                    {activeTab === 'templates' && <StaffTemplatesTab employee={employee} />}
                    {activeTab === 'links' && <StaffLinksTab />}
                    {activeTab === 'requests-history' && <StaffRequestsHistory requests={leaveRequests} employee={employee} />}
                    {activeTab === 'evaluations' && <StaffEvaluations evals={evaluations} employee={employee} />}
                    {activeTab === 'messages' && <StaffMessages messages={[]} employee={employee} currentUserId={employee.employee_id} />}
                </div>
            </div>
        </main>
      </div>

      {/* About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm text-center relative animate-in zoom-in-95">
                  <button onClick={() => setShowAboutModal(false)} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full"><X size={18}/></button>
                  <div className="w-20 h-20 bg-emerald-100 rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-emerald-200">
                        <img src="/pwa-192x192.png" className="w-16 h-16 rounded-2xl" alt="Logo" />
                  </div>
                  <h2 className="text-xl font-black text-gray-800">غرب المطار</h2>
                  <p className="text-sm text-gray-500 font-bold mb-6">نظام إدارة الموارد البشرية</p>
                  <div className="space-y-3 text-xs text-gray-600 bg-gray-50 p-4 rounded-2xl border">
                      <div className="flex justify-between"><span>الإصدار:</span><span className="font-bold">1.2.0</span></div>
                      <div className="flex justify-between"><span>التطوير:</span><span className="font-bold">IT Department</span></div>
                  </div>
              </div>
        </div>
      )}
    </div>
  );
}
