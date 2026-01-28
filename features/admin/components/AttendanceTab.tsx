import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { ExcelUploadButton, downloadSample } from '../../../components/ui/ExcelUploadButton';
import { 
    Clock, Download, CheckCircle, AlertTriangle, RefreshCcw, 
    CalendarCheck, FileCode, UserPlus, List, X, Save, Search, User 
} from 'lucide-react';
import toast from 'react-hot-toast';

// --- Helper: Format Date ---
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
  // --- States ---
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('غير متوفر');
  
  // Manual Entry States
  const [viewMode, setViewMode] = useState<'upload' | 'manual_logs'>('upload');
  const [showManualModal, setShowManualModal] = useState(false);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [manualLogs, setManualLogs] = useState<any[]>([]);
  const [manualForm, setManualForm] = useState({
      employee_id: '',
      date: new Date().toISOString().split('T')[0],
      timeIn: '',
      timeOut: '',
      responsible: 'المدير' // قيمة افتراضية
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  useEffect(() => {
    fetchLastUpdate();
    fetchEmployees();
  }, []);

  useEffect(() => {
      if (viewMode === 'manual_logs') {
          fetchManualLogs();
      }
  }, [viewMode]);

  // --- Data Fetching ---
  const fetchLastUpdate = async () => {
    const { data } = await supabase.from('general_settings').select('last_attendance_update').limit(1).maybeSingle();
    if (data && data.last_attendance_update) {
      const date = new Date(data.last_attendance_update);
      setLastUpdate(date.toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' }));
    }
  };

  const fetchEmployees = async () => {
      const { data } = await supabase.from('employees').select('id, name, employee_id');
      if (data) setEmployeesList(data);
  };

  const fetchManualLogs = async () => {
      const { data, error } = await supabase
          .from('attendance')
          .select('*, employees(name)')
          .eq('is_manual', true)
          .order('created_at', { ascending: false })
          .limit(50);
      
      if (!error && data) {
          setManualLogs(data);
      }
  };

  // --- Handlers: File Upload ---
  const submitToDB = async (payload: any[]) => {
    const { data: result, error } = await supabase.rpc('process_attendance_bulk', { payload });
    if (error) throw error;

    await supabase.from('general_settings').update({ last_attendance_update: new Date() }).gt('id', '00000000-0000-0000-0000-000000000000');

    setLastResult(result);
    toast.success(`تمت العملية بنجاح! (مضاف: ${result.inserted})`);
    fetchLastUpdate();
    if (onRefresh) onRefresh();
  };

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
        toast.error("لا توجد بيانات صالحة في الملف");
        return;
      }
      await submitToDB(payload);
    } catch (err: any) {
        toast.error("خطأ: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRawFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setLastResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r\n|\n/);
        const groupedData: { [key: string]: { id: string, date: string, times: string[] } } = {};

        lines.forEach(line => {
          const cleanLine = line.trim();
          if (!cleanLine) return;
          const parts = cleanLine.split(/\s+/);
          if (parts.length < 3) return;

          const empId = parts[0];
          const rawDate = parts[1];
          const rawTime = parts[2];

          let formattedDate = rawDate;
            if (rawDate.includes('/')) {
                const [d, m, y] = rawDate.split('/');
                const fullYear = y.length === 2 ? `20${y}` : y;
                formattedDate = `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }

          const key = `${empId}_${formattedDate}`;
          if (!groupedData[key]) {
            groupedData[key] = { id: empId, date: formattedDate, times: [] };
          }
          if (!groupedData[key].times.includes(rawTime)) {
             groupedData[key].times.push(rawTime);
          }
        });

        const payload = Object.values(groupedData).map(group => ({
          employee_id: group.id,
          date: group.date,
          times: group.times.sort().join(' ')
        }));

        if (payload.length === 0) {
            toast.error("لا توجد بيانات صالحة في الملف");
            return;
        }

        await submitToDB(payload);
      } catch (err: any) {
        toast.error("خطأ: " + err.message);
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // --- Handlers: Manual Entry ---
  const handleManualSubmit = async () => {
      if (!manualForm.employee_id || !manualForm.date || !manualForm.timeIn) {
          toast.error("يرجى ملء البيانات الأساسية (الموظف، التاريخ، وقت الحضور)");
          return;
      }

      setIsProcessing(true);
      try {
          // دمج الأوقات
          const timesArr = [manualForm.timeIn];
          if (manualForm.timeOut) timesArr.push(manualForm.timeOut);
          const timesStr = timesArr.join(' ');

          const payload = {
              employee_id: manualForm.employee_id,
              date: manualForm.date,
              times: timesStr,
              status: 'حضور',
              is_manual: true,
              responsible: manualForm.responsible
          };

          const { error } = await supabase.from('attendance').upsert(payload, { onConflict: 'employee_id,date' });
          if (error) throw error;

          toast.success("تم إضافة البصمة يدوياً بنجاح");
          setShowManualModal(false);
          // Reset form basics only
          setManualForm(prev => ({...prev, timeIn: '', timeOut: ''}));
          
          if (viewMode === 'manual_logs') fetchManualLogs();
          if (onRefresh) onRefresh();

      } catch (err: any) {
          toast.error("فشل الحفظ: " + err.message);
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* --- Top Bar --- */}
      <div className="flex flex-col xl:flex-row justify-between items-center border-b pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Clock className="text-blue-600"/> سجل البصمات (Smart Sync)</h2>
          <div className="mt-2 inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold border border-blue-100">
            <CalendarCheck className="w-4 h-4"/>
            آخر تحديث للبيانات: {lastUpdate}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 justify-center xl:justify-end">
            {/* أزرار التبديل */}
            <div className="bg-gray-100 p-1 rounded-xl flex">
                <button 
                    onClick={() => setViewMode('upload')} 
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'upload' ? 'bg-white text-blue-600 shadow' : 'text-gray-500'}`}
                >
                    رفع ملفات
                </button>
                <button 
                    onClick={() => setViewMode('manual_logs')} 
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'manual_logs' ? 'bg-white text-blue-600 shadow' : 'text-gray-500'}`}
                >
                    <List className="w-4 h-4 inline-block ml-1"/> سجل اليدوي
                </button>
            </div>

            {/* زر الإضافة اليدوية */}
            <button 
                onClick={() => setShowManualModal(true)} 
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
                <UserPlus className="w-5 h-5"/>
                إضافة يدوية
            </button>
        </div>
      </div>

      {/* --- Main Content --- */}
      
      {/* 1. Upload View */}
      {viewMode === 'upload' && (
          <div className="space-y-6">
                <div className="flex gap-2 justify-end">
                    <button onClick={()=>downloadSample('attendance')} className="text-gray-400 p-2 hover:text-blue-600 transition-all shadow-sm rounded-lg" title="تحميل ملف عينة"><Download className="w-5 h-5"/></button>
                    <input type="file" ref={fileInputRef} onChange={handleRawFileChange} accept=".dat,.txt" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl font-bold hover:bg-gray-200 border border-gray-200 disabled:opacity-50">
                        <FileCode className="w-5 h-5 text-gray-500"/> {isProcessing ? "جاري المعالجة..." : "رفع ملف خام (.dat)"}
                    </button>
                    <ExcelUploadButton onData={handleAnalyzeExcel} label={isProcessing ? "جاري المزامنة..." : "رفع ومعالجة إكسيل"} />
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
                            سيقوم النظام بتجميع البصمات المتفرقة ودمجها تلقائياً.
                        </p>
                    </div>
                )}
          </div>
      )}

      {/* 2. Manual Logs View */}
      {viewMode === 'manual_logs' && (
          <div className="bg-white rounded-3xl border shadow-sm overflow-hidden animate-in fade-in">
              <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
                  <h3 className="font-bold text-gray-800">سجل الإدخالات اليدوية (آخر 50)</h3>
                  <button onClick={fetchManualLogs} className="text-blue-600 hover:bg-blue-100 p-2 rounded-full"><RefreshCcw className="w-4 h-4"/></button>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                      <thead className="bg-gray-100 text-gray-600 font-bold">
                          <tr>
                              <th className="p-4">الموظف</th>
                              <th className="p-4">التاريخ</th>
                              <th className="p-4">التوقيتات</th>
                              <th className="p-4">المسؤول</th>
                              <th className="p-4">توقيت الإدخال</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y">
                          {manualLogs.length === 0 ? (
                              <tr><td colSpan={5} className="p-8 text-center text-gray-400">لا توجد سجلات يدوية</td></tr>
                          ) : (
                              manualLogs.map((log: any) => (
                                  <tr key={log.id} className="hover:bg-gray-50">
                                      <td className="p-4 font-bold">{log.employees?.name} <span className="text-xs text-gray-400">({log.employee_id})</span></td>
                                      <td className="p-4 font-mono">{log.date}</td>
                                      <td className="p-4 font-mono text-blue-600 dir-ltr">{log.times}</td>
                                      <td className="p-4">
                                          <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold">{log.responsible || 'غير محدد'}</span>
                                      </td>
                                      <td className="p-4 text-gray-500 text-xs">
                                          {log.created_at ? new Date(log.created_at).toLocaleString('ar-EG') : '-'}
                                      </td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* --- Modal: Add Manual Entry --- */}
      {showManualModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 overflow-hidden">
                  <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                      <h3 className="font-black text-lg text-gray-800 flex items-center gap-2">
                          <UserPlus className="w-5 h-5 text-indigo-600"/> إضافة بصمة يدوية
                      </h3>
                      <button onClick={() => setShowManualModal(false)} className="text-gray-400 hover:text-red-500"><X className="w-5 h-5"/></button>
                  </div>
                  
                  <div className="p-6 space-y-4">
                      {/* Employee Select */}
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">اسم الموظف</label>
                          <div className="relative">
                              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"/>
                              <select 
                                  value={manualForm.employee_id}
                                  onChange={e => setManualForm({...manualForm, employee_id: e.target.value})}
                                  className="w-full pr-10 pl-4 py-3 rounded-xl border bg-gray-50 focus:bg-white outline-none font-bold text-gray-700 appearance-none"
                              >
                                  <option value="">اختر الموظف...</option>
                                  {employeesList.map(emp => (
                                      <option key={emp.id} value={emp.employee_id}>{emp.name}</option>
                                  ))}
                              </select>
                          </div>
                      </div>

                      {/* Date */}
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">التاريخ</label>
                          <input 
                              type="date" 
                              value={manualForm.date}
                              onChange={e => setManualForm({...manualForm, date: e.target.value})}
                              className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white outline-none font-mono font-bold"
                          />
                      </div>

                      {/* Times */}
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1">وقت الحضور</label>
                              <input 
                                  type="time" 
                                  value={manualForm.timeIn}
                                  onChange={e => setManualForm({...manualForm, timeIn: e.target.value})}
                                  className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white outline-none font-mono"
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1">وقت الانصراف (اختياري)</label>
                              <input 
                                  type="time" 
                                  value={manualForm.timeOut}
                                  onChange={e => setManualForm({...manualForm, timeOut: e.target.value})}
                                  className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white outline-none font-mono"
                              />
                          </div>
                      </div>

                      {/* Responsible */}
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">المسؤول عن الإدخال</label>
                          <div className="relative">
                              <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"/>
                              <input 
                                  type="text" 
                                  value={manualForm.responsible}
                                  onChange={e => setManualForm({...manualForm, responsible: e.target.value})}
                                  className="w-full pr-10 pl-4 py-3 rounded-xl border bg-gray-50 focus:bg-white outline-none"
                                  placeholder="الاسم..."
                              />
                          </div>
                      </div>

                      <button 
                          onClick={handleManualSubmit}
                          disabled={isProcessing}
                          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg flex items-center justify-center gap-2 mt-4"
                      >
                          <Save className="w-5 h-5"/> حفظ البيانات
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}
