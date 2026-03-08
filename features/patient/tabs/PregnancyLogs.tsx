import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { HeartPulse, Plus, Loader2 } from 'lucide-react';

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
        
        // حساب تاريخ الولادة المتوقع (LMP + 280 days)
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
        if (!error) { toast.success('تم تسجيل زيارة المتابعة'); setShowForm(false); fetchLogs(); }
        setSubmitting(false);
    };

    return (
        <div className="animate-in fade-in space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-black text-pink-600 flex items-center gap-2"><HeartPulse /> متابعة الحمل</h2>
                <button onClick={() => setShowForm(!showForm)} className="bg-pink-600 text-white px-3 py-1.5 rounded-xl font-bold text-sm flex items-center gap-1"><Plus size={16}/> تسجيل زيارة</button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl shadow-sm border border-pink-100 mb-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 text-xs font-bold">
                        <div><label className="block mb-1 text-gray-600">تاريخ آخر دورة (LMP)</label><input type="date" value={formData.lmp_date} onChange={e => setFormData({...formData, lmp_date: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg"/></div>
                        <div><label className="block mb-1 text-gray-600">الضغط</label><input type="text" value={formData.blood_pressure} onChange={e => setFormData({...formData, blood_pressure: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg" placeholder="120/80" dir="ltr"/></div>
                        <div><label className="block mb-1 text-gray-600">نبض الجنين (FHR)</label><input type="number" value={formData.fetal_heart_rate} onChange={e => setFormData({...formData, fetal_heart_rate: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg" placeholder="140" dir="ltr"/></div>
                        <div><label className="block mb-1 text-gray-600">الوزن (كجم)</label><input type="number" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg" dir="ltr"/></div>
                        <div><label className="block mb-1 text-gray-600">تحليل البول (زلال/سكر)</label><input type="text" value={formData.urine_test} onChange={e => setFormData({...formData, urine_test: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg" placeholder="سليم..."/></div>
                    </div>
                    <button disabled={submitting} className="w-full py-2 bg-pink-600 text-white rounded-lg font-bold flex justify-center items-center">{submitting ? <Loader2 className="animate-spin w-4 h-4"/> : 'حفظ الزيارة'}</button>
                </form>
            )}

            {loading ? <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-pink-500"/></div> : 
             logs.map(log => (
                <div key={log.id} className="bg-white p-4 rounded-xl border border-gray-100 flex flex-col gap-2">
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-sm font-black text-gray-800">زيارة: {new Date(log.visit_timestamp).toLocaleDateString('ar-EG')}</span>
                        {log.edd_date && <span className="text-[10px] font-bold bg-pink-50 text-pink-700 px-2 py-1 rounded">الولادة المتوقعة: {log.edd_date}</span>}
                    </div>
                    <div className="flex gap-2 flex-wrap mt-1">
                        {log.blood_pressure && <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-black">الضغط: {log.blood_pressure}</span>}
                        {log.fetal_heart_rate && <span className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-black">النبض: {log.fetal_heart_rate} bpm</span>}
                        {log.weight && <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-black">الوزن: {log.weight} kg</span>}
                    </div>
                </div>
            ))}
        </div>
    );
}
