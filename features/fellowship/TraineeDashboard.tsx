'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Menu, X, LogOut, User, Home, Clock, Calculator, Gamepad2, 
  GraduationCap, BookOpen, FileText, CheckCircle 
} from 'lucide-react';

// 🌟 استيراد تبويبات الزمالة
import TraineeOverviewTab from './tabs/TraineeOverviewTab';
import TraineeLogbookTab from './tabs/TraineeLogbookTab';
import TraineePortfolioTab from './tabs/TraineePortfolioTab';
import TraineeDopsTab from './tabs/TraineeDopsTab';

export default function TraineeDashboard({ employee }: { employee: any }) {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // تعريف القائمة الجانبية (مقسمة لقسمين: أكاديمي وعام)
  const menuItems = [
    { id: 'divider1', label: 'أكاديمية الزمالة', isHeader: true },
    { id: 'overview', label: 'نظرة عامة', icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'logbook', label: 'سجل الحالات (Logbook)', icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'portfolio', label: 'ملف الإنجاز (Portfolio)', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'dops', label: 'التقييم العملي (DOPS)', icon: CheckCircle, color: 'text-purple-600', bg: 'bg-purple-50' },
    
    { id: 'divider2', label: 'الخدمات العامة', isHeader: true },
    { id: 'news', label: 'الأخبار والتعميمات', icon: Home, color: 'text-gray-600', bg: 'bg-gray-50' },
    { id: 'attendance', label: 'سجل الحضور', icon: Clock, color: 'text-rose-600', bg: 'bg-rose-50' },
    { id: 'calculators', label: 'حاسبات طبية', icon: Calculator, color: 'text-teal-600', bg: 'bg-teal-50' },
    { id: 'arcade', label: 'صالة الألعاب والنقاط', icon: Gamepad2, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  // دالة لعرض التبويب المختار
  const renderActiveTabContent = () => {
    switch (activeTab) {
      // تبويبات الزمالة (تم تعديل employee_id إلى id هنا 👇)
      case 'overview': return <TraineeOverviewTab employeeId={employee?.id} />;
      case 'logbook': return <TraineeLogbookTab employeeId={employee?.id} />;
      case 'portfolio': return <TraineePortfolioTab employeeId={employee?.id} />;
      case 'dops': return <TraineeDopsTab employeeId={employee?.id} />;
      
      // التبويبات العامة
      case 'news': return <div className="p-6 text-center text-gray-500 font-bold mt-20"><Home className="w-12 h-12 mx-auto mb-4 opacity-20"/>جاري ربط الأخبار والتعميمات...</div>;
      case 'attendance': return <div className="p-6 text-center text-gray-500 font-bold mt-20"><Clock className="w-12 h-12 mx-auto mb-4 opacity-20"/>جاري ربط سجل الحضور...</div>;
      case 'calculators': return <div className="p-6 text-center text-gray-500 font-bold mt-20"><Calculator className="w-12 h-12 mx-auto mb-4 opacity-20"/>جاري ربط الحاسبات الطبية...</div>;
      case 'arcade': return <div className="p-6 text-center text-gray-500 font-bold mt-20"><Gamepad2 className="w-12 h-12 mx-auto mb-4 opacity-20"/>جاري ربط نظام النقاط...</div>;
      
      default: return <TraineeOverviewTab employeeId={employee?.id} />;
    }
  };

  return (
    <div className="h-screen w-full bg-[#f8fafc] flex overflow-hidden font-sans text-right" dir="rtl">
      
      {/* خلفية ضبابية للموبايل */}
      {isSidebarOpen && <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60] md:hidden" onClick={() => setIsSidebarOpen(false)} />}
      
      {/* القائمة الجانبية */}
      <aside className={`fixed inset-y-0 right-0 z-[70] w-[280px] bg-white border-l border-gray-100 shadow-2xl transform transition-transform duration-300 md:translate-x-0 md:static flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* هيدر القائمة */}
        <div className="p-6 bg-gradient-to-br from-indigo-900 to-indigo-800 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                    <GraduationCap className="w-7 h-7 text-white" />
                </div>
                <div>
                    <h2 className="font-black text-sm tracking-tight">برنامج الزمالة</h2>
                    <p className="text-[10px] text-indigo-200 font-bold mt-0.5">لوحة المتدرب (Trainee)</p>
                </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-indigo-200 hover:bg-white/10 rounded-xl"><X size={20}/></button>
        </div>
        
        {/* روابط القائمة */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar pb-6">
          {menuItems.map((item, index) => {
            if (item.isHeader) {
                return <h3 key={`hdr-${index}`} className="text-xs font-black text-gray-400 mt-6 mb-3 px-2">{item.label}</h3>;
            }
            
            const isActive = activeTab === item.id;
            return (
                <button 
                    key={item.id} 
                    onClick={() => { setActiveTab(item.id!); setIsSidebarOpen(false); }} 
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all duration-200 ${
                        isActive 
                        ? `${item.bg} ${item.color} shadow-sm ring-1 ring-black/5 scale-[1.02]` 
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                >
                {item.icon && <item.icon className={`w-5 h-5 ${isActive ? '' : 'opacity-70'}`} />} 
                <span className="text-sm flex-1 text-right">{item.label}</span>
                </button>
            );
          })}
        </nav>
        
        {/* تذييل القائمة (تسجيل الخروج) */}
        <div className="p-5 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-black text-sm">
                  {employee?.name?.charAt(0) || 'م'}
              </div>
              <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-gray-800 truncate">{employee?.name || 'متدرب'}</p>
                  <p className="text-[10px] text-gray-500 font-bold truncate">متدرب زمالة - {employee?.specialty || ''}</p>
              </div>
          </div>
          <button onClick={signOut} className="w-full py-3 bg-white border border-red-100 text-red-600 rounded-2xl font-black text-sm hover:bg-red-50 hover:border-red-200 transition-all shadow-sm flex items-center justify-center gap-2">
              <LogOut size={16} /> تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* منطقة المحتوى الرئيسي */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative bg-[#f8fafc]">
        
        {/* الشريط العلوي */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2.5 bg-white shadow-sm border border-gray-100 rounded-2xl text-gray-700 hover:bg-gray-50 transition-colors">
              <Menu className="w-5 h-5"/>
            </button>
            <div>
                <h1 className="font-black text-gray-800 text-lg md:text-xl tracking-tight">
                    {menuItems.find(m => m.id === activeTab)?.label}
                </h1>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {renderActiveTabContent()}
        </main>
      </div>
    </div>
  );
}
