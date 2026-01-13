import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { ExcelUploadButton, downloadSample } from '../../../components/ui/ExcelUploadButton';
import { Clock, Download, CheckCircle, AlertTriangle, RefreshCcw, History, CalendarCheck, FileCode } from 'lucide-react';

const formatDateForDB = (val: any): string | null => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val.toISOString().split('T')[0];
  const num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    return new Date(Math.round((num - 25569) * 86400 * 1000)).toISOString().split('T')[0];
  }
  const str = String(val).trim();
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  try {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  } catch { return null; }
};

export default function AttendanceTab({ onRefresh }: { onRefresh?: () => void }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('غير متوفر');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLastUpdate = async () => {
    const { data } = await supabase.from('general_settings').select('last_attendance_update').limit(1).maybeSingle();
    if (data && data.last_attendance_update) {
      const date = new Date(data.last_attendance_update);
      setLastUpdate(date.toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' }));
    }
  };

  useEffect(() => {
    fetchLastUpdate();
  }, []);

  // --- دالة إرسال البيانات النهائية لقاعدة البيانات ---
  const submitToDB = async (payload: any[]) => {
    const { data: result, error } = await supabase.rpc('process_attendance_bulk', { payload });
    if (error) throw error;

    await supabase.from('general_settings').update({ last_attendance_update: new Date() }).gt('id', '00000000-0000-0000-0000-000000000000');

    setLastResult(result);
    alert(`تمت العملية بنجاح!\n- مضاف: ${result.inserted}\n- محدث: ${result.updated}\n- متجاهل: ${result.skipped}`);
    fetchLastUpdate();
    if (onRefresh) onRefresh();
  };

  // --- دالة معالجة ملف الإكسيل (الطريقة القديمة) ---
  const handleAnalyzeExcel = async (data: any[]) => {
    setIsProcessing(true);
    setLastResult(null);
    try {
      const payload = data.map(row => ({
        employee_id: String(row.employee_ || row.employee_id || row['الكود'] || row['ID'] || '').trim(),
        date: formatDateForDB(row.date || row['التاريخ']),
        times: String(row.times || row['البصمات'] || '').trim().replace(/\s+/g, ' ')
      })).filter(r => r.employee_id && r.date);

      if (payload.length === 0) {
        alert("لا توجد بيانات صالحة في ملف الإكسيل");
        return;
      }
      await submitToDB(payload);
    } catch (err: any) {
      alert("خطأ في معالجة الإكسيل: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- دالة معالجة ملف الـ .dat الخام (الطريقة الجديدة) ---
  const handleRawFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setLastResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        
        // كائن لتجميع البصمات: { "ID_Date": "Time1 Time2 Time3" }
        const groupedData: { [key: string]: { id: string, date: string, times: string[] } } = {};

        lines.forEach(line => {
          const cleanLine = line.trim();
          if (!cleanLine) return;

          // تقسيم السطر (غالباً التوزيع هو: ID ثم مسافة ثم التاريخ ثم الوقت)
          // مثال: 110  13/01/2026 07:32  1  0  15  0
          const parts = cleanLine.split(/\s+/);
          if (parts.length < 3) return;

          const empId = parts[0];
          const rawDate = parts[1]; // 13/01/2026
          const rawTime = parts[2]; // 07:32

          const formattedDate = formatDateForDB(rawDate);
          if (!formattedDate || !empId) return;

          const key = `${empId}_${formattedDate}`;
          if (!groupedData[key]) {
            groupedData[key] = { id: empId, date: formattedDate, times: [] };
          }
          groupedData[key].times.push(rawTime);
        });

        // تحويل الكائن إلى مصفوفة Payload
        const payload = Object.values(groupedData).map(group => ({
          employee_id: group.id,
          date: group.date,
          times: group.times.sort().join(' ') // ترتيب الأوقات تصاعدياً
        }));

        if (payload.length === 0) {
          alert("لا توجد بيانات صالحة في ملف الـ .dat");
          return;
        }

        await submitToDB(payload);
      } catch (err: any) {
        alert("خطأ في معالجة الملف الخام: " + err.message);
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Clock className="text-blue-600"/> سجل البصمات (Smart Sync)</h2>
          <div className="mt-2 inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold border border-blue-100">
            <CalendarCheck className="w-4 h-4"/>
            آخر تحديث للبيانات: {lastUpdate}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>downloadSample('attendance')} className="text-gray-400 p-2 hover:text-blue-600 transition-all shadow-sm rounded-lg" title="تحميل ملف عينة"><Download className="w-5 h-5"/></button>
          
          {/* الزر الجديد لملف .dat */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleRawFileChange} 
            accept=".dat,.txt" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl font-bold hover:bg-gray-200 transition-all border border-gray-200 disabled:opacity-50"
          >
            <FileCode className="w-5 h-5 text-gray-500"/>
            {isProcessing ? "جاري المعالجة..." : "رفع ملف خام (.dat)"}
          </button>

          <ExcelUploadButton onData={handleAnalyzeExcel} label={isProcessing ? "جاري المزامنة..." : "رفع ومعالجة إكسيل"} />
        </div>
      </div>

      {lastResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-[30px] p-8 animate-in slide-in-from-top duration-500 shadow-lg">
          <h3 className="text-xl font-black text-emerald-800 mb-6 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-emerald-600"/> تقرير المعالجة الذكي الأخير
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-emerald-100 text-center shadow-sm">
              <p className="text-gray-500 text-[10px] font-bold uppercase mb-1 tracking-widest">إضافة (جديد)</p>
              <p className="text-4xl font-black text-emerald-600">{lastResult.inserted}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-blue-100 text-center shadow-sm">
              <p className="text-gray-500 text-[10px] font-bold uppercase mb-1 tracking-widest">تعديل (تحديث)</p>
              <p className="text-4xl font-black text-blue-600">{lastResult.updated}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 text-center shadow-sm opacity-70">
              <p className="text-gray-500 text-[10px] font-bold uppercase mb-1 tracking-widest">متطابقة (تجاهل)</p>
              <p className="text-4xl font-black text-gray-600">{lastResult.skipped}</p>
            </div>
          </div>
          <button onClick={() => setLastResult(null)} className="mt-6 text-emerald-600 font-bold text-sm flex items-center gap-2 hover:underline">
            <RefreshCcw className="w-4 h-4"/> بدء عملية رفع جديدة
          </button>
        </div>
      )}

      {!lastResult && !isProcessing && (
        <div className="bg-blue-50 border border-blue-100 rounded-[40px] p-12 text-center shadow-inner">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <AlertTriangle className="w-10 h-10 text-blue-500"/>
          </div>
          <h3 className="text-2xl font-black text-blue-800">نظام المزامنة الجماعية</h3>
          <p className="text-gray-600 mt-4 max-w-lg mx-auto leading-relaxed">
            يمكنك الآن رفع ملف البصمة بصيغة <b>Excel</b> أو الملف الخام مباشرة بصيغة <b>.dat</b>. 
            سيقوم النظام بتجميع البصمات المتفرقة لنفس الموظف في نفس اليوم ودمجها تلقائياً قبل إرسالها لقاعدة البيانات.
          </p>
        </div>
      )}
    </div>
  );
}
