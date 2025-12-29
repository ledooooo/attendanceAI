import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, EveningSchedule } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { ExcelUploadButton } from '../../../components/ui/ExcelUploadButton';
import * as XLSX from 'xlsx';
import { 
  CalendarRange, Save, Users, Search, Download, 
  Trash2, CheckCircle2, AlertCircle, Calendar 
} from 'lucide-react';

// --- دالة مساعدة لتنسيق التاريخ ---
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
  const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);
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
        .limit(60); // آخر شهرين
    
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
        const { data: currentDbSchedules } = await supabase.from('evening_schedules').select('*');
        const dbSchedules = currentDbSchedules || [];
        const rowsToUpsert: any[] = [];
        const processedDates = new Set();

        for (const row of data) {
            const date = formatDateForDB(row['التاريخ'] || row.date);
            if (!date) continue;

            if (processedDates.has(date)) continue;
            processedDates.add(date);

            const doctorsStr = String(row['الأطباء'] || row.doctors || '').trim();
            const doctorsArr = doctorsStr ? doctorsStr.split(',').map(d => d.trim()).filter(Boolean) : [];
            const rowNotes = String(row['ملاحظات'] || row.notes || '').trim();

            const payload = {
                date: date,
                doctors: doctorsArr,
                notes: rowNotes
            };

            const existingRecord = dbSchedules.find(s => s.date === date);

            if (existingRecord) {
                const doctorsChanged = JSON.stringify(existingRecord.doctors.sort()) !== JSON.stringify(payload.doctors.sort());
                const notesChanged = (existingRecord.notes || '') !== payload.notes;

                if (doctorsChanged || notesChanged) {
                    rowsToUpsert.push({ ...payload, id: existingRecord.id });
                    updated++;
                } else {
                    skipped++;
                }
            } else {
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

  // حفظ يدوي للجدول
  const handleSave = async () => {
      if (!selectedDate) return alert("اختر التاريخ");
      if (selectedDoctors.length === 0) return alert("اختر طبيباً واحداً على الأقل");

      const payload = {
          date: selectedDate,
          doctors: selectedDoctors,
          notes: notes
      };

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

  const handleDelete = async (id: string) => {
      if (!confirm("هل أنت متأكد من حذف هذا الجدول؟")) return;
      await supabase.from('evening_schedules').delete().eq('id', id);
      fetchSchedules();
  };

  const toggleDoctor = (name: string) => {
      if (selectedDoctors.includes(name)) {
          setSelectedDoctors(selectedDoctors.filter(d => d !== name));
      } else {
          setSelectedDoctors([...selectedDoctors, name]);
      }
  };

  const filteredEmployees = employees.filter(e => 
      (e.name.includes(fName)) &&
      (e.employee_id.includes(fId)) &&
      (fSpec === 'all' || e.specialty === fSpec) &&
      (fStatus === 'all' || e.status === fStatus)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
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

            <div className="lg:col-span-2 space-y-4">
                <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3 shadow-inner">
                    <Input label="الاسم" value={fName} onChange={setFName} placeholder="بحث..." />
                    <Input label="الكود" value={fId} onChange={setFId} placeholder="101..." />
                    <Select label="التخصص" options={['all', ...Array.from(new Set(employees.map(e=>e.specialty)))]} value={fSpec} onChange={setFSpec} />
                    <Select label="الحالة" options={['all', 'نشط', 'موقوف']} value={fStatus} onChange={setFStatus} />
                </div>
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
