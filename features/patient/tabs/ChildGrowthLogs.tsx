import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { Baby, Plus, Loader2 } from 'lucide-react';

export default function ChildGrowthLogs({ patientId }: { patientId: string }) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        weight: '', height: '', head_circumference: '', hemoglobin: '', notes: ''
    });

    useEffect(() => { if (patientId) fetchLogs(); }, [patientId]);

    const fetchLogs = async () => {
        setLoading(true);
        const { data } = await supabase.from('health_logs_child').select('*').eq('child_id', patientId).order('log_timestamp', { ascending: false });
        if (data) setLogs(data);
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const payload = {
            child_id: patientId,
            weight: formData.weight ? Number(formData.weight) : null,
            height: formData.height ? Number(formData.height) : null,
            head_circumference: formData.head_circumference ? Number(formData.head_circumference) : null,
            hemoglobin: formData.hemoglobin ? Number(formData.hemoglobin) : null,
            notes: formData.notes
        };
        const { error } = await supabase.from('health_logs_child').insert(payload);
        if (!error) { toast.success('تم التسجيل بنجاح'); setShowForm(false); fetchLogs(); }
        setSubmitting(false);
    };

    return (
        <div className="animate-in fade-in space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-black text-sky-600 flex items-center gap-2"><Baby /> سجل نمو الطفل</h2>
                <button onClick={() => setShowForm(!showForm)} className="bg-sky-600 text-white px-3 py-1.5 rounded-xl font-bold text-sm flex items-center gap-1"><Plus size={16}/> قياس جديد</button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl shadow-sm border border-sky-100 mb-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-xs font-bold">
                        <div><label className="block mb-1 text-gray-600">الوزن (كجم)</label><input type="number" step="0.1" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg" dir="ltr"/></div>
                        <div><label className="block mb-1 text-gray-600">الطول (سم)</label><input type="number" step="0.5" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg" dir="ltr"/></div>
                        <div><label className="block mb-1 text-gray-600">محيط الرأس (سم)</label><input type="number" step="0.5" value={formData.head_circumference} onChange={e => setFormData({...formData, head_circumference: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg" dir="ltr"/></div>
                        <div><label className="block mb-1 text-gray-600">الهيموجلوبين (Hb)</label><input type="number" step="0.1" value={formData.hemoglobin} onChange={e => setFormData({...formData, hemoglobin: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg" dir="ltr"/></div>
                    </div>
                    <button disabled={submitting} className="w-full py-2 bg-sky-600 text-white rounded-lg font-bold flex justify-center items-center">{submitting ? <Loader2 className="animate-spin w-4 h-4"/> : 'حفظ القياسات'}</button>
                </form>
            )}

            {loading ? <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-sky-500"/></div> : 
             logs.map(log => (
                <div key={log.id} className="bg-white p-4 rounded-xl border border-gray-100 flex flex-wrap gap-3 items-center justify-between">
                    <div className="text-xs font-bold text-gray-500">{new Date(log.log_timestamp).toLocaleDateString('ar-EG')}</div>
                    <div className="flex gap-2 flex-wrap">
                        {log.weight && <span className="bg-sky-50 text-sky-700 px-2 py-1 rounded text-xs font-black">وزن: {log.weight} kg</span>}
                        {log.height && <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs font-black">طول: {log.height} cm</span>}
                        {log.head_circumference && <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs font-black">محيط رأس: {log.head_circumference} cm</span>}
                    </div>
                </div>
            ))}
        </div>
    );
}
