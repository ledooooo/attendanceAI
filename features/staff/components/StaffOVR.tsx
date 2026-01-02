import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { AlertTriangle, Send, FileText, MapPin, Clock, Calendar } from 'lucide-react';

export default function StaffOVR({ employee }: { employee: Employee }) {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        incident_date: new Date().toISOString().split('T')[0],
        incident_time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        location: '',
        description: '',
        action_taken: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { error } = await supabase.from('ovr_reports').insert({
            reporter_id: employee.employee_id,
            reporter_name: employee.name,
            ...form,
            status: 'new'
        });

        if (!error) {
            alert('تم إرسال تقرير OVR بنجاح وسيتم مراجعته من قبل الجودة.');
            setForm({ ...form, location: '', description: '', action_taken: '' });
        } else {
            alert('حدث خطأ: ' + error.message);
        }
        setLoading(false);
    };

    return (
        <div className="bg-white p-6 rounded-[30px] border border-red-100 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-3 mb-6 border-b border-red-50 pb-4">
                <div className="bg-red-50 p-3 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-gray-800">إبلاغ عن واقعة (OVR)</h3>
                    <p className="text-xs text-gray-500 font-bold">تقرير سري يذهب مباشرة لمسؤول الجودة</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3"/> تاريخ الواقعة</label>
                        <input type="date" required className="w-full p-3 rounded-xl border bg-gray-50 font-bold text-sm"
                            value={form.incident_date} onChange={e => setForm({...form, incident_date: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Clock className="w-3 h-3"/> وقت الواقعة</label>
                        <input type="time" required className="w-full p-3 rounded-xl border bg-gray-50 font-bold text-sm"
                            value={form.incident_time} onChange={e => setForm({...form, incident_time: e.target.value})} />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3"/> مكان الواقعة</label>
                    <input type="text" required placeholder="مثال: الاستقبال، غرفة 3..." className="w-full p-3 rounded-xl border bg-gray-50 font-bold text-sm"
                        value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><FileText className="w-3 h-3"/> وصف الواقعة</label>
                    <textarea required placeholder="اشرح ما حدث بالتفصيل..." className="w-full p-3 rounded-xl border bg-gray-50 font-medium text-sm h-32"
                        value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">الإجراء الفوري المتخذ (إن وجد)</label>
                    <input type="text" placeholder="ماذا فعلت فور حدوث الواقعة؟" className="w-full p-3 rounded-xl border bg-gray-50 font-medium text-sm"
                        value={form.action_taken} onChange={e => setForm({...form, action_taken: e.target.value})} />
                </div>

                <button type="submit" disabled={loading} className="w-full py-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 flex justify-center items-center gap-2">
                    {loading ? 'جاري الإرسال...' : <><Send className="w-5 h-5 rtl:rotate-180"/> إرسال التقرير</>}
                </button>
            </form>
        </div>
    );
}
