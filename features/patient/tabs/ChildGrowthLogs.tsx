import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { Baby, Plus, Loader2, Calendar, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function ChildGrowthLogs({ patientId }: { patientId: string }) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [activeChart, setActiveChart] = useState<'weight' | 'height'>('weight');

    const [formData, setFormData] = useState({
        weight: '', height: '', head_circumference: '', hemoglobin: '', notes: ''
    });

    useEffect(() => { if (patientId) fetchLogs(); }, [patientId]);

    const fetchLogs = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('health_logs_child')
            .select('*')
            .eq('child_id', patientId)
            .order('log_timestamp', { ascending: false });
        
        if (data) setLogs(data);
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!patientId) {
            toast.error("معرف الطفل غير موجود");
            return;
        }

        setSubmitting(true);

        const payload = {
            child_id: patientId,
            weight: formData.weight ? Number(formData.weight) : null,
            height: formData.height ? Number(formData.height) : null,
            head_circumference: formData.head_circumference ? Number(formData.head_circumference) : null,
            hemoglobin: formData.hemoglobin ? Number(formData.hemoglobin) : null,
            notes: formData.notes
        };

        // ✅ إصلاح الخطأ 409 بإزالة الأقواس المربعة
        const { error } = await supabase
            .from('health_logs_child')
            .insert(payload);

        if (error) {
            console.error("Insert Error:", error);
            toast.error(error.message || 'حدث خطأ أثناء حفظ البيانات');
        } else {
            toast.success('تم تسجيل قياسات الطفل بنجاح');
            setShowForm(false);
            setFormData({ weight: '', height: '', head_circumference: '', hemoglobin: '', notes: '' });
            fetchLogs();
        }

        setSubmitting(false);
    };

    // 🌟 تحضير البيانات للرسم البياني (تصاعدياً حسب التاريخ)
    const chartData = useMemo(() => {
        if (!logs || logs.length === 0) return [];
        return [...logs].reverse().map(log => ({
            date: new Date(log.log_timestamp).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
            weight: log.weight,
            height: log.height
        }));
    }, [logs]);

    return (
        <div className="animate-in fade-in space-y-6">
            
            {/* الترويسة */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-sky-100">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center">
                        <Baby size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-800">مفكرة نمو الطفل</h2>
                        <p className="text-xs font-bold text-gray-500 mt-1">تابعي مراحل نمو طفلك الجسدية واحتفظي بسجل دقيق</p>
                    </div>
                </div>
                <button onClick={() => setShowForm(!showForm)} className="w-full md:w-auto bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-colors shadow-md shadow-sky-200">
                    <Plus size={18}/> إضافة قياس جديد
                </button>
            </div>

            {/* نموذج الإدخال */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2rem] shadow-lg shadow-black/5 border border-sky-100 mb-6 animate-in slide-in-from-top-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6 text-sm font-bold">
                        <div>
                            <label className="block mb-1.5 text-gray-600 text-xs">الوزن (كجم)</label>
                            <input type="number" step="0.1" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition-all" placeholder="مثال: 5.2" dir="ltr"/>
                        </div>
                        <div>
                            <label className="block mb-1.5 text-gray-600 text-xs">الطول (سم)</label>
                            <input type="number" step="0.5" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition-all" placeholder="مثال: 60" dir="ltr"/>
                        </div>
                        <div>
                            <label className="block mb-1.5 text-gray-600 text-xs">محيط الرأس (سم)</label>
                            <input type="number" step="0.5" value={formData.head_circumference} onChange={e => setFormData({...formData, head_circumference: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition-all" placeholder="مثال: 38" dir="ltr"/>
                        </div>
                        <div>
                            <label className="block mb-1.5 text-gray-600 text-xs">الهيموجلوبين (Hb)</label>
                            <input type="number" step="0.1" value={formData.hemoglobin} onChange={e => setFormData({...formData, hemoglobin: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition-all" placeholder="مثال: 11" dir="ltr"/>
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-sm hover:bg-gray-200 transition-colors">إلغاء</button>
                        <button type="submit" disabled={submitting} className="px-8 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-colors disabled:opacity-70">
                            {submitting ? <Loader2 className="animate-spin w-5 h-5"/> : 'حفظ القياسات'}
                        </button>
                    </div>
                </form>
            )}

            {/* 🌟 منحنى النمو (رسم بياني) */}
            {logs.length > 1 && !loading && (
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-sky-100">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-gray-800 flex items-center gap-2"><TrendingUp size={20} className="text-sky-500"/> منحنى التطور</h3>
                        <div className="flex gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
                            <button onClick={() => setActiveChart('weight')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeChart === 'weight' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>الوزن</button>
                            <button onClick={() => setActiveChart('height')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeChart === 'height' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>الطول</button>
                        </div>
                    </div>
                    
                    <div className="h-64 w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#6b7280'}} tickLine={false} axisLine={false} />
                                <YAxis tick={{fontSize: 10, fill: '#6b7280'}} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                                    formatter={(value: any) => [value, activeChart === 'weight' ? 'كجم' : 'سم']}
                                    labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
                                />
                                {activeChart === 'weight' ? (
                                    <Line type="monotone" dataKey="weight" name="الوزن" stroke="#0ea5e9" strokeWidth={4} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                                ) : (
                                    <Line type="monotone" dataKey="height" name="الطول" stroke="#10b981" strokeWidth={4} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* قائمة السجلات */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-sky-500"/></div>
            ) : logs.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-gray-200 shadow-sm">
                    <Baby className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 font-bold">لا توجد قياسات مسجلة للطفل حتى الآن.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {logs.map(log => (
                        <div key={log.id} className="bg-white p-5 rounded-[1.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-gray-600 font-bold text-sm bg-gray-50 px-4 py-2 rounded-xl shrink-0">
                                <Calendar size={16} className="text-sky-500" />
                                <span>{new Date(log.log_timestamp).toLocaleDateString('ar-EG')}</span>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 flex-1 justify-end">
                                {log.weight && (
                                    <div className="bg-sky-50 text-sky-700 px-4 py-2 rounded-xl text-xs font-bold border border-sky-100">
                                        الوزن: <span className="font-black text-sm" dir="ltr">{log.weight}</span> كجم
                                    </div>
                                )}
                                {log.height && (
                                    <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-xs font-bold border border-emerald-100">
                                        الطول: <span className="font-black text-sm" dir="ltr">{log.height}</span> سم
                                    </div>
                                )}
                                {log.head_circumference && (
                                    <div className="bg-purple-50 text-purple-700 px-4 py-2 rounded-xl text-xs font-bold border border-purple-100">
                                        محيط الرأس: <span className="font-black text-sm" dir="ltr">{log.head_circumference}</span> سم
                                    </div>
                                )}
                                {log.hemoglobin && (
                                    <div className="bg-rose-50 text-rose-700 px-4 py-2 rounded-xl text-xs font-bold border border-rose-100">
                                        نسبة الدم (Hb): <span className="font-black text-sm" dir="ltr">{log.hemoglobin}</span>
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
