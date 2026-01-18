import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Printer, Search, FileX, Loader2, AlertCircle } from 'lucide-react';

export default function AbsenceReportTab() {
  const [loading, setLoading] = useState(false);
  // القيمة الافتراضية للشهر الحالي
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [reportData, setReportData] = useState<any[]>([]);

  const generateReport = async () => {
    setLoading(true);
    setReportData([]);

    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      
      // 1. حساب تاريخ بداية ونهاية الشهر
      const startDate = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0); 
      
      // 2. ضبط تاريخ النهاية الفعلي (لعدم جلب المستقبل)
      const today = new Date();
      // تصفير الوقت للمقارنة الصحيحة
      today.setHours(12, 0, 0, 0); 
      startDate.setHours(12, 0, 0, 0);
      
      let effectiveEndDate = endOfMonth;
      
      // إذا كان الشهر المختار هو الحالي، نتوقف عند اليوم
      if (today < endOfMonth && today.getMonth() + 1 === month && today.getFullYear() === year) {
          effectiveEndDate = today;
      }
      
      // منع اختيار شهر في المستقبل
      if (startDate > today) {
          alert("لا يمكن استخراج تقرير لشهر في المستقبل!");
          setLoading(false);
          return;
      }

      // تحويل التواريخ لـ YYYY-MM-DD لإرسالها للدالة
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = effectiveEndDate.toISOString().split('T')[0];

      console.log(`جلب التقرير للفترة: ${startStr} إلى ${endStr}`);

      // 3. 🔥 استدعاء الدالة السحرية (RPC) من Supabase
      // هذه الدالة تقوم بكل شيء (استبعاد الجمعات، العطلات، الإجازات، وحساب البصمات الفارغة)
      const { data, error } = await supabase
        .rpc('get_absence_report', { 
          report_start_date: startStr, 
          report_end_date: endStr 
        });

      if (error) throw error;

      // 4. تنسيق البيانات للعرض
      const formattedData = (data || []).map((emp: any) => ({
        id: emp.employee_id,
        employee_id: emp.employee_id,
        name: emp.name,
        specialty: emp.specialty,
        absentCount: emp.absent_count,       // قادم من SQL
        incompleteCount: emp.incomplete_count, // قادم من SQL
        issues: emp.issues                   // المصفوفة جاهزة من SQL
      }));

      setReportData(formattedData);

    } catch (err: any) {
      console.error("Error details:", err);
      alert("حدث خطأ أثناء جلب التقرير: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      {/* رأس الصفحة (أدوات البحث) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 no-print">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
              <FileX className="text-red-600" /> تقرير الغياب والمخالفات
            </h2>
            <p className="text-sm text-gray-500 mt-1">حصر دقيق للأيام الخالية من البصمات (باستثناء العطلات والإجازات)</p>
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
              عرض التقرير
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

      {/* منطقة عرض الجدول */}
      {reportData.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print-container">
          
          {/* ترويسة الطباعة (تظهر فقط عند الطباعة) */}
          <div className="hidden print-header text-center p-4 border-b-2 border-gray-800 mb-4">
            <h1 className="text-2xl font-black text-gray-900">تقرير الغياب والمخالفات</h1>
            <p className="text-gray-600 font-bold">عن شهر: {selectedMonth}</p>
          </div>

          <table className="w-full text-right" id="absence-table">
            <thead className="bg-gray-50 border-b-2 border-gray-200 text-gray-600 font-black text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3 w-48">الموظف</th>
                <th className="px-4 py-3 w-32">التخصص</th>
                <th className="px-4 py-3 w-20 text-center text-red-600">غياب</th>
                <th className="px-4 py-3 w-20 text-center text-orange-600">غير مكتمل</th>
                <th className="px-4 py-3">التفاصيل (يوم/شهر)</th>
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
                  
                  {/* رقم الغياب */}
                  <td className="px-4 py-2 text-center">
                      {emp.absentCount > 0 ? (
                          <span className="bg-red-50 text-red-700 px-2 py-1 rounded-lg font-black block">{emp.absentCount}</span>
                      ) : '-'}
                  </td>
                  
                  {/* رقم البصمة الواحدة */}
                  <td className="px-4 py-2 text-center">
                      {emp.incompleteCount > 0 ? (
                          <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded-lg font-black block">{emp.incompleteCount}</span>
                      ) : '-'}
                  </td>

                  {/* التفاصيل */}
                  <td className="px-4 py-2 text-xs leading-relaxed text-gray-500">
                    {emp.issues.map((issue: any, i: number) => (
                        <span key={i} className={`inline-block ml-1 mb-1 px-1.5 py-0.5 rounded border ${
                            issue.type === 'incomplete' 
                            ? 'bg-orange-50 text-orange-700 border-orange-200' 
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                            {issue.label}
                        </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* تذييل الطباعة */}
          <div className="hidden print-footer mt-8 pt-4 border-t border-gray-300 flex justify-between text-xs text-gray-500">
            <span>تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG')}</span>
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
          
          table { width: 100%; border-collapse: collapse; font-size: 10pt; }
          th, td { border: 1px solid #ddd; padding: 5px; }
          thead th { background-color: #f3f4f6 !important; color: black !important; }
          
          /* منع قص الصفوف */
          tr { break-inside: avoid; page-break-inside: avoid; }
          
          aside, header, nav { display: none !important; }
          main { margin: 0; padding: 0; height: auto; overflow: visible; }
        }
      `}</style>
    </div>
  );
}
