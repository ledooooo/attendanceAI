import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../supabaseClient';
import { ExcelUploadButton } from '../../../../components/ui/ExcelUploadButton';
import { Search, Printer, Upload, Calendar, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StaffAttendanceManager() {
    const queryClient = useQueryClient();
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [searchTerm, setSearchTerm] = useState('');

    // جلب بيانات الحضور مع أسماء الموظفين
    const { data: attendance = [], isLoading } = useQuery({
        queryKey: ['staff_admin_attendance', selectedMonth],
        queryFn: async () => {
            // نستخدم select لجلب اسم الموظف من جدول الموظفين عبر العلاقة (Join)
            const { data, error } = await supabase
                .from('attendance')
                .select('*, employees(name, employee_id)')
                .ilike('date', `${selectedMonth}%`)
                .order('date', { ascending: false });
            
            if (error) throw error;
            return data;
        }
    });

    // معالجة ملف البصمة (Upload)
    const handleUpload = async (data: any[]) => {
        const loadingToast = toast.loading('جاري معالجة الملف...');
        try {
            const formattedData = data.map((row: any) => ({
                employee_id: String(row['AC-No.'] || row['code'] || row['الكود']),
                date: row['Date'] || row['تاريخ'],
                check_in: row['Clock In'] || row['حضور'] || null,
                check_out: row['Clock Out'] || row['انصراف'] || null,
                status: row['Clock In'] ? 'حضور' : 'غائب'
            })).filter(r => r.employee_id && r.date);

            const { error } = await supabase.from('attendance').upsert(formattedData, { onConflict: 'employee_id,date' });
            if (error) throw error;

            toast.success('تم رفع البصمة بنجاح', { id: loadingToast });
            queryClient.invalidateQueries({ queryKey: ['staff_admin_attendance'] });
        } catch (err) {
            toast.error('حدث خطأ أثناء الرفع', { id: loadingToast });
        }
    };

    // الفلترة بالبحث
    const filtered = attendance.filter((record: any) => 
        record.employees?.name?.includes(searchTerm) || 
        record.employees?.employee_id?.includes(searchTerm)
    );

    return (
        <div className="space-y-6">
            {/* شريط الأدوات */}
            <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row gap-4 items-center no-print">
                <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border">
                    <Calendar className="w-5 h-5 text-gray-500"/>
                    <input 
                        type="month" 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-transparent outline-none font-bold text-gray-700"
                    />
                </div>
                
                <div className="relative flex-1 w-full">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"/>
                    <input 
                        type="text" 
                        placeholder="بحث باسم الموظف..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pr-9 pl-4 py-2.5 rounded-xl border outline-none text-sm"
                    />
                </div>

                <div className="flex gap-2">
                    <ExcelUploadButton onData={handleUpload} label="رفع ملف البصمة" />
                    <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm hover:bg-blue-700">
                        <Printer className="w-4 h-4"/> طباعة
                    </button>
                </div>
            </div>

            {/* الجدول */}
            <div className="bg-white rounded-3xl border shadow-sm overflow-hidden p-6 print:border-none print:shadow-none">
                <div className="hidden print:block text-center mb-6 pb-4 border-b">
                    <h2 className="text-xl font-black">تقرير الحضور والانصراف</h2>
                    <p className="text-sm">شهر: {selectedMonth}</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-50 font-bold border-b text-gray-600">
                            <tr>
                                <th className="p-3">التاريخ</th>
                                <th className="p-3">الموظف</th>
                                <th className="p-3 text-center">حضور</th>
                                <th className="p-3 text-center">انصراف</th>
                                <th className="p-3 text-center">الحالة</th>
                                <th className="p-3 text-center">ساعات العمل</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="animate-spin mx-auto"/></td></tr> :
                             filtered.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-gray-400">لا توجد بيانات لهذا الشهر</td></tr> :
                             filtered.map((record: any) => (
                                <tr key={record.id} className="hover:bg-gray-50">
                                    <td className="p-3 font-mono">{record.date}</td>
                                    <td className="p-3 font-bold">
                                        {record.employees?.name} 
                                        <span className="text-[10px] text-gray-400 block font-normal">{record.employees?.employee_id}</span>
                                    </td>
                                    <td className="p-3 text-center font-mono text-green-600">{record.check_in ? record.check_in.slice(0,5) : '-'}</td>
                                    <td className="p-3 text-center font-mono text-red-600">{record.check_out ? record.check_out.slice(0,5) : '-'}</td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${record.status === 'حضور' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {record.status}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center font-mono font-bold">{record.work_hours || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
