
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, Settings, Users, FileText, Calendar, 
  Clock, BarChart3, Mail, Bell, Plus, Upload, Trash2, CheckCircle, XCircle, FileSpreadsheet, Info, Download, X, Send, LogOut, ShieldCheck, Eye, Award, MessageCircle, User, Filter, CheckSquare, Square, MailCheck, Search, List, Edit3, Save, ChevronDown, AlertTriangle, Printer, MapPin, Phone
} from 'lucide-react';
import { GeneralSettings, Employee, LeaveRequest, AttendanceRecord, InternalMessage, Evaluation } from '../types';
import * as XLSX from 'xlsx';

// --- مساعدات ومعالجات البيانات ---

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

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

const calculateHours = (inT: string, outT: string) => {
    if (!inT || !outT) return 0;
    const [h1, m1] = inT.split(':').map(Number);
    const [h2, m2] = outT.split(':').map(Number);
    let diff = (new Date(0,0,0,h2,m2).getTime() - new Date(0,0,0,h1,m1).getTime()) / 3600000;
    if (diff < 0) diff += 24;
    return diff;
};

const getCheckInLabel = (time: string): string => {
  if (!time || time === "--") return '--';
  if (time >= "06:00" && time <= "08:30") return "حضور رسمى";
  if (time >= "08:31" && time <= "09:00") return "تاخير";
  if (time >= "09:01" && time <= "11:00") return "اذن صباحى";
  if (time >= "11:01" && time <= "13:00") return "حضور غير رسمى";
  if (time >= "13:01" && time <= "15:00") return "حضور نوبتجية";
  if (time >= "15:01" && time <= "18:00") return "حضور مسائى";
  if (time >= "18:01" && time <= "23:59") return "حضور سهر";
  if (time >= "00:00" && time <= "05:59") return "حضور مبيت";
  return "حضور";
};

const getCheckOutLabel = (time: string): string => {
  if (!time || time === "--") return '--';
  if (time >= "13:00" && time <= "13:44") return "انصراف مبكر";
  if (time >= "13:45" && time <= "15:00") return "انصراف رسمى";
  if (time >= "15:01" && time <= "18:00") return "انصراف نوبتجية";
  if (time >= "18:01" && time <= "23:59") return "انصراف سهر";
  if (time >= "00:00" && time <= "07:00") return "انصراف مبيت";
  if (time >= "07:01" && time <= "11:00") return "انصراف بدون اذن";
  if (time >= "11:01" && time <= "12:59") return "اذن مسائى";
  return "انصراف";
};

// --- المكونات العامة ---

function Input({ label, type = 'text', value, onChange, placeholder, required = false }: any) {
  return (
    <div className="text-right">
      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input 
        type={type} 
        value={value || ''} 
        onChange={e => onChange(e.target.value)} 
        className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
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
        value={value || ''} 
        onChange={e => onChange(e.target.value)} 
        className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
      >
        <option value="">-- اختر --</option>
        {options.map((opt: any) => typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  );
}

function ExcelUploadButton({ onData, label = "رفع إكسيل" }: any) {
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
      } catch { alert("خطأ في قراءة ملف الإكسيل"); }
      finally { e.target.value = ''; }
    };
    reader.readAsBinaryString(file);
  };
  return (
    <label className="flex items-center bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 cursor-pointer font-semibold shadow-md transition-all">
      <Upload className="w-4 h-4 ml-2" /> {label}
      <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFile} />
    </label>
  );
}

