import React, { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../supabaseClient';
import { Check, X, Filter, Loader2, FileText, Printer, Edit, Calendar, Search, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import { LeaveRequest } from '../../../../types';

const PAGE_SIZE = 30;

export default function StaffRequestsManager() {
    const queryClient = useQueryClient();
    const componentRef = useRef(null);

    // Filters State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('pending'); // حالة الطلب
    const [filterSpecialty, setFilterSpecialty] = useState('all');
    const [dateMode, setDateMode] = useState<'all' | 'day' | 'month'>('month');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // لليوم
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // للشهر
    
    // Pagination State
    const [page, setPage] = useState(0);

    // Edit Modal State
    const [editRequest, setEditRequest] = useState<LeaveRequest | null>(null);

    // --- 1. Fetching Data ---
    // نجلب الطلبات بناءً على التاريخ أولاً لتقليل حجم البيانات
    const { data: requests = [], isLoading } = useQuery({
        queryKey: ['staff_admin_requests', dateMode, selectedDate, selectedMonth],
        queryFn: async () => {
            let query = supabase
                .from('leave_requests')
                .select('*, employees(name, specialty, employee_id)')
                .order('created_at', { ascending: false });
            
            // فلترة التاريخ من السيرفر
            if (dateMode === 'day') {
                query = query.lte('start_date', selectedDate).gte('end_date', selectedDate);
            } else if (dateMode === 'month') {
                const startOfMonth = `${selectedMonth}-01`;
                const d = new Date(selectedMonth);
                const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                const endOfMonth = `${selectedMonth}-${lastDay}`;
                query = query.or(`start_date.gte.${startOfMonth},end_date.lte.${endOfMonth}`);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            return data;
        }
    });

    // --- 2. Client-Side Filtering & Pagination ---
    const filteredRequests = useMemo(() => {
        let data = requests.filter((req: any) => {
            // بحث الاسم والكود
            const term = searchTerm.toLowerCase();
            const matchSearch = req.employees?.name?.toLowerCase().includes(term) || 
                                req.employees?.employee_id?.includes(term);
            
            // فلترة التخصص
            const matchSpec = filterSpecialty === 'all' || req.employees?.specialty === filterSpecialty;

            // فلترة حالة الطلب
            const matchStatus = filterStatus === 'all' || req.status === filterStatus;

            return matchSearch && matchSpec && matchStatus;
        });
        return data;
    }, [requests, searchTerm, filterSpecialty, filterStatus]);

    // تقسيم الصفحات
    const totalPages = Math.ceil(filteredRequests.length / PAGE_SIZE);
    const paginatedData = filteredRequests.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    // --- 3. Mutations ---
    const updateStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string, status: string }) => {
            await supabase.from('leave_requests').update({ status }).eq('id', id);
        },
        onSuccess: () => {
            toast.success('تم تحديث الحالة');
            queryClient.invalidateQueries({ queryKey: ['staff_admin_requests'] });
        }
    });

    const updateRequestDetails = useMutation({
        mutationFn: async (data: any) => {
            await supabase.from('leave_requests').update({
                start_date: data.start_date,
                end_date: data.end_date,
                reason: data.reason,
                request_type: data.request_type
            }).eq('id', data.id);
        },
        onSuccess: () => {
            toast.success('تم تعديل الطلب');
            setEditRequest(null);
            queryClient.invalidateQueries({ queryKey: ['staff_admin_requests'] });
        }
    });

    // --- 4. Handlers ---
    const handlePrint = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: `Requests_List_${new Date().toISOString().split('T')[0]}`,
    });

    // استخراج قائمة التخصصات الفريدة للفلتر
    const specialties = useMemo(() => {
        const specs = new Set(requests.map((r: any) => r.employees?.specialty).filter(Boolean));
        return ['all', ...Array.from(specs)];
    }, [requests]);

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            
            {/* --- Controls & Filters --- */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 space-y-4 no-print">
                
                {/* الصف الأول: التاريخ والطباعة */}
                <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
                    <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border">
                        <button onClick={() => setDateMode('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dateMode === 'all' ? 'bg-white text-indigo-600 shadow' : 'text-gray-500'}`}>الكل</button>
                        <button onClick={() => setDateMode('month')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dateMode === 'month' ? 'bg-white text-indigo-600 shadow' : 'text-gray-500'}`}>شهر</button>
                        <button onClick={() => setDateMode('day')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dateMode === 'day' ? 'bg-white text-indigo-600 shadow' : 'text-gray-500'}`}>يوم</button>
                        
                        {dateMode === 'day' && <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-transparent text-xs font-bold outline-none mx-2"/>}
                        {dateMode === 'month' && <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent text-xs font-bold outline-none mx-2"/>}
                    </div>

                    <button onClick={handlePrint} className="bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-gray-900">
                        <Printer className="w-4 h-4"/> طباعة القائمة
                    </button>
                </div>

                {/* الصف الثاني: البحث والفلاتر */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative md:col-span-2">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"/>
                        <input 
                            placeholder="بحث بالاسم أو الكود..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full pr-9 pl-4 py-2 rounded-xl border bg-gray-50 outline-none text-sm"
                        />
                    </div>
                    
                    <select value={filterSpecialty} onChange={e => setFilterSpecialty(e.target.value)} className="p-2 rounded-xl border bg-gray-50 outline-none text-sm font-bold">
                        <option value="all">كل التخصصات</option>
                        {specialties.map((s:any) => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        {['pending', 'approved', 'rejected', 'all'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                    filterStatus === status ? 'bg-white text-indigo-600 shadow' : 'text-gray-500'
                                }`}
                            >
                                {status === 'pending' ? 'معلق' : status === 'approved' ? 'مقبول' : status === 'rejected' ? 'مرفوض' : 'الكل'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- Requests List / Table --- */}
            <div ref={componentRef} className="bg-white rounded-3xl border shadow-sm p-6 print:p-0 print:border-none print:shadow-none min-h-[600px]" dir="rtl">
                
                {/* Print Header */}
                <div className="hidden print:block text-center mb-6 border-b-2 border-black pb-2">
                    <h2 className="text-xl font-black">سجل طلبات الموظفين</h2>
                    <p className="text-sm">
                        {dateMode === 'day' ? `التاريخ: ${selectedDate}` : dateMode === 'month' ? `الشهر: ${selectedMonth}` : 'شامل'}
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right border-collapse">
                        <thead className="bg-gray-50 font-bold border-b text-gray-600">
                            <tr>
                                <th className="p-3 border border-gray-200">م</th>
                                <th className="p-3 border border-gray-200">الموظف</th>
                                <th className="p-3 border border-gray-200">التخصص</th>
                                <th className="p-3 border border-gray-200">نوع الطلب</th>
                                <th className="p-3 border border-gray-200">من</th>
                                <th className="p-3 border border-gray-200">إلى</th>
                                <th className="p-3 border border-gray-200 w-1/4">السبب</th>
                                <th className="p-3 border border-gray-200 text-center">الحالة</th>
                                <th className="p-3 border border-gray-200 text-center no-print">إجراء</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? <tr><td colSpan={9} className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto"/></td></tr> :
                             paginatedData.length === 0 ? <tr><td colSpan={9} className="p-10 text-center text-gray-400 font-bold">لا توجد طلبات مطابقة</td></tr> :
                             paginatedData.map((req: any, idx: number) => (
                                <tr key={req.id} className="hover:bg-gray-50 border-b border-gray-200">
                                    <td className="p-3 border border-gray-200 text-center">{idx + 1 + (page * PAGE_SIZE)}</td>
                                    <td className="p-3 border border-gray-200 font-bold text-gray-800">
                                        {req.employees?.name}
                                        <span className="block text-[10px] text-gray-400 font-normal">{req.employees?.employee_id}</span>
                                    </td>
                                    <td className="p-3 border border-gray-200">{req.employees?.specialty}</td>
                                    <td className="p-3 border border-gray-200 font-bold">{req.request_type}</td>
                                    <td className="p-3 border border-gray-200 font-mono text-xs">{req.start_date}</td>
                                    <td className="p-3 border border-gray-200 font-mono text-xs">{req.end_date}</td>
                                    <td className="p-3 border border-gray-200 text-xs">{req.reason || '-'}</td>
                                    
                                    <td className="p-3 border border-gray-200 text-center">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                                            req.status === 'approved' ? 'bg-green-100 text-green-700' : 
                                            req.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                                            'bg-orange-100 text-orange-700'
                                        }`}>
                                            {req.status === 'approved' ? 'مقبول' : req.status === 'rejected' ? 'مرفوض' : 'معلق'}
                                        </span>
                                    </td>

                                    <td className="p-3 border border-gray-200 text-center no-print">
                                        <div className="flex gap-2 justify-center">
                                            {req.status === 'pending' && (
                                                <>
                                                    <button onClick={() => updateStatus.mutate({ id: req.id, status: 'approved' })} className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100" title="قبول"><Check className="w-4 h-4"/></button>
                                                    <button onClick={() => updateStatus.mutate({ id: req.id, status: 'rejected' })} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100" title="رفض"><X className="w-4 h-4"/></button>
                                                </>
                                            )}
                                            <button onClick={() => setEditRequest(req)} className="p-1.5 bg-yellow-50 text-yellow-600 rounded hover:bg-yellow-100" title="تعديل">
                                                <Edit className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex justify-between items-center mt-6 pt-4 border-t no-print">
                    <button 
                        onClick={() => setPage(p => Math.max(0, p - 1))} 
                        disabled={page === 0}
                        className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 disabled:opacity-50 hover:bg-gray-200 text-sm font-bold flex items-center gap-2"
                    >
                        <ChevronRight className="w-4 h-4"/> السابق
                    </button>
                    <span className="text-sm font-bold text-gray-500">صفحة {page + 1} من {totalPages || 1}</span>
                    <button 
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} 
                        disabled={page >= totalPages - 1}
                        className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 disabled:opacity-50 hover:bg-gray-200 text-sm font-bold flex items-center gap-2"
                    >
                        التالي <ChevronLeft className="w-4 h-4"/>
                    </button>
                </div>
            </div>

            {/* --- Edit Modal --- */}
            {editRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 relative animate-in zoom-in-95">
                        <div className="flex justify-between items-center border-b pb-4 mb-4">
                            <h3 className="text-lg font-black text-gray-800">تعديل الطلب</h3>
                            <button onClick={() => setEditRequest(null)} className="p-2 bg-gray-100 rounded-full hover:bg-red-100"><X className="w-5 h-5"/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="bg-blue-50 p-3 rounded-xl">
                                <p className="font-bold text-blue-800">{editRequest.employees?.name}</p>
                                <p className="text-xs text-blue-600">{editRequest.employees?.specialty}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">من تاريخ</label>
                                    <input type="date" value={editRequest.start_date} onChange={e => setEditRequest({...editRequest, start_date: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50"/>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">إلى تاريخ</label>
                                    <input type="date" value={editRequest.end_date} onChange={e => setEditRequest({...editRequest, end_date: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50"/>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">نوع الطلب</label>
                                <select value={editRequest.request_type} onChange={e => setEditRequest({...editRequest, request_type: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50">
                                    <option value="إجازة اعتيادية">إجازة اعتيادية</option>
                                    <option value="إجازة عارضة">إجازة عارضة</option>
                                    <option value="مأمورية">مأمورية</option>
                                    <option value="إذن">إذن</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">السبب</label>
                                <textarea value={editRequest.reason} onChange={e => setEditRequest({...editRequest, reason: e.target.value})} className="w-full p-3 border rounded-xl bg-gray-50 h-20"/>
                            </div>

                            <button onClick={() => updateRequestDetails.mutate(editRequest)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700">
                                حفظ التعديلات
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
