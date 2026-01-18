import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Printer, Search, FileX, Loader2, AlertCircle, AlertTriangle } from 'lucide-react';

export default function AbsenceReportTab() {
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [reportData, setReportData] = useState<any[]>([]);

  // 🛠️ 1. دالة قوية لتوحيد صيغة التاريخ من (M/D/YYYY) أو (YYYY-MM-DD)
  const parseDate = (dateStr: string) => {
    if (!dateStr) return '';
    
    // لو التاريخ جاي بصيغة YYYY-MM-DD جاهزة
    if (dateStr.includes('-')) return dateStr;

    // لو التاريخ جاي بصيغة M/D/YYYY (مثل 7/24/2025)
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return dateStr;
  };

  const generateReport = async () => {
    setLoading(true);
    setReportData([]);

    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      
      // تحديد بداية ونهاية الشهر المختار
      const startDate = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0); 

      // ✅ حل مشكلة الأيام المستقبلية
      // نتوقف عند "اليوم الحالي" فقط إذا كنا نستعرض تقرير الشهر الحالي
      const today = new Date();
      today.setHours(0,0,0,0);
      
      let effectiveEndDate = endOfMonth;
      // لو السنة والشهر المختارين هما الحاليين، واليوم الحالي قبل نهاية الشهر -> نقف عند اليوم
      if (year === today.getFullYear() && (month - 1) === today.getMonth()) {
          effectiveEndDate = today;
      }
      // لو اخترنا شهراً مستقبلياً بالكامل -> لا نعرض شيئاً
      if (startDate > today) {
          effectiveEndDate = new Date(startDate.getTime() - 86400000); // تاريخ قبل البداية لإيقاف اللوب
      }

      // تحويل تواريخ البداية والنهاية لـ String للمقارنة
      const startDateStr = parseDate(startDate.toLocaleDateString('en-US')); 
      // نستخدم نطاق واسع في الجلب (الشهر كاملاً) ثم نفلتر بالكود
      
      // 1. جلب الموظفين النشطين
      const { data: employees } = await supabase
        .from('employees')
        .select('id, employee_id, name, specialty')
        .eq('status', 'نشط')
        .order('name');

      if (!employees) throw new Error("لا يوجد موظفين");

      // 2. جلب سجلات الحضور (بدون فلترة دقيقة هنا لتجنب مشاكل الصيغة)
      const { data: attendance } = await supabase
        .from('attendance')
        .select('employee_id, date, times');
        // يمكن إضافة .limit(5000) إذا كانت البيانات ضخمة جداً

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

      const holidays = settings?.holidays_date || [];

      // --- مرحلة بناء خريطة الحالة (Map) ---
      // المفتاح: EmpID_YYYY-MM-DD
      // القيمة: 'present' | 'incomplete' | 'absent'
      const statusMap = new Map<string, string>();

      attendance?.forEach((r: any) => {
        const stdDate = parseDate(r.date); // تحويل 7/24/2025 -> 2025-07-24
        
        // تنظيف الوقت
        const timeStr = r.times ? r.times.trim() : '';
        const key = `${r.employee_id}_${stdDate}`;

        if (timeStr === '') {
           // السجل موجود لكن الوقت فارغ -> غياب
           statusMap.set(key, 'absent');
        } else {
           // تقسيم الوقت لمعرفة العدد
           const punches = timeStr.split(/\s+/);
           if (punches.length === 1) {
               // بصمة واحدة -> ترك عمل / غير مكتمل
               statusMap.set(key, 'incomplete');
           } else {
               // أكثر من بصمة -> حضور
               statusMap.set(key, 'present');
           }
        }
      });

      const finalReport: any[] = [];

      for (const emp of employees) {
        const issues: {date: string, type: string, label: string}[] = [];

        // دوران يومي من 1 في الشهر وحتى (اليوم الحالي أو نهاية الشهر)
        for (let d = new Date(startDate); d <= effectiveEndDate; d.setDate(d.getDate() + 1)) {
          // تنسيق التاريخ للحلقة YYYY-MM-DD
          const yearLoop = d.getFullYear();
          const monthLoop = String(d.getMonth() + 1).padStart(2, '0');
          const dayLoop = String(d.getDate()).padStart(2, '0');
          const dateStr = `${yearLoop}-${monthLoop}-${dayLoop}`;
          
          const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });

          // 1. استبعاد الجمعة
          if (dayName === 'Friday') continue;

          // 2. استبعاد العطلات الرسمية
          if (holidays.includes(dateStr)) continue;

          // 3. استبعاد الإجازات (المقبولة أو المعلقة)
          const isOnLeave = leaves?.some((leave: any) => 
            leave.employee_id === emp.employee_id && 
            dateStr >= leave.start_date && dateStr <= leave.end_date
          );
          if (isOnLeave) continue;

          // 4. فحص الحالة
          const key = `${emp.employee_id}_${dateStr}`;
          const status = statusMap.get(key);

          // الحالة: غياب (السجل غير موجود OR السجل موجود وقيمته absent)
          if (!status || status === 'absent') {
            issues.push({
                date: dateStr,
                type: 'absent',
                label: new Date(dateStr).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' })
            });
          } 
          // الحالة: بصمة واحدة (ترك عمل)
          else if (status === 'incomplete') {
            issues.push({
                date: dateStr,
                type: 'incomplete',
                label: `${new Date(dateStr).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' })} (بصمة واحدة)`
            });
          }
        }

        // إضافة الموظف للتقرير إذا كان لديه أي ملاحظات (غياب أو ترك عمل)
        if (issues.length > 0) {
          finalReport.push({
            ...emp,
            issues,
            absentCount: issues.filter(i => i.type === 'absent').length,
            incompleteCount: issues.filter(i => i.type === 'incomplete').length
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
              <FileX className="text-red-600" /> تقرير الغياب والمخالفات
            </h2>
            <p className="text-sm text-gray-500 mt-1">حصر أيام الغياب وترك العمل (بصمة واحدة) حتى تاريخ اليوم</p>
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
            <h1 className="text-2xl font-black text-gray-900">تقرير الغياب والمخالفات</h1>
            <p className="text-gray-600 font-bold">عن شهر: {selectedMonth}</p>
          </div>

          <table className="w-full text-right" id="absence-table">
            <thead className="bg-gray-50 border-b-2 border-gray-200 text-gray-600 font-black text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3 w-48">الموظف</th>
                <th className="px-4 py-3 w-32">التخصص</th>
                <th className="px-4 py-3 w-24 text-center text-red-600">أيام الغياب</th>
                <th className="px-4 py-3 w-24 text-center text-orange-600">بصمة واحدة</th>
                <th className="px-4 py-3">التفاصيل</th>
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
                  
                  {/* عداد الغياب */}
                  <td className="px-4 py-2 text-center">
                      {emp.absentCount > 0 ? (
                          <span className="bg-red-50 text-red-700 px-2 py-1 rounded-lg font-black">{emp.absentCount}</span>
                      ) : '-'}
                  </td>
                  
                  {/* عداد البصمة الواحدة */}
                  <td className="px-4 py-2 text-center">
                      {emp.incompleteCount > 0 ? (
                          <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded-lg font-black">{emp.incompleteCount}</span>
                      ) : '-'}
                  </td>

                  {/* التفاصيل */}
                  <td className="px-4 py-2 text-xs leading-relaxed text-gray-500">
                    {emp.issues.map((issue: any, i: number) => (
                        <span key={i} className={issue.type === 'incomplete' ? 'text-orange-600 font-bold' : ''}>
                            {issue.label}{i < emp.issues.length - 1 ? ' ، ' : ''}
                        </span>
                    ))}
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
