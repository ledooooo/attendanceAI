'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import { 
  Menu, X, Bell, User, Home, FileText, Users, Activity, 
  Calendar, MessageSquare, Calculator, Stethoscope, BookOpen, 
  Phone, Share2, Heart, ArrowLeft, Loader2, ChevronLeft
} from 'lucide-react';

// ✅ استيراد معالج الملف الطبي والمكونات الجديدة التي أنشأناها
import MedicalProfileWizard from './components/MedicalProfileWizard';
import PatientAppointments from './tabs/PatientAppointments';
import ChronicLogs from './tabs/ChronicLogs';
import PatientComplaints from './tabs/PatientComplaints';
import PatientConsultations from './tabs/PatientConsultations';

// تعريف واجهة المقال
interface Article {
  id: string;
  title: string;
  category: string;
  content: string;
  image_url: string;
  author_name: string;
  author_role: string;
  likes_count: number;
  created_at: string;
}

export default function PatientDashboard() {
  const { user, signOut } = useAuth();
  
  // 🌟 حالات الفحص (هل لديه ملف طبي أم لا؟ وما هو الـ ID الخاص به؟)
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null); // ✅ ضروري لتمريره للمكونات الفرعية
  const [checkingProfile, setCheckingProfile] = useState(true);

  const [activeTab, setActiveTab] = useState('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // حالات المقالات
  const [articles, setArticles] = useState<Article[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('الكل');

  // تبويبات المقالات
  const articleCategories = ['الكل', 'تغذية', 'صحة الطفل', 'أمراض مزمنة', 'صحة المرأة', 'نصائح عامة'];

  // 1. 🌟 فحص وجود الملف الطبي وجلب الـ patientId
  useEffect(() => {
    const checkPatientProfile = async () => {
      if (!user?.id) return;
      setCheckingProfile(true);
      
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setHasProfile(true);
          setPatientId(data.id); // ✅ حفظ الـ ID لاستخدامه في باقي التبويبات
        } else {
          setHasProfile(false);
        }
      } catch (err) {
        console.error("Error checking profile:", err);
      } finally {
        setCheckingProfile(false);
      }
    };

    checkPatientProfile();
  }, [user?.id]);

  // 2. جلب المقالات من قاعدة البيانات
  useEffect(() => {
    if (!hasProfile) return;

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
  }, [hasProfile]);

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

  // ✅ القائمة الجانبية (تحديث المعرفات لتطابق التبويبات)
  const menuItems = [
    { id: 'profile', label: 'البروفايل والملف الطبي', icon: User },
    // { id: 'family', label: 'أسرتي', icon: Users },
    { id: 'chronic_logs', label: 'سجل الأمراض المزمنة', icon: Activity },
    { id: 'appointments', label: 'مواعيدي', icon: Calendar },
    { id: 'consultations', label: 'الاستشارات الإلكترونية', icon: MessageSquare }, // ✅ تبويب الاستشارات
    { id: 'complaints', label: 'الشكاوى والاقتراحات', icon: MessageSquare },
    { id: 'calculators', label: 'حاسبات طبية', icon: Calculator },
    // { id: 'doctors', label: 'ساحة الأطباء', icon: Stethoscope },
    { id: 'policies', label: 'سياسات المركز', icon: BookOpen },
    { id: 'contact', label: 'تواصل معنا', icon: Phone },
  ];

  // البار السفلي للموبايل
  const bottomNavItems = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'appointments', label: 'مواعيدي', icon: Calendar },
    { id: 'consultations', label: 'استشارات', icon: MessageSquare }, // ✅ استبدلنا "سجلاتي" بالاستشارات كأولوية للمريض
    { id: 'profile', label: 'حسابي', icon: User },
  ];

  // ─── دالة لعرض المحتوى الديناميكي بناءً على التبويب النشط ───
  const renderActiveTabContent = () => {
    // 1. الرئيسية (المقالات)
    if (activeTab === 'home') {
      return (
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <div className="bg-gradient-to-l from-blue-600 to-indigo-500 rounded-3xl p-6 text-white mb-6 shadow-lg shadow-blue-500/20 relative overflow-hidden">
            <div className="relative z-10">
              <h1 className="text-xl md:text-2xl font-black mb-2">مرحباً بك في أسرة غرب المطار 👋</h1>
              <p className="text-sm font-bold opacity-90 leading-relaxed max-w-md">نحن هنا لرعايتك. تصفح أحدث المقالات الطبية، احجز موعدك، وتابع سجلاتك الصحية بكل سهولة.</p>
            </div>
            <Heart className="absolute -left-6 -bottom-6 w-32 h-32 text-white opacity-10 transform -rotate-12" />
          </div>

          <div className="flex overflow-x-auto gap-2 pb-4 mb-2 no-scrollbar scroll-smooth">
            {articleCategories.map(cat => (
              <button 
                key={cat} 
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2 rounded-full text-xs font-black whitespace-nowrap transition-all border-2 shrink-0 ${
                  selectedCategory === cat ? 'bg-gray-800 text-white border-gray-800 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {loadingArticles ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
          ) : filteredArticles.length === 0 ? (
            <div className="text-center py-20 text-gray-400 font-bold bg-white rounded-3xl border border-dashed border-gray-200">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
              لا توجد مقالات في هذا القسم حالياً.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredArticles.map(article => (
                <div key={article.id} className="bg-white rounded-3xl border shadow-sm hover:shadow-lg transition-all overflow-hidden flex flex-col">
                  <div className="h-48 bg-gray-200 relative">
                    {article.image_url ? (
                      <img src={article.image_url} alt={article.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400"><FileText size={40} className="opacity-20"/></div>
                    )}
                    <span className="absolute top-3 right-3 bg-white/90 backdrop-blur text-blue-700 text-[10px] font-black px-3 py-1 rounded-full shadow-sm">
                      {article.category}
                    </span>
                  </div>
                  
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-3 text-[10px] text-gray-500 font-bold">
                      <span className="bg-gray-100 px-2 py-1 rounded-md">{new Date(article.created_at).toLocaleDateString('ar-EG')}</span>
                      <span>•</span>
                      <span>بقلم: <span className="text-gray-800">{article.author_name}</span></span>
                    </div>
                    
                    <h3 className="text-lg font-black text-gray-800 mb-2 leading-tight line-clamp-2">{article.title}</h3>
                    <p className="text-xs text-gray-500 font-medium leading-relaxed line-clamp-3 mb-4 flex-1">
                      {article.content}
                    </p>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-gray-50 mt-auto">
                      <div className="flex gap-2">
                        <button onClick={() => handleLike(article.id, article.likes_count)} className="flex items-center gap-1.5 p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors">
                          <Heart size={16} /> <span className="text-xs font-black">{article.likes_count}</span>
                        </button>
                        <button onClick={() => handleShare(article.title)} className="flex items-center p-2 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors">
                          <Share2 size={16} />
                        </button>
                      </div>
                      <button className="flex items-center gap-1 text-xs font-black text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-4 py-2 rounded-xl">
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

    // 2. المواعيد
    if (activeTab === 'appointments' && patientId) {
      return <div className="max-w-4xl mx-auto p-4 md:p-6"><PatientAppointments patientId={patientId} /></div>;
    }

    // 3. الأمراض المزمنة
    if (activeTab === 'chronic_logs' && patientId) {
      return <div className="max-w-4xl mx-auto p-4 md:p-6"><ChronicLogs patientId={patientId} /></div>;
    }

    // 4. الشكاوى والاقتراحات
    if (activeTab === 'complaints' && patientId) {
      return <div className="max-w-4xl mx-auto p-4 md:p-6"><PatientComplaints patientId={patientId} /></div>;
    }

    // 5. الاستشارات الطبية
    if (activeTab === 'consultations' && patientId) {
      return <div className="max-w-4xl mx-auto p-4 md:p-6"><PatientConsultations patientId={patientId} /></div>;
    }

    // 6. إذا كان القسم قيد التطوير
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
        <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-4">
          <Activity className="w-10 h-10 text-blue-400" />
        </div>
        <h2 className="text-xl font-black text-gray-800 mb-2">جاري تجهيز قسم {menuItems.find(m => m.id === activeTab)?.label}</h2>
        <p className="text-sm font-bold text-gray-500">هذه الصفحة قيد التطوير وسيتم إضافتها قريباً.</p>
      </div>
    );
  };

  // ─── شاشة التحميل الأولية ───
  if (checkingProfile) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-500 font-bold animate-pulse">جاري تجهيز بوابتك الصحية...</p>
      </div>
    );
  }

  // ─── التوجيه الذكي للمعالج (Wizard) ───
  if (hasProfile === false) {
    return <MedicalProfileWizard onComplete={() => window.location.reload()} />; // نعيد تحميل الصفحة للتأكد من جلب الـ patientId
  }

  // ─── واجهة المريض الرئيسية ───
  return (
    <div className="h-screen w-full bg-gray-50 flex overflow-hidden font-sans text-right" dir="rtl">
      
      {/* القائمة الجانبية */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-[60] md:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 right-0 z-[70] w-72 bg-white border-l shadow-2xl transform transition-transform duration-300 md:translate-x-0 md:static flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 border-b bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center border border-white/30 shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="font-black text-sm truncate">{user?.user_metadata?.full_name || 'بوابة المنتفعين'}</h2>
            <p className="text-[10px] opacity-80 font-bold">مركز طب أسرة غرب المطار</p>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden mr-auto p-1 bg-white/10 rounded-full"><X size={18}/></button>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar pb-20">
          <button onClick={() => { setActiveTab('home'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'home' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Home className="w-5 h-5" /> <span className="text-sm">الرئيسية (المقالات)</span>
          </button>
          <div className="my-2 border-t border-gray-100"></div>
          {menuItems.map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === item.id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
              <item.icon className="w-5 h-5" /> <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>
        
        <div className="p-4 border-t">
          <button onClick={signOut} className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-black text-sm hover:bg-red-100 transition-colors">تسجيل الخروج</button>
        </div>
      </aside>

      {/* منطقة المحتوى */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 sticky top-0 z-30 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-gray-50 rounded-xl border">
              <Menu className="w-5 h-5 text-gray-700"/>
            </button>
            <span className="font-black text-gray-800 text-lg">العيادة الذكية</span>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="p-2 bg-gray-50 text-gray-600 rounded-full border relative hover:bg-gray-100 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
            </button>
            <button onClick={() => setActiveTab('profile')} className="w-9 h-9 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center border border-blue-200">
              <User className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-50/50 pb-20 custom-scrollbar">
          {/* ✅ استدعاء الدالة المسؤولة عن عرض المحتوى الديناميكي */}
          {renderActiveTabContent()}
        </main>

        {/* البار السفلي للموبايل */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t rounded-t-3xl px-4 py-3 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] pb-safe">
          {bottomNavItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center gap-1.5 w-16 transition-all ${isActive ? 'text-blue-600 translate-y-[-4px]' : 'text-gray-400'}`}>
                <div className={`p-2 rounded-2xl ${isActive ? 'bg-blue-50 shadow-sm' : ''}`}>
                  <item.icon className={`w-5 h-5 ${isActive ? 'fill-blue-100 stroke-blue-600' : ''}`} />
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
