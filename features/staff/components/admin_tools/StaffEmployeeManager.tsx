import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../supabaseClient';
import { Employee } from '../../../../types';
import { Search, Plus, Printer, Edit, User, Loader2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StaffEmployeeManager({ currentUser }: { currentUser: Employee }) {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editData, setEditData] = useState<any>({});

    // جلب الموظفين
    const { data: employees = [], isLoading } = useQuery({
        queryKey: ['staff_managed_employees'],
        queryFn: async () => {
            const { data } = await supabase.from('employees').select('*').order('name');
            return data as Employee[];
        }
    });

    // فلترة
    const filtered = employees.filter(e => e.name.includes(search) || e.national_id?.includes(search) || e.employee_id.includes(search));

    // حفظ/تعديل
    const saveMutation = useMutation({
        mutationFn: async (formData: any) => {
            // تنظيف البيانات وحفظها
            const payload = { ...formData, center_id: currentUser.center_id }; // ربط الموظف بنفس المركز
            if (payload.id) {
                await supabase.from('employees').update(payload).eq('id', payload.id);
            } else {
                await supabase.from('employees').insert([payload]);
            }
        },
        onSuccess: () => {
            toast.success('تم الحفظ بنجاح');
            setShowModal(false);
            queryClient.invalidateQueries({ queryKey: ['staff_managed_employees'] });
        }
    });

    const handleEdit = (emp?: Employee) => {
        setEditData(emp || { 
            name: '', employee_id: '', national_id: '', specialty: '', 
            status: 'نشط', role: 'user', gender: 'ذكر', religion: 'مسلم' 
        });
        setShowModal(true);
    };

    return (
        <div className="space-y-6">
            {/* أدوات التحكم */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 no-print">
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5"/>
                    <input 
                        type="text" 
                        placeholder="بحث بالاسم أو الرقم القومي..." 
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pr-10 pl-4 py-3 rounded-xl border bg-gray-50 focus:bg-white transition-colors outline-none"
                    />
                </div>
                <button onClick={() => handleEdit()} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700">
                    <Plus className="w-5 h-5"/> إضافة موظف
                </button>
                <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700">
                    <Printer className="w-5 h-5"/> طباعة القائمة
                </button>
            </div>

            {/* الجدول (قابل للطباعة) */}
            <div className="bg-white rounded-3xl border shadow-sm overflow-hidden p-6 print:shadow-none print:border-none">
                <div className="hidden print:block text-center mb-6 border-b pb-4">
                    <h1 className="text-xl font-black">سجل العاملين بالمركز</h1>
                    <p className="text-sm">تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-50 text-gray-600 font-bold border-b">
                            <tr>
                                <th className="p-4">الكود</th>
                                <th className="p-4">الاسم</th>
                                <th className="p-4">الرقم القومي</th>
                                <th className="p-4">التخصص</th>
                                <th className="p-4">الهاتف</th>
                                <th className="p-4">الحالة</th>
                                <th className="p-4 no-print">تعديل</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? <tr><td colSpan={7} className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto"/></td></tr> :
                             filtered.map(emp => (
                                <tr key={emp.id} className="hover:bg-gray-50">
                                    <td className="p-4 font-mono font-bold text-blue-600">{emp.employee_id}</td>
                                    <td className="p-4 font-bold">{emp.name}</td>
                                    <td className="p-4 font-mono">{emp.national_id || '-'}</td>
                                    <td className="p-4">{emp.specialty}</td>
                                    <td className="p-4">{emp.phone || '-'}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${emp.status === 'نشط' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {emp.status}
                                        </span>
                                    </td>
                                    <td className="p-4 no-print">
                                        <button onClick={() => handleEdit(emp)} className="p-2 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100">
                                            <Edit className="w-4 h-4"/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal الإضافة/التعديل */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 no-print">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <User className="w-5 h-5 text-emerald-600"/>
                                {editData.id ? 'تعديل بيانات موظف' : 'إضافة موظف جديد'}
                            </h3>
                            <button onClick={() => setShowModal(false)}><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <input className="p-3 border rounded-xl w-full" placeholder="الاسم" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                                <input className="p-3 border rounded-xl w-full" placeholder="الكود الوظيفي" value={editData.employee_id} onChange={e => setEditData({...editData, employee_id: e.target.value})} />
                                <input className="p-3 border rounded-xl w-full" placeholder="الرقم القومي" value={editData.national_id} onChange={e => setEditData({...editData, national_id: e.target.value})} />
                                <input className="p-3 border rounded-xl w-full" placeholder="التخصص" value={editData.specialty} onChange={e => setEditData({...editData, specialty: e.target.value})} />
                                <input className="p-3 border rounded-xl w-full" placeholder="رقم الهاتف" value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} />
                                <input className="p-3 border rounded-xl w-full" placeholder="العنوان" value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} />
                                <input className="p-3 border rounded-xl w-full" placeholder="المؤهل" value={editData.qualification} onChange={e => setEditData({...editData, qualification: e.target.value})} />
                                <select className="p-3 border rounded-xl w-full" value={editData.status} onChange={e => setEditData({...editData, status: e.target.value})}>
                                    <option value="نشط">نشط</option>
                                    <option value="موقوف">موقوف</option>
                                    <option value="إجازة">إجازة</option>
                                </select>
                            </div>
                            <button onClick={() => saveMutation.mutate(editData)} disabled={saveMutation.isPending} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700">
                                {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ البيانات'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
