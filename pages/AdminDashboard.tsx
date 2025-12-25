
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, Settings, Users, FileText, Calendar, 
  Clock, BarChart3, Mail, Bell, Plus, Upload, Trash2, CheckCircle, XCircle, 
  FileSpreadsheet, Info, Download, X, Send, LogOut, ShieldCheck, Eye, 
  Award, MessageCircle, User, Filter, Search, Edit3, Save, 
  ChevronDown, AlertTriangle, Printer, MapPin, Phone, Hash, 
  Briefcase, CalendarDays, PieChart, ArrowUpDown, TrendingUp
} from 'lucide-react';
import { GeneralSettings, Employee, LeaveRequest, AttendanceRecord, InternalMessage, Evaluation } from '../types';
import * as XLSX from 'xlsx';

// --- Helper Functions ---

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

// --- Common UI Components ---

function Input({ label, type = 'text', value, onChange, placeholder, required = false, max }: any) {
  return (
    <div className="text-right">
      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input 
        type={type} 
        value={value || ''} 
        onChange={e => onChange(e.target.value)} 
        max={max}
        className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold" 
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
        className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold"
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
    <label className="flex items-center bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 cursor-pointer font-black shadow-md transition-all text-xs">
      <Upload className="w-4 h-4 ml-2" /> {label}
      <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFile} />
    </label>
  );
}

