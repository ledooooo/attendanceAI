import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { MessageSquare, Send, Loader2, HelpCircle, ChevronRight, Stethoscope, ChevronLeft, List, Plus } from 'lucide-react';

const ITEMS_PER_PAGE = 5;

export default function PatientComplaints({ patientId }: { patientId: string }) {
    const [complaints, setComplaints] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // حالات واجهة المستخدم
    const [showForm, setShowForm] = useState(false);
    const [showHistory, setShowHistory] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // حالة الـ Pagination
    const [currentPage, setCurrentPage] = useState(1);
    
    const [formData, setFormData] = useState({ type: 'complaint', content: '', name: '', phone: '' });

    useEffect(() => { if (patientId) fetchComplaints(); }, [patientId]);

    const fetchComplaints = async () => {
        setLoading(true);
        const { data } = await supabase.from('patient_complaints').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
        if (data) setComplaints(data);
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const { error } = await supabase.from('patient_complaints').insert({ patient_id: patientId, ...formData });
        
        if (!error) {
            toast.success('تم الإرسال بنجاح، شكراً لتواصلك معنا');
            setFormData({ type: 'complaint', content: '', name: '', phone: '' });
            setShowForm(false);
            setShowHistory(true);
            setCurrentPage(1);
            fetchComplaints();
        } else {
            toast.error('حدث خطأ أثناء الإرسال');
        }
        setSubmitting(false);
    };

    // حسابات الـ Pagination
    const totalPages = Math.ceil(complaints.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedComplaints = complaints.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return (
        <div className="space-y-6 animate-in fade-in">
            
            {/* الترويسة وأزرار التحكم */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-indigo-100">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                        <MessageSquare size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-800">تواصل مع الإدارة</h2>
                        <p className="text-xs font-bold text-gray-500 mt-1">نحن نستمع إليك دائماً لتقديم خدمة أفضل</p>
                    </div>
                </div>
                
                {/* أزرار التحكم */}
                <div className="flex w-full md:w-auto gap-2">
                    <button 
                        onClick={() => setShowHistory(!showHistory)} 
                        className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-colors border ${showHistory ? 'bg-gray-100 text-gray-700 border-gray-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    >
                        <List size={18}/> {showHistory ? 'إخفاء الرسائل السابقة' : 'عرض السجل'}
                    </button>
                    
                    <button 
                        onClick={() => { setShowForm(!showForm); if(!showForm) setShowHistory(false); }} 
                        className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-colors shadow-md shadow-indigo-200"
                    >
                        <Plus size={18}/> رسالة جديدة
                    </button>
                </div>
            </div>

            {/* صندوق إرسال رسالة جديدة */}
            {showForm && (
                <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-lg shadow-black/5 border border-indigo-100 animate-in slide-in-from-top-4">
                    <h3 className="font-black text-gray-800 mb-5 text-lg flex items-center gap-2">
                        <Plus className="text-indigo-500"/> إرسال رسالة جديدة
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-5 text-sm font-bold">
                        {/* أزرار اختيار نوع الرسالة */}
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setFormData({...formData, type: 'complaint'})} className={`flex-1 py-3 rounded-xl font-black text-sm transition-all duration-200 border ${formData.type === 'complaint' ? 'bg-red-50 text-red-600 border-red-200 shadow-sm' : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'}`}>
                                شكوى
                            </button>
                            <button type="button" onClick={() => setFormData({...formData, type: 'suggestion'})} className={`flex-1 py-3 rounded-xl font-black text-sm transition-all duration-200 border ${formData.type === 'suggestion' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm' : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'}`}>
                                مقترح تطويري
                            </button>
                        </div>

                        <div>
                            <textarea required value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} placeholder="اكتب تفاصيل رسالتك هنا بوضوح..." className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none leading-relaxed" rows={4} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="الاسم (اختياري)" className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                            <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="رقم الهاتف (للتواصل معك إن لزم الأمر)" className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-right" dir="ltr" />
                        </div>

                        <div className="flex gap-3 justify-end border-t border-gray-50 pt-4 mt-2">
                            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-sm hover:bg-gray-200 transition-colors">إلغاء</button>
                            <button type="submit" disabled={submitting || !formData.content.trim()} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-200">
                                {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : <><Send size={18} /> إرسال للإدارة</>}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* قائمة الرسائل السابقة */}
            {showHistory && (
                <div className="animate-in fade-in slide-in-from-bottom-4">
                    {loading ? (
                        <div className="flex justify-center py-20 bg-white rounded-[2rem] border border-gray-100 shadow-sm"><Loader2 className="animate-spin text-indigo-500 w-10 h-10" /></div>
                    ) : complaints.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-gray-200 shadow-sm">
                            <HelpCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-gray-500 font-bold">لم تقم بإرسال أي شكاوى أو مقترحات بعد.</p>
                        </div>
                    ) : (
                        <div className="bg-white p-2 rounded-[2rem] border border-gray-100 shadow-sm">
                            <div className="grid gap-2 p-4">
                                {paginatedComplaints.map((c, index) => (
                                    <div key={c.id} className={`p-5 rounded-[1.5rem] border border-gray-50 transition-all hover:bg-gray-50/50 ${index !== paginatedComplaints.length - 1 ? 'border-b-gray-100' : ''}`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <span className={`text-xs px-3 py-1.5 rounded-lg font-black border ${c.type === 'complaint' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                                {c.type === 'complaint' ? 'شكوى' : 'مقترح'}
                                            </span>
                                            <span className="text-xs text-gray-500 font-bold bg-white border border-gray-200 shadow-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                                                <Calendar size={14} className="text-indigo-400" />
                                                {new Date(c.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-800 font-bold leading-relaxed mb-1 mt-4">{c.content}</p>
                                        
                                        {c.admin_reply && (
                                            <div className="mt-4 p-4 bg-gradient-to-l from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 relative">
                                                <div className="absolute top-0 right-4 -mt-2 w-4 h-4 bg-indigo-50 border-t border-r border-indigo-100 transform rotate-[-45deg]"></div>
                                                <span className="text-xs font-black text-indigo-600 flex items-center gap-1.5 mb-2"><MessageSquare size={14}/> رد الإدارة:</span>
                                                <p className="text-sm text-indigo-900 font-bold leading-relaxed">{c.admin_reply}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* أزرار التنقل Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between border-t border-gray-100 p-4 mt-2">
                                    <p className="text-xs font-bold text-gray-400">
                                        إظهار {startIndex + 1} إلى {Math.min(startIndex + ITEMS_PER_PAGE, complaints.length)} من {complaints.length}
                                    </p>
                                    <div className="flex gap-2">
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                            <ChevronRight size={18} />
                                        </button>
                                        <div className="flex items-center gap-1 px-2">
                                            <span className="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-600 font-black rounded-lg text-sm border border-indigo-100">{currentPage}</span>
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
