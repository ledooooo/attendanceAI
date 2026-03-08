import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient';
import toast from 'react-hot-toast';
import { Activity, Plus, Loader2 } from 'lucide-react';

export default function ChronicLogs({ patientId }: { patientId: string }) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        systolic_bp: '', diastolic_bp: '', blood_sugar: '', sugar_type: 'عشوائي', hba1c: '', current_weight: '', notes: ''
    });

    useEffect(() => { if (patientId) fetchLogs(); }, [patientId]);

    const fetchLogs = async () => {
        setLoading(true);
        const { data } = await supabase.from('health_logs_chronic').select('*').eq('patient_id', patientId).order('log_timestamp', { ascending: false });
        if (data) setLogs(data);
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const payload = {
            patient_id: patientId,
            systolic_bp: formData.systolic_bp ? Number(formData.systolic_bp) : null,
            diastolic_bp: formData.diastolic_bp ? Number(formData.diastolic_bp) : null,
            blood_sugar: formData.blood_sugar ? Number(formData.blood_sugar) : null,
            sugar_type: formData.sugar_type,
            hba1c: formData.hba1c ? Number(formData.hba1c) : null,
            current_weight: formData.current_weight ? Number(formData.current_weight) : null,
            notes: formData.notes
        };
        const { error } = await supabase.from('health_logs_chronic').insert(payload);
        if (error) toast.error('حدث خطأ');
        else { toast.success('تم التسجيل بنجاح'); setShowForm(false); fetchLogs(); }
        setSubmitting(false);
    };

    return (
        <div className="animate-in fade-in space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-black text-rose-600 flex items-center gap-2"><Activity /> سجل الأمراض المزمنة</h2>
                <button onClick={() => setShowForm(!showForm)} className="bg-rose-600 text-white px-3 py-1.5 rounded-xl font-bold text-sm flex items-center gap-1"><Plus size={16}/> قياس جديد</button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl shadow-sm border border-rose-100 mb-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-xs font-bold">
                        <div><label className="block mb-1 text-gray-600">ضغط انقباضي</label><input type="number" value={formData.systolic_bp} onChange={e => setFormData({...formData, systolic_bp: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg" placeholder="120" dir="ltr"/></div>
                        <div><label className="block mb-1 text-gray-600">ضغط انبساطي</label><input type="number" value={formData.diastolic_bp} onChange={e => setFormData({...formData, diastolic_bp: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg" placeholder="80" dir="ltr"/></div>
                        <div><label className="block mb-1 text-gray-600">مستوى السكر</label><input type="number" value={formData.blood_sugar} onChange={e => setFormData({...formData, blood_sugar: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg" placeholder="100" dir="ltr"/></div>
                        <div>
                            <label className="block mb-1 text-gray-600">نوع السكر</label>
                            <select value={formData.sugar_type} onChange={e => setFormData({...formData, sugar_type: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg">
                                <option>عشوائي</option><option>صائم</option><option>فاطر</option>
                            </select>
                        </div>
                        <div><label className="block mb-1 text-gray-600">التراكمي HbA1c</label><input type="number" step="0.1" value={formData.hba1c} onChange={e => setFormData({...formData, hba1c: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg" placeholder="5.5" dir="ltr"/></div>
                        <div><label className="block mb-1 text-gray-600">الوزن الحالي (كجم)</label><input type="number" value={formData.current_weight} onChange={e => setFormData({...formData, current_weight: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg" placeholder="75" dir="ltr"/></div>
                    </div>
                    <button disabled={submitting} className="w-full py-2 bg-rose-600 text-white rounded-lg font-bold flex justify-center items-center">{submitting ? <Loader2 className="animate-spin w-4 h-4"/> : 'حفظ القياسات'}</button>
                </form>
            )}

            {loading ? <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-rose-500"/></div> : 
             logs.map(log => (
                <div key={log.id} className="bg-white p-4 rounded-xl border border-gray-100 flex flex-wrap gap-4 items-center justify-between">
                    <div className="text-xs font-bold text-gray-500 w-full md:w-auto mb-2 md:mb-0 border-b md:border-b-0 pb-2 md:pb-0">{new Date(log.log_timestamp).toLocaleDateString('ar-EG')} - {new Date(log.log_timestamp).toLocaleTimeString('ar-EG')}</div>
                    <div className="flex gap-4">
                        {(log.systolic_bp && log.diastolic_bp) && <div className="bg-rose-50 text-rose-700 px-3 py-1 rounded-lg text-xs font-black">ضغط: {log.systolic_bp}/{log.diastolic_bp}</div>}
                        {log.blood_sugar && <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-xs font-black">سكر {log.sugar_type}: {log.blood_sugar}</div>}
                        {log.current_weight && <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg text-xs font-black">وزن: {log.current_weight} كجم</div>}
                    </div>
                </div>
            ))}
        </div>
    );
}
