import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { HeartPulse, Plus, Loader2, Calendar, FileText } from 'lucide-react';

export default function PregnancyLogs({ patientId }: { patientId: string }) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        lmp_date: '', blood_pressure: '', fetal_heart_rate: '', weight: '', hemoglobin: '', urine_test: '', notes: ''
    });

    useEffect(() => { if (patientId) fetchLogs(); }, [patientId]);

    const fetchLogs = async () => {
        setLoading(true);
        const { data } = await supabase.from('health_logs_pregnancy').select('*').eq('mother_id', patientId).order('visit_timestamp', { ascending: false });
        if (data) setLogs(data);
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        
        let edd = null;
        if (formData.lmp_date) {
            const lmpDate = new Date(formData.lmp_date);
            lmpDate.setDate(lmpDate.getDate() + 280);
            edd = lmpDate.toISOString().split('T')[0];
        }

        const payload = {
            mother_id: patientId,
            lmp_date: formData.lmp_date || null,
            edd_date: edd,
            blood_pressure: formData.blood_pressure,
            fetal_heart_rate: formData.fetal_heart_rate ? Number(formData.fetal_heart_rate) : null,
            weight: formData.weight ? Number(formData.weight) : null,
            hemoglobin: formData.hemoglobin ? Number(formData.hemoglobin) : null,
            urine_test: formData.urine_test,
            notes: formData.notes
        };
        const { error } = await supabase.from('health_logs_pregnancy').insert(payload);
        if (!error) { 
            toast.success('تم تسجيل زيارة المتابعة بنجاح'); 
            setShowForm(false); 
            setFormData({lmp_date: '', blood_pressure: '', fetal_heart_rate: '', weight: '', hemoglobin: '', urine_test: '', notes: ''});
            fetchLogs(); 
        } else {
            toast.error('حدث خطأ أثناء التسجيل');
        }
        setSubmitting(false);
    };

    return (
        <div className="animate-in fade-in space-y-6">
            {/* الترويسة */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-pink-100">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center">
                        <HeartPulse size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-800">مفكرة متابعة الحمل</h2>
                        <p className="text-xs font-bold text-gray-500 mt-1">سجلي قياساتك في كل زيارة لمتابعة صحتك وصحة جنينك</p>
                    </div>
                </div>
                <button onClick={() => setShowForm(!showForm)} className="w-full md:w-auto bg-pink-600 hover:bg-pink-700 text-white px-5 py-2.5 rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-colors shadow-md shadow-pink-200">
                    <Plus size={18}/> تسجيل زيارة جديدة
                </button>
            </div>

            {/* نموذج الإدخال */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2rem] shadow-lg shadow-black/5 border border-pink-100 mb-6 animate-in slide-in-from-top-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6 text-sm font-bold">
                        <div>
                            <label className="block mb-1.5 text-gray-600 text-xs">تاريخ آخر دورة (LMP)</label>
                            <input type="date" value={formData.lmp_date} onChange={e => setFormData({...formData, lmp_date: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all"/>
                        </div>
                        <div>
                            <label className="block mb-1.5 text-gray-600 text-xs">ضغط الدم</label>
                            <input type="text" value={formData.blood_pressure} onChange={e => setFormData({...formData, blood_pressure: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all" placeholder="مثال: 120/80" dir="ltr"/>
                        </div>
                        <div>
                            <label className="block mb-1.5 text-gray-600 text-xs">نبض الجنين (FHR)</label>
                            <input type="number" value={formData.fetal_heart_rate} onChange={e => setFormData({...formData, fetal_heart_rate: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all" placeholder="140" dir="ltr"/>
                        </div>
                        <div>
                            <label className="block mb-1.5 text-gray-600 text-xs">الوزن الحالي (كجم)</label>
                            <input type="number" step="0.1" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all" placeholder="70" dir="ltr"/>
                        </div>
                        <div>
                            <label className="block mb-1.5 text-gray-600 text-xs">نسبة الهيموجلوبين (Hb)</label>
                            <input type="number" step="0.1" value={formData.hemoglobin} onChange={e => setFormData({...formData, hemoglobin: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all" placeholder="11.5" dir="ltr"/>
                        </div>
                        <div>
                            <label className="block mb-1.5 text-gray-600 text-xs">تحليل البول (زلال/سكر)</label>
                            <input type="text" value={formData.urine_test} onChange={e => setFormData({...formData, urine_test: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all" placeholder="سليم / يوجد زلال..."/>
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-sm hover:bg-gray-200 transition-colors">إلغاء</button>
                        <button type="submit" disabled={submitting} className="px-8 py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-colors disabled:opacity-70">
                            {submitting ? <Loader2 className="animate-spin w-5 h-5"/> : 'حفظ الزيارة'}
                        </button>
                    </div>
                </form>
            )}

            {/* قائمة السجلات */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-pink-500"/></div>
            ) : logs.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-gray-200 shadow-sm">
                    <HeartPulse className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 font-bold">لم تقومي بتسجيل أي زيارة بعد.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {logs.map(log => (
                        <div key={log.id} className="bg-white p-5 rounded-[1.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex flex-wrap justify-between items-center border-b border-gray-50 pb-3 mb-3 gap-2">
                                <div className="flex items-center gap-2 text-pink-600 font-black">
                                    <Calendar size={18} />
                                    <span>تاريخ الزيارة: {new Date(log.visit_timestamp).toLocaleDateString('ar-EG')}</span>
                                </div>
                                {log.edd_date && (
                                    <span className="text-xs font-black bg-pink-50 text-pink-700 px-3 py-1.5 rounded-lg border border-pink-100">
                                        الولادة المتوقعة: {new Date(log.edd_date).toLocaleDateString('ar-EG')}
                                    </span>
                                )}
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                                {log.blood_pressure && <span className="bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200">الضغط: <span className="font-black" dir="ltr">{log.blood_pressure}</span></span>}
                                {log.fetal_heart_rate && <span className="bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-100">النبض: <span className="font-black" dir="ltr">{log.fetal_heart_rate}</span> bpm</span>}
                                {log.weight && <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-100">الوزن: <span className="font-black" dir="ltr">{log.weight}</span> كجم</span>}
                                {log.hemoglobin && <span className="bg-red-50 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-100">الهيموجلوبين: <span className="font-black" dir="ltr">{log.hemoglobin}</span></span>}
                                {log.urine_test && <span className="bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-yellow-100">البول: <span className="font-black">{log.urine_test}</span></span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
