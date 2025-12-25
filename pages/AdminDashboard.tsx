
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, Settings, Users, FileText, Calendar, 
  Clock, BarChart3, Mail, Bell, Plus, Upload, Trash2, CheckCircle, XCircle, 
  FileSpreadsheet, Info, Download, X, Send, LogOut, ShieldCheck, Eye, 
  Award, MessageCircle, User, Filter, Search, Edit3, Save, 
  ChevronDown, AlertTriangle, Printer, MapPin, Phone, Hash, 
  Briefcase, CalendarDays, PieChart, ArrowUpDown, TrendingUp, Layers, ListChecks, FileImage
} from 'lucide-react';
import { GeneralSettings, Employee, LeaveRequest, AttendanceRecord, InternalMessage, Evaluation } from '../types';
import * as XLSX from 'xlsx';

// --- مساعدات البيانات ---

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

// --- المكونات العامة ---

function Input({ label, type = 'text', value, onChange, placeholder, required = false, max }: any) {
  return (
    <div className="text-right">
      <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-widest">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input 
        type={type} 
        value={value || ''} 
        onChange={e => onChange(e.target.value)} 
        max={max}
        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all text-sm font-bold" 
        placeholder={placeholder} 
      />
    </div>
  );
}

function Select({ label, options, value, onChange }: any) {
  return (
    <div className="text-right">
      <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-widest">{label}</label>
      <select 
        value={value || ''} 
        onChange={e => onChange(e.target.value)} 
        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all text-sm font-bold"
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
    <label className="flex items-center bg-emerald-600 text-white px-5 py-2.5 rounded-2xl hover:bg-emerald-700 cursor-pointer font-black shadow-lg shadow-emerald-100 transition-all text-xs">
      <Upload className="w-4 h-4 ml-2" /> {label}
      <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFile} />
    </label>
  );
}

const SidebarBtn = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-2xl transition-all font-black group ${active ? 'bg-blue-600 text-white shadow-xl translate-x-1' : 'bg-white text-gray-400 hover:bg-blue-50 hover:text-blue-600 border border-transparent'}`}>
    <span className={`ml-3 p-2 rounded-xl transition-colors ${active ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-white group-hover:text-blue-600'}`}>{icon}</span>
    {label}
  </button>
);

// --- الأقسام المحدثة ---

