لإضافة زر تجريبي لإرسال الإشعارات وإجبارها على العمل، سنضيف زراً بسيطاً في `AdminDashboard` يقوم باستدعاء دالة `send-push-notification` مباشرة.

سأقوم بإضافة تبويب جديد باسم **"اختبار التنبيهات" (`test_push`)** ضمن القائمة، ليظهر فيه زر الإرسال التجريبي.

إليك الكود المعدل لملف `AdminDashboard.tsx`:

### التعديلات التي تمت:

1. إضافة أيقونة `BellRing` من `lucide-react`.
2. إضافة عنصر جديد للقائمة الجانبية: **اختبار التنبيهات**.
3. إضافة دالة `sendTestNotification` التي تقوم بالآتي:
* تجلب الـ `user_id` الخاص بالمدير الحالي.
* ترسل إشعاراً لنفس المستخدم (المدير) للتجربة.
* تستدعي `supabase.functions.invoke`.


4. إضافة واجهة العرض الخاصة بالتبويب الجديد (`activeTab === 'test_push'`).

```tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { Employee } from '../../types';
import { useSwipeable } from 'react-swipeable';
import { 
  Users, Clock, CalendarRange, ClipboardList, 
  Activity, Settings, LogOut, Menu, LayoutDashboard, X, Mail, FileBarChart,
  Newspaper, Trophy, AlertTriangle, MessageCircle, Home, FileArchive, BookOpen,
  Database, BellRing, Smartphone // ✅ تمت إضافة BellRing و Smartphone
} from 'lucide-react';

// استيراد التبويبات والمكونات
import HomeTab from './components/HomeTab';
import DoctorsTab from './components/DoctorsTab';
import AttendanceTab from './components/AttendanceTab';
import EveningSchedulesTab from './components/EveningSchedulesTab';
import LeavesTab from './components/LeavesTab';
import EvaluationsTab from './components/EvaluationsTab';
import SettingsTab from './components/SettingsTab';
import ReportsTab from './components/ReportsTab';
import SendReportsTab from './components/SendReportsTab';
import NewsManagementTab from './components/NewsManagementTab';
import BirthdayWidget from './components/BirthdayWidget';
import EOMManager from './components/EOMManager';
import NotificationBell from '../../components/ui/NotificationBell';
import AdminMessagesTab from './components/AdminMessagesTab';
import QualityDashboard from './components/QualityDashboard';
import AdminLibraryManager from './components/AdminLibraryManager'; 
import AdminDataReports from './components/AdminDataReports'; 
import AbsenceReportTab from './components/AbsenceReportTab';
import { FileX } from 'lucide-react';

export default function AdminDashboard() {
  const { signOut, user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('home');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [centerName, setCenterName] = useState('جاري التحميل...');
  const [centerId, setCenterId] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [qualityAlerts, setQualityAlerts] = useState(0); 

  // حالة لواجهة الاختبار
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState('');

  // إعدادات السحب (Swipe)
  const swipeHandlers = useSwipeable({
    onSwipedLeft: (eventData) => {
      if (eventData.initial[0] > window.innerWidth / 2) { 
        setIsSidebarOpen(true);
      }
    },
    onSwipedRight: () => setIsSidebarOpen(false),
    trackMouse: true,
    delta: 50,
  });

  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('*').order('name');
    if (data) setEmployees(data);
  };

  const fetchSettings = async () => {
      const { data } = await supabase.from('general_settings').select('center_name, id').maybeSingle();
      if (data) {
          setCenterName(data.center_name || 'المركز الطبي');
          setCenterId(data.id);
      }
  };

  const fetchQualityAlerts = async () => {
      const { count } = await supabase
          .from('ovr_reports')
          .select('*', { count: 'exact', head: true })
          .neq('status', 'new'); 
      setQualityAlerts(count || 0);
  };

  useEffect(() => {
    fetchEmployees();
    fetchSettings();
    fetchQualityAlerts();

    const subscription = supabase
        .channel('admin_ovr_watch')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ovr_reports' }, () => {
            fetchQualityAlerts();
        })
        .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  // 🔥 دالة إرسال التنبيه التجريبي
  const sendTestNotification = async () => {
    if (!user) return;
    setTestLoading(true);
    setTestResult('جاري الإرسال...');

    try {
        const { data, error } = await supabase.functions.invoke('send-push-notification', {
            body: {
                userId: user.id, // نرسل للمدير نفسه للتجربة
                title: '🔔 تنبيه تجريبي',
                body: `تم إرسال هذا التنبيه في: ${new Date().toLocaleTimeString('ar-EG')}`,
                url: '/admin'
            }
        });

        if (error) throw error;
        setTestResult('✅ تم الإرسال بنجاح! راقب هاتفك الآن.');
        console.log('Push Result:', data);

    } catch (err: any) {
        console.error('Push Error:', err);
        setTestResult(`❌ فشل الإرسال: ${err.message}`);
    } finally {
        setTestLoading(false);
    }
  };

  const menuItems = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'doctors', label: 'شئون الموظفين', icon: Users },
    { id: 'news', label: 'إدارة الأخبار', icon: Newspaper },
    { id: 'motivation', label: 'التحفيز والجوائز', icon: Trophy },
    { id: 'all_messages', label: 'المحادثات والرسائل', icon: MessageCircle },
    { id: 'attendance', label: 'سجلات البصمة', icon: Clock },
    { id: 'schedules', label: 'جداول النوبتجية', icon: CalendarRange },
    { id: 'reports', label: 'التقارير والإحصائيات', icon: FileBarChart },
    { id: 'leaves', label: 'طلبات الإجازات', icon: ClipboardList },
    { id: 'evaluations', label: 'التقييمات الطبية', icon: Activity },
    { id: 'data-reports', label: 'بيانات وتقارير', icon: Database }, 
    { id: 'library-manager', label: 'إدارة المكتبة والسياسات', icon: FileArchive },
    { id: 'absence-report', label: 'تقرير الغياب', icon: FileX },
    { 
        id: 'quality', 
        label: 'إدارة الجودة (OVR)', 
        icon: AlertTriangle,
        badge: qualityAlerts 
    },
    { id: 'send_reports', label: 'إرسال بالبريد', icon: Mail },
    { id: 'test_push', label: 'اختبار التنبيهات', icon: BellRing }, // 🔥 الزر الجديد
    { id: 'settings', label: 'إعدادات النظام', icon: Settings },
  ];

  return (
    <div {...swipeHandlers} className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans text-right relative overflow-x-hidden" dir="rtl">
      
      {/* الشريط العلوي للموبايل */}
      <div className="md:hidden bg-white p-4 flex justify-between items-center shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                <Menu className="w-6 h-6 text-gray-700"/>
            </button>
            <span className="font-black text-emerald-800 text-sm truncate max-w-[150px]">{centerName}</span>
        </div>
        <NotificationBell />
      </div>

<aside className={`
    fixed inset-y-0 right-0 z-50 w-64 bg-white border-l shadow-2xl transform transition-transform duration-300 ease-in-out
    ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} 
    md:translate-x-0 md:static md:shadow-none md:flex md:flex-col h-screen
