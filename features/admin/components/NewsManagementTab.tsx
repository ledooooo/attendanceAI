import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { NewsPost } from '../../../types';
import { 
  Plus, Trash2, Pin, Image as ImageIcon, 
  Newspaper, Loader2, Save
} from 'lucide-react';

export default function NewsManagementTab() {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // نموذج إضافة خبر جديد
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    image_url: '',
    is_pinned: false
  });

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('news_posts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setPosts(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return alert('العنوان والمحتوى مطلوبان');

    setSubmitting(true);
    const { error } = await supabase.from('news_posts').insert({
      title: formData.title,
      content: formData.content,
      image_url: formData.image_url || null, // إذا كان فارغاً نرسل null
      is_pinned: formData.is_pinned
    });

    if (!error) {
      alert('تم نشر الخبر بنجاح ✅');
      setFormData({ title: '', content: '', image_url: '', is_pinned: false });
      fetchPosts();
    } else {
      alert('خطأ في النشر: ' + error.message);
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الخبر؟ سيتم حذف التعليقات المرتبطة به أيضاً.')) return;
    
    const { error } = await supabase.from('news_posts').delete().eq('id', id);
    if (!error) {
        fetchPosts();
    } else {
        alert('فشل الحذف');
    }
  };

  const togglePin = async (post: NewsPost) => {
      const { error } = await supabase
        .from('news_posts')
        .update({ is_pinned: !post.is_pinned })
        .eq('id', post.id);
      
      if(!error) fetchPosts();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex items-center gap-3 border-b pb-4">
            <Newspaper className="w-8 h-8 text-emerald-600"/>
            <h2 className="text-2xl font-black text-gray-800">إدارة الأخبار والمنشورات</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Form Section (New Post) */}
            <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-[30px] border shadow-sm sticky top-4">
                    <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-emerald-600"/> خبر جديد
                    </h3>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">عنوان الخبر</label>
                            <input 
                                type="text" 
                                className="w-full p-3 rounded-xl border bg-gray-50 outline-none focus:border-emerald-500 font-bold text-sm"
                                placeholder="مثال: تعليمات جديدة..."
                                value={formData.title}
                                onChange={e => setFormData({...formData, title: e.target.value})}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">المحتوى</label>
                            <textarea 
                                className="w-full p-3 rounded-xl border bg-gray-50 outline-none focus:border-emerald-500 font-medium text-sm min-h-[120px]"
                                placeholder="اكتب تفاصيل الخبر هنا..."
                                value={formData.content}
                                onChange={e => setFormData({...formData, content: e.target.value})}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">رابط الصورة (اختياري)</label>
                            <input 
                                type="url" 
                                className="w-full p-3 rounded-xl border bg-gray-50 outline-none focus:border-emerald-500 font-mono text-xs"
                                placeholder="https://example.com/image.jpg"
                                value={formData.image_url}
                                onChange={e => setFormData({...formData, image_url: e.target.value})}
                            />
                            <p className="text-[10px] text-gray-400 mt-1">يفضل استخدام روابط صور مباشرة</p>
                        </div>

                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setFormData({...formData, is_pinned: !formData.is_pinned})}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${formData.is_pinned ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'}`}>
                                {formData.is_pinned && <Pin className="w-3 h-3 text-white"/>}
                            </div>
                            <span className="text-sm font-bold text-gray-600">تثبيت الخبر في الأعلى</span>
                        </div>

                        <button 
                            type="submit" 
                            disabled={submitting}
                            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex justify-center items-center gap-2"
                        >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                            نشر الخبر
                        </button>
                    </form>
                </div>
            </div>

            {/* List Section (Previous Posts) */}
            <div className="lg:col-span-2 space-y-4">
                <h3 className="text-lg font-black text-gray-800 mb-2">الأخبار الحالية ({posts.length})</h3>
                
                {loading ? (
                    <div className="text-center py-10 text-gray-400">جاري التحميل...</div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-3xl border border-dashed text-gray-400">لا توجد أخبار منشورة</div>
                ) : (
                    <div className="grid gap-4">
                        {posts.map(post => (
                            <div key={post.id} className={`bg-white p-4 rounded-2xl border flex gap-4 ${post.is_pinned ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-100'}`}>
                                {/* Image Thumbnail */}
                                <div className="w-20 h-20 bg-gray-100 rounded-xl shrink-0 overflow-hidden">
                                    {post.image_url ? (
                                        <img src={post.image_url} alt="post" className="w-full h-full object-cover"/>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <ImageIcon className="w-8 h-8"/>
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-black text-gray-800 text-lg">{post.title}</h4>
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={() => togglePin(post)}
                                                className={`p-2 rounded-lg transition-colors ${post.is_pinned ? 'text-emerald-600 bg-emerald-100' : 'text-gray-400 hover:bg-gray-100'}`}
                                                title={post.is_pinned ? "إلغاء التثبيت" : "تثبيت"}
                                            >
                                                <Pin className="w-4 h-4"/>
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(post.id)}
                                                className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                                                title="حذف"
                                            >
                                                <Trash2 className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500 line-clamp-2 mt-1">{post.content}</p>
                                    <div className="mt-3 flex items-center gap-4 text-xs text-gray-400 font-bold">
                                        <span>{new Date(post.created_at).toLocaleDateString('ar-EG')}</span>
                                        {post.is_pinned && <span className="text-emerald-600 flex items-center gap-1"><Pin className="w-3 h-3"/> مثبت</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}
