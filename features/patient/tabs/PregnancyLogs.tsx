import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { HeartPulse, Plus, Loader2, Calendar, ChevronRight, ChevronLeft, List } from 'lucide-react';

const ITEMS_PER_PAGE = 5;

export default function PregnancyLogs({ patientId }: { patientId: string }) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // حالات واجهة المستخدم
    const [showForm, setShowForm] = useState(false);
    const [showHistory, setShowHistory] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // حالة الـ Pagination
    const [currentPage, setCurrentPage] = useState(1);

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
            setShowHistory(true);
            setCurrentPage(1);
            setFormData({lmp_date: '', blood_pressure: '', fetal_heart_rate: '', weight: '', hemoglobin: '', urine_test: '', notes: ''});
            fetchLogs(); 
        } else {
            toast.error('حدث خطأ أثناء التسجيل');
        }
        setSubmitting(false);
    };

    // حسابات الـ Pagination
    const totalPages = Math.ceil(logs.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedLogs = logs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return (
        <div className="animate-in fade-in space-y-6">
            
            {/* الترويسة */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-pink-100">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center shrink-0">
                        <HeartPulse size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-800">مفكرة متابعة الحمل</h2>
                        <p className="text-xs font-bold text-gray-500 mt-1">سجلي قياساتك في كل زيارة لمتابعة صحتك وصحة جنينك</p>
                    </div>
                </div>
                
                {/* أزرار التحكم */}
                <div className="flex w-full md:w-auto gap-2">
                    <button 
                        onClick={() => setShowHistory(!showHistory)} 
                        className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-colors border ${showHistory ? 'bg-gray-100 text-gray-700 border-gray-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    >
                        <List size={18}/> {showHistory ? 'إخفاء السجل' : 'عرض السجل'}
                    </button>
                    
                    <button 
                        onClick={() => { setShowForm(!showForm); if(!showForm) setShowHistory(false); }} 
                        className="flex-1 md:flex-none bg-pink-600 hover:bg-pink-700 text-white px-5 py-2.5 rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-colors shadow-md shadow-pink-200"
                    >
                        <Plus size={18}/> تسجيل زيارة
                    </button>
                </div>
            </div>

            {/* نموذج الإدخال */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2rem] shadow-lg shadow-black/5 border border-pink-100 mb-6 animate-in slide-in-from-top-4">
                    <h3 className="font-black text-gray-800 mb-5 text-lg flex items-center gap-2">
                        <Plus className="text-pink-500"/> إضافة زيارة جديدة
                    </h3>
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
                    <div className="flex gap-3 justify-end border-t border-gray-50 pt-4 mt-2">
                        <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-sm hover:bg-gray-200 transition-colors">إلغاء</button>
                        <button type="submit" disabled={submitting} className="px-8 py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-colors disabled:opacity-70">
                            {submitting ? <Loader2 className="animate-spin w-5 h-5"/> : 'حفظ الزيارة'}
                        </button>
                    </div>
                </form>
            )}

            {/* قائمة السجلات */}
            {showHistory && (
                <div className="animate-in fade-in slide-in-from-bottom-4">
                    {loading ? (
                        <div className="flex justify-center py-20 bg-white rounded-[2rem] border border-gray-100 shadow-sm"><Loader2 className="w-10 h-10 animate-spin text-pink-500"/></div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-gray-200 shadow-sm">
                            <HeartPulse className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-gray-500 font-bold">لم تقومي بتسجيل أي زيارة بعد.</p>
                        </div>
                    ) : (
                        <div className="bg-white p-2 rounded-[2rem] border border-gray-100 shadow-sm">
                            <div className="grid gap-2 p-4">
                                {paginatedLogs.map((log, index) => (
                                    <div key={log.id} className={`p-5 rounded-[1.5rem] border border-gray-50 flex flex-col transition-all hover:bg-gray-50/50 ${index !== paginatedLogs.length - 1 ? 'border-b-gray-100' : ''}`}>
                                        <div className="flex flex-wrap justify-between items-center border-b border-gray-100 pb-3 mb-3 gap-2">
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
                                            {log.blood_pressure && <span className="bg-white text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 shadow-sm">الضغط: <span className="font-black" dir="ltr">{log.blood_pressure}</span></span>}
                                            {log.fetal_heart_rate && <span className="bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-100">النبض: <span className="font-black" dir="ltr">{log.fetal_heart_rate}</span> bpm</span>}
                                            {log.weight && <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-100">الوزن: <span className="font-black" dir="ltr">{log.weight}</span> كجم</span>}
                                            {log.hemoglobin && <span className="bg-red-50 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-100">الهيموجلوبين: <span className="font-black" dir="ltr">{log.hemoglobin}</span></span>}
                                            {log.urine_test && <span className="bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-yellow-100">البول: <span className="font-black">{log.urine_test}</span></span>}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* أزرار التنقل Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between border-t border-gray-100 p-4 mt-2">
                                    <p className="text-xs font-bold text-gray-400">
                                        إظهار {startIndex + 1} إلى {Math.min(startIndex + ITEMS_PER_PAGE, logs.length)} من إجمالي {logs.length} زيارة
                                    </p>
                                    <div className="flex gap-2">
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                            <ChevronRight size={18} />
                                        </button>
                                        <div className="flex items-center gap-1 px-2">
                                            <span className="w-8 h-8 flex items-center justify-center bg-pink-50 text-pink-600 font-black rounded-lg text-sm border border-pink-100">{currentPage}</span>
                                            <span className="text-gray-400 text-xs font-bold px-1">من</span>
                                            <span className="text-gray-500 font-bold text-sm">{totalPages}</span>
                                        </div>
                                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                            <ChevronLeft size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
