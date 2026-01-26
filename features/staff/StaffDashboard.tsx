import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest, Evaluation } from '../../types';
import { useSwipeable } from 'react-swipeable';
// ✅ استيراد React Query و Notification Permission
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { requestNotificationPermission } from '../../utils/pushNotifications'; 

import { 
  LogOut, User, Clock, Printer, FilePlus, 
  List, Award, Inbox, BarChart, Menu, X, LayoutDashboard,
  Share2, Info, Moon, FileText, ListTodo, 
  Link as LinkIcon, AlertTriangle, ShieldCheck, ArrowLeftRight, Bell, BookOpen, 
  Sparkles, Calendar 
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

interface Props {
  employee: Employee;
}

export default function StaffDashboard({ employee }: Props) {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState('news');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [ovrCount, setOvrCount] = useState(0);

  // --- 1. حالات تخزين البيانات (للمكونات القديمة) ---
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  // حالات PWA
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // --- 2. إعداد الإشعارات ---
  useEffect(() => {
    if (employee?.employee_id) {
        requestNotificationPermission(employee.employee_id);
    }
  }, [employee.employee_id]);

  // جلب الإشعارات
  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', employee.employee_id) 
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
  };

  const markNotifsAsRead = async () => {
    if (notifications.some(n => !n.is_read)) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', employee.employee_id);
      
      // تحديث البيانات بعد القراءة
      fetchNotifications();
      queryClient.invalidateQueries({ queryKey: ['staff_badges'] });
    }
    setShowNotifMenu(!showNotifMenu);
  };

  // 🔥 3. استعلام قوي لجلب العدادات (Badges) للأزرار
  const { data: staffBadges = { messages: 0, tasks: 0, swaps: 0, news: 0, ovr_replies: 0 } } = useQuery({
      queryKey: ['staff_badges', employee.employee_id],
      queryFn: async () => {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1); // آخر 24 ساعة للأخبار

          const [msg, tasks, swaps, news, ovrReplies] = await Promise.all([
              // 1. رسائل غير مقروءة
              supabase.from('messages').select('*', { count: 'exact', head: true })
                  .eq('to_user', employee.employee_id).eq('is_read', false),
              
              // 2. تكليفات معلقة
              supabase.from('tasks').select('*', { count: 'exact', head: true })
                  .eq('employee_id', employee.employee_id).eq('status', 'pending'),

              // 3. طلبات تبديل واردة (تستهدفني)
              supabase.from('shift_swap_requests').select('*', { count: 'exact', head: true })
                  .eq('target_employee_id', employee.employee_id).eq('status', 'pending_target'),

              // 4. أخبار جديدة
              supabase.from('news').select('*', { count: 'exact', head: true })
                  .gte('created_at', yesterday.toISOString()),

              // 5. ردود OVR (عن طريق الإشعارات غير المقروءة)
              // نبحث في جدول الإشعارات عن نوع 'ovr_reply' غير المقروء
              supabase.from('notifications').select('*', { count: 'exact', head: true })
                  .eq('user_id', employee.employee_id)
                  .eq('type', 'ovr_reply') // تأكد من استخدام هذا النوع عند الرد
                  .eq('is_read', false)
          ]);

          return {
              messages: msg.count || 0,
              tasks: tasks.count || 0,
              swaps: swaps.count || 0,
              news: news.count || 0,
              ovr_replies: ovrReplies.count || 0
          };
      },
      refetchInterval: 5000, // تحديث كل 5 ثواني
  });

  // --- 4. جلب البيانات الأساسية + Realtime ---
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
          // تحديث الإشعارات والعدادات عند وصول شيء جديد
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

  // عداد الجودة (لمدير الجودة فقط)
  useEffect(() => {
    if (employee.role === 'quality_manager') {
        const checkNewReports = async () => {
            const { count } = await supabase.from('ovr_reports').select('*', { count: 'exact', head: true }).eq('status', 'new');
            setOvrCount(count || 0);
        };
        checkNewReports();
    }
  }, [employee.role]);

  // إعدادات القائمة
  const swipeHandlers = useSwipeable({
    onSwipedLeft: (eventData) => { if (eventData.initial[0] > window.innerWidth / 2) setIsSidebarOpen(true); },
    onSwipedRight: () => setIsSidebarOpen(false),
    trackMouse: true, delta: 50,
  });

  // PWA Logic
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

  // ✅ تعريف عناصر القائمة مع البادجات المربوطة بالـ Query
  const menuItems = [
    { id: 'news', label: 'الرئيسية', icon: LayoutDashboard, badge: staffBadges.news },
    { id: 'profile', label: 'الملف الشخصي', icon: User },
    
    { id: 'tasks', label: 'التكليفات', icon: ListTodo, badge: staffBadges.tasks },
    { id: 'shift-requests', label: 'طلبات التبديل', icon: ArrowLeftRight, badge: staffBadges.swaps },
    { id: 'messages', label: 'الرسائل', icon: Inbox, badge: staffBadges.messages },
    { id: 'ovr', label: 'إبلاغ OVR', icon: AlertTriangle, badge: staffBadges.ovr_replies }, // بادج الردود
    
    { id: 'library', label: 'المكتبة والسياسات', icon: BookOpen },
    ...(employee.role === 'quality_manager' ? [{ id: 'quality-manager-tab', label: 'مسؤول الجودة', icon: ShieldCheck, badge: ovrCount }] : []),
    { id: 'attendance', label: 'سجل الحضور', icon: Clock },
    { id: 'evening-schedule', label: 'النوبتجيات المسائية', icon: Moon },
    ...(employee.role === 'head_of_dept' ? [{ id: 'dept-requests', label: 'إدارة القسم', icon: FileText }] : []),
    { id: 'stats', label: 'الإحصائيات', icon: BarChart },
    { id: 'new-request', label: 'تقديم طلب', icon: FilePlus },
    { id: 'requests-history', label: 'سجل الطلبات', icon: List },
    { id: 'templates', label: 'نماذج رسمية', icon: Printer },
    { id: 'links', label: 'روابط هامة', icon: LinkIcon },
    { id: 'evaluations', label: 'التقييمات', icon: Award },
  ];

  const unreadNotifsCount = notifications.filter(n => !n.is_read).length;

  return (
    <div {...swipeHandlers} className="h-screen w-full bg-gray-50 flex overflow-hidden font-sans text-right" dir="rtl">
      
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsSidebarOpen(false)} />}

      <aside className={`fixed inset-y-0 right-0 z-50 w-72 bg-white border-l shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} md:translate-x-0 md:static md:shadow-none`}>
        <div className="h-20 flex items-center justify-between px-6 border-b shrink-0 bg-emerald-50/50">
            <div className="flex items-center gap-3">
                <div className="bg-white p-1.5 rounded-xl shadow-sm border border-emerald-100">
                    <img src="/pwa-192x192.png" className="w-7 h-7 rounded-lg" alt="Logo" />
                </div>
                <div>
                    <h1 className="font-black text-gray-800 text-sm">غرب المطار</h1>
                    <p className="text-[10px] text-gray-500 font-bold">بوابة الموظفين</p>
                </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-gray-400"><X className="w-5 h-5"/></button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${isActive ? 'bg-emerald-600 text-white shadow-md font-bold' : 'text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 font-medium'}`}
              >
                <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span className="text-sm">{item.label}</span>
                
                {/* 🔥 عرض البادج */}
                {item.badge && item.badge > 0 && (
                    <span className="absolute left-4 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                        {item.badge}
                    </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t bg-gray-50 flex items-center justify-around shrink-0">
            <button onClick={handleShareApp} className="p-2.5 rounded-xl text-gray-500 hover:bg-purple-100"><Share2 className="w-5 h-5" /></button>
            <button onClick={() => setShowAboutModal(true)} className="p-2.5 rounded-xl text-gray-500 hover:bg-orange-100"><Info className="w-5 h-5" /></button>
            <button onClick={signOut} className="p-2.5 rounded-xl text-red-400 hover:bg-red-100"><LogOut className="w-5 h-5" /></button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-gray-100/50">
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 shadow-sm shrink-0">
            <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-gray-100 rounded-xl"><Menu className="w-6 h-6"/></button>
                <span className="font-black text-gray-800 hidden md:block">لوحة التحكم</span>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative">
                    <button onClick={markNotifsAsRead} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors relative">
                        <Bell className={`w-6 h-6 ${unreadNotifsCount > 0 ? 'text-emerald-600' : 'text-gray-600'}`} />
                        {unreadNotifsCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-white animate-bounce">{unreadNotifsCount}</span>
                        )}
                    </button>
                    {showNotifMenu && (
                        <div className="absolute left-0 mt-3 w-80 bg-white rounded-3xl shadow-xl border border-gray-100 z-[100] overflow-hidden animate-in fade-in zoom-in-95">
                            <div className="p-3 border-b bg-gray-50/50 font-black text-sm text-gray-800 flex justify-between">
                                <span>آخر التنبيهات</span>
                                <button onClick={() => setShowNotifMenu(false)} className="text-gray-400"><X size={16}/></button>
                            </div>
                            <div className="max-h-80 overflow-y-auto custom-scrollbar">
                                {notifications.length === 0 ? (
                                    <p className="p-8 text-center text-gray-400 text-xs">لا توجد إشعارات حالياً</p>
                                ) : (
                                    notifications.map(n => (
                                        <div 
                                            key={n.id} 
                                            onClick={() => {
                                                if(n.type === 'task' || n.type === 'task_update') { setActiveTab('tasks'); }
                                                else if(n.type === 'message') { setActiveTab('messages'); }
                                                else if(n.type === 'ovr_reply') { setActiveTab('ovr'); }
                                                setShowNotifMenu(false);
                                            }}
                                            className={`p-3 border-b border-gray-50 flex gap-3 hover:bg-gray-50 cursor-pointer ${!n.is_read ? 'bg-emerald-50/30' : ''}`}
                                        >
                                            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 font-bold uppercase text-xs">
                                                {n.type === 'task' ? <ListTodo size={16}/> : <Bell size={16}/>}
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="text-xs text-gray-800 leading-relaxed font-bold">{n.title}</p>
                                                <p className="text-xs text-gray-500 leading-relaxed">{n.message}</p>
                                                <p className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={10}/> {new Date(n.created_at).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-9 h-9 rounded-full border-2 border-emerald-100 p-0.5 overflow-hidden">
                    {employee.photo_url ? <img src={employee.photo_url} className="w-full h-full object-cover rounded-full" alt="Profile" /> : <div className="w-full h-full bg-emerald-200 flex items-center justify-center rounded-full text-emerald-700 font-bold text-sm">{employee.name.charAt(0)}</div>}
                </div>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 md:p-6 custom-scrollbar">
            <div className="max-w-6xl mx-auto space-y-4">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-200/60 p-4 md:p-6 min-h-[500px]">
                    {activeTab === 'news' && (
                        <div className="space-y-4">
                            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-4 text-white shadow-md flex items-center justify-between relative overflow-hidden">
                                <div className="relative z-10">
                                    <h2 className="font-bold text-lg flex items-center gap-2">مرحباً، {employee.name.split(' ')[0]} 👋</h2>
                                    <p className="text-xs text-emerald-100 mt-1 opacity-90">نتمنى لك يوماً سعيداً ومليئاً بالإنجازات</p>
                                </div>
                                <div className="hidden sm:block text-right relative z-10">
                                    <div className="text-xs font-medium opacity-80 mb-0.5">التاريخ اليوم</div>
                                    <div className="text-sm font-bold flex items-center gap-1 justify-end">
                                        <Calendar className="w-4 h-4"/>
                                        {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </div>
                                </div>
                                <Sparkles className="absolute -bottom-4 -left-4 w-24 h-24 text-white opacity-10 rotate-12" />
                            </div>
                            <EOMVotingCard employee={employee} />
                            <StaffNewsFeed employee={employee} />
                        </div>
                    )}
                    
                    {activeTab === 'profile' && <StaffProfile employee={employee} isEditable={false} />}
                    {activeTab === 'library' && <StaffLibrary />}
                    {activeTab === 'attendance' && <StaffAttendance attendance={attendanceData} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} employee={employee} />}
                    {activeTab === 'evening-schedule' && <EmployeeEveningSchedule employeeId={employee.id} employeeCode={employee.employee_id} employeeName={employee.name} specialty={employee.specialty} />}
                    {activeTab === 'shift-requests' && <ShiftRequestsTab employee={employee} />}
                    {activeTab === 'dept-requests' && employee.role === 'head_of_dept' && <DepartmentRequests hod={employee} />}
                    {activeTab === 'quality-manager-tab' && employee.role === 'quality_manager' && <QualityDashboard />}
                    {activeTab === 'stats' && <StaffStats attendance={attendanceData} evals={evaluations} requests={leaveRequests} month={selectedMonth} employee={employee} />}
                    {activeTab === 'new-request' && <StaffNewRequest employee={employee} refresh={fetchAllData} />}
                    {activeTab === 'ovr' && <StaffOVR employee={employee} />}
                    {activeTab === 'templates' && <StaffTemplatesTab employee={employee} />}
                    {activeTab === 'links' && <StaffLinksTab />}
                    {activeTab === 'tasks' && <StaffTasks employee={employee} />}
                    {activeTab === 'requests-history' && <StaffRequestsHistory requests={leaveRequests} employee={employee} />}
                    {activeTab === 'evaluations' && <StaffEvaluations evals={evaluations} employee={employee} />}
                    {activeTab === 'messages' && <StaffMessages messages={[]} employee={employee} currentUserId={employee.employee_id} />}
                </div>
            </div>
        </main>
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
