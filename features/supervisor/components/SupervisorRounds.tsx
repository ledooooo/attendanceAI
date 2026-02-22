import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { Plus, Trash2, Send, MapPin, Clock, Calendar, CheckCircle2, FileText, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SupervisorRounds() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');

    // بيانات النموذج
    const [location, setLocation] = useState('');
    const [roundDate, setRoundDate] = useState(new Date().toISOString().split('T')[0]);
    const [roundTime, setRoundTime] = useState(new Date().toLocaleTimeString('en-GB', { hour12: false }).slice(0, 5));
    
    // القوائم الديناميكية
    const [positives, setPositives] = useState<string[]>(['']);
    const [negatives, setNegatives] = useState<string[]>(['']);
    const [recommendations, setRecommendations] = useState<string[]>(['']);

    // دالة مساعدة لإدارة القوائم
    const handleListChange = (setter: any, list: string[], index: number, value: string) => {
        const newList = [...list];
        newList[index] = value;
        setter(newList);
    };
    const addListItem = (setter: any, list: string[]) => setter([...list, '']);
    const removeListItem = (setter: any, list: string[], index: number) => {
        if (list.length > 1) setter(list.filter((_, i) => i !== index));
    };

    // جلب سجل المرور
    const { data: history = [], isLoading } = useQuery({
        queryKey: ['supervisor_rounds', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase.from('supervisor_rounds').select('*').eq('supervisor_id', user?.id).order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!user?.id
    });

    // إرسال التقرير
    const submitRoundMutation = useMutation({
        mutationFn: async () => {
            if (!location) throw new Error('يرجى تحديد مكان المرور');
            
            // تنظيف القوائم من الخانات الفارغة
            const cleanPositives = positives.filter(p => p.trim() !== '');
            const cleanNegatives = negatives.filter(n => n.trim() !== '');
            const cleanRecs = recommendations.filter(r => r.trim() !== '');

            // 1. جلب اسم المشرف
            const { data: sup } = await supabase.from('supervisors').select('name').eq('id', user?.id).single();

            // 2. الحفظ في الداتابيز
            const { error } = await supabase.from('supervisor_rounds').insert({
                supervisor_id: user?.id,
                supervisor_name: sup?.name || 'مشرف',
                round_date: roundDate,
                round_time: roundTime,
                location,
                positives: cleanPositives,
                negatives: cleanNegatives,
                recommendations: cleanRecs,
                status: 'pending'
            });

            if (error) throw error;

            // 3. إرسال إشعار للمدير
            const notifTitle = '👀 تقرير مرور جديد';
            const notifMsg = `قام المشرف ${sup?.name} بتسجيل مرور على: ${location}`;
            
            await supabase.from('notifications').insert({ user_id: 'admin', title: notifTitle, message: notifMsg, type: 'general', is_read: false });
            supabase.functions.invoke('send-push-notification', { body: { userId: 'admin', title: notifTitle, body: notifMsg, url: '/admin?tab=supervisor-rounds' } }).catch(() => {});
        },
        onSuccess: () => {
            toast.success('تم إرسال تقرير المرور بنجاح ✅');
            setLocation(''); setPositives(['']); setNegatives(['']); setRecommendations(['']);
            setActiveTab('history');
            queryClient.invalidateQueries({ queryKey: ['supervisor_rounds'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    // مكون مساعد لرسم القوائم
    const ListInput = ({ title, items, setter, color }: any) => (
        <div className={`p-4 rounded-2xl border ${color.bg} ${color.border}`}>
            <h4 className={`font-black text-sm mb-3 flex items-center justify-between ${color.text}`}>
                {title}
                <button onClick={() => addListItem(setter, items)} className="p-1 bg-white rounded-lg shadow-sm hover:scale-105"><Plus size={16}/></button>
            </h4>
            <div className="space-y-2">
                {items.map((item: string, idx: number) => (
                    <div key={idx} className="flex gap-2">
                        <input type="text" value={item} onChange={(e) => handleListChange(setter, items, idx, e.target.value)} placeholder={`اكتب النقطة ${idx + 1}...`} className="flex-1 p-2 text-sm rounded-xl border outline-none focus:ring-2 bg-white" />
                        {items.length > 1 && <button onClick={() => removeListItem(setter, items, idx)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl"><Trash2 size={16}/></button>}
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            <div className="flex bg-white p-1 rounded-2xl shadow-sm w-fit border">
                <button onClick={() => setActiveTab('new')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'new' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>تسجيل مرور جديد</button>
                <button onClick={() => setActiveTab('history')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>سجل المرور</button>
            </div>

            {activeTab === 'new' && (
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-6">
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><MapPin size={14}/> مكان المرور (القسم/الوحدة)</label>
                            <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="مثال: قسم الطوارئ" className="w-full p-3 bg-gray-50 border rounded-xl outline-none font-bold"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Calendar size={14}/> التاريخ</label>
                            <input type="date" value={roundDate} onChange={e => setRoundDate(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-xl outline-none"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Clock size={14}/> التوقيت</label>
                            <input type="time" value={roundTime} onChange={e => setRoundTime(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-xl outline-none"/>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <ListInput title="✅ الإيجابيات" items={positives} setter={setPositives} color={{bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-700'}} />
                        <ListInput title="❌ السلبيات / الملاحظات" items={negatives} setter={setNegatives} color={{bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-700'}} />
                        <ListInput title="💡 التوصيات" items={recommendations} setter={setRecommendations} color={{bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700'}} />
                    </div>

                    <button onClick={() => submitRoundMutation.mutate()} disabled={submitRoundMutation.isPending} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex justify-center items-center gap-2">
                        {submitRoundMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin"/> : <><Send size={20} className="rtl:rotate-180"/> حفظ وإرسال للمدير</>}
                    </button>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="space-y-4">
                    {isLoading ? <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 my-10"/> : history.length === 0 ? <p className="text-center text-gray-400 font-bold py-10">لا يوجد سجل مرور بعد.</p> :
                        history.map((round: any) => (
                            <div key={round.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
                                <div className="flex justify-between items-start border-b pb-3">
                                    <div>
                                        <h3 className="font-black text-gray-800 flex items-center gap-2"><MapPin className="text-indigo-500 w-5 h-5"/> {round.location}</h3>
                                        <p className="text-xs text-gray-500 font-bold mt-1">{round.round_date} - {round.round_time}</p>
                                    </div>
                                    <span className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1 ${round.status === 'replied' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {round.status === 'replied' ? <CheckCircle2 size={14}/> : <Clock size={14}/>} {round.status === 'replied' ? 'تم الرد' : 'قيد المراجعة'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                    <div className="bg-green-50 p-3 rounded-xl border border-green-100"><strong className="text-green-700 block mb-1">الإيجابيات:</strong><ul className="list-disc list-inside px-2 text-gray-600 space-y-1">{round.positives.map((p:string,i:number)=><li key={i}>{p}</li>)}</ul></div>
                                    <div className="bg-red-50 p-3 rounded-xl border border-red-100"><strong className="text-red-700 block mb-1">السلبيات:</strong><ul className="list-disc list-inside px-2 text-gray-600 space-y-1">{round.negatives.map((p:string,i:number)=><li key={i}>{p}</li>)}</ul></div>
                                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100"><strong className="text-blue-700 block mb-1">التوصيات:</strong><ul className="list-disc list-inside px-2 text-gray-600 space-y-1">{round.recommendations.map((p:string,i:number)=><li key={i}>{p}</li>)}</ul></div>
                                </div>
                                {round.admin_reply && (
                                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mt-2">
                                        <strong className="text-indigo-800 flex items-center gap-1 mb-2"><FileText size={16}/> نتيجة المرور / رد الإدارة:</strong>
                                        <p className="text-sm font-bold text-indigo-900 leading-relaxed whitespace-pre-wrap">{round.admin_reply}</p>
                                    </div>
                                )}
                            </div>
                        ))
                    }
                </div>
            )}
        </div>
    );
}
