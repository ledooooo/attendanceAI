
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, Settings, Users, FileText, Calendar, 
  Clock, BarChart3, Mail, Bell, Plus, Upload, Trash2, CheckCircle, XCircle, Send, FileSpreadsheet
} from 'lucide-react';
import { GeneralSettings, Employee, LeaveRequest, AttendanceRecord, InternalMessage } from '../types';
import * as XLSX from 'xlsx';

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
        {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
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
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        onData(data);
      } catch (err) {
        alert("خطأ في قراءة ملف الإكسيل");
      } finally {
        setLoading(false);
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

// --- Sub-Components for Tabs ---

function GeneralSettingsTab({ center }: { center: GeneralSettings }) {
  const [settings, setSettings] = useState(center);
  const handleSave = async () => {
    const { error } = await supabase.from('general_settings').update(settings).eq('id', center.id);
    if (error) alert('خطأ في الحفظ');
    else alert('تم الحفظ بنجاح');
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">الإعدادات العامة للمركز</h2>
        <ExcelUploadButton label="تحديث من إكسيل" onData={(data: any) => setSettings({...settings, ...data[0]})} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="اسم المركز" value={settings.center_name} onChange={(v:any) => setSettings({...settings, center_name: v})} />
        <Input label="اسم الإدارة" value={settings.admin_name} onChange={(v:any) => setSettings({...settings, admin_name: v})} />
        <Input label="تليفون المركز" value={settings.phone} onChange={(v:any) => setSettings({...settings, phone: v})} />
        <Input label="عنوان المركز" value={settings.address} onChange={(v:any) => setSettings({...settings, address: v})} />
        <Input label="رابط اللوكيشن" value={settings.location_url} onChange={(v:any) => setSettings({...settings, location_url: v})} />
        <Input label="باسورد المركز" type="password" value={settings.password} onChange={(v:any) => setSettings({...settings, password: v})} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-t pt-4">
        <Input label="حضور الصباحي" type="time" value={settings.shift_morning_in} onChange={(v:any) => setSettings({...settings, shift_morning_in: v})} />
        <Input label="انصراف الصباحي" type="time" value={settings.shift_morning_out} onChange={(v:any) => setSettings({...settings, shift_morning_out: v})} />
        <Input label="حضور المسائي" type="time" value={settings.shift_evening_in} onChange={(v:any) => setSettings({...settings, shift_evening_in: v})} />
        <Input label="انصراف المسائي" type="time" value={settings.shift_evening_out} onChange={(v:any) => setSettings({...settings, shift_evening_out: v})} />
        <Input label="حضور السهر" type="time" value={settings.shift_night_in} onChange={(v:any) => setSettings({...settings, shift_night_in: v})} />
        <Input label="انصراف السهر" type="time" value={settings.shift_night_out} onChange={(v:any) => setSettings({...settings, shift_night_out: v})} />
      </div>
      <button onClick={handleSave} className="bg-emerald-600 text-white px-8 py-3 rounded-lg hover:bg-emerald-700 font-bold">حفظ التغييرات</button>
    </div>
  );
}

function DoctorsTab({ employees, onRefresh, centerId }: { employees: Employee[], onRefresh: () => void, centerId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Employee>>({ gender: 'ذكر', status: 'نشط', center_id: centerId });

  const handleAdd = async () => {
    const { error } = await supabase.from('employees').insert([formData]);
    if (error) alert('خطأ في الإضافة: ' + error.message);
    else { setShowForm(false); onRefresh(); }
  };

  const handleExcelImport = async (data: any[]) => {
    const formatted = data.map(row => ({
      employee_id: String(row.employee_id || row['رقم الموظف']),
      name: row.name || row['الاسم'],
      national_id: String(row.national_id || row['الرقم القومي']),
      specialty: row.specialty || row['التخصص'],
      phone: String(row.phone || row['الهاتف'] || ''),
      email: row.email || row['الايميل'] || '',
      gender: row.gender || row['النوع'] || 'ذكر',
      grade: row.grade || row['الدرجة'] || '',
      status: 'نشط',
      center_id: centerId,
      leave_annual_balance: row.leave_annual_balance || 21,
      leave_casual_balance: row.leave_casual_balance || 7,
      remaining_annual: row.leave_annual_balance || 21,
      remaining_casual: row.leave_casual_balance || 7
    }));
    const { error } = await supabase.from('employees').insert(formatted);
    if (error) alert("خطأ في الرفع: " + error.message);
    else { alert("تم رفع الموظفين بنجاح"); onRefresh(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">إعدادات الأطباء والعاملين</h2>
        <div className="flex gap-2">
          <ExcelUploadButton onData={handleExcelImport} label="استيراد موظفين" />
          <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center">
            {showForm ? 'إلغاء' : <><Plus className="w-4 h-4 ml-2" /> إضافة يدوي</>}
          </button>
        </div>
      </div>
      {showForm && (
        <div className="bg-gray-50 p-6 rounded-xl border-2 border-dashed grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="رقم الموظف" value={formData.employee_id || ''} onChange={(v:any) => setFormData({...formData, employee_id: v})} />
          <Input label="اسم الموظف" value={formData.name || ''} onChange={(v:any) => setFormData({...formData, name: v})} />
          <Input label="الرقم القومي" value={formData.national_id || ''} onChange={(v:any) => setFormData({...formData, national_id: v})} />
          <Input label="التخصص" value={formData.specialty || ''} onChange={(v:any) => setFormData({...formData, specialty: v})} />
          <Input label="رقم الهاتف" value={formData.phone || ''} onChange={(v:any) => setFormData({...formData, phone: v})} />
          <Input label="البريد الإلكتروني" value={formData.email || ''} onChange={(v:any) => setFormData({...formData, email: v})} />
          <Select label="النوع" options={['ذكر', 'أنثى']} value={formData.gender} onChange={(v:any) => setFormData({...formData, gender: v as any})} />
          <Input label="الدرجة الوظيفية" value={formData.grade || ''} onChange={(v:any) => setFormData({...formData, grade: v})} />
          <Input label="رصيد سنوي" type="number" value={formData.leave_annual_balance || 21} onChange={(v:any) => setFormData({...formData, leave_annual_balance: parseInt(v)})} />
          <div className="md:col-span-3">
             <button onClick={handleAdd} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">تأكيد الإضافة</button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto border rounded-xl">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">رقم</th>
              <th className="p-3">الاسم</th>
              <th className="p-3">التخصص</th>
              <th className="p-3">الحالة</th>
              <th className="p-3">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono">{emp.employee_id}</td>
                <td className="p-3 font-bold">{emp.name}</td>
                <td className="p-3 text-gray-600">{emp.specialty}</td>
                <td className="p-3"><span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">{emp.status}</span></td>
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
  const handleExcelImport = async (data: any[]) => {
    const formatted = data.map(row => ({
      employee_id: String(row.employee_id || row['رقم الموظف']),
      type: row.type || row['نوع الإجازة'],
      start_date: row.start_date || row['من تاريخ'],
      end_date: row.end_date || row['إلى تاريخ'],
      status: row.status || 'مقبول',
      backup_person: row.backup_person || row['القائم بالعمل'] || ''
    }));
    const { error } = await supabase.from('leave_requests').insert(formatted);
    if (error) alert(error.message); else { alert("تم استيراد الطلبات"); onRefresh(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">الطلبات والإجازات</h2>
        <ExcelUploadButton onData={handleExcelImport} label="رفع أرشيف إجازات" />
      </div>
      <div className="space-y-4">
        {requests.length === 0 && <p className="text-center text-gray-400 py-10">لا توجد طلبات معلقة</p>}
        {requests.map(req => (
          <div key={req.id} className="p-4 border rounded-xl flex justify-between items-center hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-bold text-lg">{req.employee_name}</span>
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">{req.type}</span>
              </div>
              <p className="text-sm text-gray-500">الفترة: {req.start_date} إلى {req.end_date}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={async () => { await supabase.from('leave_requests').update({status: 'مقبول'}).eq('id', req.id); onRefresh(); }} className="p-2 bg-green-50 text-green-600 rounded-full hover:bg-green-100"><CheckCircle/></button>
              <button onClick={async () => { await supabase.from('leave_requests').update({status: 'مرفوض'}).eq('id', req.id); onRefresh(); }} className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100"><XCircle/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EveningScheduleTab() {
  const handleExcelSchedule = async (data: any[]) => {
    const formatted = data.map(row => ({
      date: row.date || row['التاريخ'],
      specs: Array.isArray(row.specs) ? row.specs : (row.specs || row['التخصصات'])?.split(',') || [],
      doctors: Array.isArray(row.doctors) ? row.doctors : (row.doctors || row['الأطباء'])?.split(',') || []
    }));
    const { error } = await supabase.from('evening_schedule').insert(formatted);
    if(error) alert(error.message); else alert("تم رفع الجدول بنجاح");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">جدول المسائي</h2>
        <ExcelUploadButton onData={handleExcelSchedule} label="رفع جدول المسائي" />
      </div>
      <div className="border-2 border-dashed p-12 text-center rounded-2xl bg-gray-50">
         <Calendar className="w-12 h-12 mx-auto mb-4 text-blue-500" />
         <h3 className="text-xl font-bold mb-2">إدارة الجدول المسائي</h3>
         <p className="text-sm text-gray-400 mb-6">يمكنك رفع ملف إكسيل يحتوي على التاريخ، قائمة التخصصات، وقائمة الأطباء.</p>
      </div>
    </div>
  );
}

function AttendanceTab({ employees, onRefresh }: { employees: Employee[], onRefresh: () => void }) {
  const [formData, setFormData] = useState<Partial<AttendanceRecord>>({ date: new Date().toISOString().split('T')[0], check_in_status: 'حاضر', check_out_status: 'منصرف' });

  const handleManualAdd = async () => {
    if(!formData.employee_id) return alert('اختر الموظف');
    const { error } = await supabase.from('attendance').insert([formData]);
    if (error) alert(error.message); else { alert('تم التسجيل'); onRefresh(); }
  };

  const handleExcelAttendance = async (data: any[]) => {
    const formatted = data.map(row => ({
      employee_id: String(row.employee_id || row['رقم الموظف']),
      date: row.date || row['التاريخ'],
      check_in: row.check_in || row['وقت الحضور'],
      check_out: row.check_out || row['وقت الانصراف'],
      check_in_status: row.check_in_status || row['حالة الحضور'] || 'حاضر',
      check_out_status: row.check_out_status || row['حالة الانصراف'] || 'منصرف'
    }));
    const { error } = await supabase.from('attendance').insert(formatted);
    if(error) alert(error.message); else { alert("تم رفع سجلات الحضور"); onRefresh(); }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">بيانات الحضور والانصراف</h2>
        <ExcelUploadButton onData={handleExcelAttendance} label="رفع إكسيل بصمة" />
      </div>
      <div className="bg-gray-50 p-6 rounded-xl border grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="الموظف" options={['-- اختر --', ...employees.map(e => e.employee_id)]} value={formData.employee_id} onChange={(v:any) => setFormData({...formData, employee_id: v})} />
        <Input label="التاريخ" type="date" value={formData.date} onChange={(v:any) => setFormData({...formData, date: v})} />
        <Input label="وقت الحضور" type="time" value={formData.check_in || ''} onChange={(v:any) => setFormData({...formData, check_in: v})} />
        <Select label="حالة الحضور" options={['حاضر', 'متأخر', 'غائب']} value={formData.check_in_status} onChange={(v:any) => setFormData({...formData, check_in_status: v})} />
        <div className="md:col-span-2"><button onClick={handleManualAdd} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">حفظ يدوي</button></div>
      </div>
    </div>
  );
}

function ReportsTab({ employees }: { employees: Employee[] }) {
  const [reportData, setReportData] = useState<any[]>([]);
  const fetchReport = async () => {
    const { data } = await supabase.from('attendance').select('*').limit(50);
    if(data) setReportData(data);
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "MedicalCenter_Report.xlsx");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">التقارير والإحصاء</h2>
        <button onClick={exportExcel} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center font-bold">
          <FileSpreadsheet className="w-4 h-4 ml-2" /> تصدير إكسيل
        </button>
      </div>
      <button onClick={fetchReport} className="bg-blue-600 text-white px-6 py-2 rounded-lg">توليد تقرير سريع</button>
      <div className="overflow-x-auto border rounded-xl">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100"><tr><th className="p-2">الموظف</th><th className="p-2">التاريخ</th><th className="p-2">الحضور</th><th className="p-2">الحالة</th></tr></thead>
          <tbody>
            {reportData.map((r,i) => <tr key={i} className="border-b"><td className="p-2">{r.employee_id}</td><td className="p-2">{r.date}</td><td className="p-2">{r.check_in}</td><td className="p-2">{r.check_in_status}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertsTab({ employees, sender }: { employees: Employee[], sender: string }) {
  const [recipient, setRecipient] = useState('');
  const [msg, setMsg] = useState('');
  const [history, setHistory] = useState<InternalMessage[]>([]);

  const fetchHistory = async () => {
    const { data } = await supabase.from('messages').select('*').eq('from_user', sender).order('created_at', { ascending: false });
    if (data) setHistory(data);
  };

  const sendMsg = async () => {
    if(!recipient || !msg) return alert('أكمل البيانات');
    const { error } = await supabase.from('messages').insert([{ from_user: sender, to_user: recipient, content: msg }]);
    if(!error) { alert('تم الإرسال'); setMsg(''); fetchHistory(); }
  };

  useEffect(() => { fetchHistory(); }, []);

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold border-b pb-4">الرسائل والتنبيهات الصادرة</h2>
      <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 space-y-4">
        <select className="w-full p-3 border rounded-lg" value={recipient} onChange={e => setRecipient(e.target.value)}>
          <option value="">-- اختر المستلم --</option>
          <option value="all">الكل</option>
          {employees.map(e => <option key={e.id} value={e.employee_id}>{e.name}</option>)}
        </select>
        <textarea className="w-full p-3 border rounded-lg min-h-[120px]" placeholder="نص التنبيه..." value={msg} onChange={e => setMsg(e.target.value)} />
        <button onClick={sendMsg} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold flex items-center justify-center"><Bell className="ml-2"/> إرسال التنبيه</button>
      </div>
      <div className="space-y-3">
        {history.map(item => (
          <div key={item.id} className="p-4 bg-white border rounded-xl shadow-sm">
            <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>إلى: {item.to_user}</span><span>{new Date(item.created_at).toLocaleString('ar-EG')}</span></div>
            <p className="text-sm text-gray-700">{item.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Main Dashboard Component ---

interface AdminDashboardProps { onBack: () => void; }

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [centers, setCenters] = useState<GeneralSettings[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<GeneralSettings | null>(null);
  const [activeTab, setActiveTab] = useState('settings');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

  useEffect(() => { fetchCenters(); }, []);

  const fetchCenters = async () => {
    const { data } = await supabase.from('general_settings').select('*');
    if (data) setCenters(data);
  };

  const handleAdminLogin = async () => {
    if (!selectedCenter) return alert('اختر المركز');
    if (adminPassword === selectedCenter.password) {
      setIsAdminLoggedIn(true);
      fetchDashboardData();
    } else alert('كلمة مرور خاطئة');
  };

  const fetchDashboardData = async () => {
    if (!selectedCenter) return;
    const [empRes, leaveRes] = await Promise.all([
      supabase.from('employees').select('*').eq('center_id', selectedCenter.id),
      supabase.from('leave_requests').select(`*, employees(name)`).eq('status', 'معلق').order('created_at', { ascending: false })
    ]);
    if (empRes.data) setEmployees(empRes.data);
    if (leaveRes.data) {
        setLeaveRequests((leaveRes.data as any[]).map(l => ({...l, employee_name: l.employees?.name})));
    }
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
            <button onClick={handleAdminLogin} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">دخول</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">لوحة تحكم: {selectedCenter?.center_name}</h1>
        <button onClick={onBack} className="bg-gray-200 px-6 py-2 rounded-lg font-semibold flex items-center"><ArrowRight className="ml-2" /> خروج</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-2">
          <SidebarBtn active={activeTab === 'settings'} icon={<Settings/>} label="الإعدادات العامة" onClick={() => setActiveTab('settings')} />
          <SidebarBtn active={activeTab === 'doctors'} icon={<Users/>} label="إعدادات الأطباء" onClick={() => setActiveTab('doctors')} />
          <SidebarBtn active={activeTab === 'leaves'} icon={<FileText/>} label="الطلبات والإجازات" onClick={() => setActiveTab('leaves')} />
          <SidebarBtn active={activeTab === 'evening'} icon={<Calendar/>} label="جدول المسائي" onClick={() => setActiveTab('evening')} />
          <SidebarBtn active={activeTab === 'attendance'} icon={<Clock/>} label="بيانات الحضور" onClick={() => setActiveTab('attendance')} />
          <SidebarBtn active={activeTab === 'reports'} icon={<BarChart3/>} label="التقارير والإحصاء" onClick={() => setActiveTab('reports')} />
          <SidebarBtn active={activeTab === 'alerts'} icon={<Bell/>} label="الرسائل والتنبيهات" onClick={() => setActiveTab('alerts')} />
        </div>
        <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border min-h-[600px]">
          {activeTab === 'settings' && selectedCenter && <GeneralSettingsTab center={selectedCenter} />}
          {activeTab === 'doctors' && <DoctorsTab employees={employees} onRefresh={fetchDashboardData} centerId={selectedCenter!.id} />}
          {activeTab === 'leaves' && <LeavesTab requests={leaveRequests} onRefresh={fetchDashboardData} />}
          {activeTab === 'evening' && <EveningScheduleTab />}
          {activeTab === 'attendance' && <AttendanceTab employees={employees} onRefresh={fetchDashboardData} />}
          {activeTab === 'reports' && <ReportsTab employees={employees} />}
          {activeTab === 'alerts' && <AlertsTab employees={employees} sender="admin" />}
        </div>
      </div>
    </div>
  );
};

const SidebarBtn = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-xl transition-all font-semibold ${active ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
    <span className="ml-3">{icon}</span>{label}
  </button>
);

export default AdminDashboard;
