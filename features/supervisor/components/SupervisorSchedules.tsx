import React, { useState, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { Loader2, Printer, CalendarRange } from 'lucide-react';

export default function SupervisorSchedules() {
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const printRef = useRef<HTMLDivElement>(null);

    const { data: schedules = [], isLoading } = useQuery({
        queryKey: ['supervisor_schedules', month],
        queryFn: async () => {
            const { data } = await supabase
                .from('evening_schedules')
                .select(`id, date, shift_type, employees(name, specialty)`)
                .like('date', `${month}%`)
                .order('date', { ascending: true });
            return data || [];
        }
    });

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `نوبتجيات_${month}`,
    });

    return (
        <div className="space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border no-print">
                <h2 className="font-black text-lg flex items-center gap-2"><CalendarRange className="w-5 h-5 text-indigo-600"/> جدول النوبتجيات</h2>
                <div className="flex gap-2">
                    <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="p-2 bg-gray-50 border rounded-xl font-bold outline-none" />
                    <button onClick={handlePrint} className="bg-gray-800 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2">
                        <Printer className="w-4 h-4"/> طباعة
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-600"/></div>
            ) : (
                <div ref={printRef} className="bg-white p-6 rounded-2xl border shadow-sm print:shadow-none print:border-none" dir="rtl">
                    <div className="hidden print:block text-center mb-6 border-b-2 border-black pb-4">
                        <h1 className="text-xl font-black">جدول نوبتجيات شهر ({month})</h1>
                        <p className="font-bold mt-1">مركز غرب المطار</p>
                    </div>
                    
                    {schedules.length === 0 ? (
                        <p className="text-center text-gray-500 font-bold py-10">لا توجد نوبتجيات مسجلة لهذا الشهر.</p>
                    ) : (
                        <table className="w-full text-sm text-right border-collapse">
                            <thead className="bg-indigo-50 font-bold border-b-2 border-black print:bg-gray-100">
                                <tr>
                                    <th className="p-2 border border-gray-400 w-24 text-center">التاريخ</th>
                                    <th className="p-2 border border-gray-400 w-24 text-center">اليوم</th>
                                    <th className="p-2 border border-gray-400 text-center">الموظف</th>
                                    <th className="p-2 border border-gray-400 text-center w-32">الوظيفة</th>
                                    <th className="p-2 border border-gray-400 text-center w-32">نوع الشيفت</th>
                                </tr>
                            </thead>
                            <tbody>
                                {schedules.map((row: any, idx) => {
                                    const dateObj = new Date(row.date);
                                    const dayName = dateObj.toLocaleDateString('ar-EG', { weekday: 'long' });
                                    return (
                                        <tr key={idx} className="border-b border-gray-300">
                                            <td className="p-2 border border-gray-300 text-center font-mono font-bold">{row.date}</td>
                                            <td className="p-2 border border-gray-300 text-center font-bold">{dayName}</td>
                                            <td className="p-2 border border-gray-300 font-bold text-center">{row.employees?.name || 'غير معروف'}</td>
                                            <td className="p-2 border border-gray-300 text-center text-xs">{row.employees?.specialty || '-'}</td>
                                            <td className="p-2 border border-gray-300 text-center text-xs">{row.shift_type === 'evening' ? 'مسائي' : 'مبيت'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}
