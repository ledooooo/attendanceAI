import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { NewsPost, NewsComment, Employee } from '../../../types';
import { Pin, MessageCircle, Send, Image as ImageIcon, Clock, Heart, ThumbsUp, PartyPopper } from 'lucide-react';

// تعريف واجهة التفاعل
interface Reaction {
    emoji: string;
    user_id: string;
    user_name: string;
}

interface EnrichedComment extends NewsComment {
    reactions?: Reaction[];
}

interface EnrichedPost extends NewsPost {
    comments: EnrichedComment[];
}

export default function StaffNewsFeed({ employee }: { employee: Employee }) {
    const [posts, setPosts] = useState<EnrichedPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState<{ [key: string]: string }>({});
    const [expandedPost, setExpandedPost] = useState<string | null>(null);

    useEffect(() => {
        fetchNews();
    }, []);

    const fetchNews = async () => {
        setLoading(true);
        const { data: postsData } = await supabase
            .from('news_posts')
            .select('*')
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false });

        if (postsData) {
            const { data: commentsData } = await supabase
                .from('news_comments')
                .select('*')
                .order('created_at', { ascending: true });

            // جلب التفاعلات
            const { data: reactionsData } = await supabase
                .from('comment_reactions')
                .select('*');

            const postsWithComments = postsData.map(p => ({
                ...p,
                comments: (commentsData || [])
                    .filter(c => c.post_id === p.id)
                    .map(c => ({
                        ...c,
                        reactions: (reactionsData || []).filter(r => r.comment_id === c.id)
                    }))
            }));

            setPosts(postsWithComments);
        }
        setLoading(false);
    };

    const handleReaction = async (commentId: string, emoji: string) => {
        // التحقق إذا كان المستخدم قد تفاعل بالفعل بنفس الإيموجي
        const { data: existing } = await supabase
            .from('comment_reactions')
            .select('*')
            .eq('comment_id', commentId)
            .eq('user_id', employee.employee_id)
            .eq('emoji', emoji)
            .maybeSingle();

        if (existing) {
            // إزالة التفاعل
            await supabase.from('comment_reactions').delete().eq('id', existing.id);
        } else {
            // إضافة تفاعل جديد
            await supabase.from('comment_reactions').insert({
                comment_id: commentId,
                user_id: employee.employee_id,
                user_name: employee.name,
                emoji: emoji
            });
        }
        fetchNews(); // تحديث لعرض التغييرات
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
            setCommentText(prev => ({ ...prev, [postId]: '' }));
            fetchNews();
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-400">جاري تحميل الأخبار...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20 text-right" dir="rtl">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-[2.5rem] p-8 text-white shadow-lg mb-8 relative overflow-hidden">
                <h2 className="text-3xl font-black mb-2">أهلاً، {employee.name.split(' ')[0]} 👋</h2>
                <p className="opacity-90 font-medium">إليك آخر مستجدات وأخبار المركز الطبي</p>
            </div>

            <div className="grid gap-6">
                {posts.map(post => (
                    <div key={post.id} className={`bg-white rounded-[2rem] border shadow-sm overflow-hidden transition-all ${post.is_pinned ? 'border-emerald-200 ring-4 ring-emerald-50' : 'border-gray-100'}`}>
                        {post.image_url && (
                            <div className="h-48 w-full bg-gray-100 relative">
                                <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" />
                                {post.is_pinned && (
                                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur text-emerald-700 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1">
                                        <Pin className="w-3 h-3 fill-emerald-700" /> مثبت
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="p-6">
                            <h3 className="text-xl font-black text-gray-800 mb-2">{post.title}</h3>
                            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap mb-4">{post.content}</p>

                            <div className="flex items-center justify-between text-xs text-gray-400 font-bold border-t pt-4">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(post.created_at).toLocaleDateString('ar-EG')}</span>
                                <button onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)} className="flex items-center gap-1 hover:text-emerald-600 transition-colors">
                                    <MessageCircle className="w-4 h-4" /> {post.comments?.length || 0} تعليق
                                </button>
                            </div>
                        </div>

                        {expandedPost === post.id && (
                            <div className="bg-gray-50 p-4 border-t border-gray-100 animate-in slide-in-from-top-2">
                                <div className="space-y-4 mb-4 max-h-80 overflow-y-auto custom-scrollbar px-2">
                                    {post.comments?.map(c => (
                                        <div key={c.id} className="flex gap-3 items-start group">
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0 uppercase">
                                                {c.user_name.charAt(0)}
                                            </div>
                                            <div className="flex-1">
                                                <div className="bg-white p-3 rounded-2xl rounded-tr-none border border-gray-100 shadow-sm relative">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-bold text-xs text-gray-800">{c.user_name}</span>
                                                        <span className="text-[9px] text-gray-400">{new Date(c.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-600">{c.comment_text}</p>
                                                    
                                                    {/* أزرار التفاعل السريع */}
                                                    <div className="absolute -bottom-3 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow-md rounded-full px-2 py-1 border border-gray-100 scale-90">
                                                        {['❤️', '👍', '👏'].map(emoji => (
                                                            <button 
                                                                key={emoji} 
                                                                onClick={() => handleReaction(c.id, emoji)}
                                                                className="hover:scale-125 transition-transform text-xs"
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* عرض ملخص التفاعلات */}
                                                {c.reactions && c.reactions.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1 mr-2">
                                                        {Array.from(new Set(c.reactions.map(r => r.emoji))).map(emoji => {
                                                            const usersWithThisEmoji = c.reactions!.filter(r => r.emoji === emoji);
                                                            return (
                                                                <div 
                                                                    key={emoji}
                                                                    className="group relative flex items-center bg-white border border-emerald-100 px-1.5 py-0.5 rounded-full text-[10px] shadow-xs cursor-default"
                                                                >
                                                                    <span>{emoji}</span>
                                                                    <span className="mr-0.5 font-bold text-emerald-600">{usersWithThisEmoji.length}</span>
                                                                    
                                                                    {/* Tooltip بالأسماء */}
                                                                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white p-2 rounded-xl text-[9px] whitespace-nowrap z-50 shadow-xl opacity-90 animate-in fade-in zoom-in-95">
                                                                        <div className="font-bold border-b border-white/20 mb-1 pb-1">المتفاعلون:</div>
                                                                        {usersWithThisEmoji.map(u => u.user_name).join('، ')}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="اكتب تعليقاً..."
                                        className="flex-1 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm outline-none focus:border-emerald-500"
                                        value={commentText[post.id] || ''}
                                        onChange={(e) => setCommentText({ ...commentText, [post.id]: e.target.value })}
                                        onKeyDown={(e) => e.key === 'Enter' && handlePostComment(post.id)}
                                    />
                                    <button onClick={() => handlePostComment(post.id)} className="bg-emerald-600 text-white p-2 rounded-full hover:bg-emerald-700 transition-transform active:scale-90">
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