// 1. التبويب المطور للإعدادات
function GeneralSettingsTab({ center, onRefresh }: { center: GeneralSettings, onRefresh: () => void }) {
  const [settings, setSettings] = useState<GeneralSettings>({ 
    ...center, 
    holidays: center.holidays || [], 
    specialties: center.specialties || [], 
    leave_types: center.leave_types || [] 
  });
  const [newSpec, setNewSpec] = useState('');
  const [newLeave, setNewLeave] = useState('');

  const handleSave = async () => {
    const { error } = await supabase.from('general_settings').update(settings).eq('id', center.id);
    if (!error) { alert('تم حفظ الإعدادات المحدثة بنجاح'); onRefresh(); } else alert(error.message);
  };

  const addItem = (field: 'specialties' | 'leave_types', val: string, setVal: (v:string)=>void) => {
    if(!val) return;
    setSettings({...settings, [field]: [...(settings[field] as string[]), val]});
    setVal('');
  };

  const removeItem = (field: 'specialties' | 'leave_types', index: number) => {
    const newList = [...(settings[field] as string[])];
    newList.splice(index, 1);
    setSettings({...settings, [field]: newList});
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex justify-between items-center border-b pb-6">
          <h2 className="text-2xl font-black flex items-center gap-3 text-gray-800"><Settings className="w-8 h-8 text-blue-600" /> إعدادات المنشأة والقواعد المنظمة</h2>
          <button onClick={handleSave} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl hover:bg-emerald-700 transition-all active:scale-95">حفظ كافة التغييرات</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="space-y-6 bg-gray-50/50 p-6 rounded-[35px] border border-gray-100">
            <h3 className="font-black text-blue-600 border-r-4 border-blue-600 pr-3">بيانات المنشأة</h3>
            <Input label="اسم المركز الطبي" value={settings.center_name} onChange={(v:any)=>setSettings({...settings, center_name: v})} />
            <Input label="رقم الهاتف" value={settings.phone} onChange={(v:any)=>setSettings({...settings, phone: v})} />
            <Input label="كلمة مرور الإدارة" type="password" value={settings.password} onChange={(v:any)=>setSettings({...settings, password: v})} />
        </div>

        <div className="space-y-6 bg-gray-50/50 p-6 rounded-[35px] border border-gray-100">
            <h3 className="font-black text-indigo-600 border-r-4 border-indigo-600 pr-3">مواعيد الشفتات الرسمية</h3>
            <div className="grid grid-cols-2 gap-4">
                <Input label="بداية الصباحي" type="time" value={settings.shift_morning_in} onChange={(v:any)=>setSettings({...settings, shift_morning_in: v})} />
                <Input label="نهاية الصباحي" type="time" value={settings.shift_morning_out} onChange={(v:any)=>setSettings({...settings, shift_morning_out: v})} />
                <Input label="بداية المسائي" type="time" value={settings.shift_evening_in} onChange={(v:any)=>setSettings({...settings, shift_evening_in: v})} />
                <Input label="نهاية المسائي" type="time" value={settings.shift_evening_out} onChange={(v:any)=>setSettings({...settings, shift_evening_out: v})} />
            </div>
        </div>

        <div className="space-y-6 bg-gray-50/50 p-6 rounded-[35px] border border-gray-100">
            <h3 className="font-black text-emerald-600 border-r-4 border-emerald-600 pr-3">إدارة التخصصات</h3>
            <div className="flex gap-2">
                <input type="text" value={newSpec} onChange={e=>setNewSpec(e.target.value)} placeholder="تخصص جديد..." className="flex-1 p-2 border rounded-xl text-sm font-bold" />
                <button onClick={()=>addItem('specialties', newSpec, setNewSpec)} className="bg-emerald-600 text-white p-2 rounded-xl"><Plus className="w-5 h-5"/></button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {settings.specialties.map((s, i) => (
                    <span key={i} className="bg-white border px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                        {s} <button onClick={()=>removeItem('specialties', i)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3"/></button>
                    </span>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
}

// 2. شئون الموظفين (فلاتر وتصدير)
function DoctorsTab({ employees, onRefresh, centerId }: { employees: Employee[], onRefresh: () => void, centerId: string }) {
  const [selectedStaff, setSelectedStaff] = useState<Employee | null>(null);
  const [fName, setFName] = useState('');
  const [fId, setFId] = useState('');
  const [fSpec, setFSpec] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [fGrade, setFGrade] = useState('all');

  const filtered = employees.filter(e => 
    (e.name.includes(fName)) && 
    (e.employee_id.includes(fId)) && 
    (fSpec === 'all' || e.specialty === fSpec) &&
    (fStatus === 'all' || e.status === fStatus) &&
    (fGrade === 'all' || e.grade === fGrade)
  );

  const exportToExcel = () => {
    const dataToExport = filtered.map(e => ({
        'الكود': e.employee_id,
        'الاسم': e.name,
        'الرقم القومي': e.national_id,
        'التخصص': e.specialty,
        'الحالة': e.status,
        'تاريخ التعيين': e.join_date,
        'رصيد الاعتيادي المتبقي': e.remaining_annual,
        'رصيد العارضة المتبقي': e.remaining_casual
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staff");
    XLSX.writeFile(wb, `Staff_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  if (selectedStaff) return <EmployeeDetailView employee={selectedStaff} onBack={()=>setSelectedStaff(null)} onRefresh={onRefresh} />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-6 gap-4">
        <h2 className="text-2xl font-black flex items-center gap-3 text-gray-800"><Users className="w-8 h-8 text-blue-600"/> شئون الموظفين والعاملين</h2>
        <div className="flex gap-3">
            <button onClick={exportToExcel} className="flex items-center bg-blue-50 text-blue-600 px-5 py-2.5 rounded-2xl hover:bg-blue-600 hover:text-white font-black shadow-sm transition-all text-xs border border-blue-100">
                <FileSpreadsheet className="w-4 h-4 ml-2" /> تصدير الجدول
            </button>
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
            }} label="استيراد جماعي" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 bg-gray-50/50 p-6 rounded-[35px] border border-gray-100 shadow-inner">
          <Input label="بحث بالاسم" value={fName} onChange={setFName} placeholder="أدخل اسم الموظف..." />
          <Input label="بحث بالكود" value={fId} onChange={setFId} placeholder="أدخل الكود..." />
          <Select label="التخصص" options={['all', ...Array.from(new Set(employees.map(e=>e.specialty)))]} value={fSpec} onChange={setFSpec} />
          <Select label="الحالة" options={['all', 'نشط', 'موقوف', 'إجازة']} value={fStatus} onChange={setFStatus} />
          <Select label="الدرجة" options={['all', 'أولى', 'ثانية', 'ثالثة']} value={fGrade} onChange={setFGrade} />
      </div>
      
      <div className="overflow-x-auto border rounded-[40px] bg-white shadow-xl shadow-gray-100">
          <table className="w-full text-sm text-right">
              <thead className="bg-gray-100 font-black border-b text-gray-500 uppercase tracking-tighter">
                  <tr>
                      <th className="p-5">الكود</th>
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
                          <td className="p-5 text-xs font-bold text-gray-400">{emp.specialty}</td>
                          <td className="p-5">
                              <span className={`px-4 py-1.5 rounded-2xl text-[10px] font-black shadow-sm ${emp.status==='نشط'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{emp.status}</span>
                          </td>
                          <td className="p-5 text-center">
                              <button onClick={()=>setSelectedStaff(emp)} className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-md active:scale-90"><Eye className="w-5 h-5"/></button>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
          {filtered.length === 0 && <div className="p-24 text-center text-gray-400 font-black text-lg border-t italic">لم يتم العثور على أي موظف بهذه المواصفات</div>}
      </div>
    </div>
  );
}

// 3. التقارير المحدثة (المتأخرين + الأرصدة)
function ReportsTab({ employees }: { employees: Employee[] }) {
  const [type, setType] = useState<'daily' | 'monthly' | 'latecomers' | 'critical_leaves'>('daily');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attData, setAttData] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    supabase.from('attendance').select('*').then(({data}) => data && setAttData(data));
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-6 gap-4 no-print">
        <h2 className="text-2xl font-black flex items-center gap-3 text-gray-800"><BarChart3 className="w-8 h-8 text-emerald-600"/> نظام التقارير والرقابة الذكي</h2>
        <div className="flex bg-gray-100 p-1.5 rounded-[20px] border shadow-inner overflow-x-auto gap-1">
            <button onClick={()=>setType('daily')} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 ${type==='daily'?'bg-white text-emerald-600 shadow-md':'text-gray-400'}`}>يومي</button>
            <button onClick={()=>setType('latecomers')} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 ${type==='latecomers'?'bg-white text-red-600 shadow-md':'text-gray-400'}`}>المتأخرين اليوم</button>
            <button onClick={()=>setType('critical_leaves')} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 ${type==='critical_leaves'?'bg-white text-orange-600 shadow-md':'text-gray-400'}`}>رصيد الإجازات الحرج</button>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[45px] border shadow-sm space-y-6 no-print">
         <div className="flex justify-between items-end gap-6">
             {type === 'daily' || type === 'latecomers' ? <Input label="اختر تاريخ التقرير" type="date" value={date} onChange={setDate} /> : <div className="p-4 bg-orange-50 text-orange-700 rounded-2xl font-black text-sm border border-orange-100 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> يعرض هذا التقرير الموظفين الذين تبقى لهم أقل من 3 أيام اعتيادي</div>}
             <button onClick={()=>window.print()} className="bg-gray-800 text-white px-10 py-3.5 rounded-2xl font-black flex gap-3 shadow-2xl hover:bg-black transition-all active:scale-95"><Printer className="w-5 h-5"/> طباعة التقرير</button>
         </div>
      </div>

      <div className="overflow-x-auto border rounded-[45px] bg-white shadow-xl shadow-gray-100 min-h-[400px]">
        <table className="w-full text-sm text-right">
            <thead className="bg-gray-100 font-black text-gray-500 border-b">
                {type === 'daily' && <tr><th className="p-5">الكود</th><th className="p-5">الاسم</th><th className="p-5">الحضور</th><th className="p-5">الانصراف</th><th className="p-5">الحالة</th></tr>}
                {type === 'latecomers' && <tr><th className="p-5">الكود</th><th className="p-5">الاسم</th><th className="p-5">وقت الحضور</th><th className="p-5">مدة التأخير</th></tr>}
                {type === 'critical_leaves' && <tr><th className="p-5">الاسم</th><th className="p-5">الرصيد المتبقي</th><th className="p-5">الرصيد الكلي</th><th className="p-5">الحالة</th></tr>}
            </thead>
            <tbody>
                {type === 'daily' && employees.map(emp => {
                    const att = attData.find(a => a.employee_id === emp.employee_id && a.date === date);
                    const t = att?.times.split(/\s+/).filter(x=>x.includes(':')) || [];
                    return (
                        <tr key={emp.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="p-5 font-mono font-black text-blue-600">{emp.employee_id}</td>
                            <td className="p-5 font-black text-gray-800">{emp.name}</td>
                            <td className="p-5 text-emerald-600 font-black">{t[0] || '--'}</td>
                            <td className="p-5 text-red-500 font-black">{t[t.length-1] || '--'}</td>
                            <td className="p-5 font-bold"><span className={`px-4 py-1 rounded-xl text-[10px] ${att?'bg-emerald-50 text-emerald-600':'bg-red-50 text-red-600'}`}>{att?'حاضر':'غائب'}</span></td>
                        </tr>
                    )
                })}
                {type === 'critical_leaves' && employees.filter(e=>e.remaining_annual < 5).map(emp => (
                    <tr key={emp.id} className="border-b bg-orange-50/20">
                        <td className="p-5 font-black text-gray-800">{emp.name}</td>
                        <td className="p-5 text-orange-600 font-black">{emp.remaining_annual} يوم</td>
                        <td className="p-5 text-gray-400 font-bold">{emp.leave_annual_balance} يوم</td>
                        <td className="p-5"><span className="bg-orange-600 text-white px-3 py-1 rounded-lg text-[10px] font-black">رصيد منخفض</span></td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}

// 4. ملف الموظف التفصيلي (مع الهوية)
function EmployeeDetailView({ employee, onBack, onRefresh }: { employee: Employee, onBack: () => void, onRefresh: () => void }) {
    const [subTab, setSubTab] = useState<'data' | 'requests' | 'attendance' | 'docs' | 'message'>('data');
    const [editData, setEditData] = useState<Employee>({ ...employee });
    const [staffRequests, setStaffRequests] = useState<LeaveRequest[]>([]);
    const [staffAttendance, setStaffAttendance] = useState<AttendanceRecord[]>([]);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        supabase.from('leave_requests').select('*').eq('employee_id', employee.employee_id).then(({data})=> data && setStaffRequests(data));
        supabase.from('attendance').select('*').eq('employee_id', employee.employee_id).then(({data})=> data && setStaffAttendance(data));
    }, [employee]);

    return (
        <div className="space-y-8 animate-in slide-in-from-left duration-300">
            <button onClick={onBack} className="flex items-center text-blue-600 font-black mb-4 hover:gap-3 transition-all"><ArrowRight className="ml-2 w-5 h-5"/> العودة لجدول الموظفين</button>
            
            <div className="flex bg-white p-10 rounded-[50px] border shadow-2xl shadow-blue-50 items-center gap-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-bl-[100px]"></div>
                <div className="w-32 h-32 bg-gray-50 rounded-[40px] border-4 border-white shadow-xl flex items-center justify-center overflow-hidden z-10">
                    {employee.photo_url ? <img src={employee.photo_url} className="w-full h-full object-cover" /> : <User className="text-blue-100 w-16 h-16"/>}
                </div>
                <div className="z-10">
                    <h2 className="text-4xl font-black text-gray-800 mb-1">{employee.name}</h2>
                    <p className="text-blue-600 font-black text-xl flex items-center gap-2"><Briefcase className="w-5 h-5"/> {employee.specialty} • {employee.employee_id}</p>
                </div>
            </div>

            <div className="flex bg-gray-100/50 p-2 rounded-[25px] border no-print overflow-x-auto gap-2">
                {[
                  {id:'data', label:'البيانات الأساسية', icon:<User className="w-4 h-4"/>},
                  {id:'attendance', label:'سجل الحضور', icon:<Clock className="w-4 h-4"/>},
                  {id:'requests', label:'الإجازات والطلبات', icon:<FileText className="w-4 h-4"/>},
                  {id:'docs', label:'مستندات الهوية', icon:<FileImage className="w-4 h-4"/>},
                  {id:'message', label:'تنبيه سريع', icon:<Bell className="w-4 h-4"/>}
                ].map(t => (
                  <button key={t.id} onClick={()=>setSubTab(t.id as any)} className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl text-xs font-black transition-all ${subTab===t.id?'bg-blue-600 shadow-xl text-white':'text-gray-400 hover:text-gray-600 hover:bg-white'}`}>
                    {t.icon} {t.label}
                  </button>
                ))}
            </div>

            <div className="min-h-[550px] bg-white p-10 rounded-[50px] border border-gray-100 shadow-sm relative">
                {subTab === 'data' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in">
                        <Input label="الاسم الكامل" value={editData.name} onChange={(v:any)=>setEditData({...editData, name: v})} />
                        <Input label="الرقم القومي" value={editData.national_id} onChange={(v:any)=>setEditData({...editData, national_id: v})} />
                        <Input label="التخصص" value={editData.specialty} onChange={(v:any)=>setEditData({...editData, specialty: v})} />
                        <Input label="الدرجة الوظيفية" value={editData.grade} onChange={(v:any)=>setEditData({...editData, grade: v})} />
                        <Input label="تاريخ التعيين" type="date" value={editData.join_date} onChange={(v:any)=>setEditData({...editData, join_date: v})} />
                        <Select label="الجنس" options={['ذكر', 'أنثى']} value={editData.gender} onChange={(v:any)=>setEditData({...editData, gender: v})} />
                        <div className="md:col-span-3 flex justify-end mt-10">
                          <button onClick={async ()=>{ await supabase.from('employees').update(editData).eq('id', employee.id); alert('تم التحديث'); onRefresh(); }} className="bg-emerald-600 text-white px-12 py-4 rounded-2xl font-black shadow-2xl hover:bg-emerald-700 active:scale-95 transition-all">تحديث بيانات الملف</button>
                        </div>
                    </div>
                )}
                {subTab === 'docs' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in">
                        <div className="space-y-4">
                            <h4 className="font-black text-gray-700 border-r-4 border-blue-500 pr-3">صورة الهوية (الوجه)</h4>
                            <div className="w-full h-64 bg-gray-50 border-2 border-dashed rounded-3xl flex items-center justify-center overflow-hidden">
                                {employee.id_front_url ? <img src={employee.id_front_url} className="w-full h-full object-contain" /> : <FileImage className="w-12 h-12 text-gray-200" />}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h4 className="font-black text-gray-700 border-r-4 border-blue-500 pr-3">صورة الهوية (الظهر)</h4>
                            <div className="w-full h-64 bg-gray-50 border-2 border-dashed rounded-3xl flex items-center justify-center overflow-hidden">
                                {employee.id_back_url ? <img src={employee.id_back_url} className="w-full h-full object-contain" /> : <FileImage className="w-12 h-12 text-gray-200" />}
                            </div>
                        </div>
                    </div>
                )}
                {subTab === 'attendance' && (
                     <div className="overflow-x-auto border rounded-[35px] bg-white animate-in fade-in">
                         <table className="w-full text-sm text-right">
                             <thead className="bg-gray-50 border-b font-black text-gray-400">
                                 <tr><th className="p-5">التاريخ</th><th className="p-5">البصمات المسجلة</th><th className="p-5 text-center">الساعات</th></tr>
                             </thead>
                             <tbody>
                                 {staffAttendance.sort((a,b)=>b.date.localeCompare(a.date)).map(a => {
                                     const t = a.times.split(/\s+/).filter(x=>x.includes(':'));
                                     return (
                                         <tr key={a.id} className="border-b hover:bg-blue-50/20 transition-all">
                                             <td className="p-5 font-bold">{a.date}</td>
                                             <td className="p-5 font-mono text-blue-600 font-black">{a.times}</td>
                                             <td className="p-5 font-black text-center bg-gray-50/50">{calculateHours(t[0], t[t.length-1]).toFixed(1)}</td>
                                         </tr>
                                     )
                                 })}
                             </tbody>
                         </table>
                     </div>
                )}
                {subTab === 'message' && (
                    <div className="bg-gray-50/50 p-10 rounded-[45px] border shadow-inner space-y-6 animate-in fade-in">
                        <textarea className="w-full p-8 border rounded-[35px] outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" rows={6} placeholder="اكتب التنبيه الخاص لهذا الموظف..." value={msg} onChange={e=>setMsg(e.target.value)} />
                        <button onClick={async ()=>{ if(!msg)return; await supabase.from('messages').insert([{from_user:'admin', to_user:employee.employee_id, content:msg}]); alert('تم الإرسال'); setMsg(''); }} className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-black w-full flex justify-center gap-3 shadow-2xl hover:bg-blue-700 transition-all"><Send className="w-5 h-5"/> إرسال الآن</button>
                    </div>
                )}
            </div>
        </div>
    );
}

