
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, Settings, Users, FileText, Calendar, 
  Clock, BarChart3, Mail, Bell, Plus, Upload, Trash2, CheckCircle, XCircle, FileSpreadsheet, Info, Download, X, Send, LogOut, ShieldCheck, Eye, Award, MessageCircle, User, Filter, CheckSquare, Square, MailCheck, Search, List, Edit3, Save, ChevronDown, AlertTriangle, Printer, MapPin, Phone, Hash, Briefcase, CalendarDays, PieChart, ArrowUpDown
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
    if (!inT || !outT || inT === '--' || outT === '--') return 0;
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
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">التخصصات (مفصولة بفواصل)</label>
              <textarea className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-sm" rows={2} value={settings.specialties?.join(', ')} onChange={(e) => setSettings({...settings, specialties: e.target.value.split(',').map(s => s.trim())})} />
          </div>
          <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">أنواع الإجازات (مفصولة بفواصل)</label>
              <textarea className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-sm" rows={2} value={settings.leave_types?.join(', ')} onChange={(e) => setSettings({...settings, leave_types: e.target.value.split(',').map(s => s.trim())})} />
          </div>
      </div>

      <div className="border-t pt-6">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-blue-500" /> مواعيد الفترات الرسمية</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-6 rounded-3xl border shadow-inner">
              <div className="space-y-3">
                  <p className="font-black text-xs text-blue-600">الفترة الصباحية</p>
                  <Input label="دخول" type="time" value={settings.shift_morning_in} onChange={(v:any)=>setSettings({...settings, shift_morning_in: v})} />
                  <Input label="خروج" type="time" value={settings.shift_morning_out} onChange={(v:any)=>setSettings({...settings, shift_morning_out: v})} />
              </div>
              <div className="space-y-3">
                  <p className="font-black text-xs text-purple-600">الفترة المسائية</p>
                  <Input label="دخول" type="time" value={settings.shift_evening_in} onChange={(v:any)=>setSettings({...settings, shift_evening_in: v})} />
                  <Input label="خروج" type="time" value={settings.shift_evening_out} onChange={(v:any)=>setSettings({...settings, shift_evening_out: v})} />
              </div>
              <div className="space-y-3">
                  <p className="font-black text-xs text-slate-700">فترة المبيت</p>
                  <Input label="دخول" type="time" value={settings.shift_night_in} onChange={(v:any)=>setSettings({...settings, shift_night_in: v})} />
                  <Input label="خروج" type="time" value={settings.shift_night_out} onChange={(v:any)=>setSettings({...settings, shift_night_out: v})} />
              </div>
          </div>
      </div>

      <div className="border-t pt-6">
        <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><Calendar className="w-5 h-5 text-red-500" /> العطلات الرسمية المعتمدة</h3>
        <div className="flex gap-2 mb-4">
          <input type="date" value={newHoliday} onChange={e => setNewHoliday(e.target.value)} className="p-2 border rounded-xl" />
          <button onClick={() => { if(newHoliday) setSettings({...settings, holidays: [...(settings.holidays||[]), newHoliday]}); setNewHoliday(''); }} className="bg-blue-600 text-white px-4 rounded-xl"><Plus/></button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(settings.holidays || []).map(date => (
            <span key={date} className="bg-white px-3 py-1 rounded-lg text-xs border flex items-center gap-2 font-bold shadow-sm">
              {date} <button onClick={() => setSettings({...settings, holidays: (settings.holidays||[]).filter(d=>d!==date)})}><X className="w-3 h-3 text-red-500"/></button>
            </span>
          ))}
        </div>
      </div>

      <button onClick={handleSave} className="bg-emerald-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:bg-emerald-700 transition-all">حفظ الإعدادات</button>
    </div>
  );
}

