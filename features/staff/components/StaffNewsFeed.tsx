import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { NewsPost, NewsComment, Employee } from '../../../types';
import { 
    Pin, MessageCircle, Send, Clock, Heart, ThumbsUp, 
    Reply, AtSign, Trash2 
} from 'lucide-react';

export default function StaffNewsFeed({ employee }: { employee: Employee }) {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState<{ [key: string]: string }>({});
    const [replyTo, setReplyTo] = useState<{postId: string, commentId: string, name: string, userId: string} | null>(null);
    const [expandedPost, setExpandedPost] = useState<string | null>(null);

    useEffect(() => { fetchNews(); }, []);

    // دالة إرسال التنبيهات
    const sendNotification = async (recipientId: string, type: string, postId: string, message: string) => {
        if (recipientId === employee.employee_id) return;
        await supabase.from('notifications').insert({
            recipient_id: recipientId, sender_id: employee.employee_id,
            sender_name: employee.name, type, post_id: postId, message
        });
    };

    const fetchNews = async () => {
        setLoading(true);
        try {
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
        } catch (error) {
            console.error("Fetch News Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleReaction = async (id: string, emoji: string, type: 'post' | 'comment', targetUserId: string) => {
        const table = type === 'post' ? 'post_reactions' : 'comment_reactions';
        const field = type === 'post' ? 'post_id' : 'comment_id';
        
        const { data: existing } = await supabase.from(table).select('*').eq(field, id).eq('user_id', employee.employee_id).eq('emoji', emoji).maybeSingle();

        if (existing) {
            await supabase.from(table).delete().eq('id', existing.id);
        } else {
            await supabase.from(table).insert({ [field]: id, user_id: employee.employee_id, user_name: employee.name, emoji });
            sendNotification(targetUserId, 'reaction', id, `تفاعل ${employee.name} بـ ${emoji} على ${type === 'post' ? 'منشورك' : 'تعليقك'}`);
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

    // مكون فرعي لعرض الرياكشنات تحت التعليق
    const ReactionBadges = ({ reactions }: { reactions: any[] }) => {
        if (!reactions || reactions.length === 0) return null;
        
        // تجميع الرياكشنات حسب الإيموجي
        const groups = reactions.reduce((acc: any, curr: any) => {
            acc[curr.emoji] = acc[curr.emoji] || [];
            acc[curr.emoji].push(curr.user_name);
            return acc;
        }, {});

        return (
            <div className="flex flex-wrap gap-1 mt-1">
                {Object.keys(groups).map(emoji => (
                    <div key={emoji} className="group relative bg-white border border-indigo-100 px-1.5 py-0.5 rounded-full text-[10px] shadow-sm flex items-center gap-1 cursor-default">
                        <span>{emoji}</span>
                        <span className="font-bold text-indigo-600">{groups[emoji].length}</span>
                        {/* قائمة الأسماء عند الهوفر */}
                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white p-2 rounded-lg text-[9px] whitespace-nowrap z-50">
                            {groups[emoji].join('، ')}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    if (loading) return <div className="p-10 text-center text-gray-400 font-black animate-pulse">جاري تحميل الأخبار...</div>;

    return (
        <div className="space-y-6 pb-20 text-right" dir="rtl">
            {posts.map(post => (
                <div key={post.id} className={`bg-white rounded-[2.5rem] border transition-all ${post.is_pinned ? 'border-emerald-200 ring-4 ring-emerald-50' : 'border-gray-100 shadow-sm'}`}>
                    {/* محتوى البوست */}
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-black text-gray-800">{post.title}</h3>
                            {post.is_pinned && <Pin className="w-5 h-5 text-emerald-500 fill-emerald-500" />}
                        </div>
                        <p className="text-gray-600 text-sm leading-relaxed mb-6 whitespace-pre-wrap">{post.content}</p>
                        
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
                            <button onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)} className="mr-auto text-xs font-bold text-gray-400 flex items-center gap-1 hover:text-emerald-600">
                                <MessageCircle size={16} /> {post.mainComments?.length || 0} تعليق
                            </button>
                        </div>
                    </div>

                    {/* التعليقات والردود */}
                    {expandedPost === post.id && (
                        <div className="bg-gray-50/50 p-6 border-t border-gray-50">
                            <div className="space-y-6 max-h-96 overflow-y-auto custom-scrollbar px-2">
                                {post.mainComments.map((comment: any) => (
                                    <div key={comment.id} className="space-y-2">
                                        <div className="flex gap-3 items-start group">
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-black text-emerald-700">{comment.user_name[0]}</div>
                                            <div className="flex-1">
                                                <div className="bg-white p-3 rounded-2xl rounded-tr-none border border-gray-100 shadow-xs relative">
                                                    <p className="text-[11px] font-black text-gray-800 mb-0.5">{comment.user_name}</p>
                                                    <p className="text-sm text-gray-600">{comment.comment_text}</p>
                                                    
                                                    {/* أزرار الرياكشن السريعة للتعليق */}
                                                    <div className="flex items-center gap-3 mt-2 border-t border-gray-50 pt-2">
                                                        <button onClick={() => setReplyTo({postId: post.id, commentId: comment.id, name: comment.user_name, userId: comment.user_id})} className="text-[10px] font-black text-indigo-500 hover:underline">رد</button>
                                                        <div className="flex gap-2">
                                                            {['❤️', '👍'].map(emoji => (
                                                                <button key={emoji} onClick={() => handleReaction(comment.id, emoji, 'comment', comment.user_id)} className="text-xs hover:scale-125 transition-transform">{emoji}</button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* عرض الرياكشنات تحت التعليق مباشرة */}
                                                <ReactionBadges reactions={comment.reactions} />
                                            </div>
                                        </div>

                                        {/* الردود المتداخلة */}
                                        {comment.replies?.map((rep: any) => (
                                            <div key={rep.id} className="mr-10 flex gap-3">
                                                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-black text-gray-600">{rep.user_name[0]}</div>
                                                <div className="flex-1">
                                                    <div className="bg-white/60 p-2 rounded-xl border border-gray-100">
                                                        <p className="text-[10px] font-black text-gray-700">{rep.user_name}</p>
                                                        <p className="text-xs text-gray-600">{rep.comment_text}</p>
                                                        
                                                        {/* رياكشنات الردود */}
                                                        <div className="flex gap-2 mt-1">
                                                            {['❤️'].map(emoji => (
                                                                <button key={emoji} onClick={() => handleReaction(rep.id, emoji, 'comment', rep.user_id)} className="text-[10px] grayscale hover:grayscale-0">{emoji}</button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <ReactionBadges reactions={rep.reactions} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>

                            {/* حقل الإدخال */}
                            <div className="mt-6">
                                {replyTo && (
                                    <div className="flex justify-between items-center mb-2 px-4 py-1 bg-indigo-50 rounded-lg text-xs font-bold text-indigo-600">
                                        <span>الرد على: {replyTo.name}</span>
                                        <button onClick={() => setReplyTo(null)} className="text-red-500">إلغاء</button>
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <input 
                                        type="text" placeholder={replyTo ? "اكتب ردك..." : "اكتب تعليقاً..."}
                                        className="flex-1 bg-white border border-gray-200 rounded-full px-5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                        value={commentText[post.id] || ''}
                                        onChange={(e) => setCommentText({...commentText, [post.id]: e.target.value})}
                                    />
                                    <button onClick={() => handleSubmitComment(post.id)} className="bg-emerald-600 text-white p-2.5 rounded-full"><Send size={18}/></button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
