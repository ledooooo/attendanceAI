import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest, Evaluation } from '../../types';
import { useSwipeable } from 'react-swipeable';
import { 
  LogOut, User, Clock, Printer, FilePlus, 
  List, Award, Inbox, BarChart, Menu, X, LayoutDashboard,
  Share2, Download, Info, Heart, Smartphone, HelpCircle, Moon, FileText, 
  Link as LinkIcon, AlertTriangle, ShieldCheck, ArrowLeftRight 
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

interface Props {
  employee: Employee;
}

export default function StaffDashboard({ employee }: Props) {
  const { signOut } = useAuth();
  
  const [activeTab, setActiveTab] = useState('news');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [ovrCount, setOvrCount] = useState(0);

  // --- 1. حالات تخزين البيانات (States) ---
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  // حالات PWA
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // --- 2. جلب البيانات من قاعدة البيانات ---
  const fetchAllData = async () => {
    try {
      // جلب سجلات الحضور بناءً على الكود الوظيفي (employee_id)
      const { data: att } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee.employee_id);
      
      // جلب طلبات الإجازات بناءً على الكود الوظيفي
      const { data: reqs } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', employee.employee_id);

      // جلب التقييمات
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
        
        const subscription = supabase
            .channel('ovr_count_watch')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ovr_reports' }, () => {
                checkNewReports();
                alert('⚠️ تنبيه لمسؤول الجودة: وصل تقرير OVR جديد!');
            })
            .subscribe();

        return () => { supabase.removeChannel(subscription); };
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

  // --- قائمة الموظف ---
  const menuItems = [
    { id: 'news', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'profile', label: 'الملف الشخصي', icon: User },
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
                    <img src="/pwa-192x192.png" className="w-8 h-8 rounded-lg" alt="Logo" onError={(e) => e.currentTarget.style.display='none'}/>
                    <LayoutDashboard className="w-8 h-8 text-emerald-600 hidden group-hover:block"/>
                </div>
                <div>
                    <h1 className="font-black text-gray-800 text-sm">غرب المطار</h1>
                    <p className="text-[10px] text-gray-500 font-bold mt-0.5">بوابة الموظفين</p>
                </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-gray-400 hover:text-red-500 transition-colors">
                <X className="w-5 h-5"/>
            </button>
        </div>

        {/* عناصر القائمة */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                  isActive 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 font-bold' 
                    : 'text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-emerald-600'}`} />
                <span className="text-sm">{item.label}</span>
                
                {item.id === 'quality-manager-tab' && item.badge && item.badge > 0 && (
                    <span className="absolute left-4 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                        {item.badge} جديد
                    </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* الجزء السفلي (أيقونات أفقية) */}
        <div className="p-3 border-t bg-gray-50 shrink-0 flex items-center justify-around">
            {!isStandalone && (
                <button 
                    onClick={handleInstallClick} 
                    className="p-3 rounded-xl text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors tooltip relative group"
                    title={deferredPrompt ? "تثبيت التطبيق" : "تعليمات التثبيت"}
                >
                    {deferredPrompt ? <Download className="w-5 h-5" /> : <HelpCircle className="w-5 h-5"/>}
                </button>
            )}
            <button 
                onClick={handleShareApp} 
                className="p-3 rounded-xl text-gray-500 hover:bg-purple-100 hover:text-purple-600 transition-colors"
                title="مشاركة التطبيق"
            >
                <Share2 className="w-5 h-5" />
            </button>
            <button 
                onClick={() => setShowAboutModal(true)} 
                className="p-3 rounded-xl text-gray-500 hover:bg-orange-100 hover:text-orange-600 transition-colors"
                title="عن التطبيق"
            >
                <Info className="w-5 h-5" />
            </button>
            <button 
                onClick={signOut} 
                className="p-3 rounded-xl text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors border border-transparent hover:border-red-200"
                title="تسجيل خروج"
            >
                <LogOut className="w-5 h-5" />
            </button>
        </div>
      </aside>

      {/* المحتوى الرئيسي */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50/50">
        <header className="md:hidden h-16 bg-white border-b flex items-center justify-between px-4 sticky top-0 z-30 shadow-sm shrink-0">
            <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-gray-100 rounded-xl hover:bg-emerald-50 text-gray-600 transition-colors">
                    <Menu className="w-6 h-6"/>
                </button>
                <span className="font-black text-gray-800 text-sm">الرئيسية</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 border-2 border-emerald-100 p-0.5 overflow-hidden">
                 {employee.photo_url ? (
                   <img src={employee.photo_url} className="w-full h-full object-cover rounded-full" alt="Profile" />
                 ) : (
                   <div className="w-full h-full bg-emerald-200 flex items-center justify-center rounded-full text-emerald-700 font-bold">
                       {employee.name.charAt(0)}
                   </div>
                 )}
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-6 pb-20 md:pb-0">
                <div className="hidden md:flex justify-between items-end mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-gray-800">أهلاً بك، {employee.name} 👋</h2>
                        <p className="text-gray-500 mt-1 text-sm font-bold">
                            {employee.role === 'quality_manager' ? 'لوحة تحكم مسؤول الجودة والموظف' : 'إليك نظرة عامة على نشاطك اليوم'}
                        </p>
                    </div>
                    <div className="text-left">
                        <span className="bg-white px-4 py-2 rounded-full text-xs font-bold text-emerald-600 border shadow-sm">
                            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-5 md:p-8 min-h-[500px]">
                    {activeTab === 'news' && (
                        <>
                            <EOMVotingCard employee={employee} />
                            <StaffNewsFeed employee={employee} />
                        </>
                    )}
                    
                    {activeTab === 'profile' && <StaffProfile employee={employee} isEditable={false} />}
                    
                    {/* تمرير البيانات الحقيقية لسجل الحضور */}
                    {activeTab === 'attendance' && (
                        <StaffAttendance 
                            attendance={attendanceData} 
                            selectedMonth={selectedMonth} 
                            setSelectedMonth={setSelectedMonth} 
                            employee={employee} 
                        /> 
                    )}
                    
                    {activeTab === 'evening-schedule' && (
                        <EmployeeEveningSchedule 
                            employeeId={employee.id} 
                            employeeCode={employee.employee_id} 
                            employeeName={employee.name}
                            specialty={employee.specialty} 
                        />
                    )}

                    {activeTab === 'shift-requests' && (
                        <ShiftRequestsTab employee={employee} />
                    )}

                    {activeTab === 'dept-requests' && employee.role === 'head_of_dept' && (
                        <DepartmentRequests hod={employee} />
                    )}

                    {activeTab === 'quality-manager-tab' && employee.role === 'quality_manager' && (
                        <QualityDashboard />
                    )}

                    {/* تمرير البيانات الحقيقية لمكون الإحصائيات */}
                    {activeTab === 'stats' && (
                        <StaffStats 
                            attendance={attendanceData} 
                            evals={evaluations} 
                            requests={leaveRequests} 
                            month={selectedMonth}
                            employee={employee}
                        />
                    )}

                    {activeTab === 'new-request' && (
                        <StaffNewRequest employee={employee} refresh={fetchAllData} />
                    )}
                    
                    {activeTab === 'ovr' && <StaffOVR employee={employee} />}
                    {activeTab === 'templates' && <StaffTemplatesTab employee={employee} />}
                    {activeTab === 'links' && <StaffLinksTab />}
                    
                    {/* تمرير البيانات الحقيقية لسجل الطلبات والتقييمات */}
                    {activeTab === 'requests-history' && <StaffRequestsHistory requests={leaveRequests} employee={employee} />}
                    {activeTab === 'evaluations' && <StaffEvaluations evals={evaluations} employee={employee} />}
                    
                    {activeTab === 'messages' && <StaffMessages messages={[]} employee={employee} currentUserId={employee.employee_id} />}
                </div>
            </div>
        </main>
      </div>

      {/* المودالات المتبقية (About / Install) تبقى كما هي... */}
      {showInstallPopup && deferredPrompt && !isStandalone && (
          <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-in slide-in-from-bottom duration-500 md:hidden">
              <div className="bg-white rounded-[30px] shadow-2xl border border-gray-100 p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                      <div className="bg-emerald-100 p-3 rounded-2xl">
                          <Smartphone className="w-6 h-6 text-emerald-600"/>
                      </div>
                      <div>
                          <h4 className="font-black text-gray-800 text-sm">تثبيت التطبيق</h4>
                          <p className="text-xs text-gray-500 font-bold mt-0.5">لسهولة الوصول والإشعارات</p>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={() => setShowInstallPopup(false)} className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 font-bold"><X className="w-5 h-5"/></button>
                      <button onClick={handleInstallClick} className="py-3 px-6 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-200 font-bold text-sm hover:bg-emerald-700">تثبيت</button>
                  </div>
              </div>
          </div>
      )}

      {showAboutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center relative p-6 animate-in zoom-in-95">
                  <button onClick={() => setShowAboutModal(false)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors">
                      <X className="w-5 h-5"/>
                  </button>
                  <div className="w-20 h-20 bg-emerald-100 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-emerald-200">
                       <img src="/pwa-192x192.png" className="w-16 h-16 rounded-xl" alt="Logo" onError={(e) => e.currentTarget.style.display='none'}/>
                  </div>
                  <h2 className="text-xl font-black text-gray-800 mb-1">غرب المطار</h2>
                  <p className="text-sm text-gray-500 font-bold mb-6">نظام إدارة الموارد البشرية الذكي</p>
                  <div className="space-y-3 text-sm text-gray-600 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <div className="flex justify-between"><span>الإصدار:</span><span className="font-bold font-mono">1.0.0</span></div>
                      <div className="flex justify-between"><span>التطوير:</span><span className="font-bold">قسم الـ IT</span></div>
                  </div>
                  <div className="mt-6 text-xs text-gray-400 flex items-center justify-center gap-1">
                      تم التطوير بكل <Heart className="w-3 h-3 text-red-500 fill-red-500"/>
                  </div>
              </div>
        </div>
      )}
    </div>
  );
}
