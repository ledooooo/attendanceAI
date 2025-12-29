import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee } from '../../types';
import { 
  LogOut, User, Clock, Printer, FilePlus, 
  List, Award, Inbox, BarChart, Menu, X, LayoutDashboard,
  Share2, Download, Info, Heart
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

interface Props {
  employee: Employee;
}

export default function StaffDashboard({ employee }: Props) {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // حالات المميزات الجديدة
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);

  // 1. الاستماع لحدث تثبيت التطبيق
  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  // دالة التثبيت
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // دالة المشاركة
  const handleShareApp = async () => {
    const shareData = {
        title: 'تطبيق غرب المطار',
        text: 'تابع حضورك وانصرافك وقدم طلباتك بسهولة عبر تطبيق غرب المطار',
        url: window.location.origin
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            // نسخ الرابط في حالة عدم دعم المتصفح للمشاركة
            navigator.clipboard.writeText(window.location.origin);
            alert('تم نسخ رابط التطبيق!');
        }
    } catch (err) {
        console.error('Error sharing:', err);
    }
  };

  const menuItems = [
    { id: 'profile', label: 'الملف الشخصي', icon: User },
    { id: 'attendance', label: 'سجل الحضور', icon: Clock },
    { id: 'stats', label: 'الإحصائيات', icon: BarChart },
    { id: 'new-request', label: 'تقديم طلب', icon: FilePlus },
    { id: 'templates', label: 'نماذج رسمية', icon: Printer },
    { id: 'requests-history', label: 'سجل الطلبات', icon: List },
    { id: 'evaluations', label: 'التقييمات', icon: Award },
    { id: 'messages', label: 'الرسائل', icon: Inbox },
  ];

  return (
    // الحاوية الرئيسية
    <div className="h-screen w-full bg-gray-50 flex overflow-hidden font-sans text-right" dir="rtl">
      
      {/* Overlay للموبايل */}
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
        {/* رأس القائمة */}
        <div className="h-24 flex items-center justify-between px-6 border-b shrink-0 bg-emerald-50/50">
           <div className="flex items-center gap-3">
               <div className="bg-white p-2 rounded-xl shadow-sm border border-emerald-100">
                   {/* أيقونة التطبيق المصغرة */}
                   <img src="/pwa-192x192.png" className="w-8 h-8 rounded-lg" alt="Logo" onError={(e) => e.currentTarget.src = 'https://via.placeholder.com/192'}/>
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

        {/* روابط التنقل */}
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
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 font-bold' 
                    : 'text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-emerald-600'}`} />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}

          <div className="my-4 border-t border-gray-100"></div>
          
          {/* أزرار الإضافات الجديدة (تثبيت، مشاركة، عن التطبيق) */}
          <div className="space-y-1">
             {/* زر التثبيت يظهر فقط إذا كان التطبيق قابل للتثبيت */}
             {deferredPrompt && (
                <button onClick={handleInstallClick} className="w-full flex items-center gap-4 px-4 py-2.5 rounded-xl text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors font-medium">
                    <Download className="w-5 h-5 text-blue-500" />
                    <span className="text-sm">تثبيت التطبيق</span>
                </button>
             )}

             <button onClick={handleShareApp} className="w-full flex items-center gap-4 px-4 py-2.5 rounded-xl text-gray-600 hover:bg-purple-50 hover:text-purple-600 transition-colors font-medium">
                 <Share2 className="w-5 h-5 text-purple-500" />
                 <span className="text-sm">مشاركة التطبيق</span>
             </button>

             <button onClick={() => setShowAboutModal(true)} className="w-full flex items-center gap-4 px-4 py-2.5 rounded-xl text-gray-600 hover:bg-orange-50 hover:text-orange-600 transition-colors font-medium">
                 <Info className="w-5 h-5 text-orange-500" />
                 <span className="text-sm">عن التطبيق</span>
             </button>
          </div>
        </nav>

        {/* زر الخروج */}
        <div className="p-4 border-t bg-gray-50 shrink-0">
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-red-500 px-4 py-3 rounded-xl hover:bg-red-50 hover:border-red-100 transition-all font-bold shadow-sm text-sm"
          >
            <LogOut size={18} />
            تسجيل خروج
          </button>
        </div>
      </aside>

      {/* المحتوى الرئيسي */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50/50">
        
        {/* شريط العنوان (للموبايل فقط) */}
        <header className="md:hidden h-16 bg-white border-b flex items-center justify-between px-4 sticky top-0 z-30 shadow-sm shrink-0">
            <div className="flex items-center gap-3">
                <button 
                    onClick={() => setIsSidebarOpen(true)} 
                    className="p-2 bg-gray-100 rounded-xl hover:bg-emerald-50 text-gray-600 transition-colors"
                >
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

        {/* منطقة المحتوى المتغير */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-6 pb-20 md:pb-0">
                
                {/* ترويسة الترحيب (للكمبيوتر) */}
                <div className="hidden md:flex justify-between items-end mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-gray-800">أهلاً بك، {employee.name} 👋</h2>
                        <p className="text-gray-500 mt-1 text-sm font-bold">إليك نظرة عامة على نشاطك اليوم</p>
                    </div>
                    <div className="text-left">
                        <span className="bg-white px-4 py-2 rounded-full text-xs font-bold text-emerald-600 border shadow-sm">
                            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-5 md:p-8 min-h-[500px]">
                    {activeTab === 'profile' && <StaffProfile employee={employee} isEditable={false} />}
                    {activeTab === 'attendance' && (
                        <StaffAttendance 
                            attendance={[]} 
                            selectedMonth={new Date().toISOString().slice(0, 7)} 
                            setSelectedMonth={()=>{}} 
                            employee={employee} 
                        /> 
                    )}
                    {activeTab === 'stats' && <StaffStats attendance={[]} evals={[]} requests={[]} month={new Date().toISOString().slice(0, 7)} />} 
                    {activeTab === 'new-request' && <StaffNewRequest employee={employee} refresh={()=>{}} />}
                    {activeTab === 'templates' && <StaffTemplatesTab employee={employee} />}
                    {activeTab === 'requests-history' && <StaffRequestsHistory requests={[]} employee={employee} />}
                    {activeTab === 'evaluations' && <StaffEvaluations evals={[]} employee={employee} />}
                    {activeTab === 'messages' && <StaffMessages messages={[]} employee={employee} currentUserId={employee.employee_id} />}
                </div>
            </div>
        </main>
      </div>

      {/* نافذة "عن التطبيق" */}
      {showAboutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
             <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center relative p-6 animate-in zoom-in-95">
                 <button 
                    onClick={() => setShowAboutModal(false)}
                    className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"
                 >
                     <X className="w-5 h-5"/>
                 </button>

                 <div className="w-20 h-20 bg-emerald-100 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-emerald-200">
                      <img src="/pwa-192x192.png" className="w-16 h-16 rounded-xl" alt="Logo" onError={(e) => e.currentTarget.style.display='none'}/>
                      <LayoutDashboard className="w-10 h-10 text-emerald-600" style={{display: 'none'}} /> 
                 </div>

                 <h2 className="text-xl font-black text-gray-800 mb-1">غرب المطار</h2>
                 <p className="text-sm text-gray-500 font-bold mb-6">نظام إدارة الموارد البشرية الذكي</p>

                 <div className="space-y-3 text-sm text-gray-600 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                     <div className="flex justify-between">
                         <span>الإصدار:</span>
                         <span className="font-bold font-mono">1.0.0 (Beta)</span>
                     </div>
                     <div className="flex justify-between">
                         <span>التطوير:</span>
                         <span className="font-bold">قسم تكنولوجيا المعلومات</span>
                     </div>
                     <div className="flex justify-between">
                         <span>الدعم الفني:</span>
                         <span className="font-bold">IT Support</span>
                     </div>
                 </div>

                 <div className="mt-6 text-xs text-gray-400 flex items-center justify-center gap-1">
                     تم التطوير بكل <Heart className="w-3 h-3 text-red-500 fill-red-500"/> لفريق العمل
                 </div>
             </div>
        </div>
      )}
    </div>
  );
}
