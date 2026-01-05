import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { NewsPost, NewsComment, Employee } from '../../../types';
import { 
    Pin, MessageCircle, Send, Clock, Heart, ThumbsUp, 
    PartyPopper, Reply, ChevronDown, ChevronUp 
} from 'lucide-react';

export default function StaffNewsFeed({ employee }: { employee: Employee }) {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState<{ [key: string]: string }>({});
    const [replyTo, setReplyTo] = useState<{postId: string, commentId: string, name: string} | null>(null);
    const [expandedPost, setExpandedPost] = useState<string | null>(null);

    useEffect(() => { fetchNews(); }, []);

    const fetchNews = async () => {
        setLoading(true);
        const { data: postsData } = await supabase.from('news_posts').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
        const { data: commentsData } = await supabase.from('news_comments').select('*').order('created_at', { ascending: true });
        const { data: pReactions } = await supabase.from('post_reactions').select('*');
        const { data: cReactions } = await supabase.from('comment_reactions').select('*');

        if (postsData) {
            const enriched = postsData.map(p => {
                const postComments = (commentsData || []).filter(c => c.post_id === p.id);
                return {
                    ...p,
                    reactions: (pReactions || []).filter(r => r.post_id === p.id),
                    // تنظيم التعليقات: الأساسية والردود
                    mainComments: postComments.filter(c => !c.parent_id).map(mc => ({
                        ...mc,
                        reactions: (cReactions || []).filter(r => r.comment_id === mc.id),
                        replies: postComments.filter(r => r.parent_id === mc.id).map(rep => ({
                            ...rep,
                            reactions: (cReactions || []).filter(r => r.comment_id === rep.id)
                        }))
                    }))
                };
            });
            setPosts(enriched);
        }
        setLoading(false);
    };

    const handleReaction = async (id: string, emoji: string, type: 'post' | 'comment') => {
        const table = type === 'post' ? 'post_reactions' : 'comment_reactions';
        const field = type === 'post' ? 'post_id' : 'comment_id';
        
        const { data: existing } = await supabase.from(table).select('*').eq(field, id).eq('user_id', employee.employee_id).eq('emoji', emoji).maybeSingle();

        if (existing) {
            await supabase.from(table).delete().eq('id', existing.id);
        } else {
            await supabase.from(table).insert({ [field]: id, user_id: employee.employee_id, user_name: employee.name, emoji });
        }
        fetchNews();
    };

    const handleSubmitComment = async (postId: string) => {
        const text = commentText[postId]?.trim();
        if (!text) return;

        const payload: any = {
            post_id: postId,
            user_id: employee.employee_id,
            user_name: employee.name,
            comment_text: text
        };

        if (replyTo && replyTo.postId === postId) {
            payload.parent_id = replyTo.commentId;
        }

        const { error } = await supabase.from('news_comments').insert(payload);
        if (!error) {
            setCommentText({ ...commentText, [postId]: '' });
            setReplyTo(null);
            fetchNews();
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-400 font-bold">جاري تحميل الأخبار...</div>;

    return (
        <div className="space-y-6 pb-20 text-right" dir="rtl">
            {posts.map(post => (
                <div key={post.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                    {/* محتوى البوست */}
                    <div className="p-6">
                        <h3 className="text-xl font-black mb-2">{post.title}</h3>
                        <p className="text-gray-600 mb-4">{post.content}</p>
                        
                        {/* تفاعلات البوست */}
                        <div className="flex items-center gap-3 border-t pt-4">
                            <div className="flex gap-1 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
                                {['❤️', '👍', '🔥'].map(emoji => (
                                    <button key={emoji} onClick={() => handleReaction(post.id, emoji, 'post')} className="hover:scale-125 transition-transform px-1 text-lg">
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-1">
                                {Array.from(new Set(post.reactions?.map((r: any) => r.emoji))).map((emoji: any) => (
                                    <div key={emoji} className="bg-indigo-50 px-2 py-0.5 rounded-full text-xs font-bold text-indigo-600 border border-indigo-100">
                                        {emoji} {post.reactions.filter((r: any) => r.emoji === emoji).length}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* قسم التعليقات والردود */}
                    <div className="bg-gray-50/50 p-6 border-t border-gray-50">
                        <div className="space-y-6">
                            {post.mainComments?.map((comment: any) => (
                                <div key={comment.id} className="space-y-3">
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 uppercase">{comment.user_name[0]}</div>
                                        <div className="flex-1 bg-white p-3 rounded-2xl shadow-xs border border-gray-100">
                                            <p className="text-xs font-black text-gray-800 mb-1">{comment.user_name}</p>
                                            <p className="text-sm text-gray-600">{comment.comment_text}</p>
                                            
                                            <div className="flex items-center gap-4 mt-2">
                                                <button onClick={() => setReplyTo({postId: post.id, commentId: comment.id, name: comment.user_name})} className="text-[10px] font-bold text-indigo-500 flex items-center gap-1 hover:underline"><Reply size={12}/> رد</button>
                                                <div className="flex gap-1">
                                                    {['❤️', '👍'].map(emoji => (
                                                        <button key={emoji} onClick={() => handleReaction(comment.id, emoji, 'comment')} className="text-[10px] grayscale hover:grayscale-0">{emoji}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* عرض الردود */}
                                    {comment.replies?.map((rep: any) => (
                                        <div key={rep.id} className="mr-10 flex gap-3">
                                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 uppercase">{rep.user_name[0]}</div>
                                            <div className="flex-1 bg-indigo-50/30 p-2 rounded-xl border border-indigo-100/50">
                                                <p className="text-[10px] font-black text-gray-700">{rep.user_name}</p>
                                                <p className="text-xs text-gray-600">{rep.comment_text}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>

                        {/* حقل الإدخال الذكي */}
                        <div className="mt-6">
                            {replyTo && replyTo.postId === post.id && (
                                <div className="flex justify-between items-center mb-2 px-4 py-1 bg-indigo-50 rounded-lg text-[10px] font-bold text-indigo-600 animate-in fade-in">
                                    <span>الرد على: {replyTo.name}</span>
                                    <button onClick={() => setReplyTo(null)} className="text-red-500">إلغاء</button>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder={replyTo ? "اكتب ردك..." : "اكتب تعليقاً..."}
                                    className="flex-1 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                    value={commentText[post.id] || ''}
                                    onChange={(e) => setCommentText({...commentText, [post.id]: e.target.value})}
                                />
                                <button onClick={() => handleSubmitComment(post.id)} className="bg-emerald-600 text-white p-2 rounded-full shadow-lg shadow-emerald-200 active:scale-90 transition-transform"><Send size={18}/></button>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
