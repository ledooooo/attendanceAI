import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { NewsPost } from '../../../types';
import { 
  Plus, Trash2, Pin, Image as ImageIcon, 
  Newspaper, Loader2, Save, Upload, Link as LinkIcon 
} from 'lucide-react';

export default function NewsManagementTab() {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // حالات الصورة
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url');
  const [imageFile, setImageFile] = useState<File | null>(null);

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

  // دالة رفع الصورة
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        // 1. الرفع
        const { error: uploadError } = await supabase.storage
            .from('news-images') // تأكد من إنشاء هذا الـ Bucket في Supabase
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. جلب الرابط
        const { data } = supabase.storage
            .from('news-images')
            .getPublicUrl(filePath);

        return data.publicUrl;
    } catch (error) {
        console.error('Upload Error:', error);
        alert('فشل رفع الصورة، تأكد من إعدادات Storage في Supabase');
        return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return alert('العنوان والمحتوى مطلوبان');

    setSubmitting(true);
    
    let finalImageUrl = formData.image_url;

    // إذا كان الوضع "رفع صورة" وتم اختيار ملف
    if (imageMode === 'upload' && imageFile) {
        const uploadedUrl = await uploadImage(imageFile);
        if (uploadedUrl) {
            finalImageUrl = uploadedUrl;
        } else {
            setSubmitting(false);
            return; // توقف إذا فشل الرفع
        }
    }

    const { error } = await supabase.from('news_posts').insert({
      title: formData.title,
      content: formData.content,
      image_url: finalImageUrl || null,
      is_pinned: formData.is_pinned
    });

    if (!error) {
      alert('تم نشر الخبر بنجاح ✅');
      // إعادة تعيين النموذج
      setFormData({ title: '', content: '', image_url: '', is_pinned: false });
      setImageFile(null);
      setImageMode('url');
      fetchPosts();
    } else {
      alert('خطأ في النشر: ' + error.message);
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الخبر؟')) return;
    
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

                        {/* قسم اختيار الصورة */}
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                            <label className="block text-sm font-bold text-gray-700 mb-2">صورة الخبر (اختياري)</label>
                            
                            {/* أزرار التبديل */}
                            <div className="flex gap-2 mb-3">
                                <button 
                                    type="button"
                                    onClick={() => setImageMode('url')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors ${imageMode === 'url' ? 'bg-white shadow text-emerald-600' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    <LinkIcon className="w-3 h-3"/> رابط خارجي
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setImageMode('upload')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors ${imageMode === 'upload' ? 'bg-white shadow text-emerald-600' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    <Upload className="w-3 h-3"/> رفع صورة
                                </button>
                            </div>

                            {/* حقل الإدخال حسب الوضع */}
                            {imageMode === 'url' ? (
                                <input 
                                    type="url" 
                                    className="w-full p-2 rounded-lg border outline-none focus:border-emerald-500 font-mono text-xs bg-white"
                                    placeholder="https://example.com/image.jpg"
                                    value={formData.image_url}
                                    onChange={e => setFormData({...formData, image_url: e.target.value})}
                                />
                            ) : (
                                <div className="relative">
                                    <input 
                                        type="file" 
                                        accept="image/*"
                                        onChange={e => setImageFile(e.target.files ? e.target.files[0] : null)}
                                        className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setFormData({...formData, is_pinned: !formData.is_pinned})}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.is_pinned ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'}`}>
                                {formData.is_pinned && <Pin className="w-3 h-3 text-white"/>}
                            </div>
                            <span className="text-sm font-bold text-gray-600">تثبيت الخبر في الأعلى</span>
                        </div>

                        <button 
                            type="submit" 
                            disabled={submitting}
                            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex justify-center items-center gap-2 shadow-lg shadow-emerald-100"
                        >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                            {imageMode === 'upload' && imageFile ? 'رفع الصورة ونشر الخبر' : 'نشر الخبر'}
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
                            <div key={post.id} className={`bg-white p-4 rounded-2xl border flex gap-4 transition-shadow hover:shadow-md ${post.is_pinned ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-100'}`}>
                                {/* Image Thumbnail */}
                                <div className="w-24 h-24 bg-gray-100 rounded-xl shrink-0 overflow-hidden border border-gray-200">
                                    {post.image_url ? (
                                        <img src={post.image_url} alt="post" className="w-full h-full object-cover"/>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <ImageIcon className="w-8 h-8"/>
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-black text-gray-800 text-lg line-clamp-1">{post.title}</h4>
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
                                        <p className="text-sm text-gray-600 line-clamp-2 mt-1 leading-relaxed">{post.content}</p>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-gray-400 font-bold mt-2">
                                        <span>{new Date(post.created_at).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                        {post.is_pinned && <span className="text-emerald-600 flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-emerald-100 shadow-sm"><Pin className="w-3 h-3"/> مثبت</span>}
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
