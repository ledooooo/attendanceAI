import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { Activity, Plus, Loader2, Calendar } from 'lucide-react';

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
        if (error) {
            toast.error('حدث خطأ أثناء التسجيل');
        } else { 
            toast.success('تم تسجيل القياسات بنجاح'); 
            setShowForm(false); 
            setFormData({systolic_bp: '', diastolic_bp: '', blood_sugar: '', sugar_type: 'عشوائي', hba1c: '', current_weight: '', notes: ''});
            fetchLogs(); 
        }
        setSubmitting(false);
    };

    return (
        <div className="animate-in fade-in space-y-6">
            {/* الترويسة */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-rose-100">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
                        <Activity size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-800">مفكرة الأمراض المزمنة</h2>
                        <p className="text-xs font-bold text-gray-500 mt-1">سجل قياسات الضغط والسكر دورياً لتتابع حالتك الصحية</p>
                    </div>
                </div>
                <button onClick={() => setShowForm(!showForm)} className="w-full md:w-auto bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-colors shadow-md shadow-rose-200">
                    <Plus size={18}/> قياس جديد
                </button>
            </div>

            {/* نموذج الإدخال */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2rem] shadow-lg shadow-black/5 border border-rose-100 mb-6 animate-in slide-in-from-top-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6 text-sm font-bold">
                        <div>
                            <label className="block mb-1.5 text-gray-600 text-xs">ضغط انقباضي (العالي)</label>
                            <input type="number" value={formData.systolic_bp} onChange={e => setFormData({...formData, systolic_bp: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all" placeholder="120" dir="ltr"/>
                        </div>
                        <div>
                            <label className="block mb-1.5 text-gray-600 text-xs">ضغط انبساطي (الواطي)</label>
                            <input type="number" value={formData.diastolic_bp} onChange={e => setFormData({...formData, diastolic_bp: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all" placeholder="80" dir="ltr"/>
                        </div>
                        <div>
                            <label className="block mb-1.5 text-gray-600 text-xs">مستوى السكر</label>
                            <input type="number" value={formData.blood_sugar} onChange={e => setFormData({...formData, blood_sugar: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all" placeholder="100" dir="ltr"/>
                        </div>
                        <div>
                            <label className="block mb-1.5 text-gray-600 text-xs">نوع فحص السكر</label>
                            <select value={formData.sugar_type} onChange={e => setFormData({...formData, sugar_type: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all">
                                <option>عشوائي</option><option>صائم</option><option>فاطر</option>
                            </select>
                        </div>
                        <div>
                            <label className="block mb-1.5 text-gray-600 text-xs">التراكمي HbA1c (اختياري)</label>
                            <input type="number" step="0.1" value={formData.hba1c} onChange={e => setFormData({...formData, hba1c: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all" placeholder="5.5" dir="ltr"/>
                        </div>
                        <div>
                            <label className="block mb-1.5 text-gray-600 text-xs">الوزن الحالي (كجم)</label>
                            <input type="number" value={formData.current_weight} onChange={e => setFormData({...formData, current_weight: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all" placeholder="75" dir="ltr"/>
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-sm hover:bg-gray-200 transition-colors">إلغاء</button>
                        <button type="submit" disabled={submitting} className="px-8 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-colors disabled:opacity-70">
                            {submitting ? <Loader2 className="animate-spin w-5 h-5"/> : 'حفظ القياسات'}
                        </button>
                    </div>
                </form>
            )}

            {/* قائمة السجلات */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-rose-500"/></div>
            ) : logs.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-gray-200 shadow-sm">
                    <Activity className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 font-bold">لم تقم بتسجيل أي قياسات سابقة.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {logs.map(log => (
                        <div key={log.id} className="bg-white p-5 rounded-[1.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-gray-500 font-bold text-sm bg-gray-50 px-4 py-2 rounded-xl">
                                <Calendar size={16} className="text-gray-400" />
                                <span>{new Date(log.log_timestamp).toLocaleDateString('ar-EG')}</span>
                                <span className="text-xs opacity-70">({new Date(log.log_timestamp).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})})</span>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                                {(log.systolic_bp && log.diastolic_bp) && (
                                    <div className="bg-rose-50 text-rose-700 px-4 py-2 rounded-xl text-xs font-bold border border-rose-100">
                                        ضغط: <span className="font-black text-sm" dir="ltr">{log.systolic_bp}/{log.diastolic_bp}</span>
                                    </div>
                                )}
                                {log.blood_sugar && (
                                    <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-xs font-bold border border-indigo-100">
                                        سكر ({log.sugar_type}): <span className="font-black text-sm" dir="ltr">{log.blood_sugar}</span>
                                    </div>
                                )}
                                {log.hba1c && (
                                    <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl text-xs font-bold border border-amber-100">
                                        تراكمي: <span className="font-black text-sm" dir="ltr">{log.hba1c}</span>
                                    </div>
                                )}
                                {log.current_weight && (
                                    <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-xs font-bold border border-emerald-100">
                                        وزن: <span className="font-black text-sm" dir="ltr">{log.current_weight}</span> كجم
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
