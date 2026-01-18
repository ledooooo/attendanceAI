import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Calendar, Printer, Search, FileX, Loader2, AlertCircle } from 'lucide-react';

export default function AbsenceReportTab() {
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [reportData, setReportData] = useState<any[]>([]);

  // دالة توحيد التاريخ (لضمان التطابق)
  const toStandardDate = (d: Date) => {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };

  const generateReport = async () => {
    setLoading(true);
    setReportData([]);

    try {
      // 1. تحديد بداية ونهاية الشهر المختار
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0); // آخر يوم في الشهر
      
      const startDateStr = toStandardDate(startDate);
      const endDateStr = toStandardDate(endDate);

      // 2. جلب جميع الموظفين النشطين
      const { data: employees } = await supabase
        .from('employees')
        .select('id, employee_id, name, specialty')
        .eq('status', 'نشط') // تأكد أن الحالة تطابق قاعدة بياناتك
        .order('name');

      if (!employees) throw new Error("لا يوجد موظفين");

      // 3. جلب جميع سجلات الحضور لهذا الشهر دفعة واحدة
      const { data: attendance } = await supabase
        .from('attendance')
        .select('employee_id, date, times')
        .gte('date', startDateStr)
        .lte('date', endDateStr);

      // 4. جلب جميع الإجازات المقبولة في هذا الشهر
      const { data: leaves } = await supabase
        .from('leave_requests')
        .select('employee_id, start_date, end_date')
        .neq('status', 'مرفوض')
        .or(`start_date.lte.${endDateStr},end_date.gte.${startDateStr}`);

      // 5. جلب العطلات الرسمية
      const { data: settings } = await supabase
        .from('settings')
        .select('holidays_date')
        .single();

      const holidays = settings?.holidays_date || [];

      // --- مرحلة المعالجة (في الذاكرة لتسريع الأداء) ---
      
      // تحويل الحضور إلى Map لسهولة البحث: Key = "EmpID_Date"
      const attendanceMap = new Map();
      attendance?.forEach((r: any) => {
        // توحيد التاريخ القادم من القاعدة
        const stdDate = new Date(r.date).toISOString().split('T')[0]; 
        const key = `${r.employee_id}_${stdDate}`;
        const hasTime = r.times && r.times.trim().length > 0;
        attendanceMap.set(key, hasTime); // true = حضر, false = سجل فارغ (غياب)
      });

      const finalReport: any[] = [];

      // المرور على كل موظف
      for (const emp of employees) {
        const absentDays: string[] = [];

        // المرور على كل يوم في الشهر
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateStr = toStandardDate(d);
          const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });

          // أ) استبعاد الجمعة
          if (dayName === 'Friday') continue;

          // ب) استبعاد العطلات الرسمية
          if (holidays.includes(dateStr)) continue;

          // ج) استبعاد الإجازات
          const isOnLeave = leaves?.some((leave: any) => 
            leave.employee_id === emp.employee_id && 
            dateStr >= leave.start_date && dateStr <= leave.end_date
          );
          if (isOnLeave) continue;

          // د) فحص الحضور
          const key = `${emp.employee_id}_${dateStr}`;
          const isPresent = attendanceMap.get(key);

          // إذا لم يكن موجوداً في Map نهائياً (undefined) أو موجود وقيمته false (حقل فارغ)
          if (isPresent !== true) {
            absentDays.push(new Date(dateStr).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' }));
          }
        }

        // إضافة الموظف للتقرير فقط إذا كان لديه غياب
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
      
      {/* رأس الصفحة وأدوات التحكم (تختفي عند الطباعة) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 no-print">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
              <FileX className="text-red-600" /> تقرير الغياب الشهري
            </h2>
            <p className="text-sm text-gray-500 mt-1">حصر الموظفين المتغيبين (بدون إذن أو عطلات) خلال الشهر</p>
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

      {/* منطقة التقرير (جدول) */}
      {reportData.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print-container">
          
          {/* ترويسة الطباعة فقط */}
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
          
          {/* تذييل الطباعة */}
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

      {/* تنسيقات الطباعة A4 */}
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: white; -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-header, .print-footer { display: block !important; }
          .print-container { box-shadow: none; border: none; }
          
          /* تحسين الجدول للطباعة */
          table { width: 100%; border-collapse: collapse; font-size: 11pt; }
          th, td { border: 1px solid #ddd; padding: 6px; }
          thead th { background-color: #f3f4f6 !important; color: black !important; }
          
          /* منع قص الصفوف في نهاية الصفحة */
          tr { break-inside: avoid; page-break-inside: avoid; }
          
          /* إخفاء القوائم الجانبية والعناصر الأخرى في التطبيق */
          aside, header, nav { display: none !important; }
          main { margin: 0; padding: 0; height: auto; overflow: visible; }
        }
      `}</style>
    </div>
  );
}