const SidebarBtn = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-2xl transition-all font-bold ${active ? 'bg-blue-600 text-white shadow-xl' : 'bg-white text-gray-500 hover:bg-blue-50 border border-transparent'}`}>
    <span className="ml-3">{icon}</span>{label}
  </button>
);

// --- الأقسام ---

function GeneralSettingsTab({ center, onRefresh }: { center: GeneralSettings, onRefresh: () => void }) {
  const [settings, setSettings] = useState<GeneralSettings>({ ...center, holidays: center.holidays || [], specialties: center.specialties || [], leave_types: center.leave_types || [] });
  const [newHoliday, setNewHoliday] = useState('');
  
  const handleSave = async () => {
    const { error } = await supabase.from('general_settings').update(settings).eq('id', center.id);
    if (!error) {
      alert('تم حفظ كافة الإعدادات بنجاح');
      onRefresh();
    } else alert(error.message);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <h2 className="text-2xl font-black border-b pb-4 flex items-center gap-2 text-gray-800"><Settings className="w-7 h-7 text-blue-600" /> إعدادات النظام والقواعد</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Input label="اسم المركز الطبي" value={settings.center_name} onChange={(v:any)=>setSettings({...settings, center_name: v})} />
        <Input label="اسم المدير المسؤول" value={settings.admin_name} onChange={(v:any)=>setSettings({...settings, admin_name: v})} />
        <Input label="رقم تليفون الإدارة" value={settings.phone} onChange={(v:any)=>setSettings({...settings, phone: v})} />
        <Input label="العنوان التفصيلي" value={settings.address} onChange={(v:any)=>setSettings({...settings, address: v})} />
        <Input label="كلمة مرور بوابة الإدارة" type="password" value={settings.password} onChange={(v:any)=>setSettings({...settings, password: v})} />
        <Input label="رابط الموقع الجغرافي (Maps)" value={settings.location_url} onChange={(v:any)=>setSettings({...settings, location_url: v})} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6">
          <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">التخصصات المتاحة (مفصولة بفواصل)</label>
              <textarea 
                  className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-sm"
                  rows={2}
                  value={settings.specialties?.join(', ')}
                  onChange={(e) => setSettings({...settings, specialties: e.target.value.split(',').map(s => s.trim())})}
                  placeholder="طبيب، ممرض، إداري..."
              />
          </div>
          <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">أنواع الطلبات (مفصولة بفواصل)</label>
              <textarea 
                  className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-sm"
                  rows={2}
                  value={settings.leave_types?.join(', ')}
                  onChange={(e) => setSettings({...settings, leave_types: e.target.value.split(',').map(s => s.trim())})}
                  placeholder="إجازة عارضة، مأمورية..."
              />
          </div>
      </div>

      <div className="border-t pt-6">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-blue-500" /> مواعيد الفترات الرسمية</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-gray-50 p-6 rounded-3xl border">
              <div className="space-y-4">
                  <p className="font-bold text-sm text-blue-600">الفترة الصباحية</p>
                  <Input label="بداية الحضور" type="time" value={settings.shift_morning_in} onChange={(v:any)=>setSettings({...settings, shift_morning_in: v})} />
                  <Input label="نهاية الانصراف" type="time" value={settings.shift_morning_out} onChange={(v:any)=>setSettings({...settings, shift_morning_out: v})} />
              </div>
              <div className="space-y-4">
                  <p className="font-bold text-sm text-purple-600">الفترة المسائية</p>
                  <Input label="بداية الحضور" type="time" value={settings.shift_evening_in} onChange={(v:any)=>setSettings({...settings, shift_evening_in: v})} />
                  <Input label="نهاية الانصراف" type="time" value={settings.shift_evening_out} onChange={(v:any)=>setSettings({...settings, shift_evening_out: v})} />
              </div>
              <div className="space-y-4">
                  <p className="font-bold text-sm text-gray-700">فترة المبيت</p>
                  <Input label="بداية الحضور" type="time" value={settings.shift_night_in} onChange={(v:any)=>setSettings({...settings, shift_night_in: v})} />
                  <Input label="نهاية الانصراف" type="time" value={settings.shift_night_out} onChange={(v:any)=>setSettings({...settings, shift_night_out: v})} />
              </div>
          </div>
      </div>

      <div className="border-t pt-6">
        <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><Calendar className="w-5 h-5 text-red-500" /> العطلات الرسمية المعتمدة</h3>
        <div className="flex gap-2 mb-4">
          <input type="date" value={newHoliday} onChange={e => setNewHoliday(e.target.value)} className="p-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => { if(newHoliday) setSettings({...settings, holidays: [...(settings.holidays||[]), newHoliday]}); setNewHoliday(''); }} className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700"><Plus className="w-5 h-5"/></button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(settings.holidays || []).map(date => (
            <span key={date} className="bg-white px-4 py-2 rounded-xl text-xs border-2 border-gray-100 flex items-center gap-2 font-bold shadow-sm">
              {date} <button onClick={() => setSettings({...settings, holidays: (settings.holidays||[]).filter(d=>d!==date)})}><X className="w-3 h-3 text-red-500"/></button>
            </span>
          ))}
        </div>
      </div>

      <button onClick={handleSave} className="bg-emerald-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:bg-emerald-700 transition-all active:scale-95">حفظ وتحديث الإعدادات</button>
    </div>
  );
}

function DoctorsTab({ employees, onRefresh, centerId }: { employees: Employee[], onRefresh: () => void, centerId: string }) {
  const [editingStaff, setEditingStaff] = useState<Employee | null>(null);
  const [sortBy, setSortBy] = useState<'id' | 'name'>('name');

  const handleImport = async (data: any[]) => {
    const formatted = data.map(row => ({
      employee_id: String(row.employee_id || row['الكود'] || ''),
      name: String(row.name || row['الاسم'] || ''),
      national_id: String(row.national_id || row['الرقم القومي'] || ''),
      specialty: String(row.specialty || row['التخصص'] || ''),
      join_date: formatDateForDB(row.join_date || row['تاريخ التعيين']),
      center_id: centerId,
      leave_annual_balance: Number(row.leave_annual_balance || row['رصيد اعتيادي'] || 21),
      leave_casual_balance: Number(row.leave_casual_balance || row['رصيد عارضة'] || 7),
      remaining_annual: Number(row.leave_annual_balance || row['رصيد اعتيادي'] || 21),
      remaining_casual: Number(row.leave_casual_balance || row['رصيد عارضة'] || 7),
      status: 'نشط',
      work_days: ["الكل"]
    })).filter(r => r.employee_id && r.name);

    const { error } = await supabase.from('employees').upsert(formatted, { onConflict: 'employee_id' });
    if (error) alert(error.message); else { alert(`تم استيراد ${formatted.length} موظف بنجاح`); onRefresh(); }
  };

  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => {
      if (sortBy === 'id') return a.employee_id.localeCompare(b.employee_id);
      return a.name.localeCompare(b.name);
    });
  }, [employees, sortBy]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4">
        <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800"><Users className="w-7 h-7 text-blue-600"/> شئون الموظفين</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-gray-100 p-1 rounded-xl flex gap-1 border">
            <button onClick={()=>setSortBy('name')} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${sortBy==='name'?'bg-white text-blue-600 shadow-sm':'text-gray-400'}`}>الاسم</button>
            <button onClick={()=>setSortBy('id')} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${sortBy==='id'?'bg-white text-blue-600 shadow-sm':'text-gray-400'}`}>الكود</button>
          </div>
          <ExcelUploadButton onData={handleImport} label="استيراد موظفين" />
        </div>
      </div>
      
      <div className="overflow-x-auto border rounded-3xl bg-white shadow-sm">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100 text-gray-600 font-bold">
            <tr><th className="p-4">الكود</th><th className="p-4">الاسم</th><th className="p-4">التخصص</th><th className="p-4 text-center">إجراء</th></tr>
          </thead>
          <tbody>
            {sortedEmployees.map(emp => (
              <tr key={emp.id} className="border-b hover:bg-gray-50 transition-colors">
                <td className="p-4 font-mono font-bold text-blue-600">{emp.employee_id}</td>
                <td className="p-4 font-black">{emp.name}</td>
                <td className="p-4">{emp.specialty}</td>
                <td className="p-4 text-center">
                   <button className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit3 className="w-4 h-4"/></button>
                   <button onClick={async ()=>{if(confirm('حذف؟')) {await supabase.from('employees').delete().eq('id',emp.id); onRefresh();}}} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeavesTab({ onRefresh }: { onRefresh: () => void }) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<'all' | 'معلق' | 'مقبول' | 'مرفوض'>('all');

  const fetchLeaves = async () => {
    const { data } = await supabase.from('leave_requests').select(`*, employees(name, remaining_annual, remaining_casual)`).order('created_at', { ascending: false });
    if (data) setRequests(data.map((r:any) => ({ ...r, employee_name: r.employees?.name })));
  };

  useEffect(() => { fetchLeaves(); }, []);

  const handleAction = async (req: any, status: 'مقبول' | 'مرفوض') => {
    if (status === 'مقبول') {
        const emp = req.employees;
        const duration = Math.ceil((new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
        let updates: any = {};
        if (req.type.includes('اعتياد')) updates.remaining_annual = Math.max(0, (emp.remaining_annual || 0) - duration);
        else if (req.type.includes('عارضة')) updates.remaining_casual = Math.max(0, (emp.remaining_casual || 0) - duration);
        if (Object.keys(updates).length > 0) await supabase.from('employees').update(updates).eq('employee_id', req.employee_id);
    }
    const { error } = await supabase.from('leave_requests').update({ status }).eq('id', req.id);
    if (!error) { alert('تم تحديث حالة الطلب'); fetchLeaves(); onRefresh(); }
  };

  const filtered = requests.filter(r => filter === 'all' || r.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800"><FileText className="w-7 h-7 text-blue-600"/> سجل طلبات الإجازات</h2>
        <div className="flex bg-gray-100 p-1 rounded-xl border">
            <button onClick={()=>setFilter('all')} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${filter==='all'?'bg-white text-blue-600 shadow-sm':'text-gray-400'}`}>الكل</button>
            <button onClick={()=>setFilter('معلق')} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${filter==='معلق'?'bg-white text-amber-600 shadow-sm':'text-gray-400'}`}>معلق</button>
            <button onClick={()=>setFilter('مقبول')} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${filter==='مقبول'?'bg-white text-emerald-600 shadow-sm':'text-gray-400'}`}>مقبول</button>
            <button onClick={()=>setFilter('مرفوض')} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${filter==='مرفوض'?'bg-white text-red-600 shadow-sm':'text-gray-400'}`}>مرفوض</button>
        </div>
      </div>
      
      <div className="grid gap-4">
        {filtered.map(req => (
          <div key={req.id} className="p-6 bg-white border rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 hover:shadow-md transition-all">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-black text-lg text-gray-800">{req.employee_name}</span>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${req.status==='مقبول'?'bg-green-100 text-green-700':req.status==='مرفوض'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>{req.status}</span>
              </div>
              <p className="text-sm font-bold text-blue-600 mb-1">{req.type}</p>
              <p className="text-xs text-gray-500">من <span className="font-bold">{req.start_date}</span> إلى <span className="font-bold">{req.end_date}</span></p>
            </div>
            {req.status === 'معلق' && (
              <div className="flex gap-2">
                <button onClick={() => handleAction(req, 'مقبول')} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black shadow-md hover:bg-emerald-700 transition-all">قبول</button>
                <button onClick={() => handleAction(req, 'مرفوض')} className="bg-red-50 text-red-600 px-5 py-2.5 rounded-xl font-black hover:bg-red-100 transition-all">رفض</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AttendanceTab({ employees, onRefresh }: { employees: Employee[], onRefresh: () => void }) {
  const [formData, setFormData] = useState<Partial<AttendanceRecord>>({ date: new Date().toISOString().split('T')[0], times: '' });

  const handleImport = async (data: any[]) => {
    // حل مشكلة Foreign Key: نقوم بجلب كافة أكواد الموظفين الموجودين حالياً
    const validEmployeeIds = new Set(employees.map(e => e.employee_id));
    
    const processed = data.map(row => {
      const eid = String(row.employee_id || row['الكود'] || '');
      // نتحقق من وجود الكود في قاعدة بيانات الموظفين
      if (!validEmployeeIds.has(eid)) {
          console.warn(`Skipping unknown employee ID: ${eid}`);
          return null;
      }
      return {
          employee_id: eid,
          date: formatDateForDB(row.date || row['التاريخ']),
          times: String(row.times || row['البصمات'] || '').trim()
      };
    }).filter(r => r && r.employee_id && r.date);

    if (processed.length === 0) {
        alert('لم يتم العثور على بيانات صالحة للموظفين المسجلين في الملف المرفوع.');
        return;
    }

    const { error } = await supabase.from('attendance').insert(processed);
    if (!error) { 
        alert(`تم رفع ${processed.length} سجل بصمة بنجاح. ${data.length - processed.length} سجل تم تجاهلهم لعدم وجود أكواد موظفين مطابقة.`); 
        onRefresh(); 
    } else alert(error.message);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800"><Clock className="w-7 h-7 text-blue-600"/> سجل البصمات (إكسيل)</h2>
        <ExcelUploadButton onData={handleImport} label="رفع ملف البصمات" />
      </div>
      <div className="bg-gray-50 p-8 rounded-3xl border grid grid-cols-1 md:grid-cols-2 gap-6 shadow-inner">
        <Select label="الموظف" options={employees.map(e => ({value: e.employee_id, label: e.name}))} value={formData.employee_id} onChange={(v:any)=>setFormData({...formData, employee_id: v})} />
        <Input label="التاريخ" type="date" value={formData.date} onChange={(v:any)=>setFormData({...formData, date: v})} />
        <div className="md:col-span-2">
            <Input label="التوقيتات (مفصولة بمسافات)" value={formData.times} onChange={(v:any)=>setFormData({...formData, times: v})} placeholder="مثال: 08:30 14:15 16:00" />
        </div>
        <button onClick={async () => { await supabase.from('attendance').insert([formData]); alert('تم الحفظ'); onRefresh(); }} className="md:col-span-2 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all active:scale-95">حفظ السجل يدوياً</button>
      </div>
    </div>
  );
}

function AlertsTab({ employees }: { employees: Employee[] }) {
    const [target, setTarget] = useState('all'); 
    const [msg, setMsg] = useState('');
    const [history, setHistory] = useState<InternalMessage[]>([]);
    const [sending, setSending] = useState(false);

    const fetchHistory = async () => {
        const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(20);
        if (data) setHistory(data);
    };

    useEffect(() => { fetchHistory(); }, []);

    const sendAlert = async () => {
        if (!msg.trim()) return;
        setSending(true);
        const { error } = await supabase.from('messages').insert([{ 
            from_user: 'admin', 
            to_user: target, 
            content: msg.trim() 
        }]);
        if (!error) { alert('تم إرسال التنبيه'); setMsg(''); fetchHistory(); }
        setSending(false);
    };

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-black border-b pb-4 flex items-center gap-2 text-gray-800"><Bell className="w-7 h-7 text-orange-500" /> تنبيهات العاملين والمراسلات</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-50 p-8 rounded-3xl border space-y-4 shadow-inner">
                    <h3 className="font-black text-gray-700 mb-4">إرسال تنبيه جديد</h3>
                    <Select 
                        label="المستهدف بالتنبيه" 
                        options={[{value: 'all', label: 'جميع العاملين (إعلان عام)'}, ...employees.map(e => ({value: e.employee_id, label: e.name}))]} 
                        value={target} 
                        onChange={setTarget} 
                    />
                    <div className="text-right">
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">نص الرسالة أو التنبيه</label>
                        <textarea 
                            className="w-full p-4 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                            rows={5} 
                            value={msg} 
                            onChange={(e) => setMsg(e.target.value)} 
                            placeholder="اكتب رسالتك هنا..." 
                        />
                    </div>
                    <button 
                        onClick={sendAlert} 
                        disabled={sending}
                        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all flex justify-center items-center gap-2"
                    >
                        {sending ? 'جاري الإرسال...' : <><Send className="w-5 h-5"/> إرسال الآن</>}
                    </button>
                </div>

                <div className="space-y-4">
                    <h3 className="font-black text-gray-700 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-blue-500" /> سجل آخر المراسلات</h3>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                        {history.map(m => (
                            <div key={m.id} className="p-4 bg-white border rounded-2xl shadow-sm hover:border-blue-200 transition-all">
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${m.from_user==='admin'?'bg-blue-100 text-blue-700':'bg-emerald-100 text-emerald-700'}`}>
                                        {m.from_user==='admin' ? 'من الإدارة' : `من موظف: ${m.from_user}`}
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-bold">{new Date(m.created_at).toLocaleString('ar-EG')}</span>
                                </div>
                                <p className="text-sm text-gray-700 leading-relaxed">{m.content}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- المكون الرئيسي للمسؤول ---

