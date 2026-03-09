import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { MessageSquare, Send, Loader2, HelpCircle } from 'lucide-react';

export default function PatientComplaints({ patientId }: { patientId: string }) {
    const [complaints, setComplaints] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({ type: 'complaint', content: '', name: '', phone: '' });

    useEffect(() => { if (patientId) fetchComplaints(); }, [patientId]);

    const fetchComplaints = async () => {
        setLoading(true);
        const { data } = await supabase.from('patient_complaints').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
        if (data) setComplaints(data);
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const { error } = await supabase.from('patient_complaints').insert({ patient_id: patientId, ...formData });
        if (!error) {
            toast.success('تم الإرسال بنجاح، شكراً لتواصلك معنا');
            setFormData({ type: 'complaint', content: '', name: '', phone: '' });
            fetchComplaints();
        } else {
            toast.error('حدث خطأ أثناء الإرسال');
        }
        setSubmitting(false);
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* صندوق إرسال رسالة جديدة */}
            <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-indigo-50">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                        <MessageSquare size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-800">تواصل مع الإدارة</h2>
                        <p className="text-xs font-bold text-gray-500 mt-1">نحن نستمع إليك دائماً لتقديم خدمة أفضل</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 text-sm font-bold">
                    {/* أزرار اختيار نوع الرسالة */}
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setFormData({...formData, type: 'complaint'})} className={`flex-1 py-3 rounded-xl font-black text-sm transition-all duration-200 border ${formData.type === 'complaint' ? 'bg-red-50 text-red-600 border-red-200 shadow-sm' : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'}`}>
                            شكوى
                        </button>
                        <button type="button" onClick={() => setFormData({...formData, type: 'suggestion'})} className={`flex-1 py-3 rounded-xl font-black text-sm transition-all duration-200 border ${formData.type === 'suggestion' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm' : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'}`}>
                            مقترح تطويري
                        </button>
                    </div>

                    <div>
                        <textarea required value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} placeholder="اكتب تفاصيل رسالتك هنا بوضوح..." className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none leading-relaxed" rows={4} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="الاسم (اختياري)" className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                        <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="رقم الهاتف (للتواصل معك إن لزم الأمر)" className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-right" dir="ltr" />
                    </div>

                    <button type="submit" disabled={submitting || !formData.content.trim()} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-xl font-black flex justify-center items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-200 mt-2">
                        {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : <><Send size={18} /> إرسال الرسالة للإدارة</>}
                    </button>
                </form>
            </div>

            {/* قائمة الرسائل السابقة */}
            <div className="mt-8">
                <h3 className="font-black text-gray-800 mb-4 px-2 text-lg">رسائلي السابقة</h3>
                
                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
                ) : complaints.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-[2rem] border border-dashed border-gray-200 shadow-sm">
                        <HelpCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-500 font-bold text-sm">لم تقم بإرسال أي شكاوى أو مقترحات بعد.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {complaints.map(c => (
                            <div key={c.id} className="bg-white p-5 rounded-[1.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`text-[10px] px-3 py-1.5 rounded-lg font-black border ${c.type === 'complaint' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                        {c.type === 'complaint' ? 'شكوى' : 'مقترح'}
                                    </span>
                                    <span className="text-[11px] text-gray-400 font-bold bg-gray-50 px-2 py-1 rounded-md">
                                        {new Date(c.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-700 font-bold leading-relaxed mb-1">{c.content}</p>
                                
                                {c.admin_reply && (
                                    <div className="mt-4 p-4 bg-gradient-to-l from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 relative">
                                        <div className="absolute top-0 right-4 -mt-2 w-4 h-4 bg-indigo-50 border-t border-r border-indigo-100 transform rotate-[-45deg]"></div>
                                        <span className="text-[10px] font-black text-indigo-500 flex items-center gap-1 mb-1.5"><MessageSquare size={12}/> رد الإدارة:</span>
                                        <p className="text-xs text-indigo-900 font-black leading-relaxed">{c.admin_reply}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
