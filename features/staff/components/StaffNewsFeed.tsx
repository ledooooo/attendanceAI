import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import toast from 'react-hot-toast';
import { 
    Pin, MessageCircle, Send, Clock, Heart, 
    Reply, Calendar, Sparkles, Loader2, Star, Trophy, X, BrainCircuit 
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ✅ استيراد كارت المسابقة والتحدي الذكي
import CompetitionCard from './CompetitionCard';
import AIGameChallenge from '../../gamification/AIGameChallenge'; // <-- تم إضافة هذا الاستيراد

export default function StaffNewsFeed({ employee }: { employee: Employee }) {
    const queryClient = useQueryClient();
    
    // UI State
    const [commentText, setCommentText] = useState<{ [key: string]: string }>({});
    const [replyTo, setReplyTo] = useState<{postId: string, commentId: string, name: string, userId: string} | null>(null);
    const [expandedPost, setExpandedPost] = useState<string | null>(null);
    const [showPostReactions, setShowPostReactions] = useState<string | null>(null);
    const [showCommentReactions, setShowCommentReactions] = useState<string | null>(null);
    
    // ✅ حالة التحكم في فتح نافذة لعبة الذكاء الاصطناعي
    const [showAIGame, setShowAIGame] = useState(false);

    const REACTION_OPTIONS = [
        { e: '❤️', l: 'حب' }, { e: '😊', l: 'سمايل' }, { e: '😂', l: 'ضحك' }, { e: '👏', l: 'تصفيق' }, { e: '👍', l: 'تمام' }
    ];

    // حساب المستوى الحالي
    const points = employee.total_points || 0;
    const levels = [
        { name: 'مبتدئ', min: 0, max: 100, color: 'text-gray-500' },
        { name: 'برونزي', min: 100, max: 500, color: 'text-orange-700' },
        { name: 'فضي', min: 500, max: 1500, color: 'text-gray-400' },
        { name: 'ذهبي', min: 1500, max: 3000, color: 'text-yellow-500' },
        { name: 'ماسي', min: 3000, max: 10000, color: 'text-blue-500' },
    ];
    const currentLevel = levels.find(l => points >= l.min && points < l.max) || levels[levels.length - 1];

    // ------------------------------------------------------------------
    // 1. 📥 جلب البيانات (أخبار + مسابقات)
    // ------------------------------------------------------------------
    const { data: feedItems = [], isLoading } = useQuery({
        queryKey: ['news_feed_mixed'],
        queryFn: async () => {
            // أ) جلب الأخبار والتعليقات
            const [postsRes, commentsRes, pReactRes, cReactRes] = await Promise.all([
                supabase.from('news_posts').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
                supabase.from('news_comments').select('*').order('created_at', { ascending: true }),
                supabase.from('post_reactions').select('*'),
                supabase.from('comment_reactions').select('*')
            ]);

            // ب) جلب المسابقات (مع بيانات اللاعبين)
            const { data: compsData } = await supabase
                .from('competitions')
                .select('*') 
                .order('created_at', { ascending: false });

            if (postsRes.error) throw postsRes.error;

            // ج) معالجة الأخبار
            const postsData = postsRes.data || [];
            const commentsData = commentsRes.data || [];
            const pReactions = pReactRes.data || [];
            const cReactions = cReactRes.data || [];

            const processedPosts = postsData.map(p => {
                const postComments = commentsData.filter(c => c.post_id === p.id);
                return {
                    ...p,
                    // ✅ إذا كان الخبر محدد كـ ai_challenge في الداتابيز، نحتفظ بنوعه لنميزه في العرض
                    type: p.type === 'ai_challenge' ? 'ai_challenge' : 'post', 
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

            // د) معالجة المسابقات
            const processedComps = (compsData || []).map(c => ({
                ...c,
                type: 'competition'
            }));

            // هـ) دمج القائمتين وترتيبهم حسب التاريخ
            const combinedFeed = [...processedPosts, ...processedComps].sort((a, b) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            
            // وضع "المثبت" في الأول دائماً
            return combinedFeed.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
        },
        staleTime: 1000 * 30,
        refetchInterval: 10000, 
    });

    // ------------------------------------------------------------------
    // 2. 🛠️ العمليات (Mutations للأخبار)
    // ------------------------------------------------------------------

    const sendInstantNotification = async (recipientEmpId: string, title: string, body: string, type: string) => {
        if (recipientEmpId === String(employee.employee_id)) return;

        await supabase.from('notifications').insert({
            user_id: recipientEmpId, 
            title: title,
            message: body,
            type: type,
            is_read: false
        });

        supabase.functions.invoke('send-push-notification', {
            body: { 
                userId: recipientEmpId, 
                title: title, 
                body: body, 
                url: '/staff?tab=news' 
            }
        }).catch(err => console.error("Push Error in News Feed:", err));
    };

    const reactionMutation = useMutation({
        mutationFn: async ({ id, emoji, type, targetUserId }: { id: string, emoji: string, type: 'post' | 'comment', targetUserId: string }) => {
            const table = type === 'post' ? 'post_reactions' : 'comment_reactions';
            const field = type === 'post' ? 'post_id' : 'comment_id';
            
            const { data: existing } = await supabase.from(table).select('id').eq(field, id).eq('user_id', employee.employee_id).eq('emoji', emoji).maybeSingle();

            if (existing) {
                await supabase.from(table).delete().eq('id', existing.id);
                return { action: 'removed', emoji };
            } else {
                await supabase.from(table).insert({ [field]: id, user_id: employee.employee_id, user_name: employee.name, emoji });
                
                const msgBody = `تفاعل ${employee.name} بـ ${emoji} على ${type === 'post' ? 'منشورك' : 'تعليقك'}`;
                sendInstantNotification(String(targetUserId), '❤️ تفاعل جديد', msgBody, 'reaction');
                
                return { action: 'added', emoji };
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['news_feed_mixed'] });
            setShowPostReactions(null);
            setShowCommentReactions(null);
        },
        onError: () => toast.error('حدث خطأ في التفاعل')
    });

    const commentMutation = useMutation({
        mutationFn: async ({ postId, text, postAuthorId }: { postId: string, text: string, postAuthorId: string }) => {
            const payload: any = { 
                post_id: postId, 
                user_id: employee.employee_id, 
                user_name: employee.name, 
                comment_text: text 
            };
            if (replyTo && replyTo.postId === postId) payload.parent_id = replyTo.commentId;
            
            const { error } = await supabase.from('news_comments').insert(payload);
            if (error) throw error;

            if (replyTo) {
                const msg = `ردَّ ${employee.name} على تعليقك: "${text.substring(0, 20)}..."`;
                sendInstantNotification(String(replyTo.userId), '💬 رد جديد', msg, 'reply');
            } else {
                const msg = `علّق ${employee.name} على منشورك: "${text.substring(0, 20)}..."`;
                sendInstantNotification(String(postAuthorId), '💬 تعليق جديد', msg, 'comment');
            }

            return { postId };
        },
        onSuccess: (data) => {
            toast.success('تم النشر بنجاح!');
            setCommentText(prev => ({ ...prev, [data.postId]: '' }));
            setReplyTo(null);
            queryClient.invalidateQueries({ queryKey: ['news_feed_mixed'] });
        },
        onError: () => toast.error('فشل نشر التعليق')
    });

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
        
        toast.promise(commentMutation.mutateAsync({ postId, text, postAuthorId: feedItems.find(i=>i.id===postId)?.created_by }), {
            loading: 'جاري النشر...',
            success: 'تم النشر!',
            error: 'خطأ'
        });
    };

    if (isLoading) return <div className="p-10 text-center text-gray-400 font-black animate-pulse px-4 flex flex-col items-center gap-2"><Loader2 className="animate-spin w-8 h-8 text-emerald-500"/> جاري تحميل الأحداث...</div>;

    return (
        <div className="max-w-4xl mx-auto pb-20 text-right space-y-4 px-1" dir="rtl">
            
            {/* قسم الترحيب (تم حذفه من هنا لأنه أصبح في الـ Dashboard الأساسي كما طلبت سابقاً، لكن سنبقي الكروت المصغرة) */}

            {/* الكروت المصغرة (Level & Leaderboard) */}
            <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-white border border-indigo-100 rounded-2xl p-2 flex items-center gap-2 shadow-sm h-14 overflow-hidden relative">
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                        <Star size={16} fill="currentColor" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[9px] text-gray-400 font-bold">المستوى الحالي</div>
                        <div className={`text-xs font-black truncate ${currentLevel.color}`}>{currentLevel.name} <span className="text-[9px] text-gray-400">({points})</span></div>
                    </div>
                </div>

                <div className="bg-white border border-yellow-100 rounded-2xl p-2 flex items-center gap-2 shadow-sm h-14 overflow-hidden relative">
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-yellow-400"></div>
                    <div className="w-8 h-8 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600 shrink-0">
                        <Trophy size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[9px] text-gray-400 font-bold">لوحة الشرف</div>
                        <div className="text-xs font-black text-gray-800 truncate">أفضل 5 نجوم</div>
                    </div>
                </div>
            </div>

            {/* 🔥 الـ Feed المدمج (مسابقات + أخبار + تحدي AI) 🔥 */}
            <div className="space-y-4">
                {feedItems.map((item: any) => {
                    
                    // --- 1. الحالة الأولى: عرض كارت المسابقة الجماعية ---
                    if (item.type === 'competition') {
                        return (
                            <CompetitionCard 
                                key={item.id} 
                                comp={item} 
                                currentUserId={employee.id} 
                            />
                        );
                    }

                    // --- 2. ✅ الحالة الثانية: عرض كارت تحدي الذكاء الاصطناعي ✅ ---
                    if (item.type === 'ai_challenge') {
                        const postTime = formatDateTime(item.created_at);
                        return (
                            <div key={item.id} className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl border border-indigo-500/30 text-white relative overflow-hidden shadow-2xl transition-transform hover:-translate-y-1">
                                {/* تأثيرات بصرية */}
                                <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl mix-blend-screen"></div>
                                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl mix-blend-screen"></div>
                                
                                <div className="p-6 relative z-10 text-center">
                                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(168,85,247,0.4)] rotate-3 hover:rotate-0 transition-transform">
                                        <BrainCircuit size={32} className="text-white animate-pulse" />
                                    </div>
                                    <div className="flex justify-center items-center gap-2 text-gray-400 text-[10px] font-bold mb-3">
                                        <Calendar size={12} /><span>{postTime.date}</span>
                                        <span className="mx-1">•</span>
                                        <Clock size={12} /><span>{postTime.time}</span>
                                    </div>
                                    <h3 className="font-black text-2xl mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                                        {item.title || 'تحدي الذكاء الاصطناعي اليومي 🤖'}
                                    </h3>
                                    <p className="text-sm text-slate-300 leading-relaxed mb-6 px-4">
                                        {item.content || 'اختر مستوى الصعوبة، وحدد مجال التحدي، واربح حتى 50 نقطة فورية! هل أنت مستعد لاختبار معلوماتك أمام الـ AI؟'}
                                    </p>
                                    <button 
                                        onClick={() => setShowAIGame(true)}
                                        className="bg-white text-indigo-900 px-8 py-3.5 rounded-xl font-black shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all active:scale-95 hover:bg-gray-100 flex items-center justify-center gap-2 mx-auto w-full md:w-auto"
                                    >
                                        <Zap size={18} className="text-yellow-500 fill-yellow-500" />
                                        ابدأ التحدي الآن
                                    </button>
                                </div>
                            </div>
                        );
                    }

                    // --- 3. الحالة الثالثة: عرض كارت الخبر العادي ---
                    const postTime = formatDateTime(item.created_at);
                    return (
                        <div key={item.id} className={`bg-white rounded-3xl border transition-all duration-300 ${item.is_pinned ? 'border-emerald-200 ring-2 ring-emerald-50' : 'border-gray-100 shadow-sm'}`}>
                            {item.image_url && (
                                <div className="w-full h-48 overflow-hidden bg-gray-100 relative rounded-t-3xl">
                                    <img src={item.image_url} alt="" className="w-full h-full object-cover" />
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
                                    {item.is_pinned && <Pin size={16} className="text-emerald-500 fill-emerald-500" />}
                                </div>
                                <h3 className="text-base font-black text-gray-800 mb-1">{item.title}</h3>
                                <p className="text-xs text-gray-600 leading-relaxed mb-4 whitespace-pre-wrap">{item.content}</p>
                                
                                <div className="flex items-center gap-3 border-t border-gray-50 pt-3 relative">
                                    <div className="relative">
                                        <button 
                                            onClick={() => setShowPostReactions(showPostReactions === item.id ? null : item.id)}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 rounded-xl hover:bg-pink-50 text-gray-700 font-bold text-xs transition-all"
                                        >
                                            <Heart size={14} className={item.reactions?.some((r:any)=>r.user_id === employee.employee_id) ? "fill-pink-500 text-pink-500" : ""} />
                                            <span>تفاعل</span>
                                        </button>
                                        {showPostReactions === item.id && (
                                            <div className="absolute bottom-full mb-2 right-0 bg-white shadow-xl border border-gray-100 rounded-full p-1.5 flex gap-2 animate-in fade-in slide-in-from-bottom-2 z-50">
                                                {REACTION_OPTIONS.map(opt => (
                                                    <button key={opt.e} onClick={() => reactionMutation.mutate({ id: item.id, emoji: opt.e, type: 'post', targetUserId: item.created_by })} className="text-lg hover:scale-125 transition-transform active:scale-90">{opt.e}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex -space-x-1 space-x-reverse">
                                        {Array.from(new Set(item.reactions?.map((r: any) => r.emoji))).map((emoji: any) => (
                                            <div key={emoji} className="bg-white px-1.5 py-0.5 rounded-full text-[10px] font-black border border-gray-100 shadow-sm">
                                                {emoji} <span className="text-indigo-600 text-[9px]">{item.reactions.filter((r: any) => r.emoji === emoji).length}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => setExpandedPost(expandedPost === item.id ? null : item.id)} className="mr-auto text-xs font-bold text-gray-400 flex items-center gap-1.5 hover:text-emerald-600 transition-colors">
                                        <MessageCircle size={16} />
                                        <span>{item.mainComments?.length || 0} تعليق</span>
                                    </button>
                                </div>
                            </div>

                            {/* قسم التعليقات */}
                            {expandedPost === item.id && (
                                <div className="bg-gray-50/50 p-4 border-t border-gray-50 rounded-b-3xl animate-in slide-in-from-top-2">
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pl-1">
                                        {item.mainComments.map((comment: any) => {
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
                                                                    <button onClick={() => setReplyTo({postId: item.id, commentId: comment.id, name: comment.user_name, userId: comment.user_id})} className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                                                        <Reply size={12}/> رد
                                                                    </button>
                                                                    <div className="relative">
                                                                        <button onClick={() => setShowCommentReactions(showCommentReactions === comment.id ? null : comment.id)} className="text-[10px] font-black text-gray-400 hover:text-pink-600 flex items-center gap-1">
                                                                            <Heart size={12} className={comment.reactions?.some((r:any)=>r.user_id === employee.employee_id) ? "fill-pink-500 text-pink-500" : ""} /> تفاعل
                                                                        </button>
                                                                        {showCommentReactions === comment.id && (
                                                                            <div className="absolute bottom-full mb-1 right-0 bg-white shadow-lg border border-gray-100 rounded-full p-1.5 flex gap-2 z-50">
                                                                                {REACTION_OPTIONS.map(opt => (
                                                                                    <button key={opt.e} onClick={() => reactionMutation.mutate({ id: comment.id, emoji: opt.e, type: 'comment', targetUserId: comment.user_id })} className="text-sm hover:scale-125 transition-transform">{opt.e}</button>
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
                                                value={commentText[item.id] || ''}
                                                onChange={(e) => setCommentText({...commentText, [item.id]: e.target.value})}
                                            />
                                            <button onClick={() => handleCommentSubmit(item.id)} disabled={commentMutation.isPending} className="bg-emerald-600 text-white p-3 rounded-xl shadow-md shadow-emerald-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
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

            {/* ✅ عرض نافذة لعبة الذكاء الاصطناعي عند النقر */}
            {showAIGame && (
                <AIGameChallenge employee={employee} onClose={() => setShowAIGame(false)} />
            )}

        </div>
    );
}
