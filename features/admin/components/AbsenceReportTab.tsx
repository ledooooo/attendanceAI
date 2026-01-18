import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Printer, Search, FileX, Loader2, AlertCircle } from 'lucide-react';

export default function AbsenceReportTab() {
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [reportData, setReportData] = useState<any[]>([]);

  // 🛠️ دالة تحويل التاريخ من M/D/YYYY إلى YYYY-MM-DD يدوياً لتجنب مشاكل التوقيت
  const normalizeDbDate = (dateStr: string) => {
    if (!dateStr) return '';
    // إذا كان التاريخ أصلاً YYYY-MM-DD
    if (dateStr.includes('-')) return dateStr;
    
    // إذا كان M/D/YYYY (مثل 11/19/2025)
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return dateStr;
  };

  // دالة توليد تواريخ الحلقة التكرارية
  const toStandardDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const generateReport = async () => {
    setLoading(true);
    setReportData([]);

    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0); 
      
      // توسيع النطاق قليلاً لضمان جلب التواريخ بتنسيقات مختلفة
      const startDateStr = toStandardDate(startDate); 
      const endDateStr = toStandardDate(endDate);

      // 1. جلب الموظفين
      const { data: employees } = await supabase
        .from('employees')
        .select('id, employee_id, name, specialty')
        .eq('status', 'نشط') //
        .order('name');

      if (!employees) throw new Error("لا يوجد موظفين");

      // 2. جلب الحضور (بدون فلترة دقيقة بالتاريخ هنا، سنفلتر بالكود)
      // نجلب الشهر كاملاً بزيادة أيام قبله وبعده لتغطية اختلاف التنسيق
      const fetchStart = `${year}-${String(month).padStart(2, '0')}-01`; 
      // أو يمكننا جلب كل شيء للموظفين المحددين وفلترتها محلياً إذا كانت البيانات ليست ضخمة جداً
      // للأمان: نعتمد على الفلترة اللاحقة
      const { data: attendance } = await supabase
        .from('attendance')
        .select('employee_id, date, times'); 
      
      // 3. جلب الإجازات
      const { data: leaves } = await supabase
        .from('leave_requests')
        .select('employee_id, start_date, end_date')
        .neq('status', 'مرفوض');

      // 4. جلب العطلات
      const { data: settings } = await supabase
        .from('settings')
        .select('holidays_date')
        .single();

      const holidays = settings?.holidays_date || []; //

      // --- المعالجة ---
      const attendanceMap = new Map();
      
      attendance?.forEach((r: any) => {
        // أهم خطوة: توحيد صيغة التاريخ
        const stdDate = normalizeDbDate(r.date);
        
        // التحقق هل التاريخ يقع في الشهر المحدد؟
        if (stdDate >= startDateStr && stdDate <= endDateStr) {
           const key = `${r.employee_id}_${stdDate}`;
           // نعتبره حضوراً فقط إذا كان هناك وقت مسجل
           const hasTime = r.times && r.times.trim().length > 0;
           if (hasTime) {
               attendanceMap.set(key, true);
           }
        }
      });

      const finalReport: any[] = [];

      for (const emp of employees) {
        const absentDays: string[] = [];

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateStr = toStandardDate(d);
          const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });

          // استبعاد الجمعة
          if (dayName === 'Friday') continue;

          // استبعاد العطلات الرسمية
          if (holidays.includes(dateStr)) continue;

          // استبعاد الإجازات
          const isOnLeave = leaves?.some((leave: any) => 
            leave.employee_id === emp.employee_id && 
            dateStr >= leave.start_date && dateStr <= leave.end_date
          );
          if (isOnLeave) continue;

          // فحص الحضور
          const key = `${emp.employee_id}_${dateStr}`;
          if (!attendanceMap.has(key)) {
             absentDays.push(new Date(dateStr).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric', weekday: 'short' }));
          }
        }

        if (absentDays.length > 0) {
          finalReport.push({
            ...emp,
            absentDays,
            totalAbsence: absentDays.length
          });
        }
      }

      setReportData(finalReport);

    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء إنشاء التقرير");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      {/* رأس الصفحة */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 no-print">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
              <FileX className="text-red-600" /> تقرير الغياب الشهري
            </h2>
            <p className="text-sm text-gray-500 mt-1">حصر الموظفين المتغيبين (بدون إذن أو عطلات)</p>
          </div>

          <div className="flex gap-3 items-center w-full md:w-auto">
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border border-gray-300 rounded-xl px-4 py-2 outline-none focus:border-emerald-500"
            />
            <button 
              onClick={generateReport}
              disabled={loading}
              className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin w-4 h-4"/> : <Search className="w-4 h-4"/>}
              عرض
            </button>
            {reportData.length > 0 && (
              <button 
                onClick={() => window.print()}
                className="bg-gray-800 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-900"
              >
                <Printer className="w-4 h-4"/> طباعة
              </button>
            )}
          </div>
        </div>
      </div>

      {/* الجدول */}
      {reportData.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print-container">
          <div className="hidden print-header text-center p-4 border-b-2 border-gray-800 mb-4">
            <h1 className="text-2xl font-black text-gray-900">تقرير الغياب الشهري</h1>
            <p className="text-gray-600 font-bold">عن شهر: {selectedMonth}</p>
          </div>

          <table className="w-full text-right" id="absence-table">
            <thead className="bg-gray-50 border-b-2 border-gray-200 text-gray-600 font-black text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3 w-48">الموظف</th>
                <th className="px-4 py-3 w-32">التخصص</th>
                <th className="px-4 py-3 w-20 text-center text-red-600">أيام الغياب</th>
                <th className="px-4 py-3">تواريخ الغياب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm font-medium text-gray-700">
              {reportData.map((emp, idx) => (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors break-inside-avoid">
                  <td className="px-4 py-2">{idx + 1}</td>
                  <td className="px-4 py-2 font-bold text-gray-900">
                    {emp.name}
                    <span className="block text-[10px] text-gray-400 font-normal">{emp.employee_id}</span>
                  </td>
                  <td className="px-4 py-2">{emp.specialty}</td>
                  <td className="px-4 py-2 text-center font-black text-red-600 bg-red-50 rounded-lg">{emp.totalAbsence}</td>
                  <td className="px-4 py-2 text-xs leading-relaxed text-gray-500">
                    {emp.absentDays.join(' ، ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="hidden print-footer mt-8 pt-4 border-t border-gray-300 flex justify-between text-xs text-gray-500">
            <span>تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</span>
            <span>توقيع المدير: ..............................</span>
          </div>
        </div>
      ) : (
        !loading && (
          <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200 text-gray-400">
            <AlertCircle className="w-12 h-12 mb-3 opacity-20"/>
            <p>اختر الشهر واضغط عرض لاستخراج التقرير</p>
          </div>
        )
      )}

      {/* تنسيقات الطباعة */}
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: white; -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-header, .print-footer { display: block !important; }
          .print-container { box-shadow: none; border: none; }
          table { width: 100%; border-collapse: collapse; font-size: 10pt; }
          th, td { border: 1px solid #ddd; padding: 4px; }
          thead th { background-color: #f3f4f6 !important; color: black !important; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          aside, header, nav { display: none !important; }
          main { margin: 0; padding: 0; height: auto; overflow: visible; }
        }
      `}</style>
    </div>
  );
}
