import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient';
import toast from 'react-hot-toast';
import { Calendar, Clock, Plus, Loader2, Phone, FileText } from 'lucide-react';

export default function PatientAppointments({ patientId }: { patientId: string }) {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        clinic_name: 'عيادة طب الأسرة',
        visit_reason: '',
        appointment_date: '',
        appointment_time: '',
        phone: ''
    });

    const clinics = ['عيادة طب الأسرة', 'عيادة الأطفال', 'عيادة الأسنان', 'عيادة النساء والتوليد', 'الطوارئ'];

    useEffect(() => {
        if (patientId) fetchAppointments();
    }, [patientId]);

    const fetchAppointments = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('patient_appointments')
            .select('*')
            .eq('patient_id', patientId)
            .order('appointment_date', { ascending: false });
        if (!error && data) setAppointments(data);
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const { error } = await supabase.from('patient_appointments').insert({
            patient_id: patientId,
            ...formData
        });
        
        if (error) {
            toast.error('حدث خطأ أثناء حجز الموعد');
        } else {
            toast.success('تم حجز الموعد بنجاح، بانتظار التأكيد');
            setShowForm(false);
            fetchAppointments();
        }
        setSubmitting(false);
    };

    return (
        <div className="animate-in fade-in space-y-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                    <Calendar className="text-blue-600" /> مواعيدي
                </h2>
                <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1 hover:bg-blue-700 transition">
                    <Plus size={16} /> حجز موعد
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4 mb-6">
                    <h3 className="font-bold text-gray-700 border-b pb-2 mb-4">تفاصيل الموعد الجديد</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-bold">
                        <div>
                            <label className="block text-gray-600 mb-1">العيادة</label>
                            <select value={formData.clinic_name} onChange={e => setFormData({...formData, clinic_name: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-blue-500">
                                {clinics.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-600 mb-1">تاريخ الموعد</label>
                            <input type="date" required value={formData.appointment_date} onChange={e => setFormData({...formData, appointment_date: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-blue-500" />
                        </div>
                        <div>
                            <label className="block text-gray-600 mb-1">الوقت المفضل</label>
                            <input type="time" required value={formData.appointment_time} onChange={e => setFormData({...formData, appointment_time: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-blue-500" />
                        </div>
                        <div>
                            <label className="block text-gray-600 mb-1">رقم التواصل</label>
                            <input type="tel" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-blue-500" dir="ltr" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-gray-600 mb-1">سبب الزيارة (اختياري)</label>
                            <textarea value={formData.visit_reason} onChange={e => setFormData({...formData, visit_reason: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:border-blue-500" rows={2} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold">إلغاء</button>
                        <button type="submit" disabled={submitting} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2">
                            {submitting ? <Loader2 size={16} className="animate-spin" /> : 'تأكيد الحجز'}
                        </button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>
            ) : appointments.length === 0 ? (
                <div className="text-center py-10 text-gray-400 font-bold bg-white rounded-2xl border border-dashed">لا توجد مواعيد سابقة.</div>
            ) : (
                <div className="grid gap-3">
                    {appointments.map(app => (
                        <div key={app.id} className="bg-white p-4 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h4 className="font-black text-gray-800 text-sm flex items-center gap-1"><Clock size={16} className="text-blue-500"/> {app.clinic_name}</h4>
                                <p className="text-xs text-gray-500 font-bold mt-1">{app.appointment_date} | {app.appointment_time}</p>
                                {app.visit_reason && <p className="text-xs text-gray-400 mt-2"><FileText size={12} className="inline mr-1"/>{app.visit_reason}</p>}
                            </div>
                            <span className={`px-3 py-1 text-[10px] font-black rounded-lg ${app.status === 'pending' ? 'bg-yellow-50 text-yellow-600' : app.status === 'confirmed' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                                {app.status === 'pending' ? 'قيد المراجعة' : app.status === 'confirmed' ? 'تم التأكيد' : 'مكتمل'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
