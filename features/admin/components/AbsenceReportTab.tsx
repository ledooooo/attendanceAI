import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Printer, Search, FileX, Loader2, AlertCircle } from 'lucide-react';

export default function AbsenceReportTab() {
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [reportData, setReportData] = useState<any[]>([]);

  const generateReport = async () => {
    setLoading(true);
    setReportData([]);

    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0); 
      
      const today = new Date();
      today.setHours(12, 0, 0, 0); 
      startDate.setHours(12, 0, 0, 0);
      
      let effectiveEndDate = endOfMonth;
      if (today < endOfMonth && today.getMonth() + 1 === month && today.getFullYear() === year) {
          effectiveEndDate = today;
      }
      
      if (startDate > today) {
          alert("لا يمكن استخراج تقرير لشهر في المستقبل!");
          setLoading(false);
          return;
      }

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = effectiveEndDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .rpc('get_absence_report', { 
          report_start_date: startStr, 
          report_end_date: endStr 
        });

      if (error) throw error;

      const formattedData = (data || []).map((emp: any) => ({
        id: emp.employee_id,
        employee_id: emp.employee_id,
        name: emp.name,
        specialty: emp.specialty,
        // فصل التواريخ بناءً على النوع لعرضها في الأعمدة الجديدة
        absentDates: emp.issues.filter((i:any) => i.type === 'absent').map((i:any) => i.label).join('، '),
        incompleteDates: emp.issues.filter((i:any) => i.type === 'incomplete').map((i:any) => i.label).join('، '),
      }));

      setReportData(formattedData);

    } catch (err: any) {
      console.error(err);
      alert("حدث خطأ: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      {/* رأس الصفحة (يختفي عند الطباعة) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 no-print">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
              <FileX className="text-red-600" /> تقرير الغياب والمخالفات
            </h2>
            <p className="text-sm text-gray-500 mt-1">حصر دقيق (غياب + بصمة واحدة)</p>
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

      {/* منطقة عرض الجدول */}
      {reportData.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print-container">
          
          {/* ترويسة الطباعة */}
          <div className="hidden print-header text-center p-2 border-b-2 border-black mb-2">
            <h1 className="text-xl font-black text-black">تقرير متابعة دوام الموظفين</h1>
            <p className="text-sm font-bold text-gray-700 mt-1">
                عن شهر: {selectedMonth} | تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG')}
            </p>
          </div>

          <table className="w-full text-right" id="absence-table">
            <thead className="bg-gray-50 border-b border-gray-300">
              <tr>
                <th className="p-2 text-xs font-bold text-gray-700 border border-gray-300 w-[5%]">#</th>
                <th className="p-2 text-xs font-bold text-gray-700 border border-gray-300 w-[20%]">اسم الموظف</th>
                <th className="p-2 text-xs font-bold text-gray-700 border border-gray-300 w-[15%]">التخصص</th>
                <th className="p-2 text-xs font-bold text-orange-700 border border-gray-300 w-[20%]">أيام ترك العمل (بصمة واحدة)</th>
                <th className="p-2 text-xs font-bold text-red-700 border border-gray-300 w-[40%]">أيام الغياب (بدون بصمات)</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((emp, idx) => (
                <tr key={emp.id} className="break-inside-avoid">
                  <td className="p-2 text-xs border border-gray-300 text-center font-bold">{idx + 1}</td>
                  <td className="p-2 text-xs border border-gray-300 font-bold">{emp.name}</td>
                  <td className="p-2 text-xs border border-gray-300">{emp.specialty}</td>
                  
                  {/* عمود ترك العمل */}
                  <td className="p-2 text-[10px] border border-gray-300 leading-tight">
                    {emp.incompleteDates || '-'}
                  </td>
                  
                  {/* عمود الغياب (الأكبر مساحة) */}
                  <td className="p-2 text-[10px] border border-gray-300 leading-tight font-medium">
                    {emp.absentDates || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* تذييل الطباعة */}
          <div className="hidden print-footer mt-4 pt-2 border-t border-black flex justify-between text-[10px] font-bold">
            <span>عدد الموظفين في القائمة: {reportData.length}</span>
            <span>توقيع المدير: ...........................................</span>
          </div>
        </div>
      ) : (
        !loading && (
          <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200 text-gray-400 no-print">
            <AlertCircle className="w-12 h-12 mb-3 opacity-20"/>
            <p>اختر الشهر واضغط عرض لاستخراج التقرير</p>
          </div>
        )
      )}

      {/* تنسيقات الطباعة الدقيقة (A4 Optimized) */}
      <style>{`
        @media print {
          @page { 
            size: A4; 
            margin: 10mm; /* هامش مناسب للطابعة */
          }
          body { 
            background: white; 
            -webkit-print-color-adjust: exact; 
          }
          
          /* إخفاء العناصر غير المرغوبة */
          .no-print, aside, header, nav, button { display: none !important; }
          
          /* إظهار عناصر الطباعة */
          .print-header, .print-footer { display: block !important; }
          
          /* تنسيق الحاوية */
          .print-container { 
            box-shadow: none; 
            border: none; 
            width: 100%;
          }
          
          /* تنسيق الجدول */
          table { 
            width: 100%; 
            border-collapse: collapse; 
            table-layout: fixed; /* ضروري لاحترام النسب المئوية */
          }
          
          th, td { 
            border: 1px solid #000 !important; /* حدود سوداء واضحة */
            padding: 3px 4px !important; /* تقليل الهوامش لزيادة السعة */
            vertical-align: middle;
          }
          
          /* ضبط الخلفيات للطباعة */
          thead th { 
            background-color: #eee !important; 
            color: black !important;
            font-weight: 900 !important;
          }
          
          /* منع قص الصفوف */
          tr { 
            break-inside: avoid; 
            page-break-inside: avoid; 
          }
          
          /* ضبط الخطوط لتناسب الورقة */
          td { font-size: 10pt !important; }
          
          /* إجبار المحتوى الرئيسي على ملء الصفحة */
          main { margin: 0; padding: 0; height: auto; overflow: visible; }
        }
      `}</style>
    </div>
  );
}