const AdminDashboard: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [centers, setCenters] = useState<GeneralSettings[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<GeneralSettings | null>(null);
  const [activeTab, setActiveTab] = useState('settings');
  const [employees, setEmployees] = useState<Employee[]>([]);

  const fetchCenters = async () => {
    const { data } = await supabase.from('general_settings').select('*');
    if (data) setCenters(data);
  };

  useEffect(() => { fetchCenters(); }, []);

  const fetchEmployees = async () => {
    if (!selectedCenter) return;
    const { data } = await supabase.from('employees').select('*').eq('center_id', selectedCenter.id).order('name');
    if (data) setEmployees(data);
  };

  useEffect(() => { if (isAdminLoggedIn) fetchEmployees(); }, [isAdminLoggedIn, selectedCenter]);

  if (!isAdminLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-[85vh] p-6 text-right">
        <div className="bg-white p-12 rounded-[40px] shadow-2xl w-full max-w-md border border-gray-100 animate-in fade-in duration-700">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-8 font-black hover:scale-105 transition-transform"><ArrowRight className="ml-2 w-4 h-4" /> العودة للرئيسية</button>
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-blue-100 shadow-inner">
                <ShieldCheck className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-3xl font-black text-gray-800">بوابة الإدارة</h2>
            <p className="text-gray-400 text-sm mt-2 font-bold tracking-tight">يرجى تسجيل الدخول للوصول للوحة التحكم</p>
          </div>
          <div className="space-y-6">
            <select className="w-full p-4 border rounded-2xl outline-none bg-gray-50 font-black focus:ring-2 focus:ring-blue-500 shadow-sm" onChange={(e) => setSelectedCenter(centers.find(c => c.id === e.target.value) || null)}>
              <option value="">-- اختر المركز الطبي --</option>
              {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}
            </select>
            <input type="password" className="w-full p-4 border rounded-2xl outline-none bg-gray-50 text-center font-black focus:ring-2 focus:ring-blue-500 shadow-sm" placeholder="كلمة المرور الإدارية" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            <button 
                onClick={() => { if(selectedCenter && adminPassword === selectedCenter.password) { setIsAdminLoggedIn(true); } else alert('البيانات المدخلة خاطئة'); }} 
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all active:scale-95 flex justify-center items-center gap-2"
            >
                دخول لوحة التحكم
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-10 text-right">
      <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-[35px] shadow-sm border no-print">
        <div>
            <h1 className="text-3xl font-black text-gray-800 tracking-tighter">إدارة: {selectedCenter?.center_name}</h1>
            <p className="text-gray-400 text-sm font-bold flex items-center gap-2 mt-1"><MapPin className="w-3 h-3"/> {selectedCenter?.address}</p>
        </div>
        <button onClick={() => setIsAdminLoggedIn(false)} className="bg-red-50 text-red-600 px-8 py-3 rounded-2xl font-black flex items-center shadow-sm hover:bg-red-100 transition-all">خروج <LogOut className="ml-3 w-5 h-5"/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-3 no-print">
          <SidebarBtn active={activeTab === 'settings'} icon={<Settings className="w-5 h-5"/>} label="إعدادات المركز والقواعد" onClick={() => setActiveTab('settings')} />
          <SidebarBtn active={activeTab === 'doctors'} icon={<Users className="w-5 h-5"/>} label="شئون الموظفين (إكسيل)" onClick={() => setActiveTab('doctors')} />
          <SidebarBtn active={activeTab === 'leaves'} icon={<FileText className="w-5 h-5"/>} label="سجل طلبات الإجازات" onClick={() => setActiveTab('leaves')} />
          <SidebarBtn active={activeTab === 'attendance'} icon={<Clock className="w-5 h-5"/>} label="سجل البصمات (إكسيل)" onClick={() => setActiveTab('attendance')} />
          <SidebarBtn active={activeTab === 'reports'} icon={<BarChart3 className="w-5 h-5"/>} label="تقارير الحضور الذكية" onClick={() => setActiveTab('reports')} />
          <SidebarBtn active={activeTab === 'alerts'} icon={<Bell className="w-5 h-5"/>} label="التنبيهات والمراسلات" onClick={() => setActiveTab('alerts')} />
        </div>
        
        <div className="lg:col-span-3 bg-white p-10 rounded-[40px] shadow-sm border border-gray-100 min-h-[600px] animate-in slide-in-from-left duration-500">
          {activeTab === 'settings' && selectedCenter && <GeneralSettingsTab center={selectedCenter} onRefresh={fetchCenters} />}
          {activeTab === 'doctors' && <DoctorsTab employees={employees} onRefresh={fetchEmployees} centerId={selectedCenter!.id} />}
          {activeTab === 'leaves' && <LeavesTab onRefresh={fetchEmployees} />}
          {activeTab === 'attendance' && <AttendanceTab employees={employees} onRefresh={fetchEmployees} />}
          {activeTab === 'reports' && <ReportsTab employees={employees} />}
          {activeTab === 'alerts' && <AlertsTab employees={employees} />}
        </div>
      </div>
    </div>
  );
};