// 5. التقييمات والمسائي (تم استيرادها مسبقاً مع تحسين بسيط)
function EvaluationsTab({ employees }: { employees: Employee[] }) {
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [evalData, setEvalData] = useState({ employee_id: '', scores: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 }, notes: '' });
    const total = useMemo(() => Object.values(evalData.scores).reduce((a,b)=>Number(a)+Number(b), 0), [evalData.scores]);

    const handleSave = async () => {
        if(!evalData.employee_id) return alert('اختر الموظف أولاً');
        await supabase.from('evaluations').insert([{
            employee_id: evalData.employee_id, month, score_appearance: evalData.scores.s1, score_attendance: evalData.scores.s2, score_quality: evalData.scores.s3, score_infection: evalData.scores.s4, score_training: evalData.scores.s5, score_records: evalData.scores.s6, score_tasks: evalData.scores.s7, total_score: total, notes: evalData.notes
        }]);
        alert('تم حفظ التقييم الطبي');
        setEvalData({ employee_id: '', scores: {s1:0,s2:0,s3:0,s4:0,s5:0,s6:0,s7:0}, notes: '' });
    };

    return (
        <div className="space-y-8 animate-in fade-in">
            <h2 className="text-2xl font-black border-b pb-6 flex items-center gap-3"><Award className="w-8 h-8 text-purple-600"/> تقييم الأداء الطبي الشهري</h2>
            <div className="bg-gray-50/50 p-10 rounded-[45px] border shadow-inner space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Select label="اسم الموظف" options={employees.map(e=>({value:e.employee_id, label:e.name}))} value={evalData.employee_id} onChange={(v:any)=>setEvalData({...evalData, employee_id:v})} />
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
                <div className="bg-white p-8 rounded-[35px] border-2 border-purple-100 flex justify-between items-center shadow-2xl">
                    <div className="text-3xl font-black text-purple-600 tracking-tighter">الإجمالي: {total} / 100</div>
                    <button onClick={handleSave} className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all">اعتماد وحفظ التقييم</button>
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
        <div className="bg-white p-12 rounded-[55px] shadow-[0_30px_100px_rgba(0,0,0,0.1)] w-full max-w-md border border-gray-100 animate-in zoom-in duration-300">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-10 font-black hover:gap-3 transition-all"><ArrowRight className="ml-2 w-5 h-5" /> العودة للرئيسية</button>
          <div className="text-center mb-10">
            <div className="w-24 h-24 bg-blue-50 rounded-[40px] flex items-center justify-center mx-auto mb-6 border-2 border-blue-100 shadow-inner"><ShieldCheck className="w-12 h-12 text-blue-600" /></div>
            <h2 className="text-3xl font-black text-gray-800 tracking-tight">بوابة إدارة المنشأة</h2>
            <p className="text-xs text-gray-400 font-bold mt-2">يُرجى تسجيل الدخول للوصول للوحة التحكم</p>
          </div>
          <div className="space-y-6">
            <select className="w-full p-4 bg-gray-50 border border-gray-100 rounded-[25px] font-black focus:ring-4 focus:ring-blue-100 outline-none transition-all" onChange={(e) => setSelectedCenter(centers.find(c => c.id === e.target.value) || null)}>
              <option value="">-- اختر المركز الطبي --</option>
              {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}
            </select>
            <input type="password" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-[25px] text-center font-black focus:ring-4 focus:ring-blue-100 outline-none transition-all" placeholder="كلمة المرور الإدارية" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            <button onClick={() => { if(selectedCenter && adminPassword === selectedCenter.password) setIsAdminLoggedIn(true); else alert('كلمة المرور غير صحيحة'); }} className="w-full bg-blue-600 text-white py-5 rounded-[25px] font-black shadow-2xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all">دخول للوحة التحكم</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-10 text-right">
      <div className="flex justify-between items-center mb-12 bg-white p-10 rounded-[50px] shadow-sm border border-gray-50 no-print">
        <div className="flex items-center gap-6">
            <div className="p-5 bg-blue-50 rounded-[35px] border-2 border-blue-100 shadow-inner"><ShieldCheck className="w-12 h-12 text-blue-600"/></div>
            <div>
                <h1 className="text-3xl font-black text-gray-800 tracking-tighter">إدارة {selectedCenter?.center_name}</h1>
                <p className="text-gray-400 text-sm font-bold flex items-center gap-2 mt-1"><MapPin className="w-4 h-4 text-blue-400"/> {selectedCenter?.address}</p>
            </div>
        </div>
        <button onClick={() => setIsAdminLoggedIn(false)} className="bg-red-50 text-red-600 px-10 py-4 rounded-[30px] font-black flex items-center hover:bg-red-100 transition-all shadow-sm active:scale-95">تسجيل خروج آمن <LogOut className="ml-3 w-5 h-5"/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        <div className="lg:col-span-1 space-y-4 no-print bg-white p-6 rounded-[45px] border border-gray-100 shadow-sm h-fit">
          <SidebarBtn active={activeTab === 'settings'} icon={<Settings className="w-5 h-5"/>} label="إعدادات المنشأة" onClick={() => setActiveTab('settings')} />
          <SidebarBtn active={activeTab === 'doctors'} icon={<Users className="w-5 h-5"/>} label="شئون الموظفين" onClick={() => setActiveTab('doctors')} />
          <SidebarBtn active={activeTab === 'evaluations'} icon={<Award className="w-5 h-5"/>} label="التقييمات الطبية" onClick={() => setActiveTab('evaluations')} />
          <SidebarBtn active={activeTab === 'leaves'} icon={<FileText className="w-5 h-5"/>} label="طلبات الإجازات" onClick={() => setActiveTab('leaves')} />
          <SidebarBtn active={activeTab === 'attendance'} icon={<Clock className="w-5 h-5"/>} label="سجل البصمات" onClick={() => setActiveTab('attendance')} />
          <SidebarBtn active={activeTab === 'reports'} icon={<BarChart3 className="w-5 h-5"/>} label="التقارير الذكية" onClick={() => setActiveTab('reports')} />
          <SidebarBtn active={activeTab === 'alerts'} icon={<Bell className="w-5 h-5"/>} label="تنبيهات العاملين" onClick={() => setActiveTab('alerts')} />
        </div>
        <div className="lg:col-span-3 bg-white p-12 rounded-[60px] shadow-sm border border-gray-50 min-h-[700px] animate-in slide-in-from-left duration-500 relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-gray-50 rounded-full opacity-50"></div>
          {activeTab === 'settings' && selectedCenter && <GeneralSettingsTab center={selectedCenter} onRefresh={fetchCenters} />}
          {activeTab === 'doctors' && <DoctorsTab employees={employees} onRefresh={fetchEmployees} centerId={selectedCenter!.id} />}
          {activeTab === 'evaluations' && <EvaluationsTab employees={employees} />}
          {activeTab === 'reports' && <ReportsTab employees={employees} />}
          {activeTab === 'leaves' && <LeavesTab onRefresh={fetchEmployees} />}
          {activeTab === 'attendance' && <AttendanceTab employees={employees} onRefresh={fetchEmployees} />}
          {activeTab === 'alerts' && <AlertsTab employees={employees} />}
        </div>
      </div>
    </div>
  );
};

