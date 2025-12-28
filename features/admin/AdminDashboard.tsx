import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { Employee } from '../../types';
import { 
  Users, Clock, ClipboardList, Settings, LogOut, 
  LayoutDashboard, Bell, Menu, FileText, Award 
} from 'lucide-react';

// استيراد المكونات الفرعية
import DoctorsTab from './components/DoctorsTab';
import AttendanceTab from './components/AttendanceTab';
import LeavesTab from './components/LeavesTab';
import SettingsTab from './components/SettingsTab';
import EvaluationsTab from './components/EvaluationsTab';
import NotificationBell from '../../components/ui/NotificationBell';

export default function AdminDashboard() {
  const { signOut, user } = useAuth();
  const [activeTab, setActiveTab] = useState('doctors');
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // حالة لاسم المركز
  const [centerName, setCenterName] = useState('جاري التحميل...');
  const [centerId, setCenterId] = useState(''); // سنحتفظ بالـ ID للاستخدام الداخلي
  
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('*').order('name');
    if (data) setEmployees(data);
  };

  // جلب اسم المركز
  const fetchSettings = async () => {
      const { data } = await supabase.from('general_settings').select('center_name, id').maybeSingle();
      if (data) {
          setCenterName(data.center_name || 'المركز الطبي الذكي');
          setCenterId(data.id);
      } else {
          setCenterName('المركز الطبي (غير مسمى)');
      }
  };

  useEffect(() => {
    fetchEmployees();
    fetchSettings();
  }, []);

  const menuItems = [
    { id: 'doctors', label: 'شئون الموظفين', icon: Users },
    { id: 'attendance', label: 'سجلات البصمة', icon: Clock },
    { id: 'leaves', label: 'الطلبات والإجازات', icon: ClipboardList },
    { id: 'evaluations', label: 'التقييمات الطبية', icon: Award },
    { id: 'settings', label: 'إعدادات النظام', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-right" dir="rtl">
      
      {/* Sidebar */}
      <aside className={`fixed md:relative z-30 h-screen bg-white border-l transition-all duration-300 ${isSidebarOpen ? 'w-72' : 'w-0 md:w-20'} overflow-hidden`}>
        <div className="p-6 flex items-center justify-center border-b h-20">
           {isSidebarOpen ? (
               <h1 className="text-xl font-black text-emerald-700 flex items-center gap-2">
                   <LayoutDashboard className="w-6 h-6"/> لوحة التحكم
               </h1>
           ) : (
               <LayoutDashboard className="w-8 h-8 text-emerald-700"/>
           )}
        </div>

        <nav className="p-4 space-y-2 mt-4">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 ${
                activeTab === item.id 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 font-bold' 
                  : 'text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 font-medium'
              }`}
            >
              <item.icon className={`w-6 h-6 ${!isSidebarOpen && 'mx-auto'}`} />
              <span className={`${!isSidebarOpen && 'hidden'} transition-opacity duration-200`}>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t bg-gray-50">
           <button 
             onClick={signOut} 
             className={`w-full flex items-center gap-2 text-red-500 p-3 rounded-xl hover:bg-red-50 transition-all font-bold ${!isSidebarOpen && 'justify-center'}`}
           >
             <LogOut className="w-5 h-5" />
             <span className={!isSidebarOpen ? 'hidden' : ''}>تسجيل خروج</span>
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b flex justify-between items-center px-6 md:px-10 shadow-sm z-20">
            <div className="flex items-center gap-4">
                <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
                    <Menu className="w-6 h-6" />
                </button>
                <div>
                    {/* --- هنا نستخدم اسم المركز الديناميكي --- */}
                    <h2 className="text-lg font-black text-gray-800">{centerName}</h2>
                    <p className="text-xs text-gray-400 font-bold">مدير النظام: {user?.email}</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                 <NotificationBell />
                 <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center border-2 border-emerald-200">
                    <span className="text-emerald-700 font-black">A</span>
                 </div>
            </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50 p-4 md:p-8 custom-scrollbar">
            {activeTab === 'doctors' && <DoctorsTab employees={employees} onRefresh={fetchEmployees} centerId={centerId} />}
            {activeTab === 'attendance' && <AttendanceTab onRefresh={()=>{}} />}
            {activeTab === 'leaves' && <LeavesTab />}
            {activeTab === 'evaluations' && <EvaluationsTab employees={employees} />}
            
            {/* نمرر دالة تحديث الاسم لتبويب الإعدادات ليتحدث الهيدر فوراً عند التغيير */}
            {activeTab === 'settings' && <SettingsTab onUpdateName={fetchSettings} />}
        </div>
      </main>
    </div>
  );
}