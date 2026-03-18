import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { NewsPost, Employee } from '../../../types';
import { 
    Plus, Trash2, Pin, Image as ImageIcon, 
    Newspaper, Loader2, Send, Link as LinkIcon, Upload, Gift, CalendarHeart
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function NewsManagementTab() {
    const [posts, setPosts] = useState<NewsPost[]>([]);
    const [birthdays, setBirthdays] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [publishingBirthday, setPublishingBirthday] = useState<string | null>(null);

    const [imageMode, setImageMode] = useState<'url' | 'upload'>('url');
    const [imageFile, setImageFile] = useState<File | null>(null);

    const [formData, setFormData] = useState({
        title: '',
        content: '',
        image_url: '',
        is_pinned: false
    });

    useEffect(() => {
        fetchPosts();
        fetchBirthdays();
    }, []);

    const fetchPosts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('news_posts')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error fetching posts:', error);
            toast.error('فشل جلب الأخبار');
        } else if (data) {
            setPosts(data as NewsPost[]);
        }
        setLoading(false);
    };

    // ✅ جلب أعياد ميلاد الموظفين النشطين في الشهر الحالي من الرقم القومي
    const fetchBirthdays = async () => {
        const { data, error } = await supabase.from('employees').select('*').eq('status', 'نشط');
        if (error || !data) return;

        const currentMonth = new Date().getMonth() + 1;

        const bdays = data.filter(emp => {
            if (!emp.national_id || emp.national_id.length !== 14) return false;
            // استخراج شهر الميلاد من الرقم القومي (الخانات 3 و 4)
            const bMonth = parseInt(emp.national_id.substring(3, 5), 10);
            return bMonth === currentMonth;
        });

        // ترتيب حسب اليوم
        bdays.sort((a, b) => {
            const dayA = parseInt(a.national_id.substring(5, 7), 10);
            const dayB = parseInt(b.national_id.substring(5, 7), 10);
            return dayA - dayB;
        });

        setBirthdays(bdays);
    };

    const uploadImage = async (file: File): Promise<string | null> => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('news-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('news-images')
                .getPublicUrl(filePath);

            return data.publicUrl;
        } catch (error) {
            console.error('Upload Error:', error);
            toast.error('فشل رفع الصورة، تأكد من إعدادات مساحة التخزين');
            return null;
        }
    };

    // ✅ دالة إرسال الإشعارات للجميع
    const triggerPushNotifications = async (title: string, body: string) => {
        try {
            const { data: activeEmps } = await supabase.from('employees').select('employee_id').eq('status', 'نشط');
            if (!activeEmps || activeEmps.length === 0) return;

            const notificationsPayload = activeEmps.map(emp => ({
                user_id: String(emp.employee_id),
                title: "خبر جديد من الإدارة 📢",
                message: title,
                type: 'general',
                is_read: false
            }));

            await supabase.from('notifications').insert(notificationsPayload);

            Promise.all(
                activeEmps.map(emp => 
                    supabase.functions.invoke('send-push-notification', {
                        body: { 
                            userId: String(emp.employee_id), 
                            title: "خبر جديد من الإدارة 📢", 
                            body: title.substring(0, 50), 
                            url: '/staff?tab=news' 
                        }
                    })
                )
            ).catch(err => console.error("Push invocation error:", err));
            
        } catch (err) {
            console.error("Notification Error:", err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title || !formData.content) return toast.error('العنوان والمحتوى مطلوبان');

        setSubmitting(true);
        let finalImageUrl = formData.image_url;

        if (imageMode === 'upload' && imageFile) {
            const uploadedUrl = await uploadImage(imageFile);
            if (uploadedUrl) {
                finalImageUrl = uploadedUrl;
            } else {
                setSubmitting(false);
                return;
            }
        }

        const { error } = await supabase.from('news_posts').insert({
            title: formData.title,
            content: formData.content,
            image_url: finalImageUrl || null,
            is_pinned: formData.is_pinned,
            type: 'general'
        });

        if (!error) {
            await triggerPushNotifications(formData.title, formData.content);
            toast.success('تم نشر الخبر بنجاح ✅');
            setFormData({ title: '', content: '', image_url: '', is_pinned: false });
            setImageFile(null);
            setImageMode('url');
            fetchPosts();
        } else {
            toast.error('خطأ في النشر: ' + error.message);
        }
        setSubmitting(false);
    };

    // ✅ دالة نشر تهنئة عيد الميلاد
    const publishBirthdayGreeting = async (emp: Employee) => {
        setPublishingBirthday(emp.id);
        const title = `🎉 عيد ميلاد سعيد ${emp.name.split(' ')[0]}! 🎂`;
        const content = `تتقدم أسرة المركز بأرق التهاني وأطيب الأمنيات للزميل(ة) الغالي(ة) "${emp.name}" بمناسبة عيد ميلاده(ا). نتمنى لك عاماً مليئاً بالنجاح والسعادة والصحة. كل عام وأنت بخير! 🎈🎁✨`;
        const defaultImage = 'https://img.pikbest.com/backgrounds/20250124/happy-birthday-wishes-cake_11444514.jpg!w700wp';

        const { error } = await supabase.from('news_posts').insert({
            title,
            content,
            image_url: defaultImage,
            is_pinned: false,
            type: 'birthday'
        });

        if (!error) {
            await triggerPushNotifications(title, content);
            toast.success('تم نشر التهنئة بنجاح! 🥳');
            fetchPosts();
        } else {
            toast.error('خطأ في النشر: ' + error.message);
        }
        setPublishingBirthday(null);
    };
    
    const handleDelete = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا الخبر؟')) return;
        try {
            const { error } = await supabase.from('news_posts').delete().eq('id', id);
            if (error) throw error;
            toast.success('تم الحذف بنجاح ✅');
            fetchPosts();
        } catch (error: any) {
            toast.error('فشل الحذف: ' + (error.message || 'خطأ غير معروف'));
        }
    };

    // ✅ دالة التثبيت المحدثة مع إصلاح الأخطاء
    const togglePin = async (post: NewsPost) => {
        try {
            const { error } = await supabase
                .from('news_posts')
                .update({ is_pinned: !post.is_pinned })
                .eq('id', post.id);
            
            if (error) throw error;
            toast.success(post.is_pinned ? 'تم إلغاء التثبيت' : 'تم التثبيت بنجاح');
            fetchPosts();
        } catch (error: any) {
            console.error('Toggle Pin Error:', error);
            toast.error('فشل تغيير حالة التثبيت');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex items-center gap-3 border-b pb-4">
                <Newspaper className="w-8 h-8 text-emerald-600"/>
                <h2 className="text-2xl font-black text-gray-800">إدارة الأخبار والمنشورات</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* الجزء الجانبي: الفورم + أعياد الميلاد */}
                <div className="lg:col-span-1 space-y-6">
                    
                    {/* ✅ قائمة أعياد الميلاد لهذا الشهر */}
                    <div className="bg-gradient-to-br from-pink-50 to-purple-50 p-6 rounded-[30px] border border-pink-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-400 to-purple-500"></div>
                        <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                            <CalendarHeart className="w-5 h-5 text-pink-600"/> أعياد ميلاد الشهر الحالي
                        </h3>
                        
                        {birthdays.length === 0 ? (
                            <div className="text-center py-6 bg-white/50 rounded-2xl border border-dashed border-pink-200">
                                <p className="text-sm font-bold text-gray-500">لا توجد أعياد ميلاد مسجلة هذا الشهر</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                {birthdays.map((emp) => {
                                    const bDay = emp.national_id.substring(5, 7);
                                    const bMonth = emp.national_id.substring(3, 5);
                                    
                                    return (
                                        <div key={emp.id} className="bg-white p-3 rounded-2xl shadow-sm border border-pink-100 flex items-center justify-between gap-3 hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-10 h-10 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center font-black text-xs shrink-0 border border-pink-200">
                                                    {bDay}/{bMonth}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-gray-800 text-sm truncate">{emp.name.split(' ').slice(0,2).join(' ')}</p>
                                                    <p className="text-[10px] text-gray-500 font-bold truncate">{emp.specialty}</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => publishBirthdayGreeting(emp)}
                                                disabled={publishingBirthday === emp.id}
                                                className="shrink-0 p-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                                title="نشر تهنئة في الأخبار"
                                            >
                                                {publishingBirthday === emp.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Gift className="w-4 h-4"/>}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* فورم نشر خبر جديد */}
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

                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                <label className="block text-sm font-bold text-gray-700 mb-2">صورة الخبر (اختياري)</label>
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

                                {imageMode === 'url' ? (
                                    <input 
                                        type="url" 
                                        className="w-full p-2 rounded-lg border outline-none focus:border-emerald-500 font-mono text-xs bg-white"
                                        placeholder="https://example.com/image.jpg"
                                        value={formData.image_url}
                                        onChange={e => setFormData({...formData, image_url: e.target.value})}
                                    />
                                ) : (
                                    <input 
                                        type="file" 
                                        accept="image/*"
                                        onChange={e => setImageFile(e.target.files ? e.target.files[0] : null)}
                                        className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                                    />
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
                                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex justify-center items-center gap-2 shadow-lg shadow-emerald-100 active:scale-95"
                            >
                                {submitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5"/>}
                                {submitting ? 'جاري النشر...' : 'نشر الخبر وإرسال إشعار'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* جزء عرض الأخبار المضافة */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-lg font-black text-gray-800 mb-2 flex items-center gap-2">
                        الأخبار الحالية ({posts.length})
                    </h3>
                    
                    {loading ? (
                        <div className="text-center py-20 flex flex-col items-center">
                            <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4"/>
                            <p className="text-gray-500 font-bold">جاري تحميل الأخبار...</p>
                        </div>
                    ) : posts.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-gray-200">
                            <Newspaper className="w-16 h-16 text-gray-300 mx-auto mb-4"/>
                            <h3 className="text-lg font-black text-gray-600 mb-1">لا توجد أخبار منشورة</h3>
                            <p className="text-sm font-bold text-gray-400">قم بنشر خبرك الأول من القائمة الجانبية.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {posts.map(post => (
                                <div key={post.id} className={`bg-white p-4 rounded-2xl border flex gap-4 transition-all hover:shadow-md ${post.is_pinned ? 'border-emerald-300 bg-emerald-50/40 ring-1 ring-emerald-100' : 'border-gray-100'}`}>
                                    <div className="w-24 h-24 bg-gray-50 rounded-xl shrink-0 overflow-hidden border border-gray-200">
                                        {post.image_url ? (
                                            <img src={post.image_url} alt="post" className="w-full h-full object-cover"/>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                <ImageIcon className="w-8 h-8"/>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 flex flex-col justify-between min-w-0">
                                        <div>
                                            <div className="flex justify-between items-start gap-2">
                                                <h4 className="font-black text-gray-800 text-lg line-clamp-1 truncate">{post.title}</h4>
                                                <div className="flex gap-1 shrink-0">
                                                    <button 
                                                        onClick={() => togglePin(post)}
                                                        className={`p-2 rounded-lg transition-colors ${post.is_pinned ? 'text-emerald-600 bg-emerald-100 shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}
                                                        title={post.is_pinned ? 'إلغاء التثبيت' : 'تثبيت'}
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
                                        <div className="flex items-center gap-4 text-[11px] md:text-xs text-gray-400 font-bold mt-3">
                                            <span>{new Date(post.created_at).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                            {post.is_pinned && <span className="text-emerald-600 flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-emerald-100 shadow-sm"><Pin className="w-3 h-3"/> مثبت</span>}
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