`}>
  <div className="md:hidden p-4 flex justify-end shrink-0 bg-white">
      <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 bg-gray-50 rounded-full text-gray-500">
          <X className="w-5 h-5"/>
      </button>
  </div>

  <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5 custom-scrollbar bg-white">
    {menuItems.map(item => (
      <button
        key={item.id}
        onClick={() => {
            setActiveTab(item.id);
            setIsSidebarOpen(false); 
        }}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 relative group ${
          activeTab === item.id 
            ? 'bg-emerald-600 text-white shadow-sm font-bold' 
            : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 font-medium'
        }`}
      >
        <item.icon className={`w-4 h-4 shrink-0 ${activeTab === item.id ? 'text-white' : 'text-gray-400 group-hover:text-emerald-600'}`} />
        <span className="text-xs">{item.label}</span>
        
        {item.badge && item.badge > 0 && (
            <span className="absolute left-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                {item.badge}
            </span>
        )}
      </button>
    ))}
  </nav>

  <div className="p-3 border-t bg-gray-50 shrink-0">
     <button 
       onClick={signOut} 
       className="w-full flex items-center justify-center gap-2 text-red-500 py-2 rounded-lg hover:bg-red-100 transition-all font-bold border border-red-100 text-xs"
     >
       <LogOut className="w-4 h-4 shrink-0" />
       تسجيل خروج
     </button>
  </div>
