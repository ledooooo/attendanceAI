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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // التحكم في القائمة للموبايل

  // قائمة التنقل
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
    <div className="min-h-screen bg-gray-50 flex font-sans text-right relative overflow-x-hidden" dir="rtl">
      
      {/* 1. الشريط العلوي (للموبايل فقط) */}
      <div className="md:hidden bg-white p-4 flex justify-between items-center shadow-sm sticky top-0 z-40 w-full border-b">
        <div className="flex items-center gap-3">
            <button 
                onClick={() => setIsSidebarOpen(true)} 
                className="p-2 bg-gray-100 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
            >
                <Menu className="w-6 h-6 text-gray-700"/>
            </button>
            <span className="font-black text-emerald-800 text-sm">بوابة الموظف</span>
        </div>
        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200 overflow-hidden">
             {employee.photo_url ? (
               <img src={employee.photo_url} className="w-full h-full object-cover" alt="Profile" />
             ) : (
               <User className="text-emerald-600 w-5 h-5"/>
             )}
        </div>
      </div>

      {/* 2. القائمة الجانبية (Sidebar) */}
      {/* Responsive: Fixed & Hidden on Mobile (Slide-in), Static on Desktop */}
      <aside className={`
          fixed inset-y-0 right-0 z-50 w-72 bg-white border-l shadow-2xl transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} 
          md:translate-x-0 md:static md:shadow-none md:flex md:flex-col md:h-screen
      `}>
        <div className="p-6 border-b flex items-center justify-between h-24 shrink-0">
           <div className="flex flex-col">
               <h1 className="text-lg font-black text-emerald-800 flex items-center gap-2">
                   <LayoutDashboard className="w-6 h-6"/> القائمة الرئيسية
               </h1>
               <p className="text-xs text-gray-400 font-bold mt-1 mr-8">{employee.name.split(' ').slice(0, 2).join(' ')}</p>
           </div>
           {/* زر إغلاق القائمة (موبايل فقط) */}
           <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 bg-red-50 rounded-full text-red-500 hover:bg-red-100 transition-colors">
               <X className="w-5 h-5"/>
           </button>
        </div>

        <nav className="p-4 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false); // إغلاق القائمة عند الاختيار (موبايل)
                }}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 font-bold translate-x-[-5px]' 
                    : 'text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 font-medium'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t bg-gray-50 shrink-0">
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-red-500 px-4 py-3 rounded-xl hover:bg-red-50 hover:border-red-100 transition-all font-bold shadow-sm"
          >
            <LogOut size={18} />
            تسجيل خروج
          </button>
        </div>
      </aside>

      {/* 3. طبقة التعتيم (Overlay) للموبايل */}
      {isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 4. منطقة المحتوى الرئيسي */}
      <main className="flex-1 p-4 md:p-8 w-full max-w-[100vw] overflow-hidden overflow-y-auto h-[calc(100vh-73px)] md:h-screen bg-gray-50/50">
        
        {/* هيدر الصفحة الداخلي (للكمبيوتر فقط) */}
        <div className="hidden md:flex bg-white p-6 rounded-[30px] shadow-sm border border-gray-100 mb-8 justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-emerald-100">
                    {employee.photo_url ? <img src={employee.photo_url} className="w-full h-full object-cover" /> : <User className="text-emerald-600 w-8 h-8"/>}
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-800">{employee.name}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg font-bold">{employee.specialty}</span>
                        <span className="text-xs text-gray-400 font-mono font-bold">#{employee.employee_id}</span>
                    </div>
                </div>
            </div>
            <div className="text-left">
                <p className="text-sm font-bold text-gray-400">تاريخ اليوم</p>
                <p className="text-lg font-black text-emerald-600">{new Date().toLocaleDateString('ar-EG')}</p>
            </div>
        </div>

        {/* عرض التبويبات */}
        <div className="bg-white p-4 md:p-8 rounded-[30px] shadow-sm border border-gray-100 min-h-[500px] relative overflow-hidden">
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
          {activeTab === 'requests-history' && <StaffRequestsHistory requests={[]} />}
          {activeTab === 'evaluations' && <StaffEvaluations evals={[]} />}
          {activeTab === 'messages' && <StaffMessages messages={[]} />}
        </div>
      </main>
    </div>
  );
}
