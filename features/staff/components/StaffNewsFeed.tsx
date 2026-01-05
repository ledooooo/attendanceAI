import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { NewsPost, NewsComment, Employee } from '../../../types';
import { 
    Pin, MessageCircle, Send, Clock, Heart, 
    Reply, AtSign, X, Calendar, User, Sparkles
} from 'lucide-react';

export default function StaffNewsFeed({ employee }: { employee: Employee }) {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState<{ [key: string]: string }>({});
    const [replyTo, setReplyTo] = useState<{postId: string, commentId: string, name: string, userId: string} | null>(null);
    const [expandedPost, setExpandedPost] = useState<string | null>(null);
    
    // حالات التحكم في القوائم العائمة
    const [showPostReactions, setShowPostReactions] = useState<string | null>(null);
    const [showCommentReactions, setShowCommentReactions] = useState<string | null>(null);

    const REACTION_OPTIONS = [
        { e: '❤️', l: 'حب' },
        { e: '😊', l: 'سمايل' },
        { e: '😂', l: 'ضحك' },
        { e: '👏', l: 'تصفيق' },
        { e: '👍', l: 'تمام' }
    ];

    useEffect(() => { fetchNews(); }, []);

    // تنسيق التاريخ والوقت
    const formatDateTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return {
            date: date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }),
            time: date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        };
    };

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
        } catch (error) { console.error(error); } finally { setLoading(false); }
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
        setShowPostReactions(null);
        setShowCommentReactions(null);
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

    if (loading) return <div className="p-10 text-center text-gray-400 font-black animate-pulse px-4">جاري تحميل الأخبار...</div>;

    return (
        <div className="max-w-4xl mx-auto pb-20 text-right space-y-8 px-4" dir="rtl">
            
            {/* ✅ جزء الترحيب الثابت */}
            <div className="sticky top-4 z-40 bg-white/80 backdrop-blur-xl border border-emerald-100 rounded-[2rem] p-6 shadow-xl shadow-emerald-900/5 flex items-center justify-between overflow-hidden">
                <div className="absolute -left-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full blur-3xl opacity-60"></div>
                <div className="relative flex items-center gap-4">
                    <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                        <Sparkles size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-800">أهلاً بك، {employee.name.split(' ')[0]}</h2>
                        <p className="text-xs text-emerald-600 font-bold">نتمنى لك يوماً سعيداً في المركز</p>
                    </div>
                </div>
                <div className="hidden sm:block text-left">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider">التاريخ اليوم</p>
                    <p className="text-sm font-black text-gray-700">{formatDateTime(new Date().toISOString()).date}</p>
                </div>
            </div>

            <div className="space-y-8">
                {posts.map(post => {
                    const postTime = formatDateTime(post.created_at);
                    return (
                        <div key={post.id} className={`bg-white rounded-[2.5rem] border transition-all duration-300 ${post.is_pinned ? 'border-emerald-200 ring-4 ring-emerald-50' : 'border-gray-100 shadow-sm'}`}>
                            {post.image_url && (
                                <div className="w-full h-72 overflow-hidden bg-gray-100 relative rounded-t-[2.5rem]">
                                    <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                                </div>
                            )}

                            <div className="p-8">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-2 text-gray-400 text-[11px] font-bold">
                                        <Calendar size={14} />
                                        <span>{postTime.date}</span>
                                        <span className="mx-1">•</span>
                                        <Clock size={14} />
                                        <span>{postTime.time}</span>
                                    </div>
                                    {post.is_pinned && <Pin size={18} className="text-emerald-500 fill-emerald-500" />}
                                </div>
                                <h3 className="text-2xl font-black text-gray-800 mb-3">{post.title}</h3>
                                <p className="text-gray-600 leading-relaxed mb-8 whitespace-pre-wrap">{post.content}</p>
                                
                                <div className="flex items-center gap-4 border-t border-gray-50 pt-6 relative">
                                    <div className="relative">
                                        <button 
                                            onClick={() => setShowPostReactions(showPostReactions === post.id ? null : post.id)}
                                            className="flex items-center gap-2 px-6 py-2.5 bg-gray-50 rounded-2xl hover:bg-pink-50 text-gray-700 font-black text-sm transition-all"
                                        >
                                            <Heart size={18} className={post.reactions?.some((r:any)=>r.user_id === employee.employee_id) ? "fill-pink-500 text-pink-500" : ""} />
                                            <span>تفاعل</span>
                                        </button>
                                        {showPostReactions === post.id && (
                                            <div className="absolute bottom-full mb-3 right-0 bg-white shadow-2xl border border-gray-100 rounded-full p-2 flex gap-4 animate-in fade-in slide-in-from-bottom-2 z-50">
                                                {REACTION_OPTIONS.map(item => (
                                                    <button key={item.e} onClick={() => handleReaction(post.id, item.e, 'post', post.created_by)} className="text-2xl hover:scale-150 transition-transform active:scale-90">{item.e}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex -space-x-1 space-x-reverse">
                                        {Array.from(new Set(post.reactions?.map((r: any) => r.emoji))).map((emoji: any) => (
                                            <div key={emoji} className="bg-white px-2 py-1 rounded-full text-[12px] font-black border border-gray-100 shadow-sm">
                                                {emoji} <span className="text-indigo-600 text-[10px]">{post.reactions.filter((r: any) => r.emoji === emoji).length}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)} className="mr-auto text-sm font-black text-gray-400 flex items-center gap-2 hover:text-emerald-600 transition-colors">
                                        <MessageCircle size={20} />
                                        <span>{post.mainComments?.length || 0} تعليق</span>
                                    </button>
                                </div>
                            </div>

                            {expandedPost === post.id && (
                                <div className="bg-gray-50/50 p-6 border-t border-gray-50 rounded-b-[2.5rem]">
                                    <div className="space-y-8 max-h-[600px] overflow-y-auto custom-scrollbar pl-2">
                                        {post.mainComments.map((comment: any) => {
                                            const commentTime = formatDateTime(comment.created_at);
                                            return (
                                                <div key={comment.id} className="space-y-4">
                                                    <div className="flex gap-4 items-start group">
                                                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-sm font-black text-emerald-700 shrink-0 shadow-sm">
                                                            {comment.user_name[0]}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="bg-white p-5 rounded-[2rem] rounded-tr-none border border-gray-100 shadow-sm relative">
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <span className="font-black text-sm text-gray-800">{comment.user_name}</span>
                                                                    <span className="text-[9px] text-gray-400 font-bold flex items-center gap-1"><Clock size={10}/> {commentTime.time} - {commentTime.date}</span>
                                                                </div>
                                                                <p className="text-sm text-gray-600 leading-relaxed mb-4">{comment.comment_text}</p>
                                                                
                                                                {/* ✅ تنسيق الأزرار لمنع التداخل */}
                                                                <div className="flex items-center gap-8 pt-3 border-t border-gray-50">
                                                                    <button 
                                                                        onClick={() => setReplyTo({postId: post.id, commentId: comment.id, name: comment.user_name, userId: comment.user_id})} 
                                                                        className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
                                                                    >
                                                                        <Reply size={14}/> رد
                                                                    </button>
                                                                    <div className="relative">
                                                                        <button 
                                                                            onClick={() => setShowCommentReactions(showCommentReactions === comment.id ? null : comment.id)}
                                                                            className="text-[11px] font-black text-gray-400 hover:text-pink-600 flex items-center gap-1.5"
                                                                        >
                                                                            <Heart size={14} className={comment.reactions?.some((r:any)=>r.user_id === employee.employee_id) ? "fill-pink-500 text-pink-500" : ""} /> تفاعل
                                                                        </button>
                                                                        {showCommentReactions === comment.id && (
                                                                            <div className="absolute bottom-full mb-2 right-0 bg-white shadow-xl border border-gray-100 rounded-full p-2 flex gap-3 z-50">
                                                                                {REACTION_OPTIONS.map(item => (
                                                                                    <button key={item.e} onClick={() => handleReaction(comment.id, item.e, 'comment', comment.user_id)} className="text-xl hover:scale-150 transition-transform">{item.e}</button>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="mt-2 flex flex-wrap gap-1 pr-4">
                                                                {comment.reactions?.map((r: any, idx: number) => (
                                                                    <span key={idx} className="bg-white border border-gray-100 px-2 py-0.5 rounded-full text-[10px] shadow-xs">{r.emoji}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {comment.replies?.map((rep: any) => {
                                                        const repTime = formatDateTime(rep.created_at);
                                                        return (
                                                            <div key={rep.id} className="mr-14 flex gap-4">
                                                                <div className="w-8 h-8 rounded-xl bg-gray-200 flex items-center justify-center text-[10px] font-black text-gray-600 shrink-0">{rep.user_name[0]}</div>
                                                                <div className="flex-1">
                                                                    <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/50">
                                                                        <div className="flex justify-between items-center mb-1">
                                                                            <span className="text-xs font-black text-gray-700">{rep.user_name}</span>
                                                                            <span className="text-[8px] text-gray-400">{repTime.time}</span>
                                                                        </div>
                                                                        <p className="text-xs text-gray-600 leading-relaxed">{rep.comment_text}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-10 relative">
                                        {replyTo && (
                                            <div className="absolute -top-12 right-4 left-4 flex justify-between items-center bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black animate-in slide-in-from-bottom-2">
                                                <span>رد على: {replyTo.name}</span>
                                                <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-white/20 rounded-lg"><X size={14}/></button>
                                            </div>
                                        )}
                                        <div className="flex gap-3">
                                            <input 
                                                type="text" placeholder={replyTo ? "اكتب ردك هنا..." : "اكتب تعليقاً..."}
                                                className="flex-1 bg-white border-2 border-gray-100 rounded-2xl px-6 py-4 text-sm outline-none focus:border-emerald-500 transition-all shadow-sm"
                                                value={commentText[post.id] || ''}
                                                onChange={(e) => setCommentText({...commentText, [post.id]: e.target.value})}
                                            />
                                            <button onClick={() => handleSubmitComment(post.id)} className="bg-emerald-600 text-white p-4 rounded-2xl shadow-lg shadow-emerald-100 hover:scale-105 active:scale-95 transition-all"><Send size={22}/></button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
