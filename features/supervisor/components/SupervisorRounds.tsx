import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { Plus, Trash2, Send, MapPin, Clock, Calendar, CheckCircle2, FileText, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';

// قائمة الأماكن المتاحة للمرور
const LOCATION_OPTIONS = [
    'المركز كامل', 'طب الاسرة', 'التطعيمات', 'المعمل', 'الاسنان',
    'الطوارئ', 'الملفات', 'الصيدلية', 'مكتب الصحة', 'تنمية الاسرة',
    'المبادرات', 'الصحة والسلامة المهنية', 'الجودة', 'أخرى'
];

export default function SupervisorRounds() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');

    // بيانات النموذج
    const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
    const [otherLocation, setOtherLocation] = useState('');
    const [roundDate, setRoundDate] = useState(new Date().toISOString().split('T')[0]);
    const [roundTime, setRoundTime] = useState(new Date().toLocaleTimeString('en-GB', { hour12: false }).slice(0, 5));
    
    // القوائم الديناميكية
    const [positives, setPositives] = useState<string[]>(['']);
    const [negatives, setNegatives] = useState<string[]>(['']);
    const [recommendations, setRecommendations] = useState<string[]>(['']);

    // دالة تحديث الحقول بأمان لمنع فقدان التركيز (Focus)
    const updateListItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, list: string[], index: number, value: string) => {
        const newList = [...list];
        newList[index] = value;
        setter(newList);
    };

    const addListItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, list: string[]) => {
        setter([...list, '']);
    };

    const removeListItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, list: string[], index: number) => {
        if (list.length > 1) {
            setter(list.filter((_, i) => i !== index));
        }
    };

    // دالة اختيار مكان المرور (متعدد)
    const toggleLocation = (loc: string) => {
        if (loc === 'المركز كامل') {
            setSelectedLocations(['المركز كامل']);
            setOtherLocation('');
            return;
        }

        let newLocs = selectedLocations.includes('المركز كامل') ? [] : [...selectedLocations];

        if (newLocs.includes(loc)) {
            newLocs = newLocs.filter(l => l !== loc);
            if (loc === 'أخرى') setOtherLocation('');
        } else {
            newLocs.push(loc);
        }
        setSelectedLocations(newLocs);
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
            // 1. تجميع وتجهيز مكان المرور النهائي
            let finalLocation = selectedLocations.filter(l => l !== 'أخرى').join('، ');
            if (selectedLocations.includes('أخرى') && otherLocation.trim()) {
                finalLocation += (finalLocation ? '، ' : '') + otherLocation.trim();
            }

            if (!finalLocation) throw new Error('يرجى تحديد مكان المرور');
            
            // 2. تنظيف القوائم من الخانات الفارغة
            const cleanPositives = positives.filter(p => p.trim() !== '');
            const cleanNegatives = negatives.filter(n => n.trim() !== '');
            const cleanRecs = recommendations.filter(r => r.trim() !== '');

            if (cleanPositives.length === 0 && cleanNegatives.length === 0 && cleanRecs.length === 0) {
                throw new Error('يرجى كتابة نقطة واحدة على الأقل (في الإيجابيات، السلبيات، أو التوصيات)');
            }

            // 3. جلب اسم المشرف
            const { data: sup } = await supabase.from('supervisors').select('name').eq('id', user?.id).single();

            // 4. الحفظ في الداتابيز
            const { error } = await supabase.from('supervisor_rounds').insert({
                supervisor_id: user?.id,
                supervisor_name: sup?.name || 'مشرف',
                round_date: roundDate,
                round_time: roundTime,
                location: finalLocation,
                positives: cleanPositives,
                negatives: cleanNegatives,
                recommendations: cleanRecs,
                status: 'pending'
            });

            if (error) throw error;

            // 5. إرسال إشعار للمدير
            const notifTitle = '👀 تقرير مرور جديد';
            const notifMsg = `قام المشرف ${sup?.name || 'الجديد'} بتسجيل مرور على: ${finalLocation}`;
            
            // تسجيل في قاعدة البيانات للمدير
            await supabase.from('notifications').insert({ 
                user_id: 'admin', 
                title: notifTitle, 
                message: notifMsg, 
                type: 'general', 
                is_read: false 
            });

            // إرسال Push Notification فوري لجهاز المدير
            supabase.functions.invoke('send-push-notification', { 
                body: { 
                    userId: 'admin', 
                    title: notifTitle, 
                    body: notifMsg, 
                    url: '/admin?tab=supervisor-rounds' 
                } 
            }).catch(err => console.error("Push Error:", err));
        },
        onSuccess: () => {
            toast.success('تم إرسال تقرير المرور للإدارة بنجاح ✅');
            // تفريغ الحقول
            setSelectedLocations([]); 
            setOtherLocation('');
            setPositives(['']); 
            setNegatives(['']); 
            setRecommendations(['']);
            setActiveTab('history');
            queryClient.invalidateQueries({ queryKey: ['supervisor_rounds'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            <div className="flex bg-white p-1 rounded-2xl shadow-sm w-fit border">
                <button onClick={() => setActiveTab('new')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'new' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>تسجيل مرور جديد</button>
                <button onClick={() => setActiveTab('history')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>سجل المرور</button>
            </div>

            {activeTab === 'new' && (
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border space-y-6">
                    
                    {/* اختيار مكان المرور (متعدد) */}
                    <div className="border-b pb-6">
                        <label className="text-sm font-black text-gray-700 mb-3 flex items-center gap-2"><MapPin className="text-indigo-500 w-5 h-5"/> مكان المرور (يمكن اختيار أكثر من مكان)</label>
                        <div className="flex flex-wrap gap-2">
                            {LOCATION_OPTIONS.map(loc => (
                                <button 
                                    key={loc}
                                    onClick={() => toggleLocation(loc)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border-2 
                                        ${selectedLocations.includes(loc) ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-gray-100 text-gray-600 hover:border-indigo-200'}`}
                                >
                                    {selectedLocations.includes(loc) && <Check size={14}/>} {loc}
                                </button>
                            ))}
                        </div>
                        {/* حقل مخصص لـ "أخرى" */}
                        {selectedLocations.includes('أخرى') && (
                            <div className="mt-3 animate-in slide-in-from-top-2">
                                <input 
                                    type="text" 
                                    value={otherLocation} 
                                    onChange={e => setOtherLocation(e.target.value)} 
                                    placeholder="اكتب المكان هنا..." 
                                    className="w-full md:w-1/2 p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm"
                                />
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-6">
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Calendar size={14}/> التاريخ</label>
                            <input type="date" value={roundDate} onChange={e => setRoundDate(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-xl outline-none font-bold text-gray-700"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Clock size={14}/> التوقيت</label>
                            <input type="time" value={roundTime} onChange={e => setRoundTime(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-xl outline-none font-bold text-gray-700"/>
                        </div>
                    </div>

                    {/* القوائم الديناميكية المدمجة مباشرة لمنع فقدان الـ Focus */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* 1. الإيجابيات */}
                        <div className="p-4 rounded-2xl border bg-green-50 border-green-100">
                            <h4 className="font-black text-sm mb-3 flex items-center justify-between text-green-700">
                                ✅ الإيجابيات
                                <button onClick={() => addListItem(setPositives, positives)} className="p-1.5 bg-white text-green-600 rounded-lg shadow-sm hover:scale-105 transition-transform"><Plus size={16}/></button>
                            </h4>
                            <div className="space-y-2">
                                {positives.map((item, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input type="text" value={item} onChange={(e) => updateListItem(setPositives, positives, idx, e.target.value)} placeholder={`اكتب النقطة ${idx + 1}...`} className="flex-1 p-2 text-sm rounded-xl border-green-200 outline-none focus:ring-2 ring-green-500 bg-white transition-all" />
                                        {positives.length > 1 && <button onClick={() => removeListItem(setPositives, positives, idx)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={16}/></button>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2. السلبيات */}
                        <div className="p-4 rounded-2xl border bg-red-50 border-red-100">
                            <h4 className="font-black text-sm mb-3 flex items-center justify-between text-red-700">
                                ❌ السلبيات / الملاحظات
                                <button onClick={() => addListItem(setNegatives, negatives)} className="p-1.5 bg-white text-red-600 rounded-lg shadow-sm hover:scale-105 transition-transform"><Plus size={16}/></button>
                            </h4>
                            <div className="space-y-2">
                                {negatives.map((item, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input type="text" value={item} onChange={(e) => updateListItem(setNegatives, negatives, idx, e.target.value)} placeholder={`اكتب النقطة ${idx + 1}...`} className="flex-1 p-2 text-sm rounded-xl border-red-200 outline-none focus:ring-2 ring-red-500 bg-white transition-all" />
                                        {negatives.length > 1 && <button onClick={() => removeListItem(setNegatives, negatives, idx)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={16}/></button>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 3. التوصيات */}
                        <div className="p-4 rounded-2xl border bg-blue-50 border-blue-100">
                            <h4 className="font-black text-sm mb-3 flex items-center justify-between text-blue-700">
                                💡 التوصيات
                                <button onClick={() => addListItem(setRecommendations, recommendations)} className="p-1.5 bg-white text-blue-600 rounded-lg shadow-sm hover:scale-105 transition-transform"><Plus size={16}/></button>
                            </h4>
                            <div className="space-y-2">
                                {recommendations.map((item, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input type="text" value={item} onChange={(e) => updateListItem(setRecommendations, recommendations, idx, e.target.value)} placeholder={`اكتب النقطة ${idx + 1}...`} className="flex-1 p-2 text-sm rounded-xl border-blue-200 outline-none focus:ring-2 ring-blue-500 bg-white transition-all" />
                                        {recommendations.length > 1 && <button onClick={() => removeListItem(setRecommendations, recommendations, idx)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={16}/></button>}
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                    <button onClick={() => submitRoundMutation.mutate()} disabled={submitRoundMutation.isPending} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex justify-center items-center gap-2 disabled:opacity-50 mt-4">
                        {submitRoundMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin"/> : <><Send size={20} className="rtl:rotate-180"/> حفظ التقرير وإرساله للمدير</>}
                    </button>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="space-y-4">
                    {isLoading ? <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 my-10"/> : history.length === 0 ? <p className="text-center text-gray-400 font-bold py-10 bg-white rounded-3xl border border-dashed">لا يوجد سجل مرور بعد.</p> :
                        history.map((round: any) => (
                            <div key={round.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
                                <div className="flex justify-between items-start border-b pb-3">
                                    <div>
                                        <h3 className="font-black text-gray-800 flex items-center gap-2"><MapPin className="text-indigo-500 w-5 h-5"/> {round.location}</h3>
                                        <p className="text-xs text-gray-500 font-bold mt-1">{new Date(round.round_date).toLocaleDateString('ar-EG')} - {round.round_time}</p>
                                    </div>
                                    <span className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1 ${round.status === 'replied' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {round.status === 'replied' ? <CheckCircle2 size={14}/> : <Clock size={14}/>} {round.status === 'replied' ? 'تم الرد واعتماد المدير' : 'قيد المراجعة'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                    {round.positives?.length > 0 && round.positives[0] !== "" && (
                                        <div className="bg-green-50/50 p-3 rounded-xl border border-green-100">
                                            <strong className="text-green-700 block mb-2">الإيجابيات:</strong>
                                            <ul className="list-disc list-inside text-gray-600 space-y-1">{round.positives.map((p:string,i:number)=><li key={i}>{p}</li>)}</ul>
                                        </div>
                                    )}
                                    {round.negatives?.length > 0 && round.negatives[0] !== "" && (
                                        <div className="bg-red-50/50 p-3 rounded-xl border border-red-100">
                                            <strong className="text-red-700 block mb-2">السلبيات:</strong>
                                            <ul className="list-disc list-inside text-gray-600 space-y-1">{round.negatives.map((p:string,i:number)=><li key={i}>{p}</li>)}</ul>
                                        </div>
                                    )}
                                    {round.recommendations?.length > 0 && round.recommendations[0] !== "" && (
                                        <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                                            <strong className="text-blue-700 block mb-2">التوصيات:</strong>
                                            <ul className="list-disc list-inside text-gray-600 space-y-1">{round.recommendations.map((p:string,i:number)=><li key={i}>{p}</li>)}</ul>
                                        </div>
                                    )}
                                </div>
                                {round.admin_reply && (
                                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mt-2">
                                        <strong className="text-indigo-800 flex items-center gap-1 mb-2"><FileText size={16}/> نتيجة المرور / رد المدير العام:</strong>
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
