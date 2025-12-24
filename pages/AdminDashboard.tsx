
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, Settings, Users, FileText, Calendar, 
  Clock, BarChart3, Mail, Bell, Plus, Upload, Trash2, CheckCircle, XCircle, FileSpreadsheet, Info, Download, X, Send, LogOut, ShieldCheck
} from 'lucide-react';
import { GeneralSettings, Employee, LeaveRequest, AttendanceRecord, InternalMessage } from '../types';
import * as XLSX from 'xlsx';

// --- محرك معالجة التواريخ الذكي ---

const MONTH_MAP: { [key: string]: string } = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
};

const formatDateForDB = (val: any): string | null => {
  if (val === undefined || val === null || val === '') return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val.toISOString().split('T')[0];

  const num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 60000) { 
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }

  const str = String(val).trim();
  const matchFancy = str.match(/^([a-zA-Z]{3,9})\s+(\d{1,2}),\s+(\d{4})$/);
  if (matchFancy) {
    const monthNum = MONTH_MAP[matchFancy[1].toLowerCase().substring(0, 3)];
    if (monthNum) return `${matchFancy[3]}-${monthNum}-${matchFancy[2].padStart(2, '0')}`;
  }

  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;

  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch(e) {}
  return null; 
};

const formatDateForExcelDisplay = (dateStr: string | null | undefined) => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) { return dateStr; }
};

// --- المكونات العامة ---

function Input({ label, type = 'text', value, onChange, placeholder }: any) {
  return (
    <div className="text-right">
      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder={placeholder} />
    </div>
  );
}

