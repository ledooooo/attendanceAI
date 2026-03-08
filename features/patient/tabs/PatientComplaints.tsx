import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { MessageSquare, Send, Loader2 } from 'lucide-react';

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
        }
        setSubmitting(false);
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-black text-indigo-700 mb-4 flex items-center gap-2"><MessageSquare /> تواصل مع الإدارة</h2>
                <form onSubmit={handleSubmit} className="space-y-4 text-sm font-bold">
                    <div className="flex gap-4">
                        <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="type" checked={formData.type === 'complaint'} onChange={() => setFormData({...formData, type: 'complaint'})} /> شكوى</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="type" checked={formData.type === 'suggestion'} onChange={() => setFormData({...formData, type: 'suggestion'})} /> مقترح</label>
                    </div>
                    <textarea required value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} placeholder="اكتب رسالتك هنا بوضوح..." className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-indigo-500" rows={4} />
                    <div className="grid grid-cols-2 gap-4">
                        <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="الاسم (اختياري)" className="p-3 bg-gray-50 border rounded-xl outline-none" />
                        <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="الهاتف (اختياري)" className="p-3 bg-gray-50 border rounded-xl outline-none" dir="ltr" />
                    </div>
                    <button type="submit" disabled={submitting || !formData.content} className="bg-indigo-600 text-white px-6 py-3 rounded-xl w-full flex justify-center items-center gap-2 disabled:opacity-50">
                        {submitting ? <Loader2 className="animate-spin" /> : <><Send size={18} /> إرسال</>}
                    </button>
                </form>
            </div>

            {complaints.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-bold text-gray-700 mb-2">رسائلي السابقة</h3>
                    {complaints.map(c => (
                        <div key={c.id} className="bg-white p-4 rounded-xl border border-gray-100">
                            <div className="flex justify-between items-center mb-2">
                                <span className={`text-[10px] px-2 py-1 rounded-md font-black ${c.type === 'complaint' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{c.type === 'complaint' ? 'شكوى' : 'مقترح'}</span>
                                <span className="text-[10px] text-gray-400 font-bold">{new Date(c.created_at).toLocaleDateString('ar-EG')}</span>
                            </div>
                            <p className="text-sm text-gray-700 font-medium">{c.content}</p>
                            {c.admin_reply && (
                                <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                                    <span className="text-[10px] font-black text-indigo-800 block mb-1">رد الإدارة:</span>
                                    <p className="text-xs text-indigo-900 font-bold">{c.admin_reply}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
