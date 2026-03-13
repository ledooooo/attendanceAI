'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import { 
  Menu, X, User, Home, Activity, 
  MessageSquare, BookOpen, Phone, Share2, Heart, 
  Loader2, ChevronLeft, Baby, HeartPulse, Building2, LogIn, LogOut, Lock, FileText, Users, CalendarIcon, Calculator,
  Search, LayoutList, LayoutGrid, ChevronRight, Stethoscope, Clock
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

// تحديث الواجهة لتطابق أعمدة جدول medical_articles
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
  // التصنيفات الشائعة (يمكنك تعديلها حسب محتوى مقالاتك)
  const categories = ['الكل', 'الرعاية الأولية', 'تغذية', 'أمراض مزمنة', 'صحة الطفل', 'طب الأسنان', 'نصائح عامة'];

  useEffect(() => {
    if (!isGuest && user) {
      fetchProfile();
    }
  }, [user, isGuest]);

  useEffect(() => {
    if (activeTab === 'articles') {
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
      // التوجيه للجدول الصحيح medical_articles
      let query = supabase
        .from('medical_articles')
        .select('*', { count: 'exact' });

      // Filtering
      if (selectedCategory !== 'الكل') {
        query = query.eq('category', selectedCategory);
      }
      if (searchQuery.trim()) {
        query = query.ilike('title', `%${searchQuery}%`);
      }

      // Pagination
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
      // Optimistic UI Update
      setArticles(prev => prev.map(a => a.id === articleId ? { ...a, likes_count: a.likes_count + 1 } : a));
      if (selectedArticle && selectedArticle.id === articleId) {
        setSelectedArticle(prev => prev ? { ...prev, likes_count: prev.likes_count + 1 } : null);
      }
      
      // تأكد من وجود دالة increment_article_likes أو قم بإنشائها في قاعدة البيانات
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
          url: window.location.href, // أو رابط مخصص للمقال إذا وجد
        });
      } catch (error) {
        console.log('مشاركة ملغاة أو غير مدعومة', error);
      }
    } else {
      // Fallback: نسخ الرابط
      navigator.clipboard.writeText(window.location.href);
      toast.success('تم نسخ رابط المقال للمشاركة');
    }
  };

  // دالة لحساب وقت القراءة التقريبي (200 كلمة في الدقيقة)
  const calculateReadTime = (text: string) => {
    const words = text.replace(/<[^>]+>/g, '').split(/\s+/).length;
    const time = Math.ceil(words / 200);
    return time > 0 ? time : 1;
  };

  const renderArticlesTab = () => {
    if (selectedArticle) {
      return (
        <div className="max-w-3xl mx-auto bg-white rounded-3xl overflow-hidden shadow-lg border border-gray-100 animate-in slide-in-from-right-4">
          <div className="relative h-64 md:h-80 w-full">
            <button 
              onClick={() => setSelectedArticle(null)} 
              className="absolute top-4 right-4 z-10 bg-white/80 backdrop-blur p-2 rounded-full hover:bg-white transition-colors shadow-sm"
            >
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
                <button 
                  onClick={() => handleShare(selectedArticle)}
                  className="flex items-center justify-center w-10 h-10 bg-gray-50 text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                  title="مشاركة"
                >
                  <Share2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => handleLike(selectedArticle.id)}
                  className="flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-2 h-10 rounded-full hover:bg-rose-100 transition-colors font-bold"
                >
                  <Heart className="w-5 h-5 fill-current" />
                  {selectedArticle.likes_count}
                </button>
              </div>
            </div>
            
            <div className="prose prose-lg prose-indigo rtl prose-headings:font-black prose-p:text-gray-700 max-w-none leading-relaxed" 
                 dangerouslySetInnerHTML={{ __html: selectedArticle.content }} />
                 
            <button onClick={() => setSelectedArticle(null)} className="mt-12 w-full bg-gray-100 text-gray-700 font-bold py-4 rounded-2xl hover:bg-gray-200 transition-colors">
              العودة لقائمة المقالات
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
        
        {/* Header & Controls */}
        <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                    <BookOpen className="text-indigo-600" /> مكتبة التثقيف الصحي
                </h2>
                
                {/* View Toggle */}
                <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100">
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600 font-bold' : 'text-gray-400'}`}>
                        <LayoutList className="w-5 h-5" />
                    </button>
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600 font-bold' : 'text-gray-400'}`}>
                        <LayoutGrid className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                    type="text" 
                    placeholder="ابحث في المقالات (مثال: السكر، الضغط...)" 
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-white border border-gray-200 pl-4 pr-12 py-3.5 rounded-2xl font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow shadow-sm"
                />
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-2 pt-1 custom-scrollbar hide-scrollbar-mobile">
                {categories.map(cat => (
                    <button 
                        key={cat}
                        onClick={() => { setSelectedCategory(cat); setCurrentPage(1); }}
                        className={`whitespace-nowrap px-5 py-2 rounded-full font-bold text-sm transition-all flex-shrink-0 border ${
                            selectedCategory === cat 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>
        </div>

        {/* Articles List/Grid */}
        {loadingArticles ? (
            // Skeleton Loader
            <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-4"}>
                {[1, 2, 3].map(i => (
                    <div key={i} className={`bg-white rounded-3xl p-4 border border-gray-100 flex ${viewMode === 'list' ? 'gap-4 items-center' : 'flex-col'} animate-pulse`}>
                        <div className={`bg-gray-100 rounded-2xl ${viewMode === 'list' ? 'w-28 h-28 md:w-36 md:h-36' : 'w-full h-48'} shrink-0`}></div>
                        <div className="flex-1 space-y-4 py-2 w-full">
                            <div className="h-4 bg-gray-100 rounded-md w-1/4"></div>
                            <div className="h-6 bg-gray-100 rounded-md w-3/4"></div>
                            <div className="space-y-2">
                                <div className="h-3 bg-gray-100 rounded-md w-full"></div>
                                <div className="h-3 bg-gray-100 rounded-md w-5/6"></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        ) : articles.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-10 h-10 text-gray-300" />
                </div>
                <p className="text-lg font-bold text-gray-600">لا توجد مقالات مطابقة لبحثك</p>
                <button onClick={() => {setSearchQuery(''); setSelectedCategory('الكل');}} className="mt-4 text-indigo-600 font-bold hover:text-indigo-700 bg-indigo-50 px-6 py-2 rounded-full transition-colors">عرض جميع المقالات</button>
            </div>
        ) : (
            <>
                <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-4"}>
                {articles.map((article) => (
                    <div 
                        key={article.id} 
                        onClick={() => setSelectedArticle(article)}
                        className={`bg-white rounded-3xl p-4 border border-gray-100 shadow-sm hover:shadow-lg hover:border-indigo-100 transition-all duration-300 cursor-pointer group flex ${viewMode === 'list' ? 'flex-row gap-4 items-center' : 'flex-col gap-4'}`}
                    >
                        <div className={`relative overflow-hidden rounded-2xl shrink-0 ${viewMode === 'list' ? 'w-28 h-28 md:w-40 md:h-40' : 'w-full h-56'}`}>
                            {article.image_url ? (
                                <img src={article.image_url} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-gray-50 to-indigo-50 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                                    <Stethoscope className="w-10 h-10 text-indigo-200" />
                                </div>
                            )}
                            <div className="absolute top-2 right-2 bg-white/95 backdrop-blur px-2.5 py-1 rounded-lg text-[10px] font-black text-indigo-700 shadow-sm">
                                {article.category}
                            </div>
                        </div>
                        
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-1 h-full">
                            <div>
                                <h3 className="font-black text-gray-800 text-lg md:text-xl mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">{article.title}</h3>
                                <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: article.content.replace(/<[^>]+>/g, '').substring(0, 120) + '...' }}></p>
                            </div>
                            
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                                <div className="flex items-center gap-2 text-gray-500 text-xs font-bold">
                                    <div className="w-6 h-6 bg-indigo-50 rounded-full flex items-center justify-center">
                                      <User className="w-3 h-3 text-indigo-500" />
                                    </div>
                                    <span className="truncate max-w-[120px]">{article.author_name}</span>
                                </div>
                                <div className="flex items-center gap-1 text-rose-500 text-xs font-bold bg-rose-50 px-2.5 py-1.5 rounded-lg">
                                    <Heart className="w-3.5 h-3.5 fill-current" />
                                    {article.likes_count}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mt-8">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold text-sm transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" /> السابق
                        </button>
                        
                        <span className="text-sm font-bold text-gray-500 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                            صفحة <span className="text-indigo-600 text-base mx-1">{currentPage}</span> من {totalPages}
                        </span>

                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold text-sm transition-colors"
                        >
                            التالي <ChevronLeft className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </>
        )}
      </div>
    );
  };

  const navItems = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'chronic', label: 'الأمراض المزمنة', icon: HeartPulse },
    { id: 'child', label: 'نمو الطفل', icon: Baby },
    { id: 'pregnancy', label: 'متابعة الحمل', icon: Heart },
    { id: 'complaints', label: 'الشكاوى والمقترحات', icon: MessageSquare },
    { id: 'appointments', label: 'مواعيد العيادات', icon: CalendarIcon },
    { id: 'articles', label: 'المقالات الطبية', icon: BookOpen },
    { id: 'calculators', label: 'حاسبات طبية', icon: Calculator },
    { id: 'pricing', label: 'لائحة الأسعار', icon: FileText },
    { id: 'directory', label: 'دليل العاملين', icon: Users },
    { id: 'survey', label: 'استبيان الرضا', icon: Activity },
    { id: 'contact', label: 'اتصل بنا', icon: Phone },
  ];

  const bottomNavItems = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'appointments', label: 'المواعيد', icon: CalendarIcon },
    { id: 'articles', label: 'تثقيف', icon: BookOpen },
    { id: 'calculators', label: 'حاسبات', icon: Calculator },
  ];

  const renderActiveTabContent = () => {
    if (activeTab === 'home') {
      return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
            <div className="relative z-10">
              <h2 className="text-3xl font-black mb-2">أهلاً بك{isGuest ? ' كزائر' : `، ${profile?.name?.split(' ')[0] || ''}`} 👋</h2>
              <p className="text-indigo-100 font-medium">مركز طب أسرة غرب المطار في خدمتك دائماً.</p>
              
              {!isGuest && (
                <div className="mt-8 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl inline-flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-indigo-100 mb-1">رقم الملف الطبي</p>
                    <p className="font-mono text-xl font-bold tracking-wider">{profile?.file_number || '---'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {navItems.filter(i => i.id !== 'home').map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-100 transition-all group flex flex-col items-center text-center gap-3 active:scale-95"
                >
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
    }

    if (activeTab === 'articles') return renderArticlesTab();
    if (activeTab === 'chronic' && !isGuest) return <ChronicLogs />;
    if (activeTab === 'child' && !isGuest) return <ChildGrowthLogs />;
    if (activeTab === 'pregnancy' && !isGuest) return <PregnancyLogs />;
    if (activeTab === 'complaints') return <PatientComplaints isGuest={isGuest} />;
    if (activeTab === 'appointments') return <PatientAppointments />;
    if (activeTab === 'calculators') return <CalculatorsMenu />;
    if (activeTab === 'pricing') return <PricingPage />;
    if (activeTab === 'directory') return <StaffDirectoryPage />;
    if (activeTab === 'survey') return <SurveyPage />;
    if (activeTab === 'contact') return <ContactPage />;

    if (isGuest && ['chronic', 'child', 'pregnancy'].includes(activeTab)) {
      return (
        <div className="max-w-md mx-auto mt-20 text-center bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
          <Lock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-gray-800 mb-2">هذه الميزة للمسجلين فقط</h2>
          <p className="text-gray-500 mb-8">يرجى تسجيل الدخول أو إنشاء حساب للوصول إلى السجلات الطبية الشخصية.</p>
          <button onClick={signOut} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 w-full">
            تسجيل الدخول الآن
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="h-screen w-full bg-gray-50 flex overflow-hidden font-sans text-right" dir="rtl">
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-[60] md:hidden backdrop-blur-sm" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      <aside className={`
        fixed inset-y-0 right-0 z-[70] w-72 bg-white border-l shadow-2xl 
        transform transition-transform duration-300 ease-in-out flex flex-col 
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} 
        md:translate-x-0 md:static md:w-72 md:shadow-none
      `}>
        <div className="h-20 flex items-center justify-between px-6 border-b shrink-0 bg-gray-50/50">
          <div className="flex items-center gap-3">
             <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100">
               <Building2 className="w-6 h-6 text-indigo-600" />
             </div>
             <h1 className="font-black text-gray-800 text-lg">بوابة المرضى</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
            <X className="w-6 h-6"/>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar pb-24 md:pb-4">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                className={`
                  w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 group
                  ${isActive 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 font-bold' 
                    : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 font-medium'
                  }
                `}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-indigo-600'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {!isGuest && (
          <div className="p-4 border-t bg-gray-50 flex items-center justify-between shrink-0 mb-safe md:mb-0 pb-20 md:pb-4">
            <div className="flex items-center gap-3 overflow-hidden">
               <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                  <User className="w-5 h-5" />
               </div>
               <div className="text-right truncate">
                 <p className="text-xs font-bold text-gray-800 truncate">{profile?.name || 'مريض'}</p>
                 <p className="text-[10px] text-gray-500 font-mono mt-0.5">#{profile?.file_number || '---'}</p>
               </div>
            </div>
            <button onClick={signOut} className="p-2.5 rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
        {isGuest && (
           <div className="p-4 border-t bg-gray-50 shrink-0 mb-safe md:mb-0 pb-20 md:pb-4">
             <button onClick={signOut} className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md">
               <LogIn className="w-5 h-5" /> تسجيل الدخول
             </button>
           </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-gray-50/50">
        
        <header className="h-20 bg-white/80 backdrop-blur-md border-b flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2.5 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
              <Menu className="w-6 h-6 text-gray-700"/>
            </button>
            <h2 className="text-xl font-black text-gray-800 hidden md:block">مركز طب أسرة غرب المطار</h2>
            <h2 className="text-lg font-black text-gray-800 md:hidden">{navItems.find(i => i.id === activeTab)?.label || 'الرئيسية'}</h2>
          </div>

          <div className="flex items-center gap-4">
             <div className="hidden md:flex flex-col items-end mr-4">
                 <p className="text-sm font-bold text-gray-800">الخط الساخن</p>
                 <div className="flex items-center gap-1 text-indigo-600 font-black font-mono">
                     <Phone className="w-3.5 h-3.5 fill-current"/> 15335
                 </div>
             </div>
          </div>
        </header>

        <main className={`flex-1 overflow-y-auto ${['calculators', 'pricing', 'contact', 'directory', 'survey'].includes(activeTab) ? '' : 'p-4 md:p-8 pb-24 md:pb-8 custom-scrollbar'}`}>
          {renderActiveTabContent()}
        </main>

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
                <span className={`text-[10px] font-bold transition-all ${isActive ? 'opacity-100' : 'opacity-70'}`}>{item.label}</span>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
