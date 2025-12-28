import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { FileBarChart, Printer, Search, Calendar, UserX, CheckCircle, Clock, Filter } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

type ReportType = 'daily' | 'monthly' | 'absence';

export default function ReportsTab() {
  const [activeReport, setActiveReport] = useState<ReportType>('daily');
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);

  // فلاتر البحث
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // لليومي والغياب
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // للشهري
  const [filterName, setFilterName] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // حضور، غياب، إجازة

  const componentRef = useRef(null); // مرجع للطباعة

  // دالة الطباعة
  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: `تقرير_${activeReport}_${activeReport === 'monthly' ? month : date}`,
  });

  // جلب البيانات الأساسية
  useEffect(() => {
    fetchData();
  }, [date, month, activeReport]);

  const fetchData = async () => {
    setLoading(true);
    
    // 1. جلب الموظفين
    const { data: emps } = await supabase.from('employees').select('*').neq('status', 'موقوف').order('name');
    if (emps) setEmployees(emps);

    // 2. جلب الحضور والإجازات حسب نوع التقرير
    if (activeReport === 'daily' || activeReport === 'absence') {
        const { data: att } = await supabase.from('attendance').select('*').eq('date', date);
        const { data: lvs } = await supabase.from('leave_requests').select('*')
            .eq('status', 'مقبول')
            .lte('start_date', date)
            .gte('end_date', date);
        
        if (att) setAttendance(att);
        if (lvs) setLeaves(lvs);

    } else if (activeReport === 'monthly') {
        const startOfMonth = `${month}-01`;
        const endOfMonth = `${month}-31`;
        
        const { data: att } = await supabase.from('attendance').select('*')
            .gte('date', startOfMonth)
            .lte('date', endOfMonth);
        
        // الإجازات التي تتقاطع مع هذا الشهر
        const { data: lvs } = await supabase.from('leave_requests').select('*')
            .eq('status', 'مقبول')
            .or(`start_date.gte.${startOfMonth},end_date.lte.${endOfMonth}`);

        if (att) setAttendance(att);
        if (lvs) setLeaves(lvs);
    }
    setLoading(false);
  };

  // --- معالجة البيانات للتقرير اليومي ---
  const dailyData = useMemo(() => {
      return employees.map(emp => {
          const empAtt = attendance.find(a => a.employee_id === emp.employee_id);
          const empLeave = leaves.find(l => l.employee_id === emp.employee_id);
          
          let status = 'غياب';
          let inTime = '-';
          let outTime = '-';

          if (empAtt) {
              status = 'حضور';
              const times = empAtt.times.split(/\s+/).filter(t => t.includes(':'));
              if (times.length > 0) inTime = times[0];
              if (times.length > 1) outTime = times[times.length - 1];
          } else if (empLeave) {
              status = 'إجازة'; // أو نوع الإجازة: empLeave.type
          }

          return { ...emp, status, inTime, outTime, leaveType: empLeave?.type };
      }).filter(item => {
          if (filterName && !item.name.includes(filterName)) return false;
          if (filterSpecialty !== 'all' && item.specialty !== filterSpecialty) return false;
          if (filterStatus !== 'all') {
              if (filterStatus === 'حضور' && item.status !== 'حضور') return false;
              if (filterStatus === 'غياب' && item.status !== 'غياب') return false;
              if (filterStatus === 'إجازة' && item.status !== 'إجازة') return false;
          }
          return true;
      });
  }, [employees, attendance, leaves, filterName, filterSpecialty, filterStatus]);

  // --- معالجة البيانات لتقرير الغياب (فلترة خاصة) ---
  const absenceData = useMemo(() => {
      // نفس منطق اليومي ولكن نعرض فقط الغياب
      return employees.map(emp => {
          const hasAtt = attendance.some(a => a.employee_id === emp.employee_id);
          const hasLeave = leaves.some(l => l.employee_id === emp.employee_id);
          
          if (!hasAtt && !hasLeave) {
              return { ...emp, status: 'غياب غير مبرر' };
          }
          return null;
      }).filter(Boolean).filter((item:any) => {
           if (filterName && !item.name.includes(filterName)) return false;
           if (filterSpecialty !== 'all' && item.specialty !== filterSpecialty) return false;
           return true;
      });
  }, [employees, attendance, leaves, filterName, filterSpecialty]);

  // --- معالجة البيانات للتقرير الشهري ---
  const monthlyData = useMemo(() => {
      return employees.map(emp => {
          const empAtts = attendance.filter(a => a.employee_id === emp.employee_id);
          // حساب تقريبي للإجازات (يحتاج لمنطق أدق للأيام المتداخلة، لكن هذا كافٍ للعرض)
          const empLeaves = leaves.filter(l => l.employee_id === emp.employee_id).length; 

          return {
              ...emp,
              daysPresent: empAtts.length,
              daysLeaves: empLeaves, // عدد مرات الإجازات وليس الأيام بالضرورة
              // الغياب = (أيام الشهر حتى اليوم - الجمعة - الحضور - الإجازات) *منطق تقريبي*
          };
      }).filter(item => {
           if (filterName && !item.name.includes(filterName)) return false;
           if (filterSpecialty !== 'all' && item.specialty !== filterSpecialty) return false;
           return true;
      });
  }, [employees, attendance, leaves, filterName, filterSpecialty]);


  // الإحصائيات العامة
  const stats = useMemo(() => {
      if (activeReport === 'daily') {
          return {
              total: employees.length,
              present: dailyData.filter(d => d.status === 'حضور').length,
              absent: dailyData.filter(d => d.status === 'غياب').length,
              leave: dailyData.filter(d => d.status === 'إجازة').length
          };
      } else if (activeReport === 'absence') {
          return { total: absenceData.length };
      }
      return { total: monthlyData.length };
  }, [dailyData, absenceData, monthlyData, activeReport, employees]);


  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4 no-print">
            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                <button onClick={() => setActiveReport('daily')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeReport === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>تقرير يومي</button>
                <button onClick={() => setActiveReport('monthly')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeReport === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>تقرير شهري</button>
                <button onClick={() => setActiveReport('absence')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeReport === 'absence' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}>تقرير الغياب</button>
            </div>
            
            <button onClick={handlePrint} className="bg-gray-800 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-900">
                <Printer className="w-5 h-5"/> طباعة التقرير
            </button>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-2xl border shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
            {activeReport !== 'monthly' ? (
                <Input type="date" label="التاريخ" value={date} onChange={setDate} />
            ) : (
                <Input type="month" label="الشهر" value={month} onChange={setMonth} />
            )}
            <Input label="اسم الموظف" placeholder="بحث..." value={filterName} onChange={setFilterName} />
            <Select label="التخصص" options={['all', ...Array.from(new Set(employees.map(e => e.specialty)))]} value={filterSpecialty} onChange={setFilterSpecialty} />
            {activeReport === 'daily' && (
                <Select label="الحالة" options={['all', 'حضور', 'غياب', 'إجازة']} value={filterStatus} onChange={setFilterStatus} />
            )}
        </div>

        {/* --- Report Content (Printable Area) --- */}
        <div ref={componentRef} className="bg-white p-8 rounded-[30px] border shadow-sm min-h-[600px] print:p-0 print:border-0 print:shadow-none print:w-full">
            
            {/* Print Header */}
            <div className="hidden print:flex flex-col items-center mb-8 border-b pb-4">
                <h1 className="text-2xl font-black">المركز الطبي الذكي</h1>
                <h2 className="text-xl font-bold mt-2">
                    {activeReport === 'daily' ? `تقرير الحضور والانصراف اليومي (${date})` : 
                     activeReport === 'monthly' ? `تقرير الحضور الشهري (${month})` : 
                     `تقرير الغياب اليومي (${date})`}
                </h2>
                <p className="text-sm text-gray-500 mt-1">تاريخ الطباعة: {new Date().toLocaleString('ar-EG')}</p>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {activeReport === 'daily' && (
                    <>
                        <div className="bg-gray-50 p-4 rounded-xl border text-center print:border-gray-300">
                            <span className="block text-2xl font-black text-blue-600">{stats.total}</span>
                            <span className="text-xs font-bold text-gray-500">إجمالي الموظفين</span>
                        </div>
                        <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center print:border-gray-300">
                            <span className="block text-2xl font-black text-green-600">{stats.present}</span>
                            <span className="text-xs font-bold text-green-700">حضور</span>
                        </div>
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center print:border-gray-300">
                            <span className="block text-2xl font-black text-red-600">{stats.absent}</span>
                            <span className="text-xs font-bold text-red-700">غياب</span>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-center print:border-gray-300">
                            <span className="block text-2xl font-black text-orange-600">{stats.leave}</span>
                            <span className="text-xs font-bold text-orange-700">إجازات</span>
                        </div>
                    </>
                )}
                {activeReport === 'absence' && (
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center print:border-gray-300 col-span-4">
                        <span className="block text-3xl font-black text-red-600">{stats.total}</span>
                        <span className="text-sm font-bold text-red-700">موظف متغيب بدون إذن</span>
                    </div>
                )}
            </div>

            {/* --- Tables --- */}
            
            {/* 1. Daily Table */}
            {activeReport === 'daily' && (
                <table className="w-full text-sm text-right border-collapse">
                    <thead>
                        <tr className="bg-gray-100 text-gray-700 print:bg-gray-200">
                            <th className="p-3 border">الكود</th>
                            <th className="p-3 border">الاسم</th>
                            <th className="p-3 border">التخصص</th>
                            <th className="p-3 border text-center">حضور</th>
                            <th className="p-3 border text-center">انصراف</th>
                            <th className="p-3 border text-center">الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dailyData.map((row:any) => (
                            <tr key={row.id} className="border-b print:border-gray-300">
                                <td className="p-3 border font-mono">{row.employee_id}</td>
                                <td className="p-3 border font-bold">{row.name}</td>
                                <td className="p-3 border text-gray-600">{row.specialty}</td>
                                <td className="p-3 border text-center font-mono">{row.inTime}</td>
                                <td className="p-3 border text-center font-mono">{row.outTime}</td>
                                <td className="p-3 border text-center">
                                    <span className={`px-2 py-1 rounded-md text-xs font-black ${
                                        row.status === 'حضور' ? 'bg-green-100 text-green-700 print:bg-transparent print:text-black' :
                                        row.status === 'غياب' ? 'bg-red-100 text-red-700 print:bg-transparent print:text-black' :
                                        'bg-orange-100 text-orange-700 print:bg-transparent print:text-black'
                                    }`}>
                                        {row.status === 'إجازة' && row.leaveType ? row.leaveType : row.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* 2. Monthly Table */}
            {activeReport === 'monthly' && (
                <table className="w-full text-sm text-right border-collapse">
                    <thead>
                        <tr className="bg-gray-100 text-gray-700 print:bg-gray-200">
                            <th className="p-3 border">الكود</th>
                            <th className="p-3 border">الاسم</th>
                            <th className="p-3 border">التخصص</th>
                            <th className="p-3 border text-center">أيام الحضور</th>
                            <th className="p-3 border text-center">الإجازات المقبولة</th>
                        </tr>
                    </thead>
                    <tbody>
                        {monthlyData.map((row:any) => (
                            <tr key={row.id} className="border-b print:border-gray-300">
                                <td className="p-3 border font-mono">{row.employee_id}</td>
                                <td className="p-3 border font-bold">{row.name}</td>
                                <td className="p-3 border text-gray-600">{row.specialty}</td>
                                <td className="p-3 border text-center font-bold text-green-600">{row.daysPresent}</td>
                                <td className="p-3 border text-center font-bold text-orange-600">{row.daysLeaves}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* 3. Absence Table */}
            {activeReport === 'absence' && (
                <table className="w-full text-sm text-right border-collapse">
                    <thead>
                        <tr className="bg-red-50 text-red-800 print:bg-gray-200 print:text-black">
                            <th className="p-3 border">الكود</th>
                            <th className="p-3 border">الاسم</th>
                            <th className="p-3 border">التخصص</th>
                            <th className="p-3 border">حالة العمل</th>
                            <th className="p-3 border text-center">الحالة اليوم</th>
                        </tr>
                    </thead>
                    <tbody>
                        {absenceData.map((row:any) => (
                            <tr key={row.id} className="border-b print:border-gray-300">
                                <td className="p-3 border font-mono">{row.employee_id}</td>
                                <td className="p-3 border font-bold">{row.name}</td>
                                <td className="p-3 border text-gray-600">{row.specialty}</td>
                                <td className="p-3 border">{row.status}</td>
                                <td className="p-3 border text-center font-black text-red-600">غياب غير مبرر</td>
                            </tr>
                        ))}
                        {absenceData.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-green-600 font-bold">لا يوجد غياب اليوم!</td></tr>
                        )}
                    </tbody>
                </table>
            )}

        </div>
    </div>
  );
}