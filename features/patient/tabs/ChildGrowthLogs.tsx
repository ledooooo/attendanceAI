import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { 
    Baby, Plus, Loader2, Calendar, TrendingUp, ChevronRight, 
    ChevronLeft, List, Syringe, Brain, AlertCircle, CheckCircle2, Info
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const ITEMS_PER_PAGE = 5;

// ==========================================
// مراجع التطعيمات والتطور (حسب وزارة الصحة و CDC)
// ==========================================
const VACCINATIONS = [
    { age: 'عند الولادة', vaccines: 'طعم الدرن (BCG) - كبدي ب (Hep B) - شلل أطفال فموي (جرعة صفرية)' },
    { age: 'شهرين', vaccines: 'شلل أطفال فموي - الخماسي (DPT, Hep B, Hib) - شلل أطفال حقن (IPV)' },
    { age: '4 شهور', vaccines: 'شلل أطفال فموي - الخماسي - شلل أطفال حقن (IPV)' },
    { age: '6 شهور', vaccines: 'شلل أطفال فموي - الخماسي - شلل أطفال حقن (IPV)' },
    { age: '9 شهور', vaccines: 'شلل أطفال فموي' },
    { age: '12 شهر (سنة)', vaccines: 'شلل أطفال فموي - الحصبة والنكاف والحصبة الألمانية (MMR)' },
    { age: '18 شهر (سنة ونصف)', vaccines: 'شلل أطفال فموي - جرعة منشطة للثلاثي (DPT) - جرعة منشطة (MMR)' },
];

const MILESTONES = [
    { age: 'شهرين', physical: 'يرفع رأسه لأعلى عند الاستلقاء على بطنه', mental: 'يبتسم، يتابع الأشياء بعينيه' },
    { age: '4 شهور', physical: 'يصلب رأسه جيداً، يتدحرج من البطن للظهر', mental: 'يضحك بصوت عالٍ، يمد يده للأشياء' },
    { age: '6 شهور', physical: 'يجلس بمساعدة، ينقل الأشياء من يد لأخرى', mental: 'يتعرف على الوجوه المألوفة، يصدر أصواتاً' },
    { age: '9 شهور', physical: 'يقف مستنداً، يحبو', mental: 'يفهم كلمة "لا"، ينطق (ماما/بابا)' },
    { age: '12 شهر (سنة)', physical: 'يمشي خطوات بمساعدة، يقف بمفرده للحظات', mental: 'يلوح بيده (باي)، يفهم الأوامر البسيطة' },
    { age: '18 شهر', physical: 'يمشي بمفرده، يشرب من الكوب', mental: 'يشير لما يريده، يمتلك حصيلة من 10-20 كلمة' },
];

// دالة تقييم الهيموجلوبين للأطفال (بشكل عام > 11 طبيعي)
const evaluateHemoglobin = (hb: number) => {
    if (!hb) return null;
    if (hb >= 11) return { text: 'طبيعي', color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle2 };
    if (hb >= 9 && hb < 11) return { text: 'أنيميا بسيطة', color: 'text-yellow-600 bg-yellow-50 border-yellow-200', icon: AlertCircle };
    return { text: 'أنيميا شديدة', color: 'text-red-600 bg-red-50 border-red-200', icon: AlertCircle };
};

export default function ChildGrowthLogs({ patientId }: { patientId: string }) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // UI States
    const [activeTab, setActiveTab] = useState<'logs' | 'vaccines' | 'milestones'>('logs');
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [activeChart, setActiveChart] = useState<'weight' | 'height' | 'hc'>('weight');
    const [currentPage, setCurrentPage] = useState(1);

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
        setSubmitting(true);
        try {
            const { error } = await supabase.from('health_logs_child').insert({
                child_id: patientId,
                weight: formData.weight || null,
                height: formData.height || null,
                head_circumference: formData.head_circumference || null,
                hemoglobin: formData.hemoglobin || null,
                notes: formData.notes
            });
            if (error) throw error;
            toast.success('تم تسجيل القراءات بنجاح');
            setShowForm(false);
            setFormData({ weight: '', height: '', head_circumference: '', hemoglobin: '', notes: '' });
            fetchLogs();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const totalPages = Math.ceil(logs.length / ITEMS_PER_PAGE);
    const currentLogs = logs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    // تجهيز بيانات المنحنى (من الأقدم للأحدث)
    const chartData = [...logs].reverse().map(log => ({
        date: new Date(log.log_timestamp).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
        الوزن: log.weight,
        الطول: log.height,
        محيط_الرأس: log.head_circumference
    }));

    return (
        <div className="space-y-6">
            
            {/* 🌟 Navigation Tabs 🌟 */}
            <div className="flex bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 overflow-x-auto hide-scrollbar-mobile">
                <button onClick={() => setActiveTab('logs')} className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all ${activeTab === 'logs' ? 'bg-sky-500 text-white shadow-md' : 'text-gray-500 hover:bg-sky-50'}`}>
                    <TrendingUp className="w-5 h-5" /> متابعة النمو
                </button>
                <button onClick={() => setActiveTab('vaccines')} className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all ${activeTab === 'vaccines' ? 'bg-pink-500 text-white shadow-md' : 'text-gray-500 hover:bg-pink-50'}`}>
                    <Syringe className="w-5 h-5" /> التطعيمات
                </button>
                <button onClick={() => setActiveTab('milestones')} className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all ${activeTab === 'milestones' ? 'bg-purple-500 text-white shadow-md' : 'text-gray-500 hover:bg-purple-50'}`}>
                    <Brain className="w-5 h-5" /> التطور
                </button>
            </div>

            {/* =========================================
                TAB 1: GROWTH LOGS (سجل ومتابعة النمو)
            ========================================= */}
            {activeTab === 'logs' && (
                <div className="animate-in fade-in space-y-6">
                    {/* زر الإضافة */}
                    <div className="flex justify-end">
                        <button onClick={() => setShowForm(!showForm)} className="bg-sky-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-sky-700 transition-all flex items-center gap-2 shadow-lg shadow-sky-200">
                            {showForm ? <List size={20} /> : <Plus size={20} />}
                            {showForm ? 'عرض السجلات' : 'إضافة قياسات جديدة'}
                        </button>
                    </div>

                    {/* نموذج الإضافة */}
                    {showForm && (
                        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2rem] shadow-sm border border-sky-100 animate-in slide-in-from-top-4">
                            <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2">
                                <Baby className="text-sky-500"/> قياسات الطفل الحالية
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">الوزن (كجم)</label>
                                    <input type="number" step="0.01" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold focus:ring-2 focus:ring-sky-500 outline-none" placeholder="مثال: 5.5" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">الطول (سم)</label>
                                    <input type="number" step="0.1" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold focus:ring-2 focus:ring-sky-500 outline-none" placeholder="مثال: 60" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">محيط الرأس (سم)</label>
                                    <input type="number" step="0.1" value={formData.head_circumference} onChange={e => setFormData({...formData, head_circumference: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold focus:ring-2 focus:ring-sky-500 outline-none" placeholder="مثال: 40" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">الهيموجلوبين (g/dL)</label>
                                    <input type="number" step="0.1" value={formData.hemoglobin} onChange={e => setFormData({...formData, hemoglobin: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold focus:ring-2 focus:ring-sky-500 outline-none" placeholder="مثال: 11.5" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">ملاحظات الطبيب / الأم</label>
                                    <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold focus:ring-2 focus:ring-sky-500 outline-none min-h-[100px]" placeholder="أي ملاحظات حول الرضاعة أو النشاط..."></textarea>
                                </div>
                            </div>
                            <button type="submit" disabled={submitting} className="mt-6 w-full bg-sky-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-sky-700 transition-all flex items-center justify-center gap-2 shadow-lg">
                                {submitting ? <Loader2 className="animate-spin" /> : 'حفظ القياسات'}
                            </button>
                        </form>
                    )}

                    {/* عرض السجلات والمنحنى */}
                    {!showForm && (
                        <div className="space-y-6">
                            {loading ? (
                                <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-sky-500"/></div>
                            ) : logs.length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-gray-200">
                                    <Baby className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <p className="text-lg font-bold text-gray-500">لا توجد قياسات مسجلة للطفل حتى الآن.</p>
                                </div>
                            ) : (
                                <>
                                    {/* منحنيات النمو */}
                                    {logs.length > 1 && (
                                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                                            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                                                <h3 className="font-black text-gray-800 text-lg flex items-center gap-2"><TrendingUp className="text-sky-500"/> منحنيات النمو (توضيحية)</h3>
                                                <div className="flex bg-gray-100 p-1 rounded-xl text-sm font-bold">
                                                    <button onClick={() => setActiveChart('weight')} className={`px-4 py-2 rounded-lg transition-colors ${activeChart === 'weight' ? 'bg-white shadow text-sky-600' : 'text-gray-500'}`}>الوزن</button>
                                                    <button onClick={() => setActiveChart('height')} className={`px-4 py-2 rounded-lg transition-colors ${activeChart === 'height' ? 'bg-white shadow text-sky-600' : 'text-gray-500'}`}>الطول</button>
                                                    <button onClick={() => setActiveChart('hc')} className={`px-4 py-2 rounded-lg transition-colors ${activeChart === 'hc' ? 'bg-white shadow text-sky-600' : 'text-gray-500'}`}>الرأس</button>
                                                </div>
                                            </div>
                                            <div className="h-[300px] w-full" dir="ltr">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                                        <XAxis dataKey="date" tick={{fontSize: 12, fill: '#888'}} axisLine={false} tickLine={false} />
                                                        <YAxis domain={['auto', 'auto']} tick={{fontSize: 12, fill: '#888'}} axisLine={false} tickLine={false} />
                                                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontWeight: 'bold' }} />
                                                        {activeChart === 'weight' && <Line type="monotone" dataKey="الوزن" stroke="#0ea5e9" strokeWidth={4} dot={{r: 6, fill: '#0ea5e9', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 8}} />}
                                                        {activeChart === 'height' && <Line type="monotone" dataKey="الطول" stroke="#ec4899" strokeWidth={4} dot={{r: 6, fill: '#ec4899', strokeWidth: 2, stroke: '#fff'}} />}
                                                        {activeChart === 'hc' && <Line type="monotone" dataKey="محيط_الرأس" stroke="#8b5cf6" strokeWidth={4} dot={{r: 6, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff'}} />}
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <p className="text-[10px] text-gray-400 text-center mt-4">هذه المنحنيات توضيحية لتتبع المسار الزمني، يرجى مطابقتها مع منحنيات WHO المعتمدة.</p>
                                        </div>
                                    )}

                                    {/* قائمة السجلات التفصيلية */}
                                    <div className="space-y-4">
                                        {currentLogs.map((log, idx) => {
                                            const hbStatus = evaluateHemoglobin(log.hemoglobin);
                                            const HbIcon = hbStatus?.icon;
                                            
                                            // مقارنة بسيطة مع السجل السابق (إذا كان موجوداً) لمعرفة هل الوزن زاد أم نقص
                                            const previousLog = currentLogs[idx + 1];
                                            const weightDiff = previousLog && log.weight ? (log.weight - previousLog.weight).toFixed(2) : null;

                                            return (
                                                <div key={log.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-50">
                                                        <div className="bg-sky-50 p-2.5 rounded-xl"><Calendar className="text-sky-600 w-5 h-5"/></div>
                                                        <div>
                                                            <p className="font-black text-gray-800 text-sm">{new Date(log.log_timestamp).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                                            <p className="text-xs text-gray-500 font-bold">{new Date(log.log_timestamp).toLocaleTimeString('ar-EG')}</p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                        <div className="bg-gray-50 p-3 rounded-2xl">
                                                            <p className="text-[10px] font-bold text-gray-500 mb-1">الوزن</p>
                                                            <p className="font-black text-lg text-gray-800 flex items-center gap-2">
                                                                {log.weight ? `${log.weight} كجم` : '--'}
                                                                {weightDiff && Number(weightDiff) > 0 && <span className="text-[10px] text-green-500 bg-green-50 px-1 rounded-md">+{weightDiff}</span>}
                                                                {weightDiff && Number(weightDiff) < 0 && <span className="text-[10px] text-red-500 bg-red-50 px-1 rounded-md">{weightDiff}</span>}
                                                            </p>
                                                        </div>
                                                        <div className="bg-gray-50 p-3 rounded-2xl">
                                                            <p className="text-[10px] font-bold text-gray-500 mb-1">الطول</p>
                                                            <p className="font-black text-lg text-gray-800">{log.height ? `${log.height} سم` : '--'}</p>
                                                        </div>
                                                        <div className="bg-gray-50 p-3 rounded-2xl">
                                                            <p className="text-[10px] font-bold text-gray-500 mb-1">محيط الرأس</p>
                                                            <p className="font-black text-lg text-gray-800">{log.head_circumference ? `${log.head_circumference} سم` : '--'}</p>
                                                        </div>
                                                        <div className={`p-3 rounded-2xl border ${hbStatus ? hbStatus.color : 'bg-gray-50 border-transparent'}`}>
                                                            <p className="text-[10px] font-bold text-gray-500 mb-1">الهيموجلوبين (Hb)</p>
                                                            <div className="flex items-center justify-between">
                                                                <p className="font-black text-lg text-gray-800">{log.hemoglobin ? `${log.hemoglobin}` : '--'}</p>
                                                                {hbStatus && HbIcon && <HbIcon className="w-5 h-5 opacity-80" />}
                                                            </div>
                                                            {hbStatus && <p className="text-[10px] font-black mt-1 opacity-80">{hbStatus.text}</p>}
                                                        </div>
                                                    </div>
                                                    
                                                    {log.notes && (
                                                        <div className="mt-4 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                                                            <p className="text-sm font-bold text-blue-800">{log.notes}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Pagination */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                                                <ChevronRight size={18} />
                                            </button>
                                            <div className="flex items-center gap-1 px-2">
                                                <span className="w-8 h-8 flex items-center justify-center bg-sky-50 text-sky-600 font-black rounded-lg text-sm border border-sky-100">{currentPage}</span>
                                                <span className="text-gray-400 text-xs font-bold px-1">من</span>
                                                <span className="text-gray-500 font-bold text-sm">{totalPages}</span>
                                            </div>
                                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                                                <ChevronLeft size={18} />
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* =========================================
                TAB 2: VACCINATIONS (جدول التطعيمات)
            ========================================= */}
            {activeTab === 'vaccines' && (
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-pink-100 animate-in fade-in">
                    <div className="flex items-start gap-3 mb-6 bg-pink-50 p-4 rounded-2xl border border-pink-200">
                        <Info className="text-pink-600 shrink-0 w-6 h-6 mt-1" />
                        <div>
                            <h3 className="font-black text-pink-800">جدول التطعيمات الإجبارية</h3>
                            <p className="text-xs font-bold text-pink-600 mt-1">حسب توصيات وزارة الصحة والسكان المصرية للبرنامج الموسع للتطعيمات.</p>
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        {VACCINATIONS.map((v, idx) => (
                            <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border border-gray-100 hover:border-pink-300 hover:bg-pink-50/30 transition-colors gap-2">
                                <div className="bg-gray-100 px-3 py-1.5 rounded-lg w-fit">
                                    <span className="font-black text-gray-700 text-sm">{v.age}</span>
                                </div>
                                <div className="flex-1 md:pr-4">
                                    <p className="font-bold text-gray-800 text-sm">{v.vaccines}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* =========================================
                TAB 3: MILESTONES (التطور الذهني والحركي)
            ========================================= */}
            {activeTab === 'milestones' && (
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-purple-100 animate-in fade-in">
                    <div className="flex items-start gap-3 mb-6 bg-purple-50 p-4 rounded-2xl border border-purple-200">
                        <Brain className="text-purple-600 shrink-0 w-6 h-6 mt-1" />
                        <div>
                            <h3 className="font-black text-purple-800">مراحل التطور الطبيعية</h3>
                            <p className="text-xs font-bold text-purple-600 mt-1">يختلف الأطفال في سرعة تطورهم، هذا الجدول هو مرجع استرشادي عام (علامات التطور الأساسية).</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {MILESTONES.map((m, idx) => (
                            <div key={idx} className="p-5 rounded-3xl border-2 border-gray-100 hover:border-purple-200 bg-gray-50/50 transition-colors">
                                <div className="inline-block bg-purple-600 text-white px-4 py-1 rounded-full font-black text-sm mb-4 shadow-md">
                                    {m.age}
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <h4 className="text-xs font-black text-gray-400 mb-1 uppercase tracking-wider">التطور الحركي</h4>
                                        <p className="font-bold text-gray-800 text-sm">{m.physical}</p>
                                    </div>
                                    <div className="pt-3 border-t border-gray-200">
                                        <h4 className="text-xs font-black text-gray-400 mb-1 uppercase tracking-wider">التطور الذهني والاجتماعي</h4>
                                        <p className="font-bold text-gray-800 text-sm">{m.mental}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}