// --- تبويب التقارير ---
function ReportsTab({ employees }: { employees: Employee[] }) {
  const [activeReportType, setActiveReportType] = useState<'daily' | 'employee' | 'monthly'>('daily');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [settings, setSettings] = useState<GeneralSettings | null>(null);

  useEffect(() => {
    supabase.from('general_settings').select('*').limit(1).single().then(({data}) => setSettings(data));
    supabase.from('attendance').select('*').then(({data}) => data && setAllAttendance(data));
    supabase.from('leave_requests').select('*').eq('status', 'مقبول').then(({data}) => data && setAllLeaves(data));
  }, []);

  const getDailyStatus = (emp: Employee, d: string) => {
      const att = allAttendance.find(a => a.employee_id === emp.employee_id && a.date === d);
      const leave = allLeaves.find(l => l.employee_id === emp.employee_id && d >= l.start_date && d <= l.end_date);
      const isFriday = new Date(d).getDay() === 5;
      const isOfficialHoliday = settings?.holidays?.includes(d) || isFriday;
      const dayName = DAYS_AR[new Date(d).getDay()];
      const isWorkDay = (!emp.work_days || emp.work_days.length === 0 || emp.work_days.includes("الكل") || emp.work_days.includes(dayName));

      if (isOfficialHoliday) return { status: isFriday ? 'الجمعه (عطلة)' : 'عطلة رسمية', code: 'holiday' };
      if (leave) return { status: `إجازة (${leave.type})`, code: 'leave' };
      if (!isWorkDay) return { status: 'جزء من الوقت', code: 'part-time' };
      if (att) {
          const times = att.times.split(/\s+/).filter(t => t.includes(':'));
          return { status: 'حاضر', code: 'present', cin: times[0], cout: times[times.length-1] };
      }
      return { status: 'غائب', code: 'absent' };
  };

  const dailyData = useMemo(() => {
    return employees.map(emp => {
        const statusObj = getDailyStatus(emp, date);
        const att = allAttendance.find(a => a.employee_id === emp.employee_id && a.date === date);
        const times = att?.times.split(/\s+/).filter(t => t.includes(':')) || [];
        return { 
          ...emp, 
          cin: times[0] || '--', 
          cout: times.length > 1 ? times[times.length-1] : '--', 
          status: statusObj.status,
          code: statusObj.code 
        };
    });
  }, [employees, allAttendance, allLeaves, date, settings]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4 no-print">
        <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800"><BarChart3 className="w-7 h-7 text-emerald-600"/> تقارير الحضور والتحليل</h2>
        <div className="flex bg-gray-100 p-1 rounded-xl border">
            <button onClick={() => setActiveReportType('daily')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeReportType === 'daily' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>يومي</button>
            <button onClick={() => setActiveReportType('employee')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeReportType === 'employee' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>موظف</button>
            <button onClick={() => setActiveReportType('monthly')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeReportType === 'monthly' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>شهري</button>
        </div>
      </div>

      {activeReportType === 'daily' && (
          <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 bg-gray-50 p-6 rounded-3xl border items-end no-print">
                  <div className="flex-1 w-full"><Input label="عرض تقرير يوم" type="date" value={date} onChange={setDate} /></div>
                  <button onClick={() => window.print()} className="bg-gray-800 text-white px-8 py-2.5 rounded-2xl font-black flex justify-center gap-2 shadow-xl hover:bg-black transition-all"><Printer className="w-5 h-5"/> طباعة التقرير</button>
              </div>
              <div className="overflow-x-auto border rounded-3xl shadow-sm bg-white">
                <table className="w-full text-sm text-right">
                  <thead className="bg-gray-100 font-bold text-gray-600">
                    <tr><th className="p-4">الكود</th><th className="p-4">الاسم</th><th className="p-4">الحضور</th><th className="p-4">الحالة</th><th className="p-4">الانصراف</th><th className="p-4 text-xs">حالة الانصراف</th><th className="p-4">الوضع</th></tr>
                  </thead>
                  <tbody>
                    {dailyData.map(d => (
                        <tr key={d.employee_id} className="border-b hover:bg-gray-50">
                            <td className="p-4 font-mono font-bold">{d.employee_id}</td>
                            <td className="p-4 font-black">{d.name}</td>
                            <td className="p-4 text-emerald-600 font-black">{d.cin}</td>
                            <td className="p-4 text-xs font-bold">{getCheckInLabel(d.cin)}</td>
                            <td className="p-4 text-red-500 font-black">{d.cout}</td>
                            <td className="p-4 text-xs font-bold">{getCheckOutLabel(d.cout)}</td>
                            <td className={`p-4 font-black ${d.code==='absent'?'text-red-500':d.code==='present'?'text-emerald-600':'text-gray-500'}`}>{d.status}</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </div>
      )}
    </div>
  );
}

export default AdminDashboard;
