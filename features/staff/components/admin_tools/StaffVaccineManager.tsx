import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../supabaseClient';
import { Employee } from '../../../../types';
import { Search, Syringe, Printer, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StaffVaccineManager() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [tempData, setTempData] = useState<any>({});

    const { data: employees = [], isLoading } = useQuery({
        queryKey: ['vaccine_staff_list'],
        queryFn: async () => {
            const { data } = await supabase.from('employees').select('*').order('name');
            return data as Employee[];
        }
    });

    const filtered = employees.filter(e => e.name.includes(search) || e.employee_id.includes(search));

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => {
            await supabase.from('employees').update(data).eq('id', id);
        },
        onSuccess: () => {
            toast.success('تم التحديث');
            setEditingId(null);
            queryClient.invalidateQueries({ queryKey: ['vaccine_staff_list'] });
        }
    });

    const startEdit = (emp: Employee) => {
        setEditingId(emp.id);
        setTempData({
            hep_b_dose1: emp.hep_b_dose1,
            hep_b_dose2: emp.hep_b_dose2,
            hep_b_dose3: emp.hep_b_dose3,
            hep_b_location: emp.hep_b_location
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-4 no-print">
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5"/>
                    <input type="text" placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pr-10 pl-4 py-3 rounded-xl border outline-none"/>
                </div>
                <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2">
                    <Printer className="w-5 h-5"/> طباعة
                </button>
            </div>

            <div className="bg-white rounded-3xl border shadow-sm p-6 overflow-hidden">
                <div className="hidden print:block text-center mb-6">
                    <h2 className="text-xl font-black">سجل التطعيمات (Hepatitis B)</h2>
                </div>
                <table className="w-full text-sm text-right">
                    <thead className="bg-gray-50 font-bold border-b">
                        <tr>
                            <th className="p-3">الاسم</th>
                            <th className="p-3">الجرعة 1</th>
                            <th className="p-3">الجرعة 2</th>
                            <th className="p-3">الجرعة 3</th>
                            <th className="p-3">المكان</th>
                            <th className="p-3 no-print">إجراء</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filtered.map(emp => (
                            <tr key={emp.id} className={editingId === emp.id ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                                <td className="p-3 font-bold">{emp.name}</td>
                                
                                {editingId === emp.id ? (
                                    <>
                                        <td className="p-1"><input type="date" className="w-full p-2 border rounded bg-white" value={tempData.hep_b_dose1 || ''} onChange={e => setTempData({...tempData, hep_b_dose1: e.target.value})} /></td>
                                        <td className="p-1"><input type="date" className="w-full p-2 border rounded bg-white" value={tempData.hep_b_dose2 || ''} onChange={e => setTempData({...tempData, hep_b_dose2: e.target.value})} /></td>
                                        <td className="p-1"><input type="date" className="w-full p-2 border rounded bg-white" value={tempData.hep_b_dose3 || ''} onChange={e => setTempData({...tempData, hep_b_dose3: e.target.value})} /></td>
                                        <td className="p-1"><input type="text" className="w-full p-2 border rounded bg-white" value={tempData.hep_b_location || ''} onChange={e => setTempData({...tempData, hep_b_location: e.target.value})} /></td>
                                        <td className="p-1 text-center no-print">
                                            <button onClick={() => updateMutation.mutate({ id: emp.id, data: tempData })} className="bg-green-600 text-white p-2 rounded-lg">
                                                <Save className="w-4 h-4"/>
                                            </button>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="p-3 text-center">{emp.hep_b_dose1 || '-'}</td>
                                        <td className="p-3 text-center">{emp.hep_b_dose2 || '-'}</td>
                                        <td className="p-3 text-center">{emp.hep_b_dose3 || '-'}</td>
                                        <td className="p-3 text-center">{emp.hep_b_location || '-'}</td>
                                        <td className="p-3 text-center no-print">
                                            <button onClick={() => startEdit(emp)} className="text-blue-600 hover:bg-blue-100 p-2 rounded-lg">
                                                <Syringe className="w-4 h-4"/>
                                            </button>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
