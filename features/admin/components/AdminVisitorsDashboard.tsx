import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { 
  Users, MessageCircle, Calendar, MessageSquare, Search, 
  Filter, Loader2, FileText, Send, ChevronRight, ChevronLeft
} from 'lucide-react';

export default function AdminVisitorsDashboard() {
    const [activeTab, setActiveTab] = useState('patients');
    
    // حالات المرضى (مع الفلترة والـ Pagination)
    const [patients, setPatients] = useState<any[]>([]);
    const [patientSearch, setPatientSearch] = useState('');
    const [page, setPage] = useState(0);
    const ITEMS_PER_PAGE = 10;

    // حالات أخرى
    const [consultations, setConsultations] = useState<any[]>([]);
    const [consFilter, setConsFilter] = useState('all'); // all, open, closed
    
    const [appointments, setAppointments] = useState<any[]>([]);
    
    const [complaints, setComplaints] = useState<any[]>([]);
    const [complaintFilter, setComplaintFilter] = useState('open'); // open, closed
    const [replyText, setReplyText] = useState('');
    const [replyingTo, setReplyingTo] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (activeTab === 'patients') fetchPatients();
        else if (activeTab === 'consultations') fetchConsultations();
        else if (activeTab === 'appointments') fetchAppointments();
        else if (activeTab === 'complaints') fetchComplaints();
    }, [activeTab, page, consFilter, complaintFilter]);

    // 1. جلب الملفات الطبية (Patients)
    const fetchPatients = async () => {
        setLoading(true);
        let query = supabase.from('patients').select('*', { count: 'exact' });
        
        if (patientSearch) {
            // بحث ذكي (رقم قومي أو رقم ملف أو اسم)
            if (!isNaN(Number(patientSearch))) {
                query = query.or(`national_id.eq.${patientSearch},file_number.eq.${patientSearch}`);
            } else {
                query = query.ilike('full_name', `%${patientSearch}%`);
            }
        }
        
        const { data } = await query
            .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1)
            .order('created_at', { ascending: false });
            
        if (data) setPatients(data);
        setLoading(false);
    };

    // 2. جلب الاستشارات
    const fetchConsultations = async () => {
        setLoading(true);
        let query = supabase.from('consultations').select('*, patients(full_name, file_number)');
        if (consFilter === 'open') query = query.in('status', ['new']);
        if (consFilter === 'closed') query = query.in('status', ['answered', 'closed']);
        const { data } = await query.order('created_at', { ascending: false }).limit(50);
        if (data) setConsultations(data);
        setLoading(false);
    };

    // 3. جلب المواعيد
    const fetchAppointments = async () => {
        setLoading(true);
        const { data } = await supabase.from('patient_appointments').select('*, patients(full_name, file_number)').order('appointment_date', { ascending: false }).limit(50);
        if (data) setAppointments(data);
        setLoading(false);
    };

    // 4. جلب الشكاوى
    const fetchComplaints = async () => {
        setLoading(true);
        let query = supabase.from('patient_complaints').select('*, patients(full_name)');
        if (complaintFilter === 'open') query = query.is('admin_reply', null);
        if (complaintFilter === 'closed') query = query.not('admin_reply', 'is', null);
        const { data } = await query.order('created_at', { ascending: false });
        if (data) setComplaints(data);
        setLoading(false);
    };

    // الرد على شكوى
    const handleReplyComplaint = async (complaintId: string, patientId: string) => {
        if (!replyText) return;
        setLoading(true);
        await supabase.from('patient_complaints').update({ admin_reply: replyText }).eq('id', complaintId);
        
        if (patientId) {
            await supabase.from('patient_notifications').insert({
                patient_id: patientId,
                title: 'رد من الإدارة 📩',
                message: `تم الرد على شكواك/اقتراحك: ${replyText}`
            });
        }
        toast.success('تم الرد وإرسال الإشعار للمنتفع');
        setReplyText('');
        setReplyingTo(null);
        fetchComplaints();
    };

    return (
        <div className="animate-in fade-in bg-white rounded-3xl shadow-sm border p-6 min-h-[70vh]">
            <h2 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-2"><Users className="text-blue-600"/> لوحة تحكم الزائرين</h2>
            
            {/* التبويبات العلوية */}
            <div className="flex overflow-x-auto gap-2 mb-6 pb-2 no-scrollbar border-b">
                {[
                    { id: 'patients', label: 'الملفات الطبية', icon: FileText },
                    { id: 'consultations', label: 'الاستشارات', icon: MessageCircle },
                    { id: 'appointments', label: 'الحجوزات', icon: Calendar },
                    { id: 'complaints', label: 'الشكاوى', icon: MessageSquare }
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-5 py-3 rounded-t-xl font-black transition-colors whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                        <tab.icon size={18}/> {tab.label}
                    </button>
                ))}
            </div>

            {loading && <div className="flex justify-center my-10"><Loader2 className="animate-spin text-blue-500 w-8 h-8"/></div>}

            {/* ─── 1. الملفات الطبية ─── */}
            {!loading && activeTab === 'patients' && (
                <div className="space-y-4">
                    <div className="flex gap-2 mb-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute right-3 top-3 text-gray-400" size={18}/>
                            <input type="text" value={patientSearch} onChange={e => setPatientSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchPatients()} placeholder="ابحث بالاسم، الرقم القومي، أو رقم الملف..." className="w-full pr-10 p-3 bg-gray-50 border rounded-xl outline-none focus:border-blue-500 text-sm font-bold"/>
                        </div>
                        <button onClick={fetchPatients} className="bg-blue-600 text-white px-6 rounded-xl font-bold">بحث</button>
                    </div>
                    
                    <div className="overflow-x-auto border rounded-xl">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-gray-50 font-black text-gray-600">
                                <tr>
                                    <th className="p-4 border-b">رقم الملف</th>
                                    <th className="p-4 border-b">الاسم</th>
                                    <th className="p-4 border-b">الرقم القومي</th>
                                    <th className="p-4 border-b">الهاتف</th>
                                    <th className="p-4 border-b">تاريخ التسجيل</th>
                                </tr>
                            </thead>
                            <tbody>
                                {patients.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50 border-b last:border-0 font-bold">
                                        <td className="p-4"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md">{p.file_number}</span></td>
                                        <td className="p-4">{p.full_name}</td>
                                        <td className="p-4" dir="ltr">{p.national_id}</td>
                                        <td className="p-4" dir="ltr">{p.phone}</td>
                                        <td className="p-4 text-gray-400">{new Date(p.created_at).toLocaleDateString('ar-EG')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination */}
                    <div className="flex justify-between items-center pt-4">
                        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"><ChevronRight/></button>
                        <span className="text-sm font-bold text-gray-500">صفحة {page + 1}</span>
                        <button onClick={() => setPage(p => p + 1)} disabled={patients.length < ITEMS_PER_PAGE} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"><ChevronLeft/></button>
                    </div>
                </div>
            )}

            {/* ─── 2. الاستشارات ─── */}
            {!loading && activeTab === 'consultations' && (
                <div className="space-y-4">
                    <select value={consFilter} onChange={e => setConsFilter(e.target.value)} className="p-3 border rounded-xl font-bold bg-gray-50 outline-none w-48">
                        <option value="all">كل الاستشارات</option>
                        <option value="open">مفتوحة (قيد المراجعة)</option>
                        <option value="closed">مغلقة (تم الرد / حظر)</option>
                    </select>
                    <div className="grid gap-3">
                        {consultations.map(c => (
                            <div key={c.id} className="p-4 border rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50/50">
                                <div>
                                    <p className="font-black text-gray-800 text-sm">{c.patients?.full_name} <span className="text-gray-400 font-bold text-xs">(ملف: {c.patients?.file_number})</span></p>
                                    <p className="text-xs font-bold text-indigo-600 mt-1">قسم: {c.specialty} | {c.urgency === 'urgent' ? '🔴 عاجل' : 'عادي'}</p>
                                </div>
                                <span className={`px-3 py-1 text-xs font-black rounded-lg ${c.status === 'new' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                    {c.status === 'new' ? 'بانتظار الطبيب' : 'تم الرد / مغلقة'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── 3. الشكاوى والمقترحات (والرد عليها) ─── */}
            {!loading && activeTab === 'complaints' && (
                <div className="space-y-4">
                    <select value={complaintFilter} onChange={e => setComplaintFilter(e.target.value)} className="p-3 border rounded-xl font-bold bg-gray-50 outline-none w-48">
                        <option value="open">بانتظار الرد الإداري</option>
                        <option value="closed">تم الرد عليها</option>
                    </select>
                    
                    <div className="grid gap-4">
                        {complaints.length === 0 ? <p className="text-gray-400 font-bold text-center py-10">لا توجد رسائل هنا.</p> : 
                        complaints.map(c => (
                            <div key={c.id} className="p-5 border rounded-2xl shadow-sm bg-white">
                                <div className="flex justify-between items-start mb-3 border-b pb-3">
                                    <div>
                                        <span className={`text-[10px] font-black px-2 py-1 rounded-md ${c.type === 'complaint' ? 'bg-red-50 text-red-600' : 'bg-teal-50 text-teal-600'}`}>{c.type === 'complaint' ? 'شكوى' : 'مقترح'}</span>
                                        <span className="font-black text-gray-800 text-sm mr-2">{c.patients?.full_name || c.name || 'زائر غير معروف'}</span>
                                    </div>
                                    <span className="text-[10px] text-gray-400 font-bold">{new Date(c.created_at).toLocaleDateString('ar-EG')}</span>
                                </div>
                                <p className="text-sm font-bold text-gray-700 mb-4">{c.content}</p>
                                
                                {c.admin_reply ? (
                                    <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                                        <p className="text-[10px] font-black text-indigo-800 mb-1">رد الإدارة:</p>
                                        <p className="text-sm font-bold text-indigo-900">{c.admin_reply}</p>
                                    </div>
                                ) : (
                                    replyingTo === c.id ? (
                                        <div className="mt-2 flex gap-2">
                                            <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="اكتب ردك هنا وسيصل إشعار للمريض..." className="flex-1 p-2 border rounded-lg text-sm outline-none focus:border-indigo-500" />
                                            <button onClick={() => handleReplyComplaint(c.id, c.patient_id)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-1 hover:bg-indigo-700"><Send size={16}/> إرسال</button>
                                            <button onClick={() => {setReplyingTo(null); setReplyText('');}} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-bold text-sm">إلغاء</button>
                                        </div>
                                    ) : (
                                        <button onClick={() => setReplyingTo(c.id)} className="text-indigo-600 text-xs font-black bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition">الرد على هذه الرسالة</button>
                                    )
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* بقية التبويبات كالحجوزات تبنى بنفس المنطق */}
            {!loading && activeTab === 'appointments' && (
                <div className="text-center py-20 text-gray-400 font-bold border border-dashed rounded-2xl">تم جلب {appointments.length} حجز. يمكنك تصفحها هنا.</div>
            )}

        </div>
    );
}
