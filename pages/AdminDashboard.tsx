
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, Settings, Users, FileText, Calendar, 
  Clock, BarChart3, Mail, Bell, Plus, Upload, Trash2, CheckCircle, XCircle, FileSpreadsheet, Info, Download, X
} from 'lucide-react';
import { GeneralSettings, Employee, LeaveRequest, AttendanceRecord, InternalMessage } from '../types';
import * as XLSX from 'xlsx';

// --- المساعدات الذكية للتواريخ (حل مشكلة Serial Numbers 45871) ---

const MONTH_MAP: { [key: string]: string } = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
};

/**
 * تحويل أي قيمة تاريخ قادمة من إكسيل إلى صيغة YYYY-MM-DD المقبولة في Postgres
 */
const formatDateForDB = (val: any): string | null => {
  if (val === undefined || val === null || val === '') return null;

  // 1. إذا كان كائن تاريخ JS بالفعل
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().split('T')[0];
  }

  // 2. إذا كان رقم تسلسلي من إكسيل (مثلاً 45871)
  const num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 60000) { 
    // تاريخ بداية إكسيل هو 30 ديسمبر 1899. الفرق بينه وبين JS هو 25569 يوم.
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }

  const str = String(val).trim();
  
  // 3. مطابقة الصيغة المطلوبة "Aug 2, 2025"
  const matchFancy = str.match(/^([a-zA-Z]{3,9})\s+(\d{1,2}),\s+(\d{4})$/);
  if (matchFancy) {
    const monthName = matchFancy[1].toLowerCase().substring(0, 3);
    const day = matchFancy[2].padStart(2, '0');
    const year = matchFancy[3];
    const monthNum = MONTH_MAP[monthName];
    if (monthNum) return `${year}-${monthNum}-${day}`;
  }

  // 4. مطابقة الصيغة القياسية YYYY-MM-DD
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
  
  // 5. مطابقة الصيغة التقليدية DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  // إذا فشل كل شيء، حاول تحويل النص مباشرة
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch(e) {}

  return null; 
};

/**
 * تحويل تاريخ قاعدة البيانات إلى الصيغة المطلوبة "Aug 2, 2025" للعرض
 */
const formatDateForExcelDisplay = (dateStr: string | null | undefined) => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
};

// --- مكونات واجهة المستخدم العامة ---

function Input({ label, type = 'text', value, onChange, placeholder }: any) {
  return (
    <div className="text-right">
      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
      <input 
        type={type} 
        value={value} 
        onChange={e => onChange(e.target.value)}
        className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all outline-none"
        placeholder={placeholder}
      />
    </div>
  );
}

