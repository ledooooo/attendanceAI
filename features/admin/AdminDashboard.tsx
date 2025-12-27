import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Users, Clock, Calendar, FileText, Settings, LogOut, LayoutDashboard, Award, Inbox, BarChart3, Bell } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Employee } from '../../types';

import DoctorsTab from './components/DoctorsTab';
import AttendanceTab from './components/AttendanceTab'; 
import EveningSchedulesTab from './components/EveningSchedulesTab';
import LeavesTab from './components/LeavesTab';
import EvaluationsTab from './components/EvaluationsTab';
import SettingsTab from './components/SettingsTab';

export default function AdminDashboard() {
  const { signOut, user, employeeProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('doctors');
  const [employees, setEmployees] = useState<Employee[]>([]);

  const fetchEmployees = async () => {
    if (!employeeProfile?.center_id) return;
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('center_id', employeeProfile.center_id)
      .order('name');
    
    if (error) {
        console.error("Error fetching employees:", error);
        return;
    }
    if (data) setEmployees(data);
  };

  useEffect(() => {
    if (employeeProfile?.center_id) {
      fetchEmployees();
    }
  }, [employeeProfile?.center_id]);
  
  const NavItem = ({ id, icon: Icon, label }: any) => (
    <button 
        onClick={() => setActiveTab(id)} 
        className={`w-full flex items-center gap-3 p-4 rounded-2xl font-black transition-all duration-300 ${
            activeTab === id 
            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 translate-x-1' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
    >
        <Icon className={`w-5 h-5 ${activeTab === id ? 'text-white' : 'text-slate-500'}`} />
        <span className="text-sm">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-right font-sans flex" dir="rtl">
      {/* Sidebar Desktop */}
      <aside className="sticky top-0 h-screen w-80 bg-slate-900 text-white p-8 hidden lg:flex flex-col z-50 shadow-2xl">
        <div className="mb-12 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-900/40 rotate-3">
                <LayoutDashboard className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-black tracking-tighter">بوابة الإدارة المركزية</h1>
            <p className="text-[10px] text-slate-500 mt-2 font-mono uppercase tracking-widest">{employeeProfile?.center_id}</p>
        </div>
        
        <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
            <NavItem id="doctors" icon={Users} label="شئون الموظفين" />
            <NavItem id="attendance" icon={Clock} label="سجلات البصمة" />
            <NavItem id="evening" icon={Calendar} label="جداول النوبتجية" />
            <NavItem id="leaves" icon={FileText} label="طلبات الإجازات" />
            <NavItem id="evaluations" icon={Award} label="التقييمات الطبية" />
            <NavItem id="settings" icon={Settings} label="إعدادات النظام" />
        </nav>

        <div className="mt-8 pt-8 border-t border-slate-800">
            <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-2xl mb-4 border border-slate-700/50">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30 text-emerald-400">
                    <UserIcon />
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-black truncate">{employeeProfile?.name}</p>
                    <p className="text-[9px] text-slate-500 truncate">المسؤول الإداري</p>
                </div>
            </div>
            <button 
                onClick={signOut} 
                className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl font-black text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all border border-transparent hover:border-red-500/20"
            >
                <LogOut className="w-5 h-5" /> تسجيل خروج
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 max-h-screen overflow-y-auto">
         <div className="max-w-6xl mx-auto">
             {activeTab === 'doctors' && (
               <DoctorsTab 
                 employees={employees} 
                 onRefresh={fetchEmployees} 
                 centerId={employeeProfile?.center_id || ''} 
               />
             )}
             {activeTab === 'attendance' && <AttendanceTab onRefresh={fetchEmployees} />}
             {activeTab === 'evening' && <EveningSchedulesTab employees={employees} centerName={employeeProfile?.center_id} centerId={employeeProfile?.center_id} />}
             {activeTab === 'leaves' && <LeavesTab onRefresh={fetchEmployees} />}
             {activeTab === 'evaluations' && <EvaluationsTab employees={employees} />}
             {activeTab === 'settings' && <SettingsTab settings={employeeProfile} onRefresh={() => {}} />}
         </div>
      </main>
    </div>
  );
}

function UserIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
    );
}