// --- عرض تفصيلي للموظف ---
function EmployeeDetailView({ employee, onBack, onRefresh }: { employee: Employee, onBack: () => void, onRefresh: () => void }) {
    const [subTab, setSubTab] = useState<'data' | 'requests' | 'attendance' | 'stats' | 'message'>('data');
    const [editData, setEditData] = useState<Employee>({ ...employee });
    const [staffRequests, setStaffRequests] = useState<LeaveRequest[]>([]);
    const [staffAttendance, setStaffAttendance] = useState<AttendanceRecord[]>([]);
    const [msg, setMsg] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

    useEffect(() => {
        supabase.from('leave_requests').select('*').eq('employee_id', employee.employee_id).then(({data})=> data && setStaffRequests(data));
        supabase.from('attendance').select('*').eq('employee_id', employee.employee_id).then(({data})=> data && setStaffAttendance(data));
    }, [employee]);

    const handleUpdate = async () => {
        const { error } = await supabase.from('employees').update(editData).eq('id', employee.id);
        if (!error) { alert('تم تحديث البيانات'); onRefresh(); }
    };

    const stats = useMemo(() => {
        const monthAtts = staffAttendance.filter(a => a.date.startsWith(selectedMonth));
        let totalHours = 0;
        monthAtts.forEach(a => {
            const t = a.times.split(/\s+/).filter(x => x.includes(':'));
            if(t.length >= 2) totalHours += calculateHours(t[0], t[t.length-1]);
        });
        const leavesCount = staffRequests.filter(r => r.status === 'مقبول' && (r.start_date.startsWith(selectedMonth) || r.end_date.startsWith(selectedMonth))).length;
        return { 
            presence: monthAtts.length, 
            hours: totalHours.toFixed(1), 
            leaves: leavesCount, 
            absent: Math.max(0, 26 - monthAtts.length - leavesCount) 
        };
    }, [staffAttendance, staffRequests, selectedMonth]);

    return (
        <div className="space-y-6 animate-in slide-in-from-left duration-300">
            <button onClick={onBack} className="flex items-center text-blue-600 font-bold mb-4 hover:gap-2 transition-all"><ArrowRight className="ml-2 w-4 h-4"/> عودة للقائمة</button>
            <div className="flex flex-col md:flex-row gap-6 items-center bg-gray-50 p-6 rounded-3xl border">
                <div className="w-24 h-24 bg-white rounded-2xl border-2 border-blue-100 flex items-center justify-center overflow-hidden shadow-sm">
                    {employee.photo_url ? <img src={employee.photo_url} className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-blue-200" />}
                </div>
                <div>
                    <h2 className="text-2xl font-black text-gray-800">{employee.name}</h2>
                    <p className="text-blue-600 font-bold">{employee.specialty} • {employee.employee_id}</p>
                </div>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-2xl border no-print overflow-x-auto">
                <button onClick={()=>setSubTab('data')} className={`px-4 py-2 rounded-xl text-xs font-black shrink-0 ${subTab==='data'?'bg-white shadow-sm text-blue-600':'text-gray-400'}`}>البيانات</button>
                <button onClick={()=>setSubTab('requests')} className={`px-4 py-2 rounded-xl text-xs font-black shrink-0 ${subTab==='requests'?'bg-white shadow-sm text-blue-600':'text-gray-400'}`}>الطلبات</button>
                <button onClick={()=>setSubTab('attendance')} className={`px-4 py-2 rounded-xl text-xs font-black shrink-0 ${subTab==='attendance'?'bg-white shadow-sm text-blue-600':'text-gray-400'}`}>الحضور</button>
                <button onClick={()=>setSubTab('stats')} className={`px-4 py-2 rounded-xl text-xs font-black shrink-0 ${subTab==='stats'?'bg-white shadow-sm text-blue-600':'text-gray-400'}`}>الإحصائيات</button>
                <button onClick={()=>setSubTab('message')} className={`px-4 py-2 rounded-xl text-xs font-black shrink-0 ${subTab==='message'?'bg-white shadow-sm text-blue-600':'text-gray-400'}`}>مراسلة</button>
            </div>

            <div className="min-h-[400px]">
                {subTab === 'data' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
                        <Input label="الاسم الكامل" value={editData.name} onChange={(v:any)=>setEditData({...editData, name: v})} />
                        <Input label="الرقم القومي" value={editData.national_id} onChange={(v:any)=>setEditData({...editData, national_id: v})} />
                        <Input label="التخصص" value={editData.specialty} onChange={(v:any)=>setEditData({...editData, specialty: v})} />
                        <Input label="الهاتف" value={editData.phone} onChange={(v:any)=>setEditData({...editData, phone: v})} />
                        <Input label="تاريخ التعيين" type="date" value={editData.join_date} onChange={(v:any)=>setEditData({...editData, join_date: v})} />
                        <Input label="رصيد اعتيادي" type="number" value={editData.leave_annual_balance} onChange={(v:any)=>setEditData({...editData, leave_annual_balance: Number(v)})} />
                        <Input label="رصيد عارضة" type="number" value={editData.leave_casual_balance} onChange={(v:any)=>setEditData({...editData, leave_casual_balance: Number(v)})} />
                        <div className="md:col-span-3 flex justify-end mt-4">
                            <button onClick={handleUpdate} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black shadow-lg">حفظ التعديلات</button>
                        </div>
                    </div>
                )}

                {subTab === 'requests' && (
                    <div className="space-y-4">
                        {staffRequests.map(r => (
                            <div key={r.id} className="p-4 bg-white border rounded-2xl flex justify-between items-center shadow-sm">
                                <div>
                                    <p className="font-black text-blue-600">{r.type}</p>
                                    <p className="text-xs text-gray-500">من {r.start_date} إلى {r.end_date}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${r.status==='مقبول'?'bg-green-100 text-green-700':r.status==='مرفوض'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                            </div>
                        ))}
                    </div>
                )}

                {subTab === 'attendance' && (
                    <div className="space-y-4">
                         <div className="flex justify-between items-center mb-4">
                            <Input type="month" value={selectedMonth} onChange={setSelectedMonth} />
                            <button onClick={()=>window.print()} className="bg-gray-800 text-white px-4 py-2 rounded-xl text-xs"><Printer className="w-4 h-4"/></button>
                         </div>
                         <table className="w-full text-sm text-right border rounded-2xl overflow-hidden">
                            <thead className="bg-gray-50">
                                <tr><th className="p-3">التاريخ</th><th className="p-3">الحضور</th><th className="p-3">الانصراف</th><th className="p-3">الساعات</th></tr>
                            </thead>
                            <tbody>
                                {staffAttendance.filter(a => a.date.startsWith(selectedMonth)).map(a => {
                                    const t = a.times.split(/\s+/).filter(x=>x.includes(':'));
                                    return (
                                        <tr key={a.id} className="border-t">
                                            <td className="p-3 font-bold">{a.date}</td>
                                            <td className="p-3 text-emerald-600 font-black">{t[0] || '--'}</td>
                                            <td className="p-3 text-red-500 font-black">{t[t.length-1] || '--'}</td>
                                            <td className="p-3 font-mono">{calculateHours(t[0], t[t.length-1]).toFixed(1)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                         </table>
                    </div>
                )}

                {subTab === 'stats' && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 py-4">
                         <StatCard label="أيام الحضور" value={stats.presence} color="blue" icon={<CheckCircle/>} />
                         <StatCard label="ساعات العمل" value={stats.hours} color="emerald" icon={<Clock/>} />
                         <StatCard label="أيام الغياب" value={stats.absent} color="red" icon={<AlertTriangle/>} />
                         <StatCard label="أيام الإجازات" value={stats.leaves} color="purple" icon={<Calendar/>} />
                    </div>
                )}

                {subTab === 'message' && (
                    <div className="bg-gray-50 p-6 rounded-3xl border space-y-4">
                        <textarea className="w-full p-4 border rounded-2xl outline-none" rows={4} placeholder="اكتب رسالة للموظف..." value={msg} onChange={e=>setMsg(e.target.value)} />
                        <button onClick={async ()=>{ await supabase.from('messages').insert([{from_user:'admin', to_user:employee.employee_id, content:msg}]); alert('تم الإرسال'); setMsg(''); }} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black w-full flex justify-center gap-2"><Send className="w-5 h-5"/> إرسال الآن</button>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ label, value, color, icon }: any) {
    const colors: any = {
        blue: 'bg-blue-600 text-white shadow-blue-100',
        emerald: 'bg-emerald-600 text-white shadow-emerald-100',
        red: 'bg-red-600 text-white shadow-red-100',
        purple: 'bg-purple-600 text-white shadow-purple-100'
    };
    return (
        <div className={`${colors[color]} p-6 rounded-[30px] shadow-xl relative overflow-hidden group`}>
            <div className="absolute -right-4 -bottom-4 opacity-20 group-hover:scale-110 transition-transform w-24 h-24">{icon}</div>
            <p className="text-[10px] font-black uppercase opacity-80 mb-1">{label}</p>
            <h4 className="text-3xl font-black">{value}</h4>
        </div>
    );
}

// --- تبويب شئون الموظفين (القائمة الرئيسية) ---
function DoctorsTab({ employees, onRefresh, centerId }: { employees: Employee[], onRefresh: () => void, centerId: string }) {
  const [selectedStaff, setSelectedStaff] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = employees.filter(e => e.name.includes(searchTerm) || e.employee_id.includes(searchTerm));

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
    if (!error) { alert(`تم استيراد ${formatted.length} موظف`); onRefresh(); }
  };

  if (selectedStaff) return <EmployeeDetailView employee={selectedStaff} onBack={()=>setSelectedStaff(null)} onRefresh={onRefresh} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4">
        <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800"><Users className="w-7 h-7 text-blue-600"/> شئون الموظفين</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input type="text" placeholder="بحث بالاسم أو الكود..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="p-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64" />
          <ExcelUploadButton onData={handleImport} label="استيراد موظفين" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(emp => (
          <div key={emp.id} onClick={()=>setSelectedStaff(emp)} className="p-6 bg-white border rounded-[30px] hover:shadow-xl transition-all cursor-pointer group flex items-center gap-4 border-gray-100 hover:border-blue-200">
             <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-300 group-hover:scale-110 transition-transform">
                <User className="w-8 h-8"/>
             </div>
             <div className="flex-1">
                <h4 className="font-black text-gray-800 truncate">{emp.name}</h4>
                <p className="text-xs font-bold text-blue-600">{emp.specialty} • {emp.employee_id}</p>
             </div>
             <ChevronDown className="-rotate-90 w-4 h-4 text-gray-300"/>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- تبويب الإجازات ---
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
    if (!error) { fetchLeaves(); onRefresh(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800"><FileText className="w-7 h-7 text-blue-600"/> سجل طلبات الإجازات</h2>
        <div className="flex bg-gray-100 p-1 rounded-xl border">
            {['all', 'معلق', 'مقبول', 'مرفوض'].map(f => (
                <button key={f} onClick={()=>setFilter(f as any)} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${filter===f?'bg-white text-blue-600 shadow-sm':'text-gray-400'}`}>{f==='all'?'الكل':f}</button>
            ))}
        </div>
      </div>
      <div className="grid gap-4">
        {requests.filter(r => filter==='all' || r.status === filter).map(req => (
          <div key={req.id} className="p-6 bg-white border rounded-[30px] shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex-1">
              <p className="font-black text-lg text-gray-800">{req.employee_name}</p>
              <p className="text-sm font-bold text-blue-600">{req.type}</p>
              <p className="text-xs text-gray-500">من {req.start_date} إلى {req.end_date}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-xl text-[10px] font-black ${req.status==='مقبول'?'bg-green-100 text-green-700':req.status==='مرفوض'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>{req.status}</span>
              {req.status === 'معلق' && (
                <div className="flex gap-2">
                  <button onClick={() => handleAction(req, 'مقبول')} className="bg-emerald-600 text-white p-2 rounded-xl"><CheckCircle/></button>
                  <button onClick={() => handleAction(req, 'مرفوض')} className="bg-red-600 text-white p-2 rounded-xl"><XCircle/></button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- تبويب البصمات (سجل البصمات) ---
function AttendanceTab({ employees, onRefresh }: { employees: Employee[], onRefresh: () => void }) {
  const [formData, setFormData] = useState<Partial<AttendanceRecord>>({ date: new Date().toISOString().split('T')[0], times: '' });

  const handleImport = async (data: any[]) => {
    const validIds = new Set(employees.map(e => e.employee_id));
    const processed = data.map(row => {
      const eid = String(row.employee_id || row['الكود'] || '');
      if (!validIds.has(eid)) return null;
      return { employee_id: eid, date: formatDateForDB(row.date || row['التاريخ']), times: String(row.times || row['البصمات'] || '').trim() };
    }).filter(r => r && r.employee_id && r.date);

    const { error } = await supabase.from('attendance').insert(processed);
    if (!error) { alert(`تم رفع ${processed.length} بصمة`); onRefresh(); } else alert(error.message);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800"><Clock className="w-7 h-7 text-blue-600"/> سجل البصمات (إكسيل)</h2>
        <ExcelUploadButton onData={handleImport} label="رفع ملف البصمات" />
      </div>
      <div className="bg-gray-50 p-8 rounded-[40px] border grid grid-cols-1 md:grid-cols-2 gap-6 shadow-inner">
        <Select label="الموظف" options={employees.map(e => ({value: e.employee_id, label: e.name}))} value={formData.employee_id} onChange={(v:any)=>setFormData({...formData, employee_id: v})} />
        <Input label="التاريخ" type="date" value={formData.date} onChange={(v:any)=>setFormData({...formData, date: v})} />
        <div className="md:col-span-2">
            <Input label="التوقيتات (مفصولة بمسافات)" value={formData.times} onChange={(v:any)=>setFormData({...formData, times: v})} placeholder="مثال: 08:30 14:15 16:00" />
        </div>
        <button onClick={async () => { await supabase.from('attendance').insert([formData]); alert('تم الحفظ'); onRefresh(); }} className="md:col-span-2 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl">حفظ السجل يدوياً</button>
      </div>
    </div>
  );
}

// --- تبويب التقارير (الذكية والمطورة مع الفلاتر ونطاق التاريخ) ---
function ReportsTab({ employees }: { employees: Employee[] }) {
  const [type, setType] = useState<'daily' | 'monthly' | 'employee_month'>('daily');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetId, setTargetId] = useState('');
  const [attData, setAttData] = useState<AttendanceRecord[]>([]);
  const [leaveData, setLeaveData] = useState<LeaveRequest[]>([]);
  const [settings, setSettings] = useState<GeneralSettings | null>(null);

  // فلاتر إضافية
  const [filterSpecialty, setFilterSpecialty] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'id' | 'hours'>('name');

  useEffect(() => {
    supabase.from('attendance').select('*').then(({data}) => data && setAttData(data));
    supabase.from('leave_requests').select('*').eq('status', 'مقبول').then(({data}) => data && setLeaveData(data));
    supabase.from('general_settings').select('*').limit(1).single().then(({data}) => setSettings(data));
  }, []);

  const filteredEmployees = useMemo(() => {
    let result = employees.filter(emp => {
      const matchSpec = filterSpecialty === 'all' || emp.specialty === filterSpecialty;
      const matchStatus = filterStatus === 'all' || emp.status === filterStatus;
      return matchSpec && matchStatus;
    });

    if (sortBy === 'name') result.sort((a,b) => a.name.localeCompare(b.name));
    else if (sortBy === 'id') result.sort((a,b) => a.employee_id.localeCompare(b.employee_id));
    
    return result;
  }, [employees, filterSpecialty, filterStatus, sortBy]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4 no-print">
        <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800"><BarChart3 className="w-7 h-7 text-emerald-600"/> التقارير الذكية</h2>
        <div className="flex bg-gray-100 p-1 rounded-xl border">
            <button onClick={()=>setType('daily')} className={`px-4 py-2 rounded-lg text-xs font-bold ${type==='daily'?'bg-white text-emerald-600 shadow-sm':'text-gray-400'}`}>يومي</button>
            <button onClick={()=>setType('monthly')} className={`px-4 py-2 rounded-lg text-xs font-bold ${type==='monthly'?'bg-white text-emerald-600 shadow-sm':'text-gray-400'}`}>تقرير فترة</button>
            <button onClick={()=>setType('employee_month')} className={`px-4 py-2 rounded-lg text-xs font-bold ${type==='employee_month'?'bg-white text-emerald-600 shadow-sm':'text-gray-400'}`}>موظف مخصص</button>
        </div>
      </div>

      {/* شريط الفلاتر المطور مع نطاق التاريخ */}
      <div className="bg-white p-6 rounded-[30px] border shadow-sm space-y-4 no-print">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
             {type === 'daily' && <Input label="تاريخ التقرير" type="date" value={date} onChange={setDate} />}
             {type === 'monthly' && (
                 <>
                    <Input label="من تاريخ" type="date" value={startDate} onChange={setStartDate} />
                    <Input label="إلى تاريخ" type="date" value={endDate} onChange={setEndDate} />
                 </>
             )}
             {type === 'employee_month' && (
                 <>
                    <Select label="اختر الموظف" options={employees.map(e=>({value:e.employee_id, label:e.name}))} value={targetId} onChange={setTargetId} />
                    <Input label="من تاريخ" type="date" value={startDate} onChange={setStartDate} />
                    <Input label="إلى تاريخ" type="date" value={endDate} onChange={setEndDate} />
                 </>
             )}
             
             {type !== 'employee_month' && (
                 <>
                    <Select 
                        label="فلترة بالتخصص" 
                        options={['all', ...(settings?.specialties || [])]} 
                        value={filterSpecialty} 
                        onChange={setFilterSpecialty} 
                    />
                    <Select 
                        label="فلترة بالحالة" 
                        options={['all', 'نشط', 'موقوف', 'إجازة']} 
                        value={filterStatus} 
                        onChange={setFilterStatus} 
                    />
                 </>
             )}
         </div>
         
         <div className="flex flex-col md:flex-row justify-between items-center pt-4 border-t gap-4">
             <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400">الترتيب:</span>
                    <div className="flex bg-gray-50 p-1 rounded-lg border text-[10px] font-black">
                        <button onClick={()=>setSortBy('name')} className={`px-3 py-1 rounded ${sortBy==='name'?'bg-white shadow-sm text-blue-600':'text-gray-400'}`}>الاسم</button>
                        <button onClick={()=>setSortBy('id')} className={`px-3 py-1 rounded ${sortBy==='id'?'bg-white shadow-sm text-blue-600':'text-gray-400'}`}>الكود</button>
                    </div>
                 </div>
                 <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">عدد النتائج: {filteredEmployees.length}</div>
             </div>
             <button onClick={()=>window.print()} className="bg-gray-800 text-white px-8 py-2.5 rounded-2xl font-black flex gap-2 hover:bg-black transition-all shadow-lg active:scale-95"><Printer className="w-5 h-5"/> طباعة التقرير</button>
         </div>
      </div>

      <div className="overflow-x-auto border rounded-[30px] bg-white shadow-sm min-h-[400px]">
        <table className="w-full text-sm text-right">
          {type === 'daily' && (
             <>
                <thead className="bg-gray-100 font-bold text-gray-600 sticky top-0">
                    <tr>
                        <th className="p-4">الكود</th>
                        <th className="p-4">الموظف</th>
                        <th className="p-4">التخصص</th>
                        <th className="p-4">الحضور</th>
                        <th className="p-4">الانصراف</th>
                        <th className="p-4">الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredEmployees.map(emp => {
                        const att = attData.find(a => a.employee_id === emp.employee_id && a.date === date);
                        const leave = leaveData.find(l => l.employee_id === emp.employee_id && date >= l.start_date && date <= l.end_date);
                        const t = att?.times.split(/\s+/).filter(x=>x.includes(':')) || [];
                        const cin = t[0] || '--';
                        const cout = t.length > 1 ? t[t.length-1] : '--';
                        
                        let statusText = att ? 'حاضر' : (leave ? `إجازة (${leave.type})` : 'غائب');
                        if (new Date(date).getDay() === 5) statusText = 'عطلة (الجمعة)';

                        return (
                            <tr key={emp.id} className="border-b hover:bg-gray-50 transition-colors">
                                <td className="p-4 font-mono font-bold text-blue-600">{emp.employee_id}</td>
                                <td className="p-4 font-black">{emp.name}</td>
                                <td className="p-4 text-xs font-bold text-gray-500">{emp.specialty}</td>
                                <td className="p-4 text-emerald-600 font-black">{cin}</td>
                                <td className="p-4 text-red-500 font-black">{cout}</td>
                                <td className={`p-4 font-bold ${att ? 'text-emerald-600' : 'text-red-400'}`}>{statusText}</td>
                            </tr>
                        );
                    })}
                </tbody>
             </>
          )}
          {type === 'monthly' && (
             <>
                <thead className="bg-gray-100 font-bold text-gray-600 sticky top-0">
                    <tr>
                        <th className="p-4">الموظف</th>
                        <th className="p-4">التخصص</th>
                        <th className="p-4 text-emerald-600">أيام حضور</th>
                        <th className="p-4 text-amber-500">أيام إجازة</th>
                        <th className="p-4 text-red-500">أيام غياب</th>
                        <th className="p-4">ساعات العمل</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredEmployees.map(emp => {
                        const periodAtts = attData.filter(a => a.employee_id === emp.employee_id && a.date >= startDate && a.date <= endDate);
                        const periodLeaves = leaveData.filter(l => l.employee_id === emp.employee_id && ((l.start_date >= startDate && l.start_date <= endDate) || (l.end_date >= startDate && l.end_date <= endDate)));
                        
                        let totalHours = 0;
                        periodAtts.forEach(a => {
                            const t = a.times.split(/\s+/).filter(x=>x.includes(':'));
                            if(t.length>=2) totalHours += calculateHours(t[0], t[t.length-1]);
                        });
                        
                        return (
                            <tr key={emp.id} className="border-b hover:bg-gray-50 transition-colors">
                                <td className="p-4 font-black">{emp.name}</td>
                                <td className="p-4 text-xs font-bold text-gray-400">{emp.specialty}</td>
                                <td className="p-4 text-emerald-600 font-black text-center">{periodAtts.length}</td>
                                <td className="p-4 text-amber-500 font-black text-center">{periodLeaves.length}</td>
                                <td className="p-4 text-red-500 font-black text-center">--</td>
                                <td className="p-4 font-mono font-bold text-center bg-gray-50">{totalHours.toFixed(1)}</td>
                            </tr>
                        );
                    })}
                </tbody>
             </>
          )}
          {type === 'employee_month' && targetId && (
              <>
                <thead className="bg-gray-100 font-bold text-gray-600 sticky top-0">
                    <tr>
                        <th className="p-4">التاريخ</th>
                        <th className="p-4">اليوم</th>
                        <th className="p-4">الحضور</th>
                        <th className="p-4">حالة الدخول</th>
                        <th className="p-4">الانصراف</th>
                        <th className="p-4">حالة الخروج</th>
                        <th className="p-4">ساعات</th>
                    </tr>
                </thead>
                <tbody>
                    {attData.filter(a => a.employee_id === targetId && a.date >= startDate && a.date <= endDate).sort((a,b)=>a.date.localeCompare(b.date)).map(a => {
                        const t = a.times.split(/\s+/).filter(x=>x.includes(':'));
                        const dayName = DAYS_AR[new Date(a.date).getDay()];
                        return (
                            <tr key={a.id} className="border-b hover:bg-gray-50 transition-colors">
                                <td className="p-4 font-bold">{a.date}</td>
                                <td className="p-4 font-black">{dayName}</td>
                                <td className="p-4 text-emerald-600 font-black">{t[0] || '--'}</td>
                                <td className="p-4 text-[10px] font-bold">{getCheckInLabel(t[0])}</td>
                                <td className="p-4 text-red-500 font-black">{t[t.length-1] || '--'}</td>
                                <td className="p-4 text-[10px] font-bold">{getCheckOutLabel(t[t.length-1])}</td>
                                <td className="p-4 font-mono font-bold bg-gray-50 text-center">{calculateHours(t[0], t[t.length-1]).toFixed(1)}</td>
                            </tr>
                        );
                    })}
                </tbody>
              </>
          )}
        </table>
        {type === 'employee_month' && !targetId && <div className="p-24 text-center text-gray-400 font-black">يرجى اختيار موظف ونطاق تاريخ لعرض التقرير التفصيلي</div>}
        {filteredEmployees.length === 0 && <div className="p-24 text-center text-gray-400 font-black">لا توجد نتائج تطابق الفلاتر المختارة</div>}
      </div>
    </div>
  );
}

// --- تبويب التنبيهات ---
function AlertsTab({ employees }: { employees: Employee[] }) {
    const [target, setTarget] = useState('all'); 
    const [msg, setMsg] = useState('');
    const [history, setHistory] = useState<InternalMessage[]>([]);

    useEffect(() => {
        supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(20).then(({data})=>data && setHistory(data));
    }, []);

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-black border-b pb-4 flex items-center gap-2 text-gray-800"><Bell className="w-7 h-7 text-orange-500" /> تنبيهات العاملين</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-50 p-8 rounded-[40px] border space-y-4 shadow-inner">
                    <Select label="المستهدف" options={[{value:'all', label:'الجميع'}, ...employees.map(e=>({value:e.employee_id, label:e.name}))]} value={target} onChange={setTarget} />
                    <textarea className="w-full p-4 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" rows={5} value={msg} onChange={e=>setMsg(e.target.value)} placeholder="نص التنبيه..." />
                    <button onClick={async ()=>{ await supabase.from('messages').insert([{from_user:'admin', to_user:target, content:msg}]); alert('تم الإرسال'); setMsg(''); }} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl flex justify-center items-center gap-2"><Send className="w-5 h-5"/> إرسال الآن</button>
                </div>
                <div className="space-y-4">
                    <h3 className="font-black text-gray-700">سجل التنبيهات</h3>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                        {history.map(m => (
                            <div key={m.id} className="p-4 bg-white border rounded-2xl shadow-sm">
                                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                    <span className="font-black">{m.to_user==='all'?'إعلان عام':`إلى: ${m.to_user}`}</span>
                                    <span>{new Date(m.created_at).toLocaleString('ar-EG')}</span>
                                </div>
                                <p className="text-sm text-gray-700">{m.content}</p>
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
          <button onClick={onBack} className="flex items-center text-blue-600 mb-8 font-black"><ArrowRight className="ml-2 w-4 h-4" /> العودة للرئيسية</button>
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-blue-100 shadow-inner"><ShieldCheck className="w-10 h-10 text-blue-600" /></div>
            <h2 className="text-3xl font-black text-gray-800">بوابة الإدارة</h2>
          </div>
          <div className="space-y-6">
            <select className="w-full p-4 border rounded-2xl font-black focus:ring-2 focus:ring-blue-500 shadow-sm" onChange={(e) => setSelectedCenter(centers.find(c => c.id === e.target.value) || null)}>
              <option value="">-- اختر المركز الطبي --</option>
              {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}
            </select>
            <input type="password" className="w-full p-4 border rounded-2xl text-center font-black focus:ring-2 focus:ring-blue-500 shadow-sm" placeholder="كلمة المرور" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            <button onClick={() => { if(selectedCenter && adminPassword === selectedCenter.password) setIsAdminLoggedIn(true); else alert('خطأ'); }} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl active:scale-95">دخول</button>
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
          <SidebarBtn active={activeTab === 'settings'} icon={<Settings className="w-5 h-5"/>} label="الإعدادات" onClick={() => setActiveTab('settings')} />
          <SidebarBtn active={activeTab === 'doctors'} icon={<Users className="w-5 h-5"/>} label="شئون الموظفين" onClick={() => setActiveTab('doctors')} />
          <SidebarBtn active={activeTab === 'leaves'} icon={<FileText className="w-5 h-5"/>} label="طلبات الإجازات" onClick={() => setActiveTab('leaves')} />
          <SidebarBtn active={activeTab === 'attendance'} icon={<Clock className="w-5 h-5"/>} label="سجل البصمات" onClick={() => setActiveTab('attendance')} />
          <SidebarBtn active={activeTab === 'reports'} icon={<BarChart3 className="w-5 h-5"/>} label="تقارير الحضور الذكية" onClick={() => setActiveTab('reports')} />
          <SidebarBtn active={activeTab === 'alerts'} icon={<Bell className="w-5 h-5"/>} label="تنبيهات العاملين" onClick={() => setActiveTab('alerts')} />
        </div>
        <div className="lg:col-span-3 bg-white p-10 rounded-[40px] shadow-sm border min-h-[600px] animate-in slide-in-from-left duration-500">
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

export default AdminDashboard;