function Select({ label, options, value, onChange }: any) {
  return (
    <div className="text-right">
      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
        {options.map((opt: any) => typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  );
}

function ExcelInfo({ fields, sampleData, fileName }: { fields: string[], sampleData?: any[], fileName?: string }) {
  const downloadSample = () => {
    if (!sampleData) return;
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${fileName || 'sample'}.xlsx`);
  };
  return (
    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl mb-6 text-right">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-900 font-bold mb-2">الأعمدة المطلوبة في الإكسيل (تطابق قاعدة البيانات):</p>
          <div className="flex flex-wrap gap-2">
            {fields.map(f => <code key={f} className="bg-white px-2 py-1 rounded border border-blue-300 text-[11px] font-mono font-bold text-blue-700">{f}</code>)}
          </div>
        </div>
      </div>
      {sampleData && <button onClick={downloadSample} className="mt-3 flex items-center text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-all"><Download className="w-4 h-4 ml-2" /> تحميل النموذج الجاهز</button>}
    </div>
  );
}

function ExcelUploadButton({ onData, label = "رفع إكسيل", icon = <Upload className="w-4 h-4 ml-2" /> }: any) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        onData(XLSX.utils.sheet_to_json(ws));
      } catch (err) { alert("خطأ في الملف"); }
      finally { e.target.value = ''; }
    };
    reader.readAsBinaryString(file);
  };
  return (
    <label className="flex items-center bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 cursor-pointer font-semibold shadow-md transition-all">
      {icon} {label}
      <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFile} />
    </label>
  );
}

// --- أقسام لوحة التحكم ---

function GeneralSettingsTab({ center }: { center: GeneralSettings }) {
  const [settings, setSettings] = useState<GeneralSettings>({ ...center, holidays: center.holidays || [] });
  const handleSave = async () => {
    const { error } = await supabase.from('general_settings').update(settings).eq('id', center.id);
    if (error) alert('فشل الحفظ'); else alert('تم الحفظ بنجاح');
  };
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold border-b pb-4 text-gray-800 flex items-center gap-2"><Settings className="w-6 h-6 text-blue-600" /> إعدادات المركز</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="center_name" value={settings.center_name} onChange={(v:any)=>setSettings({...settings, center_name: v})} />
        <Input label="admin_name" value={settings.admin_name} onChange={(v:any)=>setSettings({...settings, admin_name: v})} />
        <Input label="password" type="password" value={settings.password} onChange={(v:any)=>setSettings({...settings, password: v})} />
        <Input label="phone" value={settings.phone} onChange={(v:any)=>setSettings({...settings, phone: v})} />
      </div>
      <button onClick={handleSave} className="bg-emerald-600 text-white px-8 py-3 rounded-lg font-bold shadow-md">حفظ الإعدادات</button>
    </div>
  );
}

function DoctorsTab({ employees, onRefresh, centerId }: { employees: Employee[], onRefresh: () => void, centerId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Employee>>({ gender: 'ذكر', status: 'نشط', center_id: centerId });

  const handleImport = async (data: any[]) => {
    const formatted = data.map(row => ({
      employee_id: String(row.employee_id || ''),
      name: String(row.name || ''),
      national_id: String(row.national_id || ''),
      specialty: String(row.specialty || ''),
      phone: String(row.phone || ''),
      email: String(row.email || ''),
      gender: row.gender || 'ذكر',
      grade: String(row.grade || ''),
      join_date: formatDateForDB(row.join_date),
      leave_annual_balance: Number(row.leave_annual_balance || 21),
      leave_casual_balance: Number(row.leave_casual_balance || 7),
      remaining_annual: Number(row.leave_annual_balance || 21),
      remaining_casual: Number(row.leave_casual_balance || 7),
      status: String(row.status || 'نشط'),
      center_id: centerId
    })).filter(r => r.employee_id && r.name);

    const { error } = await supabase.from('employees').upsert(formatted, { onConflict: 'employee_id' });
    if (error) alert("خطأ: " + error.message); else { alert("تم الاستيراد بنجاح"); onRefresh(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">الموظفون والأطباء</h2>
        <div className="flex gap-2">
           <ExcelUploadButton onData={handleImport} label="استيراد موظفين" />
           <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-md">
             {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {showForm ? 'إلغاء' : 'إضافة'}
           </button>
        </div>
      </div>
      <ExcelInfo 
        fields={['employee_id', 'name', 'national_id', 'specialty', 'phone', 'join_date', 'leave_annual_balance', 'leave_casual_balance']} 
        sampleData={[{employee_id: '1001', name: 'أحمد محمود', national_id: '29000000', specialty: 'باطنة', phone: '01000', join_date: 'Aug 2, 2025', leave_annual_balance: 21, leave_casual_balance: 7}]}
        fileName="employees_db_match"
      />
      {showForm && (
        <div className="bg-gray-50 p-6 rounded-xl border grid grid-cols-1 md:grid-cols-2 gap-4">
           <Input label="employee_id" value={formData.employee_id} onChange={(v:any)=>setFormData({...formData, employee_id: v})} />
           <Input label="name" value={formData.name} onChange={(v:any)=>setFormData({...formData, name: v})} />
           <Input label="national_id" value={formData.national_id} onChange={(v:any)=>setFormData({...formData, national_id: v})} />
           <button onClick={async () => { await supabase.from('employees').insert([formData]); onRefresh(); setShowForm(false); }} className="md:col-span-2 bg-emerald-600 text-white py-3 rounded-lg font-bold">تأكيد الإضافة</button>
        </div>
      )}
      <div className="overflow-x-auto border rounded-xl">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100">
            <tr><th className="p-3">الكود</th><th className="p-3">الاسم</th><th className="p-3">التخصص</th><th className="p-3">تاريخ التعيين</th><th className="p-3 text-center">حذف</th></tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono font-bold text-blue-600">{emp.employee_id}</td>
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
    date: new Date().toISOString().split('T')[0], check_in_status: 'حاضر', check_out_status: 'منصرف'
  });

  const handleImportAttendance = async (data: any[]) => {
    try {
      const validIds = new Set(employees.map(e => e.employee_id));
      const processed = data.map(row => {
        const eid = String(row.employee_id || '');
        const dbDate = formatDateForDB(row.date);
        if (validIds.has(eid) && dbDate) {
          return {
            employee_id: eid,
            date: dbDate,
            check_in: row.check_in || null,
            check_in_status: row.check_in_status || 'حاضر',
            check_out: row.check_out || null,
            check_out_status: row.check_out_status || 'منصرف',
            notes: row.notes || ''
          };
        }
        return null;
      }).filter(Boolean);

      if (processed.length === 0) return alert("لا توجد بيانات صالحة");

      // حل مشكلة ON CONFLICT: فحص السجلات الموجودة مسبقاً يدوياً
      const uniqueDates = Array.from(new Set(processed.map((p: any) => p.date)));
      const { data: existing } = await supabase.from('attendance').select('employee_id, date').in('date', uniqueDates);
      const existingKeys = new Set(existing?.map(r => `${r.employee_id}-${r.date}`));

      // تصفية البيانات لإدخال الجديد فقط
      const toInsert = processed.filter((p: any) => !existingKeys.has(`${p.employee_id}-${p.date}`));

      if (toInsert.length > 0) {
        const { error } = await supabase.from('attendance').insert(toInsert);
        if (error) throw error;
        alert(`تم رفع ${toInsert.length} سجل بنجاح.`);
      } else {
        alert("جميع السجلات مكررة بالفعل.");
      }
      onRefresh();
    } catch (err: any) { alert("خطأ: " + err.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">الحضور والانصراف</h2>
        <ExcelUploadButton onData={handleImportAttendance} label="رفع سجل البصمة" />
      </div>
      <ExcelInfo 
        fields={['employee_id', 'date', 'check_in', 'check_out', 'check_in_status', 'check_out_status', 'notes']} 
        sampleData={[{employee_id: '1001', date: 'Aug 2, 2025', check_in: '08:00', check_out: '14:00', check_in_status: 'حاضر', check_out_status: 'منصرف', notes: ''}]}
        fileName="attendance_db_match"
      />
      <div className="bg-gray-50 p-6 rounded-xl border grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="employee_id" options={[{value: '', label: '-- اختر --'}, ...employees.map(e => ({value: e.employee_id, label: e.name}))]} value={formData.employee_id} onChange={(v:any)=>setFormData({...formData, employee_id: v})} />
        <Input label="date" type="date" value={formData.date} onChange={(v:any)=>setFormData({...formData, date: v})} />
        <Input label="check_in" type="time" value={formData.check_in || ''} onChange={(v:any)=>setFormData({...formData, check_in: v})} />
        <Input label="check_out" type="time" value={formData.check_out || ''} onChange={(v:any)=>setFormData({...formData, check_out: v})} />
        <button onClick={async () => { if(!formData.employee_id) return alert('اختر الموظف'); await supabase.from('attendance').insert([formData]); onRefresh(); alert('تم الحفظ'); }} className="md:col-span-2 bg-blue-600 text-white py-3 rounded-lg font-bold shadow-md">إضافة سجل يدوي</button>
      </div>
    </div>
  );
}

function LeavesTab({ requests, onRefresh }: { requests: LeaveRequest[], onRefresh: () => void }) {
  const handleImport = async (data: any[]) => {
    const formatted = data.map(row => ({
      employee_id: String(row.employee_id || ''),
      type: String(row.type || 'اعتيادي'),
      start_date: formatDateForDB(row.start_date),
      end_date: formatDateForDB(row.end_date),
      backup_person: String(row.backup_person || ''),
      status: String(row.status || 'مقبول'),
      notes: String(row.notes || '')
    })).filter(r => r.employee_id && r.start_date);
    const { error } = await supabase.from('leave_requests').insert(formatted);
    if (error) alert(error.message); else { alert("تم الاستيراد بنجاح"); onRefresh(); }
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">إدارة الإجازات</h2>
        <ExcelUploadButton onData={handleImport} label="استيراد إجازات" />
      </div>
      <ExcelInfo 
        fields={['employee_id', 'type', 'start_date', 'end_date', 'backup_person', 'status', 'notes']} 
        sampleData={[{employee_id: '1001', type: 'اعتيادي', start_date: 'Aug 2, 2025', end_date: 'Aug 5, 2025', backup_person: 'د. سارة', status: 'مقبول', notes: ''}]}
        fileName="leaves_db_match"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {requests.map(req => (
          <div key={req.id} className="p-4 border bg-white rounded-xl shadow-sm flex justify-between items-center border-r-4 border-r-blue-500">
            <div><p className="font-bold">{req.employee_name} ({req.employee_id})</p><p className="text-sm text-blue-600 font-bold">{req.type}</p><p className="text-xs text-gray-400">{formatDateForExcelDisplay(req.start_date)} - {formatDateForExcelDisplay(req.end_date)}</p></div>
            <div className="flex gap-2">
              <button onClick={async () => { await supabase.from('leave_requests').update({status: 'مقبول'}).eq('id', req.id); onRefresh(); }} className="p-2 bg-green-50 text-green-600 rounded-lg"><CheckCircle/></button>
              <button onClick={async () => { await supabase.from('leave_requests').update({status: 'مرفوض'}).eq('id', req.id); onRefresh(); }} className="p-2 bg-red-50 text-red-600 rounded-lg"><XCircle/></button>
            </div>
          </div>
        ))}
        {requests.length === 0 && <div className="md:col-span-2 text-center py-10 text-gray-400 font-bold border-2 border-dashed rounded-xl">لا توجد طلبات معلقة</div>}
      </div>
    </div>
  );
}

function EveningScheduleTab() {
  const handleImportSchedule = async (data: any[]) => {
    const formatted = data.map(row => ({
      date: formatDateForDB(row.date),
      specs: String(row.specs || '').split(',').map(s => s.trim()),
      doctors: String(row.doctors || '').split(',').map(d => d.trim())
    })).filter(r => r.date);
    const { error } = await supabase.from('evening_schedule').insert(formatted);
    if(error) alert(error.message); else alert("تم رفع الجدول");
  };
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold border-b pb-4">الجدول المسائي</h2>
      <ExcelUploadButton onData={handleImportSchedule} label="رفع الجدول" />
      <ExcelInfo fields={['date', 'specs', 'doctors']} sampleData={[{date: 'Aug 2, 2025', specs: 'باطنة,أطفال', doctors: 'د.أحمد,د.سارة'}]} fileName="evening_db_match" />
    </div>
  );
}

function ReportsTab() {
  const [reportData, setReportData] = useState<any[]>([]);
  const fetchReport = async () => {
    const { data } = await supabase.from('attendance').select('*').order('date', {ascending: false}).limit(100);
    if(data) setReportData(data);
  };
  const exportExcel = () => {
    const formatted = reportData.map(r => ({
      employee_id: r.employee_id,
      date: r.date,
      check_in: r.check_in,
      check_out: r.check_out,
      check_in_status: r.check_in_status,
      check_out_status: r.check_out_status,
      notes: r.notes
    }));
    const ws = XLSX.utils.json_to_sheet(formatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "AttendanceReport.xlsx");
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">التقارير</h2>
        <button onClick={exportExcel} disabled={reportData.length === 0} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center shadow-md disabled:bg-gray-400"><FileSpreadsheet className="w-4 h-4 ml-2" /> تصدير إكسيل</button>
      </div>
      <button onClick={fetchReport} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-md">توليد التقرير</button>
      <div className="overflow-x-auto border rounded-xl shadow-sm">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100">
            <tr><th className="p-3">الموظف</th><th className="p-3">التاريخ</th><th className="p-3">الحضور</th><th className="p-3">الانصراف</th><th className="p-3">الحالة</th></tr>
          </thead>
          <tbody>
            {reportData.map((r,i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono font-bold text-blue-600">{r.employee_id}</td>
                <td className="p-3 font-bold">{formatDateForExcelDisplay(r.date)}</td>
                <td className="p-3 text-emerald-600">{r.check_in || '--'}</td>
                <td className="p-3 text-red-500">{r.check_out || '--'}</td>
                <td className="p-3"><span className="text-xs bg-gray-100 px-2 py-1 rounded font-bold">{r.check_in_status}</span></td>
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
      <h2 className="text-2xl font-bold border-b pb-4">الرسائل</h2>
      <Select label="to_user" options={[{value: '', label: '-- اختر --'}, {value: 'all', label: 'للجميع'}, ...employees.map(e => ({value: e.employee_id, label: e.name}))]} value={recipient} onChange={setRecipient} />
      <textarea className="w-full p-4 border rounded-xl min-h-[120px] outline-none focus:ring-2 focus:ring-blue-500" placeholder="content" value={msg} onChange={e => setMsg(e.target.value)} />
      <button onClick={send} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-md">إرسال الآن</button>
    </div>
  );
}

// --- المكون الرئيسي ---

interface AdminDashboardProps { onBack: () => void; }

const SidebarBtn = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-2xl transition-all font-bold ${active ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-blue-50 border'}`}>
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
      supabase.from('employees').select('*').eq('center_id', selectedCenter.id).order('name'),
      supabase.from('leave_requests').select(`*, employees(name)`).eq('status', 'معلق').order('created_at', { ascending: false })
    ]);
    if (empRes.data) setEmployees(empRes.data);
    if (leaveRes.data) setLeaveRequests((leaveRes.data as any[]).map(l => ({...l, employee_name: l.employees?.name})));
  };

  if (!isAdminLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-[85vh] p-6 text-right">
        <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md border">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-8 hover:underline font-bold"><ArrowRight className="ml-2" /> العودة</button>
          <div className="text-center mb-8"><ShieldCheck className="w-12 h-12 text-blue-600 mx-auto mb-2" /><h2 className="text-3xl font-bold">بوابة الإدارة</h2></div>
          <div className="space-y-6">
            <select className="w-full p-4 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" onChange={(e) => setSelectedCenter(centers.find(c => c.id === e.target.value) || null)}>
              <option value="">-- اختر المركز --</option>
              {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}
            </select>
            <input type="password" className="w-full p-4 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" placeholder="كلمة المرور" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            <button onClick={() => { if(selectedCenter && adminPassword === selectedCenter.password) { setIsAdminLoggedIn(true); fetchDashboardData(); } else alert('خطأ'); }} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-md hover:bg-blue-700">دخول</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-10 text-right">
      <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-3xl shadow-sm border">
        <div><h1 className="text-3xl font-black text-gray-800 tracking-tight">إدارة: {selectedCenter?.center_name}</h1></div>
        <button onClick={onBack} className="bg-red-50 text-red-600 px-6 py-2 rounded-xl font-bold flex items-center hover:bg-red-100 transition-all"><LogOut className="ml-2 w-5 h-5"/> خروج</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-3">
          <SidebarBtn active={activeTab === 'settings'} icon={<Settings className="w-5 h-5"/>} label="الإعدادات" onClick={() => setActiveTab('settings')} />
          <SidebarBtn active={activeTab === 'doctors'} icon={<Users className="w-5 h-5"/>} label="الموظفون" onClick={() => setActiveTab('doctors')} />
          <SidebarBtn active={activeTab === 'leaves'} icon={<FileText className="w-5 h-5"/>} label="الإجازات" onClick={() => setActiveTab('leaves')} />
          <SidebarBtn active={activeTab === 'evening'} icon={<Calendar className="w-5 h-5"/>} label="الجدول" onClick={() => setActiveTab('evening')} />
          <SidebarBtn active={activeTab === 'attendance'} icon={<Clock className="w-5 h-5"/>} label="الحضور" onClick={() => setActiveTab('attendance')} />
          <SidebarBtn active={activeTab === 'reports'} icon={<BarChart3 className="w-5 h-5"/>} label="التقارير" onClick={() => setActiveTab('reports')} />
          <SidebarBtn active={activeTab === 'alerts'} icon={<Bell className="w-5 h-5"/>} label="الرسائل" onClick={() => setActiveTab('alerts')} />
        </div>
        <div className="lg:col-span-3 bg-white p-8 rounded-3xl shadow-sm border min-h-[600px]">
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
