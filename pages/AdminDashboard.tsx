
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, Settings, Users, FileText, Calendar, 
  Clock, BarChart3, Mail, Bell, Plus, Upload, Trash2, CheckCircle, XCircle, 
  FileSpreadsheet, Info, Download, X, Send, LogOut, ShieldCheck, Eye, 
  Award, MessageCircle, User, Filter, Search, Edit3, Save, 
  ChevronDown, AlertTriangle, Printer, MapPin, Phone, Hash, 
  Briefcase, CalendarDays, PieChart, ArrowUpDown, TrendingUp, Layers, ListChecks, FileImage, Baby
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

// مساعدة لتحميل عينة إكسيل
const downloadSampleExcel = (type: 'staff' | 'attendance') => {
    let data = [];
    let filename = "";
    if (type === 'staff') {
        data = [{
            'الكود': '80',
            'الاسم': 'موظف عينة',
            'الرقم القومي': '29001011234567',
            'التخصص': 'تمريض',
            'تاريخ التعيين': '2023-01-01',
            'الجنس': 'أنثى',
            'الديانة': 'مسلم',
            'الدرجة': 'ثالثة'
        }];
        filename = "Staff_Sample_80.xlsx";
    } else {
        data = [{
            'الكود': '80',
            'التاريخ': new Date().toISOString().split('T')[0],
            'البصمات': '08:00 14:00'
        }];
        filename = "Attendance_Sample_80.xlsx";
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample");
    XLSX.writeFile(wb, filename);
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

function Checkbox({ label, checked, onChange }: any) {
    return (
      <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100 hover:bg-white transition-all cursor-pointer select-none" onClick={() => onChange(!checked)}>
        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${checked ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200'}`}>
          {checked && <CheckCircle className="w-4 h-4" />}
        </div>
        <span className="text-xs font-black text-gray-600 uppercase tracking-widest">{label}</span>
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

function ExcelUploadButton({ onData, label = "رفع إكسيل", onSample }: { onData: any, label?: string, onSample?: () => void }) {
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
    <div className="flex gap-2">
        {onSample && (
            <button onClick={onSample} title="تحميل ملف عينة" className="p-2.5 bg-gray-100 text-gray-600 rounded-2xl hover:bg-gray-200 transition-all border border-gray-200">
                <Download className="w-5 h-5" />
            </button>
        )}
        <label className="flex items-center bg-emerald-600 text-white px-5 py-2.5 rounded-2xl hover:bg-emerald-700 cursor-pointer font-black shadow-lg shadow-emerald-100 transition-all text-xs">
            <Upload className="w-4 h-4 ml-2" /> {label}
            <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFile} />
        </label>
    </div>
  );
}

const SidebarBtn = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-2xl transition-all font-black group ${active ? 'bg-blue-600 text-white shadow-xl translate-x-1' : 'bg-white text-gray-400 hover:bg-blue-50 hover:text-blue-600 border border-transparent'}`}>
    <span className={`ml-3 p-2 rounded-xl transition-colors ${active ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-white group-hover:text-blue-600'}`}>{icon}</span>
    {label}
  </button>
);

// --- الأقسام المحدثة ---

function GeneralSettingsTab({ center, onRefresh }: { center: GeneralSettings, onRefresh: () => void }) {
  const [settings, setSettings] = useState<GeneralSettings>({ 
    ...center, 
    holidays: center.holidays || [], 
    specialties: center.specialties || [], 
    leave_types: center.leave_types || [] 
  });

  const handleSave = async () => {
    const { error } = await supabase.from('general_settings').update(settings).eq('id', center.id);
    if (!error) { alert('تم حفظ الإعدادات المحدثة بنجاح'); onRefresh(); } else alert(error.message);
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
            <Input label="اسم المسؤول" value={settings.admin_name} onChange={(v:any)=>setSettings({...settings, admin_name: v})} />
            <Input label="رقم الهاتف" value={settings.phone} onChange={(v:any)=>setSettings({...settings, phone: v})} />
            <Input label="العنوان" value={settings.address} onChange={(v:any)=>setSettings({...settings, address: v})} />
            <Input label="رابط الموقع (Location)" value={settings.location_url} onChange={(v:any)=>setSettings({...settings, location_url: v})} />
            <Input label="كلمة مرور الإدارة" type="password" value={settings.password} onChange={(v:any)=>setSettings({...settings, password: v})} />
        </div>

        <div className="space-y-6 bg-gray-50/50 p-6 rounded-[35px] border border-gray-100">
            <h3 className="font-black text-indigo-600 border-r-4 border-indigo-600 pr-3">مواعيد الشفتات الرسمية</h3>
            <div className="grid grid-cols-2 gap-4">
                <Input label="بداية الصباحي" type="time" value={settings.shift_morning_in} onChange={(v:any)=>setSettings({...settings, shift_morning_in: v})} />
                <Input label="نهاية الصباحي" type="time" value={settings.shift_morning_out} onChange={(v:any)=>setSettings({...settings, shift_morning_out: v})} />
                <Input label="بداية المسائي" type="time" value={settings.shift_evening_in} onChange={(v:any)=>setSettings({...settings, shift_evening_in: v})} />
                <Input label="نهاية المسائي" type="time" value={settings.shift_evening_out} onChange={(v:any)=>setSettings({...settings, shift_evening_out: v})} />
                <Input label="بداية السهر (Night)" type="time" value={settings.shift_night_in} onChange={(v:any)=>setSettings({...settings, shift_night_in: v})} />
                <Input label="نهاية السهر (Night)" type="time" value={settings.shift_night_out} onChange={(v:any)=>setSettings({...settings, shift_night_out: v})} />
            </div>
        </div>

        <div className="space-y-6 bg-gray-50/50 p-6 rounded-[35px] border border-gray-100">
            <h3 className="font-black text-emerald-600 border-r-4 border-emerald-600 pr-3">إدارة القوائم</h3>
            <div className="space-y-4">
                <label className="block text-[10px] font-black text-gray-400">قائمة التخصصات (مفصولة بفاصلة)</label>
                <textarea className="w-full p-4 border rounded-2xl h-24 text-sm font-bold bg-white" value={settings.specialties.join(', ')} onChange={e=>setSettings({...settings, specialties: e.target.value.split(',').map(s=>s.trim())})} />
                <label className="block text-[10px] font-black text-gray-400">أنواع الطلبات/الإجازات (مفصولة بفاصلة)</label>
                <textarea className="w-full p-4 border rounded-2xl h-24 text-sm font-bold bg-white" value={settings.leave_types.join(', ')} onChange={e=>setSettings({...settings, leave_types: e.target.value.split(',').map(s=>s.trim())})} />
            </div>
        </div>
      </div>
    </div>
  );
}

function DoctorsTab({ employees, onRefresh, centerId }: { employees: Employee[], onRefresh: () => void, centerId: string }) {
  const [selectedStaff, setSelectedStaff] = useState<Employee | null>(null);
  const [fName, setFName] = useState('');
  const [fId, setFId] = useState('');
  const [fSpec, setFSpec] = useState('all');

  const filtered = employees.filter(e => e.name.includes(fName) && e.employee_id.includes(fId) && (fSpec === 'all' || e.specialty === fSpec));

  if (selectedStaff) return <EmployeeDetailView employee={selectedStaff} onBack={()=>setSelectedStaff(null)} onRefresh={onRefresh} />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-6 gap-4">
        <h2 className="text-2xl font-black flex items-center gap-3 text-gray-800"><Users className="w-8 h-8 text-blue-600"/> شئون الموظفين والعاملين</h2>
        <div className="flex gap-3">
            <ExcelUploadButton 
                onSample={() => downloadSampleExcel('staff')}
                onData={async (data: any[]) => {
                    const formatted = data.map(row => ({
                        employee_id: String(row.employee_id || row['الكود'] || ''),
                        name: String(row.name || row['الاسم'] || ''),
                        national_id: String(row.national_id || row['الرقم القومي'] || ''),
                        specialty: String(row.specialty || row['التخصص'] || ''),
                        gender: row['الجنس'] || 'ذكر',
                        religion: row['الديانة'] || 'مسلم',
                        grade: row['الدرجة'] || 'ثالثة',
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50/50 p-6 rounded-[35px] border border-gray-100 shadow-inner">
          <Input label="بحث بالاسم" value={fName} onChange={setFName} />
          <Input label="بحث بالكود" value={fId} onChange={setFId} />
          <Select label="التخصص" options={['all', ...Array.from(new Set(employees.map(e=>e.specialty)))]} value={fSpec} onChange={setFSpec} />
      </div>
      
      <div className="overflow-x-auto border rounded-[40px] bg-white shadow-xl shadow-gray-100">
          <table className="w-full text-sm text-right">
              <thead className="bg-gray-100 font-black border-b text-gray-500">
                  <tr>
                      <th className="p-5">الكود</th>
                      <th className="p-5">الاسم</th>
                      <th className="p-5">التخصص</th>
                      <th className="p-5">الحالة</th>
                      <th className="p-5">مرضعة</th>
                      <th className="p-5 text-center">الإجراءات</th>
                  </tr>
              </thead>
              <tbody>
                  {filtered.map(emp => (
                      <tr key={emp.id} className="border-b hover:bg-blue-50/50 transition-all">
                          <td className="p-5 font-mono font-black text-blue-600">{emp.employee_id}</td>
                          <td className="p-5 font-black text-gray-800">{emp.name}</td>
                          <td className="p-5 text-xs font-bold text-gray-400">{emp.specialty}</td>
                          <td className="p-5">
                              <span className={`px-4 py-1.5 rounded-2xl text-[10px] font-black ${emp.status==='نشط'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{emp.status}</span>
                          </td>
                          <td className="p-5">
                             {emp.maternity && <Baby className="w-5 h-5 text-pink-500" title="أم مرضعة" />}
                          </td>
                          <td className="p-5 text-center">
                              <button onClick={()=>setSelectedStaff(emp)} className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all"><Eye className="w-5 h-5"/></button>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>
    </div>
  );
}

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

    const handleSave = async () => {
        const { error } = await supabase.from('employees').update(editData).eq('id', employee.id);
        if(!error) { alert('تم التحديث بنجاح'); onRefresh(); } else alert(error.message);
    };

    return (
        <div className="space-y-8 animate-in slide-in-from-left duration-300">
            <button onClick={onBack} className="flex items-center text-blue-600 font-black mb-4 hover:gap-3 transition-all"><ArrowRight className="ml-2 w-5 h-5"/> العودة لجدول الموظفين</button>
            
            <div className="flex bg-white p-10 rounded-[50px] border shadow-2xl items-center gap-8 relative overflow-hidden">
                <div className="w-32 h-32 bg-gray-50 rounded-[40px] border-4 border-white shadow-xl flex items-center justify-center overflow-hidden z-10">
                    {employee.photo_url ? <img src={employee.photo_url} className="w-full h-full object-cover" /> : <User className="text-blue-100 w-16 h-16"/>}
                </div>
                <div className="z-10">
                    <h2 className="text-4xl font-black text-gray-800 mb-1">{employee.name} {employee.maternity && <span className="text-sm bg-pink-100 text-pink-600 px-3 py-1 rounded-full">(أم مرضعة)</span>}</h2>
                    <p className="text-blue-600 font-black text-xl">{employee.specialty} • {employee.employee_id}</p>
                </div>
            </div>

            <div className="flex bg-gray-100/50 p-2 rounded-[25px] border no-print overflow-x-auto gap-2">
                {['data', 'attendance', 'requests', 'docs', 'message'].map(t => (
                  <button key={t} onClick={()=>setSubTab(t as any)} className={`px-6 py-3.5 rounded-2xl text-xs font-black transition-all ${subTab===t?'bg-blue-600 text-white shadow-xl':'text-gray-400 hover:bg-white'}`}>
                    {t === 'data' ? 'البيانات' : t === 'attendance' ? 'الحضور' : t === 'requests' ? 'الإجازات' : t === 'docs' ? 'المستندات' : 'تنبيه'}
                  </button>
                ))}
            </div>

            <div className="min-h-[550px] bg-white p-10 rounded-[50px] border border-gray-100 shadow-sm">
                {subTab === 'data' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <Input label="الاسم الكامل" value={editData.name} onChange={(v:any)=>setEditData({...editData, name: v})} />
                        <Input label="الرقم القومي" value={editData.national_id} onChange={(v:any)=>setEditData({...editData, national_id: v})} />
                        <Input label="التخصص" value={editData.specialty} onChange={(v:any)=>setEditData({...editData, specialty: v})} />
                        <Input label="رقم الهاتف" value={editData.phone} onChange={(v:any)=>setEditData({...editData, phone: v})} />
                        <Input label="البريد الإلكتروني" value={editData.email} onChange={(v:any)=>setEditData({...editData, email: v})} />
                        <Select label="الجنس" options={['ذكر', 'أنثى']} value={editData.gender} onChange={(v:any)=>setEditData({...editData, gender: v})} />
                        <Input label="الديانة" value={editData.religion} onChange={(v:any)=>setEditData({...editData, religion: v})} />
                        <Input label="الدرجة الوظيفية" value={editData.grade} onChange={(v:any)=>setEditData({...editData, grade: v})} />
                        <Input label="تاريخ التعيين" type="date" value={editData.join_date} onChange={(v:any)=>setEditData({...editData, join_date: v})} />
                        <Input label="ساعات العمل" value={editData.admin_tasks} onChange={(v:any)=>setEditData({...editData, admin_tasks: v})} />
                        <Input label="موعد الحضور" type="time" value={editData.start_time} onChange={(v:any)=>setEditData({...editData, start_time: v})} />
                        <Input label="موعد الانصراف" type="time" value={editData.end_time} onChange={(v:any)=>setEditData({...editData, end_time: v})} />
                        <div className="md:col-span-1 py-4">
                            <Checkbox label="حالة الأم المرضعة (لديها طفل < 2 سنة)" checked={editData.maternity} onChange={(v:any)=>setEditData({...editData, maternity: v})} />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-[10px] font-black text-gray-400 mb-1">الدورات التدريبية</label>
                            <textarea className="w-full p-4 border rounded-2xl bg-gray-50 text-sm font-bold" rows={2} value={editData.training_courses} onChange={e=>setEditData({...editData, training_courses: e.target.value})} />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-[10px] font-black text-gray-400 mb-1">ملاحظات</label>
                            <textarea className="w-full p-4 border rounded-2xl bg-gray-50 text-sm font-bold" rows={2} value={editData.notes} onChange={e=>setEditData({...editData, notes: e.target.value})} />
                        </div>
                        <div className="md:col-span-3 flex justify-end">
                            <button onClick={handleSave} className="bg-emerald-600 text-white px-12 py-3 rounded-2xl font-black shadow-xl hover:bg-emerald-700">تحديث البيانات</button>
                        </div>
                    </div>
                )}
                {subTab === 'attendance' && (
                     <div className="overflow-x-auto border rounded-[35px] bg-white">
                         <table className="w-full text-sm text-right">
                             <thead className="bg-gray-50 border-b font-black">
                                 <tr><th className="p-5">التاريخ</th><th className="p-5">البصمات</th><th className="p-5">ساعات العمل</th></tr>
                             </thead>
                             <tbody>
                                 {staffAttendance.sort((a,b)=>b.date.localeCompare(a.date)).map(a => {
                                     const t = a.times.split(/\s+/).filter(x=>x.includes(':'));
                                     return (
                                         <tr key={a.id} className="border-b">
                                             <td className="p-5 font-bold">{a.date}</td>
                                             <td className="p-5 font-mono text-blue-600 font-black">{a.times}</td>
                                             <td className="p-5 font-black">{calculateHours(t[0], t[t.length-1]).toFixed(1)} س</td>
                                         </tr>
                                     )
                                 })}
                             </tbody>
                         </table>
                     </div>
                )}
                {subTab === 'docs' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-4">
                            <h4 className="font-black text-gray-700">صورة الهوية (الوجه)</h4>
                            <div className="h-64 bg-gray-50 border-2 border-dashed rounded-3xl flex items-center justify-center overflow-hidden">
                                {employee.id_front_url ? <img src={employee.id_front_url} className="w-full h-full object-contain" /> : <FileImage className="w-12 h-12 text-gray-200" />}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h4 className="font-black text-gray-700">صورة الهوية (الظهر)</h4>
                            <div className="h-64 bg-gray-50 border-2 border-dashed rounded-3xl flex items-center justify-center overflow-hidden">
                                {employee.id_back_url ? <img src={employee.id_back_url} className="w-full h-full object-contain" /> : <FileImage className="w-12 h-12 text-gray-200" />}
                            </div>
                        </div>
                    </div>
                )}
                {subTab === 'message' && (
                    <div className="space-y-6">
                        <textarea className="w-full p-8 border rounded-[35px] outline-none" rows={6} placeholder="اكتب رسالة لهذا الموظف..." value={msg} onChange={e=>setMsg(e.target.value)} />
                        <button onClick={async ()=>{ await supabase.from('messages').insert([{from_user:'admin', to_user:employee.employee_id, content:msg}]); alert('تم الإرسال'); setMsg(''); }} className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-black w-full shadow-xl">إرسال التنبيه</button>
                    </div>
                )}
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
        <ExcelUploadButton onSample={() => downloadSampleExcel('attendance')} onData={handleImport} label="استيراد ملف البصمات" />
      </div>
      <div className="bg-gray-50/50 p-10 rounded-[45px] border shadow-inner grid grid-cols-1 md:grid-cols-2 gap-8">
        <Select label="اسم الموظف" options={employees.map(e => ({value: e.employee_id, label: e.name}))} value={formData.employee_id} onChange={(v:any)=>setFormData({...formData, employee_id: v})} />
        <Input label="تاريخ البصمة" type="date" value={formData.date} onChange={(v:any)=>setFormData({...formData, date: v})} />
        <div className="md:col-span-2"><Input label="سجل التوقيتات (مفصولة بمسافات)" value={formData.times} onChange={(v:any)=>setFormData({...formData, times: v})} placeholder="08:30 14:15 16:00" /></div>
        <button onClick={async () => { await supabase.from('attendance').insert([formData]); alert('تم الحفظ'); onRefresh(); }} className="md:col-span-2 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all">إضافة السجل يدوياً</button>
      </div>
    </div>
  );
}

function ReportsTab({ employees }: { employees: Employee[] }) {
  const [type, setType] = useState<'daily' | 'latecomers' | 'critical_leaves'>('daily');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attData, setAttData] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    supabase.from('attendance').select('*').then(({data}) => data && setAttData(data));
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex justify-between items-center border-b pb-6 no-print">
        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-3"><BarChart3 className="w-8 h-8 text-emerald-600"/> التقارير الذكية</h2>
        <div className="flex bg-gray-100 p-1 rounded-2xl">
            {['daily', 'latecomers', 'critical_leaves'].map(t => (
                <button key={t} onClick={()=>setType(t as any)} className={`px-5 py-2 rounded-xl text-xs font-black ${type===t?'bg-white text-emerald-600 shadow-sm':'text-gray-400'}`}>
                    {t === 'daily' ? 'يومي' : t === 'latecomers' ? 'المتأخرين' : 'رصيد حرج'}
                </button>
            ))}
        </div>
      </div>
      <div className="bg-white p-6 rounded-[35px] border no-print flex justify-between items-end gap-6">
         <Input label="اختر التاريخ" type="date" value={date} onChange={setDate} />
         <button onClick={()=>window.print()} className="bg-gray-800 text-white px-8 py-3 rounded-2xl font-black flex gap-2 shadow-xl hover:bg-black transition-all"><Printer className="w-5 h-5"/> طباعة التقرير</button>
      </div>
      <div className="overflow-x-auto border rounded-[45px] bg-white shadow-xl">
        <table className="w-full text-sm text-right">
            <thead className="bg-gray-100 font-black border-b">
                <tr><th className="p-5">الكود</th><th className="p-5">الاسم</th><th className="p-5">الحضور</th><th className="p-5">الانصراف</th><th className="p-5">مرضعة</th></tr>
            </thead>
            <tbody>
                {employees.map(emp => {
                    const att = attData.find(a => a.employee_id === emp.employee_id && a.date === date);
                    const t = att?.times.split(/\s+/).filter(x=>x.includes(':')) || [];
                    return (
                        <tr key={emp.id} className="border-b">
                            <td className="p-5 font-mono font-black text-blue-600">{emp.employee_id}</td>
                            <td className="p-5 font-black text-gray-800">{emp.name}</td>
                            <td className="p-5 text-emerald-600 font-black">{t[0] || '--'}</td>
                            <td className="p-5 text-red-500 font-black">{t[t.length-1] || '--'}</td>
                            <td className="p-5">{emp.maternity ? 'نعم' : 'لا'}</td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
      </div>
    </div>
  );
}

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
      <h2 className="text-2xl font-black text-gray-800 border-b pb-6 flex items-center gap-3"><FileText className="text-blue-600 w-8 h-8"/> طلبات الإجازات</h2>
      <div className="grid gap-5">
        {requests.map(req => (
          <div key={req.id} className="p-6 bg-gray-50/50 border rounded-[30px] flex justify-between items-center group hover:bg-white hover:shadow-xl">
            <div>
                <p className="font-black text-lg text-gray-800">{req.employee_name}</p>
                <p className="text-blue-600 font-black text-xs">{req.type} | {req.start_date} إلى {req.end_date}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-4 py-1.5 rounded-2xl text-[10px] font-black ${req.status==='مقبول'?'bg-green-600 text-white':req.status==='مرفوض'?'bg-red-600 text-white':'bg-amber-500 text-white'}`}>{req.status}</span>
              {req.status === 'معلق' && (
                <div className="flex gap-2">
                  <button onClick={() => handleAction(req.id, 'مقبول')} className="bg-emerald-600 text-white p-2 rounded-xl"><CheckCircle className="w-5 h-5"/></button>
                  <button onClick={() => handleAction(req.id, 'مرفوض')} className="bg-red-600 text-white p-2 rounded-xl"><XCircle className="w-5 h-5"/></button>
                </div>
              )}
            </div>
          </div>
        ))}
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
            <h2 className="text-2xl font-black border-b pb-6 flex items-center gap-3 text-gray-800"><Bell className="w-8 h-8 text-orange-500" /> التنبيهات</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="bg-gray-50/50 p-10 rounded-[45px] border shadow-inner space-y-6">
                    <Select label="المستهدف" options={[{value:'all', label:'الجميع'}, ...employees.map(e=>({value:e.employee_id, label:e.name}))]} value={target} onChange={setTarget} />
                    <textarea className="w-full p-6 bg-white border rounded-[35px] outline-none" rows={6} value={msg} onChange={e=>setMsg(e.target.value)} placeholder="اكتب نص التنبيه..." />
                    <button onClick={async ()=>{ await supabase.from('messages').insert([{from_user:'admin', to_user:target, content:msg}]); alert('تم الإرسال'); setMsg(''); fetchHistory(); }} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700">إرسال التنبيه</button>
                </div>
                <div className="space-y-6">
                    <h3 className="font-black text-gray-700 pr-3 border-r-4 border-gray-200">الأرشيف</h3>
                    <div className="space-y-4 max-h-[500px] overflow-y-auto">
                        {history.map(m => (
                            <div key={m.id} className="p-6 bg-white border rounded-[30px] shadow-sm">
                                <div className="flex justify-between text-[10px] text-gray-400 mb-2 font-black">
                                    <span>{m.to_user==='all'?'للجميع':`إلى: ${m.to_user}`}</span>
                                    <span>{new Date(m.created_at).toLocaleString('ar-EG')}</span>
                                </div>
                                <p className="text-sm text-gray-700 font-bold">{m.content}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

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
        <div className="bg-white p-12 rounded-[55px] shadow-2xl w-full max-w-md border animate-in zoom-in">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-10 font-black"><ArrowRight className="ml-2 w-5 h-5" /> العودة للرئيسية</button>
          <div className="text-center mb-10">
            <ShieldCheck className="w-16 h-16 text-blue-600 mx-auto mb-6" />
            <h2 className="text-3xl font-black">بوابة الإدارة</h2>
          </div>
          <div className="space-y-6">
            <select className="w-full p-4 bg-gray-50 border rounded-[25px] font-black" onChange={(e) => setSelectedCenter(centers.find(c => c.id === e.target.value) || null)}>
              <option value="">-- اختر المركز الطبي --</option>
              {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}
            </select>
            <input type="password" className="w-full p-4 bg-gray-50 border rounded-[25px] text-center font-black" placeholder="كلمة المرور" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            <button onClick={() => { if(selectedCenter && adminPassword === selectedCenter.password) setIsAdminLoggedIn(true); else alert('كلمة المرور غير صحيحة'); }} className="w-full bg-blue-600 text-white py-5 rounded-[25px] font-black shadow-xl">دخول</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-10 text-right">
      <div className="flex justify-between items-center mb-12 bg-white p-10 rounded-[50px] shadow-sm no-print">
        <div className="flex items-center gap-6">
            <ShieldCheck className="w-12 h-12 text-blue-600"/>
            <div>
                <h1 className="text-3xl font-black tracking-tighter">إدارة {selectedCenter?.center_name}</h1>
                <p className="text-gray-400 text-sm font-bold flex items-center gap-2 mt-1"><MapPin className="w-4 h-4"/> {selectedCenter?.address}</p>
            </div>
        </div>
        <button onClick={() => setIsAdminLoggedIn(false)} className="bg-red-50 text-red-600 px-10 py-4 rounded-[30px] font-black flex items-center"><LogOut className="ml-3 w-5 h-5"/> تسجيل خروج</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        <div className="lg:col-span-1 space-y-4 no-print bg-white p-6 rounded-[45px] border shadow-sm h-fit">
          <SidebarBtn active={activeTab === 'settings'} icon={<Settings className="w-5 h-5"/>} label="الإعدادات" onClick={() => setActiveTab('settings')} />
          <SidebarBtn active={activeTab === 'doctors'} icon={<Users className="w-5 h-5"/>} label="الموظفين" onClick={() => setActiveTab('doctors')} />
          <SidebarBtn active={activeTab === 'leaves'} icon={<FileText className="w-5 h-5"/>} label="الإجازات" onClick={() => setActiveTab('leaves')} />
          <SidebarBtn active={activeTab === 'attendance'} icon={<Clock className="w-5 h-5"/>} label="البصمات" onClick={() => setActiveTab('attendance')} />
          <SidebarBtn active={activeTab === 'reports'} icon={<BarChart3 className="w-5 h-5"/>} label="التقارير" onClick={() => setActiveTab('reports')} />
          <SidebarBtn active={activeTab === 'alerts'} icon={<Bell className="w-5 h-5"/>} label="التنبيهات" onClick={() => setActiveTab('alerts')} />
        </div>
        <div className="lg:col-span-3 bg-white p-12 rounded-[60px] shadow-sm border min-h-[700px]">
          {activeTab === 'settings' && selectedCenter && <GeneralSettingsTab center={selectedCenter} onRefresh={fetchCenters} />}
          {activeTab === 'doctors' && <DoctorsTab employees={employees} onRefresh={fetchEmployees} centerId={selectedCenter!.id} />}
          {activeTab === 'reports' && <ReportsTab employees={employees} />}
          {activeTab === 'leaves' && <LeavesTab onRefresh={fetchEmployees} />}
          {activeTab === 'attendance' && <AttendanceTab employees={employees} onRefresh={fetchEmployees} />}
          {activeTab === 'alerts' && <AlertsTab employees={employees} />}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
