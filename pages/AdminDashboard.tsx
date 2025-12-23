
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, Settings, Users, FileText, Calendar, 
  Clock, BarChart3, Mail, Bell, Plus, Upload, Trash2, CheckCircle, XCircle, Send, FileSpreadsheet, Info, Download, X
} from 'lucide-react';
import { GeneralSettings, Employee, LeaveRequest, AttendanceRecord, InternalMessage } from '../types';
import * as XLSX from 'xlsx';

// --- Date Helpers for Excel ---

const MONTH_MAP: { [key: string]: string } = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
};

/**
 * Converts various date formats (including Excel Serial Numbers like 45871) to YYYY-MM-DD
 */
const formatDateForDB = (val: any) => {
  if (val === undefined || val === null || val === '') return null;

  // 1. Handle JS Date Objects (if XLSX read with cellDates: true)
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().split('T')[0];
  }

  // 2. Handle Excel numeric dates (Serial numbers like 45871)
  const num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 60000) { 
    // Excel epoch is Dec 30, 1899. JS epoch is Jan 1, 1970. Diff is 25569 days.
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }

  const str = String(val).trim();
  
  // 3. Match "Aug 2, 2025" or "August 2, 2025"
  const matchFancy = str.match(/^([a-zA-Z]{3,9})\s+(\d{1,2}),\s+(\d{4})$/);
  if (matchFancy) {
    const monthName = matchFancy[1].toLowerCase().substring(0, 3);
    const day = matchFancy[2].padStart(2, '0');
    const year = matchFancy[3];
    const monthNum = MONTH_MAP[monthName];
    if (monthNum) return `${year}-${monthNum}-${day}`;
  }

  // 4. Handle standard YYYY-MM-DD
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
  
  // 5. Handle DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  return str; // If it's a valid string date, Postgres will handle it; otherwise error.
};

// Convert YYYY-MM-DD (DB) to "Aug 2, 2025" (Excel Display)
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

