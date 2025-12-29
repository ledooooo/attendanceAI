import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { ExcelUploadButton, downloadSample } from '../../../components/ui/ExcelUploadButton';
import { Calendar, Save, List, Trash2, MapPin, Users, Download } from 'lucide-react';

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// دالة مساعدة لتنسيق التاريخ
const formatDateForDB = (dateInput: any) => {
    if (!dateInput) return null;
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
};import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, EveningSchedule } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { ExcelUploadButton } from '../../../components/ui/ExcelUploadButton';
import * as XLSX from 'xlsx';
import { 
  CalendarRange, Save, Users, Search, Download, 
  Trash2, CheckCircle2, AlertCircle, Calendar 
} from 'lucide-react';

// دالة مساعدة لتنسيق التاريخ
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

export default function EveningSchedulesTab({ employees }: { employees: Employee[] }) {
  const [schedules, setSchedules] = useState<EveningSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // حالة النموذج الحالي (إنشاء/تعديل)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]); // أسماء الأطباء
  const [notes, setNotes] = useState('');

  // فلاتر الموظفين (لاختيار الأطباء)
  const [fName, setFName] = useState('');
  const [fId, setFId] = useState('');
  const [fSpec, setFSpec] = useState('all');
  const [fStatus, setFStatus] = useState('نشط');

  useEffect(() => {
    fetchSchedules();
  }, []);

  // عند تغيير التاريخ، نملأ البيانات إذا كان الجدول موجوداً
  useEffect(() => {
    const existing = schedules.find(s => s.date === selectedDate);
    if (existing) {
        setSelectedDoctors(existing.doctors || []);
        setNotes(existing.notes || '');
    } else {
        setSelectedDoctors([]);
        setNotes('');
    }
  }, [selectedDate, schedules]);

  const fetchSchedules = async () => {
    setLoading(true);
    const { data } = await supabase
        .from('evening_schedules')
        .select('*')
        .order('date', { ascending: false })
        .limit(60); // آخر شهرين مثلاً
    
    if (data) setSchedules(data);
    setLoading(false);
  };

  // --- 1. تحميل نموذج العينة ---
  const handleDownloadSample = () => {
    const sampleData = [
      {
        'التاريخ': '2023-11-01',
        'الأطباء': 'د. أحمد محمد, د. سارة علي',
        'ملاحظات': 'نوبتجية طوارئ'
      },
      {
        'التاريخ': '2023-11-02',
        'الأطباء': 'د. محمد حسن',
        'ملاحظات': ''
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Schedules");
    XLSX.writeFile(wb, "نموذج_جداول_النوبتجية.xlsx");
  };

  // --- 2. رفع ملف الإكسيل (Smart Upsert) ---
  const handleExcelImport = async (data: any[]) => {
    setIsProcessing(true);
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    try {
        // جلب كل الجداول الحالية للمقارنة
        const { data: currentDbSchedules } = await supabase.from('evening_schedules').select('*');
        const dbSchedules = currentDbSchedules || [];
        const rowsToUpsert: any[] = [];
        const processedDates = new Set();

        for (const row of data) {
            // قراءة وتنسيق البيانات
            const date = formatDateForDB(row['التاريخ'] || row.date);
            if (!date) continue;

            if (processedDates.has(date)) continue; // منع تكرار التاريخ في نفس الملف
            processedDates.add(date);

            const doctorsStr = String(row['الأطباء'] || row.doctors || '').trim();
            // تحويل النص إلى مصفوفة (الفصل بالفاصلة)
            const doctorsArr = doctorsStr ? doctorsStr.split(',').map(d => d.trim()).filter(Boolean) : [];
            
            const rowNotes = String(row['ملاحظات'] || row.notes || '').trim();

            const payload = {
                date: date,
                doctors: doctorsArr,
                notes: rowNotes
            };

            // البحث عن الجدول في قاعدة البيانات
            const existingRecord = dbSchedules.find(s => s.date === date);

            if (existingRecord) {
                // مقارنة المصفوفات والملاحظات
                const doctorsChanged = JSON.stringify(existingRecord.doctors.sort()) !== JSON.stringify(payload.doctors.sort());
                const notesChanged = (existingRecord.notes || '') !== payload.notes;

                if (doctorsChanged || notesChanged) {
                    rowsToUpsert.push({ ...payload, id: existingRecord.id });
                    updated++;
                } else {
                    skipped++;
                }
            } else {
                // جديد
                rowsToUpsert.push(payload);
                inserted++;
            }
        }

        if (rowsToUpsert.length > 0) {
            const { error } = await supabase.from('evening_schedules').upsert(rowsToUpsert);
            if (error) throw error;
        }

        alert(`تقرير المعالجة:\n✅ تم إضافة: ${inserted} يوم\n🔄 تم تحديث: ${updated} يوم\n⏭️ تم تجاهل (متطابق): ${skipped} يوم`);
        fetchSchedules();

    } catch (err: any) {
        alert('خطأ أثناء المعالجة: ' + err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // --- حفظ يدوي للجدول ---
  const handleSave = async () => {
      if (!selectedDate) return alert("اختر التاريخ");
      if (selectedDoctors.length === 0) return alert("اختر طبيباً واحداً على الأقل");

      const payload = {
          date: selectedDate,
          doctors: selectedDoctors,
          notes: notes
      };

      // Upsert بناءً على التاريخ (بافتراض أن التاريخ Unique Constraint أو يتم التعامل معه في الكود)
      // هنا سنبحث عن الـ ID أولاً لضمان التحديث السليم إذا لم يكن التاريخ مفتاح أساسي
      const existing = schedules.find(s => s.date === selectedDate);
      const finalPayload = existing ? { ...payload, id: existing.id } : payload;

      const { error } = await supabase.from('evening_schedules').upsert(finalPayload);
      
      if (!error) {
          alert("تم حفظ الجدول بنجاح");
          fetchSchedules();
      } else {
          alert("خطأ: " + error.message);
      }
  };

  // حذف جدول
  const handleDelete = async (id: string) => {
      if (!confirm("هل أنت متأكد من حذف هذا الجدول؟")) return;
      await supabase.from('evening_schedules').delete().eq('id', id);
      fetchSchedules();
  };

  // تبديل اختيار الموظف
  const toggleDoctor = (name: string) => {
      if (selectedDoctors.includes(name)) {
          setSelectedDoctors(selectedDoctors.filter(d => d !== name));
      } else {
          setSelectedDoctors([...selectedDoctors, name]);
      }
  };

  // فلترة الموظفين للاختيار
  const filteredEmployees = employees.filter(e => 
      (e.name.includes(fName)) &&
      (e.employee_id.includes(fId)) &&
      (fSpec === 'all' || e.specialty === fSpec) &&
      (fStatus === 'all' || e.status === fStatus)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4">
            <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800">
                <CalendarRange className="w-7 h-7 text-indigo-600"/> جداول النوبتجية
            </h2>
            <div className="flex gap-2">
                <button 
                    onClick={handleDownloadSample} 
                    className="bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 hover:text-indigo-600 transition-all shadow-sm text-sm"
                >
                    <Download className="w-4 h-4"/> نموذج العينة
                </button>
                <ExcelUploadButton onData={handleExcelImport} label={isProcessing ? "جاري المعالجة..." : "رفع الجدول"} />
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Col 1: Schedule Controls */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-[30px] border shadow-sm">
                    <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-600"/> إعداد اليوم
                    </h3>
                    
                    <div className="space-y-4">
                        <Input type="date" label="التاريخ" value={selectedDate} onChange={setSelectedDate} />
                        
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">الأطباء المختارون</label>
                            <div className="min-h-[100px] p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex flex-wrap gap-2">
                                {selectedDoctors.length === 0 && <span className="text-gray-400 text-xs">لم يتم اختيار أحد</span>}
                                {selectedDoctors.map((doc, idx) => (
                                    <span key={idx} className="bg-white text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-200 flex items-center gap-1 shadow-sm">
                                        {doc}
                                        <button onClick={() => toggleDoctor(doc)} className="hover:text-red-500"><AlertCircle className="w-3 h-3"/></button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات</label>
                            <textarea 
                                className="w-full p-3 rounded-xl border bg-gray-50 outline-none focus:border-indigo-500 min-h-[80px] text-sm font-medium"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="ملاحظات النوبتجية..."
                            />
                        </div>

                        <button 
                            onClick={handleSave}
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex justify-center items-center gap-2"
                        >
                            <Save className="w-5 h-5"/> اعتماد الجدول
                        </button>
                    </div>
                </div>
            </div>

            {/* Col 2: Employee Selection */}
            <div className="lg:col-span-2 space-y-4">
                {/* Filters */}
                <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3 shadow-inner">
                    <Input label="الاسم" value={fName} onChange={setFName} placeholder="بحث..." />
                    <Input label="الكود" value={fId} onChange={setFId} placeholder="101..." />
                    <Select label="التخصص" options={['all', ...Array.from(new Set(employees.map(e=>e.specialty)))]} value={fSpec} onChange={setFSpec} />
                    <Select label="الحالة" options={['all', 'نشط', 'موقوف']} value={fStatus} onChange={setFStatus} />
                </div>

                {/* List */}
                <div className="bg-white border rounded-[30px] shadow-sm overflow-hidden h-[500px] flex flex-col">
                    <div className="p-4 border-b bg-gray-50 font-bold text-gray-600 flex justify-between items-center">
                        <span>قائمة الموظفين ({filteredEmployees.length})</span>
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">اضغط للاختيار</span>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar p-2 grid grid-cols-1 md:grid-cols-2 gap-2 content-start">
                        {filteredEmployees.map(emp => {
                            const isSelected = selectedDoctors.includes(emp.name);
                            return (
                                <div 
                                    key={emp.id} 
                                    onClick={() => toggleDoctor(emp.name)}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                                        isSelected 
                                        ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' 
                                        : 'bg-white border-gray-100 hover:border-indigo-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white"/>}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-gray-800">{emp.name}</div>
                                        <div className="text-xs text-gray-500 font-mono">{emp.specialty} • {emp.employee_id}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>

        {/* Bottom: Archive */}
        <div className="bg-white rounded-[30px] border shadow-sm p-6">
            <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                <CalendarRange className="w-5 h-5 text-gray-500"/> أرشيف الجداول (آخر 60 يوم)
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-right min-w-[600px]">
                    <thead className="bg-gray-100 font-black text-gray-600">
                        <tr>
                            <th className="p-4 rounded-r-xl">التاريخ</th>
                            <th className="p-4">طاقم النوبتجية</th>
                            <th className="p-4">ملاحظات</th>
                            <th className="p-4 rounded-l-xl w-20"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {schedules.map(sch => (
                            <tr key={sch.id} className="hover:bg-gray-50 group">
                                <td className="p-4 font-mono font-bold text-indigo-600">{sch.date}</td>
                                <td className="p-4">
                                    <div className="flex flex-wrap gap-1">
                                        {sch.doctors.map((d, i) => (
                                            <span key={i} className="bg-gray-100 px-2 py-1 rounded text-xs font-bold text-gray-700">{d}</span>
                                        ))}
                                    </div>
                                </td>
                                <td className="p-4 text-gray-500">{sch.notes || '-'}</td>
                                <td className="p-4 text-center">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => { setSelectedDate(sch.date); window.scrollTo({top:0, behavior:'smooth'}); }}
                                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                                            title="تعديل"
                                        >
                                            <Calendar className="w-4 h-4"/>
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(sch.id)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                            title="حذف"
                                        >
                                            <Trash2 className="w-4 h-4"/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
}

export default function EveningSchedulesTab({ employees, centerName, centerId }: { employees: Employee[], centerName?: string, centerId?: string }) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [viewMonth, setViewMonth] = useState(new Date().toISOString().slice(0, 7));

    // فلاتر البحث
    const [searchName, setSearchName] = useState('');
    const [searchId, setSearchId] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterCenter, setFilterCenter] = useState('all');

    const fetchHistory = async () => {
        const { data } = await supabase.from('evening_schedules').select('*').order('date', { ascending: false });
        if (data) setHistory(data);
    };
    useEffect(() => { fetchHistory(); }, []);

    const handleSave = async () => {
        if (selectedDoctors.length === 0) return alert('برجاء اختيار الموظفين أولاً');
        const { data: existing } = await supabase.from('evening_schedules').select('id, doctors').eq('date', date).maybeSingle();
        if (existing) {
             await supabase.from('evening_schedules').update({ doctors: selectedDoctors }).eq('id', existing.id);
             alert('تم تحديث جدول النوبتجية');
        } else {
            await supabase.from('evening_schedules').insert([{ date, doctors: selectedDoctors }]);
            alert('تم إضافة جدول نوبتجية جديد');
        }
        fetchHistory(); setSelectedDoctors([]); 
    };

    const handleExcelImport = async (data: any[]) => {
        try {
            const cleanData = [];
            const processed = new Set();
            let duplicates = 0;

            for (const row of data) {
                const d = formatDateForDB(row.date || row['التاريخ']);
                if (!d) continue;

                if(processed.has(d)) { duplicates++; continue; }
                processed.add(d);

                const doctors = String(row.doctors || row['الموظفين'] || row['الأطباء'] || '').split(',').map(s => s.trim()).filter(s => s);
                const notes = String(row.notes || row['ملاحظات'] || '').trim();

                cleanData.push({ date: d, doctors, notes });
            }

            if (cleanData.length === 0) return alert('لا توجد بيانات صالحة');

            const { data: res, error } = await supabase.rpc('process_evening_bulk', { payload: cleanData });
            if (error) throw error;

            alert(`تقرير الاستيراد:\n- إضافة: ${res.inserted}\n- تحديث: ${res.updated}\n- تجاهل: ${res.skipped}`);
            fetchHistory();
        } catch (e:any) {
            alert('حدث خطأ: ' + e.message);
        }
    };

    const filteredEmployees = useMemo(() => {
        return employees.filter(e => 
            (e.name.toLowerCase().includes(searchName.toLowerCase())) && 
            (e.employee_id.includes(searchId)) &&
            (filterStatus === 'all' || e.status === filterStatus) &&
            (filterCenter === 'all' || e.center_id === filterCenter)
        );
    }, [employees, searchName, searchId, filterStatus, filterCenter]);
    
    const monthlyHistory = useMemo(() => history.filter(h => h.date.startsWith(viewMonth)), [history, viewMonth]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center border-b pb-4">
                <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800">
                    <Calendar className="w-7 h-7 text-indigo-600"/> جداول النوبتجية المسائية
                </h2>
                <div className="flex gap-2">
                    <button onClick={() => downloadSample('evening_schedule')} className="text-gray-400 p-2" title="تحميل عينة"><Download className="w-5 h-5"/></button>
                    <ExcelUploadButton onData={handleExcelImport} label="رفع جداول" />
                    <button 
                        onClick={() => setShowHistory(!showHistory)} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all shadow-sm ${showHistory ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                    >
                        <List className="w-4 h-4" /> الأرشيف
                    </button>
                </div>
            </div>

            {!showHistory ? (
                <div className="bg-gray-50 p-6 rounded-3xl border space-y-6 shadow-inner">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-1 w-full">
                            <Input label="تاريخ النوبتجية" type="date" value={date} onChange={setDate} />
                        </div>
                        <div className="flex-1 w-full text-right">
                            <label className="block text-xs font-black text-gray-400 mb-1">المركز الطبي المستهدف</label>
                            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-bold text-gray-800 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-blue-500" /> {centerName || 'المركز الحالي'}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Input label="بحث بالاسم" value={searchName} onChange={setSearchName} placeholder="أدخل اسم الموظف..." />
                        <Input label="بحث بالكود" value={searchId} onChange={setSearchId} placeholder="أدخل كود الموظف..." />
                        <Select label="حالة العمل" options={['all', 'نشط', 'موقوف', 'إجازة']} value={filterStatus} onChange={setFilterStatus} />
                        <Select label="المركز" options={['all', centerId || 'current']} value={filterCenter} onChange={setFilterCenter} />
                    </div>

                     <div className="space-y-2 text-right">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">اختر الموظفين لهذه النوبتجية</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto p-4 bg-white border rounded-2xl shadow-inner border-gray-100">
                            {filteredEmployees.map(emp => (
                                <label 
                                    key={emp.employee_id} 
                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${selectedDoctors.includes(emp.name) ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-gray-50 hover:border-indigo-100'}`}
                                >
                                    <input 
                                        type="checkbox" 
                                        checked={selectedDoctors.includes(emp.name)} 
                                        onChange={() => setSelectedDoctors(prev => prev.includes(emp.name) ? prev.filter(n => n !== emp.name) : [...prev, emp.name])} 
                                        className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500" 
                                    />
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-bold text-sm truncate">{emp.name}</p>
                                        <p className="text-[10px] text-gray-400 font-bold">{emp.employee_id} • {emp.specialty}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black ${emp.status === 'نشط' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{emp.status}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                     <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-600 text-white p-2 rounded-xl"><Users className="w-5 h-5"/></div>
                            <div className="text-indigo-600 font-black">عدد المختارين: <span className="text-2xl">{selectedDoctors.length}</span></div>
                        </div>
                        <button onClick={handleSave} className="bg-indigo-600 text-white px-12 py-3 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all flex items-center gap-2"><Save className="w-5 h-5" /> اعتماد الجدول</button>
                    </div>
                </div>
            ) : (
                <div className="animate-in slide-in-from-top duration-300 space-y-6">
                    <div className="flex items-center justify-between bg-white p-6 rounded-[30px] border shadow-sm">
                        <h3 className="text-xl font-black flex items-center gap-2 text-indigo-800"><List className="w-6 h-6"/> الأرشيف الشهري للجداول المعتمدة</h3>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-gray-400">فلترة بالشهر:</span>
                            <input type="month" value={viewMonth} onChange={e => setViewMonth(e.target.value)} className="p-2.5 border rounded-xl bg-gray-50 text-indigo-600 font-black outline-none" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {monthlyHistory.map(sch => (
                            <div key={sch.id} className="p-6 bg-white border border-indigo-50 rounded-[30px] shadow-sm hover:shadow-md transition-all relative group text-right">
                                <div className="absolute top-0 left-0 w-12 h-12 bg-red-50 rounded-br-[30px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={async () => { if(confirm('حذف هذا الجدول نهائياً؟')) { await supabase.from('evening_schedules').delete().eq('id', sch.id); fetchHistory(); } }} className="text-red-500 hover:scale-110"><Trash2 className="w-4 h-4"/></button>
                                </div>
                                <h4 className="font-black text-indigo-600 mb-3 border-b pb-2 flex justify-between">
                                    <span>{sch.date}</span>
                                    <span className="text-[10px] text-gray-400">{DAYS_AR[new Date(sch.date).getDay()]}</span>
                                </h4>
                                <div className="flex flex-wrap gap-1">
                                    {sch.doctors?.map((doc: string, idx: number) => (
                                        <span key={idx} className="bg-gray-50 px-3 py-1 rounded-lg text-[10px] font-bold text-gray-600 border border-gray-100 shadow-sm">{doc}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

}