const SidebarBtn = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-2xl transition-all font-black ${active ? 'bg-blue-600 text-white shadow-xl translate-x-1' : 'bg-white text-gray-500 hover:bg-blue-50 border border-transparent'}`}>
    <span className="ml-3">{icon}</span>{label}
  </button>
);

// --- Sections ---

// 1. Settings Tab
function GeneralSettingsTab({ center, onRefresh }: { center: GeneralSettings, onRefresh: () => void }) {
  const [settings, setSettings] = useState<GeneralSettings>({ ...center, holidays: center.holidays || [], specialties: center.specialties || [], leave_types: center.leave_types || [] });
  const handleSave = async () => {
    const { error } = await supabase.from('general_settings').update(settings).eq('id', center.id);
    if (!error) { alert('تم حفظ الإعدادات'); onRefresh(); } else alert(error.message);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <h2 className="text-2xl font-black border-b pb-4 flex items-center gap-2 text-gray-800"><Settings className="w-7 h-7 text-blue-600" /> إعدادات النظام والقواعد</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Input label="اسم المركز الطبي" value={settings.center_name} onChange={(v:any)=>setSettings({...settings, center_name: v})} />
        <Input label="رقم تليفون الإدارة" value={settings.phone} onChange={(v:any)=>setSettings({...settings, phone: v})} />
        <Input label="كلمة مرور بوابة الإدارة" type="password" value={settings.password} onChange={(v:any)=>setSettings({...settings, password: v})} />
      </div>
      <button onClick={handleSave} className="bg-emerald-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:bg-emerald-700 transition-all">حفظ الإعدادات</button>
    </div>
  );
}

// 2. Employee Detail View (Refined with stats and history)
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

    const stats = useMemo(() => {
        const monthAtts = staffAttendance.filter(a => a.date.startsWith(selectedMonth));
        let totalHours = 0;
        monthAtts.forEach(a => {
            const t = a.times.split(/\s+/).filter(x => x.includes(':'));
            if(t.length >= 2) totalHours += calculateHours(t[0], t[t.length-1]);
        });
        const leavesCount = staffRequests.filter(r => r.status === 'مقبول' && (r.start_date.startsWith(selectedMonth) || r.end_date.startsWith(selectedMonth))).length;
        const workDaysCount = 26; 
        return { 
            presence: monthAtts.length, 
            hours: totalHours.toFixed(1), 
            leaves: leavesCount, 
            absent: Math.max(0, workDaysCount - monthAtts.length - leavesCount) 
        };
    }, [staffAttendance, staffRequests, selectedMonth]);

    const handleUpdate = async () => {
        const { error } = await supabase.from('employees').update(editData).eq('id', employee.id);
        if (!error) { alert('تم تحديث البيانات بنجاح'); onRefresh(); }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-left duration-300">
            <button onClick={onBack} className="flex items-center text-blue-600 font-black mb-4 hover:gap-2 transition-all"><ArrowRight className="ml-2 w-4 h-4"/> عودة للقائمة</button>
            
            <div className="flex bg-gray-50 p-8 rounded-[40px] border items-center gap-6 shadow-sm">
                <div className="w-24 h-24 bg-white rounded-3xl border-2 border-blue-100 flex items-center justify-center overflow-hidden shadow-inner">
                    {employee.photo_url ? <img src={employee.photo_url} className="w-full h-full object-cover" /> : <User className="text-blue-100 w-12 h-12"/>}
                </div>
                <div>
                    <h2 className="text-3xl font-black text-gray-800">{employee.name}</h2>
                    <p className="text-blue-600 font-black text-lg">{employee.specialty} • {employee.employee_id}</p>
                </div>
            </div>

            <div className="flex bg-gray-100 p-1.5 rounded-2xl border no-print overflow-x-auto gap-1">
                {[
                  {id:'data', label:'البيانات', icon:<User className="w-4 h-4"/>},
                  {id:'stats', label:'إحصائيات الأداء', icon:<PieChart className="w-4 h-4"/>},
                  {id:'attendance', label:'سجل الحضور', icon:<Clock className="w-4 h-4"/>},
                  {id:'requests', label:'سجل الطلبات', icon:<FileText className="w-4 h-4"/>},
                  {id:'message', label:'إرسال تنبيه', icon:<Bell className="w-4 h-4"/>}
                ].map(t => (
                  <button key={t.id} onClick={()=>setSubTab(t.id as any)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${subTab===t.id?'bg-white shadow-md text-blue-600':'text-gray-400 hover:text-gray-600'}`}>
                    {t.icon} {t.label}
                  </button>
                ))}
            </div>

            <div className="min-h-[500px] bg-white p-6 rounded-[35px] border">
                {subTab === 'data' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
                        <Input label="الاسم الكامل" value={editData.name} onChange={(v:any)=>setEditData({...editData, name: v})} />
                        <Input label="الرقم القومي" value={editData.national_id} onChange={(v:any)=>setEditData({...editData, national_id: v})} />
                        <Input label="التخصص" value={editData.specialty} onChange={(v:any)=>setEditData({...editData, specialty: v})} />
                        <Input label="الهاتف" value={editData.phone} onChange={(v:any)=>setEditData({...editData, phone: v})} />
                        <Input label="تاريخ التعيين" type="date" value={editData.join_date} onChange={(v:any)=>setEditData({...editData, join_date: v})} />
                        <Select label="الحالة الوظيفية" options={['نشط', 'موقوف', 'إجازة']} value={editData.status} onChange={(v:any)=>setEditData({...editData, status: v})} />
                        <Input label="رصيد الاعتيادي" type="number" value={editData.leave_annual_balance} onChange={(v:any)=>setEditData({...editData, leave_annual_balance: Number(v)})} />
                        <Input label="رصيد العارضة" type="number" value={editData.leave_casual_balance} onChange={(v:any)=>setEditData({...editData, leave_casual_balance: Number(v)})} />
                        <div className="md:col-span-3 flex justify-end mt-4">
                          <button onClick={handleUpdate} className="bg-blue-600 text-white px-10 py-3.5 rounded-2xl font-black shadow-xl hover:bg-blue-700 active:scale-95 transition-all">حفظ التعديلات</button>
                        </div>
                    </div>
                )}
                {subTab === 'stats' && (
                    <div className="space-y-8 animate-in fade-in">
                        <div className="flex items-center justify-between no-print border-b pb-4">
                            <h4 className="font-black text-gray-700 flex items-center gap-2"><BarChart3 className="text-blue-500"/> إحصائيات الشهر المختارة</h4>
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-black text-gray-400">اختر الشهر:</label>
                                <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="p-2 border rounded-xl font-bold" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="p-8 bg-blue-600 text-white rounded-[35px] shadow-lg shadow-blue-100 relative overflow-hidden group">
                                <CheckCircle className="absolute -right-4 -bottom-4 w-24 h-24 opacity-20 group-hover:scale-110 transition-all"/>
                                <p className="text-[10px] font-black opacity-80 uppercase mb-2">أيام الحضور</p>
                                <h4 className="text-4xl font-black">{stats.presence}</h4>
                            </div>
                            <div className="p-8 bg-emerald-600 text-white rounded-[35px] shadow-lg shadow-emerald-100 relative overflow-hidden group">
                                <Clock className="absolute -right-4 -bottom-4 w-24 h-24 opacity-20 group-hover:scale-110 transition-all"/>
                                <p className="text-[10px] font-black opacity-80 uppercase mb-2">ساعات العمل</p>
                                <h4 className="text-4xl font-black">{stats.hours}</h4>
                            </div>
                            <div className="p-8 bg-red-600 text-white rounded-[35px] shadow-lg shadow-red-100 relative overflow-hidden group">
                                <AlertTriangle className="absolute -right-4 -bottom-4 w-24 h-24 opacity-20 group-hover:scale-110 transition-all"/>
                                <p className="text-[10px] font-black opacity-80 uppercase mb-2">أيام الغياب</p>
                                <h4 className="text-4xl font-black">{stats.absent}</h4>
                            </div>
                            <div className="p-8 bg-indigo-600 text-white rounded-[35px] shadow-lg shadow-indigo-100 relative overflow-hidden group">
                                <Calendar className="absolute -right-4 -bottom-4 w-24 h-24 opacity-20 group-hover:scale-110 transition-all"/>
                                <p className="text-[10px] font-black opacity-80 uppercase mb-2">الإجازات</p>
                                <h4 className="text-4xl font-black">{stats.leaves}</h4>
                            </div>
                        </div>
                    </div>
                )}
                {subTab === 'attendance' && (
                     <div className="overflow-x-auto border rounded-3xl bg-white shadow-sm animate-in fade-in">
                         <table className="w-full text-sm text-right">
                             <thead className="bg-gray-50 border-b font-black text-gray-500">
                                 <tr><th className="p-4">التاريخ</th><th className="p-4">البصمات المسجلة</th><th className="p-4">إجمالي الساعات</th></tr>
                             </thead>
                             <tbody>
                                 {staffAttendance.filter(a => a.date.startsWith(selectedMonth)).sort((a,b)=>b.date.localeCompare(a.date)).map(a => {
                                     const t = a.times.split(/\s+/).filter(x=>x.includes(':'));
                                     return (
                                         <tr key={a.id} className="border-b hover:bg-gray-50 transition-colors">
                                             <td className="p-4 font-bold">{a.date}</td>
                                             <td className="p-4 font-mono text-blue-600 font-bold tracking-widest">{a.times}</td>
                                             <td className="p-4 font-black bg-blue-50/30 text-center">{calculateHours(t[0], t[t.length-1]).toFixed(1)}</td>
                                         </tr>
                                     )
                                 })}
                             </tbody>
                         </table>
                         {staffAttendance.filter(a => a.date.startsWith(selectedMonth)).length === 0 && <div className="p-20 text-center text-gray-400 font-bold">لا توجد بصمات مسجلة لهذا الشهر</div>}
                     </div>
                )}
                {subTab === 'requests' && (
                     <div className="grid gap-4 animate-in fade-in">
                         {staffRequests.map(r => (
                             <div key={r.id} className="p-6 bg-white border rounded-[30px] flex justify-between items-center shadow-sm hover:shadow-md transition-all">
                                 <div className="flex items-center gap-4">
                                     <div className={`p-3 rounded-2xl ${r.status==='مقبول'?'bg-green-50 text-green-600':'bg-amber-50 text-amber-600'}`}>
                                         <FileText className="w-6 h-6"/>
                                     </div>
                                     <div>
                                         <p className="font-black text-lg text-gray-800">{r.type}</p>
                                         <p className="text-xs text-gray-500 font-bold">من {r.start_date} إلى {r.end_date}</p>
                                     </div>
                                 </div>
                                 <span className={`px-5 py-2 rounded-2xl text-xs font-black shadow-sm ${r.status==='مقبول'?'bg-green-600 text-white':r.status==='مرفوض'?'bg-red-600 text-white':'bg-amber-500 text-white'}`}>{r.status}</span>
                             </div>
                         ))}
                         {staffRequests.length === 0 && <div className="p-20 text-center text-gray-400 font-bold border-2 border-dashed rounded-[35px]">لا توجد طلبات سابقة لهذا الموظف</div>}
                     </div>
                )}
                {subTab === 'message' && (
                    <div className="bg-gray-50 p-10 rounded-[40px] border shadow-inner space-y-4 animate-in fade-in">
                        <div className="flex items-center gap-2 mb-4">
                            <Bell className="text-orange-500 w-5 h-5"/>
                            <h4 className="font-black text-gray-700">إرسال تنبيه مباشر للموظف</h4>
                        </div>
                        <textarea className="w-full p-6 border rounded-[30px] outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" rows={5} placeholder="اكتب نص التنبيه أو الرسالة هنا..." value={msg} onChange={e=>setMsg(e.target.value)} />
                        <button onClick={async ()=>{ if(!msg)return; await supabase.from('messages').insert([{from_user:'admin', to_user:employee.employee_id, content:msg}]); alert('تم إرسال التنبيه للموظف'); setMsg(''); }} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black w-full flex justify-center gap-3 shadow-xl hover:bg-blue-700 transition-all"><Send className="w-5 h-5"/> إرسال التنبيه الآن</button>
                    </div>
                )}
            </div>
        </div>
    );
}

