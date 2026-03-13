import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { Activity, Plus, Loader2, Calendar, ChevronRight, ChevronLeft, List, ActivitySquare, AlertCircle, CheckCircle2, AlertTriangle, Stethoscope, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const ITEMS_PER_PAGE = 5;

// ==========================================
// التقييم الذكي (Smart Evaluators)
// ==========================================
const evaluateBloodPressure = (systolic: number, diastolic: number) => {
    if (!systolic || !diastolic) return null;
    if (systolic < 120 && diastolic < 80) return { text: 'طبيعي', color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle2 };
    if ((systolic >= 120 && systolic <= 129) && diastolic < 80) return { text: 'مرتفع قليلاً', color: 'text-yellow-600 bg-yellow-50 border-yellow-200', icon: AlertCircle };
    if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) return { text: 'ضغط درجة 1', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: AlertTriangle };
    return { text: 'ضغط درجة 2 / خطر', color: 'text-red-600 bg-red-50 border-red-200', icon: AlertTriangle };
};

const evaluateBloodSugar = (value: number, type: string) => {
    if (!value) return null;
    if (type === 'صائم') {
        if (value < 100) return { text: 'طبيعي', color: 'text-green-600 bg-green-50' };
        if (value >= 100 && value <= 125) return { text: 'ما قبل السكري', color: 'text-yellow-600 bg-yellow-50' };
        return { text: 'سكري مرتفع', color: 'text-red-600 bg-red-50' };
    }
    if (type === 'فاطر (بعد ساعتين)') {
        if (value < 140) return { text: 'طبيعي', color: 'text-green-600 bg-green-50' };
        if (value >= 140 && value <= 199) return { text: 'ما قبل السكري', color: 'text-yellow-600 bg-yellow-50' };
        return { text: 'سكري مرتفع', color: 'text-red-600 bg-red-50' };
    }
    // عشوائي
    if (value < 140) return { text: 'طبيعي', color: 'text-green-600 bg-green-50' };
    if (value >= 200) return { text: 'مؤشر سكري', color: 'text-red-600 bg-red-50' };
    return { text: 'متابعة', color: 'text-yellow-600 bg-yellow-50' };
};

