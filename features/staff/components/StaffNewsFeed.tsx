import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { NewsPost, NewsComment, Employee } from '../../../types';
import { Pin, MessageCircle, Send, Image as ImageIcon, Clock } from 'lucide-react';

export default function StaffNewsFeed({ employee }: { employee: Employee }) {
    const [posts, setPosts] = useState<NewsPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState<{[key:string]: string}>({}); // نص التعليق لكل بوست
    const [expandedPost, setExpandedPost] = useState<string | null>(null);

    useEffect(() => {
        fetchNews();
    }, []);

    const fetchNews = async () => {
        setLoading(true);
        // جلب الأخبار مرتبة: المثبت أولاً، ثم الأحدث
        const { data: postsData } = await supabase
            .from('news_posts')
            .select('*')
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false });

        if (postsData) {
            // جلب التعليقات لكل البوستات (يمكن تحسينه لاحقاً)
            const { data: commentsData } = await supabase
                .from('news_comments')
                .select('*')
                .order('created_at', { ascending: true });
            
            // دمج التعليقات مع البوستات
            const postsWithComments = postsData.map(p => ({
                ...p,
                comments: commentsData?.filter(c => c.post_id === p.id) || []
            }));
            
            setPosts(postsWithComments);
        }
        setLoading(false);
    };

    const handlePostComment = async (postId: string) => {
        const text = commentText[postId]?.trim();
        if (!text) return;

        const { error } = await supabase.from('news_comments').insert({
            post_id: postId,
            user_id: employee.employee_id,
            user_name: employee.name,
            comment_text: text
        });

        if (!error) {
            setCommentText(prev => ({ ...prev, [postId]: '' })); // مسح الحقل
            fetchNews(); // تحديث البيانات (أو تحديث الحالة محلياً للأداء الأفضل)
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-400">جاري تحميل الأخبار...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* ترويسة ترحيبية تشبه التطبيقات */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-[2.5rem] p-8 text-white shadow-lg mb-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-white opacity-5 pattern-dots"></div>
                <h2 className="text-3xl font-black mb-2 relative z-10">أهلاً، {employee.name.split(' ')[0]} 👋</h2>
                <p className="opacity-90 font-medium relative z-10">إليك آخر مستجدات وأخبار المركز الطبي</p>
            </div>

            <div className="grid gap-6">
                {posts.map(post => (
                    <div key={post.id} className={`bg-white rounded-[2rem] border shadow-sm overflow-hidden transition-all hover:shadow-md ${post.is_pinned ? 'border-emerald-200 ring-4 ring-emerald-50' : 'border-gray-100'}`}>
                        
                        {/* صورة الخبر (إن وجدت) */}
                        {post.image_url && (
                            <div className="h-48 w-full bg-gray-100 relative">
                                <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" />
                                {post.is_pinned && (
                                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur text-emerald-700 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 shadow-sm">
                                        <Pin className="w-3 h-3 fill-emerald-700"/> مثبت
                                    </div>
                                )}
                            </div>
                        )}

                        {/* محتوى الخبر */}
                        <div className="p-6">
                            {!post.image_url && post.is_pinned && (
                                <div className="flex items-center gap-2 text-emerald-600 text-xs font-black mb-2">
                                    <Pin className="w-3 h-3 fill-emerald-600"/> منشور مثبت
                                </div>
                            )}
                            
                            <h3 className="text-xl font-black text-gray-800 mb-2">{post.title}</h3>
                            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap mb-4">
                                {post.content}
                            </p>
                            
                            <div className="flex items-center justify-between text-xs text-gray-400 font-bold border-t pt-4">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {new Date(post.created_at).toLocaleDateString('ar-EG')}</span>
                                <button 
                                    onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                                    className="flex items-center gap-1 hover:text-emerald-600 transition-colors"
                                >
                                    <MessageCircle className="w-4 h-4"/> {post.comments?.length || 0} تعليق
                                </button>
                            </div>
                        </div>

                        {/* قسم التعليقات (Expandable) */}
                        {expandedPost === post.id && (
                            <div className="bg-gray-50 p-4 border-t border-gray-100 animate-in slide-in-from-top-2">
                                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto custom-scrollbar">
                                    {post.comments?.length === 0 && <p className="text-center text-gray-400 text-xs py-2">كن أول من يعلق!</p>}
                                    {post.comments?.map(c => (
                                        <div key={c.id} className="flex gap-3 items-start">
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
                                                {c.user_name.charAt(0)}
                                            </div>
                                            <div className="bg-white p-3 rounded-2xl rounded-tr-none border border-gray-100 shadow-sm flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold text-xs text-gray-800">{c.user_name}</span>
                                                    <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-sm text-gray-600">{c.comment_text}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* إضافة تعليق */}
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="اكتب تعليقاً..." 
                                        className="flex-1 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm outline-none focus:border-emerald-500 transition-colors"
                                        value={commentText[post.id] || ''}
                                        onChange={(e) => setCommentText({...commentText, [post.id]: e.target.value})}
                                        onKeyDown={(e) => e.key === 'Enter' && handlePostComment(post.id)}
                                    />
                                    <button 
                                        onClick={() => handlePostComment(post.id)}
                                        className="bg-emerald-600 text-white p-2 rounded-full hover:bg-emerald-700 transition-transform active:scale-90"
                                    >
                                        <Send className="w-4 h-4"/>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                
                {posts.length === 0 && !loading && (
                    <div className="text-center py-20 opacity-50">
                        <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-300"/>
                        <p className="font-bold text-gray-400">لا توجد أخبار حالياً</p>
                    </div>
                )}
            </div>
        </div>
    );
}
