import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import toast from 'react-hot-toast';
import { 
    Pin, MessageCircle, Send, Clock, Heart, 
    Reply, X, Calendar, Sparkles, Loader2
} from 'lucide-react';
// 1. ✅ استيراد React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function StaffNewsFeed({ employee }: { employee: Employee }) {
    const queryClient = useQueryClient();
    
    // UI State (حالات الواجهة فقط)
    const [commentText, setCommentText] = useState<{ [key: string]: string }>({});
    const [replyTo, setReplyTo] = useState<{postId: string, commentId: string, name: string, userId: string} | null>(null);
    const [expandedPost, setExpandedPost] = useState<string | null>(null);
    const [showPostReactions, setShowPostReactions] = useState<string | null>(null);
    const [showCommentReactions, setShowCommentReactions] = useState<string | null>(null);

    const REACTION_OPTIONS = [
        { e: '❤️', l: 'حب' },
        { e: '😊', l: 'سمايل' },
        { e: '😂', l: 'ضحك' },
        { e: '👏', l: 'تصفيق' },
        { e: '👍', l: 'تمام' }
    ];

    // ------------------------------------------------------------------
    // 1. 📥 جلب البيانات (Query)
    // ------------------------------------------------------------------
    const { data: posts = [], isLoading } = useQuery({
        queryKey: ['news_feed'],
        queryFn: async () => {
            // جلب كل البيانات بالتوازي لسرعة أكبر
            const [postsRes, commentsRes, pReactRes, cReactRes] = await Promise.all([
                supabase.from('news_posts').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
                supabase.from('news_comments').select('*').order('created_at', { ascending: true }),
                supabase.from('post_reactions').select('*'),
                supabase.from('comment_reactions').select('*')
            ]);

            if (postsRes.error) throw postsRes.error;

            const postsData = postsRes.data || [];
            const commentsData = commentsRes.data || [];
            const pReactions = pReactRes.data || [];
            const cReactions = cReactRes.data || [];

            // معالجة ودمج البيانات
            return postsData.map(p => {
                const postComments = commentsData.filter(c => c.post_id === p.id);
                return {
                    ...p,
                    reactions: pReactions.filter(r => r.post_id === p.id),
                    mainComments: postComments.filter(c => !c.parent_id).map(mc => ({
                        ...mc,
                        reactions: cReactions.filter(r => r.comment_id === mc.id),
                        replies: postComments.filter(r => r.parent_id === mc.id).map(rep => ({
                            ...rep,
                            reactions: cReactions.filter(r => r.comment_id === rep.id)
                        }))
                    }))
                };
            });
        },
        staleTime: 1000 * 60 * 1, // تحديث كل دقيقة تلقائياً
    });

    // ------------------------------------------------------------------
    // 2. 🛠️ العمليات (Mutations)
    // ------------------------------------------------------------------

    // أ) إرسال إشعار (دالة مساعدة)
    const sendNotification = async (recipientId: string, type: string, postId: string, message: string) => {
        if (recipientId === employee.employee_id) return;
        await supabase.from('notifications').insert({
            recipient_id: recipientId, sender_id: employee.employee_id,
            sender_name: employee.name, type, post_id: postId, message
        });
    };

    // ب) إضافة/حذف تفاعل
    const reactionMutation = useMutation({
        mutationFn: async ({ id, emoji, type, targetUserId }: { id: string, emoji: string, type: 'post' | 'comment', targetUserId: string }) => {
            const table = type === 'post' ? 'post_reactions' : 'comment_reactions';
            const field = type === 'post' ? 'post_id' : 'comment_id';
            
            // التحقق هل التفاعل موجود
            const { data: existing } = await supabase.from(table)
                .select('id')
                .eq(field, id)
                .eq('user_id', employee.employee_id)
                .eq('emoji', emoji)
                .maybeSingle();

            if (existing) {
                await supabase.from(table).delete().eq('id', existing.id);
                return { action: 'removed', emoji };
            } else {
                await supabase.from(table).insert({ [field]: id, user_id: employee.employee_id, user_name: employee.name, emoji });
                // إرسال إشعار فقط عند الإضافة
                sendNotification(targetUserId, 'reaction', id, `تفاعل ${employee.name} بـ ${emoji} على ${type === 'post' ? 'منشورك' : 'تعليقك'}`);
                return { action: 'added', emoji };
            }
        },
        onSuccess: (data) => {
            // تحديث البيانات فوراً
            queryClient.invalidateQueries({ queryKey: ['news_feed'] });
            if (data.action === 'added') toast.success(`تم التفاعل ${data.emoji}`, { duration: 1000 });
            else toast('تم إزالة التفاعل', { icon: '↩️', duration: 1000 });
            
            setShowPostReactions(null);
            setShowCommentReactions(null);
        },
        onError: () => toast.error('حدث خطأ في التفاعل')
    });

    // ج) إضافة تعليق
    const commentMutation = useMutation({
        mutationFn: async ({ postId, text }: { postId: string, text: string }) => {
            const payload: any = { 
                post_id: postId, 
                user_id: employee.employee_id, 
                user_name: employee.name, 
                comment_text: text 
            };
            if (replyTo && replyTo.postId === postId) payload.parent_id = replyTo.commentId;
            
            const { error } = await supabase.from('news_comments').insert(payload);
            if (error) throw error;
            return { postId };
        },
        onSuccess: (data) => {
            toast.success('تم النشر بنجاح!');
            if (replyTo) sendNotification(replyTo.userId, 'reply', data.postId, `ردَّ ${employee.name} على تعليقك`);
            
            // تنظيف الحقول وتحديث البيانات
            setCommentText(prev => ({ ...prev, [data.postId]: '' }));
            setReplyTo(null);
            queryClient.invalidateQueries({ queryKey: ['news_feed'] });
        },
        onError: () => toast.error('فشل نشر التعليق')
    });

    // ------------------------------------------------------------------
    // 3. 🎨 واجهة المستخدم
    // ------------------------------------------------------------------

    const formatDateTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return {
            date: date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }),
            time: date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        };
    };

    const handleCommentSubmit = (postId: string) => {
        const text = commentText[postId]?.trim();
        if (!text) return toast.error('اكتب تعليقاً أولاً!');
        
        toast.promise(commentMutation.mutateAsync({ postId, text }), {
            loading: 'جاري النشر...',
            success: 'تم النشر!',
            error: 'خطأ'
        });
    };

    if (isLoading) return <div className="p-10 text-center text-gray-400 font-black animate-pulse px-4 flex flex-col items-center gap-2"><Loader2 className="animate-spin w-8 h-8 text-emerald-500"/> جاري تحميل الأخبار...</div>;

    return (
        <div className="max-w-4xl mx-auto pb-20 text-right space-y-6 px-2" dir="rtl">
            
            {/* قسم الترحيب */}
            <div className="sticky top-4 z-40 bg-white/90 backdrop-blur-xl border border-emerald-100 rounded-3xl p-4 shadow-sm flex items-center justify-between overflow-hidden">
                <div className="absolute -left-4 -top-4 w-20 h-20 bg-emerald-50 rounded-full blur-2xl opacity-60"></div>
                <div className="relative flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-sm shadow-emerald-200">
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-gray-800">أهلاً بك، {employee.name.split(' ')[0]}</h2>
                        <p className="text-[10px] text-emerald-600 font-bold">نتمنى لك يوماً سعيداً في المركز</p>
                    </div>
                </div>
                <div className="hidden sm:block text-left">
                    <p className="text-[9px] text-gray-400 font-black uppercase tracking-wider">التاريخ اليوم</p>
                    <p className="text-xs font-black text-gray-700">{formatDateTime(new Date().toISOString()).date}</p>
                </div>
            </div>

            <div className="space-y-6">
                {posts.map((post: any) => {
                    const postTime = formatDateTime(post.created_at);
                    return (
                        <div key={post.id} className={`bg-white rounded-3xl border transition-all duration-300 ${post.is_pinned ? 'border-emerald-200 ring-2 ring-emerald-50' : 'border-gray-100 shadow-sm'}`}>
                            {post.image_url && (
                                <div className="w-full h-56 overflow-hidden bg-gray-100 relative rounded-t-3xl">
                                    <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                                </div>
                            )}

                            <div className="p-4 md:p-5">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2 text-gray-400 text-[10px] font-bold">
                                        <Calendar size={12} />
                                        <span>{postTime.date}</span>
                                        <span className="mx-1">•</span>
                                        <Clock size={12} />
                                        <span>{postTime.time}</span>
                                    </div>
                                    {post.is_pinned && <Pin size={16} className="text-emerald-500 fill-emerald-500" />}
                                </div>
                                <h3 className="text-lg font-black text-gray-800 mb-2">{post.title}</h3>
                                <p className="text-xs text-gray-600 leading-relaxed mb-6 whitespace-pre-wrap">{post.content}</p>
                                
                                <div className="flex items-center gap-3 border-t border-gray-50 pt-4 relative">
                                    <div className="relative">
                                        <button 
                                            onClick={() => setShowPostReactions(showPostReactions === post.id ? null : post.id)}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 rounded-xl hover:bg-pink-50 text-gray-700 font-bold text-xs transition-all"
                                        >
                                            <Heart size={14} className={post.reactions?.some((r:any)=>r.user_id === employee.employee_id) ? "fill-pink-500 text-pink-500" : ""} />
                                            <span>تفاعل</span>
                                        </button>
                                        {showPostReactions === post.id && (
                                            <div className="absolute bottom-full mb-2 right-0 bg-white shadow-xl border border-gray-100 rounded-full p-1.5 flex gap-2 animate-in fade-in slide-in-from-bottom-2 z-50">
                                                {REACTION_OPTIONS.map(item => (
                                                    <button key={item.e} onClick={() => reactionMutation.mutate({ id: post.id, emoji: item.e, type: 'post', targetUserId: post.created_by })} className="text-lg hover:scale-125 transition-transform active:scale-90">{item.e}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex -space-x-1 space-x-reverse">
                                        {Array.from(new Set(post.reactions?.map((r: any) => r.emoji))).map((emoji: any) => (
                                            <div key={emoji} className="bg-white px-1.5 py-0.5 rounded-full text-[10px] font-black border border-gray-100 shadow-sm">
                                                {emoji} <span className="text-indigo-600 text-[9px]">{post.reactions.filter((r: any) => r.emoji === emoji).length}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)} className="mr-auto text-xs font-bold text-gray-400 flex items-center gap-1.5 hover:text-emerald-600 transition-colors">
                                        <MessageCircle size={16} />
                                        <span>{post.mainComments?.length || 0} تعليق</span>
                                    </button>
                                </div>
                            </div>

                            {/* قسم التعليقات */}
                            {expandedPost === post.id && (
                                <div className="bg-gray-50/50 p-4 border-t border-gray-50 rounded-b-3xl animate-in slide-in-from-top-2">
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pl-1">
                                        {post.mainComments.map((comment: any) => {
                                            const commentTime = formatDateTime(comment.created_at);
                                            return (
                                                <div key={comment.id} className="space-y-2">
                                                    <div className="flex gap-3 items-start group">
                                                        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-xs font-black text-emerald-700 shrink-0 shadow-sm">
                                                            {comment.user_name[0]}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="bg-white p-3 rounded-2xl rounded-tr-none border border-gray-100 shadow-sm relative">
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="font-bold text-xs text-gray-800">{comment.user_name}</span>
                                                                    <span className="text-[8px] text-gray-400 font-bold flex items-center gap-1"><Clock size={9}/> {commentTime.time}</span>
                                                                </div>
                                                                <p className="text-xs text-gray-600 leading-relaxed mb-2">{comment.comment_text}</p>
                                                                
                                                                <div className="flex items-center gap-4 pt-2 border-t border-gray-50">
                                                                    <button 
                                                                        onClick={() => setReplyTo({postId: post.id, commentId: comment.id, name: comment.user_name, userId: comment.user_id})} 
                                                                        className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                                                    >
                                                                        <Reply size={12}/> رد
                                                                    </button>
                                                                    <div className="relative">
                                                                        <button 
                                                                            onClick={() => setShowCommentReactions(showCommentReactions === comment.id ? null : comment.id)}
                                                                            className="text-[10px] font-black text-gray-400 hover:text-pink-600 flex items-center gap-1"
                                                                        >
                                                                            <Heart size={12} className={comment.reactions?.some((r:any)=>r.user_id === employee.employee_id) ? "fill-pink-500 text-pink-500" : ""} /> تفاعل
                                                                        </button>
                                                                        {showCommentReactions === comment.id && (
                                                                            <div className="absolute bottom-full mb-1 right-0 bg-white shadow-lg border border-gray-100 rounded-full p-1.5 flex gap-2 z-50">
                                                                                {REACTION_OPTIONS.map(item => (
                                                                                    <button key={item.e} onClick={() => reactionMutation.mutate({ id: comment.id, emoji: item.e, type: 'comment', targetUserId: comment.user_id })} className="text-sm hover:scale-125 transition-transform">{item.e}</button>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="mt-1 flex flex-wrap gap-1 pr-2">
                                                                {comment.reactions?.map((r: any, idx: number) => (
                                                                    <span key={idx} className="bg-white border border-gray-100 px-1.5 py-0.5 rounded-full text-[9px] shadow-xs">{r.emoji}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {comment.replies?.map((rep: any) => {
                                                        const repTime = formatDateTime(rep.created_at);
                                                        return (
                                                            <div key={rep.id} className="mr-11 flex gap-3">
                                                                <div className="w-6 h-6 rounded-lg bg-gray-200 flex items-center justify-center text-[9px] font-black text-gray-600 shrink-0">{rep.user_name[0]}</div>
                                                                <div className="flex-1">
                                                                    <div className="bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100/50">
                                                                        <div className="flex justify-between items-center mb-0.5">
                                                                            <span className="text-[10px] font-black text-gray-700">{rep.user_name}</span>
                                                                            <span className="text-[8px] text-gray-400">{repTime.time}</span>
                                                                        </div>
                                                                        <p className="text-[10px] text-gray-600 leading-relaxed">{rep.comment_text}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-4 relative">
                                        {replyTo && (
                                            <div className="absolute -top-10 right-2 left-2 flex justify-between items-center bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black animate-in slide-in-from-bottom-2 shadow-md">
                                                <span>رد على: {replyTo.name}</span>
                                                <button onClick={() => setReplyTo(null)} className="p-0.5 hover:bg-white/20 rounded"><X size={12}/></button>
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" placeholder={replyTo ? "اكتب ردك هنا..." : "اكتب تعليقاً..."}
                                                className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs outline-none focus:border-emerald-500 transition-all shadow-sm focus:ring-1 focus:ring-emerald-100"
                                                value={commentText[post.id] || ''}
                                                onChange={(e) => setCommentText({...commentText, [post.id]: e.target.value})}
                                            />
                                            <button onClick={() => handleCommentSubmit(post.id)} disabled={commentMutation.isPending} className="bg-emerald-600 text-white p-3 rounded-xl shadow-md shadow-emerald-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                                                {commentMutation.isPending ? <Loader2 className="animate-spin w-4 h-4"/> : <Send size={16}/>}
                                            </button>
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
