import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee, AttendanceRecord, LeaveRequest, Evaluation, InternalMessage } from '../../types';
import { supabase } from '../../supabaseClient';
import { LogOut, User, Clock, Printer, FilePlus, List, Award, Inbox, BarChart } from 'lucide-react';

import StaffProfile from './components/StaffProfile';
import StaffAttendance from './components/StaffAttendance';
import StaffTemplatesTab from './components/StaffTemplatesTab';
import StaffStats from './components/StaffStats';
import StaffNewRequest from './components/StaffNewRequest';
import StaffRequestsHistory from './components/StaffRequestsHistory';
import StaffEvaluations from './components/StaffEvaluations';
import StaffMessages from './components/StaffMessages';
import NotificationBell from '../../components/ui/NotificationBell';
interface Props {
  employee: Employee;
}

export default function StaffDashboard({ employee }: Props) {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [messages, setMessages] = useState<InternalMessage[]>([]);

  const fetchData = async () => {
    // Fetch Attendance
    const { data: att } = await supabase.from('attendance').select('*').eq('employee_id', employee.employee_id);
    if (att) setAttendance(att);

    // Fetch Requests
    const { data: req } = await supabase.from('leave_requests').select('*').eq('employee_id', employee.employee_id).order('created_at', { ascending: false });
    if (req) setRequests(req);

    // Fetch Evaluations
    const { data: evals } = await supabase.from('evaluations').select('*').eq('employee_id', employee.employee_id).order('month', { ascending: false });
    if (evals) setEvaluations(evals);

    // Fetch Messages
    const { data: msgs } = await supabase.from('messages').select('*').or(`to_user.eq.${employee.employee_id},to_user.eq.all`).order('created_at', { ascending: false });
    if (msgs) setMessages(msgs);
  };

  useEffect(() => {
    fetchData();
  }, [employee.employee_id]);

  const StaffNav = ({ id, icon: Icon, label }: any) => (
    <button 
      onClick={() => setActiveTab(id)} 
      className={`w-full flex items-center p-4 rounded-2xl font-black transition-all duration-200 ${activeTab === id ? 'bg-emerald-600 text-white shadow-lg translate-x-1' : 'bg-white text-gray-500 hover:bg-emerald-50 hover:text-emerald-600'}`}
    >
      <Icon size={20} className="ml-3" /> {label}
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 text-right bg-gray-50/50 min-h-screen" dir="rtl">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border mb-8 flex justify-between items-center no-print">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center overflow-hidden border-2 border-emerald-50 shadow-inner">
             {employee.photo_url ? <img src={employee.photo_url} className="w-full h-full object-cover" alt="Profile" /> : <User className="text-emerald-600 w-8 h-8"/>}
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tighter">{employee.name}</h1>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{employee.specialty}</span>
                <span className="text-[10px] text-gray-400 font-mono">ID: {employee.employee_id}</span>
            </div>
          </div>
        </div>
        <button onClick={signOut} className="flex items-center gap-2 text-red-500 font-black hover:bg-red-50 px-5 py-2.5 rounded-2xl transition-all border border-transparent hover:border-red-100">
          <LogOut className="w-5 h-5"/> خروج
        </button>
      </div>
// مثال في StaffDashboard.tsx داخل الـ Header
<div className="flex items-center gap-4">
   <div className="relative">
      {/* ... صورة البروفايل ... */}
   </div>

   {/* أضف الجرس هنا */}
   <div className="hidden md:block">
      <NotificationBell />
   </div>

   <div>
      {/* ... اسم الموظف ... */}
   </div>
</div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <div className="space-y-2 no-print">
          <StaffNav id="profile" icon={User} label="الملف الشخصي" />
          <StaffNav id="stats" icon={BarChart} label="إحصائيات الأداء" />
          <StaffNav id="attendance" icon={Clock} label="سجل الحضور" />
          <StaffNav id="templates" icon={Printer} label="النماذج والطباعة" />
          <StaffNav id="new_request" icon={FilePlus} label="تقديم طلب جديد" />
          <StaffNav id="history" icon={List} label="سجل طلباتي" />
          <StaffNav id="evaluations" icon={Award} label="تقييماتي الشهرية" />
          <StaffNav id="messages" icon={Inbox} label="الرسائل" />
        </div>

        {/* Content */}
        <div className="lg:col-span-3 bg-white p-6 md:p-10 rounded-3xl shadow-sm border min-h-[600px] print:p-0 print:border-0 print:shadow-none animate-in fade-in duration-500">
          {activeTab === 'profile' && <StaffProfile employee={employee} />}
          {activeTab === 'stats' && <StaffStats attendance={attendance} month={selectedMonth} />}
          {activeTab === 'attendance' && (
            <StaffAttendance 
                attendance={attendance} 
                selectedMonth={selectedMonth} 
                setSelectedMonth={setSelectedMonth} 
                employee={employee} 
            />
          )}
          {activeTab === 'templates' && <StaffTemplatesTab employee={employee} />}
          {activeTab === 'new_request' && <StaffNewRequest employee={employee} refresh={fetchData} />}
          {activeTab === 'history' && <StaffRequestsHistory requests={requests} />}
          {activeTab === 'evaluations' && <StaffEvaluations evals={evaluations} />}
          {activeTab === 'messages' && <StaffMessages messages={messages} />}
        </div>
      </div>
    </div>
  );
}