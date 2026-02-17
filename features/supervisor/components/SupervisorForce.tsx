import React, { useRef } from 'react';
import { supabase } from '../../../../supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { Loader2, Printer, Users } from 'lucide-react';

export default function SupervisorForce() {
    const printRef = useRef<HTMLDivElement>(null);

    const { data: employees = [], isLoading } = useQuery({
        queryKey: ['supervisor_force'],
        queryFn: async () => {
            const { data } = await supabase.from('employees').select('*').eq('status', 'نشط').order('name');
            return data || [];
        }
    });

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `القوة_الفعلية_${new Date().toISOString().split('T')[0]}`,
    });

    if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-600"/></div>;

    return (
        <div className="space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border no-print">
                <h2 className="font-black text-lg flex items-center gap-2"><Users className="w-5 h-5 text-purple-600"/> بيان القوة الفعلية</h2>
                <button onClick={handlePrint} className="bg-gray-800 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-900">
                    <Printer className="w-4 h-4"/> طباعة
                </button>
            </div>

            <div ref={printRef} className="bg-white p-6 rounded-2xl border shadow-sm print:shadow-none print:border-none" dir="rtl">
                <div className="hidden print:block text-center mb-6 border-b-2 border-black pb-4">
                    <h1 className="text-xl font-black">بيان القوة الفعلية للعاملين بالمركز</h1>
                    <p className="font-bold mt-1">تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</p>
                </div>
                <div className="flex gap-4 mb-4 font-bold text-sm bg-purple-50 p-3 rounded-xl print:bg-transparent print:border">
                    <span>إجمالي القوة: <span className="text-purple-700 print:text-black">{employees.length}</span> موظف</span>
                </div>
                <table className="w-full text-sm text-right border-collapse">
                    <thead className="bg-gray-100 font-bold border-b border-black">
                        <tr>
                            <th className="p-2 border border-gray-300 w-10 text-center">م</th>
                            <th className="p-2 border border-gray-300 w-20 text-center">الكود</th>
                            <th className="p-2 border border-gray-300">الاسم</th>
                            <th className="p-2 border border-gray-300 w-32">التخصص/الوظيفة</th>
                            <th className="p-2 border border-gray-300 w-28 text-center">رقم الهاتف</th>
                        </tr>
                    </thead>
                    <tbody>
                        {employees.map((emp, idx) => (
                            <tr key={emp.id} className="border-b border-gray-200">
                                <td className="p-2 border border-gray-300 text-center">{idx + 1}</td>
                                <td className="p-2 border border-gray-300 text-center font-mono">{emp.employee_id}</td>
                                <td className="p-2 border border-gray-300 font-bold">{emp.name}</td>
                                <td className="p-2 border border-gray-300">{emp.specialty}</td>
                                <td className="p-2 border border-gray-300 text-center font-mono" dir="ltr">{emp.phone}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
