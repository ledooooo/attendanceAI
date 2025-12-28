import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee } from '../../types';
import { 
  LogOut, User, Clock, Printer, FilePlus, 
  List, Award, Inbox, BarChart 
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

  // مكون الزر الجانبي
  const StaffNav = ({ id, icon, label }: any) => (
    <button 
      onClick={() => setActiveTab(id)} 
      className={`w-full flex items-center p-4 rounded-2xl font-black transition-all duration-200 active:scale-95 ${
        activeTab === id 
        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' 
        : 'bg-white text-gray-500 hover:bg-emerald-50 hover:text-emerald-600'
      }`}
    >
      <span className="ml-3">{icon}</span> {label}
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 text-right bg-gray-50/50 min-h-screen font-sans" dir="rtl">
      
      {/* --- الهيدر (رأس الصفحة) --- */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border mb-8 flex flex-col md:flex-row justify-between items-center no-print">
        <div className="flex items-center gap-4 mb-4 md:mb-0">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-emerald-100">
             {employee.photo_url ? (
               <img src={employee.photo_url} className="w-full h-full object-cover" alt="Profile" />
             ) : (
               <User className="text-emerald-600 w-8 h-8"/>
             )}
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-800">{employee.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-bold">{employee.specialty}</span>
              <span className="text-xs text-gray-400 font-mono font-bold">#{employee.employee_id}</span>
            </div>
          </div>
        </div>
        
        <button 
          onClick={signOut} 
          className="flex items-center gap-2 text-red-500 font-bold bg-red-50 hover:bg-red-100 px-6 py-3 rounded-xl transition-all shadow-sm"
        >
          <LogOut className="w-5 h-5"/> تسجيل خروج
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* --- القائمة الجانبية (Sidebar) --- */}
        <div className="lg:col-span-1 space-y-3 no-print">
          <StaffNav id="profile" icon={<User size={20}/>} label="الملف الشخصي" />
          <StaffNav id="attendance" icon={<Clock size={20}/>} label="سجل الحضور" />
          <StaffNav id="stats" icon={<BarChart size={20}/>} label="الإحصائيات" />
          <StaffNav id="new-request" icon={<FilePlus size={20}/>} label="تقديم طلب إلكتروني" />
          <StaffNav id="templates" icon={<Printer size={20}/>} label="طباعة نموذج رسمي" />
          <StaffNav id="requests-history" icon={<List size={20}/>} label="سجل الطلبات" />
          <StaffNav id="evals" icon={<Award size={20}/>} label="التقييمات الشهرية" />
          <StaffNav id="messages" icon={<Inbox size={20}/>} label="الرسائل" />
        </div>

        {/* --- منطقة العرض الرئيسية (Main Content) --- */}
        <div className="lg:col-span-3 bg-white p-6 md:p-8 rounded-[40px] shadow-sm border border-gray-100 min-h-[600px] relative overflow-hidden print:p-0 print:border-0 print:shadow-none print:w-full">
          
          {/* هنا المهم: نمرر isEditable={false} أو نتركها للوضع الافتراضي ليكون للقراءة فقط */}
          {activeTab === 'profile' && <StaffProfile employee={employee} isEditable={false} />}
          
          {/* المكونات الأخرى، البيانات تأتي من الخارج أو يتم جلبها داخلياً حسب تصميمك */}
          {activeTab === 'attendance' && (
            <StaffAttendance 
                attendance={[]} // سيتم جلب البيانات داخل المكون (يفترض أنك عدلت StaffAttendance ليجلب بياناته أو مررها من هنا)
                selectedMonth={new Date().toISOString().slice(0, 7)} 
                setSelectedMonth={()=>{}} 
                employee={employee} 
            /> 
          )}

          {activeTab === 'stats' && <StaffStats attendance={[]} evals={[]} requests={[]} month={new Date().toISOString().slice(0, 7)} />} 

          {activeTab === 'new-request' && <StaffNewRequest employee={employee} refresh={()=>{}} />}
          {activeTab === 'templates' && <StaffTemplatesTab employee={employee} />}
          {activeTab === 'requests-history' && <StaffRequestsHistory requests={[]} />}
          {activeTab === 'evals' && <StaffEvaluations evals={[]} />}
          {activeTab === 'messages' && <StaffMessages messages={[]} />}
        </div>
      </div>
    </div>
  );
}