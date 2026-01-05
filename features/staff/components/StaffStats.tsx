import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest, Evaluation } from '../../types';
import { useSwipeable } from 'react-swipeable';
import { 
  LogOut, User, Clock, Printer, FilePlus, 
  List, Award, Inbox, BarChart, Menu, X, LayoutDashboard,
  Share2, Download, Info, Heart, Smartphone, HelpCircle, AlertTriangle, ShieldCheck, ArrowLeftRight 
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
  
  // --- 1. تعريف مخازن البيانات (States) ---
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // --- 2. دالة جلب البيانات من قاعدة البيانات ---
  const fetchAllData = async () => {
    try {
      // جلب سجلات الحضور بناءً على الكود الوظيفي
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
      console.error("Error fetching data:", error);
    }
  };

  // جلب البيانات عند فتح الصفحة أو تغيير الشهر
  useEffect(() => {
    fetchAllData();
  }, [employee.employee_id]);

  // --- 3. تمرير البيانات الحقيقية للمكونات ---
  return (
    <div className="h-screen w-full bg-gray-50 flex overflow-hidden text-right" dir="rtl">
      {/* القائمة الجانبية (مختصرة للتركيز على الحل) */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto space-y-6">
              <div className="bg-white rounded-[2.5rem] p-5 md:p-8 min-h-[500px] shadow-sm border">
                  
                  {activeTab === 'news' && (
                      <>
                          <EOMVotingCard employee={employee} />
                          <StaffNewsFeed employee={employee} />
                      </>
                  )}

                  {activeTab === 'attendance' && (
                      <StaffAttendance 
                          attendance={attendanceData} 
                          selectedMonth={selectedMonth} 
                          setSelectedMonth={setSelectedMonth} 
                          employee={employee} 
                      /> 
                  )}

                  {/* هنا يتم تمرير البيانات الحقيقية للإحصائيات */}
                  {activeTab === 'stats' && (
                      <StaffStats 
                          attendance={attendanceData} 
                          evals={evaluations} 
                          requests={leaveRequests} 
                          month={selectedMonth}
                          employee={employee} 
                      />
                  )}

                  {activeTab === 'requests-history' && (
                      <StaffRequestsHistory requests={leaveRequests} employee={employee} />
                  )}

                  {activeTab === 'evaluations' && (
                      <StaffEvaluations evals={evaluations} employee={employee} />
                  )}
                  
                  {/* باقي التبويبات تستمر بنفس النمط */}
              </div>
          </div>
      </main>
    </div>
  );
}