</aside>

      {isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* المحتوى الرئيسي */}
      <main className="flex-1 flex flex-col h-[calc(100vh-64px)] md:h-screen overflow-hidden bg-gray-50/50">
        <header className="hidden md:flex h-20 bg-white border-b justify-between items-center px-8 shadow-sm shrink-0">
            <div>
                <h2 className="text-xl font-black text-gray-800">{centerName}</h2>
                <p className="text-xs text-gray-400 font-bold mt-1">المسؤول: {user?.email}</p>
            </div>
            <NotificationBell />
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar pb-20 md:pb-8">
            {activeTab === 'home' && <HomeTab employees={employees} setActiveTab={setActiveTab} />}
            {activeTab === 'doctors' && <DoctorsTab employees={employees} onRefresh={fetchEmployees} centerId={centerId} />}
            {activeTab === 'news' && <NewsManagementTab />}
            {activeTab === 'motivation' && (
               <div className="space-y-6 max-w-4xl mx-auto">
                   <BirthdayWidget employees={employees} />
                   <EOMManager />
               </div>
            )}
            {activeTab === 'all_messages' && <AdminMessagesTab employees={employees} />}
            {activeTab === 'attendance' && <AttendanceTab onRefresh={()=>{}} />}
            {activeTab === 'schedules' && <EveningSchedulesTab employees={employees} />}
            {activeTab === 'reports' && <ReportsTab />}
            {activeTab === 'leaves' && <LeavesTab onRefresh={()=>{}} />}
            {activeTab === 'evaluations' && <EvaluationsTab employees={employees} />}
            {activeTab === 'library-manager' && <AdminLibraryManager />} 
            {activeTab === 'quality' && <QualityDashboard />}
            {activeTab === 'data-reports' && <AdminDataReports employees={employees} />}
            {activeTab === 'settings' && <SettingsTab onUpdateName={fetchSettings} />}
            {activeTab === 'send_reports' && <SendReportsTab />}
            {activeTab === 'absence-report' && <AbsenceReportTab />}     
            
            {/* 🔥 واجهة اختبار التنبيهات */}
            {activeTab === 'test_push' && (
                <div className="max-w-md mx-auto bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center space-y-6 mt-10">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600">
                        <Smartphone className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-800">اختبار إشعارات الموبايل</h2>
                        <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                            اضغط على الزر أدناه لإرسال إشعار تجريبي إلى جهازك فوراً.
                            <br />
                            (تأكد أنك سمحت بالإشعارات، وأن التطبيق مغلق للتجربة الحقيقية)
                        </p>
                    </div>

                    <button
                        onClick={sendTestNotification}
                        disabled={testLoading}
                        className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg hover:shadow-blue-200 active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {testLoading ? 'جاري الإرسال...' : '🚀 إرسال تنبيه تجريبي'}
                    </button>

                    {testResult && (
                        <div className={`p-4 rounded-xl text-sm font-bold ${testResult.includes('نجح') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {testResult}
                        </div>
                    )}
                </div>
            )}
        </div>
      </main>
    </div>
  );
}

```
