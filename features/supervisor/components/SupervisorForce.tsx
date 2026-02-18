import React, { useRef, useState, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { Loader2, Printer, Users, ArrowUp, ArrowDown } from 'lucide-react';

type SortConfig = { key: string; direction: 'asc' | 'desc' } | null;

export default function SupervisorForce() {
    const printRef = useRef<HTMLDivElement>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'asc' });

    const { data: employees = [], isLoading } = useQuery({
        queryKey: ['supervisor_force'],
        queryFn: async () => {
            const { data } = await supabase.from('employees').select('*').eq('status', 'نشط');
            return data || [];
        }
    });

    // منطق الترتيب
    const sortedEmployees = useMemo(() => {
        if (!sortConfig) return employees;
        return [...employees].sort((a: any, b: any) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [employees, sortConfig]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

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

            <div ref={printRef} className="bg-white p-6 rounded-2xl border shadow-sm print:shadow-none print:border-none print:w-full print:text-[10px]" dir="rtl">
                
                {/* ترويسة الطباعة */}
                <div className="hidden print:block text-center mb-4 border-b-2 border-black pb-2">
                    <h1 className="text-xl font-black">بيان القوة الفعلية للعاملين بالمركز</h1>
                    <p className="font-bold mt-1 text-sm">تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</p>
                </div>

                <div className="flex gap-4 mb-4 font-bold text-sm bg-purple-50 p-3 rounded-xl print:bg-transparent print:border print:py-1">
                    <span>إجمالي القوة: <span className="text-purple-700 print:text-black">{employees.length}</span> موظف</span>
                </div>

                <table className="w-full text-sm text-right border-collapse">
                    <thead className="bg-gray-100 font-bold border-b border-black print:bg-gray-200">
                        <tr>
                            <th className="p-2 border border-gray-400 w-8 text-center">م</th>
                            <th className="p-2 border border-gray-400 w-16 text-center">الكود</th>
                            
                            <th className="p-2 border border-gray-400 cursor-pointer print:cursor-default" onClick={() => handleSort('name')}>
                                <div className="flex items-center gap-1">
                                    الاسم {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}
                                </div>
                            </th>
                            
                            <th className="p-2 border border-gray-400 w-24 cursor-pointer print:cursor-default" onClick={() => handleSort('specialty')}>
                                <div className="flex items-center gap-1">
                                    التخصص {sortConfig?.key === 'specialty' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}
                                </div>
                            </th>

                            <th className="p-2 border border-gray-400 w-32 hidden md:table-cell print:table-cell">البريد الإلكتروني</th>
                            <th className="p-2 border border-gray-400 w-28 text-center hidden md:table-cell print:table-cell">الرقم القومي</th>
                            <th className="p-2 border border-gray-400 w-24 text-center">الهاتف</th>
                            <th className="p-2 border border-gray-400 w-32">المهام الإدارية</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedEmployees.map((emp: any, idx: number) => (
                            <tr key={emp.id} className="border-b border-gray-300 print:border-gray-400 break-inside-avoid">
                                <td className="p-1 border border-gray-300 text-center">{idx + 1}</td>
                                <td className="p-1 border border-gray-300 text-center font-mono">{emp.employee_id}</td>
                                <td className="p-1 border border-gray-300 font-bold truncate max-w-[150px]">{emp.name}</td>
                                <td className="p-1 border border-gray-300 text-xs">{emp.specialty}</td>
                                <td className="p-1 border border-gray-300 text-xs font-mono truncate max-w-[150px] hidden md:table-cell print:table-cell" dir="ltr">{emp.email}</td>
                                <td className="p-1 border border-gray-300 text-center font-mono text-xs hidden md:table-cell print:table-cell">{emp.national_id}</td>
                                <td className="p-1 border border-gray-300 text-center font-mono text-xs" dir="ltr">{emp.phone}</td>
                                <td className="p-1 border border-gray-300 text-xs">{emp.admin_tasks}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
