import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { HeartPulse, Plus, Loader2, Calendar, ChevronRight, ChevronLeft, List, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const ITEMS_PER_PAGE = 5;

// ==========================================
// التقييم الذكي (Smart Evaluators) للحوامل
// ==========================================
const evaluatePregnancyBP = (bp: string) => {
    if (!bp || !bp.includes('/')) return null;
    const [sys, dia] = bp.split('/').map(Number);
    if (sys >= 140 || dia >= 90) return { text: 'ضغط مرتفع (احتمال تسمم حمل)', color: 'text-red-600 bg-red-50 border-red-200', alert: true };
    return { text: 'طبيعي', color: 'text-green-600 bg-green-50 border-green-200', alert: false };
};

const evaluateHbMaternity = (hb: number) => {
    if (!hb) return null;
    if (hb >= 11) return { text: 'طبيعي', color: 'text-green-600' };
    if (hb >= 10) return { text: 'أنيميا بسيطة', color: 'text-yellow-600' };
    return { text: 'أنيميا شديدة', color: 'text-red-600' };
};

export default function PregnancyLogs({ patientId }: { patientId: string }) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // UI States
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const [formData, setFormData] = useState({
        lmp_date: '', blood_pressure: '', fetal_heart_rate: '', weight: '', hemoglobin: '', urine_test: 'سلبي (-)', notes: ''
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
        
        // حساب موعد الولادة المتوقع (EDD) بناءً على قاعدة نايجيل
        let edd = null;
        if (formData.lmp_date) {
            const lmp = new Date(formData.lmp_date);
            lmp.setDate(lmp.getDate() + 7);
            lmp.setMonth(lmp.getMonth() + 9);
            edd = lmp.toISOString().split('T')[0];
        }

        try {
            const { error } = await supabase.from('health_logs_pregnancy').insert({
                mother_id: patientId,
                lmp_date: formData.lmp_date || null,
                expected_delivery_date: edd,
                blood_pressure: formData.blood_pressure,
                fetal_heart_rate: formData.fetal_heart_rate || null,
                weight: formData.weight || null,
                hemoglobin: formData.hemoglobin || null,
                urine_test: formData.urine_test,
                notes: formData.notes
            });
            if (error) throw error;
            toast.success('تم تسجيل الزيارة بنجاح');
            setShowForm(false);
            setFormData({ lmp_date: '', blood_pressure: '', fetal_heart_rate: '', weight: '', hemoglobin: '', urine_test: 'سلبي (-)', notes: '' });
            fetchLogs();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const totalPages = Math.ceil(logs.length / ITEMS_PER_PAGE);
    const currentLogs = logs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const chartData = [...logs].reverse().filter(l => l.blood_pressure).map(log => {
        const [sys, dia] = log.blood_pressure.split('/').map(Number);
        return {
            date: new Date(log.visit_timestamp).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
            انقباضي: sys,
            انبساطي: dia
        };
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-[2rem] shadow-sm border border-pink-100">
                <h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><HeartPulse className="text-pink-500"/> متابعة الحمل</h2>
                <button onClick={() => setShowForm(!showForm)} className="bg-pink-500 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-pink-600 transition-all flex items-center gap-2 shadow-md">
                    {showForm ? <List size={18} /> : <Plus size={18} />}
                    {showForm ? 'السجل' : 'زيارة جديدة'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2rem] shadow-sm border border-pink-100 animate-in slide-in-from-top-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">أول يوم لآخر دورة (LMP)</label>
                            <input type="date" value={formData.lmp_date} onChange={e => setFormData({...formData, lmp_date: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-pink-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">الضغط (مثال: 120/80)</label>
                            <input type="text" dir="ltr" value={formData.blood_pressure} onChange={e => setFormData({...formData, blood_pressure: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-pink-500 outline-none text-right" placeholder="120/80" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">نبض الجنين (FHR)</label>
                            <input type="number" value={formData.fetal_heart_rate} onChange={e => setFormData({...formData, fetal_heart_rate: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-pink-500 outline-none" placeholder="bpm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">الوزن (كجم)</label>
                            <input type="number" step="0.1" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-pink-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">الهيموجلوبين (Hb)</label>
                            <input type="number" step="0.1" value={formData.hemoglobin} onChange={e => setFormData({...formData, hemoglobin: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-pink-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">زلال البول (Proteinuria)</label>
                            <select value={formData.urine_test} onChange={e => setFormData({...formData, urine_test: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-pink-500 outline-none">
                                <option value="سلبي (-)">سلبي (-)</option>
                                <option value="أثر (Trace)">أثر (Trace)</option>
                                <option value="+1">+1</option>
                                <option value="+2">+2 (تحذير)</option>
                                <option value="+3">+3 (خطر)</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 mb-1">الملاحظات (شكوى، أدوية، الخ)</label>
                            <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-pink-500 outline-none min-h-[80px]"></textarea>
                        </div>
                    </div>
                    <button type="submit" disabled={submitting} className="mt-4 w-full bg-pink-500 text-white py-3 rounded-xl font-black hover:bg-pink-600 transition-all flex items-center justify-center gap-2">
                        {submitting ? <Loader2 className="animate-spin" /> : 'تسجيل الزيارة'}
                    </button>
                </form>
            )}

            {!showForm && (
                <div className="space-y-6 animate-in fade-in">
                    {loading ? (
                        <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-pink-500"/></div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-[2rem] border border-dashed border-gray-200">
                            <HeartPulse className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="font-bold text-gray-500">لا توجد زيارات مسجلة.</p>
                        </div>
                    ) : (
                        <>
                            {/* منحنى الضغط لاكتشاف تسمم الحمل مبكراً */}
                            {chartData.length > 1 && (
                                <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100">
                                    <h3 className="font-black text-gray-700 text-sm mb-4">متابعة ضغط الدم (لتجنب Preeclampsia)</h3>
                                    <div className="h-[200px] w-full" dir="ltr">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#888'}} axisLine={false} tickLine={false} />
                                                <YAxis domain={['auto', 'auto']} tick={{fontSize: 10, fill: '#888'}} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }} />
                                                <ReferenceLine y={140} stroke="#ef4444" strokeDasharray="3 3" label={{position: 'insideTopLeft', value: 'خطر', fill: '#ef4444', fontSize: 10}}/>
                                                <Line type="monotone" dataKey="انقباضي" stroke="#f43f5e" strokeWidth={3} dot={{r: 4}} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* قائمة السجلات */}
                            <div className="space-y-4">
                                {currentLogs.map((log) => {
                                    const bpEval = evaluatePregnancyBP(log.blood_pressure);
                                    const hbEval = evaluateHbMaternity(log.hemoglobin);
                                    const urineWarn = log.urine_test?.includes('+');

                                    return (
                                        <div key={log.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                                            {bpEval?.alert && <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>}
                                            
                                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-50">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-pink-50 p-2 rounded-xl"><Calendar className="text-pink-600 w-4 h-4"/></div>
                                                    <div>
                                                        <p className="font-black text-gray-800 text-sm">{new Date(log.visit_timestamp).toLocaleDateString('ar-EG')}</p>
                                                        {log.expected_delivery_date && <p className="text-[10px] text-gray-500 font-bold mt-0.5">موعد الولادة المتوقع: {new Date(log.expected_delivery_date).toLocaleDateString('ar-EG')}</p>}
                                                    </div>
                                                </div>
                                                {bpEval?.alert && <AlertTriangle className="text-red-500 w-5 h-5 animate-pulse" />}
                                            </div>
                                            
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                                <div className={`p-3 rounded-2xl border ${bpEval?.color || 'bg-gray-50 border-transparent'}`}>
                                                    <p className="text-[10px] font-bold text-gray-500 mb-1">الضغط</p>
                                                    <p className="font-black text-lg text-gray-800" dir="ltr">{log.blood_pressure || '--'}</p>
                                                </div>
                                                
                                                <div className="bg-gray-50 p-3 rounded-2xl border border-transparent">
                                                    <p className="text-[10px] font-bold text-gray-500 mb-1">نبض الجنين</p>
                                                    <p className="font-black text-lg text-gray-800">{log.fetal_heart_rate ? `${log.fetal_heart_rate} bpm` : '--'}</p>
                                                </div>

                                                <div className={`p-3 rounded-2xl border ${urineWarn ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-transparent'}`}>
                                                    <p className="text-[10px] font-bold text-gray-500 mb-1">زلال البول</p>
                                                    <p className={`font-black text-lg ${urineWarn ? 'text-red-600' : 'text-gray-800'}`}>{log.urine_test || '--'}</p>
                                                </div>

                                                <div className="bg-gray-50 p-3 rounded-2xl border border-transparent">
                                                    <p className="text-[10px] font-bold text-gray-500 mb-1">Hb (الأنيميا)</p>
                                                    <p className="font-black text-lg text-gray-800">{log.hemoglobin || '--'}</p>
                                                    {hbEval && <p className={`text-[9px] font-bold mt-1 ${hbEval.color}`}>{hbEval.text}</p>}
                                                </div>

                                                <div className="bg-gray-50 p-3 rounded-2xl border border-transparent">
                                                    <p className="text-[10px] font-bold text-gray-500 mb-1">الوزن</p>
                                                    <p className="font-black text-lg text-gray-800">{log.weight ? `${log.weight} kg` : '--'}</p>
                                                </div>
                                            </div>
                                            
                                            {log.notes && (
                                                <div className="mt-3 bg-gray-50/80 p-3 rounded-xl border border-gray-100 text-xs font-bold text-gray-600">
                                                    {log.notes}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center justify-between bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border text-gray-600 hover:bg-gray-50 disabled:opacity-30">
                                        <ChevronRight size={16} />
                                    </button>
                                    <span className="text-sm font-bold text-gray-600">{currentPage} / {totalPages}</span>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border text-gray-600 hover:bg-gray-50 disabled:opacity-30">
                                        <ChevronLeft size={16} />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