function Select({ label, options, value, onChange }: any) {
  return (
    <div className="text-right">
      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
      <select 
        value={value} 
        onChange={e => onChange(e.target.value)}
        className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all outline-none"
      >
        {options.map((opt: any) => (
          typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function ExcelInfo({ fields, sampleData, fileName }: { fields: string[], sampleData?: any[], fileName?: string }) {
  const downloadSample = () => {
    if (!sampleData) return;
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample");
    XLSX.writeFile(wb, `${fileName || 'sample'}.xlsx`);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg mb-4 flex flex-col gap-3 text-right">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs text-amber-800 font-bold mb-1">أعمدة ملف الإكسيل (يجب أن تطابق قاعدة البيانات):</p>
          <div className="flex flex-wrap gap-2">
            {fields.map(f => <span key={f} className="bg-white px-2 py-0.5 rounded border border-amber-300 text-[10px] font-mono text-amber-700">{f}</span>)}
          </div>
        </div>
      </div>
      {sampleData && (
        <button 
          onClick={downloadSample}
          className="flex items-center text-xs font-bold text-amber-700 hover:text-amber-900 bg-amber-100/50 w-fit px-3 py-1.5 rounded-md border border-amber-200 transition-colors"
        >
          <Download className="w-3.5 h-3.5 ml-1.5" /> تحميل نموذج إكسيل جاهز
        </button>
      )}
    </div>
  );
}

function ExcelUploadButton({ onData, label = "رفع إكسيل", icon = <Upload className="w-4 h-4 ml-2" /> }: any) {
  const [loading, setLoading] = useState(false);
  
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        // تفعيل cellDates: true لضمان معالجة التواريخ برمجياً
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        onData(data);
      } catch (err) {
        alert("خطأ في قراءة ملف الإكسيل");
      } finally {
        setLoading(false);
        e.target.value = ''; 
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <label className="flex items-center bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 cursor-pointer font-semibold transition-all shadow-sm">
      {loading ? 'جاري التحميل...' : <>{icon} {label}</>}
      <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFile} />
    </label>
  );
}

// --- الأقسام التفصيلية ---

function GeneralSettingsTab({ center }: { center: GeneralSettings }) {
  const [settings, setSettings] = useState<GeneralSettings>({ ...center, holidays: center.holidays || [] });
  const [newHoliday, setNewHoliday] = useState('');

  const handleSave = async () => {
    const { error } = await supabase.from('general_settings').update(settings).eq('id', center.id);
    if (error) alert('خطأ في الحفظ');
    else alert('تم الحفظ بنجاح');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold border-b pb-4 text-gray-800">الإعدادات العامة</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="اسم المركز" value={settings.center_name} onChange={(v:any) => setSettings({...settings, center_name: v})} />
        <Input label="اسم الإدارة" value={settings.admin_name} onChange={(v:any) => setSettings({...settings, admin_name: v})} />
        <Input label="باسورد المركز" type="password" value={settings.password} onChange={(v:any) => setSettings({...settings, password: v})} />
        <Input label="تليفون المركز" value={settings.phone} onChange={(v:any) => setSettings({...settings, phone: v})} />
      </div>
      <div className="border-t pt-4">
        <h3 className="font-bold text-gray-700 mb-3 flex items-center"><Calendar className="w-4 h-4 ml-2"/> إدارة العطلات الرسمية</h3>
        <div className="flex gap-2 mb-4">
          <input type="date" value={newHoliday} onChange={e => setNewHoliday(e.target.value)} className="p-2 border rounded-lg outline-none" />
          <button onClick={() => { if(newHoliday) setSettings({...settings, holidays: [...(settings.holidays||[]), newHoliday]}); setNewHoliday(''); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold"><Plus className="w-4 h-4"/></button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(settings.holidays || []).map(date => (
            <span key={date} className="bg-gray-100 px-3 py-1 rounded-full text-xs border flex items-center gap-2">
              {formatDateForExcelDisplay(date)}
              <button onClick={() => setSettings({...settings, holidays: (settings.holidays || []).filter(d => d !== date)})} className="text-red-500"><X className="w-3 h-3"/></button>
            </span>
          ))}
        </div>
      </div>
      <button onClick={handleSave} className="bg-emerald-600 text-white px-8 py-3 rounded-lg hover:bg-emerald-700 font-bold">حفظ التغييرات</button>
    </div>
  );
}

function DoctorsTab({ employees, onRefresh, centerId }: { employees: Employee[], onRefresh: () => void, centerId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Employee>>({ gender: 'ذكر', status: 'نشط', center_id: centerId });

  const handleImport = async (data: any[]) => {
    const formatted = data.map(row => ({
      employee_id: String(row.employee_id || ''),
      name: row.name || '',
      national_id: String(row.national_id || ''),
      specialty: row.specialty || '',
      phone: String(row.phone || ''),
      gender: row.gender || 'ذكر',
      status: row.status || 'نشط',
      center_id: centerId,
      join_date: formatDateForDB(row.join_date),
      leave_annual_balance: row.leave_annual_balance || 21,
      leave_casual_balance: row.leave_casual_balance || 7,
      remaining_annual: row.leave_annual_balance || 21,
      remaining_casual: row.leave_casual_balance || 7,
    }));
    
    const { error } = await supabase.from('employees').insert(formatted);
    if (error) alert("خطأ: " + error.message);
    else { alert("تم استيراد الموظفين بنجاح"); onRefresh(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">إدارة الموظفين والأطباء</h2>
        <div className="flex gap-2">
           <ExcelUploadButton onData={handleImport} label="رفع ملف الموظفين" />
           <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center">{showForm ? 'إغلاق' : <Plus className="w-4 h-4" />}</button>
        </div>
      </div>
      <ExcelInfo 
        fields={['employee_id', 'name', 'national_id', 'specialty', 'join_date', 'leave_annual_balance']} 
        sampleData={[{employee_id: '1001', name: 'د. محمد علي', national_id: '29001010000', specialty: 'باطنة', join_date: 'Aug 2, 2025', leave_annual_balance: 21}]}
        fileName="employees_db_match"
      />
      {showForm && (
        <div className="bg-gray-50 p-6 rounded-xl border grid grid-cols-1 md:grid-cols-2 gap-4">
           <Input label="كود الموظف" value={formData.employee_id} onChange={(v:any) => setFormData({...formData, employee_id: v})} />
           <Input label="الاسم الكامل" value={formData.name} onChange={(v:any) => setFormData({...formData, name: v})} />
           <Input label="الرقم القومي" value={formData.national_id} onChange={(v:any) => setFormData({...formData, national_id: v})} />
           <Input label="تاريخ التعيين" type="date" value={formData.join_date} onChange={(v:any) => setFormData({...formData, join_date: v})} />
           <button onClick={async () => { await supabase.from('employees').insert([formData]); onRefresh(); setShowForm(false); }} className="md:col-span-2 bg-emerald-600 text-white py-3 rounded-lg font-bold">إضافة الموظف</button>
        </div>
      )}
      <div className="overflow-x-auto border rounded-xl">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">الكود</th>
              <th className="p-3">الاسم</th>
              <th className="p-3">التخصص</th>
              <th className="p-3">تاريخ التعيين</th>
              <th className="p-3 text-center">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono">{emp.employee_id}</td>
                <td className="p-3 font-bold">{emp.name}</td>
                <td className="p-3">{emp.specialty}</td>
                <td className="p-3">{formatDateForExcelDisplay(emp.join_date)}</td>
                <td className="p-3 text-center"><button onClick={async () => { if(confirm('حذف؟')) { await supabase.from('employees').delete().eq('id', emp.id); onRefresh(); } }} className="text-red-500"><Trash2 className="w-4 h-4"/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttendanceTab({ employees, onRefresh }: { employees: Employee[], onRefresh: () => void }) {
  const [formData, setFormData] = useState<Partial<AttendanceRecord>>({ 
    date: new Date().toISOString().split('T')[0], 
    check_in_status: 'حاضر', 
    check_out_status: 'منصرف'
  });

  const handleImportAttendance = async (data: any[]) => {
    const validIds = new Set(employees.map(e => e.employee_id));
    const processedData: any[] = [];

    data.forEach(row => {
      // مطابقة الحقول تماماً مع قاعدة البيانات (تتعرف على العربي والإنجليزي)
      const eid = String(row.employee_id || row['employee_id'] || '');
      const dbDate = formatDateForDB(row.date || row['date']);
      
      if (validIds.has(eid) && dbDate) {
        processedData.push({
          employee_id: eid,
          date: dbDate,
          check_in: row.check_in || null,
          check_out: row.check_out || null,
          check_in_status: row.check_in_status || 'حاضر',
          check_out_status: row.check_out_status || 'منصرف',
          notes: row.notes || ''
        });
      }
    });

    if (processedData.length === 0) return alert("لا توجد بيانات صالحة. تأكد من أن أسماء الأعمدة تطابق الحقول المطلوبة.");

    const uniqueDates = Array.from(new Set(processedData.map(d => d.date)));
    const { data: existing, error: checkErr } = await supabase.from('attendance').select('employee_id, date').in('date', uniqueDates);
    if (checkErr) return alert("فشل الفحص: " + checkErr.message);

    const existingKeys = new Set(existing?.map(r => `${r.employee_id}-${r.date}`));
    const finalToInsert = processedData.filter(item => !existingKeys.has(`${item.employee_id}-${item.date}`));

    if (finalToInsert.length > 0) {
      const { error } = await supabase.from('attendance').insert(finalToInsert);
      if (error) alert("خطأ في الحفظ: " + error.message);
      else { alert(`تم رفع ${finalToInsert.length} سجل بنجاح. تم تجاهل ${processedData.length - finalToInsert.length} سجل مكرر.`); onRefresh(); }
    } else {
      alert("جميع السجلات مكررة وموجودة مسبقاً.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">الحضور والانصراف اليومي</h2>
        <ExcelUploadButton onData={handleImportAttendance} label="رفع ملف البصمة" />
      </div>
      <ExcelInfo 
        fields={['employee_id', 'date', 'check_in', 'check_out', 'check_in_status']} 
        sampleData={[{employee_id: '1001', date: 'Aug 2, 2025', check_in: '08:30', check_out: '14:30', check_in_status: 'حاضر'}]}
        fileName="attendance_exact_match"
      />
      <div className="bg-gray-50 p-6 rounded-xl border grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="اختر الموظف" options={[{value: '', label: '-- اختر --'}, ...employees.map(e => ({value: e.employee_id, label: e.name}))]} value={formData.employee_id} onChange={(v:any) => setFormData({...formData, employee_id: v})} />
        <Input label="التاريخ" type="date" value={formData.date} onChange={(v:any) => setFormData({...formData, date: v})} />
        <Input label="وقت الحضور" type="time" value={formData.check_in || ''} onChange={(v:any) => setFormData({...formData, check_in: v})} />
        <Input label="وقت الانصراف" type="time" value={formData.check_out || ''} onChange={(v:any) => setFormData({...formData, check_out: v})} />
        <button onClick={async () => { if(!formData.employee_id) return alert('اختر الموظف'); await supabase.from('attendance').insert([formData]); onRefresh(); alert('تم الحفظ يدوياً'); }} className="md:col-span-2 bg-blue-600 text-white py-3 rounded-lg font-bold">إضافة سجل يدوي</button>
      </div>
    </div>
  );
}

function LeavesTab({ requests, onRefresh }: { requests: LeaveRequest[], onRefresh: () => void }) {
  const handleImport = async (data: any[]) => {
    const formatted = data.map(row => ({
      employee_id: String(row.employee_id || ''),
      type: row.type || 'اعتيادي',
      start_date: formatDateForDB(row.start_date),
      end_date: formatDateForDB(row.end_date),
      status: row.status || 'مقبول',
      backup_person: row.backup_person || '',
      notes: row.notes || ''
    }));
    const { error } = await supabase.from('leave_requests').insert(formatted);
    if (error) alert(error.message); else { alert("تم استيراد الإجازات"); onRefresh(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">إدارة الإجازات</h2>
        <ExcelUploadButton onData={handleImport} label="رفع أرشيف إجازات" />
      </div>
      <div className="space-y-4">
        {requests.map(req => (
          <div key={req.id} className="p-4 border rounded-xl flex justify-between items-center bg-white shadow-sm">
            <div>
              <p className="font-bold">{req.employee_name} - {req.type}</p>
              <p className="text-xs text-gray-500">{formatDateForExcelDisplay(req.start_date)} إلى {formatDateForExcelDisplay(req.end_date)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={async () => { await supabase.from('leave_requests').update({status: 'مقبول'}).eq('id', req.id); onRefresh(); }} className="p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition-colors"><CheckCircle/></button>
              <button onClick={async () => { await supabase.from('leave_requests').update({status: 'مرفوض'}).eq('id', req.id); onRefresh(); }} className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"><XCircle/></button>
            </div>
          </div>
        ))}
        {requests.length === 0 && <p className="text-center text-gray-400 py-20 font-bold">لا توجد طلبات معلقة حالياً</p>}
      </div>
    </div>
  );
}

function EveningScheduleTab() {
  const handleExcelSchedule = async (data: any[]) => {
    const formatted = data.map(row => ({
      date: formatDateForDB(row.date),
      specs: String(row.specs || '').split(','),
      doctors: String(row.doctors || '').split(',')
    }));
    const { error } = await supabase.from('evening_schedule').insert(formatted);
    if(error) alert(error.message); else alert("تم رفع الجدول بنجاح");
  };
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold border-b pb-4">الجدول المسائي</h2>
      <ExcelUploadButton onData={handleExcelSchedule} label="رفع جدول المسائي" />
      <ExcelInfo 
        fields={['date', 'specs', 'doctors']} 
        sampleData={[{date: 'Aug 2, 2025', specs: 'باطنة,أطفال', doctors: 'د.أحمد,د.سارة'}]}
        fileName="evening_db_match"
      />
    </div>
  );
}

function ReportsTab() {
  const [reportData, setReportData] = useState<any[]>([]);
  const fetchReport = async () => {
    const { data } = await supabase.from('attendance').select('*').limit(200).order('date', {ascending: false});
    if(data) setReportData(data);
  };
  const exportExcel = () => {
    const formatted = reportData.map(row => ({
      'employee_id': row.employee_id,
      'date': formatDateForExcelDisplay(row.date),
      'check_in': row.check_in,
      'check_out': row.check_out,
      'check_in_status': row.check_in_status
    }));
    const ws = XLSX.utils.json_to_sheet(formatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AttendanceReport");
    XLSX.writeFile(wb, "MedicalCenter_Report.xlsx");
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">التقارير والإحصائيات</h2>
        <button onClick={exportExcel} disabled={reportData.length === 0} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center disabled:bg-gray-400">
          <FileSpreadsheet className="w-4 h-4 ml-2" /> تصدير للتقرير
        </button>
      </div>
      <button onClick={fetchReport} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold">توليد أحدث تقرير</button>
      <div className="overflow-x-auto border rounded-xl shadow-sm">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">كود الموظف</th>
              <th className="p-3">التاريخ</th>
              <th className="p-3">حضور</th>
              <th className="p-3">انصراف</th>
              <th className="p-3">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((r,i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono">{r.employee_id}</td>
                <td className="p-3">{formatDateForExcelDisplay(r.date)}</td>
                <td className="p-3 text-emerald-600">{r.check_in || '--'}</td>
                <td className="p-3 text-red-500">{r.check_out || '--'}</td>
                <td className="p-3"><span className="text-xs font-bold bg-gray-100 px-2 py-0.5 rounded">{r.check_in_status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertsTab({ employees, sender }: { employees: Employee[], sender: string }) {
  const [recipient, setRecipient] = useState('');
  const [msg, setMsg] = useState('');
  const send = async () => {
    if(!recipient || !msg) return alert('أكمل البيانات');
    const { error } = await supabase.from('messages').insert([{ from_user: sender, to_user: recipient, content: msg }]);
    if(!error) { alert('تم الإرسال بنجاح'); setMsg(''); }
  };
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold border-b pb-4 text-gray-800">إرسال التنبيهات</h2>
      <Select label="المستلم" options={[{value: '', label: '-- اختر --'}, {value: 'all', label: 'الكل'}, ...employees.map(e => ({value: e.employee_id, label: e.name}))]} value={recipient} onChange={setRecipient} />
      <textarea className="w-full p-3 border rounded-lg min-h-[120px] focus:ring-2 focus:ring-blue-500 outline-none" placeholder="اكتب نص التنبيه هنا..." value={msg} onChange={e => setMsg(e.target.value)} />
      <button onClick={send} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-all">إرسال الآن</button>
    </div>
  );
}

// --- المكون الرئيسي ---

interface AdminDashboardProps { onBack: () => void; }

const SidebarBtn = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-xl transition-all font-semibold ${active ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>
    <span className="ml-3">{icon}</span>{label}
  </button>
);

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [centers, setCenters] = useState<GeneralSettings[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<GeneralSettings | null>(null);
  const [activeTab, setActiveTab] = useState('settings');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    supabase.from('general_settings').select('*').then(({data}) => { if(data) setCenters(data); });
  }, []);

  const fetchDashboardData = async () => {
    if (!selectedCenter) return;
    const [empRes, leaveRes] = await Promise.all([
      supabase.from('employees').select('*').eq('center_id', selectedCenter.id),
      supabase.from('leave_requests').select(`*, employees(name)`).eq('status', 'معلق').order('created_at', { ascending: false })
    ]);
    if (empRes.data) setEmployees(empRes.data);
    if (leaveRes.data) setLeaveRequests((leaveRes.data as any[]).map(l => ({...l, employee_name: l.employees?.name})));
  };

  const handleLogin = () => {
    if(selectedCenter && adminPassword === selectedCenter.password) {
      setIsAdminLoggedIn(true);
      fetchDashboardData();
    } else {
      alert('كلمة المرور غير صحيحة');
    }
  };

  if (!isAdminLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-6 text-right">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-6 hover:underline"><ArrowRight className="ml-1" /> رجوع</button>
          <h2 className="text-2xl font-bold mb-6 text-center">دخول الإدارة</h2>
          <div className="space-y-4">
            <select className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" onChange={(e) => setSelectedCenter(centers.find(c => c.id === e.target.value) || null)}>
              <option value="">-- اختر المركز --</option>
              {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}
            </select>
            <input type="password" className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="الباسورد" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">دخول للوحة التحكم</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 text-right">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">إدارة: {selectedCenter?.center_name}</h1>
          <p className="text-gray-500">مرحبا بك في لوحة تحكم الإدارة المركزية</p>
        </div>
        <button onClick={onBack} className="bg-gray-200 px-6 py-2 rounded-lg font-semibold flex items-center hover:bg-gray-300">تسجيل خروج <ArrowRight className="mr-2"/></button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-2">
          <SidebarBtn active={activeTab === 'settings'} icon={<Settings/>} label="الإعدادات" onClick={() => setActiveTab('settings')} />
          <SidebarBtn active={activeTab === 'doctors'} icon={<Users/>} label="الموظفون" onClick={() => setActiveTab('doctors')} />
          <SidebarBtn active={activeTab === 'leaves'} icon={<FileText/>} label="الإجازات" onClick={() => setActiveTab('leaves')} />
          <SidebarBtn active={activeTab === 'evening'} icon={<Calendar/>} label="الجدول المسائي" onClick={() => setActiveTab('evening')} />
          <SidebarBtn active={activeTab === 'attendance'} icon={<Clock/>} label="الحضور اليومي" onClick={() => setActiveTab('attendance')} />
          <SidebarBtn active={activeTab === 'reports'} icon={<BarChart3/>} label="التقارير" onClick={() => setActiveTab('reports')} />
          <SidebarBtn active={activeTab === 'alerts'} icon={<Bell/>} label="التنبيهات" onClick={() => setActiveTab('alerts')} />
        </div>
        <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border min-h-[600px]">
          {activeTab === 'settings' && selectedCenter && <GeneralSettingsTab center={selectedCenter} />}
          {activeTab === 'doctors' && <DoctorsTab employees={employees} onRefresh={fetchDashboardData} centerId={selectedCenter!.id} />}
          {activeTab === 'leaves' && <LeavesTab requests={leaveRequests} onRefresh={fetchDashboardData} />}
          {activeTab === 'evening' && <EveningScheduleTab />}
          {activeTab === 'attendance' && <AttendanceTab employees={employees} onRefresh={fetchDashboardData} />}
          {activeTab === 'reports' && <ReportsTab />}
          {activeTab === 'alerts' && <AlertsTab employees={employees} sender="admin" />}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
