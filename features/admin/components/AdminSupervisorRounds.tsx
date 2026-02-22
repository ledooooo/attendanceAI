import React, { useState, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2, MessageSquare, MapPin, User, Calendar, FileText, Send, Plus, Filter, Forward, X } from 'lucide-react';
import toast from 'react-hot-toast';

// قائمة الأماكن
const LOCATION_OPTIONS = [
    'المركز كامل', 'طب الاسرة', 'التطعيمات', 'المعمل', 'الاسنان',
    'الطوارئ', 'الملفات', 'الصيدلية', 'مكتب الصحة', 'تنمية الاسرة',
    'المبادرات', 'الصحة والسلامة المهنية', 'الجودة'
];

export default function AdminSupervisorRounds() {
    const queryClient = useQueryClient();
    
    // --- States ---
    const [activeTab, setActiveTab] = useState<'history' | 'add_new'>('history');
    
    // فلترة السجل
    const [filterDate, setFilterDate] = useState('');
    const [filterName, setFilterName] = useState('');
    const [filterLocation, setFilterLocation] = useState('');

    // الرد على عناصر المرور
    const [replyingToRoundId, setReplyingToRoundId] = useState<string | null>(null);
    const [itemReplies, setItemReplies] = useState<Record<string, string>>({}); 
    const [generalReply, setGeneralReply] = useState('');

    // إحالة المرور 
    const [forwardingRoundId, setForwardingRoundId] = useState<string | null>(null);
    const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
    
    // إضافة مرور يدوي
    const [manualLocation, setManualLocation] = useState('');
    const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
    const [manualTime, setManualTime] = useState(new Date().toLocaleTimeString('en-GB', { hour12: false }).slice(0, 5));
    const [manualPositives, setManualPositives] = useState<string[]>(['']);
    const [manualNegatives, setManualNegatives] = useState<string[]>(['']);
    const [manualRecommendations, setManualRecommendations] = useState<string[]>(['']);

    // --- Queries ---
    
    const { data: rounds = [], isLoading: loadingRounds } = useQuery({
        queryKey: ['admin_supervisor_rounds'],
        queryFn: async () => {
            const { data, error } = await supabase.from('supervisor_rounds').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        }
    });

    const { data: targetStaff = [], isLoading: loadingStaff } = useQuery({
        queryKey: ['forward_targets'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('employees')
                .select('id, employee_id, name, role, specialty')
                .in('role', ['head_of_dept', 'quality_manager'])
                .eq('status', 'نشط');
            if (error) throw error;
            return data;
        }
    });

    // --- Mutations ---

    const replyMutation = useMutation({
        mutationFn: async ({ id, supervisorId }: { id: string, supervisorId: string }) => {
            if (!generalReply && Object.keys(itemReplies).length === 0) {
                throw new Error('يرجى كتابة رد عام أو الرد على نقطة واحدة على الأقل');
            }
            
            const finalReplyData = {
                general: generalReply,
                items: itemReplies
            };

            const { error } = await supabase.from('supervisor_rounds').update({
                status: 'replied',
                admin_reply: JSON.stringify(finalReplyData)
            }).eq('id', id);

            if (error) throw error;

            const notifTitle = '✅ تم اعتماد تقرير مرورك';
            const notifMsg = 'تم مراجعة تقريرك وإضافة توجيهات الإدارة. يرجى الاطلاع على السجل.';
            await supabase.from('notifications').insert({ user_id: supervisorId, title: notifTitle, message: notifMsg, type: 'general', is_read: false });
            supabase.functions.invoke('send-push-notification', { body: { userId: supervisorId, title: notifTitle, body: notifMsg, url: '/supervisor?tab=rounds' } }).catch(() => {});
        },
        onSuccess: () => {
            toast.success('تم حفظ واعتماد النتيجة بنجاح');
            setReplyingToRoundId(null); setItemReplies({}); setGeneralReply('');
            queryClient.invalidateQueries({ queryKey: ['admin_supervisor_rounds'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    // ✅ التعديل هنا: استخدام الحقول الصحيحة لجدول messages
    const forwardMutation = useMutation({
        mutationFn: async (round: any) => {
            if (selectedTargetIds.length === 0) throw new Error('يرجى اختيار شخص واحد على الأقل للإحالة');

            let msgBody = `📌 إحالة تقرير مرور: ${round.location}\n\nتمت إحالة تقرير مرور إليك للاطلاع والإفادة.\n\nالتاريخ: ${round.round_date}\n\n`;
            if (round.negatives?.length > 0) msgBody += `❌ السلبيات المرصودة:\n- ${round.negatives.join('\n- ')}\n\n`;
            if (round.recommendations?.length > 0) msgBody += `💡 التوصيات:\n- ${round.recommendations.join('\n- ')}`;

            // ✅ استخدام حقل content بدلاً من body و subject، وحقل is_read بدلاً من status
            const messagesPayload = selectedTargetIds.map(targetId => ({
                from_user: 'admin',
                to_user: targetId,
                content: msgBody,
                is_read: false
            }));

            const { error: msgError } = await supabase.from('messages').insert(messagesPayload);
            if (msgError) throw msgError;

            const notifPayload = selectedTargetIds.map(targetId => ({
                user_id: targetId, title: '📬 إحالة تقرير مرور', message: `وردك تقرير مرور يخص: ${round.location}`, type: 'message', is_read: false
            }));
            await supabase.from('notifications').insert(notifPayload);

            Promise.all(selectedTargetIds.map(targetId => 
                supabase.functions.invoke('send-push-notification', { body: { userId: targetId, title: 'إحالة مرور', body: 'لديك رسالة جديدة', url: '/staff?tab=messages' } })
            )).catch(() => {});
        },
        onSuccess: () => {
            toast.success('تمت إحالة التقرير بنجاح كرسالة');
            setForwardingRoundId(null); setSelectedTargetIds([]);
        },
        onError: (err: any) => toast.error(err.message)
    });

    const manualRoundMutation = useMutation({
        mutationFn: async () => {
            if (!manualLocation) throw new Error('يرجى تحديد مكان المرور');
            
            const cleanPositives = manualPositives.filter(p => p.trim() !== '');
            const cleanNegatives = manualNegatives.filter(n => n.trim() !== '');
            const cleanRecs = manualRecommendations.filter(r => r.trim() !== '');

            const { error } = await supabase.from('supervisor_rounds').insert({
                supervisor_id: 'admin', 
                supervisor_name: 'الإدارة (تسجيل يدوي)',
                round_date: manualDate,
                round_time: manualTime,
                location: manualLocation,
                positives: cleanPositives,
                negatives: cleanNegatives,
                recommendations: cleanRecs,
                status: 'replied', 
                admin_reply: '{"general":"تم التسجيل يدوياً بواسطة الإدارة","items":{}}'
            });

            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم تسجيل المرور اليدوي بنجاح');
            setManualLocation(''); setManualPositives(['']); setManualNegatives(['']); setManualRecommendations(['']);
            setActiveTab('history');
            queryClient.invalidateQueries({ queryKey: ['admin_supervisor_rounds'] });
        },
        onError: (err: any) => toast.error(err.message)
    });


    // --- Helpers ---
    const filteredRounds = useMemo(() => {
        return rounds.filter((r: any) => {
            const matchDate = filterDate ? r.round_date === filterDate : true;
            const matchName = filterName ? r.supervisor_name.includes(filterName) : true;
            const matchLoc = filterLocation ? r.location.includes(filterLocation) : true;
            return matchDate && matchName && matchLoc;
        });
    }, [rounds, filterDate, filterName, filterLocation]);

    const handleItemReplyChange = (type: string, index: number, value: string) => {
        const key = `${type}_${index}`;
        setItemReplies(prev => ({ ...prev, [key]: value }));
    };

    const handleListChange = (setter: any, list: string[], index: number, value: string) => {
        const newList = [...list]; newList[index] = value; setter(newList);
    };

    if (loadingRounds) return <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto"/></div>;

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><MapPin className="text-indigo-600"/> إدارة التقارير الميدانية</h2>
                <div className="flex bg-white p-1 rounded-2xl shadow-sm border">
                    <button onClick={() => setActiveTab('history')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>سجل التقارير</button>
                    <button onClick={() => setActiveTab('add_new')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'add_new' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>+ تسجيل مرور يدوي</button>
                </div>
            </div>

            {activeTab === 'history' && (
                <>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-xs font-bold text-gray-500 mb-1 block">بحث بالتاريخ</label>
                            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-full p-2 border rounded-xl outline-none text-sm"/>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-xs font-bold text-gray-500 mb-1 block">اسم المشرف</label>
                            <input type="text" placeholder="اكتب اسم المشرف..." value={filterName} onChange={e => setFilterName(e.target.value)} className="w-full p-2 border rounded-xl outline-none text-sm"/>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-xs font-bold text-gray-500 mb-1 block">مكان المرور</label>
                            <input type="text" placeholder="اكتب المكان..." value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="w-full p-2 border rounded-xl outline-none text-sm"/>
                        </div>
                        <button onClick={() => {setFilterDate(''); setFilterName(''); setFilterLocation('');}} className="p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors" title="مسح الفلاتر"><Filter size={20}/></button>
                    </div>

                    {filteredRounds.length === 0 ? <div className="text-center py-20 bg-white rounded-3xl border border-dashed text-gray-400 font-bold">لا توجد تقارير تطابق بحثك.</div> : 
                        filteredRounds.map((round: any) => {
                            let parsedReply: any = { general: round.admin_reply || '', items: {} };
                            try {
                                if (round.admin_reply && round.admin_reply.startsWith('{')) {
                                    parsedReply = JSON.parse(round.admin_reply);
                                }
                            } catch(e) {}

                            return (
                                <div key={round.id} className={`bg-white rounded-3xl p-6 shadow-sm border-l-4 ${round.status === 'replied' ? 'border-l-green-500' : 'border-l-orange-500'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-lg font-black text-gray-800 flex items-center gap-2"><User size={18} className="text-indigo-500"/> المشرف: {round.supervisor_name}</h3>
                                            <div className="flex gap-4 mt-2 text-xs font-bold text-gray-500">
                                                <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded"><MapPin size={12}/> {round.location}</span>
                                                <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded"><Calendar size={12}/> {round.round_date} | {round.round_time}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setForwardingRoundId(forwardingRoundId === round.id ? null : round.id)} className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-blue-100 transition-colors">
                                                <Forward size={14}/> إحالة (رسالة)
                                            </button>
                                            {round.status === 'replied' && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1"><CheckCircle2 size={14}/> معتمد</span>}
                                        </div>
                                    </div>

                                    {forwardingRoundId === round.id && (
                                        <div className="mb-4 bg-blue-50 p-4 rounded-2xl border border-blue-100 animate-in slide-in-from-top-2">
                                            <h4 className="font-bold text-sm text-blue-800 mb-2 flex items-center justify-between">إحالة التقرير إلى: <button onClick={()=>setForwardingRoundId(null)}><X size={16}/></button></h4>
                                            {loadingStaff ? <Loader2 className="animate-spin text-blue-500 w-5 h-5"/> : (
                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    {targetStaff.map((staff: any) => (
                                                        <label key={staff.employee_id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${selectedTargetIds.includes(staff.employee_id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'}`}>
                                                            <input type="checkbox" className="hidden" checked={selectedTargetIds.includes(staff.employee_id)} onChange={(e) => {
                                                                if(e.target.checked) setSelectedTargetIds([...selectedTargetIds, staff.employee_id]);
                                                                else setSelectedTargetIds(selectedTargetIds.filter(id => id !== staff.employee_id));
                                                            }}/>
                                                            <span className="text-xs font-bold">{staff.name} ({staff.role === 'quality_manager' ? 'جودة' : 'رئيس قسم'})</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                            <button onClick={() => forwardMutation.mutate(round)} disabled={forwardMutation.isPending || selectedTargetIds.length===0} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                                                {forwardMutation.isPending ? <Loader2 size={14} className="animate-spin"/> : <Send size={14} className="rtl:rotate-180"/>} إرسال
                                            </button>
                                        </div>
                                    )}

                                    <div className="space-y-4 text-xs mt-4">
                                        {round.positives?.length > 0 && round.positives[0] !== "" && (
                                            <div className="bg-green-50/50 p-3 rounded-xl border border-green-100">
                                                <strong className="text-green-700 block mb-2">الإيجابيات:</strong>
                                                <div className="space-y-2">
                                                    {round.positives.map((p:string, i:number) => (
                                                        <div key={i} className="flex flex-col gap-1">
                                                            <div className="flex items-start gap-2"><span className="text-green-500">•</span><span className="text-gray-700">{p}</span></div>
                                                            {round.status === 'pending' && replyingToRoundId === round.id && (
                                                                <input type="text" placeholder="تعليق الإدارة على هذه النقطة..." value={itemReplies[`positives_${i}`] || ''} onChange={e => handleItemReplyChange('positives', i, e.target.value)} className="mr-4 p-1.5 rounded-lg border border-green-200 outline-none focus:border-green-500 bg-white" />
                                                            )}
                                                            {parsedReply.items[`positives_${i}`] && (
                                                                <div className="mr-4 text-indigo-600 font-bold bg-indigo-50 p-1.5 rounded-lg border border-indigo-100 flex items-center gap-1"><MessageSquare size={10}/> {parsedReply.items[`positives_${i}`]}</div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {round.negatives?.length > 0 && round.negatives[0] !== "" && (
                                            <div className="bg-red-50/50 p-3 rounded-xl border border-red-100">
                                                <strong className="text-red-700 block mb-2">السلبيات:</strong>
                                                <div className="space-y-2">
                                                    {round.negatives.map((p:string, i:number) => (
                                                        <div key={i} className="flex flex-col gap-1">
                                                            <div className="flex items-start gap-2"><span className="text-red-500">•</span><span className="text-gray-700">{p}</span></div>
                                                            {round.status === 'pending' && replyingToRoundId === round.id && (
                                                                <input type="text" placeholder="توجيه الإدارة لحل هذه السلبية..." value={itemReplies[`negatives_${i}`] || ''} onChange={e => handleItemReplyChange('negatives', i, e.target.value)} className="mr-4 p-1.5 rounded-lg border border-red-200 outline-none focus:border-red-500 bg-white" />
                                                            )}
                                                            {parsedReply.items[`negatives_${i}`] && (
                                                                <div className="mr-4 text-indigo-600 font-bold bg-indigo-50 p-1.5 rounded-lg border border-indigo-100 flex items-center gap-1"><MessageSquare size={10}/> {parsedReply.items[`negatives_${i}`]}</div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {round.recommendations?.length > 0 && round.recommendations[0] !== "" && (
                                            <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                                                <strong className="text-blue-700 block mb-2">التوصيات:</strong>
                                                <div className="space-y-2">
                                                    {round.recommendations.map((p:string, i:number) => (
                                                        <div key={i} className="flex flex-col gap-1">
                                                            <div className="flex items-start gap-2"><span className="text-blue-500">•</span><span className="text-gray-700">{p}</span></div>
                                                            {round.status === 'pending' && replyingToRoundId === round.id && (
                                                                <input type="text" placeholder="رد الإدارة على التوصية..." value={itemReplies[`recommendations_${i}`] || ''} onChange={e => handleItemReplyChange('recommendations', i, e.target.value)} className="mr-4 p-1.5 rounded-lg border border-blue-200 outline-none focus:border-blue-500 bg-white" />
                                                            )}
                                                            {parsedReply.items[`recommendations_${i}`] && (
                                                                <div className="mr-4 text-indigo-600 font-bold bg-indigo-50 p-1.5 rounded-lg border border-indigo-100 flex items-center gap-1"><MessageSquare size={10}/> {parsedReply.items[`recommendations_${i}`]}</div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {round.status === 'pending' ? (
                                        replyingToRoundId === round.id ? (
                                            <div className="mt-6 bg-indigo-50 p-4 rounded-2xl border border-indigo-100 animate-in fade-in">
                                                <label className="text-sm font-black text-indigo-800 mb-2 flex items-center gap-1"><MessageSquare size={16}/> تعليق عام واعتماد التقرير</label>
                                                <textarea value={generalReply} onChange={e => setGeneralReply(e.target.value)} placeholder="اكتب تعليقاً عاماً للمشرف (اختياري)..." className="w-full p-3 rounded-xl border outline-none h-20 mb-3 resize-none text-sm"/>
                                                <div className="flex gap-2">
                                                    <button onClick={() => replyMutation.mutate({id: round.id, supervisorId: round.supervisor_id})} disabled={replyMutation.isPending} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2">{replyMutation.isPending ? <Loader2 size={16} className="animate-spin"/> : 'اعتماد التقرير وإرسال الردود'}</button>
                                                    <button onClick={() => {setReplyingToRoundId(null); setItemReplies({}); setGeneralReply('');}} className="bg-gray-200 text-gray-600 px-6 py-2 rounded-xl font-bold hover:bg-gray-300">إلغاء</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button onClick={() => setReplyingToRoundId(round.id)} className="mt-4 w-full border-2 border-dashed border-indigo-200 text-indigo-600 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"><FileText size={18}/> الرد على عناصر التقرير واعتماده</button>
                                        )
                                    ) : (
                                        parsedReply.general && (
                                            <div className="mt-4 bg-gray-50 p-4 rounded-xl border">
                                                <strong className="text-gray-700 text-sm mb-1 block flex items-center gap-1"><CheckCircle2 size={16} className="text-green-600"/> تعليق الإدارة العام:</strong>
                                                <p className="text-gray-600 text-sm font-bold whitespace-pre-wrap">{parsedReply.general}</p>
                                            </div>
                                        )
                                    )}
                                </div>
                            );
                        })
                    }
                </>
            )}

            {activeTab === 'add_new' && (
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border space-y-6">
                    <div className="border-b pb-6">
                        <label className="text-sm font-black text-gray-700 mb-3 flex items-center gap-2"><MapPin className="text-indigo-500 w-5 h-5"/> مكان المرور</label>
                        <select value={manualLocation} onChange={e => setManualLocation(e.target.value)} className="w-full md:w-1/2 p-3 bg-gray-50 border rounded-xl outline-none font-bold text-sm">
                            <option value="">اختر المكان...</option>
                            {LOCATION_OPTIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-6">
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Calendar size={14}/> التاريخ</label>
                            <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-xl outline-none font-bold text-gray-700"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Clock size={14}/> التوقيت</label>
                            <input type="time" value={manualTime} onChange={e => setManualTime(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-xl outline-none font-bold text-gray-700"/>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="p-4 rounded-2xl border bg-green-50 border-green-100">
                            <h4 className="font-black text-sm mb-3 flex items-center justify-between text-green-700">✅ الإيجابيات<button onClick={() => setManualPositives([...manualPositives, ''])} className="p-1.5 bg-white text-green-600 rounded-lg shadow-sm"><Plus size={16}/></button></h4>
                            <div className="space-y-2">{manualPositives.map((item, idx) => (<div key={idx} className="flex gap-2"><input type="text" value={item} onChange={(e) => handleListChange(setManualPositives, manualPositives, idx, e.target.value)} placeholder={`نقطة ${idx + 1}...`} className="flex-1 p-2 text-sm rounded-xl border outline-none focus:ring-2 bg-white" />{manualPositives.length > 1 && <button onClick={() => setManualPositives(manualPositives.filter((_, i) => i !== idx))} className="p-2 text-red-400 hover:bg-red-50 rounded-xl"><Trash2 size={16}/></button>}</div>))}</div>
                        </div>
                        <div className="p-4 rounded-2xl border bg-red-50 border-red-100">
                            <h4 className="font-black text-sm mb-3 flex items-center justify-between text-red-700">❌ السلبيات<button onClick={() => setManualNegatives([...manualNegatives, ''])} className="p-1.5 bg-white text-red-600 rounded-lg shadow-sm"><Plus size={16}/></button></h4>
                            <div className="space-y-2">{manualNegatives.map((item, idx) => (<div key={idx} className="flex gap-2"><input type="text" value={item} onChange={(e) => handleListChange(setManualNegatives, manualNegatives, idx, e.target.value)} placeholder={`نقطة ${idx + 1}...`} className="flex-1 p-2 text-sm rounded-xl border outline-none focus:ring-2 bg-white" />{manualNegatives.length > 1 && <button onClick={() => setManualNegatives(manualNegatives.filter((_, i) => i !== idx))} className="p-2 text-red-400 hover:bg-red-50 rounded-xl"><Trash2 size={16}/></button>}</div>))}</div>
                        </div>
                        <div className="p-4 rounded-2xl border bg-blue-50 border-blue-100">
                            <h4 className="font-black text-sm mb-3 flex items-center justify-between text-blue-700">💡 التوصيات<button onClick={() => setManualRecommendations([...manualRecommendations, ''])} className="p-1.5 bg-white text-blue-600 rounded-lg shadow-sm"><Plus size={16}/></button></h4>
                            <div className="space-y-2">{manualRecommendations.map((item, idx) => (<div key={idx} className="flex gap-2"><input type="text" value={item} onChange={(e) => handleListChange(setManualRecommendations, manualRecommendations, idx, e.target.value)} placeholder={`نقطة ${idx + 1}...`} className="flex-1 p-2 text-sm rounded-xl border outline-none focus:ring-2 bg-white" />{manualRecommendations.length > 1 && <button onClick={() => setManualRecommendations(manualRecommendations.filter((_, i) => i !== idx))} className="p-2 text-red-400 hover:bg-red-50 rounded-xl"><Trash2 size={16}/></button>}</div>))}</div>
                        </div>
                    </div>

                    <button onClick={() => manualRoundMutation.mutate()} disabled={manualRoundMutation.isPending} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex justify-center items-center gap-2 mt-4">
                        {manualRoundMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin"/> : <><CheckCircle2 size={20}/> تسجيل وحفظ المرور (باسم الإدارة)</>}
                    </button>
                </div>
            )}
        </div>
    );
}
