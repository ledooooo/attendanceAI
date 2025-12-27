import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee } from '../../types';
import { LogOut, User, Clock, Printer, FilePlus, List, Award, Inbox, BarChart } from 'lucide-react';

// استيراد المكونات الفرعية (ستقوم أنت بإنشاء هذه الملفات ونسخ الكود القديم بداخلها)
import StaffProfile from './components/StaffProfile';
import StaffAttendance from './components/StaffAttendance';
import StaffTemplatesTab from './components/StaffTemplatesTab'; // هذا هو الملف الجديد للنماذج
// ... باقي الاستيرادات

interface Props {
  employee: Employee;
}

export default function StaffDashboard({ employee }: Props) {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  // شريط التنقل الجانبي
  const StaffNav = ({ id, icon, label }: any) => (
    <button 
      onClick={() => setActiveTab(id)} 
      className={`w-full flex items-center p-4 rounded-2xl font-black transition-all ${activeTab === id ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-emerald-50'}`}
    >
      <span className="ml-3">{icon}</span> {label}
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 text-right bg-gray-50/50 min-h-screen" dir="rtl">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border mb-8 flex justify-between items-center no-print">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center overflow-hidden">
             {employee.photo_url ? <img src={employee.photo_url} className="w-full h-full object-cover" /> : <User className="text-emerald-600"/>}
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-800">{employee.name}</h1>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-bold">{employee.specialty}</span>
          </div>
        </div>
        <button onClick={signOut} className="flex items-center gap-2 text-red-500 font-bold hover:bg-red-50 px-4 py-2 rounded-xl transition-all">
          <LogOut className="w-5 h-5"/> خروج
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <div className="space-y-2 no-print">
          <StaffNav id="profile" icon={<User size={20}/>} label="الملف الشخصي" />
          <StaffNav id="attendance" icon={<Clock size={20}/>} label="سجل الحضور" />
          <StaffNav id="templates" icon={<Printer size={20}/>} label="طباعة نموذج" />
          {/* ... باقي الأزرار */}
        </div>

        {/* Content */}
        <div className="lg:col-span-3 bg-white p-8 rounded-3xl shadow-sm border min-h-[600px] print:p-0 print:border-0 print:shadow-none">
          {activeTab === 'profile' && <StaffProfile employee={employee} />}
          {activeTab === 'templates' && <StaffTemplatesTab employee={employee} />}
          {/* ... باقي الشروط */}
        </div>
      </div>
    </div>
  );
}