// 3. Doctors (Staff) Management with Table & Filters
function DoctorsTab({ employees, onRefresh, centerId }: { employees: Employee[], onRefresh: () => void, centerId: string }) {
  const [selectedStaff, setSelectedStaff] = useState<Employee | null>(null);
  const [fName, setFName] = useState('');
  const [fId, setFId] = useState('');
  const [fSpec, setFSpec] = useState('all');
  const [fStatus, setFStatus] = useState('all');

  const filtered = employees.filter(e => 
    (e.name.includes(fName)) && 
    (e.employee_id.includes(fId)) && 
    (fSpec === 'all' || e.specialty === fSpec) &&
    (fStatus === 'all' || e.status === fStatus)
  );

  const statsCount = useMemo(() => {
    return {
      total: employees.length,
      active: employees.filter(e => e.status === 'نشط').length,
      onLeave: employees.filter(e => e.status === 'إجازة').length
    }
  }, [employees]);

  if (selectedStaff) return <EmployeeDetailView employee={selectedStaff} onBack={()=>setSelectedStaff(null)} onRefresh={onRefresh} />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4">
        <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800"><Users className="w-7 h-7 text-blue-600"/> شئون الموظفين</h2>
        <div className="flex gap-2">
            <ExcelUploadButton onData={async (data: any[]) => {
                const formatted = data.map(row => ({
                    employee_id: String(row.employee_id || row['الكود'] || ''),
                    name: String(row.name || row['الاسم'] || ''),
                    national_id: String(row.national_id || row['الرقم القومي'] || ''),
                    specialty: String(row.specialty || row['التخصص'] || ''),
                    join_date: formatDateForDB(row.join_date || row['تاريخ التعيين']),
                    center_id: centerId,
                    status: 'نشط',
                    leave_annual_balance: 21,
                    leave_casual_balance: 7,
                    remaining_annual: 21,
                    remaining_casual: 7
                })).filter(r => r.employee_id && r.name);
                const { error } = await supabase.from('employees').upsert(formatted, { onConflict: 'employee_id' });
                if (!error) { alert(`تم استيراد ${formatted.length} موظف بنجاح`); onRefresh(); }
            }} label="استيراد موظفين" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-blue-600 text-white rounded-xl shadow-sm"><Users className="w-5 h-5"/></div>
              <div><p className="text-[10px] font-black text-blue-600 uppercase">الإجمالي</p><p className="text-lg font-black">{statsCount.total}</p></div>
          </div>
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-sm"><CheckCircle className="w-5 h-5"/></div>
              <div><p className="text-[10px] font-black text-emerald-600 uppercase">نشط</p><p className="text-lg font-black">{statsCount.active}</p></div>
          </div>
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-amber-600 text-white rounded-xl shadow-sm"><Calendar className="w-5 h-5"/></div>
              <div><p className="text-[10px] font-black text-amber-600 uppercase">إجازة</p><p className="text-lg font-black">{statsCount.onLeave}</p></div>
          </div>
          <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-gray-600 text-white rounded-xl shadow-sm"><TrendingUp className="w-5 h-5"/></div>
              <div><p className="text-[10px] font-black text-gray-600 uppercase">نسبة الحضور</p><p className="text-lg font-black">92%</p></div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-5 rounded-[30px] border border-gray-100 shadow-inner">
          <Input label="بحث بالاسم" value={fName} onChange={setFName} placeholder="أدخل الاسم..." />
          <Input label="بحث بالكود" value={fId} onChange={setFId} placeholder="أدخل الكود..." />
          <Select label="الفلترة بالتخصص" options={['all', ...Array.from(new Set(employees.map(e=>e.specialty)))]} value={fSpec} onChange={setFSpec} />
          <Select label="الفلترة بالحالة" options={['all', 'نشط', 'موقوف', 'إجازة']} value={fStatus} onChange={setFStatus} />
      </div>
      
      <div className="overflow-x-auto border rounded-[35px] bg-white shadow-sm">
          <table className="w-full text-sm text-right">
              <thead className="bg-gray-100 font-black border-b text-gray-500">
                  <tr>
                      <th className="p-5">كود الموظف</th>
                      <th className="p-5">الاسم الكامل</th>
                      <th className="p-5">التخصص</th>
                      <th className="p-5">الحالة</th>
                      <th className="p-5 text-center">الإجراءات</th>
                  </tr>
              </thead>
              <tbody>
                  {filtered.map(emp => (
                      <tr key={emp.id} className="border-b hover:bg-blue-50/50 transition-all group">
                          <td className="p-5 font-mono font-black text-blue-600">{emp.employee_id}</td>
                          <td className="p-5 font-black text-gray-800">{emp.name}</td>
                          <td className="p-5 text-xs font-bold text-gray-500">{emp.specialty}</td>
                          <td className="p-5">
                              <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black shadow-sm ${emp.status==='نشط'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{emp.status}</span>
                          </td>
                          <td className="p-5 text-center">
                              <button onClick={()=>setSelectedStaff(emp)} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-90"><Eye className="w-5 h-5"/></button>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
          {filtered.length === 0 && <div className="p-24 text-center text-gray-400 font-black text-lg">لا توجد بيانات تطابق فلاتر البحث الحالية</div>}
      </div>
    </div>
  );
}

// 4. Evaluations Tab
function EvaluationsTab({ employees }: { employees: Employee[] }) {
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [evalData, setEvalData] = useState({ employee_id: '', scores: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 }, notes: '' });
    const [history, setHistory] = useState<Evaluation[]>([]);
    
    const total = useMemo(() => Object.values(evalData.scores).reduce((a,b)=>Number(a)+Number(b), 0), [evalData.scores]);

    const fetchHistory = async () => {
        const { data } = await supabase.from('evaluations').select('*').order('created_at', { ascending: false }).limit(10);
        if (data) setHistory(data);
    };
    useEffect(() => { fetchHistory(); }, []);

    const handleSave = async () => {
        if(!evalData.employee_id) return alert('برجاء اختيار موظف للتقييم');
        const { error } = await supabase.from('evaluations').insert([{
            employee_id: evalData.employee_id, 
            month, 
            score_appearance: evalData.scores.s1, 
            score_attendance: evalData.scores.s2, 
            score_quality: evalData.scores.s3, 
            score_infection: evalData.scores.s4, 
            score_training: evalData.scores.s5, 
            score_records: evalData.scores.s6, 
            score_tasks: evalData.scores.s7, 
            total_score: total, 
            notes: evalData.notes
        }]);
        if(!error) { 
          alert('تم حفظ التقييم الطبي بنجاح'); 
          setEvalData({ employee_id: '', scores: {s1:0,s2:0,s3:0,s4:0,s5:0,s6:0,s7:0}, notes: '' }); 
          fetchHistory();
        } else alert(error.message);
    };

    return (
        <div className="space-y-8 animate-in fade-in">
            <div className="flex justify-between items-center border-b pb-4">
                <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800"><Award className="w-7 h-7 text-purple-600"/> التقييمات الطبية الشهرية</h2>
                <ExcelUploadButton onData={()=>{}} label="رفع تقييمات جماعية" />
            </div>
            <div className="bg-gray-50 p-10 rounded-[45px] border shadow-inner space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Select label="اختر الموظف المُراد تقييمه" options={employees.map(e=>({value:e.employee_id, label:e.name}))} value={evalData.employee_id} onChange={(v:any)=>setEvalData({...evalData, employee_id:v})} />
                    <Input label="شهر التقييم" type="month" value={month} onChange={setMonth} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    <Input label="المظهر (10)" type="number" value={evalData.scores.s1} onChange={(v:any)=>setEvalData({...evalData, scores: {...evalData.scores, s1:v}})} />
                    <Input label="الحضور (20)" type="number" value={evalData.scores.s2} onChange={(v:any)=>setEvalData({...evalData, scores: {...evalData.scores, s2:v}})} />
                    <Input label="الجودة (10)" type="number" value={evalData.scores.s3} onChange={(v:any)=>setEvalData({...evalData, scores: {...evalData.scores, s3:v}})} />
                    <Input label="العدوى (10)" type="number" value={evalData.scores.s4} onChange={(v:any)=>setEvalData({...evalData, scores: {...evalData.scores, s4:v}})} />
                    <Input label="التدريب (20)" type="number" value={evalData.scores.s5} onChange={(v:any)=>setEvalData({...evalData, scores: {...evalData.scores, s5:v}})} />
                    <Input label="الملفات (20)" type="number" value={evalData.scores.s6} onChange={(v:any)=>setEvalData({...evalData, scores: {...evalData.scores, s6:v}})} />
                    <Input label="المهام (10)" type="number" value={evalData.scores.s7} onChange={(v:any)=>setEvalData({...evalData, scores: {...evalData.scores, s7:v}})} />
                </div>
                <textarea className="w-full p-6 border rounded-[30px] bg-white outline-none focus:ring-2 focus:ring-purple-500 shadow-sm" rows={2} placeholder="أضف أي ملاحظات إدارية على الأداء..." value={evalData.notes} onChange={e=>setEvalData({...evalData, notes: e.target.value})} />
                <div className="bg-white p-8 rounded-[35px] border-2 border-purple-50 flex justify-between items-center shadow-lg">
                    <div className="text-3xl font-black text-purple-600">درجة التقييم الكلية: {total} / 100</div>
                    <button onClick={handleSave} className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700 active:scale-95 transition-all">حفظ التقييم الآن</button>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="font-black text-gray-700 flex items-center gap-2"><History className="w-5 h-5 text-gray-400"/> سجل آخر التقييمات المُدخلة</h3>
                <div className="grid gap-4">
                    {history.map(ev => (
                        <div key={ev.id} className="p-4 bg-white border rounded-2xl flex justify-between items-center shadow-sm">
                            <div><p className="font-black text-gray-800">{ev.employee_id} - {ev.month}</p><p className="text-xs text-gray-400">{ev.notes || 'لا توجد ملاحظات'}</p></div>
                            <div className="text-xl font-black text-purple-600">{ev.total_score}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// 5. Evening Schedules Tab
function EveningSchedulesTab({ employees }: { employees: Employee[] }) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);
    const [history, setHistory] = useState<any[]>([]);

    const fetchHistory = async () => {
        const { data } = await supabase.from('evening_schedules').select('*').order('date', { ascending: false }).limit(15);
        if (data) setHistory(data);
    };
    useEffect(() => { fetchHistory(); }, []);

    const handleSave = async () => {
        if(selectedDoctors.length === 0) return alert('برجاء اختيار الأطباء أولاً');
        const { error } = await supabase.from('evening_schedules').insert([{ date, doctors: selectedDoctors }]);
        if(!error) { alert('تم تسجيل جدول النوبتجية'); fetchHistory(); setSelectedDoctors([]); }
    };

    return (
        <div className="space-y-8 animate-in fade-in">
            <h2 className="text-2xl font-black border-b pb-4 flex items-center gap-2"><Calendar className="text-indigo-600 w-7 h-7"/> جداول النوبتجيات المسائية</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="md:col-span-1 bg-gray-50 p-8 rounded-[40px] border space-y-5 shadow-inner">
                    <Input label="تاريخ النوبتجية" type="date" value={date} onChange={setDate} />
                    <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400">اختر الأطباء للنوبتجية:</label>
                        <div className="max-h-72 overflow-y-auto border-2 border-white rounded-[25px] bg-white/50 p-4 space-y-1">
                            {employees.filter(e=>e.specialty.includes('طبيب')).map(doc => (
                                <label key={doc.employee_id} className="flex items-center gap-3 p-3 hover:bg-white rounded-2xl cursor-pointer transition-all border border-transparent hover:border-indigo-100 group">
                                    <input type="checkbox" checked={selectedDoctors.includes(doc.name)} onChange={()=>setSelectedDoctors(prev => prev.includes(doc.name) ? prev.filter(n=>n!==doc.name) : [...prev, doc.name])} className="w-5 h-5 rounded-lg text-indigo-600 border-gray-300 focus:ring-indigo-500" />
                                    <span className="text-sm font-black text-gray-700 group-hover:text-indigo-600">{doc.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleSave} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">حفظ الجدول المسائي</button>
                </div>
                <div className="md:col-span-2 space-y-4">
                    <h3 className="font-black text-gray-700 flex items-center gap-2"><History className="w-5 h-5 text-gray-400"/> الجداول المسجلة مسبقاً</h3>
                    <div className="grid gap-4">
                        {history.map(sch => (
                            <div key={sch.id} className="p-6 bg-white border rounded-[30px] shadow-sm flex justify-between items-center group hover:border-indigo-200 transition-all">
                                <div>
                                    <p className="font-black text-xl text-indigo-600">{sch.date}</p>
                                    <p className="text-sm text-gray-500 font-bold mt-1">الأطباء المشاركين: {sch.doctors?.join(' - ')}</p>
                                </div>
                                <button onClick={async ()=>{ if(window.confirm('هل أنت متأكد من حذف هذا الجدول؟')){ await supabase.from('evening_schedules').delete().eq('id', sch.id); fetchHistory(); } }} className="p-3 bg-red-50 text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-5 h-5"/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// 6. Leaves Tab (Restored)
function LeavesTab({ onRefresh }: { onRefresh: () => void }) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<'all' | 'معلق' | 'مقبول' | 'مرفوض'>('all');

  const fetchLeaves = async () => {
    const { data } = await supabase.from('leave_requests').select(`*, employees(name, leave_annual_balance, leave_casual_balance, remaining_annual, remaining_casual)`).order('created_at', { ascending: false });
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
    await supabase.from('leave_requests').update({ status }).eq('id', req.id);
    alert(`تم ${status} الطلب`);
    fetchLeaves(); onRefresh();
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><FileText className="text-blue-600 w-7 h-7"/> مراجعة طلبات الإجازات</h2>
        <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner border">
            {['all', 'معلق', 'مقبول', 'مرفوض'].map(f => (
                <button key={f} onClick={()=>setFilter(f as any)} className={`px-5 py-2 rounded-lg text-xs font-black transition-all ${filter===f?'bg-white text-blue-600 shadow-md':'text-gray-400 hover:text-gray-600'}`}>{f==='all'?'الكل':f}</button>
            ))}
        </div>
      </div>
      <div className="grid gap-5">
        {requests.filter(r => filter==='all' || r.status === filter).map(req => (
          <div key={req.id} className="p-8 bg-white border rounded-[35px] flex flex-col md:flex-row justify-between items-center shadow-sm hover:shadow-md transition-all">
            <div className="flex-1 space-y-1">
              <p className="font-black text-xl text-gray-800">{req.employee_name}</p>
              <div className="flex items-center gap-2 text-blue-600 font-black">
                <Calendar className="w-4 h-4"/> <span>{req.type}</span>
              </div>
              <p className="text-xs text-gray-400 font-bold">من تاريخ {req.start_date} إلى {req.end_date}</p>
              {req.notes && <p className="text-xs bg-gray-50 p-2 rounded-lg text-gray-500 mt-2 font-bold italic">"{req.notes}"</p>}
            </div>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <span className={`px-5 py-2 rounded-2xl text-[10px] font-black shadow-sm ${req.status==='مقبول'?'bg-green-600 text-white':req.status==='مرفوض'?'bg-red-600 text-white':'bg-amber-500 text-white'}`}>{req.status}</span>
              {req.status === 'معلق' && (
                <div className="flex gap-2">
                  <button onClick={() => handleAction(req, 'مقبول')} className="bg-emerald-600 text-white p-3 rounded-2xl shadow-lg hover:bg-emerald-700 active:scale-90 transition-all"><CheckCircle className="w-5 h-5"/></button>
                  <button onClick={() => handleAction(req, 'مرفوض')} className="bg-red-600 text-white p-3 rounded-2xl shadow-lg hover:bg-red-700 active:scale-90 transition-all"><XCircle className="w-5 h-5"/></button>
                </div>
              )}
            </div>
          </div>
        ))}
        {requests.length === 0 && <div className="p-24 text-center text-gray-400 font-black text-lg border-4 border-dashed rounded-[45px]">لا يوجد طلبات مسجلة حالياً</div>}
      </div>
    </div>
  );
}

// 7. Attendance Tab (Restored)
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
    if (!error) { alert(`تم رفع ${processed.length} بصمة بنجاح`); onRefresh(); } else alert(error.message);
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Clock className="text-blue-600 w-7 h-7"/> إدارة سجلات البصمات</h2>
        <ExcelUploadButton onData={handleImport} label="استيراد ملف بصمات" />
      </div>
      <div className="bg-gray-50 p-10 rounded-[45px] border grid grid-cols-1 md:grid-cols-2 gap-8 shadow-inner">
        <div className="md:col-span-2">
          <h4 className="font-black text-gray-700 mb-4 border-r-4 border-blue-500 pr-3">إدخال بصمة يدوية ليوم محدد</h4>
        </div>
        <Select label="اختر الموظف" options={employees.map(e => ({value: e.employee_id, label: e.name}))} value={formData.employee_id} onChange={(v:any)=>setFormData({...formData, employee_id: v})} />
        <Input label="التاريخ" type="date" value={formData.date} onChange={(v:any)=>setFormData({...formData, date: v})} />
        <div className="md:col-span-2">
          <Input label="سجل البصمات (افصل بين البصمات بمسافة)" value={formData.times} onChange={(v:any)=>setFormData({...formData, times: v})} placeholder="مثال: 08:30 14:15 16:00" />
        </div>
        <button onClick={async () => { if(!formData.employee_id || !formData.times)return; await supabase.from('attendance').insert([formData]); alert('تم حفظ السجل بنجاح'); setFormData({...formData, times: ''}); onRefresh(); }} className="md:col-span-2 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700 active:scale-95 transition-all">تأجيل البصمة للسجل</button>
      </div>
      <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex gap-4 items-start">
          <Info className="w-6 h-6 text-amber-600 shrink-0"/>
          <p className="text-sm text-amber-800 leading-relaxed font-bold"><b>تنبيه فني:</b> عند رفع ملف إكسيل، تأكد من وجود أعمدة باسم (employee_id) و (date) و (times). سيقوم النظام آلياً بربط البصمات بملفات الموظفين المعتمدة.</p>
      </div>
    </div>
  );
}

// 8. Reports Tab (Restored & Improved)
function ReportsTab({ employees }: { employees: Employee[] }) {
  const [type, setType] = useState<'daily' | 'monthly' | 'employee_month'>('daily');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetId, setTargetId] = useState('');
  const [attData, setAttData] = useState<AttendanceRecord[]>([]);
  const [leaveData, setLeaveData] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    supabase.from('attendance').select('*').then(({data}) => data && setAttData(data));
    supabase.from('leave_requests').select('*').eq('status', 'مقبول').then(({data}) => data && setLeaveData(data));
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4 no-print">
        <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800"><BarChart3 className="w-7 h-7 text-emerald-600"/> التقارير والتحليلات الذكية</h2>
        <div className="flex bg-gray-100 p-1 rounded-2xl border shadow-inner">
            <button onClick={()=>setType('daily')} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${type==='daily'?'bg-white text-emerald-600 shadow-md':'text-gray-400 hover:text-gray-600'}`}>يومي</button>
            <button onClick={()=>setType('monthly')} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${type==='monthly'?'bg-white text-emerald-600 shadow-md':'text-gray-400 hover:text-gray-600'}`}>تقرير فترة</button>
            <button onClick={()=>setType('employee_month')} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${type==='employee_month'?'bg-white text-emerald-600 shadow-md':'text-gray-400 hover:text-gray-600'}`}>موظف مخصص</button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6 no-print">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
             {type === 'daily' && <Input label="تاريخ التقرير اليومي" type="date" value={date} onChange={setDate} />}
             {(type === 'monthly' || type === 'employee_month') && (
                 <>
                    {type === 'employee_month' && <Select label="اختر الموظف" options={employees.map(e=>({value:e.employee_id, label:e.name}))} value={targetId} onChange={setTargetId} />}
                    <Input label="من تاريخ" type="date" value={startDate} onChange={setStartDate} />
                    <Input label="إلى تاريخ" type="date" value={endDate} onChange={setEndDate} />
                 </>
             )}
         </div>
         <div className="flex justify-end pt-4 border-t">
            <button onClick={()=>window.print()} className="bg-gray-800 text-white px-10 py-3 rounded-2xl font-black flex gap-3 shadow-xl hover:bg-black transition-all"><Printer className="w-5 h-5"/> طباعة التقرير الرسمي</button>
         </div>
      </div>

      <div className="overflow-x-auto border rounded-[45px] bg-white shadow-sm min-h-[400px]">
        <table className="w-full text-sm text-right">
            <thead className="bg-gray-100 font-black text-gray-500">
                {type === 'daily' && <tr><th className="p-5">الكود</th><th className="p-5">الاسم</th><th className="p-5">الحضور</th><th className="p-5">الانصراف</th><th className="p-5 text-center">الحالة</th></tr>}
                {type === 'monthly' && <tr><th className="p-5">الاسم</th><th className="p-5">التخصص</th><th className="p-5 text-emerald-600 text-center">أيام حضور</th><th className="p-5 text-amber-500 text-center">أيام إجازة</th><th className="p-5 text-center">ساعات العمل</th></tr>}
                {type === 'employee_month' && <tr><th className="p-5">التاريخ</th><th className="p-5">اليوم</th><th className="p-5">الحضور</th><th className="p-5">الانصراف</th><th className="p-5 text-center">الساعات</th></tr>}
            </thead>
            <tbody>
                {type === 'daily' && employees.map(emp => {
                    const att = attData.find(a => a.employee_id === emp.employee_id && a.date === date);
                    const leave = leaveData.find(l => l.employee_id === emp.employee_id && date >= l.start_date && date <= l.end_date);
                    const t = att?.times.split(/\s+/).filter(x=>x.includes(':')) || [];
                    return (
                        <tr key={emp.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="p-5 font-mono font-black text-blue-600">{emp.employee_id}</td>
                            <td className="p-5 font-black text-gray-800">{emp.name}</td>
                            <td className="p-5 text-emerald-600 font-black">{t[0] || '--'}</td>
                            <td className="p-5 text-red-500 font-black">{t[t.length-1] || '--'}</td>
                            <td className="p-5 text-center">
                              <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black shadow-sm ${att ? 'bg-green-100 text-green-700' : (leave ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}`}>
                                {att ? 'حاضر' : (leave ? `إجازة (${leave.type})` : 'غائب')}
                              </span>
                            </td>
                        </tr>
                    )
                })}
                {type === 'monthly' && employees.map(emp => {
                    const periodAtts = attData.filter(a => a.employee_id === emp.employee_id && a.date >= startDate && a.date <= endDate);
                    const periodLeaves = leaveData.filter(l => l.employee_id === emp.employee_id && ((l.start_date >= startDate && l.start_date <= endDate) || (l.end_date >= startDate && l.end_date <= endDate)));
                    let totalHours = 0;
                    periodAtts.forEach(a => {
                        const t = a.times.split(/\s+/).filter(x=>x.includes(':'));
                        if(t.length>=2) totalHours += calculateHours(t[0], t[t.length-1]);
                    });
                    return (
                        <tr key={emp.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="p-5 font-black text-gray-800">{emp.name}</td>
                            <td className="p-5 text-xs font-bold text-gray-400">{emp.specialty}</td>
                            <td className="p-5 text-emerald-600 font-black text-center">{periodAtts.length}</td>
                            <td className="p-5 text-amber-500 font-black text-center">{periodLeaves.length}</td>
                            <td className="p-5 font-mono font-black text-center bg-gray-50/50">{totalHours.toFixed(1)}</td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
      </div>
    </div>
  );
}

// 9. Alerts Tab (Restored)
function AlertsTab({ employees }: { employees: Employee[] }) {
    const [target, setTarget] = useState('all'); 
    const [msg, setMsg] = useState('');
    const [history, setHistory] = useState<InternalMessage[]>([]);
    
    const fetchHistory = async () => {
        const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(25);
        if (data) setHistory(data);
    };
    useEffect(() => { fetchHistory(); }, []);

    return (
        <div className="space-y-8 animate-in fade-in">
            <h2 className="text-2xl font-black border-b pb-4 flex items-center gap-2 text-gray-800"><Bell className="w-7 h-7 text-orange-500" /> تنبيهات وإعلانات العاملين</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="bg-gray-50 p-10 rounded-[45px] border shadow-inner space-y-5">
                    <div className="flex items-center gap-2 mb-2 pr-2 border-r-4 border-orange-500">
                        <h4 className="font-black text-gray-700">إنشاء تنبيه جديد</h4>
                    </div>
                    <Select label="الفئة المستهدفة بالتنبيه" options={[{value:'all', label:'إرسال للجميع (إعلان عام)'}, ...employees.map(e=>({value:e.employee_id, label:e.name}))]} value={target} onChange={setTarget} />
                    <textarea className="w-full p-6 border rounded-[35px] bg-white outline-none focus:ring-2 focus:ring-orange-500 shadow-sm" rows={6} value={msg} onChange={e=>setMsg(e.target.value)} placeholder="اكتب نص التنبيه أو التعليمات هنا..." />
                    <button onClick={async ()=>{ if(!msg)return; await supabase.from('messages').insert([{from_user:'admin', to_user:target, content:msg}]); alert('تم إرسال التنبيه بنجاح'); setMsg(''); fetchHistory(); }} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700 active:scale-95 transition-all flex justify-center items-center gap-3"><Send className="w-5 h-5"/> بث التنبيه الآن</button>
                </div>
                <div className="space-y-4">
                    <h3 className="font-black text-gray-700 flex items-center gap-2"><History className="w-5 h-5 text-gray-400"/> سجل آخر التنبيهات المرسلة</h3>
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {history.map(m => (
                            <div key={m.id} className="p-6 bg-white border rounded-[30px] shadow-sm hover:shadow-md transition-all border-r-4 border-r-orange-200">
                                <div className="flex justify-between text-[10px] text-gray-400 mb-2 font-black">
                                    <span className="flex items-center gap-1"><User className="w-3 h-3"/> {m.to_user==='all'?'إعلان عام':`موجه لـ: ${m.to_user}`}</span>
                                    <span>{new Date(m.created_at).toLocaleString('ar-EG')}</span>
                                </div>
                                <p className="text-sm text-gray-700 leading-relaxed font-bold">{m.content}</p>
                            </div>
                        ))}
                        {history.length === 0 && <div className="text-center py-20 text-gray-400 font-black border-2 border-dashed rounded-[35px]">لا يوجد سجل تنبيهات حالياً</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Main Admin Dashboard Component ---
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
        <div className="bg-white p-12 rounded-[45px] shadow-2xl w-full max-w-md border border-gray-100 animate-in zoom-in duration-300">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-8 font-black hover:gap-2 transition-all"><ArrowRight className="ml-2 w-4 h-4" /> العودة للرئيسية</button>
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-blue-100 shadow-inner"><ShieldCheck className="w-10 h-10 text-blue-600" /></div>
            <h2 className="text-3xl font-black text-gray-800">بوابة الإدارة</h2>
            <p className="text-xs text-gray-400 font-bold mt-1">يُرجى اختيار المنشأة الطبية وإدخال كلمة المرور</p>
          </div>
          <div className="space-y-6">
            <select className="w-full p-4 border rounded-2xl font-black focus:ring-2 focus:ring-blue-500 shadow-sm" onChange={(e) => setSelectedCenter(centers.find(c => c.id === e.target.value) || null)}>
              <option value="">-- اختر المركز الطبي --</option>
              {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}
            </select>
            <input type="password" className="w-full p-4 border rounded-2xl text-center font-black focus:ring-2 focus:ring-blue-500 shadow-sm" placeholder="كلمة المرور" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            <button onClick={() => { if(selectedCenter && adminPassword === selectedCenter.password) setIsAdminLoggedIn(true); else alert('خطأ في البيانات أو لم يتم اختيار المنشأة'); }} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl active:scale-95 hover:bg-blue-700 transition-all">تأكيد الدخول</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-10 text-right">
      <div className="flex justify-between items-center mb-10 bg-white p-10 rounded-[45px] shadow-sm border no-print">
        <div className="flex items-center gap-5">
            <div className="p-4 bg-blue-50 rounded-3xl border-2 border-blue-100"><ShieldCheck className="w-10 h-10 text-blue-600"/></div>
            <div>
                <h1 className="text-3xl font-black text-gray-800 tracking-tighter">إدارة: {selectedCenter?.center_name}</h1>
                <p className="text-gray-400 text-sm font-bold flex items-center gap-2 mt-1"><MapPin className="w-3 h-3"/> {selectedCenter?.address}</p>
            </div>
        </div>
        <button onClick={() => setIsAdminLoggedIn(false)} className="bg-red-50 text-red-600 px-10 py-3.5 rounded-2xl font-black flex items-center hover:bg-red-100 transition-all shadow-sm active:scale-95">تسجيل الخروج <LogOut className="ml-3 w-5 h-5"/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        <div className="lg:col-span-1 space-y-3 no-print">
          <SidebarBtn active={activeTab === 'settings'} icon={<Settings className="w-5 h-5"/>} label="إعدادات المنشأة" onClick={() => setActiveTab('settings')} />
          <SidebarBtn active={activeTab === 'doctors'} icon={<Users className="w-5 h-5"/>} label="شئون الموظفين" onClick={() => setActiveTab('doctors')} />
          <SidebarBtn active={activeTab === 'evaluations'} icon={<Award className="w-5 h-5"/>} label="التقييمات الطبية" onClick={() => setActiveTab('evaluations')} />
          <SidebarBtn active={activeTab === 'evening'} icon={<Calendar className="w-5 h-5"/>} label="جداول النوبتجية" onClick={() => setActiveTab('evening')} />
          <SidebarBtn active={activeTab === 'leaves'} icon={<FileText className="w-5 h-5"/>} label="طلبات الإجازات" onClick={() => setActiveTab('leaves')} />
          <SidebarBtn active={activeTab === 'attendance'} icon={<Clock className="w-5 h-5"/>} label="سجل البصمات" onClick={() => setActiveTab('attendance')} />
          <SidebarBtn active={activeTab === 'reports'} icon={<BarChart3 className="w-5 h-5"/>} label="التقارير الذكية" onClick={() => setActiveTab('reports')} />
          <SidebarBtn active={activeTab === 'alerts'} icon={<Bell className="w-5 h-5"/>} label="تنبيهات العاملين" onClick={() => setActiveTab('alerts')} />
        </div>
        <div className="lg:col-span-3 bg-white p-12 rounded-[55px] shadow-sm border min-h-[650px] animate-in slide-in-from-left duration-500 relative">
          {activeTab === 'settings' && selectedCenter && <GeneralSettingsTab center={selectedCenter} onRefresh={fetchCenters} />}
          {activeTab === 'doctors' && <DoctorsTab employees={employees} onRefresh={fetchEmployees} centerId={selectedCenter!.id} />}
          {activeTab === 'evaluations' && <EvaluationsTab employees={employees} />}
          {activeTab === 'evening' && <EveningSchedulesTab employees={employees} />}
          {activeTab === 'leaves' && <LeavesTab onRefresh={fetchEmployees} />}
          {activeTab === 'attendance' && <AttendanceTab employees={employees} onRefresh={fetchEmployees} />}
          {activeTab === 'reports' && <ReportsTab employees={employees} />}
          {activeTab === 'alerts' && <AlertsTab employees={employees} />}
        </div>
      </div>
    </div>
  );
};

// Helper components missing from previous context
const History = ({className}: any) => <Clock className={className}/>;

export default AdminDashboard;
