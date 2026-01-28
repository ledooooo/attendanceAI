import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../supabaseClient';
import { Employee } from '../../../../types';
import { Search, Plus, Printer, Edit, User, Loader2, Save, X, ArrowUpDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';

export default function StaffEmployeeManager({ currentUser }: { currentUser: Employee }) {
    const queryClient = useQueryClient();
    const componentRef = useRef(null);

    // Filters & Sorting
    const [search, setSearch] = useState('');
    const [filterSpecialty, setFilterSpecialty] = useState('all');
    const [filterStatus, setFilterStatus] = useState('active_only'); 
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'specialty'; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editData, setEditData] = useState<any>({});

    // Fetch Employees
    const { data: employees = [], isLoading } = useQuery({
        queryKey: ['staff_managed_employees'],
        queryFn: async () => {
            const { data } = await supabase.from('employees').select('*');
            return data as Employee[] || [];
        }
    });

    // --- Data Processing (Filtering & Sorting) ---
    const processedData = useMemo(() => {
        let data = employees.filter(item => {
            const term = search.toLowerCase();
            const matchesSearch = item.name.toLowerCase().includes(term) || 
                                  item.employee_id.includes(term) || 
                                  (item.national_id && item.national_id.includes(term));
            
            const matchesSpec = filterSpecialty === 'all' || item.specialty === filterSpecialty;
            
            let matchesStatus = true;
            if (filterStatus === 'active_only') matchesStatus = item.status === 'نشط';
            else if (filterStatus !== 'all') matchesStatus = item.status === filterStatus;

            return matchesSearch && matchesSpec && matchesStatus;
        });

        // Sorting
        data.sort((a, b) => {
            const valA = a[sortConfig.key] || '';
            const valB = b[sortConfig.key] || '';
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return data;
    }, [employees, search, filterSpecialty, filterStatus, sortConfig]);

    // Save Mutation
    const saveMutation = useMutation({
        mutationFn: async (formData: any) => {
            const payload = { 
                ...formData, 
                center_id: currentUser.center_id,
                // تحويل القيم الرقمية للتأكد
                leave_annual_balance: Number(formData.leave_annual_balance),
                leave_casual_balance: Number(formData.leave_casual_balance),
                total_absence: Number(formData.total_absence)
            };
            
            if (payload.id) {
                await supabase.from('employees').update(payload).eq('id', payload.id);
            } else {
                delete payload.id;
                await supabase.from('employees').insert([payload]);
            }
        },
        onSuccess: () => {
            toast.success('تم الحفظ بنجاح');
            setShowModal(false);
            queryClient.invalidateQueries({ queryKey: ['staff_managed_employees'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    const handleEdit = (emp?: Employee) => {
        if (emp) {
            setEditData({ ...emp }); // نسخ جميع البيانات للتعديل
        } else {
            // بيانات افتراضية للموظف الجديد
            setEditData({ 
                name: '', employee_id: '', national_id: '', specialty: '', 
                phone: '', email: '', address: '', qualification: '', marital_status: 'أعزب',
                status: 'نشط', role: 'user', gender: 'ذكر', religion: 'مسلم',
                leave_annual_balance: 21, leave_casual_balance: 7, total_absence: 0,
                join_date: new Date().toISOString().split('T')[0]
            });
        }
        setShowModal(true);
    };

    const handlePrint = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: `Employees_List_${new Date().toISOString().split('T')[0]}`,
    });

    const toggleSort = (key: 'name' | 'specialty') => {
        setSortConfig(curr => ({
            key,
            direction: curr.key === key && curr.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            {/* Controls (No Print) */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center no-print">
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={() => handleEdit()} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 text-sm w-full md:w-auto justify-center">
                        <Plus className="w-4 h-4"/> إضافة موظف
                    </button>
                    <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 text-sm w-full md:w-auto justify-center">
                        <Printer className="w-4 h-4"/> طباعة القائمة
                    </button>
                </div>
            </div>

            {/* Filters & Sorting (No Print) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border shadow-sm no-print">
                <div className="relative md:col-span-2">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"/>
                    <input placeholder="بحث بالاسم أو الكود..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pr-9 pl-4 py-2 rounded-xl border bg-gray-50 outline-none text-sm"/>
                </div>
                <select value={filterSpecialty} onChange={e => setFilterSpecialty(e.target.value)} className="p-2 rounded-xl border bg-gray-50 outline-none text-sm font-bold">
                    <option value="all">كل التخصصات</option>
                    {Array.from(new Set(employees.map(e => e.specialty))).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                
                <div className="flex gap-2">
                    <button onClick={() => toggleSort('name')} className={`flex-1 flex items-center justify-center gap-1 rounded-xl border text-xs font-bold ${sortConfig.key === 'name' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50'}`}>
                        الاسم <ArrowUpDown className="w-3 h-3"/>
                    </button>
                    <button onClick={() => toggleSort('specialty')} className={`flex-1 flex items-center justify-center gap-1 rounded-xl border text-xs font-bold ${sortConfig.key === 'specialty' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50'}`}>
                        التخصص <ArrowUpDown className="w-3 h-3"/>
                    </button>
                </div>
            </div>

            {/* Printable Table */}
            <div ref={componentRef} className="bg-white rounded-3xl border shadow-sm overflow-hidden p-6 print:p-2 print:shadow-none print:border-none print:w-full" dir="rtl">
                
                {/* Print Header */}
                <div className="hidden print:block text-center mb-4 border-b-2 border-black pb-2">
                    <p className="text-[12px] font-bold font-mono text-black leading-tight">
                        مركز غرب المطار - بيانات القوة الفعلية - تحريراً في: {new Date().toLocaleDateString('ar-EG')}
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right border-collapse">
                        <thead className="bg-gray-100 text-gray-700 font-bold border-b-2 border-black">
                            <tr>
                                <th className="p-2 border border-gray-400 w-8 text-center">م</th>
                                <th className="p-2 border border-gray-400 w-12 text-center">الكود</th>
                                <th className="p-2 border border-gray-400">الاسم</th>
                                <th className="p-2 border border-gray-400 w-24">الوظيفة</th>
                                <th className="p-2 border border-gray-400 w-24 text-center">موبايل</th>
                                <th className="p-2 border border-gray-400 w-28 text-center">رقم قومي</th>
                                <th className="p-2 border border-gray-400 w-20 text-center">نظام العمل</th>
                                <th className="p-2 border border-gray-400 w-10 text-center no-print">تعديل</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? <tr><td colSpan={8} className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto"/></td></tr> :
                             processedData.map((emp, idx) => (
                                <tr key={emp.id} className="hover:bg-gray-50 border-b border-gray-300">
                                    <td className="p-2 border border-gray-300 text-center">{idx + 1}</td>
                                    <td className="p-2 border border-gray-300 font-mono font-bold text-center text-blue-600 print:text-black">{emp.employee_id}</td>
                                    <td className="p-2 border border-gray-300 font-bold truncate max-w-[150px]">{emp.name}</td>
                                    <td className="p-2 border border-gray-300 text-xs font-bold">{emp.specialty}</td>
                                    <td className="p-2 border border-gray-300 text-center font-mono text-xs">{emp.phone || '-'}</td>
                                    <td className="p-2 border border-gray-300 text-center font-mono text-xs">{emp.national_id || '-'}</td>
                                    <td className="p-2 border border-gray-300 text-center text-xs font-bold">
                                        {(emp.part_time_start_date && emp.part_time_end_date) ? 'جزء وقت' : 'وقت كامل'}
                                    </td>
                                    <td className="p-2 border border-gray-300 text-center no-print">
                                        <button onClick={() => handleEdit(emp)} className="p-1.5 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100 transition-colors">
                                            <Edit className="w-4 h-4"/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal - Full Edit Form */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 no-print">
                    <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl animate-in zoom-in-95 overflow-hidden my-8 h-full max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50 shrink-0">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <User className="w-5 h-5 text-emerald-600"/>
                                {editData.id ? 'تعديل بيانات موظف شاملة' : 'إضافة موظف جديد'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-200 rounded-full"><X className="w-5 h-5"/></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                {/* بيانات أساسية */}
                                <div className="space-y-4 md:col-span-3">
                                    <h4 className="text-sm font-bold text-gray-500 border-b pb-2">البيانات الأساسية</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <input className="p-3 border rounded-xl w-full" placeholder="الاسم" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                                        <input className="p-3 border rounded-xl w-full" placeholder="الكود الوظيفي" value={editData.employee_id} onChange={e => setEditData({...editData, employee_id: e.target.value})} />
                                        <input className="p-3 border rounded-xl w-full" placeholder="الرقم القومي" value={editData.national_id} onChange={e => setEditData({...editData, national_id: e.target.value})} />
                                        <input className="p-3 border rounded-xl w-full" placeholder="التخصص" value={editData.specialty} onChange={e => setEditData({...editData, specialty: e.target.value})} />
                                        <input className="p-3 border rounded-xl w-full" placeholder="رقم الهاتف" value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} />
                                        <input className="p-3 border rounded-xl w-full" placeholder="العنوان" value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} />
                                    </div>
                                </div>

                                {/* بيانات إضافية */}
                                <div className="space-y-4 md:col-span-3">
                                    <h4 className="text-sm font-bold text-gray-500 border-b pb-2">بيانات إضافية</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <input className="p-3 border rounded-xl w-full" placeholder="المؤهل" value={editData.qualification} onChange={e => setEditData({...editData, qualification: e.target.value})} />
                                        <select className="p-3 border rounded-xl w-full" value={editData.marital_status} onChange={e => setEditData({...editData, marital_status: e.target.value})}>
                                            <option value="أعزب">أعزب</option><option value="متزوج">متزوج</option><option value="مطلق">مطلق</option><option value="أرمل">أرمل</option>
                                        </select>
                                        <select className="p-3 border rounded-xl w-full" value={editData.status} onChange={e => setEditData({...editData, status: e.target.value})}>
                                            <option value="نشط">نشط</option><option value="موقوف">موقوف</option><option value="إجازة">إجازة</option>
                                        </select>
                                        <input type="date" className="p-3 border rounded-xl w-full" placeholder="تاريخ التعيين" value={editData.join_date} onChange={e => setEditData({...editData, join_date: e.target.value})} />
                                        <input className="p-3 border rounded-xl w-full" placeholder="الدرجة الوظيفية" value={editData.grade} onChange={e => setEditData({...editData, grade: e.target.value})} />
                                        <input className="p-3 border rounded-xl w-full" placeholder="الجزاءات" value={editData.penalties} onChange={e => setEditData({...editData, penalties: e.target.value})} />
                                    </div>
                                </div>

                                {/* الأرصدة */}
                                <div className="space-y-4 md:col-span-3">
                                    <h4 className="text-sm font-bold text-gray-500 border-b pb-2">الأرصدة</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <input type="number" className="p-3 border rounded-xl w-full" placeholder="رصيد اعتيادي" value={editData.leave_annual_balance} onChange={e => setEditData({...editData, leave_annual_balance: e.target.value})} />
                                        <input type="number" className="p-3 border rounded-xl w-full" placeholder="رصيد عارضة" value={editData.leave_casual_balance} onChange={e => setEditData({...editData, leave_casual_balance: e.target.value})} />
                                        <input type="number" className="p-3 border rounded-xl w-full" placeholder="إجمالي الغياب" value={editData.total_absence} onChange={e => setEditData({...editData, total_absence: e.target.value})} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t bg-gray-50 shrink-0 flex gap-4">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition-colors">إلغاء</button>
                            <button onClick={() => saveMutation.mutate(editData)} disabled={saveMutation.isPending} className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg flex items-center justify-center gap-2">
                                {saveMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} حفظ البيانات
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
