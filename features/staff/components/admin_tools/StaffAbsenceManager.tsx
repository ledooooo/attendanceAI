import React, { useState, useMemo } from 'react';
import { supabase } from '../../../../supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { FileX, Search, Calendar, UserX, Loader2 } from 'lucide-react';
import { Input } from '../../../../components/ui/FormElements';

export default function StaffAbsenceManager() {
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [searchTerm, setSearchTerm] = useState('');

    // 1. جلب الموظفين وسجلات الحضور للشهر المحدد
    const { data, isLoading } = useQuery({
        queryKey: ['absence_report', selectedMonth],
        queryFn: async () => {
            // جلب الموظفين النشطين
            const { data: employees } = await supabase
                .from('employees')
                .select('id, name, employee_id, work_days, specialty')
                .eq('status', 'نشط');

            // جلب سجلات الحضور للشهر
            const startOfMonth = `${selectedMonth}-01`;
            const endOfMonth = `${selectedMonth}-31`;
            
            const { data: attendance } = await supabase
                .from('attendance')
                .select('employee_id, date')
                .gte('date', startOfMonth)
                .lte('date', endOfMonth);

            return { employees: employees || [], attendance: attendance || [] };
        }
    });

    // 2. حساب الغياب
    const absenceReport = useMemo(() => {
        if (!data?.employees) return [];

        const daysInMonth = new Date(selectedMonth.split('-')[0] as any, selectedMonth.split('-')[1] as any, 0).getDate();
        
        return data.employees.map(emp => {
            let absenceDays = 0;
            let workDaysList = Array.isArray(emp.work_days) ? emp.work_days : [];
            // تحويل أيام العمل من العربية للإنجليزية للمقارنة (تعتمد على طريقة تخزينك)
            // هذا مجرد مثال مبسط، يجب ضبطه حسب تخزينك لأيام العمل (السبت، الأحد...)

            // حساب الغياب التقريبي (كمثال: كل يوم عمل لم يسجل فيه حضور)
            // *ملاحظة: هذا يتطلب منطق دقيق للتواريخ، هنا سنعرض مجرد هيكل*
            
            // فلترة الحضور الخاص بالموظف
            const empAtt = data.attendance.filter(a => a.employee_id === emp.employee_id).length;
            
            // افتراض: يجب أن يحضر 22 يوم في الشهر، حضر منهم empAtt
            // (يمكنك تعديل المعادلة بناءً على جداول النوبتجيات لديك)
            const expectedDays = 22; // رقم تقريبي
            const absence = Math.max(0, expectedDays - empAtt);

            return {
                ...emp,
                attendanceCount: empAtt,
                absenceCount: absence // أو استبدله بمنطق دقيق حسب أيام العمل
            };
        }).filter(emp => 
            emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            emp.employee_id.includes(searchTerm)
        );
    }, [data, selectedMonth, searchTerm]);

    if (isLoading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-red-600"/></div>;

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header & Controls */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-red-50 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                        <FileX className="w-6 h-6"/>
                    </div>
                    <div>
                        <h2 className="font-black text-gray-800">تقرير الغياب والانقطاع</h2>
                        <p className="text-xs text-gray-500 font-bold">متابعة أيام الغياب للموظفين النشطين</p>
                    </div>
                </div>
                
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                        <input 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="بحث بالاسم..."
                            className="w-full pr-9 pl-4 py-2 rounded-xl border bg-gray-50 outline-none text-sm font-bold"
                        />
                    </div>
                    <input 
                        type="month" 
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="p-2 rounded-xl border bg-gray-50 outline-none text-sm font-bold"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                <table className="w-full text-sm text-right">
                    <thead className="bg-red-50 text-red-800 border-b border-red-100">
                        <tr>
                            <th className="p-4 font-black">الموظف</th>
                            <th className="p-4 font-black text-center">التخصص</th>
                            <th className="p-4 font-black text-center">أيام الحضور</th>
                            <th className="p-4 font-black text-center">أيام الغياب (التقريبي)</th>
                            <th className="p-4 font-black text-center">الحالة</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {absenceReport?.map((emp) => (
                            <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4 font-bold text-gray-800">
                                    {emp.name}
                                    <span className="block text-[10px] text-gray-400 font-mono">{emp.employee_id}</span>
                                </td>
                                <td className="p-4 text-center text-xs font-bold text-gray-500">{emp.specialty}</td>
                                <td className="p-4 text-center font-bold text-green-600">{emp.attendanceCount} يوم</td>
                                <td className="p-4 text-center font-black text-red-600 bg-red-50/50">
                                    {emp.absenceCount > 0 ? `${emp.absenceCount} يوم` : '-'}
                                </td>
                                <td className="p-4 text-center">
                                    {emp.absenceCount > 5 ? (
                                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1">
                                            <UserX className="w-3 h-3"/> تجاوز الحد
                                        </span>
                                    ) : (
                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold">منتظم</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
