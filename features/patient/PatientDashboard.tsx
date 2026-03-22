'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import { 
  Menu, X, User, Home, Activity, 
  MessageSquare, BookOpen, Phone, Share2, Heart, 
  Loader2, ChevronLeft, Baby, HeartPulse, CheckCircle2, Building2, LogIn, LogOut, Lock, FileText, Users, CalendarIcon, Calculator,
  Search, LayoutList, LayoutGrid, ChevronRight, Stethoscope, Clock, Grip
} from 'lucide-react';

import ChronicLogs from './tabs/ChronicLogs';
import ChildGrowthLogs from './tabs/ChildGrowthLogs';
import PregnancyLogs from './tabs/PregnancyLogs';
import PatientComplaints from './tabs/PatientComplaints';
import PatientAppointments from './tabs/PatientAppointments';
import CalculatorsMenu from '../../calculators/CalculatorsMenu';

import ContactPage from '../../pages/public/ContactPage';
import PricingPage from '../../pages/public/PricingPage';
import StaffDirectoryPage from '../../pages/public/StaffDirectoryPage';
import SurveyPage from '../../pages/public/SurveyPage';

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

export default function PatientDashboard({ isGuest = false }: { isGuest?: boolean }) {
  const { user, signOut } = useAuth();
  
  const [activeTab, setActiveTab] = useState('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
  // --- States for Articles ---
  const [articles, setArticles] = useState<Article[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  
  // Pagination & Filtering
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalArticles, setTotalArticles] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const ARTICLES_PER_PAGE = 5;
  const categories = ['الكل', 'المبادرات الرئاسية', 'الرعاية الأولية', 'تغذية', 'أمراض مزمنة', 'صحة الطفل', 'طب الأسنان', 'نصائح طبية'];

  useEffect(() => {
    if (!isGuest && user) {
      fetchProfile();
    }
  }, [user, isGuest]);

  useEffect(() => {
    if (activeTab === 'home') {
      fetchArticles();
    }
  }, [activeTab, currentPage, selectedCategory, searchQuery]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase.from('patients').select('*').eq('id', user?.id).single();
      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      console.error('Error fetching profile:', error.message);
    }
  };

  const fetchArticles = async () => {
    setLoadingArticles(true);
    try {
      let query = supabase
        .from('medical_articles')
        .select('*', { count: 'exact' });

      if (selectedCategory !== 'الكل') {
        query = query.eq('category', selectedCategory);
      }
      if (searchQuery.trim()) {
        query = query.ilike('title', `%${searchQuery}%`);
      }

      const from = (currentPage - 1) * ARTICLES_PER_PAGE;
      const to = from + ARTICLES_PER_PAGE - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      
      setArticles(data || []);
      setTotalArticles(count || 0);
      setTotalPages(Math.ceil((count || 0) / ARTICLES_PER_PAGE));
    } catch (error: any) {
      toast.error('حدث خطأ أثناء تحميل المقالات');
    } finally {
      setLoadingArticles(false);
    }
  };

  const handleLike = async (articleId: string) => {
    try {
      setArticles(prev => prev.map(a => a.id === articleId ? { ...a, likes_count: a.likes_count + 1 } : a));
      if (selectedArticle && selectedArticle.id === articleId) {
        setSelectedArticle(prev => prev ? { ...prev, likes_count: prev.likes_count + 1 } : null);
      }
      await supabase.rpc('increment_article_likes', { article_id: articleId });
      toast.success('شكراً لتفاعلك! ❤️', { position: 'bottom-center' });
    } catch (error) {
      console.error('Error liking article', error);
    }
  };

  const handleShare = async (article: Article) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: `اقرأ هذا المقال الطبي المفيد: ${article.title} عبر منصة غرب المطار`,
          url: window.location.href,
        });
      } catch (error) {
        console.log('مشاركة ملغاة', error);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('تم نسخ رابط المقال للمشاركة');
    }
  };

  const calculateReadTime = (text: string) => {
    const words = text.replace(/<[^>]+>/g, '').split(/\s+/).length;
    const time = Math.ceil(words / 200);
    return time > 0 ? time : 1;
  };

  // ✅ دالة جديدة لتسجيل الدخول المباشر عبر جوجل
  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error('حدث خطأ أثناء محاولة تسجيل الدخول عبر جوجل.');
      console.error('Google login error:', error.message);
    }
  };

  // --- القوائم وتحديد الصلاحيات ---
  const navItems = [
    { id: 'home', label: 'الرئيسية', icon: Home, requiresAuth: false },
    { id: 'services', label: 'جميع الخدمات', icon: Grip, requiresAuth: false },
    { id: 'appointments', label: 'المواعيد', icon: CalendarIcon, requiresAuth: true },
    { id: 'chronic', label: 'الأمراض المزمنة', icon: HeartPulse, requiresAuth: true },
    { id: 'child', label: 'نمو الطفل', icon: Baby, requiresAuth: true },
    { id: 'pregnancy', label: 'متابعة الحمل', icon: Heart, requiresAuth: true },
    { id: 'complaints', label: 'الشكاوى', icon: MessageSquare, requiresAuth: true },
    { id: 'survey', label: 'استبيان الرضا', icon: Activity, requiresAuth: true },
    { id: 'calculators', label: 'حاسبات طبية', icon: Calculator, requiresAuth: false },
    { id: 'pricing', label: 'لائحة الأسعار', icon: FileText, requiresAuth: false },
    { id: 'directory', label: 'دليل الأطباء', icon: Users, requiresAuth: false },
    { id: 'contact', label: 'اتصل بنا', icon: Phone, requiresAuth: false },
  ];

  const bottomNavItems = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'services', label: 'الخدمات', icon: Grip },
    { id: 'appointments', label: 'المواعيد', icon: CalendarIcon },
    { id: 'calculators', label: 'حاسبات', icon: Calculator },
  ];

  // =====================================
  // 🚀 التبويبات (Home, Services, Others)
  // =====================================

  const renderHomeTab = () => {
    if (selectedArticle) {
      return (
        <div className="max-w-3xl mx-auto bg-white rounded-3xl overflow-hidden shadow-lg border border-gray-100 animate-in slide-in-from-right-4">
          <div className="relative h-64 md:h-80 w-full">
            <button onClick={() => setSelectedArticle(null)} className="absolute top-4 right-4 z-10 bg-white/80 backdrop-blur p-2 rounded-full hover:bg-white transition-colors shadow-sm">
              <X className="w-6 h-6 text-gray-800" />
            </button>
            {selectedArticle.image_url ? (
              <img src={selectedArticle.image_url} alt={selectedArticle.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <BookOpen className="w-20 h-20 text-indigo-300" />
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-6 pt-24 text-white">
              <span className="bg-indigo-500 text-white px-3 py-1 rounded-full text-xs font-bold mb-3 inline-block shadow-sm">
                {selectedArticle.category}
              </span>
              <h2 className="text-2xl md:text-3xl font-black leading-tight">{selectedArticle.title}</h2>
            </div>
          </div>
          
          <div className="p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between mb-8 pb-6 border-b border-gray-100 gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 shrink-0">
                  <Stethoscope className="w-7 h-7" />
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-lg">{selectedArticle.author_name}</p>
                  <p className="text-sm text-indigo-600 font-medium">{selectedArticle.author_role || 'طاقم طبي'}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><CalendarIcon className="w-3.5 h-3.5"/> {new Date(selectedArticle.created_at).toLocaleDateString('ar-EG')}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5"/> قراءة في {calculateReadTime(selectedArticle.content)} دقيقة</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleShare(selectedArticle)} className="flex items-center justify-center w-10 h-10 bg-gray-50 text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                  <Share2 className="w-5 h-5" />
                </button>
                <button onClick={() => handleLike(selectedArticle.id)} className="flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-2 h-10 rounded-full hover:bg-rose-100 transition-colors font-bold">
                  <Heart className="w-5 h-5 fill-current" /> {selectedArticle.likes_count}
                </button>
              </div>
            </div>
            <div className="prose prose-lg prose-indigo rtl prose-headings:font-black prose-p:text-gray-700 max-w-none leading-relaxed" dangerouslySetInnerHTML={{ __html: selectedArticle.content }} />
            <button onClick={() => setSelectedArticle(null)} className="mt-12 w-full bg-gray-100 text-gray-700 font-bold py-4 rounded-2xl hover:bg-gray-200 transition-colors">العودة للرئيسية</button>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
        
        {/* لافتة الترحيب */}
        <div className="bg-gradient-to-l from-indigo-600 to-indigo-800 rounded-[2rem] p-6 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <div className="relative z-10 w-full">
                <h2 className="text-2xl md:text-3xl font-black mb-1">أهلاً بك{isGuest ? ' كزائر' : `، ${profile?.name?.split(' ')[0] || ''}`} 👋</h2>
                <p className="text-indigo-100 text-sm font-medium">صحتك هي أولويتنا في مركز طب أسرة غرب المطار.</p>
            </div>
            {!isGuest && (
                <div className="relative z-10 bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-xl flex items-center gap-3 shrink-0 self-start md:self-auto">
                    <FileText className="w-5 h-5 text-indigo-200" />
                    <div>
                        <p className="text-[10px] text-indigo-200">رقم الملف</p>
                        <p className="font-mono text-lg font-bold tracking-wider">{profile?.file_number || '---'}</p>
                    </div>
                </div>
            )}
        </div>

        {/* أزرار الوصول السريع */}
        <div>
            <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="font-black text-gray-800">وصول سريع</h3>
                <button onClick={() => setActiveTab('services')} className="text-xs font-bold text-indigo-600 hover:underline">عرض كل الخدمات</button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar hide-scrollbar-mobile snap-x">
                {[
                    { id: 'appointments', label: 'المواعيد', icon: CalendarIcon, color: 'text-blue-600', bg: 'bg-blue-50', requiresAuth: true },
                    { id: 'chronic', label: 'الأمراض المزمنة', icon: HeartPulse, color: 'text-rose-600', bg: 'bg-rose-50', requiresAuth: true },
                    { id: 'child', label: 'نمو الطفل', icon: Baby, color: 'text-emerald-600', bg: 'bg-emerald-50', requiresAuth: true },
                    { id: 'calculators', label: 'حاسبات طبية', icon: Calculator, color: 'text-purple-600', bg: 'bg-purple-50', requiresAuth: false }
                ].map(action => (
                    <button key={action.id} onClick={() => setActiveTab(action.id)} className="relative flex-shrink-0 snap-start w-[100px] flex flex-col items-center gap-2 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all active:scale-95">
                        {isGuest && action.requiresAuth && (
                            <div className="absolute top-2 right-2 bg-gray-100 p-1 rounded-full"><Lock className="w-3 h-3 text-gray-400"/></div>
                        )}
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${action.bg} ${action.color}`}>
                            <action.icon className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-bold text-gray-700 text-center leading-tight">{action.label}</span>
                    </button>
                ))}
            </div>
        </div>

        {/* قسم المقالات (التثقيف الصحي) */}
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                <h3 className="font-black text-gray-800 text-lg flex items-center gap-2">
                    <BookOpen className="text-indigo-600 w-5 h-5" /> أحدث المقالات الطبية
                </h3>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input type="text" placeholder="ابحث..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="w-full bg-white border border-gray-200 pl-3 pr-9 py-2 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow shadow-sm" />
                    </div>
                    <div className="flex items-center bg-white border border-gray-200 p-1 rounded-xl shadow-sm shrink-0">
                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400'}`}><LayoutList className="w-4 h-4" /></button>
                        <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400'}`}><LayoutGrid className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar hide-scrollbar-mobile">
                {categories.map(cat => (
                    <button key={cat} onClick={() => { setSelectedCategory(cat); setCurrentPage(1); }} className={`whitespace-nowrap px-4 py-1.5 rounded-full font-bold text-xs transition-all flex-shrink-0 border ${selectedCategory === cat ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                        {cat}
                    </button>
                ))}
            </div>

            {/* Articles Feed */}
            {loadingArticles ? (
                <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-3"}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`bg-white rounded-2xl p-3 border border-gray-100 flex ${viewMode === 'list' ? 'gap-3 items-center' : 'flex-col'} animate-pulse`}>
                            <div className={`bg-gray-100 rounded-xl ${viewMode === 'list' ? 'w-24 h-24' : 'w-full h-40'} shrink-0`}></div>
                            <div className="flex-1 space-y-3 py-2 w-full">
                                <div className="h-3 bg-gray-100 rounded-md w-1/4"></div>
                                <div className="h-5 bg-gray-100 rounded-md w-3/4"></div>
                                <div className="h-3 bg-gray-100 rounded-md w-full"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : articles.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                    <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-gray-500">لا توجد مقالات مطابقة</p>
                </div>
            ) : (
                <>
                    <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-4"}>
                    {articles.map((article) => (
                        <div key={article.id} onClick={() => setSelectedArticle(article)} className={`bg-white rounded-3xl p-3 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group flex ${viewMode === 'list' ? 'flex-row gap-4 items-center' : 'flex-col gap-3'}`}>
                            <div className={`relative overflow-hidden rounded-2xl shrink-0 ${viewMode === 'list' ? 'w-28 h-28 md:w-32 md:h-32' : 'w-full h-48'}`}>
                                {article.image_url ? (
                                    <img src={article.image_url} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-gray-50 to-indigo-50 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                                        <Stethoscope className="w-8 h-8 text-indigo-200" />
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 bg-white/95 backdrop-blur px-2 py-0.5 rounded-md text-[9px] font-black text-indigo-700 shadow-sm">
                                    {article.category}
                                </div>
                            </div>
                            
                            <div className="flex-1 min-w-0 flex flex-col justify-between py-1 h-full">
                                <div>
                                    <h3 className="font-black text-gray-800 text-base md:text-lg mb-1.5 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">{article.title}</h3>
                                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: article.content.replace(/<[^>]+>/g, '').substring(0, 100) + '...' }}></p>
                                </div>
                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                                    <div className="flex items-center gap-1.5 text-gray-400 text-[10px] font-bold">
                                        <User className="w-3 h-3 text-indigo-400" /> <span className="truncate max-w-[100px]">{article.author_name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-rose-500 text-[10px] font-bold bg-rose-50 px-2 py-1 rounded-md">
                                        <Heart className="w-3 h-3 fill-current" /> {article.likes_count}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between bg-white p-3 rounded-2xl shadow-sm border border-gray-100 mt-6">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 font-bold text-xs">
                                <ChevronRight className="w-4 h-4" /> السابق
                            </button>
                            <span className="text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                <span className="text-indigo-600 text-sm mx-1">{currentPage}</span> / {totalPages}
                            </span>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 font-bold text-xs">
                                التالي <ChevronLeft className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
      </div>
    );
  };

  const renderServicesTab = () => (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2 mb-6">
            <Grip className="text-indigo-600" /> دليل الخدمات الطبية
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {navItems.filter(i => !['home', 'services'].includes(i.id)).map(item => {
            const Icon = item.icon;
            return (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className="relative bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-100 transition-all group flex flex-col items-center text-center gap-3 active:scale-95">
                {isGuest && item.requiresAuth && (
                    <div className="absolute top-3 right-3 bg-gray-50 p-1.5 rounded-full border border-gray-200 shadow-sm">
                        <Lock className="w-4 h-4 text-gray-400" />
                    </div>
                )}
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 transition-colors duration-300">
                  <Icon className="w-7 h-7 text-indigo-600 group-hover:text-white transition-colors" />
                </div>
                <span className="font-bold text-gray-700 group-hover:text-indigo-900 text-sm">{item.label}</span>
            </button>
            )
        })}
        </div>
    </div>
  );

  const renderActiveTabContent = () => {
    if (activeTab === 'home') return renderHomeTab();
    if (activeTab === 'services') return renderServicesTab();
    
    // ✅ التأكد من حماية التبويبات إذا كان المستخدم ضيفاً وعرض رسالة الدخول مع زر Google
    const currentNavItem = navItems.find(i => i.id === activeTab);
    if (isGuest && currentNavItem?.requiresAuth) {
      return (
        <div className="max-w-md mx-auto mt-20 text-center bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 animate-in zoom-in-95">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Lock className="w-10 h-10 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">تسجيل الدخول مطلوب</h2>
          <p className="text-gray-500 mb-8 font-medium leading-relaxed">عذراً، يجب عليك تسجيل الدخول للمحافظة على سرية بياناتك الطبية والوصول إلى هذه الخدمة.</p>
          <button 
            onClick={handleGoogleLogin} 
            className="w-full bg-white border-2 border-gray-200 text-gray-700 px-8 py-3.5 rounded-2xl font-black hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            {/* أيقونة جوجل بسيطة كـ SVG */}
            <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            تسجيل الدخول باستخدام جوجل
          </button>
        </div>
      );
    }

    // عرض المكونات المسموح بها
    if (activeTab === 'chronic') return <ChronicLogs patientId={user?.id || ''} />;
    if (activeTab === 'child') return <ChildGrowthLogs patientId={user?.id || ''} />;
    if (activeTab === 'pregnancy') return <PregnancyLogs patientId={user?.id || ''} />;
    if (activeTab === 'complaints') return <PatientComplaints isGuest={isGuest} />;
    if (activeTab === 'appointments') return <PatientAppointments />;
    if (activeTab === 'survey') return <SurveyPage />;
    
    if (activeTab === 'calculators') return <CalculatorsMenu />;
    if (activeTab === 'pricing') return <PricingPage />;
    if (activeTab === 'directory') return <StaffDirectoryPage />;
    if (activeTab === 'contact') return <ContactPage />;

    return null;
  };

  return (
    <div className="h-screen w-full bg-gray-50/50 flex overflow-hidden font-sans text-right" dir="rtl">
      
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-[60] md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 right-0 z-[70] w-[75vw] max-w-[280px] bg-white border-l shadow-2xl 
        transform transition-transform duration-300 ease-in-out flex flex-col 
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} 
        md:translate-x-0 md:static md:w-72 md:shadow-none
      `}>
        <div className="h-20 flex items-center justify-between px-6 border-b shrink-0 bg-gradient-to-l from-indigo-50/50 to-white">
          <div className="flex items-center gap-3">
             <div className="bg-white p-2 rounded-xl shadow-sm border border-indigo-100">
               <Building2 className="w-6 h-6 text-indigo-600" />
             </div>
             <h1 className="font-black text-gray-800 text-lg">بوابة المريض</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
            <X className="w-5 h-5"/>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar pb-24 md:pb-4">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                className={`
                  w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-200 group
                  ${isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 font-bold' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 font-medium'}
                `}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-indigo-600'}`} />
                  <span className="text-sm">{item.label}</span>
                </div>
                {isGuest && item.requiresAuth && (
                  <Lock className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-200' : 'text-gray-300'}`} />
                )}
              </button>
            );
          })}
        </nav>

        {!isGuest && (
          <div className="p-4 border-t bg-gray-50 flex items-center justify-between shrink-0 mb-safe md:mb-0 pb-20 md:pb-4">
            <div className="flex items-center gap-3 overflow-hidden">
               <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0 border border-white shadow-sm">
                  <User className="w-5 h-5" />
               </div>
               <div className="text-right truncate">
                 <p className="text-xs font-bold text-gray-800 truncate">{profile?.name || 'مريض'}</p>
                 <p className="text-[10px] text-gray-500 font-mono mt-0.5">#{profile?.file_number || '---'}</p>
               </div>
            </div>
            <button onClick={signOut} className="p-2 rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
        {/* ✅ تعديل الزر في القائمة الجانبية للزوار ليقوم بتسجيل الدخول عبر جوجل */}
        {isGuest && (
           <div className="p-4 border-t bg-gray-50 shrink-0 mb-safe md:mb-0 pb-20 md:pb-4">
             <button 
                onClick={handleGoogleLogin} 
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md"
             >
               <LogIn className="w-5 h-5" /> دخول بحساب جوجل
             </button>
           </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50/50">
        <header className="h-16 md:h-20 bg-white/80 backdrop-blur-md border-b flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors active:scale-95 border border-gray-100">
              <Menu className="w-5 h-5 text-gray-700"/>
            </button>
            <h2 className="text-lg md:text-xl font-black text-gray-800 hidden md:block">مركز طب أسرة غرب المطار</h2>
            <h2 className="text-base font-black text-gray-800 md:hidden">{navItems.find(i => i.id === activeTab)?.label || 'الرئيسية'}</h2>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex flex-col items-end mr-4">
                 <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">الخط الساخن</p>
                 <div className="flex items-center gap-1 text-indigo-600 font-black font-mono text-sm">
                     <Phone className="w-3.5 h-3.5 fill-current"/> 15335
                 </div>
             </div>
          </div>
        </header>

        <main className={`flex-1 overflow-y-auto ${['calculators', 'pricing', 'contact', 'directory'].includes(activeTab) ? '' : 'p-4 md:p-8 pb-24 md:pb-8 custom-scrollbar scroll-smooth'}`}>
          {renderActiveTabContent()}
        </main>

        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-1.5 flex justify-between items-center z-50 pb-safe shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
          {bottomNavItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button 
                key={item.id} 
                onClick={() => setActiveTab(item.id)} 
                className={`flex flex-col items-center gap-1 w-16 pt-1 transition-all duration-300 ${isActive ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-indigo-50 shadow-sm scale-110' : 'bg-transparent'}`}>
                  <item.icon className={`w-5 h-5 ${isActive ? 'fill-indigo-100 stroke-indigo-600' : 'stroke-[1.5]'}`} />
                </div>
                <span className={`text-[9px] font-bold transition-all ${isActive ? 'opacity-100' : 'opacity-70'}`}>{item.label}</span>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
