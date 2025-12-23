
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, Settings, Users, FileText, Calendar, 
  Clock, BarChart3, Mail, Bell, Plus, Upload, Trash2, CheckCircle, XCircle, Send
} from 'lucide-react';
import { GeneralSettings, Employee, LeaveRequest, AttendanceRecord, InternalMessage } from '../types';
import * as XLSX from 'xlsx';

// Generic UI helpers
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

function NavButton({ active, icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center p-4 rounded-xl transition-all font-semibold ${
        active ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100'
      }`}
    >
      <span className="ml-3">{icon}</span>
      {label}
    </button>
  );
}

// Sub-components
function GeneralSettingsTab({ center }: { center: GeneralSettings }) {
  const [settings, setSettings] = useState(center);
  const handleSave = async () => {
    const { error } = await supabase.from('general_settings').update(settings).eq('id', center.id);
    if (error) alert('خطأ في الحفظ');
    else alert('تم الحفظ بنجاح');
  };
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold border-b pb-2">الإعدادات العامة للمركز</h2>
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
    else {
      setShowForm(false);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">إعدادات الأطباء والعاملين</h2>
        <div className="flex gap-2">
           <button onClick={() => setShowForm(!showForm)} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold">
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
          <div className="md:col-span-3">
             <button onClick={handleAdd} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">تأكيد الإضافة</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
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
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${emp.status === 'نشط' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {emp.status}
                  </span>
                </td>
                <td className="p-3">
                  <button onClick={async () => {
                    if(confirm('هل أنت متأكد؟')) {
                      await supabase.from('employees').delete().eq('id', emp.id);
                      onRefresh();
                    }
                  }} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeavesTab({ requests, onRefresh }: { requests: LeaveRequest[], onRefresh: () => void }) {
  const handleStatus = async (id: string, status: 'مقبول' | 'مرفوض') => {
    const { error } = await supabase.from('leave_requests').update({ status }).eq('id', id);
    if (error) alert('خطأ');
    else onRefresh();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">طلبات الإجازات والعوارض</h2>
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
              <p className="text-sm text-gray-600 mt-1">القائم بالعمل: {req.backup_person}</p>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <span className={`text-xs px-2 py-1 rounded font-bold ${
                req.status === 'مقبول' ? 'text-green-600 bg-green-50' : 
                req.status === 'مرفوض' ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50'
              }`}>
                {req.status}
              </span>
              {req.status === 'معلق' && (
                <div className="flex gap-2">
                  <button onClick={() => handleStatus(req.id, 'مقبول')} className="p-2 bg-green-50 text-green-600 rounded-full hover:bg-green-100">
                    <CheckCircle className="w-6 h-6" />
                  </button>
                  <button onClick={() => handleStatus(req.id, 'مرفوض')} className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100">
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
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
  const [uploading, setUploading] = useState(false);

  const handleManualAdd = async () => {
    if(!formData.employee_id) return alert('اختر الموظف');
    const { error } = await supabase.from('attendance').insert([formData]);
    if (error) alert('خطأ: ' + error.message);
    else {
      alert('تم التسجيل');
      onRefresh();
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Expected columns: employee_id, date, check_in, check_out, check_in_status, check_out_status
        const formattedData = data.map((row: any) => ({
          employee_id: String(row.employee_id || row['رقم الموظف'] || ''),
          date: row.date || row['التاريخ'] || new Date().toISOString().split('T')[0],
          check_in: row.check_in || row['وقت الحضور'],
          check_out: row.check_out || row['وقت الانصراف'],
          check_in_status: row.check_in_status || row['حالة الحضور'] || 'حاضر',
          check_out_status: row.check_out_status || row['حالة الانصراف'] || 'منصرف'
        })).filter(item => item.employee_id);

        if (formattedData.length === 0) throw new Error("الملف فارغ أو غير متوافق");

        const { error } = await supabase.from('attendance').insert(formattedData);
        if (error) throw error;

        alert(`تم رفع ${formattedData.length} سجل بنجاح`);
        onRefresh();
      } catch (err: any) {
        alert("خطأ في معالجة الملف: " + err.message);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">إدارة الحضور والانصراف</h2>
        <label className="flex items-center bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 cursor-pointer font-semibold transition-all shadow-sm">
          {uploading ? 'جاري الرفع...' : <><Upload className="w-4 h-4 ml-2" /> رفع إكسيل حضور</>}
          <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleExcelUpload} disabled={uploading} />
        </label>
      </div>

      <div className="bg-gray-50 p-6 rounded-xl border">
        <h3 className="font-bold mb-4 text-gray-700">إضافة سجل يدوي</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-600">الموظف</label>
            <select 
              className="w-full p-3 border rounded-lg bg-white"
              onChange={e => setFormData({...formData, employee_id: e.target.value})}
            >
              <option value="">-- اختر موظف --</option>
              {employees.map(emp => <option key={emp.id} value={emp.employee_id}>{emp.name} ({emp.employee_id})</option>)}
            </select>
          </div>
          <Input label="التاريخ" type="date" value={formData.date || ''} onChange={(v:any) => setFormData({...formData, date: v})} />
          <Input label="وقت الحضور" type="time" value={formData.check_in || ''} onChange={(v:any) => setFormData({...formData, check_in: v})} />
          <Select label="حالة الحضور" options={['حاضر', 'متأخر', 'غائب']} value={formData.check_in_status || ''} onChange={(v:any) => setFormData({...formData, check_in_status: v})} />
          <Input label="وقت الانصراف" type="time" value={formData.check_out || ''} onChange={(v:any) => setFormData({...formData, check_out: v})} />
          <Select label="حالة الانصراف" options={['منصرف', 'خروج مبكر', 'مستمر']} value={formData.check_out_status || ''} onChange={(v:any) => setFormData({...formData, check_out_status: v})} />
          <div className="md:col-span-2">
            <button onClick={handleManualAdd} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-md flex items-center justify-center">
              <Plus className="w-5 h-5 ml-2" /> حفظ السجل اليدوي
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertsTab({ employees, sender }: { employees: Employee[], sender: string }) {
  const [recipient, setRecipient] = useState('');
  const [msg, setMsg] = useState('');
  const [history, setHistory] = useState<InternalMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data } = await supabase.from('messages').select('*').eq('from_user', sender).order('created_at', { ascending: false });
    if (data) setHistory(data);
  };

  const sendMsg = async () => {
    if(!recipient || !msg) return alert('أكمل البيانات');
    setLoading(true);
    const { error } = await supabase.from('messages').insert([{
      from_user: sender,
      to_user: recipient,
      content: msg
    }]);
    if(error) alert('خطأ');
    else {
      alert('تم إرسال التنبيه بنجاح');
      setMsg('');
      fetchHistory();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold border-b pb-4">الرسائل والتنبيهات الصادرة</h2>
      
      <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 shadow-sm">
        <h3 className="font-bold mb-4 text-blue-800 flex items-center">
          <Send className="w-4 h-4 ml-2" /> إرسال تنبيه جديد
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1 text-blue-700">المستلم</label>
            <select className="w-full p-3 border rounded-lg bg-white focus:ring-2 focus:ring-blue-400 outline-none" value={recipient} onChange={e => setRecipient(e.target.value)}>
              <option value="">-- اختر المستلم --</option>
              <option value="all" className="font-bold">إرسال للجميع (كل العاملين)</option>
              {employees.map(e => <option key={e.id} value={e.employee_id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-blue-700">نص الرسالة</label>
            <textarea 
              className="w-full p-3 border rounded-lg min-h-[120px] focus:ring-2 focus:ring-blue-400 outline-none"
              placeholder="اكتب التنبيه أو التعليمات هنا..."
              value={msg}
              onChange={e => setMsg(e.target.value)}
            />
          </div>
          <button 
            onClick={sendMsg} 
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition-colors shadow-lg flex items-center justify-center"
          >
            {loading ? 'جاري الإرسال...' : <><Bell className="w-5 h-5 ml-2" /> بث التنبيه</>}
          </button>
        </div>
      </div>

      <div className="mt-10">
        <h3 className="font-bold mb-4 text-gray-700 flex items-center">
          <Mail className="w-5 h-5 ml-2" /> سجل الرسائل المرسلة مؤخراً
        </h3>
        <div className="space-y-3">
          {history.length === 0 && <p className="text-gray-400 text-center py-10 bg-gray-50 rounded-xl">لا يوجد رسائل مرسلة حتى الآن.</p>}
          {history.map(item => (
            <div key={item.id} className="p-4 bg-white border rounded-xl shadow-sm hover:border-blue-300 transition-all">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  إلى: {item.to_user === 'all' ? 'الكل' : item.to_user}
                </span>
                <span className="text-[10px] text-gray-400">{new Date(item.created_at).toLocaleString('ar-EG')}</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{item.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Define the interface for AdminDashboard props
interface AdminDashboardProps {
  onBack: () => void;
}

// Main component
const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [centers, setCenters] = useState<GeneralSettings[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<GeneralSettings | null>(null);
  const [activeTab, setActiveTab] = useState('settings');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCenters();
  }, []);

  const fetchCenters = async () => {
    const { data } = await supabase.from('general_settings').select('*');
    if (data) setCenters(data);
  };

  const handleAdminLogin = async () => {
    if (!selectedCenter) {
      alert('الرجاء اختيار المركز أولاً');
      return;
    }
    if (adminPassword === selectedCenter.password) {
      setIsAdminLoggedIn(true);
      fetchDashboardData();
    } else {
      alert('كلمة المرور غير صحيحة');
    }
  };

  const fetchDashboardData = async () => {
    if (!selectedCenter) return;
    setLoading(true);
    
    const [empRes, leaveRes] = await Promise.all([
      supabase.from('employees').select('*').eq('center_id', selectedCenter.id),
      supabase.from('leave_requests').select(`*, employees(name)`).order('created_at', { ascending: false })
    ]);

    if (empRes.data) setEmployees(empRes.data);
    if (leaveRes.data) {
        const formatted = (leaveRes.data as any[]).map(l => ({
            ...l,
            employee_name: l.employees?.name || 'غير معروف'
        }));
        setLeaveRequests(formatted);
    }
    setLoading(false);
  };

  if (!isAdminLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-6">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-6 hover:underline">
            <ArrowRight className="w-4 h-4 ml-1" /> العودة للرئيسية
          </button>
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">تسجيل دخول الإدارة</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">اختر المركز</label>
              <select 
                className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500"
                onChange={(e) => setSelectedCenter(centers.find(c => c.id === e.target.value) || null)}
              >
                <option value="">-- اختر مركز --</option>
                {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold mb-1">كلمة مرور المركز</label>
              <input 
                type="password"
                className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500"
                placeholder="أدخل الباسورد"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
              />
            </div>

            <button 
              onClick={handleAdminLogin}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors"
            >
              دخول
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">لوحة تحكم: {selectedCenter?.center_name}</h1>
          <p className="text-gray-500">مرحباً بك في نظام الإدارة الرئيسي</p>
        </div>
        <button 
          onClick={onBack}
          className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-all flex items-center"
        >
          <ArrowRight className="w-5 h-5 ml-2" /> خروج
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-2">
          <NavButton active={activeTab === 'settings'} icon={<Settings />} label="الإعدادات العامة" onClick={() => setActiveTab('settings')} />
          <NavButton active={activeTab === 'doctors'} icon={<Users />} label="إعدادات الأطباء" onClick={() => setActiveTab('doctors')} />
          <NavButton active={activeTab === 'leaves'} icon={<FileText />} label="الطلبات والإجازات" onClick={() => setActiveTab('leaves')} />
          <NavButton active={activeTab === 'attendance'} icon={<Clock />} label="بيانات الحضور" onClick={() => setActiveTab('attendance')} />
          <NavButton active={activeTab === 'alerts'} icon={<Bell />} label="الرسائل والتنبيهات" onClick={() => setActiveTab('alerts')} />
        </div>

        <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border min-h-[600px]">
          {activeTab === 'settings' && selectedCenter && <GeneralSettingsTab center={selectedCenter} />}
          {activeTab === 'doctors' && <DoctorsTab employees={employees} onRefresh={fetchDashboardData} centerId={selectedCenter!.id} />}
          {activeTab === 'leaves' && <LeavesTab requests={leaveRequests} onRefresh={fetchDashboardData} />}
          {activeTab === 'attendance' && <AttendanceTab employees={employees} onRefresh={fetchDashboardData} />}
          {activeTab === 'alerts' && <AlertsTab employees={employees} sender="admin" />}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
