import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { Employee } from '../../types';
import { 
  Users, Clock, CalendarRange, ClipboardList, 
  Activity, Settings, LogOut, Menu, LayoutDashboard, Bell 
} from 'lucide-react';

// استيراد التبويبات الستة
import DoctorsTab from './components/DoctorsTab';         // (1) شئون الموظفين
import AttendanceTab from './components/AttendanceTab';     // (2) سجلات البصمة
import EveningSchedulesTab from './components/EveningSchedulesTab'; // (3) جداول النوبتجية
import LeavesTab from './components/LeavesTab';             // (4) طلبات الإجازات
import EvaluationsTab from './components/EvaluationsTab';   // (5) التقييمات الطبية
import SettingsTab from './components/SettingsTab';         // (6) إعدادات النظام
import ReportsTab from './components/ReportsTab'; // <--- أضف هذا
import { FileBarChart } from 'lucide-react'; // <--- أضف أيقونة التقارير
import NotificationBell from '../../components/ui/NotificationBell';
import SendReportsTab from './components/SendReportsTab';
import { Mail } from 'lucide-react'; // استيراد أيقونة الإيميل
export default function AdminDashboard() {
  const { signOut, user } = useAuth();
  const [activeTab, setActiveTab] = useState('doctors');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [centerName, setCenterName] = useState('جاري التحميل...');
  const [centerId, setCenterId] = useState('');
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // جلب الموظفين (نحتاجهم في معظم التبويبات)
  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('*').order('name');
    if (data) setEmployees(data);
  };

  // جلب إعدادات المركز
  const fetchSettings = async () => {
      const { data } = await supabase.from('general_settings').select('center_name, id').maybeSingle();
      if (data) {
          setCenterName(data.center_name || 'المركز الطبي');
          setCenterId(data.id);
      }
  };

  useEffect(() => {
    fetchEmployees();
    fetchSettings();
  }, []);

const menuItems = [
  { id: 'doctors', label: 'شئون الموظفين', icon: Users },
  { id: 'attendance', label: 'سجلات البصمة', icon: Clock },
  { id: 'schedules', label: 'جداول النوبتجية', icon: CalendarRange },
  { id: 'reports', label: 'التقارير والإحصائيات', icon: FileBarChart }, // <--- أضف هذا السطر
  { id: 'leaves', label: 'طلبات الإجازات', icon: ClipboardList },
  { id: 'evaluations', label: 'التقييمات الطبية', icon: Activity },
  { id: 'settings', label: 'إعدادات النظام', icon: Settings },
  { id: 'send_reports', label: 'إرسال التقارير', icon: Mail }, // <--- الجديد
];

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-right" dir="rtl">
      
      {/* القائمة الجانبية */}
      <aside className={`fixed md:relative z-30 h-screen bg-white border-l transition-all duration-300 ${isSidebarOpen ? 'w-72' : 'w-0 md:w-20'} overflow-hidden flex flex-col`}>
        <div className="p-6 flex items-center justify-center border-b h-20 shrink-0">
           {isSidebarOpen ? (
               <h1 className="text-xl font-black text-emerald-700 flex items-center gap-2">
                   <LayoutDashboard className="w-6 h-6"/> لوحة التحكم
               </h1>
           ) : (
               <LayoutDashboard className="w-8 h-8 text-emerald-700"/>
           )}
        </div>

        <nav className="p-4 space-y-2 mt-4 flex-1 overflow-y-auto custom-scrollbar">
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
              <item.icon className={`w-6 h-6 shrink-0 ${!isSidebarOpen && 'mx-auto'}`} />
              <span className={`${!isSidebarOpen && 'hidden'} whitespace-nowrap`}>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t bg-gray-50 shrink-0">
           <button 
             onClick={signOut} 
             className={`w-full flex items-center gap-2 text-red-500 p-3 rounded-xl hover:bg-red-50 transition-all font-bold ${!isSidebarOpen && 'justify-center'}`}
           >
             <LogOut className="w-5 h-5 shrink-0" />
             <span className={!isSidebarOpen ? 'hidden' : ''}>تسجيل خروج</span>
           </button>
        </div>
      </aside>

      {/* المحتوى الرئيسي */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* الهيدر */}
        <header className="h-20 bg-white border-b flex justify-between items-center px-6 shadow-sm z-20 shrink-0">
            <div className="flex items-center gap-4">
                <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
                    <Menu className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-lg font-black text-gray-800">{centerName}</h2>
                    <p className="text-xs text-gray-400 font-bold">المستخدم: {user?.email}</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                 <NotificationBell />
            </div>
        </header>

        {/* منطقة التبويبات */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50 p-4 md:p-8 custom-scrollbar">
            {activeTab === 'doctors' && <DoctorsTab employees={employees} onRefresh={fetchEmployees} centerId={centerId} />}
            {activeTab === 'attendance' && <AttendanceTab onRefresh={()=>{}} />}
            {activeTab === 'schedules' && <EveningSchedulesTab employees={employees} />}
            {activeTab === 'reports' && <ReportsTab />}
            {activeTab === 'leaves' && <LeavesTab />}
            {activeTab === 'evaluations' && <EvaluationsTab employees={employees} />}
            {activeTab === 'settings' && <SettingsTab onUpdateName={fetchSettings} />}
            {activeTab === 'send_reports' && <SendReportsTab />} {/* <--- الجديد */}
        </div>
      </main>
    </div>
  );
}