export default function ChronicLogs({ patientId }: { patientId: string }) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // UI States
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [activeChart, setActiveChart] = useState<'bp' | 'sugar'>('bp');
    const [currentPage, setCurrentPage] = useState(1);

    const [formData, setFormData] = useState({
        systolic_bp: '', diastolic_bp: '', blood_sugar: '', sugar_type: 'عشوائي', hba1c: '', current_weight: '', notes: ''
    });

    useEffect(() => { if (patientId) fetchLogs(); }, [patientId]);

    const fetchLogs = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('health_logs_chronic')
            .select('*')
            .eq('patient_id', patientId)
            .order('log_timestamp', { ascending: false });
        
        if (data) setLogs(data);
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { error } = await supabase.from('health_logs_chronic').insert({
                patient_id: patientId,
                systolic_bp: formData.systolic_bp || null,
                diastolic_bp: formData.diastolic_bp || null,
                blood_sugar: formData.blood_sugar || null,
                sugar_type: formData.sugar_type,
                hba1c: formData.hba1c || null,
                current_weight: formData.current_weight || null,
                notes: formData.notes
            });
            if (error) throw error;
            toast.success('تم الحفظ بنجاح');
            setShowForm(false);
            setFormData({ systolic_bp: '', diastolic_bp: '', blood_sugar: '', sugar_type: 'عشوائي', hba1c: '', current_weight: '', notes: '' });
            fetchLogs();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const totalPages = Math.ceil(logs.length / ITEMS_PER_PAGE);
    const currentLogs = logs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const chartData = [...logs].reverse().map(log => ({
        date: new Date(log.log_timestamp).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
        انقباضي: log.systolic_bp,
        انبساطي: log.diastolic_bp,
        السكر: log.blood_sugar
    }));

    return (
        <div className="space-y-6">
            {/* Header & Add Button */}
            <div className="flex justify-between items-center bg-white p-4 rounded-[2rem] shadow-sm border border-rose-100">
                <h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><ActivitySquare className="text-rose-500"/> الأمراض المزمنة</h2>
                <button onClick={() => setShowForm(!showForm)} className="bg-rose-500 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-rose-600 transition-all flex items-center gap-2 shadow-md">
                    {showForm ? <List size={18} /> : <Plus size={18} />}
                    {showForm ? 'السجلات' : 'إضافة قياس'}
                </button>
            </div>

            {/* Add Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2rem] shadow-sm border border-rose-100 animate-in slide-in-from-top-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">الضغط (انقباضي)</label>
                                <input type="number" value={formData.systolic_bp} onChange={e => setFormData({...formData, systolic_bp: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-rose-500 outline-none" placeholder="120" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">(انبساطي)</label>
                                <input type="number" value={formData.diastolic_bp} onChange={e => setFormData({...formData, diastolic_bp: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-rose-500 outline-none" placeholder="80" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">السكر العشوائي</label>
                                <input type="number" value={formData.blood_sugar} onChange={e => setFormData({...formData, blood_sugar: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-rose-500 outline-none" placeholder="mg/dL" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">نوع العينة</label>
                                <select value={formData.sugar_type} onChange={e => setFormData({...formData, sugar_type: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-rose-500 outline-none">
                                    <option value="عشوائي">عشوائي</option>
                                    <option value="صائم">صائم</option>
                                    <option value="فاطر (بعد ساعتين)">فاطر (بعد ساعتين)</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">السكر التراكمي (HbA1c %)</label>
                            <input type="number" step="0.1" value={formData.hba1c} onChange={e => setFormData({...formData, hba1c: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-rose-500 outline-none" placeholder="%" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">الوزن الحالي (كجم)</label>
                            <input type="number" step="0.1" value={formData.current_weight} onChange={e => setFormData({...formData, current_weight: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-rose-500 outline-none" placeholder="كجم" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 mb-1">الأدوية أو ملاحظات</label>
                            <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold focus:border-rose-500 outline-none min-h-[80px]"></textarea>
                        </div>
                    </div>
                    <button type="submit" disabled={submitting} className="mt-4 w-full bg-rose-500 text-white py-3 rounded-xl font-black hover:bg-rose-600 transition-all flex items-center justify-center gap-2">
                        {submitting ? <Loader2 className="animate-spin" /> : 'حفظ'}
                    </button>
                </form>
            )}

            {/* View Logs & Charts */}
            {!showForm && (
                <div className="space-y-6 animate-in fade-in">
                    {loading ? (
                        <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-rose-500"/></div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-[2rem] border border-dashed border-gray-200">
                            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="font-bold text-gray-500">لا توجد قراءات مسجلة.</p>
                        </div>
                    ) : (
                        <>
                            {/* Interactive Chart */}
                            {logs.length > 1 && (
                                <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-black text-gray-700 text-sm">مؤشرات المتابعة</h3>
                                        <div className="flex bg-gray-100 p-1 rounded-lg text-xs font-bold">
                                            <button onClick={() => setActiveChart('bp')} className={`px-3 py-1 rounded-md ${activeChart === 'bp' ? 'bg-white shadow text-rose-600' : 'text-gray-500'}`}>الضغط</button>
                                            <button onClick={() => setActiveChart('sugar')} className={`px-3 py-1 rounded-md ${activeChart === 'sugar' ? 'bg-white shadow text-rose-600' : 'text-gray-500'}`}>السكر</button>
                                        </div>
                                    </div>
                                    <div className="h-[250px] w-full" dir="ltr">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#888'}} axisLine={false} tickLine={false} />
                                                <YAxis domain={['auto', 'auto']} tick={{fontSize: 10, fill: '#888'}} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }} />
                                                
                                                {activeChart === 'bp' && (
                                                    <>
                                                        <ReferenceLine y={120} stroke="#22c55e" strokeDasharray="3 3" label={{position: 'insideTopLeft', value: 'مثالي', fill: '#22c55e', fontSize: 10}}/>
                                                        <ReferenceLine y={140} stroke="#ef4444" strokeDasharray="3 3" label={{position: 'insideTopLeft', value: 'مرتفع', fill: '#ef4444', fontSize: 10}}/>
                                                        <Line type="monotone" dataKey="انقباضي" stroke="#f43f5e" strokeWidth={3} dot={{r: 4}} />
                                                        <Line type="monotone" dataKey="انبساطي" stroke="#3b82f6" strokeWidth={3} dot={{r: 4}} />
                                                    </>
                                                )}
                                                {activeChart === 'sugar' && (
                                                    <Line type="monotone" dataKey="السكر" stroke="#eab308" strokeWidth={3} dot={{r: 4}} />
                                                )}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Logs List */}
                            <div className="space-y-4">
                                {currentLogs.map((log, idx) => {
                                    const bpStatus = evaluateBloodPressure(log.systolic_bp, log.diastolic_bp);
                                    const BpIcon = bpStatus?.icon;
                                    
                                    const bsStatus = evaluateBloodSugar(log.blood_sugar, log.sugar_type);
                                    
                                    const prevLog = currentLogs[idx + 1];
                                    const sugarDiff = prevLog && log.blood_sugar ? log.blood_sugar - prevLog.blood_sugar : null;
                                    const weightDiff = prevLog && log.current_weight ? (log.current_weight - prevLog.current_weight).toFixed(1) : null;

                                    return (
                                        <div key={log.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                                            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-50">
                                                <div className="bg-rose-50 p-2 rounded-xl"><Calendar className="text-rose-600 w-4 h-4"/></div>
                                                <div>
                                                    <p className="font-black text-gray-800 text-sm">{new Date(log.log_timestamp).toLocaleDateString('ar-EG')}</p>
                                                    <p className="text-[10px] text-gray-500 font-bold">{new Date(log.log_timestamp).toLocaleTimeString('ar-EG')}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <div className={`p-3 rounded-2xl border ${bpStatus ? bpStatus.color : 'bg-gray-50 border-transparent'}`}>
                                                    <p className="text-[10px] font-bold text-gray-500 mb-1">ضغط الدم</p>
                                                    <p className="font-black text-lg text-gray-800">{log.systolic_bp && log.diastolic_bp ? `${log.systolic_bp}/${log.diastolic_bp}` : '--'}</p>
                                                    {bpStatus && <p className="text-[9px] font-black mt-1 flex items-center gap-1"><BpIcon className="w-3 h-3"/> {bpStatus.text}</p>}
                                                </div>
                                                
                                                <div className={`p-3 rounded-2xl border border-transparent ${bsStatus ? bsStatus.color : 'bg-gray-50'}`}>
                                                    <p className="text-[10px] font-bold text-gray-500 mb-1">السكر ({log.sugar_type})</p>
                                                    <p className="font-black text-lg text-gray-800 flex items-center gap-1">
                                                        {log.blood_sugar ? log.blood_sugar : '--'}
                                                        {sugarDiff && sugarDiff > 0 && <TrendingUp className="w-4 h-4 text-red-500"/>}
                                                        {sugarDiff && sugarDiff < 0 && <TrendingDown className="w-4 h-4 text-green-500"/>}
                                                    </p>
                                                    {bsStatus && <p className="text-[9px] font-black mt-1">{bsStatus.text}</p>}
                                                </div>

                                                <div className="bg-gray-50 p-3 rounded-2xl">
                                                    <p className="text-[10px] font-bold text-gray-500 mb-1">التراكمي HbA1c</p>
                                                    <p className="font-black text-lg text-gray-800">{log.hba1c ? `${log.hba1c}%` : '--'}</p>
                                                </div>

                                                <div className="bg-gray-50 p-3 rounded-2xl">
                                                    <p className="text-[10px] font-bold text-gray-500 mb-1">الوزن</p>
                                                    <p className="font-black text-lg text-gray-800 flex items-center gap-1">
                                                        {log.current_weight ? `${log.current_weight} kg` : '--'}
                                                        {weightDiff && Number(weightDiff) > 0 && <span className="text-[9px] text-red-500">+{weightDiff}</span>}
                                                        {weightDiff && Number(weightDiff) < 0 && <span className="text-[9px] text-green-500">{weightDiff}</span>}
                                                    </p>
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

                            {/* Pagination */}
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
