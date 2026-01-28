import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { ExcelUploadButton, downloadSample } from '../../../components/ui/ExcelUploadButton';
import { 
    Clock, Download, CheckCircle, AlertTriangle, RefreshCcw, 
    CalendarCheck, FileCode, UserPlus, List, X, Save, Search, User, Trash2, Filter, ChevronLeft, ChevronRight, FileText, MousePointerClick 
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

const ITEMS_PER_PAGE = 20;

export default function AttendanceTab({ onRefresh }: { onRefresh?: () => void }) {
  // --- States ---
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('غير متوفر');
  
  // View Modes: 'upload' (رفع ملفات) | 'logs' (سجل البصمات)
  const [viewMode, setViewMode] = useState<'upload' | 'logs'>('upload');
  
  // Logs & Pagination State
  const [logs, setLogs] = useState<any[]>([]);
  const [logsPage, setLogsPage] = useState(0);
  const [logsTotal, setLogsTotal] = useState(0);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // ✅ فلاتر البحث الجديدة
  const [logsFilterEmp, setLogsFilterEmp] = useState<string>('all'); // فلتر القائمة المنسدلة
  const [searchCode, setSearchCode] = useState<string>(''); // بحث بالكود
  const [filterType, setFilterType] = useState<'all' | 'manual' | 'file'>('all'); // نوع الإدخال

  // Manual Modal State
  const [showManualModal, setShowManualModal] = useState(false);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [manualForm, setManualForm] = useState({
      employee_id: '',
      date: new Date().toISOString().split('T')[0],
      timeIn: '',
      timeOut: '',
      responsible: 'المدير'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  useEffect(() => {
    fetchLastUpdate();
    fetchEmployees();
  }, []);

  // جلب السجلات عند تغيير أي فلتر أو صفحة
  useEffect(() => {
      if (viewMode === 'logs') {
          fetchLogs();
      }
  }, [viewMode, logsPage, logsFilterEmp, searchCode, filterType]);

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

  // ✅ دالة جلب السجلات مع الفلترة المتقدمة
  const fetchLogs = async () => {
      setIsLoadingLogs(true);
      try {
          let query = supabase
              .from('attendance')
              .select('*, employees(name, employee_id)', { count: 'exact' });

          // 1. الفلترة باسم الموظف (Dropdown)
          if (logsFilterEmp !== 'all') {
              query = query.eq('employee_id', logsFilterEmp);
          }

          // 2. ✅ البحث بالكود (Input)
          if (searchCode) {
              query = query.ilike('employee_id', `%${searchCode}%`);
          }

          // 3. ✅ الفلترة بنوع الإدخال (يدوي / ملف)
          if (filterType === 'manual') {
              query = query.eq('is_manual', true);
          } else if (filterType === 'file') {
              // نفترض أن false أو null هو ملف
              query = query.or('is_manual.eq.false,is_manual.is.null');
          }

          // الترتيب والتقسيم
          const from = logsPage * ITEMS_PER_PAGE;
          const to = from + ITEMS_PER_PAGE - 1;
          
          const { data, count, error } = await query
              .order('date', { ascending: false }) // الأحدث تاريخاً أولاً
              .range(from, to);
          
          if (error) throw error;

          if (data) setLogs(data);
          if (count !== null) setLogsTotal(count);

      } catch (err: any) {
          toast.error("خطأ في جلب السجلات");
          console.error(err);
      } finally {
          setIsLoadingLogs(false);
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
          toast.error("يرجى ملء البيانات الأساسية");
          return;
      }

      setIsProcessing(true);
      try {
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

          toast.success("تم الحفظ بنجاح");
          setShowManualModal(false);
          setManualForm(prev => ({...prev, timeIn: '', timeOut: ''}));
          
          if (viewMode === 'logs') fetchLogs();
          if (onRefresh) onRefresh();

      } catch (err: any) {
          toast.error("فشل الحفظ: " + err.message);
      } finally {
          setIsProcessing(false);
      }
  };

  // دالة الحذف
  const handleDeleteLog = async (id: number) => {
      if (!window.confirm("هل أنت متأكد من حذف هذا السجل؟")) return;

      try {
          const { error } = await supabase.from('attendance').delete().eq('id', id);
          if (error) throw error;
          
          toast.success("تم الحذف بنجاح");
          fetchLogs(); 
          if (onRefresh) onRefresh();
      } catch (err: any) {
          toast.error("فشل الحذف");
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* --- Top Bar --- */}
      <div className="flex flex-col xl:flex-row justify-between items-center border-b pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Clock className="text-blue-600"/> إدارة البصمة</h2>
          <div className="mt-2 inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold border border-blue-100">
            <CalendarCheck className="w-4 h-4"/>
            آخر تحديث: {lastUpdate}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 justify-center xl:justify-end">
            <div className="bg-gray-100 p-1 rounded-xl flex">
                <button 
                    onClick={() => setViewMode('upload')} 
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'upload' ? 'bg-white text-blue-600 shadow' : 'text-gray-500'}`}
                >
                    رفع ملفات
                </button>
                <button 
                    onClick={() => setViewMode('logs')} 
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'logs' ? 'bg-white text-blue-600 shadow' : 'text-gray-500'}`}
                >
                    <List className="w-4 h-4 inline-block ml-1"/> سجل البصمات
                </button>
            </div>

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

      {/* 2. All Logs View with Pagination & Filter */}
      {viewMode === 'logs' && (
          <div className="bg-white rounded-3xl border shadow-sm overflow-hidden animate-in fade-in">
              {/* شريط الفلاتر العلوي */}
              <div className="p-4 border-b bg-gray-50 flex flex-col lg:flex-row justify-between items-center gap-4">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2 shrink-0">
                      <List className="w-5 h-5 text-indigo-600"/> سجل البصمات الكامل
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
                      {/* فلتر نوع الإدخال */}
                      <div className="flex bg-white rounded-xl border p-1">
                          <button 
                            onClick={() => { setFilterType('all'); setLogsPage(0); }} 
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filterType === 'all' ? 'bg-gray-100 text-black' : 'text-gray-500'}`}
                          >الكل</button>
                          <button 
                            onClick={() => { setFilterType('manual'); setLogsPage(0); }} 
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${filterType === 'manual' ? 'bg-purple-100 text-purple-700' : 'text-gray-500'}`}
                          >
                             <MousePointerClick className="w-3 h-3"/> يدوي
                          </button>
                          <button 
                            onClick={() => { setFilterType('file'); setLogsPage(0); }} 
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${filterType === 'file' ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}
                          >
                             <FileText className="w-3 h-3"/> ملف
                          </button>
                      </div>

                      {/* بحث بالكود */}
                      <div className="relative">
                          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"/>
                          <input 
                            placeholder="بحث بالكود..." 
                            value={searchCode}
                            onChange={(e) => { setSearchCode(e.target.value); setLogsPage(0); }}
                            className="pl-4 pr-9 py-2 rounded-xl border outline-none text-sm w-32 focus:w-48 transition-all"
                          />
                      </div>

                      {/* فلتر الموظف */}
                      <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border">
                          <Filter className="w-4 h-4 text-gray-400"/>
                          <select 
                              value={logsFilterEmp} 
                              onChange={(e) => { setLogsFilterEmp(e.target.value); setLogsPage(0); }}
                              className="bg-transparent text-sm font-bold text-gray-700 outline-none w-40"
                          >
                              <option value="all">كل الموظفين</option>
                              {employeesList.map(e => <option key={e.id} value={e.employee_id}>{e.name}</option>)}
                          </select>
                      </div>
                  </div>
              </div>

              <div className="overflow-x-auto min-h-[400px]">
                  <table className="w-full text-sm text-right">
                      <thead className="bg-gray-100 text-gray-600 font-bold">
                          <tr>
                              <th className="p-4">الموظف</th>
                              <th className="p-4">التاريخ</th>
                              <th className="p-4">التوقيتات المسجلة</th>
                              <th className="p-4">نوع الإدخال</th>
                              <th className="p-4">المسؤول/الوقت</th>
                              <th className="p-4 text-center">حذف</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y">
                          {logs.length === 0 ? (
                              <tr><td colSpan={6} className="p-8 text-center text-gray-400">لا توجد سجلات مطابقة</td></tr>
                          ) : (
                              logs.map((log: any) => (
                                  <tr key={log.id} className="hover:bg-gray-50">
                                      <td className="p-4 font-bold">{log.employees?.name} <span className="text-xs text-gray-400 block font-mono">{log.employee_id}</span></td>
                                      <td className="p-4 font-mono font-bold">{log.date}</td>
                                      <td className="p-4 font-mono text-blue-600 dir-ltr font-bold tracking-wide">{log.times}</td>
                                      <td className="p-4">
                                          {log.is_manual ? 
                                              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold">يدوي</span> : 
                                              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">ملف</span>
                                          }
                                      </td>
                                      <td className="p-4 text-xs text-gray-500">
                                          {log.responsible && <div className="font-bold text-gray-700 mb-1">{log.responsible}</div>}
                                          {log.created_at ? new Date(log.created_at).toLocaleString('ar-EG') : '-'}
                                      </td>
                                      <td className="p-4 text-center">
                                          <button 
                                              onClick={() => handleDeleteLog(log.id)}
                                              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                              title="حذف السجل"
                                          >
                                              <Trash2 className="w-4 h-4"/>
                                          </button>
                                      </td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>

              {/* Pagination */}
              <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
                  <button 
                      onClick={() => setLogsPage(p => Math.max(0, p - 1))}
                      disabled={logsPage === 0}
                      className="px-4 py-2 bg-white border rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-gray-100 flex items-center gap-2"
                  >
                      <ChevronRight className="w-4 h-4"/> السابق
                  </button>
                  <span className="text-xs font-bold text-gray-500">
                      صفحة {logsPage + 1} (إجمالي {logsTotal} سجل)
                  </span>
                  <button 
                      onClick={() => setLogsPage(p => p + 1)}
                      disabled={(logsPage + 1) * ITEMS_PER_PAGE >= logsTotal}
                      className="px-4 py-2 bg-white border rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-gray-100 flex items-center gap-2"
                  >
                      التالي <ChevronLeft className="w-4 h-4"/>
                  </button>
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
