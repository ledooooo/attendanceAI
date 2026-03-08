import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { 
  Calendar, MessageCircle, AlertTriangle, Send, Share, 
  SkipForward, ShieldAlert, Loader2, User, Pill, Activity, FileText
} from 'lucide-react';

export default function DoctorClinic({ employee }: { employee: any }) {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [consultations, setConsultations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [selectedCons, setSelectedCons] = useState<any | null>(null);
    const [actionType, setActionType] = useState<'reply' | 'transfer' | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // بيانات الرد أو التحويل
    const [transferTo, setTransferTo] = useState('الباطنة');
    const [replyData, setReplyData] = useState({
        prescriptions: '', lab_requests: '', radiology_requests: '',
        health_messages: '', danger_signs: '', follow_up_date: '', notes: ''
    });

    const specialties = ['طب الأسرة', 'الأطفال', 'النساء والتوليد', 'الباطنة', 'الأسنان'];

    useEffect(() => {
        if (employee?.specialty) fetchData();
    }, [employee]);

    const fetchData = async () => {
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];

        // جلب مواعيد اليوم لعيادة هذا الطبيب
        const { data: appts } = await supabase
            .from('patient_appointments')
            .select('*, patients(full_name, file_number)')
            .eq('appointment_date', today)
            // افتراض أن اسم عيادة الطبيب يشبه تخصصه
            .ilike('clinic_name', `%${employee.specialty}%`);
            
        // جلب الاستشارات المفتوحة لتخصص الطبيب (التي لم تحظر)
        const { data: cons } = await supabase
            .from('consultations')
            .select('*, patients(full_name, gender, birth_date, file_number)')
            .eq('specialty', employee.specialty)
            .eq('status', 'new')
            .eq('is_blocked', false)
            .order('urgency', { ascending: false }) // العاجل أولاً
            .order('created_at', { ascending: true }); // الأقدم أولاً

        if (appts) setAppointments(appts);
        if (cons) setConsultations(cons);
        setLoading(false);
    };

    // 1. تخطي الاستشارة
    const handleSkip = () => {
        setSelectedCons(null);
        setActionType(null);
    };

    // 2. حظر الاستشارة (تتحول للإدارة)
    const handleBlock = async (id: string) => {
        if (!window.confirm('هل أنت متأكد من حظر هذه الاستشارة لوجود إساءة؟')) return;
        setSubmitting(true);
        await supabase.from('consultations').update({ is_blocked: true, status: 'closed' }).eq('id', id);
        toast.success('تم حظر الاستشارة وتحويلها للإدارة');
        fetchData();
        handleSkip();
        setSubmitting(false);
    };

    // 3. تحويل الاستشارة
    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        await supabase.from('consultations').update({ 
            specialty: transferTo, 
            is_transferred: true,
            transferred_to_specialty: transferTo
        }).eq('id', selectedCons.id);
        toast.success(`تم تحويل الاستشارة إلى قسم ${transferTo}`);
        fetchData();
        handleSkip();
        setSubmitting(false);
    };

    // 4. الرد على الاستشارة
    const handleReply = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        // تحويل النصوص إلى JSON Arrays ببساطة (كل سطر عنصر)
        const parseLines = (text: string) => text.split('\n').filter(line => line.trim() !== '').map(item => ({ text: item.trim() }));
        const parseMeds = (text: string) => text.split('\n').filter(line => line.trim() !== '').map(med => ({ name: med.trim(), dose: '', freq: '', duration: '' })); // مبسط

        const payload = {
            consultation_id: selectedCons.id,
            doctor_id: employee.id,
            prescriptions: parseMeds(replyData.prescriptions),
            lab_requests: parseLines(replyData.lab_requests),
            radiology_requests: parseLines(replyData.radiology_requests),
            health_messages: replyData.health_messages.split('\n').filter(l => l.trim() !== ''),
            danger_signs: replyData.danger_signs,
            follow_up_date: replyData.follow_up_date || null,
            notes: replyData.notes
        };

        const { error } = await supabase.from('consultation_replies').insert(payload);
        if (!error) {
            await supabase.from('consultations').update({ status: 'answered', doctor_id: employee.id }).eq('id', selectedCons.id);
            toast.success('تم إرسال الروشتة للمريض بنجاح');
            
            // إرسال إشعار للمريض
            await supabase.from('patient_notifications').insert({
                patient_id: selectedCons.patient_id,
                title: 'رد من الطبيب 🩺',
                message: `تم الرد على استشارتك في قسم ${employee.specialty}، يرجى مراجعة الروشتة.`
            });

            fetchData();
            handleSkip();
        } else {
            toast.error('حدث خطأ أثناء الإرسال');
        }
        setSubmitting(false);
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-500 w-8 h-8"/></div>;

    return (
        <div className="space-y-6">
            {/* إحصائيات سريعة */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-2xl border shadow-sm border-blue-100">
                    <div className="text-blue-500 mb-2"><Calendar size={24}/></div>
                    <h3 className="text-2xl font-black text-gray-800">{appointments.length}</h3>
                    <p className="text-xs font-bold text-gray-500">حجوزات عيادتك اليوم</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border shadow-sm border-indigo-100">
                    <div className="text-indigo-500 mb-2"><MessageCircle size={24}/></div>
                    <h3 className="text-2xl font-black text-gray-800">{consultations.length}</h3>
                    <p className="text-xs font-bold text-gray-500">استشارات مفتوحة للرد</p>
                </div>
            </div>

            {selectedCons ? (
                /* ─── شاشة التعامل مع الاستشارة المحددة ─── */
                <div className="bg-white p-6 rounded-3xl shadow-lg border border-indigo-200 animate-in slide-in-from-bottom-4 relative">
                    <div className="flex justify-between items-start mb-6 border-b pb-4">
                        <div>
                            <h3 className="font-black text-lg text-gray-800 flex items-center gap-2"><User size={20}/> {selectedCons.patients?.full_name}</h3>
                            <p className="text-xs font-bold text-gray-500 mt-1">النوع: {selectedCons.patients?.gender} | رقم الملف: {selectedCons.patients?.file_number}</p>
                            {selectedCons.urgency === 'urgent' && <span className="bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded mt-2 inline-block">عاجل جداً 🚨</span>}
                        </div>
                        <button onClick={handleSkip} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-200 flex items-center gap-1"><SkipForward size={14}/> تخطي للاحقاً</button>
                    </div>

                    <div className="bg-blue-50/50 p-4 rounded-2xl mb-6">
                        <p className="text-sm font-bold text-gray-800 leading-relaxed">"{selectedCons.consultation_text}"</p>
                        {selectedCons.symptoms?.length > 0 && <p className="text-xs text-red-600 font-bold mt-2">الأعراض: {selectedCons.symptoms.join('، ')}</p>}
                    </div>

                    {/* أزرار الإجراءات */}
                    {!actionType ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <button onClick={() => setActionType('reply')} className="bg-emerald-600 text-white p-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-emerald-700"><Send size={18}/> كتابة الروشتة (رد)</button>
                            <button onClick={() => setActionType('transfer')} className="bg-blue-600 text-white p-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-blue-700"><Share size={18}/> تحويل لتخصص آخر</button>
                            <button onClick={() => handleBlock(selectedCons.id)} className="bg-red-50 text-red-600 p-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-red-100"><ShieldAlert size={18}/> حظر وإبلاغ الإدارة</button>
                        </div>
                    ) : actionType === 'transfer' ? (
                        <form onSubmit={handleTransfer} className="bg-gray-50 p-4 rounded-xl border animate-in fade-in">
                            <label className="block text-sm font-bold mb-2">اختر التخصص المطلوب تحويل المريض إليه:</label>
                            <select value={transferTo} onChange={e => setTransferTo(e.target.value)} className="w-full p-3 rounded-lg border mb-4 font-bold">
                                {specialties.filter(s => s !== employee.specialty).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <div className="flex gap-2">
                                <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold">تأكيد التحويل</button>
                                <button type="button" onClick={() => setActionType(null)} className="bg-white border px-6 py-2 rounded-lg font-bold">إلغاء</button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleReply} className="space-y-4 animate-in fade-in bg-gray-50 p-5 rounded-2xl border">
                            <h4 className="font-black text-emerald-800 flex items-center gap-2 mb-4"><Pill size={18}/> إصدار الروشتة والرد</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold mb-1">الأدوية الموصوفة (اكتب كل دواء في سطر)</label>
                                    <textarea value={replyData.prescriptions} onChange={e => setReplyData({...replyData, prescriptions: e.target.value})} className="w-full p-3 border rounded-xl text-sm" rows={3} placeholder="Panadol 500mg قرص مرتين يومياً..."/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1">تحاليل مطلوبة (كل تحليل في سطر)</label>
                                    <textarea value={replyData.lab_requests} onChange={e => setReplyData({...replyData, lab_requests: e.target.value})} className="w-full p-3 border rounded-xl text-sm" rows={2}/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1">أشعة مطلوبة (كل أشعة في سطر)</label>
                                    <textarea value={replyData.radiology_requests} onChange={e => setReplyData({...replyData, radiology_requests: e.target.value})} className="w-full p-3 border rounded-xl text-sm" rows={2}/>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold mb-1">رسائل تثقيفية للمريض (كل رسالة في سطر)</label>
                                    <textarea value={replyData.health_messages} onChange={e => setReplyData({...replyData, health_messages: e.target.value})} className="w-full p-3 border rounded-xl text-sm" rows={2}/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-red-600 mb-1">علامات خطر (إن وجدت)</label>
                                    <input type="text" value={replyData.danger_signs} onChange={e => setReplyData({...replyData, danger_signs: e.target.value})} className="w-full p-3 border rounded-xl text-sm" placeholder="توجه للطوارئ إذا حدث..."/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1">تاريخ المتابعة (اختياري)</label>
                                    <input type="date" value={replyData.follow_up_date} onChange={e => setReplyData({...replyData, follow_up_date: e.target.value})} className="w-full p-3 border rounded-xl text-sm"/>
                                </div>
                            </div>
                            <div className="flex gap-2 pt-4">
                                <button type="submit" disabled={submitting} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-black flex items-center gap-2">{submitting ? <Loader2 className="animate-spin" /> : 'إرسال للمريض'}</button>
                                <button type="button" onClick={() => setActionType(null)} className="bg-white border px-6 py-3 rounded-xl font-bold">إلغاء</button>
                            </div>
                        </form>
                    )}
                </div>
            ) : (
                /* ─── عرض القوائم (المواعيد والاستشارات) ─── */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* الحجوزات */}
                    <div className="bg-white p-5 rounded-2xl border shadow-sm h-[500px] overflow-y-auto custom-scrollbar">
                        <h3 className="font-black text-lg mb-4 flex items-center gap-2"><Calendar className="text-blue-500"/> مواعيد اليوم</h3>
                        {appointments.length === 0 ? <p className="text-gray-400 font-bold text-center py-10">لا توجد حجوزات اليوم.</p> : 
                            appointments.map(app => (
                                <div key={app.id} className="p-3 border rounded-xl mb-3 hover:bg-gray-50 flex justify-between items-center">
                                    <div>
                                        <p className="font-black text-gray-800 text-sm">{app.patients?.full_name}</p>
                                        <p className="text-[10px] text-gray-500 font-bold mt-1">وقت الحجز: {app.appointment_time}</p>
                                    </div>
                                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-black">{app.status}</span>
                                </div>
                            ))
                        }
                    </div>

                    {/* الاستشارات */}
                    <div className="bg-white p-5 rounded-2xl border shadow-sm h-[500px] overflow-y-auto custom-scrollbar">
                        <h3 className="font-black text-lg mb-4 flex items-center gap-2"><MessageCircle className="text-indigo-500"/> استشارات بانتظار الرد</h3>
                        {consultations.length === 0 ? <p className="text-gray-400 font-bold text-center py-10">العيادة الإلكترونية فارغة حالياً.</p> : 
                            consultations.map(cons => (
                                <div key={cons.id} onClick={() => setSelectedCons(cons)} className="p-4 border rounded-xl mb-3 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all relative overflow-hidden">
                                    {cons.urgency === 'urgent' && <div className="absolute top-0 right-0 w-1.5 h-full bg-red-500"></div>}
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="font-black text-gray-800 text-sm">{cons.patients?.full_name}</p>
                                        <span className="text-[10px] text-gray-400 font-bold">{new Date(cons.created_at).toLocaleTimeString('ar-EG')}</span>
                                    </div>
                                    <p className="text-xs text-gray-600 font-bold line-clamp-1">{cons.consultation_text}</p>
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}
        </div>
    );
}
