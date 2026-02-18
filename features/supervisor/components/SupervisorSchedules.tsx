import React, { useState, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { Loader2, Printer, CalendarRange, AlertCircle } from 'lucide-react';

export default function SupervisorSchedules() {
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const printRef = useRef<HTMLDivElement>(null);

    const { data: schedules = [], isLoading } = useQuery({
        queryKey: ['supervisor_schedules', month],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('evening_schedules')
                .select('*') // نجلب كل الحقول (id, date, doctors, notes)
                .like('date', `${month}%`)
                .order('date', { ascending: true });

            if (error) throw error;
            
            // معالجة البيانات لفك مصفوفة doctors
            const processedData: any[] = [];
            
            data?.forEach((schedule: any) => {
                // التأكد من أن doctors مصفوفة (سواء كانت مخزنة كـ JSON أو نص)
                let doctorsList = [];
                try {
                    doctorsList = typeof schedule.doctors === 'string' ? JSON.parse(schedule.doctors) : schedule.doctors;
                } catch (e) {
                    doctorsList = [];
                }

                if (Array.isArray(doctorsList) && doctorsList.length > 0) {
                    doctorsList.forEach((doc: any) => {
                        processedData.push({
                            id: schedule.id,
                            date: schedule.date,
                            docName: doc.name || 'غير محدد',
                            specialty: doc.specialty || '-',
                            shiftType: doc.shift_type || 'نوبتجية', // نفترض وجود هذا الحقل في الـ JSON، أو نتركه افتراضي
                            notes: schedule.notes || ''
                        });
                    });
                } else {
                    // في حالة عدم وجود أطباء مسجلين في هذا اليوم ولكن السجل موجود
                    processedData.push({
                        id: schedule.id,
                        date: schedule.date,
                        docName: 'لا يوجد',
                        specialty: '-',
                        shiftType: '-',
                        notes: schedule.notes || ''
                    });
                }
            });

            return processedData;
        }
    });

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: `نوبتجيات_${month}`,
    });

    return (
        <div className="space-y-4 animate-in fade-in">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border no-print gap-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                        <CalendarRange className="w-6 h-6"/>
                    </div>
                    <div>
                        <h2 className="font-black text-lg text-gray-800">جدول النوبتجيات</h2>
                        <p className="text-xs text-gray-500 font-bold">استعراض وطباعة الجداول الشهرية</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <input 
                        type="month" 
                        value={month} 
                        onChange={(e) => setMonth(e.target.value)} 
                        className="p-2.5 bg-gray-50 border rounded-xl font-bold outline-none flex-1 md:w-auto text-gray-700" 
                    />
                    <button 
                        onClick={handlePrint} 
                        className="bg-gray-800 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-900 transition-colors shadow-lg"
                    >
                        <Printer className="w-4 h-4"/> طباعة
                    </button>
                </div>
            </div>

            {/* Table Area */}
            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-600"/></div>
            ) : (
                <div ref={printRef} className="bg-white p-4 md:p-8 rounded-[2rem] border shadow-sm print:shadow-none print:border-none print:w-full" dir="rtl">
                    
                    {/* ترويسة الطباعة */}
                    <div className="hidden print:flex flex-col items-center justify-center mb-8 border-b-2 border-black pb-4">
                        <h1 className="text-2xl font-black mb-2">جدول نوبتجيات شهر {new Date(month).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}</h1>
                        <p className="font-bold text-lg">إدارة شمال الجيزة - مركز غرب المطار</p>
                    </div>
                    
                    {schedules.length === 0 ? (
                        <div className="text-center py-16 flex flex-col items-center">
                            <AlertCircle className="w-12 h-12 text-gray-300 mb-3"/>
                            <p className="text-gray-500 font-bold">لا توجد نوبتجيات مسجلة لهذا الشهر.</p>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-gray-300 print:border-black">
                            <table className="w-full text-sm text-right border-collapse">
                                <thead className="bg-indigo-50 font-black text-indigo-900 border-b-2 border-gray-300 print:bg-gray-200 print:text-black print:border-black">
                                    <tr>
                                        <th className="p-3 border-l border-gray-300 print:border-black w-28 text-center">التاريخ</th>
                                        <th className="p-3 border-l border-gray-300 print:border-black w-24 text-center">اليوم</th>
                                        <th className="p-3 border-l border-gray-300 print:border-black">الموظف / الطبيب</th>
                                        <th className="p-3 border-l border-gray-300 print:border-black w-32 text-center">الوظيفة</th>
                                        <th className="p-3 border-l border-gray-300 print:border-black w-24 text-center">نوع النوبتجية</th>
                                        <th className="p-3 w-40 text-center">ملاحظات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {schedules.map((row: any, idx: number) => {
                                        const dateObj = new Date(row.date);
                                        const dayName = dateObj.toLocaleDateString('ar-EG', { weekday: 'long' });
                                        const isEven = idx % 2 === 0;
                                        
                                        return (
                                            <tr key={idx} className={`${isEven ? 'bg-white' : 'bg-gray-50'} print:bg-white border-b border-gray-200 print:border-black`}>
                                                <td className="p-2 border-l border-gray-300 print:border-black text-center font-mono font-bold text-gray-700 print:text-black">
                                                    {row.date}
                                                </td>
                                                <td className="p-2 border-l border-gray-300 print:border-black text-center font-bold text-gray-700 print:text-black">
                                                    {dayName}
                                                </td>
                                                <td className="p-2 border-l border-gray-300 print:border-black font-bold text-gray-900 print:text-black">
                                                    {row.docName}
                                                </td>
                                                <td className="p-2 border-l border-gray-300 print:border-black text-center text-xs font-bold text-gray-600 print:text-black">
                                                    {row.specialty}
                                                </td>
                                                <td className="p-2 border-l border-gray-300 print:border-black text-center text-xs font-bold">
                                                    {row.shiftType === 'evening' || row.shiftType === 'مسائي' ? 'مسائي 🌙' : 
                                                     row.shiftType === 'night' || row.shiftType === 'مبيت' ? 'مبيت 🛌' : row.shiftType}
                                                </td>
                                                <td className="p-2 text-center text-xs text-gray-500 print:text-black">
                                                    {row.notes}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* تذييل الطباعة */}
                    <div className="hidden print:flex justify-between items-center mt-12 px-8 font-bold text-sm">
                        <div className="text-center">
                            <p>مسؤول الجداول</p>
                            <p className="mt-6">....................</p>
                        </div>
                        <div className="text-center">
                            <p>مدير المركز</p>
                            <p className="mt-6">....................</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
