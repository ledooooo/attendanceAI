import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { Activity, Plus, Loader2, Calendar, ChevronRight, ChevronLeft, List } from 'lucide-react';

// تحديد عدد السجلات في كل صفحة
const ITEMS_PER_PAGE = 5;

export default function ChronicLogs({ patientId }: { patientId: string }) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // حالات واجهة المستخدم
    const [showForm, setShowForm] = useState(false);
    const [showHistory, setShowHistory] = useState(true); // التحكم في إظهار/إخفاء السجل
    const [submitting, setSubmitting] = useState(false);
    
    // حالة الـ Pagination
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
            setShowHistory(true); // نظهر السجل بعد الإضافة
            setCurrentPage(1); // نعود للصفحة الأولى لرؤية السجل الجديد
            setFormData({systolic_bp: '', diastolic_bp: '', blood_sugar: '', sugar_type: 'عشوائي', hba1c: '', current_weight: '', notes: ''});
            fetchLogs(); 
        }
        setSubmitting(false);
    };

    // 🌟 حسابات الـ Pagination
    const totalPages = Math.ceil(logs.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedLogs = logs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return (
        <div className="animate-in fade-in space-y-6">
            
            {/* الترويسة العلوية */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-rose-100">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
                        <Activity size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-800">مفكرة الأمراض المزمنة</h2>
                        <p className="text-xs font-bold text-gray-500 mt-1">سجل قياسات الضغط والسكر دورياً لتتابع حالتك الصحية</p>
                    </div>
                </div>
                
                {/* أزرار التحكم الرئيسية */}
                <div className="flex w-full md:w-auto gap-2">
                    <button 
                        onClick={() => setShowHistory(!showHistory)} 
                        className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-colors border ${showHistory ? 'bg-gray-100 text-gray-700 border-gray-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    >
                        <List size={18}/> {showHistory ? 'إخفاء السجل' : 'عرض السجل'}
                    </button>
                    
                    <button 
                        onClick={() => { setShowForm(!showForm); if(!showForm) setShowHistory(false); }} 
                        className="flex-1 md:flex-none bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-colors shadow-md shadow-rose-200"
                    >
                        <Plus size={18}/> قياس جديد
                    </button>
                </div>
            </div>

            {/* نموذج إدخال قياس جديد */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2rem] shadow-lg shadow-black/5 border border-rose-100 mb-6 animate-in slide-in-from-top-4">
                    <h3 className="font-black text-gray-800 mb-5 text-lg flex items-center gap-2">
                        <Plus className="text-rose-500"/> إضافة قياس جديد
                    </h3>
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
                    <div className="flex gap-3 justify-end border-t border-gray-50 pt-4 mt-2">
                        <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-sm hover:bg-gray-200 transition-colors">إلغاء</button>
                        <button type="submit" disabled={submitting} className="px-8 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-colors disabled:opacity-70">
                            {submitting ? <Loader2 className="animate-spin w-5 h-5"/> : 'حفظ القياسات'}
                        </button>
                    </div>
                </form>
            )}

            {/* 🌟 السجل وعرض البيانات (مع Pagination) */}
            {showHistory && (
                <div className="animate-in fade-in slide-in-from-bottom-4">
                    {loading ? (
                        <div className="flex justify-center py-20 bg-white rounded-[2rem] border border-gray-100 shadow-sm"><Loader2 className="w-10 h-10 animate-spin text-rose-500"/></div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-gray-200 shadow-sm">
                            <Activity className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-gray-500 font-bold">لا يوجد سجل لقياسات سابقة. ابدأ بإضافة قياسك الأول!</p>
                        </div>
                    ) : (
                        <div className="bg-white p-2 rounded-[2rem] border border-gray-100 shadow-sm">
                            
                            {/* قائمة البطاقات المقسمة */}
                            <div className="grid gap-2 p-4">
                                {paginatedLogs.map((log, index) => (
                                    <div key={log.id} className={`p-5 rounded-[1.5rem] border border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:bg-gray-50/50 ${index !== paginatedLogs.length - 1 ? 'border-b-gray-100' : ''}`}>
                                        
                                        <div className="flex items-center gap-3 text-gray-600 font-bold text-sm bg-white border border-gray-100 px-4 py-2.5 rounded-xl shrink-0 shadow-sm">
                                            <Calendar size={16} className="text-rose-400" />
                                            <span>{new Date(log.log_timestamp).toLocaleDateString('ar-EG')}</span>
                                            <span className="text-xs text-gray-400 font-medium border-r border-gray-200 pr-2">
                                                {new Date(log.log_timestamp).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-2 flex-1 justify-end">
                                            {(log.systolic_bp && log.diastolic_bp) && (
                                                <div className="bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-100">
                                                    ضغط: <span className="font-black text-sm" dir="ltr">{log.systolic_bp}/{log.diastolic_bp}</span>
                                                </div>
                                            )}
                                            {log.blood_sugar && (
                                                <div className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-100">
                                                    سكر ({log.sugar_type}): <span className="font-black text-sm" dir="ltr">{log.blood_sugar}</span>
                                                </div>
                                            )}
                                            {log.hba1c && (
                                                <div className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-100">
                                                    تراكمي: <span className="font-black text-sm" dir="ltr">{log.hba1c}</span>
                                                </div>
                                            )}
                                            {log.current_weight && (
                                                <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-100">
                                                    وزن: <span className="font-black text-sm" dir="ltr">{log.current_weight}</span> كجم
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* 🌟 أزرار التنقل بين الصفحات (Pagination Controls) */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between border-t border-gray-100 p-4 mt-2">
                                    <p className="text-xs font-bold text-gray-400">
                                        إظهار {startIndex + 1} إلى {Math.min(startIndex + ITEMS_PER_PAGE, logs.length)} من إجمالي {logs.length} قياس
                                    </p>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                                            disabled={currentPage === 1}
                                            className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            title="السابق"
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                        
                                        {/* أرقام الصفحات (مبسطة) */}
                                        <div className="flex items-center gap-1 px-2">
                                            <span className="w-8 h-8 flex items-center justify-center bg-rose-50 text-rose-600 font-black rounded-lg text-sm border border-rose-100">
                                                {currentPage}
                                            </span>
                                            <span className="text-gray-400 text-xs font-bold px-1">من</span>
                                            <span className="text-gray-500 font-bold text-sm">{totalPages}</span>
                                        </div>

                                        <button 
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                                            disabled={currentPage === totalPages}
                                            className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            title="التالي"
                                        >
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
