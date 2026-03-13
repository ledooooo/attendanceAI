import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { Calendar as CalendarIcon, Clock, Plus, Loader2, FileText, ChevronRight, Stethoscope, ChevronLeft, List } from 'lucide-react';

const ITEMS_PER_PAGE = 5;

export default function PatientAppointments({ patientId }: { patientId: string }) {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // حالات واجهة المستخدم
    const [showForm, setShowForm] = useState(false);
    const [showHistory, setShowHistory] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // حالة الـ Pagination
    const [currentPage, setCurrentPage] = useState(1);

    const [formData, setFormData] = useState({
        clinic_name: 'عيادة طب الأسرة',
        visit_reason: '',
        appointment_date: '',
        appointment_time: '',
        phone: ''
    });

    const clinics = ['عيادة طب الأسرة', 'عيادة الأطفال', 'عيادة الأسنان', 'عيادة النساء والتوليد', 'الطوارئ'];

    useEffect(() => {
        if (patientId) fetchAppointments();
    }, [patientId]);

    const fetchAppointments = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('patient_appointments')
            .select('*')
            .eq('patient_id', patientId)
            .order('appointment_date', { ascending: false });
        if (!error && data) setAppointments(data);
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const { error } = await supabase.from('patient_appointments').insert({
            patient_id: patientId,
            ...formData
        });
        
        if (error) {
            toast.error('حدث خطأ أثناء حجز الموعد');
        } else {
            toast.success('تم حجز الموعد بنجاح، بانتظار التأكيد');
            setShowForm(false);
            setShowHistory(true);
            setCurrentPage(1);
            setFormData({...formData, visit_reason: '', appointment_date: '', appointment_time: ''});
            fetchAppointments();
        }
        setSubmitting(false);
    };

    // حسابات الـ Pagination
    const totalPages = Math.ceil(appointments.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedAppointments = appointments.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return (
        <div className="animate-in fade-in space-y-6">
            
            {/* الترويسة */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-blue-50">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                        <CalendarIcon size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-800">سجل المواعيد</h2>
                        <p className="text-xs font-bold text-gray-500 mt-1">احجز وتابع مواعيد عياداتك القادمة بكل سهولة</p>
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
                        className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-colors shadow-md shadow-blue-200"
                    >
                        <Plus size={18} /> حجز موعد
                    </button>
                </div>
            </div>

            {/* نموذج الإدخال */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2rem] shadow-lg shadow-black/5 border border-blue-100 mb-6 animate-in slide-in-from-top-4">
                    <h3 className="font-black text-gray-800 mb-5 text-lg flex items-center gap-2">
                        <Plus className="text-blue-500"/> تفاصيل الموعد الجديد
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm font-bold">
                        <div>
                            <label className="block text-gray-600 mb-1.5 text-xs">العيادة المطلوبة</label>
                            <select value={formData.clinic_name} onChange={e => setFormData({...formData, clinic_name: e.target.value})} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                                {clinics.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-600 mb-1.5 text-xs">رقم الهاتف للتواصل</label>
                            <input type="tel" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-left" dir="ltr" placeholder="01X XXXX XXXX" />
                        </div>
                        <div>
                            <label className="block text-gray-600 mb-1.5 text-xs">تاريخ الموعد المفضل</label>
                            <input type="date" required value={formData.appointment_date} onChange={e => setFormData({...formData, appointment_date: e.target.value})} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                        </div>
                        <div>
                            <label className="block text-gray-600 mb-1.5 text-xs">الوقت المفضل</label>
                            <input type="time" required value={formData.appointment_time} onChange={e => setFormData({...formData, appointment_time: e.target.value})} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-gray-600 mb-1.5 text-xs">سبب الزيارة (اختياري)</label>
                            <textarea value={formData.visit_reason} onChange={e => setFormData({...formData, visit_reason: e.target.value})} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none" rows={2} placeholder="اكتب شكواك باختصار..." />
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end border-t border-gray-50 pt-4 mt-2">
                        <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-black text-sm hover:bg-gray-200 transition-colors">إلغاء</button>
                        <button type="submit" disabled={submitting} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm flex items-center gap-2 transition-colors disabled:opacity-70">
                            {submitting ? <Loader2 size={18} className="animate-spin" /> : 'تأكيد طلب الحجز'}
                        </button>
                    </div>
                </form>
            )}

            {/* قائمة السجلات */}
            {showHistory && (
                <div className="animate-in fade-in slide-in-from-bottom-4">
                    {loading ? (
                        <div className="flex justify-center py-20 bg-white rounded-[2rem] border border-gray-100 shadow-sm"><Loader2 className="animate-spin text-blue-500 w-10 h-10" /></div>
                    ) : appointments.length === 0 ? (
                        <div className="text-center py-20 text-gray-400 font-bold bg-white rounded-[2rem] border border-dashed border-gray-200 shadow-sm">
                            <CalendarIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p>لا توجد مواعيد مسجلة مسبقاً.</p>
                        </div>
                    ) : (
                        <div className="bg-white p-2 rounded-[2rem] border border-gray-100 shadow-sm">
                            <div className="grid gap-2 p-4">
                                {paginatedAppointments.map((app, index) => (
                                    <div key={app.id} className={`p-5 rounded-[1.5rem] border border-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden transition-all hover:bg-gray-50/50 ${index !== paginatedAppointments.length - 1 ? 'border-b-gray-100' : ''}`}>
                                        <div className={`absolute top-0 right-0 w-1.5 h-full ${app.status === 'pending' ? 'bg-amber-400' : app.status === 'confirmed' ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                                        
                                        <div className="pr-2">
                                            <h4 className="font-black text-gray-800 text-lg flex items-center gap-2 mb-1">
                                                <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Clock size={16} /></span>
                                                {app.clinic_name}
                                            </h4>
                                            <div className="flex items-center gap-3 text-xs font-bold text-gray-500 mt-2">
                                                <span className="bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm">{new Date(app.appointment_date).toLocaleDateString('ar-EG')}</span>
                                                <span className="bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm" dir="ltr">{app.appointment_time}</span>
                                            </div>
                                            {app.visit_reason && <p className="text-xs text-gray-500 font-bold mt-3 bg-gray-50 p-2 rounded-lg border border-gray-100 inline-block"><FileText size={12} className="inline mr-1 text-gray-400"/>{app.visit_reason}</p>}
                                        </div>
                                        
                                        <span className={`px-4 py-2 text-xs font-black rounded-xl border ${
                                            app.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                                            app.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                            'bg-gray-50 text-gray-600 border-gray-200'
                                        }`}>
                                            {app.status === 'pending' ? '⏳ قيد المراجعة' : app.status === 'confirmed' ? '✅ تم التأكيد' : '🔒 مكتمل'}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* أزرار التنقل Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between border-t border-gray-100 p-4 mt-2">
                                    <p className="text-xs font-bold text-gray-400">
                                        إظهار {startIndex + 1} إلى {Math.min(startIndex + ITEMS_PER_PAGE, appointments.length)} من {appointments.length}
                                    </p>
                                    <div className="flex gap-2">
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                            <ChevronRight size={18} />
                                        </button>
                                        <div className="flex items-center gap-1 px-2">
                                            <span className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 font-black rounded-lg text-sm border border-blue-100">{currentPage}</span>
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
