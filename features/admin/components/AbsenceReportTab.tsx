import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Printer, Search, FileX, Loader2, AlertCircle } from 'lucide-react';

export default function AbsenceReportTab() {
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [reportData, setReportData] = useState<any[]>([]);

  // دالة تحويل التاريخ لنص YYYY-MM-DD (لإرساله لقاعدة البيانات)
  const toISODate = (d: Date) => {
    return d.toISOString().split('T')[0];
  };

  const generateReport = async () => {
    setLoading(true);
    setReportData([]);

    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      
      // 1. تحديد نطاق الشهر (من يوم 1 إلى آخر يوم)
      const startDate = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0); 

      // ضبط التوقيت لتجنب مشاكل المناطق الزمنية (UTC vs Local)
      startDate.setHours(12, 0, 0, 0); 
      endOfMonth.setHours(12, 0, 0, 0);

      // 2. تحديد تاريخ التوقف (عشان ما يجبش غياب للمستقبل)
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      
      let effectiveEndDate = endOfMonth;
      
      // لو احنا في نفس الشهر والسنة، نقف عند "امبارح" أو "اليوم"
      // (هنا سنقف عند اليوم الحالي)
      if (today < endOfMonth && today.getMonth() + 1 === month && today.getFullYear() === year) {
          effectiveEndDate = today;
      }
      
      // لو اخترنا شهر في المستقبل، نوقف اللوب فوراً
      if (startDate > today) {
          alert("لا يمكن استخراج تقرير غياب لشهر في المستقبل!");
          setLoading(false);
          return;
      }

      // تحويل التواريخ لنصوص لاستخدامها في الاستعلام
      const startDateStr = toISODate(startDate);
      const endDateStr = toISODate(endOfMonth); // نجلب داتا الشهر كله حتى لو هنعرض لحد النهاردة بس

      console.log(`جلب البيانات من ${startDateStr} إلى ${endDateStr}`);

      // ---------------------------------------------------------
      // 3. جلب البيانات من Supabase (هنا كان الخطأ وتم إصلاحه)
      // ---------------------------------------------------------

      // أ) الموظفين النشطين
      const { data: employees } = await supabase
        .from('employees')
        .select('id, employee_id, name, specialty')
        .eq('status', 'نشط')
        .order('name');

      if (!employees) throw new Error("لا يوجد موظفين");

      // ب) سجلات الحضور (تمت إضافة الفلترة بالتاريخ لتعمل مع الـ 20000 سجل)
      const { data: attendance } = await supabase
        .from('attendance')
        .select('employee_id, date, times')
        .gte('date', startDateStr)  // ✅ أكبر من أو يساوي بداية الشهر
        .lte('date', endDateStr)    // ✅ أصغر من أو يساوي نهاية الشهر
        .limit(10000);              // ✅ رفعنا الحد لـ 10000 احتياطياً (الشهر عادة 3000 سجل)

      // ج) الإجازات (المقبولة فقط)
      const { data: leaves } = await supabase
        .from('leave_requests')
        .select('employee_id, start_date, end_date')
        .neq('status', 'مرفوض')
        .lte('start_date', endDateStr) // تحسين الأداء
        .gte('end_date', startDateStr);

      // د) العطلات الرسمية
      const { data: settings } = await supabase
        .from('settings')
        .select('holidays_date')
        .single();

      const holidays = settings?.holidays_date || [];

      // ---------------------------------------------------------
      // 4. معالجة البيانات (Mapping)
      // ---------------------------------------------------------
      
      // خريطة الحضور: المفتاح = "EmpID_YYYY-MM-DD"
      const attendanceMap = new Map<string, string>();

      attendance?.forEach((r: any) => {
        // بما أن العمود date نوعه date، فهو يرجع عادة YYYY-MM-DD
        const dateKey = r.date; 
        const key = `${r.employee_id}_${dateKey}`;
        
        const timeStr = r.times ? r.times.trim() : '';
        
        if (timeStr === '') {
           attendanceMap.set(key, 'absent'); // سجل موجود بس فاضي
        } else {
           // نعد المسافات لنعرف عدد البصمات
           const punches = timeStr.split(/\s+/).filter((t:string) => t.length > 0);
           if (punches.length === 1) {
               attendanceMap.set(key, 'incomplete'); // بصمة واحدة
           } else {
               attendanceMap.set(key, 'present'); // حضور كامل
           }
        }
      });

      const finalReport: any[] = [];

      for (const emp of employees) {
        const issues: {date: string, type: string, label: string}[] = [];

        // 🔄 الدوران يوماً بيوم
        const loopDate = new Date(startDate);
        while (loopDate <= effectiveEndDate) {
          const dateStr = toISODate(loopDate);
          const dayName = loopDate.toLocaleDateString('en-US', { weekday: 'long' });

          // التحقق من الاستثناءات
          let isExcused = false;

          // 1. الجمعة
          if (dayName === 'Friday') isExcused = true;

          // 2. عطلة رسمية
          if (!isExcused && holidays.includes(dateStr)) isExcused = true;

          // 3. إجازة
          if (!isExcused && leaves) {
             const isOnLeave = leaves.some((leave: any) => 
                dateStr >= leave.start_date && dateStr <= leave.end_date && leave.employee_id === emp.employee_id
             );
             if (isOnLeave) isExcused = true;
          }

          if (!isExcused) {
             const key = `${emp.employee_id}_${dateStr}`;
             const status = attendanceMap.get(key);

             // 🚨 كشف الغياب
             // الغياب = لا يوجد سجل في الـ Map نهائياً، أو السجل موجود وقيمته 'absent'
             if (status === undefined || status === 'absent') {
                 issues.push({
                    date: dateStr,
                    type: 'absent',
                    label: new Date(dateStr).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' })
                 });
             }
             // ⚠️ كشف البصمة الواحدة (اختياري، يظهر باللون البرتقالي)
             else if (status === 'incomplete') {
                 issues.push({
                    date: dateStr,
                    type: 'incomplete',
                    label: `${new Date(dateStr).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' })} (بصمة واحدة)`
                 });
             }
          }

          // الانتقال لليوم التالي
          loopDate.setDate(loopDate.getDate() + 1);
        }

        // إضافة الموظف للتقرير فقط إذا كان عنده غياب أو بصمة واحدة
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
            <p className="text-sm text-gray-500 mt-1">حصر الأيام الخالية من البصمات (حتى تاريخ اليوم)</p>
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
