
import React from 'react';
import { ShieldCheck, Users, Info, Activity } from 'lucide-react';

interface HomeProps {
  onNavigate: (page: 'home' | 'admin' | 'staff' | 'instructions') => void;
}

const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] p-6">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <Activity className="w-16 h-16 text-blue-600 animate-pulse" />
        </div>
        <h1 className="text-4xl font-bold text-gray-800 mb-2">المركز الطبي الذكي</h1>
        <p className="text-gray-500">نظام إدارة الحضور والانصراف والطلبات</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
        <HomeCard 
          icon={<ShieldCheck className="w-12 h-12 text-blue-600" />}
          title="صفحة الإدارة"
          description="إدارة العاملين، الإعدادات، التقارير والطلبات"
          onClick={() => onNavigate('admin')}
          color="hover:border-blue-500"
        />
        <HomeCard 
          icon={<Users className="w-12 h-12 text-emerald-600" />}
          title="دخول العاملين"
          description="تسجيل الحضور، تقديم الطلبات وعرض التقارير"
          onClick={() => onNavigate('staff')}
          color="hover:border-emerald-500"
        />
        <HomeCard 
          icon={<Info className="w-12 h-12 text-amber-600" />}
          title="التعليمات"
          description="دليل الاستخدام وإعداد قاعدة البيانات"
          onClick={() => onNavigate('instructions')}
          color="hover:border-amber-500"
        />
      </div>
    </div>
  );
};

interface CardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  color: string;
}

const HomeCard: React.FC<CardProps> = ({ icon, title, description, onClick, color }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center p-8 bg-white rounded-2xl shadow-sm border-2 border-transparent transition-all transform hover:-translate-y-1 ${color} group`}
  >
    <div className="mb-6 p-4 bg-gray-50 rounded-full group-hover:bg-white group-hover:scale-110 transition-all">
      {icon}
    </div>
    <h2 className="text-2xl font-bold text-gray-800 mb-3">{title}</h2>
    <p className="text-gray-500 text-center leading-relaxed">{description}</p>
  </button>
);

export default Home;
