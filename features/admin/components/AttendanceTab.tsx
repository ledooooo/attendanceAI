import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { ExcelUploadButton, downloadSample } from '../../../components/ui/ExcelUploadButton';
import { Clock, Download, CheckCircle, AlertTriangle, RefreshCcw, History } from 'lucide-react';

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

  // جلب تاريخ آخر تحديث
  const fetchLastUpdate = async () => {
      const { data } = await supabase.from('attendance').select('created_at').order('created_at', { ascending: false }).limit(1);
      if (data && data.length > 0) {
          const date = new Date(data[0].created_at);
          setLastUpdate(date.toLocaleString('ar-EG'));
      }
  };

  useEffect(() => {
      fetchLastUpdate();
  }, []);

  const handleAnalyzeFile = async (data: any[]) => {
    setIsProcessing(true);
    setLastResult(null);
    try {
        const payload = data.map(row => ({
            employee_id: String(row.employee_ || row.employee_id || row['الكود'] || row['ID'] || '').trim(),
            date: formatDateForDB(row.date || row['التاريخ']),
            times: String(row.times || row['البصمات'] || '').trim().replace(/\s+/g, ' ')
        })).filter(r => r.employee_id && r.date);

        if (payload.length === 0) {
            alert("لا توجد بيانات صالحة في الملف المرفوع");
            setIsProcessing(false);
            return;
        }

        const { data: result, error } = await supabase.rpc('process_attendance_bulk', { payload });

        if (error) throw error;

        setLastResult(result);
        alert(`تمت العملية بنجاح!\n- مضاف: ${result.inserted}\n- محدث: ${result.updated}\n- متجاهل: ${result.skipped}`);
        
        fetchLastUpdate(); // تحديث التاريخ
        if (onRefresh) onRefresh();

    } catch (err: any) {
        alert("خطأ في المعالجة: " + err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4">
        <div>
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Clock className="text-blue-600"/> سجل البصمات (Smart Sync)</h2>
            <p className="text-xs text-gray-400 font-bold mt-1 flex items-center gap-1">
                <History className="w-3 h-3"/> آخر تحديث للبيانات: <span className="text-emerald-600">{lastUpdate}</span>
            </p>
        </div>
        <div className="flex gap-2">
            <button onClick={()=>downloadSample('attendance')} className="text-gray-400 p-2 hover:text-blue-600 transition-all shadow-sm rounded-lg" title="تحميل ملف عينة"><Download className="w-5 h-5"/></button>
            <ExcelUploadButton onData={handleAnalyzeFile} label={isProcessing ? "جاري المزامنة..." : "رفع ومعالجة إكسيل"} />
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
            <p className="text-gray-600 mt-4 max-w-lg mx-auto leading-relaxed">قم برفع ملف البصمة المستخرج من الجهاز، وسيقوم النظام بمقارنة السجلات تلقائياً. لن يتم تكرار أي بصمة موجودة بالفعل، وسيتم تحديث السجلات فقط في حالة وجود تغيير في توقيتات البصمة لنفس اليوم.</p>
        </div>
      )}
    </div>
  );
}