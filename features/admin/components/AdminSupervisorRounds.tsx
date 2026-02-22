import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2, MessageSquare, MapPin, User, Calendar, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminSupervisorRounds() {
    const queryClient = useQueryClient();
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');

    const { data: rounds = [], isLoading } = useQuery({
        queryKey: ['admin_supervisor_rounds'],
        queryFn: async () => {
            const { data, error } = await supabase.from('supervisor_rounds').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        }
    });

    const replyMutation = useMutation({
        mutationFn: async ({ id, supervisorId }: { id: string, supervisorId: string }) => {
            if (!replyText) throw new Error('يرجى كتابة نتيجة المرور / الرد');
            
            // 1. تحديث قاعدة البيانات
            const { error } = await supabase.from('supervisor_rounds').update({
                status: 'replied',
                admin_reply: replyText
            }).eq('id', id);

            if (error) throw error;

            // 2. إرسال إشعار للمشرف
            const notifTitle = '✅ تم الرد على تقرير مرورك';
            const notifMsg = 'المدير قام بالرد واعتماد تقرير المرور الخاص بك. تفقد السجل لمعرفة النتيجة.';
            
            await supabase.from('notifications').insert({ user_id: supervisorId, title: notifTitle, message: notifMsg, type: 'general', is_read: false });
            supabase.functions.invoke('send-push-notification', { body: { userId: supervisorId, title: notifTitle, body: notifMsg, url: '/supervisor?tab=rounds' } }).catch(() => {});
        },
        onSuccess: () => {
            toast.success('تم إرسال النتيجة للمشرف بنجاح');
            setReplyingTo(null); setReplyText('');
            queryClient.invalidateQueries({ queryKey: ['admin_supervisor_rounds'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    if (isLoading) return <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto"/></div>;

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><MapPin className="text-indigo-600"/> تقارير مرور المشرفين</h2>
            
            {rounds.length === 0 ? <div className="text-center py-20 bg-white rounded-3xl border border-dashed text-gray-400 font-bold">لا توجد تقارير مرور بعد.</div> : 
                rounds.map((round: any) => (
                    <div key={round.id} className={`bg-white rounded-3xl p-6 shadow-sm border-l-4 ${round.status === 'replied' ? 'border-l-green-500' : 'border-l-orange-500'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-black text-gray-800 flex items-center gap-2"><User size={18} className="text-indigo-500"/> المشرف: {round.supervisor_name}</h3>
                                <div className="flex gap-4 mt-2 text-xs font-bold text-gray-500">
                                    <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded"><MapPin size={12}/> {round.location}</span>
                                    <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded"><Calendar size={12}/> {round.round_date} | {round.round_time}</span>
                                </div>
                            </div>
                            {round.status === 'replied' && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1"><CheckCircle2 size={14}/> تم الرد</span>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs mt-4">
                            <div className="bg-green-50/50 p-3 rounded-xl border border-green-100"><strong className="text-green-700 block mb-1">الإيجابيات:</strong><ul className="list-disc list-inside text-gray-600">{round.positives.map((p:string,i:number)=><li key={i}>{p}</li>)}</ul></div>
                            <div className="bg-red-50/50 p-3 rounded-xl border border-red-100"><strong className="text-red-700 block mb-1">السلبيات:</strong><ul className="list-disc list-inside text-gray-600">{round.negatives.map((p:string,i:number)=><li key={i}>{p}</li>)}</ul></div>
                            <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100"><strong className="text-blue-700 block mb-1">التوصيات:</strong><ul className="list-disc list-inside text-gray-600">{round.recommendations.map((p:string,i:number)=><li key={i}>{p}</li>)}</ul></div>
                        </div>

                        {round.status === 'pending' ? (
                            replyingTo === round.id ? (
                                <div className="mt-6 bg-indigo-50 p-4 rounded-2xl border border-indigo-100 animate-in fade-in">
                                    <label className="text-sm font-black text-indigo-800 mb-2 flex items-center gap-1"><MessageSquare size={16}/> نتيجة المرور / التوجيهات للمشرف</label>
                                    <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="اكتب ردك وملاحظاتك على هذا المرور..." className="w-full p-3 rounded-xl border outline-none h-24 mb-3 resize-none text-sm"/>
                                    <div className="flex gap-2">
                                        <button onClick={() => replyMutation.mutate({id: round.id, supervisorId: round.supervisor_id})} disabled={replyMutation.isPending} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2">{replyMutation.isPending ? <Loader2 size={16} className="animate-spin"/> : 'اعتماد وإرسال الرد'}</button>
                                        <button onClick={() => {setReplyingTo(null); setReplyText('');}} className="bg-gray-200 text-gray-600 px-6 py-2 rounded-xl font-bold hover:bg-gray-300">إلغاء</button>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => setReplyingTo(round.id)} className="mt-4 w-full border-2 border-dashed border-indigo-200 text-indigo-600 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"><FileText size={18}/> تسجيل العلم بالمرور وإضافة نتيجة</button>
                            )
                        ) : (
                            <div className="mt-4 bg-gray-50 p-4 rounded-xl border">
                                <strong className="text-gray-700 text-sm mb-1 block flex items-center gap-1"><CheckCircle2 size={16} className="text-green-600"/> رد الإدارة ونتيجة المرور:</strong>
                                <p className="text-gray-600 text-sm font-bold whitespace-pre-wrap">{round.admin_reply}</p>
                            </div>
                        )}
                    </div>
                ))
            }
        </div>
    );
}
