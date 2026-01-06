import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { Printer, Calendar, Filter, FileSpreadsheet, Download, RefreshCw, AlertCircle } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';

type ReportType = 'daily' | 'monthly' | 'absence';

export default function ReportsTab() {
  const [activeReport, setActiveReport] = useState<ReportType>('daily');
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);

  // فلاتر البحث
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterName, setFilterName] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('all');
  const [filterAttendanceStatus, setFilterAttendanceStatus] = useState('all');
  const [filterJobStatus, setFilterJobStatus] = useState('all');

  const componentRef = useRef(null);

  // دالة الطباعة
  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: `تقرير_${activeReport}_${activeReport === 'monthly' ? month : date}`,
  });

  useEffect(() => {
    fetchData();
  }, [date, month, activeReport]);

  const fetchData = async () => {
    setLoading(true);
    try {
        // 1. جلب الموظفين
        const { data: emps } = await supabase.from('employees').select('*').order('name');
        if (emps) setEmployees(emps);

        // 2. جلب الحضور والإجازات بناءً على نوع التقرير
        if (activeReport === 'daily' || activeReport === 'absence') {
            const { data: att } = await supabase.from('attendance').select('*').eq('date', date);
            const { data: lvs } = await supabase.from('leave_requests').select('*')
                .eq('status', 'مقبول')
                .lte('start_date', date)
                .gte('end_date', date);
            
            setAttendance(att || []);
            setLeaves(lvs || []);

        } else if (activeReport === 'monthly') {
            const startOfMonth = `${month}-01`;
            const d = new Date(month);
            const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            const endOfMonth = `${month}-${lastDay}`;
            
            const { data: att } = await supabase.from('attendance').select('*')
                .gte('date', startOfMonth)
                .lte('date', endOfMonth);
            
            const { data: lvs } = await supabase.from('leave_requests').select('*')
                .eq('status', 'مقبول')
                .or(`start_date.gte.${startOfMonth},end_date.lte.${endOfMonth}`);

            setAttendance(att || []);
            setLeaves(lvs || []);
        }
    } catch (err) {
        console.error("Error fetching report data:", err);
    } finally {
        setLoading(false);
    }
  };

  // --- 1. الإحصائيات الخام (دقيقة وغير متأثرة بالفلترة الحالية) ---
  const stats = useMemo(() => {
    const total = employees.length;
    const present = attendance.length;
    const leave = leaves.length;
    const absent = Math.max(0, total - (present + leave));

    return { total, present, leave, absent };
  }, [employees, attendance, leaves]);

  // --- 2. معالجة البيانات: التقرير اليومي ---
  const dailyData = useMemo(() => {
      return employees.map(emp => {
          const empAtt = attendance.find(a => a.employee_id === emp.employee_id);
          const empLeave = leaves.find(l => l.employee_id === emp.employee_id);
          
          let reportStatus = 'غياب';
          let inTime = '-';
          let outTime = '-';

          if (empAtt) {
              reportStatus = 'حضور';
              const times = empAtt.times ? empAtt.times.split(/\s+/).filter(t => t.includes(':')) : [];
              if (times.length > 0) inTime = times[0];
              if (times.length > 1) outTime = times[times.length - 1];
          } else if (empLeave) {
              reportStatus = 'إجازة';
          }

          return { 
              ...emp, 
              jobStatus: emp.status,
              reportStatus,
              inTime, 
              outTime, 
              leaveType: empLeave?.type 
          };
      }).filter((item: any) => {
          if (filterName && !item.name.includes(filterName)) return false;
          if (filterSpecialty !== 'all' && item.specialty !== filterSpecialty) return false;
          if (filterJobStatus !== 'all' && item.jobStatus !== filterJobStatus) return false;
          
          if (filterAttendanceStatus !== 'all') {
              if (filterAttendanceStatus === 'حضور' && item.reportStatus !== 'حضور') return false;
              if (filterAttendanceStatus === 'غياب' && item.reportStatus !== 'غياب') return false;
              if (filterAttendanceStatus === 'إجازة' && item.reportStatus !== 'إجازة') return false;
          }
          return true;
      });
  }, [employees, attendance, leaves, filterName, filterSpecialty, filterAttendanceStatus, filterJobStatus]);

  // --- 3. معالجة البيانات: تقرير الغياب (يعتمد على نتيجة اليومي المفلترة ليكون متناسقاً) ---
  const absenceData = useMemo(() => {
      return dailyData.filter(d => d.reportStatus === 'غياب');
  }, [dailyData]);

  // --- 4. معالجة البيانات: التقرير الشهري ---
  const monthlyData = useMemo(() => {
      return employees.map(emp => {
          const empAtts = attendance.filter(a => a.employee_id === emp.employee_id).length;
          const empLeaves = leaves.filter(l => l.employee_id === emp.employee_id).length; 

          return {
              ...emp,
              jobStatus: emp.status,
              daysPresent: empAtts,
              daysLeaves: empLeaves,
          };
      }).filter((item: any) => {
           if (filterName && !item.name.includes(filterName)) return false;
           if (filterSpecialty !== 'all' && item.specialty !== filterSpecialty) return false;
           if (filterJobStatus !== 'all' && item.jobStatus !== filterJobStatus) return false;
           return true;
      });
  }, [employees, attendance, leaves, filterName, filterSpecialty, filterJobStatus]);

  // دالة التصدير للإكسيل
  const handleExportExcel = () => {
    let dataToExport: any[] = [];
    let fileName = '';

    if (activeReport === 'daily') {
        dataToExport = dailyData.map(row => ({
            'الكود': row.employee_id,
            'الاسم': row.name,
            'التخصص': row.specialty,
            'حالة القيد': row.jobStatus,
            'حضور': row.inTime,
            'انصراف': row.outTime,
            'الحالة': row.reportStatus === 'إجازة' ? row.leaveType : row.reportStatus
        }));
        fileName = `Daily_Report_${date}`;
    } else if (activeReport === 'monthly') {
        dataToExport = monthlyData.map(row => ({
            'الكود': row.employee_id,
            'الاسم': row.name,
            'التخصص': row.specialty,
            'أيام الحضور': row.daysPresent,
            'عدد الإجازات': row.daysLeaves
        }));
        fileName = `Monthly_Report_${month}`;
    } else {
        dataToExport = absenceData.map(row => ({
            'الكود': row.employee_id,
            'الاسم': row.name,
            'التخصص': row.specialty,
            'حالة القيد': row.jobStatus,
            'الحالة': 'غياب غير مبرر'
        }));
        fileName = `Absence_Report_${date}`;
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Controls Bar */}
        <div className="flex flex-col xl:flex-row justify-between items-center border-b pb-4 gap-4 no-print">
            <div className="flex bg-gray-100 p-1.5 rounded-xl shadow-inner overflow-x-auto max-w-full">
                <button onClick={() => setActiveReport('daily')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeReport === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>تقرير يومي</button>
                <button onClick={() => setActiveReport('monthly')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeReport === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>تقرير شهري</button>
                <button onClick={() => setActiveReport('absence')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeReport === 'absence' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>تقرير الغياب</button>
            </div>
            
            <div className="flex gap-2 w-full xl:w-auto">
                <button onClick={() => fetchData()} disabled={loading} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50">
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}/>
                </button>
                <button onClick={handleExportExcel} className="flex-1 xl:flex-none justify-center bg-green-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 shadow-lg shadow-green-200 transition-all">
                    <FileSpreadsheet className="w-5 h-5"/> تصدير Excel
                </button>
                <button onClick={handlePrint} className="flex-1 xl:flex-none justify-center bg-gray-800 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-900 shadow-lg shadow-gray-300 transition-all">
                    <Printer className="w-5 h-5"/> طباعة
                </button>
            </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-5 rounded-2xl border shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 no-print">
            <div className="flex items-center gap-2 col-span-1 md:col-span-2 lg:col-span-5 text-gray-500 font-bold border-b pb-2 mb-2">
                <Filter className="w-4 h-4"/> أدوات الفلترة والبحث
            </div>
            
            {activeReport !== 'monthly' ? (
                <Input type="date" label="التاريخ" value={date} onChange={setDate} />
            ) : (
                <Input type="month" label="الشهر" value={month} onChange={setMonth} />
            )}
            
            <Input label="بحث بالاسم" placeholder="اسم الموظف..." value={filterName} onChange={setFilterName} />
            
            <Select label="التخصص" options={['all', ...Array.from(new Set(employees.map(e => e.specialty)))]} value={filterSpecialty} onChange={setFilterSpecialty} />
            
            <Select label="حالة القيد" options={['all', 'active', 'suspended']} value={filterJobStatus} onChange={setFilterJobStatus} />

            {activeReport === 'daily' && (
                <Select label="حالة الحضور" options={['all', 'حضور', 'غياب', 'إجازة']} value={filterAttendanceStatus} onChange={setFilterAttendanceStatus} />
            )}
        </div>

        {/* --- Report Content (Printable Area) --- */}
        <div ref={componentRef} className="bg-white p-8 rounded-[30px] border shadow-sm min-h-[600px] print:p-4 print:border-0 print:shadow-none print:w-full">
            
            {/* Print Header */}
            <div className="hidden print:flex flex-col items-center mb-8 border-b-2 border-gray-800 pb-4 text-center">
                <h1 className="text-3xl font-black text-gray-900">ادارة شمال الجيزة - مركز غرب المطار</h1>
                <h2 className="text-xl font-bold mt-2 text-gray-700">
                    {activeReport === 'daily' ? `تقرير الحضور والانصراف اليومي (${new Date(date).toLocaleDateString('ar-EG')})` : 
                     activeReport === 'monthly' ? `تقرير الحضور الشهري (${month})` : 
                     `تقرير المتغيبين (${new Date(date).toLocaleDateString('ar-EG')})`}
                </h2>
                <div className="flex justify-between w-full mt-4 text-xs text-gray-500 font-mono">
                    <span>تاريخ الطباعة: {new Date().toLocaleString('ar-EG')}</span>
                    <span>المستخدم: الإدارة</span>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {activeReport === 'daily' && (
                    <>
                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-center print:border-gray-300">
                            <span className="block text-3xl font-black text-blue-600">{stats.total}</span>
                            <span className="text-xs font-bold text-gray-500">إجمالي الموظفين</span>
                        </div>
                        <div className="bg-green-50 p-4 rounded-2xl border border-green-100 text-center print:border-gray-300">
                            <span className="block text-3xl font-black text-green-600">{stats.present}</span>
                            <span className="text-xs font-bold text-green-700">حضور</span>
                        </div>
                        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-center print:border-gray-300">
                            <span className="block text-3xl font-black text-red-600">{stats.absent}</span>
                            <span className="text-xs font-bold text-red-700">غياب</span>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 text-center print:border-gray-300">
                            <span className="block text-3xl font-black text-orange-600">{stats.leave}</span>
                            <span className="text-xs font-bold text-orange-700">إجازات</span>
                        </div>
                    </>
                )}
                {activeReport === 'absence' && (
                    <div className="bg-red-50 p-6 rounded-2xl border border-red-200 text-center print:border-gray-300 col-span-4 shadow-sm">
                        <span className="block text-4xl font-black text-red-600 mb-1">{stats.absent}</span>
                        <span className="text-sm font-bold text-red-800">موظف متغيب اليوم (بدون إجازة رسمية)</span>
                    </div>
                )}
                {activeReport === 'monthly' && (
                     <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-200 text-center print:border-gray-300 col-span-4 shadow-sm">
                        <span className="block text-4xl font-black text-indigo-600 mb-1">{stats.total}</span>
                        <span className="text-sm font-bold text-indigo-800">إجمالي الموظفين المدرجين بالتقرير الشهري</span>
                    </div>
                )}
            </div>

            {/* --- Tables Section --- */}
            
            {/* 1. Daily Table */}
            {activeReport === 'daily' && (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm text-right border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-gray-100 text-gray-700 print:bg-gray-200 border-b-2 border-gray-200">
                                <th className="p-4 border-l">الكود</th>
                                <th className="p-4 border-l">الاسم</th>
                                <th className="p-4 border-l">التخصص</th>
                                <th className="p-4 border-l">حالة القيد</th>
                                <th className="p-4 border-l text-center">وقت الحضور</th>
                                <th className="p-4 border-l text-center">وقت الانصراف</th>
                                <th className="p-4 text-center">الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dailyData.map((row: any, index: number) => (
                                <tr key={row.id || index} className={`hover:bg-gray-50 border-b last:border-0 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                    <td className="p-3 border-l font-mono text-gray-500">{row.employee_id}</td>
                                    <td className="p-3 border-l font-bold text-gray-800">{row.name}</td>
                                    <td className="p-3 border-l text-gray-600">{row.specialty}</td>
                                    <td className="p-3 border-l">
                                        <span className={`px-2 py-0.5 rounded text-[10px] ${row.jobStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {row.jobStatus === 'active' ? 'نشط' : row.jobStatus}
                                        </span>
                                    </td>
                                    <td className="p-3 border-l text-center font-mono text-blue-600 font-bold" dir="ltr">{row.inTime}</td>
                                    <td className="p-3 border-l text-center font-mono text-red-600 font-bold" dir="ltr">{row.outTime}</td>
                                    <td className="p-3 text-center">
                                        <span className={`px-3 py-1 rounded-full text-xs font-black inline-flex items-center gap-1 ${
                                            row.reportStatus === 'حضور' ? 'bg-green-100 text-green-700 print:border print:border-green-600' :
                                            row.reportStatus === 'غياب' ? 'bg-red-100 text-red-700 print:border print:border-red-600' :
                                            'bg-orange-100 text-orange-700 print:border print:border-orange-600'
                                        }`}>
                                            {row.reportStatus === 'إجازة' && row.leaveType ? row.leaveType : row.reportStatus}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 2. Monthly Table */}
            {activeReport === 'monthly' && (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm text-right border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-gray-100 text-gray-700 print:bg-gray-200 border-b-2 border-gray-200">
                                <th className="p-4 border-l">الكود</th>
                                <th className="p-4 border-l">الاسم</th>
                                <th className="p-4 border-l">التخصص</th>
                                <th className="p-4 border-l">حالة القيد</th>
                                <th className="p-4 border-l text-center">أيام الحضور</th>
                                <th className="p-4 text-center">الإجازات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthlyData.map((row: any, index: number) => (
                                <tr key={row.id || index} className={`hover:bg-gray-50 border-b last:border-0 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                    <td className="p-3 border-l font-mono text-gray-500">{row.employee_id}</td>
                                    <td className="p-3 border-l font-bold text-gray-800">{row.name}</td>
                                    <td className="p-3 border-l text-gray-600">{row.specialty}</td>
                                    <td className="p-3 border-l text-xs">{row.jobStatus}</td>
                                    <td className="p-3 border-l text-center">
                                        <span className="inline-block w-8 h-8 rounded-full bg-green-100 text-green-700 leading-8 font-black">{row.daysPresent}</span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className={`inline-block w-8 h-8 rounded-full leading-8 font-black ${row.daysLeaves > 0 ? 'bg-orange-100 text-orange-700' : 'text-gray-300'}`}>
                                            {row.daysLeaves}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 3. Absence Table */}
            {activeReport === 'absence' && (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm text-right border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-red-50 text-red-900 print:bg-gray-200 border-b-2 border-red-100">
                                <th className="p-4 border-l border-red-100">الكود</th>
                                <th className="p-4 border-l border-red-100">الاسم</th>
                                <th className="p-4 border-l border-red-100">التخصص</th>
                                <th className="p-4 border-l border-red-100">حالة القيد</th>
                                <th className="p-4 text-center">الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {absenceData.map((row: any, index: number) => (
                                <tr key={row.id || index} className={`hover:bg-red-50/30 border-b last:border-0 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                    <td className="p-3 border-l font-mono text-gray-500">{row.employee_id}</td>
                                    <td className="p-3 border-l font-bold text-gray-800">{row.name}</td>
                                    <td className="p-3 border-l text-gray-600">{row.specialty}</td>
                                    <td className="p-3 border-l text-xs">{row.jobStatus}</td>
                                    <td className="p-3 text-center font-black text-red-600 bg-red-50">غياب غير مبرر</td>
                                </tr>
                            ))}
                            {absenceData.length === 0 && <tr><td colSpan={5} className="p-12 text-center text-green-600 font-bold text-lg bg-green-50">✨ لا يوجد غياب اليوم! ✨</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    </div>
  );
}
