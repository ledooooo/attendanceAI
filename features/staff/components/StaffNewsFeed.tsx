import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { NewsPost, NewsComment, Employee } from '../../../types';
import { 
    Pin, MessageCircle, Send, Clock, Heart, ThumbsUp, 
    Reply, AtSign, Trash2, Smile, PartyPopper, X 
} from 'lucide-react'; // ✅ تأكد من وجود X هنا

export default function StaffNewsFeed({ employee }: { employee: Employee }) {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState<{ [key: string]: string }>({});
    const [replyTo, setReplyTo] = useState<{postId: string, commentId: string, name: string, userId: string} | null>(null);
    const [expandedPost, setExpandedPost] = useState<string | null>(null);
    const [showPostReactions, setShowPostReactions] = useState<string | null>(null);

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
            console.error(error);
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
        setShowPostReactions(null);
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

    const ReactionBadges = ({ reactions }: { reactions: any[] }) => {
        if (!reactions || reactions.length === 0) return null;
        const groups = reactions.reduce((acc: any, curr: any) => {
            acc[curr.emoji] = acc[curr.emoji] || [];
            acc[curr.emoji].push(curr.user_name);
            return acc;
        }, {});

        return (
            <div className="flex flex-wrap gap-1 mt-1 mr-2">
                {Object.keys(groups).map(emoji => (
                    <div key={emoji} className="group relative bg-white border border-gray-100 px-1.5 py-0.5 rounded-full text-[10px] shadow-xs flex items-center gap-1">
                        <span>{emoji}</span>
                        <span className="font-bold text-gray-500">{groups[emoji].length}</span>
                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white p-2 rounded-lg text-[9px] whitespace-nowrap z-50">
                            {groups[emoji].join('، ')}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    if (loading) return <div className="p-10 text-center text-gray-400 font-black">جاري تحميل الأخبار...</div>;

    return (
        <div className="space-y-6 pb-20 text-right" dir="rtl">
            {posts.map(post => (
                <div key={post.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                    {post.image_url && (
                        <div className="w-full h-64 overflow-hidden bg-gray-100 relative">
                            <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                    )}

                    <div className="p-6">
                        <h3 className="text-xl font-black text-gray-800 mb-2">{post.title}</h3>
                        <p className="text-gray-600 text-sm leading-relaxed mb-6 whitespace-pre-wrap">{post.content}</p>
                        
                        <div className="flex items-center gap-4 border-t pt-4 relative">
                            <div className="relative">
                                <button 
                                    onClick={() => setShowPostReactions(showPostReactions === post.id ? null : post.id)}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full hover:bg-pink-50 text-gray-600 hover:text-pink-600 transition-all font-bold text-sm"
                                >
                                    <Heart size={20} className={post.reactions?.some((r:any)=>r.user_id === employee.employee_id) ? "fill-pink-500 text-pink-500" : ""} />
                                    <span>تفاعل</span>
                                </button>

                                {showPostReactions === post.id && (
                                    <div className="absolute bottom-full mb-2 right-0 bg-white shadow-2xl border border-gray-100 rounded-full p-2 flex gap-3 animate-in slide-in-from-bottom-2 z-50">
                                        {[
                                            {e: '❤️', l: 'حب'}, {e: '👏', l: 'تصفيق'}, 
                                            {e: '😊', l: 'سمايل'}, {e: '👍', l: 'تمام'}
                                        ].map(item => (
                                            <button 
                                                key={item.e} 
                                                onClick={() => handleReaction(post.id, item.e, 'post', post.created_by)}
                                                className="text-2xl hover:scale-150 transition-transform active:scale-90"
                                            >
                                                {item.e}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-1">
                                {Array.from(new Set(post.reactions?.map((r: any) => r.emoji))).map((emoji: any) => (
                                    <div key={emoji} className="bg-indigo-50 px-2 py-1 rounded-full text-[10px] font-black text-indigo-600 border border-indigo-100">
                                        {emoji} {post.reactions.filter((r: any) => r.emoji === emoji).length}
                                    </div>
                                ))}
                            </div>

                            <button onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)} className="mr-auto text-xs font-bold text-gray-400 flex items-center gap-1 hover:text-emerald-600">
                                <MessageCircle size={18} /> {post.mainComments?.length || 0} تعليق
                            </button>
                        </div>
                    </div>

                    {expandedPost === post.id && (
                        <div className="bg-gray-50/50 p-4 md:p-6 border-t border-gray-50">
                            <div className="space-y-6 max-h-[500px] overflow-y-auto custom-scrollbar px-2">
                                {post.mainComments.map((comment: any) => (
                                    <div key={comment.id} className="space-y-3">
                                        <div className="flex gap-3 items-start group">
                                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-black text-emerald-700 shrink-0">{comment.user_name[0]}</div>
                                            <div className="flex-1">
                                                <div className="bg-white p-4 rounded-3xl rounded-tr-none border border-gray-100 shadow-xs relative">
                                                    <p className="text-xs font-black text-gray-800 mb-1">{comment.user_name}</p>
                                                    <p className="text-sm text-gray-600 mb-3">{comment.comment_text}</p>
                                                    
                                                    <div className="flex items-center gap-6 border-t border-gray-50 pt-3">
                                                        <button 
                                                            onClick={() => setReplyTo({postId: post.id, commentId: comment.id, name: comment.user_name, userId: comment.user_id})} 
                                                            className="text-xs font-black text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                                                        >
                                                            رد على التعليق
                                                        </button>
                                                        
                                                        <div className="flex gap-3 pr-2 border-r border-gray-100">
                                                            {['❤️', '👍'].map(emoji => (
                                                                <button 
                                                                    key={emoji} 
                                                                    onClick={() => handleReaction(comment.id, emoji, 'comment', comment.user_id)} 
                                                                    className="text-lg hover:scale-125 transition-transform"
                                                                >
                                                                    {emoji}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                <ReactionBadges reactions={comment.reactions} />
                                            </div>
                                        </div>

                                        {comment.replies?.map((rep: any) => (
                                            <div key={rep.id} className="mr-12 flex gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-black text-gray-600 shrink-0">{rep.user_name[0]}</div>
                                                <div className="flex-1">
                                                    <div className="bg-white/80 p-3 rounded-2xl border border-gray-100 shadow-xs">
                                                        <p className="text-[10px] font-black text-gray-700 mb-1">{rep.user_name}</p>
                                                        <p className="text-xs text-gray-600">{rep.comment_text}</p>
                                                        
                                                        <div className="mt-2 pt-2 border-t border-gray-50 flex gap-2">
                                                            <button onClick={() => handleReaction(rep.id, '❤️', 'comment', rep.user_id)} className="text-xs">❤️</button>
                                                        </div>
                                                    </div>
                                                    <ReactionBadges reactions={rep.reactions} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6">
                                {replyTo && (
                                    <div className="flex justify-between items-center mb-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black">
                                        <span>جاري الرد على: {replyTo.name}</span>
                                        <button onClick={() => setReplyTo(null)} className="bg-white/20 p-1 rounded-full hover:bg-white/30 transition-colors">
                                            <X size={14}/>
                                        </button>
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <input 
                                        type="text" placeholder={replyTo ? "اكتب ردك هنا..." : "اكتب تعليقاً..."}
                                        className="flex-1 bg-white border-2 border-gray-100 rounded-full px-6 py-3 text-sm outline-none focus:border-emerald-500 transition-all"
                                        value={commentText[post.id] || ''}
                                        onChange={(e) => setCommentText({...commentText, [post.id]: e.target.value})}
                                    />
                                    <button onClick={() => handleSubmitComment(post.id)} className="bg-emerald-600 text-white p-3 rounded-full shadow-lg active:scale-95 transition-transform"><Send size={20}/></button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