// --- المكونات المساعدة المستعادة ---

function LeavesTab({ onRefresh }: { onRefresh: () => void }) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const fetchLeaves = async () => {
    const { data } = await supabase.from('leave_requests').select(`*, employees(name)`).order('created_at', { ascending: false });
    if (data) setRequests(data.map((r:any) => ({ ...r, employee_name: r.employees?.name })));
  };
  useEffect(() => { fetchLeaves(); }, []);

  const handleAction = async (id: string, status: 'مقبول' | 'مرفوض') => {
    await supabase.from('leave_requests').update({ status }).eq('id', id);
    alert('تم تنفيذ الإجراء');
    fetchLeaves(); onRefresh();
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <h2 className="text-2xl font-black text-gray-800 border-b pb-6 flex items-center gap-3"><FileText className="text-blue-600 w-8 h-8"/> مراجعة طلبات الإجازات والمأموريات</h2>
      <div className="grid gap-5">
        {requests.map(req => (
          <div key={req.id} className="p-8 bg-gray-50/50 border border-gray-100 rounded-[35px] flex justify-between items-center group hover:bg-white hover:shadow-xl transition-all">
            <div>
                <p className="font-black text-xl text-gray-800">{req.employee_name}</p>
                <p className="text-blue-600 font-black text-sm">{req.type} <span className="text-gray-400 font-normal">من {req.start_date} إلى {req.end_date}</span></p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`px-5 py-2 rounded-2xl text-[10px] font-black shadow-sm ${req.status==='مقبول'?'bg-green-600 text-white':req.status==='مرفوض'?'bg-red-600 text-white':'bg-amber-500 text-white'}`}>{req.status}</span>
              {req.status === 'معلق' && (
                <div className="flex gap-2">
                  <button onClick={() => handleAction(req.id, 'مقبول')} className="bg-emerald-600 text-white p-3 rounded-2xl shadow-lg hover:bg-emerald-700 active:scale-90 transition-all"><CheckCircle className="w-5 h-5"/></button>
                  <button onClick={() => handleAction(req.id, 'مرفوض')} className="bg-red-600 text-white p-3 rounded-2xl shadow-lg hover:bg-red-700 active:scale-90 transition-all"><XCircle className="w-5 h-5"/></button>
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
  const [formData, setFormData] = useState<Partial<AttendanceRecord>>({ date: new Date().toISOString().split('T')[0], times: '' });
  const handleImport = async (data: any[]) => {
    const validIds = new Set(employees.map(e => e.employee_id));
    const processed = data.map(row => {
      const eid = String(row.employee_id || row['الكود'] || '');
      if (!validIds.has(eid)) return null;
      return { employee_id: eid, date: formatDateForDB(row.date || row['التاريخ']), times: String(row.times || row['البصمات'] || '').trim() };
    }).filter(r => r && r.employee_id && r.date);
    await supabase.from('attendance').insert(processed);
    alert('تم استيراد البصمات'); onRefresh();
  };
  return (
    <div className="space-y-10 animate-in fade-in">
      <div className="flex justify-between items-center border-b pb-6">
        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-3"><Clock className="text-blue-600 w-8 h-8"/> إدارة سجلات البصمات</h2>
        <ExcelUploadButton onData={handleImport} label="استيراد ملف البصمات" />
      </div>
      <div className="bg-gray-50/50 p-10 rounded-[45px] border shadow-inner grid grid-cols-1 md:grid-cols-2 gap-8">
        <Select label="اسم الموظف" options={employees.map(e => ({value: e.employee_id, label: e.name}))} value={formData.employee_id} onChange={(v:any)=>setFormData({...formData, employee_id: v})} />
        <Input label="تاريخ البصمة" type="date" value={formData.date} onChange={(v:any)=>setFormData({...formData, date: v})} />
        <div className="md:col-span-2"><Input label="سجل التوقيتات (مفصولة بمسافات)" value={formData.times} onChange={(v:any)=>setFormData({...formData, times: v})} placeholder="08:30 14:15 16:00" /></div>
        <button onClick={async () => { await supabase.from('attendance').insert([formData]); alert('تم الحفظ'); onRefresh(); }} className="md:col-span-2 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all active:scale-95">إضافة السجل يدوياً</button>
      </div>
    </div>
  );
}

function AlertsTab({ employees }: { employees: Employee[] }) {
    const [target, setTarget] = useState('all'); 
    const [msg, setMsg] = useState('');
    const [history, setHistory] = useState<InternalMessage[]>([]);
    const fetchHistory = async () => {
        const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(20);
        if (data) setHistory(data);
    };
    useEffect(() => { fetchHistory(); }, []);
    return (
        <div className="space-y-10 animate-in fade-in">
            <h2 className="text-2xl font-black border-b pb-6 flex items-center gap-3 text-gray-800"><Bell className="w-8 h-8 text-orange-500" /> مراسلة العاملين والتنبيهات</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="bg-gray-50/50 p-10 rounded-[45px] border shadow-inner space-y-6">
                    <Select label="المستهدف بالرسالة" options={[{value:'all', label:'إرسال للجميع'}, ...employees.map(e=>({value:e.employee_id, label:e.name}))]} value={target} onChange={setTarget} />
                    <textarea className="w-full p-6 bg-white border border-gray-100 rounded-[35px] outline-none focus:ring-4 focus:ring-orange-50 shadow-sm" rows={6} value={msg} onChange={e=>setMsg(e.target.value)} placeholder="اكتب نص التنبيه أو التعليمات الرسمية..." />
                    <button onClick={async ()=>{ if(!msg)return; await supabase.from('messages').insert([{from_user:'admin', to_user:target, content:msg}]); alert('تم بث الرسالة'); setMsg(''); fetchHistory(); }} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-2xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex justify-center items-center gap-3"><Send className="w-5 h-5"/> بث التنبيه الآن</button>
                </div>
                <div className="space-y-6">
                    <h3 className="font-black text-gray-700 flex items-center gap-2 pr-3 border-r-4 border-gray-200">سجل التنبيهات الأخيرة</h3>
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {history.map(m => (
                            <div key={m.id} className="p-6 bg-white border border-gray-100 rounded-[30px] shadow-sm hover:border-blue-100 transition-all">
                                <div className="flex justify-between text-[10px] text-gray-400 mb-2 font-black">
                                    <span>{m.to_user==='all'?'إعلان عام للجميع':`إلى الموظف: ${m.to_user}`}</span>
                                    <span>{new Date(m.created_at).toLocaleString('ar-EG')}</span>
                                </div>
                                <p className="text-sm text-gray-700 font-bold leading-relaxed">{m.content}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminDashboard;
