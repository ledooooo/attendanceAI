'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import { 
  Menu, X, User, Home, Activity, 
  MessageSquare, BookOpen, Phone, Share2, Heart, 
  Loader2, ChevronLeft, Baby, HeartPulse, Building2
} from 'lucide-react';

// ✅ المكونات المفعلة (مذكرات صحية شخصية آمنة + شكاوى)
import ChronicLogs from './tabs/ChronicLogs';
import ChildGrowthLogs from './tabs/ChildGrowthLogs';
import PregnancyLogs from './tabs/PregnancyLogs';
import PatientComplaints from './tabs/PatientComplaints';

// ⚠️ المكونات المعطلة (الاستشارات والملف الرسمي)
/*
import MedicalProfileWizard from './components/MedicalProfileWizard';
import PatientProfile from './tabs/PatientProfile';
import PatientAppointments from './tabs/PatientAppointments';
import PatientConsultations from './tabs/PatientConsultations';
*/

interface Article {
  id: string;
  title: string;
  category: string;
  content: string;
  image_url: string;
  author_name: string;
  likes_count: number;
  created_at: string;
}

export default function PatientDashboard() {
  const { user, signOut } = useAuth();
  
  const [activeTab, setActiveTab] = useState('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [articles, setArticles] = useState<Article[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('الكل');

  const articleCategories = ['الكل', 'تغذية', 'صحة الطفل', 'أمراض مزمنة', 'صحة المرأة', 'نصائح عامة', 'أخبار المركز'];

  // نستخدم معرف المستخدم في المصادقة كمعرف عام لتخزين بياناته الشخصية (السجلات)
  // هذا يغنينا عن الحاجة لإنشاء ملف طبي رسمي (Medical Profile)
  const patientId = user?.id || 'guest';

  useEffect(() => {
    const fetchArticles = async () => {
      setLoadingArticles(true);
      const { data, error } = await supabase
        .from('medical_articles')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        setArticles(data);
      }
      setLoadingArticles(false);
    };
    fetchArticles();
  }, []);

  const filteredArticles = selectedCategory === 'الكل' 
    ? articles 
    : articles.filter(a => a.category === selectedCategory);

  const handleLike = async (id: string, currentLikes: number) => {
    setArticles(articles.map(a => a.id === id ? { ...a, likes_count: currentLikes + 1 } : a));
    await supabase.from('medical_articles').update({ likes_count: currentLikes + 1 }).eq('id', id);
  };

  const handleShare = async (title: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: title, url: window.location.href });
      } else {
        toast.success('تم نسخ رابط المقال');
      }
    } catch (err) {}
  };

  // ✅ القائمة الجانبية المحدثة
  const menuItems = [
    { id: 'home', label: 'الرئيسية والمقالات', icon: Home, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { divider: true, id: 'd1' },
    { id: 'chronic_logs', label: 'مفكرة الأمراض المزمنة', icon: Activity, color: 'text-rose-600', bg: 'bg-rose-50' },
    { id: 'child_logs', label: 'سجل نمو الطفل', icon: Baby, color: 'text-sky-600', bg: 'bg-sky-50' },
    { id: 'pregnancy_logs', label: 'متابعة الحمل', icon: HeartPulse, color: 'text-pink-600', bg: 'bg-pink-50' },
    { divider: true, id: 'd2' },
    { id: 'complaints', label: 'تواصل مع الإدارة', icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'policies', label: 'سياسات المركز', icon: BookOpen, color: 'text-teal-600', bg: 'bg-teal-50' },
    { id: 'contact', label: 'دليل الأرقام', icon: Phone, color: 'text-gray-600', bg: 'bg-gray-50' },
  ];

  const bottomNavItems = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'chronic_logs', label: 'سجلاتي', icon: Activity },
    { id: 'complaints', label: 'تواصل', icon: MessageSquare },
  ];

  const renderActiveTabContent = () => {
    if (activeTab === 'home') {
      return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 animate-in fade-in">
          
          {/* Hero Banner */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2rem] p-8 text-white mb-8 shadow-xl shadow-indigo-200 relative overflow-hidden">
            <div className="relative z-10">
              <h1 className="text-2xl md:text-3xl font-black mb-3 tracking-tight">مرحباً بك في أسرة غرب المطار 👋</h1>
              <p className="text-sm font-bold opacity-90 leading-relaxed max-w-md">
                منصتك الشاملة للتثقيف الصحي، متابعة قياساتك الشخصية، والتواصل المستمر مع إدارة المركز.
              </p>
            </div>
            <HeartPulse className="absolute -left-10 -bottom-10 w-48 h-48 text-white opacity-10 transform -rotate-12" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl"></div>
          </div>

          {/* Categories */}
          <div className="flex overflow-x-auto gap-3 pb-4 mb-4 no-scrollbar scroll-smooth">
            {articleCategories.map(cat => (
              <button 
                key={cat} 
                onClick={() => setSelectedCategory(cat)}
                className={`px-6 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all border-2 shrink-0 ${
                  selectedCategory === cat 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100' 
                    : 'bg-white text-gray-600 border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Articles */}
          {loadingArticles ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
              <p className="text-sm font-bold text-gray-400">جاري تحميل المقالات...</p>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="text-center py-20 text-gray-400 font-bold bg-white rounded-[2rem] border border-dashed border-gray-200 shadow-sm">
              <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
              لا توجد مقالات في هذا القسم حالياً.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredArticles.map(article => (
                <div key={article.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col group">
                  <div className="h-52 bg-gray-100 relative overflow-hidden">
                    {article.image_url ? (
                      <img src={article.image_url} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-200">
                        <Building2 size={60} />
                      </div>
                    )}
                    <span className="absolute top-4 right-4 bg-white/95 backdrop-blur text-indigo-700 text-[10px] font-black px-4 py-1.5 rounded-full shadow-sm">
                      {article.category}
                    </span>
                  </div>
                  
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-4 text-[10px] text-gray-500 font-bold">
                      <span className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">{new Date(article.created_at).toLocaleDateString('ar-EG')}</span>
                      <span>•</span>
                      <span>بقلم: <span className="text-indigo-600">{article.author_name}</span></span>
                    </div>
                    
                    <h3 className="text-lg font-black text-gray-800 mb-3 leading-snug line-clamp-2">{article.title}</h3>
                    <p className="text-xs text-gray-500 font-medium leading-relaxed line-clamp-3 mb-6 flex-1">
                      {article.content}
                    </p>
                    
                    <div className="flex items-center justify-between pt-5 border-t border-gray-50 mt-auto">
                      <div className="flex gap-2">
                        <button onClick={() => handleLike(article.id, article.likes_count)} className="flex items-center gap-1.5 p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors">
                          <Heart size={18} /> <span className="text-xs font-black">{article.likes_count}</span>
                        </button>
                        <button onClick={() => handleShare(article.title)} className="flex items-center p-2 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100 hover:text-gray-800 transition-colors">
                          <Share2 size={18} />
                        </button>
                      </div>
                      <button className="flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 px-5 py-2.5 rounded-xl">
                        اقرأ المزيد <ChevronLeft size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // ✅ استدعاء المكونات المفعلة
    switch (activeTab) {
      case 'chronic_logs': return <div className="max-w-4xl mx-auto p-4 md:p-6"><ChronicLogs patientId={patientId} /></div>;
      case 'child_logs': return <div className="max-w-4xl mx-auto p-4 md:p-6"><ChildGrowthLogs patientId={patientId} /></div>;
      case 'pregnancy_logs': return <div className="max-w-4xl mx-auto p-4 md:p-6"><PregnancyLogs patientId={patientId} /></div>;
      case 'complaints': return <div className="max-w-4xl mx-auto p-4 md:p-6"><PatientComplaints patientId={patientId} /></div>;
    }

    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <BookOpen className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-xl font-black text-gray-800 mb-2">جاري تجهيز هذا القسم</h2>
        <p className="text-sm font-bold text-gray-500">هذه الصفحة قيد التطوير وسيتم إضافتها قريباً.</p>
      </div>
    );
  };

  return (
    <div className="h-screen w-full bg-[#f8fafc] flex overflow-hidden font-sans text-right" dir="rtl">
      
      {/* القائمة الجانبية للموبايل */}
      {isSidebarOpen && <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60] md:hidden transition-opacity" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`fixed inset-y-0 right-0 z-[70] w-[280px] bg-white border-l border-gray-100 shadow-2xl transform transition-transform duration-300 md:translate-x-0 md:static flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* رأس القائمة */}
        <div className="p-6 bg-white border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-50 rounded-2xl flex items-center justify-center border border-indigo-50 shadow-sm">
                    <Building2 className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                    <h2 className="font-black text-sm text-gray-800 tracking-tight">غرب المطار</h2>
                    <p className="text-[10px] text-gray-500 font-bold mt-0.5">بوابة الزوار والمواطنين</p>
                </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-gray-400 hover:bg-gray-50 rounded-xl"><X size={20}/></button>
        </div>
        
        {/* روابط القائمة */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar pb-24">
          {menuItems.map((item, index) => {
            if (item.divider) {
                return <div key={`div-${index}`} className="h-px bg-gray-100 my-4 mx-2"></div>;
            }
            
            const isActive = activeTab === item.id;
            return (
                <button 
                    key={item.id} 
                    onClick={() => { setActiveTab(item.id!); setIsSidebarOpen(false); }} 
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all duration-200 ${
                        isActive 
                        ? `${item.bg} ${item.color} shadow-sm ring-1 ring-black/5` 
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                >
                {item.icon && <item.icon className={`w-5 h-5 ${isActive ? '' : 'opacity-70'}`} />} 
                <span className="text-sm">{item.label}</span>
                </button>
            );
          })}
        </nav>
        
        {/* تذييل القائمة (تسجيل الخروج) */}
        <div className="p-5 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border shadow-sm">
                  <User className="w-5 h-5 text-gray-400" />
              </div>
              <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-gray-800 truncate">{user?.user_metadata?.full_name || 'زائر كريم'}</p>
                  <p className="text-[10px] text-gray-500 font-bold truncate" dir="ltr">{user?.email}</p>
              </div>
          </div>
          <button onClick={signOut} className="w-full py-3 bg-white border border-red-100 text-red-600 rounded-2xl font-black text-sm hover:bg-red-50 hover:border-red-200 transition-all shadow-sm">
              تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* منطقة المحتوى الرئيسي */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* الشريط العلوي */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2.5 bg-white shadow-sm border border-gray-100 rounded-2xl text-gray-700 hover:bg-gray-50 transition-colors">
              <Menu className="w-5 h-5"/>
            </button>
            <div>
                <h1 className="font-black text-gray-800 text-lg md:text-xl tracking-tight">
                    {menuItems.find(m => m.id === activeTab)?.label || 'الرئيسية'}
                </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             {/* أيقونة المستخدم للزينة */}
             <div className="hidden md:flex items-center gap-2 bg-white px-3 py-1.5 border border-gray-100 rounded-full shadow-sm">
                 <span className="text-xs font-bold text-gray-600">{user?.user_metadata?.full_name || 'زائر'}</span>
                 <div className="w-7 h-7 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                     <User size={14} />
                 </div>
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-24 custom-scrollbar">
          {renderActiveTabContent()}
        </main>

        {/* البار السفلي للموبايل (تم تحسين تصميمه) */}
        <div className="md:hidden fixed bottom-4 left-4 right-4 bg-white/90 backdrop-blur-lg border border-gray-100 rounded-3xl px-6 py-3 flex justify-between items-center z-50 shadow-2xl shadow-black/5">
          {bottomNavItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button 
                key={item.id} 
                onClick={() => setActiveTab(item.id)} 
                className={`flex flex-col items-center gap-1 w-16 transition-all duration-300 ${isActive ? 'text-indigo-600 -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <div className={`p-2.5 rounded-2xl transition-all duration-300 ${isActive ? 'bg-indigo-50 shadow-sm' : 'bg-transparent'}`}>
                  <item.icon className={`w-5 h-5 ${isActive ? 'fill-indigo-100 stroke-indigo-600' : 'stroke-[1.5]'}`} />
                </div>
                <span className={`text-[10px] ${isActive ? 'font-black' : 'font-bold'}`}>{item.label}</span>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