// --- Generic UI Helpers ---
function Input({ label, type = 'text', value, onChange, placeholder }: any) {
  return (
    <div>
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
    <div>
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
    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg mb-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs text-amber-800 font-bold mb-1">أعمدة ملف الإكسيل المطلوبة:</p>
          <div className="flex flex-wrap gap-2">
            {fields.map(f => <span key={f} className="bg-white px-2 py-0.5 rounded border border-amber-300 text-[10px] text-amber-700">{f}</span>)}
          </div>
        </div>
      </div>
      {sampleData && (
        <button 
          onClick={downloadSample}
          className="flex items-center text-xs font-bold text-amber-700 hover:text-amber-900 bg-amber-100/50 w-fit px-3 py-1.5 rounded-md border border-amber-200 transition-colors"
        >
          <Download className="w-3.5 h-3.5 ml-1.5" /> تحميل نموذج إكسيل جاهز (.xlsx)
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
        // Updated to process dates properly
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        onData(data);
      } catch (err) {
        alert("خطأ في قراءة ملف الإكسيل");
      } finally {
        setLoading(false);
        e.target.value = ''; // Reset input
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

// --- Tab Components ---

function GeneralSettingsTab({ center }: { center: GeneralSettings }) {
  const [settings, setSettings] = useState<GeneralSettings>({ ...center, holidays: center.holidays || [] });
  const [newHoliday, setNewHoliday] = useState('');

  const handleSave = async () => {
    const { error } = await supabase.from('general_settings').update(settings).eq('id', center.id);
    if (error) alert('خطأ في الحفظ');
    else alert('تم الحفظ بنجاح');
  };

  const addHoliday = () => {
    if (!newHoliday) return;
    const currentHolidays = settings.holidays || [];
    if (currentHolidays.includes(newHoliday)) return alert('التاريخ موجود بالفعل');
    setSettings({...settings, holidays: [...currentHolidays, newHoliday]});
    setNewHoliday('');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold border-b pb-4">الإعدادات العامة للمركز</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="اسم المركز" value={settings.center_name} onChange={(v:any) => setSettings({...settings, center_name: v})} />
        <Input label="اسم الإدارة" value={settings.admin_name} onChange={(v:any) => setSettings({...settings, admin_name: v})} />
        <Input label="تليفون المركز" value={settings.phone} onChange={(v:any) => setSettings({...settings, phone: v})} />
        <Input label="عنوان المركز" value={settings.address} onChange={(v:any) => setSettings({...settings, address: v})} />
        <Input label="رابط اللوكيشن" value={settings.location_url} onChange={(v:any) => setSettings({...settings, location_url: v})} />
        <Input label="باسورد المركز" type="password" value={settings.password} onChange={(v:any) => setSettings({...settings, password: v})} />
      </div>
      <div className="border-t pt-4">
        <h3 className="font-bold text-gray-700 mb-3 flex items-center"><Calendar className="w-4 h-4 ml-2"/> إدارة العطلات الرسمية</h3>
        <div className="flex gap-2 mb-4">
          <input type="date" value={newHoliday} onChange={e => setNewHoliday(e.target.value)} className="p-2 border rounded-lg" />
          <button onClick={addHoliday} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold"><Plus className="w-4 h-4"/></button>
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
      <button onClick={handleSave} className="bg-emerald-600 text-white px-8 py-3 rounded-lg hover:bg-emerald-700 font-bold">حفظ الإعدادات</button>
    </div>
  );
}

function DoctorsTab({ employees, onRefresh, centerId }: { employees: Employee[], onRefresh: () => void, centerId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Employee>>({ gender: 'ذكر', status: 'نشط', center_id: centerId, leave_annual_balance: 21, leave_casual_balance: 7 });

  const handleAdd = async () => {
    const { error } = await supabase.from('employees').insert([formData]);
    if (error) alert('خطأ: ' + error.message);
    else { setShowForm(false); onRefresh(); }
  };

  const handleImport = async (data: any[]) => {
    const formatted = data.map(row => ({
      employee_id: String(row.employee_id || row['رقم الموظف']),
      name: row.name || row['الاسم'],
      national_id: String(row.national_id || row['الرقم القومي']),
      specialty: row.specialty || row['التخصص'],
      phone: String(row.phone || row['الهاتف'] || ''),
      email: row.email || row['الايميل'] || '',
      gender: row.gender || row['النوع'] || 'ذكر',
      grade: row.grade || row['الدرجة'] || '',
      status: row.status || 'نشط',
      center_id: centerId,
      leave_annual_balance: row.leave_annual_balance || 21,
      leave_casual_balance: row.leave_casual_balance || 7,
      remaining_annual: row.leave_annual_balance || 21,
      remaining_casual: row.leave_casual_balance || 7,
      join_date: formatDateForDB(row.join_date || row['تاريخ التعيين'])
    }));
    const { error } = await supabase.from('employees').insert(formatted);
    if (error) alert("خطأ: " + error.message);
    else { alert("تم رفع البيانات"); onRefresh(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">إعدادات الأطباء</h2>
        <div className="flex gap-2">
          <ExcelUploadButton onData={handleImport} label="استيراد موظفين" />
          <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center">
            {showForm ? 'إلغاء' : <><Plus className="w-4 h-4 ml-2" /> إضافة</>}
          </button>
        </div>
      </div>
      <ExcelInfo 
        fields={['employee_id', 'name', 'national_id', 'specialty', 'join_date']} 
        sampleData={[{employee_id: '1001', name: 'أحمد محمد', national_id: '12345678901234', specialty: 'باطنة', join_date: 'Aug 2, 2025'}]}
        fileName="employees_template"
      />
      {showForm && (
        <div className="bg-gray-50 p-6 rounded-xl border-2 border-dashed grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="رقم الموظف" value={formData.employee_id || ''} onChange={(v:any) => setFormData({...formData, employee_id: v})} />
          <Input label="الاسم" value={formData.name || ''} onChange={(v:any) => setFormData({...formData, name: v})} />
          <Input label="الرقم القومي" value={formData.national_id || ''} onChange={(v:any) => setFormData({...formData, national_id: v})} />
          <Input label="التخصص" value={formData.specialty || ''} onChange={(v:any) => setFormData({...formData, specialty: v})} />
          <Select label="الحالة" options={['نشط', 'موقوف']} value={formData.status} onChange={(v:any) => setFormData({...formData, status: v})} />
          <button onClick={handleAdd} className="md:col-span-3 bg-blue-600 text-white py-3 rounded-lg font-bold">تأكيد الإضافة</button>
        </div>
      )}
      <div className="overflow-x-auto border rounded-xl">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">رقم الموظف</th>
              <th className="p-3">الاسم</th>
              <th className="p-3">التخصص</th>
              <th className="p-3">تاريخ التعيين</th>
              <th className="p-3">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className="border-b">
                <td className="p-3 font-mono">{emp.employee_id}</td>
                <td className="p-3 font-bold">{emp.name}</td>
                <td className="p-3">{emp.specialty}</td>
                <td className="p-3">{formatDateForExcelDisplay(emp.join_date)}</td>
                <td className="p-3"><button onClick={async () => { if(confirm('حذف؟')) { await supabase.from('employees').delete().eq('id', emp.id); onRefresh(); } }} className="text-red-500"><Trash2 className="w-4 h-4"/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeavesTab({ requests, onRefresh }: { requests: LeaveRequest[], onRefresh: () => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold border-b pb-4">طلبات الإجازات</h2>
      <div className="space-y-4">
        {requests.map(req => (
          <div key={req.id} className="p-4 border rounded-xl flex justify-between items-center">
            <div>
              <p className="font-bold">{req.employee_name} - {req.type}</p>
              <p className="text-sm text-gray-500">{formatDateForExcelDisplay(req.start_date)} إلى {formatDateForExcelDisplay(req.end_date)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={async () => { await supabase.from('leave_requests').update({status: 'مقبول'}).eq('id', req.id); onRefresh(); }} className="p-2 bg-green-100 text-green-600 rounded-full"><CheckCircle/></button>
              <button onClick={async () => { await supabase.from('leave_requests').update({status: 'مرفوض'}).eq('id', req.id); onRefresh(); }} className="p-2 bg-red-100 text-red-600 rounded-full"><XCircle/></button>
            </div>
          </div>
        ))}
        {requests.length === 0 && <p className="text-center text-gray-400 py-10">لا توجد طلبات معلقة</p>}
      </div>
    </div>
  );
}

function EveningScheduleTab() {
  const handleExcelSchedule = async (data: any[]) => {
    const formatted = data.map(row => ({
      date: formatDateForDB(row.date || row['التاريخ']),
      specs: (row.specs || row['التخصصات'])?.split(',') || [],
      doctors: (row.doctors || row['الأطباء'])?.split(',') || []
    }));
    const { error } = await supabase.from('evening_schedule').insert(formatted);
    if(error) alert(error.message); else alert("تم رفع الجدول");
  };
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold border-b pb-4">الجدول المسائي</h2>
      <ExcelUploadButton onData={handleExcelSchedule} label="رفع جدول" />
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
      const eid = String(row.employee_id || row['رقم الموظف'] || '');
      // Critical fix: Ensure date is cleaned before any DB operation
      const dbDate = formatDateForDB(row.date || row['التاريخ']);
      
      if (validIds.has(eid) && dbDate) {
        processedData.push({
          employee_id: eid,
          date: dbDate,
          check_in: row.check_in || row['وقت الحضور'] || null,
          check_out: row.check_out || row['وقت الانصراف'] || null,
          check_in_status: row.check_in_status || row['حالة الحضور'] || 'حاضر',
          check_out_status: row.check_out_status || row['حالة الانصراف'] || 'منصرف',
          notes: row.notes || row['ملاحظات'] || ''
        });
      }
    });

    if (processedData.length === 0) return alert("لا توجد بيانات صالحة للرفع");

    // Deduplication check with clean dates
    const uniqueDates = Array.from(new Set(processedData.map(d => d.date)));
    const { data: existing } = await supabase.from('attendance').select('employee_id, date').in('date', uniqueDates);
    const existingKeys = new Set(existing?.map(r => `${r.employee_id}-${r.date}`));
    const finalToInsert = processedData.filter(item => !existingKeys.has(`${item.employee_id}-${item.date}`));

    if (finalToInsert.length > 0) {
      const { error } = await supabase.from('attendance').insert(finalToInsert);
      if (error) alert("خطأ: " + error.message);
      else { alert(`تم رفع ${finalToInsert.length} سجل بنجاح`); onRefresh(); }
    } else {
      alert("السجلات مكررة وموجودة مسبقاً");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">الحضور والانصراف</h2>
        <ExcelUploadButton onData={handleImportAttendance} label="رفع ملف البصمة" />
      </div>
      <ExcelInfo 
        fields={['employee_id', 'date', 'check_in', 'check_out', 'check_in_status']} 
        sampleData={[{employee_id: '1001', date: 'Aug 2, 2025', check_in: '08:30', check_out: '14:30', check_in_status: 'حاضر'}]}
        fileName="attendance_sample"
      />
      <div className="bg-gray-50 p-6 rounded-xl border grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="الموظف" options={[{value: '', label: '-- اختر --'}, ...employees.map(e => ({value: e.employee_id, label: e.name}))]} value={formData.employee_id} onChange={(v:any) => setFormData({...formData, employee_id: v})} />
        <Input label="التاريخ" type="date" value={formData.date} onChange={(v:any) => setFormData({...formData, date: v})} />
        <Input label="حضور" type="time" value={formData.check_in || ''} onChange={(v:any) => setFormData({...formData, check_in: v})} />
        <Input label="انصراف" type="time" value={formData.check_out || ''} onChange={(v:any) => setFormData({...formData, check_out: v})} />
        <button onClick={async () => { await supabase.from('attendance').insert([formData]); onRefresh(); alert('تم الحفظ'); }} className="md:col-span-2 bg-blue-600 text-white py-3 rounded-lg font-bold">حفظ يدوي</button>
      </div>
    </div>
  );
}

function ReportsTab() {
  const [reportData, setReportData] = useState<any[]>([]);
  const fetchReport = async () => {
    const { data } = await supabase.from('attendance').select('*').limit(100).order('date', {ascending: false});
    if(data) setReportData(data);
  };
  const exportExcel = () => {
    const formatted = reportData.map(row => ({
      'رقم الموظف': row.employee_id,
      'التاريخ': formatDateForExcelDisplay(row.date),
      'الحضور': row.check_in,
      'الانصراف': row.check_out,
      'الحالة': row.check_in_status
    }));
    const ws = XLSX.utils.json_to_sheet(formatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "Report.xlsx");
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">التقارير</h2>
        <button onClick={exportExcel} className="bg-emerald-600 text-white px-4 py-2 rounded-lg"><FileSpreadsheet className="w-4 h-4" /></button>
      </div>
      <button onClick={fetchReport} className="bg-blue-600 text-white px-6 py-2 rounded-lg">توليد تقرير</button>
      <div className="overflow-x-auto border rounded-xl">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">الموظف</th>
              <th className="p-3">التاريخ</th>
              <th className="p-3">حضور</th>
              <th className="p-3">انصراف</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((r,i) => (
              <tr key={i} className="border-b">
                <td className="p-3 font-mono">{r.employee_id}</td>
                <td className="p-3">{formatDateForExcelDisplay(r.date)}</td>
                <td className="p-3">{r.check_in}</td>
                <td className="p-3">{r.check_out}</td>
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
    if(!error) { alert('تم الإرسال'); setMsg(''); }
  };
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold border-b pb-4">التنبيهات</h2>
      <Select label="المستلم" options={[{value: '', label: '-- اختر --'}, {value: 'all', label: 'الكل'}, ...employees.map(e => ({value: e.employee_id, label: e.name}))]} value={recipient} onChange={setRecipient} />
      <textarea className="w-full p-3 border rounded-lg min-h-[100px]" placeholder="الرسالة" value={msg} onChange={e => setMsg(e.target.value)} />
      <button onClick={send} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">إرسال التنبيه</button>
    </div>
  );
}

// --- Main Dashboard ---

interface AdminDashboardProps { onBack: () => void; }

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

  if (!isAdminLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-6">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-6 hover:underline"><ArrowRight className="ml-1" /> رجوع</button>
          <h2 className="text-2xl font-bold mb-6 text-center">دخول الإدارة</h2>
          <div className="space-y-4">
            <select className="w-full p-3 border rounded-lg" onChange={(e) => setSelectedCenter(centers.find(c => c.id === e.target.value) || null)}>
              <option value="">-- اختر مركز --</option>
              {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}
            </select>
            <input type="password" className="w-full p-3 border rounded-lg" placeholder="الباسورد" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            <button onClick={() => { if(selectedCenter && adminPassword === selectedCenter.password) { setIsAdminLoggedIn(true); fetchDashboardData(); } else alert('خطأ'); }} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">دخول</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">إدارة: {selectedCenter?.center_name}</h1>
        <button onClick={onBack} className="bg-gray-200 px-6 py-2 rounded-lg font-semibold flex items-center">خروج <ArrowRight className="mr-2"/></button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-2">
          <SidebarBtn active={activeTab === 'settings'} icon={<Settings/>} label="الإعدادات" onClick={() => setActiveTab('settings')} />
          <SidebarBtn active={activeTab === 'doctors'} icon={<Users/>} label="الأطباء" onClick={() => setActiveTab('doctors')} />
          <SidebarBtn active={activeTab === 'leaves'} icon={<FileText/>} label="الإجازات" onClick={() => setActiveTab('leaves')} />
          <SidebarBtn active={activeTab === 'evening'} icon={<Calendar/>} label="الجدول المسائي" onClick={() => setActiveTab('evening')} />
          <SidebarBtn active={activeTab === 'attendance'} icon={<Clock/>} label="الحضور" onClick={() => setActiveTab('attendance')} />
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

const SidebarBtn = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-xl transition-all font-semibold ${active ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>
    <span className="ml-3">{icon}</span>{label}
  </button>
);

export default AdminDashboard;
