import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee } from '../../types';
import { 
  LogOut, User, Clock, Printer, FilePlus, 
  List, Award, Inbox, BarChart, Menu, X, LayoutDashboard 
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
    // الحاوية الرئيسية: تملا الشاشة وتمنع التمرير الخارجي
    <div className="h-screen w-full bg-gray-50 flex overflow-hidden font-sans text-right" dir="rtl">
      
      {/* --- 1. القائمة الجانبية (Sidebar) --- */}
      {/* طبقة التعتيم (فقط للموبايل عند فتح القائمة) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* جسم القائمة */}
      <aside className={`
          fixed inset-y-0 right-0 z-50 w-72 bg-white border-l shadow-2xl 
          transform transition-transform duration-300 ease-in-out flex flex-col
          ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} 
          md:translate-x-0 md:static md:shadow-none
      `}>
        {/* رأس القائمة */}
        <div className="h-20 flex items-center justify-between px-6 border-b shrink-0">
           <div className="flex items-center gap-3">
               <div className="bg-emerald-100 p-2 rounded-lg">
                   <LayoutDashboard className="w-6 h-6 text-emerald-700"/>
               </div>
               <div>
                   <h1 className="font-black text-gray-800 text-sm">بوابة الموظف</h1>
                   <p className="text-[10px] text-gray-400 font-bold mt-0.5">{employee.name.split(' ').slice(0, 2).join(' ')}</p>
               </div>
           </div>
           <button 
             onClick={() => setIsSidebarOpen(false)} 
             className="md:hidden p-2 bg-gray-50 rounded-full text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
           >
               <X className="w-5 h-5"/>
           </button>
        </div>

        {/* روابط التنقل */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
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
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 group ${
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


      {/* --- 2. المحتوى الرئيسي (Main Content) --- */}
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

        {/* منطقة المحتوى المتغير (Scrollable) */}
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

                {/* عرض المحتوى حسب التبويب */}
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
                  {activeTab === 'evaluations' && <StaffEvaluations evals={[]} />}
                    {activeTab === 'messages' && <StaffMessages messages={[]} />}
                </div>
            </div>
        </main>
      </div>
    </div>
  );
}
