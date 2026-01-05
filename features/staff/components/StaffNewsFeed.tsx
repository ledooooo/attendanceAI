import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { NewsPost, NewsComment, Employee } from '../../../types';
import { 
    Pin, MessageCircle, Send, Clock, Heart, ThumbsUp, 
    Reply, AtSign, Trash2, PartyPopper 
} from 'lucide-react';

export default function StaffNewsFeed({ employee }: { employee: Employee }) {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState<{ [key: string]: string }>({});
    const [replyTo, setReplyTo] = useState<{postId: string, commentId: string, name: string, userId: string} | null>(null);
    const [expandedPost, setExpandedPost] = useState<string | null>(null);

    useEffect(() => { fetchNews(); }, []);

    const sendNotification = async (recipientId: string, type: string, postId: string, message: string) => {
        if (recipientId === employee.employee_id) return;
        await supabase.from('notifications').insert({
            recipient_id: recipientId, sender_id: employee.employee_id,
            sender_name: employee.name, type, post_id: postId, message
        });
    };

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

    const handleReaction = async (id: string, emoji: string, type: 'post' | 'comment', targetUserId: string) => {
        const table = type === 'post' ? 'post_reactions' : 'comment_reactions';
        const field = type === 'post' ? 'post_id' : 'comment_id';
        
        const { data: existing } = await supabase.from(table).select('*').eq(field, id).eq('user_id', employee.employee_id).eq('emoji', emoji).maybeSingle();

        if (existing) {
            await supabase.from(table).delete().eq('id', existing.id);
        } else {
            await supabase.from(table).insert({ [field]: id, user_id: employee.employee_id, user_name: employee.name, emoji });
            sendNotification(targetUserId, 'reaction', id, `تفاعل ${employee.name} بـ ${emoji} مع ${type === 'post' ? 'منشورك' : 'تعليقك'}`);
        }
        fetchNews();
    };

    const handleSubmitComment = async (postId: string) => {
        const text = commentText[postId]?.trim();
        if (!text) return;

        const payload: any = { post_id: postId, user_id: employee.employee_id, user_name: employee.name, comment_text: text };
        if (replyTo && replyTo.postId === postId) payload.parent_id = replyTo.commentId;

        const { error } = await supabase.from('news_comments').insert(payload);
        if (!error) {
            if (replyTo) sendNotification(replyTo.userId, 'reply', postId, `ردَّ ${employee.name} على تعليقك`);
            setCommentText({ ...commentText, [postId]: '' });
            setReplyTo(null);
            fetchNews();
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-400 font-black animate-pulse">جاري تحميل الأخبار...</div>;

    return (
        <div className="space-y-6 pb-20 text-right" dir="rtl">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-[2.5rem] p-8 text-white shadow-lg mb-8 relative overflow-hidden">
                <h2 className="text-3xl font-black mb-2">أهلاً، {employee.name.split(' ')[0]} 👋</h2>
                <p className="opacity-90 font-medium italic">إليك آخر مستجدات المركز الطبي</p>
            </div>

            {posts.map(post => (
                <div key={post.id} className={`bg-white rounded-[2.5rem] border transition-all ${post.is_pinned ? 'border-emerald-200 ring-4 ring-emerald-50' : 'border-gray-100 shadow-sm'}`}>
                    {/* محتوى الخبر */}
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-black text-gray-800">{post.title}</h3>
                            {post.is_pinned && <Pin className="w-5 h-5 text-emerald-500 fill-emerald-500 animate-bounce" />}
                        </div>
                        <p className="text-gray-600 text-sm leading-relaxed mb-6 whitespace-pre-wrap">{post.content}</p>
                        
                        {/* تفاعلات البوست */}
                        <div className="flex items-center gap-3 border-t pt-4">
                            <div className="flex gap-1 bg-gray-50 p-1 rounded-full border border-gray-100">
                                {['❤️', '👍', '👏'].map(emoji => (
                                    <button key={emoji} onClick={() => handleReaction(post.id, emoji, 'post', post.created_by)} className="hover:scale-125 transition-transform px-2 py-1 text-xl">{emoji}</button>
                                ))}
                            </div>
                            <div className="flex gap-1">
                                {Array.from(new Set(post.reactions?.map((r: any) => r.emoji))).map((emoji: any) => (
                                    <div key={emoji} className="bg-indigo-50 px-2.5 py-1 rounded-full text-[10px] font-black text-indigo-600 border border-indigo-100">
                                        {emoji} {post.reactions.filter((r: any) => r.emoji === emoji).length}
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)} className="mr-auto text-xs font-bold text-gray-400 flex items-center gap-1 hover:text-emerald-600 transition-colors">
                                <MessageCircle className="w-4 h-4" /> {post.mainComments?.length || 0} تعليق
                            </button>
                        </div>
                    </div>

                    {/* التعليقات */}
                    {expandedPost === post.id && (
                        <div className="bg-gray-50/50 p-6 border-t border-gray-50 rounded-b-[2.5rem]">
                            <div className="space-y-6 max-h-96 overflow-y-auto custom-scrollbar px-2">
                                {post.mainComments.map((comment: any) => (
                                    <div key={comment.id} className="space-y-4">
                                        <div className="flex gap-3 items-start group">
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-black text-emerald-700">{comment.user_name[0]}</div>
                                            <div className="flex-1">
                                                <div className="bg-white p-4 rounded-3xl rounded-tr-none border border-gray-100 shadow-xs relative">
                                                    <p className="text-xs font-black text-gray-800 mb-1">{comment.user_name}</p>
                                                    <p className="text-sm text-gray-600">{comment.comment_text}</p>
                                                    
                                                    {/* خيارات التعليق */}
                                                    <div className="flex items-center gap-3 mt-3">
                                                        <button onClick={() => setReplyTo({postId: post.id, commentId: comment.id, name: comment.user_name, userId: comment.user_id})} className="text-[10px] font-black text-indigo-500 flex items-center gap-1"><Reply size={12}/> رد</button>
                                                        <button onClick={() => setCommentText({...commentText, [post.id]: `@${comment.user_name.replace(/\s/g, '_')} `})} className="text-[10px] font-black text-gray-400 flex items-center gap-1"><AtSign size={12}/> منشن</button>
                                                        <div className="flex gap-1 mr-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {['❤️', '👍'].map(emoji => (
                                                                <button key={emoji} onClick={() => handleReaction(comment.id, emoji, 'comment', comment.user_id)} className="text-xs">{emoji}</button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* الردود */}
                                        {comment.replies?.map((rep: any) => (
                                            <div key={rep.id} className="mr-12 flex gap-3 animate-in slide-in-from-right-4">
                                                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-black text-gray-600 uppercase">{rep.user_name[0]}</div>
                                                <div className="flex-1 bg-indigo-50/40 p-3 rounded-2xl border border-indigo-100/50">
                                                    <p className="text-[10px] font-black text-gray-700">{rep.user_name}</p>
                                                    <p className="text-xs text-gray-600">{rep.comment_text}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>

                            {/* حقل الإرسال */}
                            <div className="mt-6">
                                {replyTo && (
                                    <div className="flex justify-between items-center mb-2 px-4 py-2 bg-indigo-50 rounded-2xl text-xs font-black text-indigo-600 animate-in slide-in-from-bottom-2">
                                        <span>جاري الرد على: {replyTo.name}</span>
                                        <button onClick={() => setReplyTo(null)} className="text-red-500">إلغاء</button>
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <input 
                                        type="text" placeholder={replyTo ? "اكتب ردك هنا..." : "اكتب تعليقاً..."}
                                        className="flex-1 bg-white border border-gray-200 rounded-full px-6 py-3 text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                                        value={commentText[post.id] || ''}
                                        onChange={(e) => setCommentText({...commentText, [post.id]: e.target.value})}
                                    />
                                    <button onClick={() => handleSubmitComment(post.id)} className="bg-emerald-600 text-white p-3 rounded-full shadow-lg shadow-emerald-200 hover:scale-105 transition-transform active:scale-95"><Send size={20}/></button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
