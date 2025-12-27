import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, Settings, Users, FileText, Calendar, 
  Clock, BarChart3, Mail, Bell, Plus, Upload, Trash2, CheckCircle, XCircle, FileSpreadsheet, Info, Download, X, Send, LogOut, ShieldCheck, Eye, Award, MessageCircle, User, Filter, CheckSquare, Square, MailCheck, Search, List, Edit3, Save, ChevronDown, AlertTriangle, Printer, MapPin, Phone, Hash, Briefcase, CalendarDays, PieChart, ArrowUpDown, Stethoscope
} from 'lucide-react';
import { GeneralSettings, Employee, LeaveRequest, AttendanceRecord, InternalMessage, Evaluation, EveningSchedule } from '../types';
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

// دالة تحميل العينات
const downloadSample = (type: string) => {
    let data = [];
    let filename = "";
    if (type === 'staff') {
        data = [{ 'employee_id': '101', 'name': 'أحمد محمد', 'national_id': '29001011234567', 'specialty': 'طبيب', 'join_date': '2023-01-01' }];
        filename = "Sample_Staff.xlsx";
    } else if (type === 'attendance') {
        data = [{ 'employee_id': '101', 'date': '2024-05-01', 'times': '08:00 14:00' }];
        filename = "Sample_Attendance.xlsx";
    } else if (type === 'evening_schedule') {
        data = [{ 'date': '2024-05-20', 'doctors': 'أحمد محمد, سارة علي, محمود حسن', 'notes': 'نوبتجية الطوارئ' }];
        filename = "Sample_Evening_Schedule.xlsx";
    } else if (type === 'leave_requests') {
        data = [{ 'employee_id': '101', 'type': 'اجازة اعتيادية', 'start_date': '2024-06-01', 'end_date': '2024-06-05', 'notes': 'عينة استيراد' }];
        filename = "Sample_Leave_Requests.xlsx";
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
      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input 
        type={type} 
        value={value || ''} 
        onChange={e => onChange(e.target.value)} 
        max={max}
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
  const handleSave = async () => {
    const { error } = await supabase.from('general_settings').update(settings).eq('id', center.id);
    if (!error) { alert('تم حفظ كافة الإعدادات بنجاح'); onRefresh(); } else alert(error.message);
  };

  return (
    <div className="space-y-8">
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
        if (!error) { alert('تم تحديث البيانات'); onRefresh(); }
    };

    return (
        <div className="space-y-6">
            <button onClick={onBack} className="flex items-center text-blue-600 font-bold mb-4"><ArrowRight className="ml-2 w-4 h-4"/> عودة للقائمة</button>
            <div className="flex bg-gray-50 p-6 rounded-3xl border items-center gap-6">
                <div className="w-20 h-20 bg-white rounded-2xl border flex items-center justify-center overflow-hidden">
                    {employee.photo_url ? <img src={employee.photo_url} alt="Profile" className="w-full h-full object-cover" /> : <User className="text-blue-100 w-10 h-10"/>}
                </div>
                <div>
                    <h2 className="text-2xl font-black">{employee.name}</h2>
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
                        <Select label="الحالة" options={['نشط', 'موقوف', 'إجازة']} value={editData.status} onChange={(v:any)=>setEditData({...editData, status: v})} />
                        <div className="md:col-span-3 flex justify-end mt-4"><button onClick={handleUpdate} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black shadow-lg">حفظ التعديلات</button></div>
                    </div>
                )}
                {subTab === 'stats' && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 no-print">
                            <label className="text-xs font-black text-gray-400">إحصائيات شهر:</label>
                            <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="p-2 border rounded-xl" />
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="p-6 bg-blue-600 text-white rounded-[30px] shadow-lg shadow-blue-100">
                                <p className="text-[10px] font-black opacity-80 uppercase mb-1">أيام الحضور</p>
                                <h4 className="text-3xl font-black">{stats.presence}</h4>
                            </div>
                            <div className="p-6 bg-emerald-600 text-white rounded-[30px] shadow-lg shadow-emerald-100">
                                <p className="text-[10px] font-black opacity-80 uppercase mb-1">ساعات العمل</p>
                                <h4 className="text-3xl font-black">{stats.hours}</h4>
                            </div>
                            <div className="p-6 bg-red-600 text-white rounded-[30px] shadow-lg shadow-red-100">
                                <p className="text-[10px] font-black opacity-80 uppercase mb-1">أيام الغياب</p>
                                <h4 className="text-3xl font-black">{stats.absent}</h4>
                            </div>
                            <div className="p-6 bg-amber-600 text-white rounded-[30px] shadow-lg shadow-amber-100">
                                <p className="text-[10px] font-black opacity-80 uppercase mb-1">إجمالي الإجازات</p>
                                <h4 className="text-3xl font-black">{stats.leaves}</h4>
                            </div>
                        </div>
                    </div>
                )}
                {subTab === 'message' && (
                    <div className="bg-gray-50 p-6 rounded-3xl border space-y-4">
                        <textarea className="w-full p-4 border rounded-2xl outline-none" rows={4} placeholder="اكتب رسالة للموظف..." value={msg} onChange={e=>setMsg(e.target.value)} />
                        <button onClick={async ()=>{ await supabase.from('messages').insert([{from_user:'admin', to_user:employee.employee_id, content:msg}]); alert('تم الإرسال'); setMsg(''); }} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black w-full flex justify-center gap-2"><Send className="w-4 h-4"/> إرسال الآن</button>
                    </div>
                )}
                {subTab === 'attendance' && (
                     <div className="overflow-x-auto border rounded-2xl bg-white shadow-sm">
                         <table className="w-full text-sm text-right">
                             <thead className="bg-gray-50 border-b">
                                 <tr><th className="p-4">التاريخ</th><th className="p-4">البصمات</th><th className="p-4">ساعات اليوم</th></tr>
                             </thead>
                             <tbody>
                                 {staffAttendance.filter(a => a.date.startsWith(selectedMonth)).map(a => {
                                     const t = a.times.split(/\s+/).filter(x=>x.includes(':'));
                                     return (
                                         <tr key={a.id} className="border-b">
                                             <td className="p-4 font-bold">{a.date}</td>
                                             <td className="p-4 font-mono">{a.times}</td>
                                             <td className="p-4 font-black">{calculateHours(t[0], t[t.length-1]).toFixed(1)}</td>
                                         </tr>
                                     )
                                 })}
                             </tbody>
                         </table>
                     </div>
                )}
                {subTab === 'requests' && (
                     <div className="grid gap-4">
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
            </div>
        </div>
    );
}

// --- شئون الموظفين (جدول وفلاتر) ---
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

  if (selectedStaff) return <EmployeeDetailView employee={selectedStaff} onBack={()=>setSelectedStaff(null)} onRefresh={onRefresh} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800"><Users className="w-7 h-7 text-blue-600"/> شئون الموظفين</h2>
        <div className="flex gap-2">
            <button onClick={()=>downloadSample('staff')} className="text-gray-400 p-2 hover:text-blue-600 transition-colors" title="تحميل ملف عينة"><Download className="w-5 h-5"/></button>
            <ExcelUploadButton onData={async (data: any[]) => {
                const { data: existing } = await supabase.from('employees').select('id, employee_id, name, national_id, specialty, join_date');
                // Cast Map to any to resolve unknown typing from undefined existing query result
                const existingMap = new Map<string, any>(existing?.map(e => [String(e.employee_id), e]) || []);

                let inserted = 0;
                let updated = 0;

                for (const row of data) {
                    const eid = String(row.employee_id || row['الكود'] || '');
                    if (!eid) continue;

                    const payload = {
                        employee_id: eid,
                        name: String(row.name || row['الاسم'] || ''),
                        national_id: String(row.national_id || row['الرقم القومي'] || ''),
                        specialty: String(row.specialty || row['التخصص'] || ''),
                        join_date: formatDateForDB(row.join_date || row['تاريخ التعيين']),
                        center_id: centerId,
                        status: 'نشط'
                    };

                    if (existingMap.has(eid)) {
                        // Cast existingObj to any to fix Property 'name'/'specialty'/'id' does not exist on type 'unknown'
                        const existingObj = existingMap.get(eid) as any;
                        // مقارنة بسيطة للتحديث
                        if (existingObj.name !== payload.name || existingObj.specialty !== payload.specialty) {
                            await supabase.from('employees').update(payload).eq('id', existingObj.id);
                            updated++;
                        }
                    } else {
                        await supabase.from('employees').insert([payload]);
                        inserted++;
                    }
                }
                alert(`تقرير الاستيراد:\nتم رفع جديد: ${inserted}\nتم تحديث موجود: ${updated}`);
                onRefresh();
            }} label="استيراد موظفين" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-3xl border border-gray-100 shadow-inner">
          <Input label="بحث بالاسم" value={fName} onChange={setFName} placeholder="اسم الموظف..." />
          <Input label="بحث بالكود" value={fId} onChange={setFId} placeholder="كود الموظف..." />
          <Select label="التخصص" options={['all', ...Array.from(new Set(employees.map(e=>e.specialty)))]} value={fSpec} onChange={setFSpec} />
          <Select label="الحالة" options={['all', 'نشط', 'موقوف', 'إجازة']} value={fStatus} onChange={setFStatus} />
      </div>
      
      <div className="overflow-x-auto border rounded-[30px] bg-white shadow-sm">
          <table className="w-full text-sm text-right">
              <thead className="bg-gray-100 font-black border-b">
                  <tr><th className="p-4">الكود</th><th className="p-4">الاسم</th><th className="p-4">التخصص</th><th className="p-4">الحالة</th><th className="p-4">الإجراءات</th></tr>
              </thead>
              <tbody>
                  {filtered.map(emp => (
                      <tr key={emp.id} className="border-b hover:bg-blue-50/50 transition-all group">
                          <td className="p-4 font-mono font-bold text-blue-600">{emp.employee_id}</td>
                          <td className="p-4 font-black">{emp.name}</td>
                          <td className="p-4 text-xs font-bold text-gray-500">{emp.specialty}</td>
                          <td className="p-4"><span className={`px-3 py-1 rounded-lg text-[10px] font-black ${emp.status==='نشط'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{emp.status}</span></td>
                          <td className="p-4"><button onClick={()=>setSelectedStaff(emp)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Eye className="w-4 h-4"/></button></td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>
    </div>
  );
}

// --- نظام التقييمات ---
function EvaluationsTab({ employees }: { employees: Employee[] }) {
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [evalData, setEvalData] = useState({ employee_id: '', scores: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 }, notes: '' });
    const total = useMemo(() => Object.values(evalData.scores).reduce((a,b)=>Number(a)+Number(b), 0), [evalData.scores]);

    const handleSave = async () => {
        if(!evalData.employee_id) return alert('برجاء اختيار موظف');
        // Manual Upsert check for evaluations
        const { data: existing } = await supabase.from('evaluations').select('id').eq('employee_id', evalData.employee_id).eq('month', month).maybeSingle();
        
        const payload = {
            employee_id: evalData.employee_id, month, score_appearance: evalData.scores.s1, score_attendance: evalData.scores.s2, score_quality: evalData.scores.s3, score_infection: evalData.scores.s4, score_training: evalData.scores.s5, score_records: evalData.scores.s6, score_tasks: evalData.scores.s7, total_score: total, notes: evalData.notes
        };

        if (existing) {
            await supabase.from('evaluations').update(payload).eq('id', existing.id);
            alert('تم تحديث التقييم بنجاح');
        } else {
            await supabase.from('evaluations').insert([payload]);
            alert('تم إضافة التقييم بنجاح');
        }
        setEvalData({ employee_id: '', scores: {s1:0,s2:0,s3:0,s4:0,s5:0,s6:0,s7:0}, notes: '' });
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center border-b pb-4">
                <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800"><Award className="w-7 h-7 text-purple-600"/> التقييمات الطبية (100 درجة)</h2>
            </div>
            <div className="bg-gray-50 p-8 rounded-[40px] border shadow-inner space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Select label="اختر الموظف" options={employees.map(e=>({value:e.employee_id, label:e.name}))} value={evalData.employee_id} onChange={(v:any)=>setEvalData({...evalData, employee_id:v})} />
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
                <div className="bg-white p-6 rounded-3xl border flex justify-between items-center">
                    <div className="text-2xl font-black text-purple-600">الإجمالي: {total} / 100</div>
                    <button onClick={handleSave} className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black shadow-lg">حفظ التقييم</button>
                </div>
            </div>
        </div>
    );
}

// --- نظام النوبتجيات (المسائي) المطور ---
function EveningSchedulesTab({ employees, centerName, centerId }: { employees: Employee[], centerName?: string, centerId?: string }) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [viewMonth, setViewMonth] = useState(new Date().toISOString().slice(0, 7));

    // فلاتر البحث
    const [searchName, setSearchName] = useState('');
    const [searchId, setSearchId] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterCenter, setFilterCenter] = useState('all');

    const fetchHistory = async () => {
        const { data } = await supabase.from('evening_schedules').select('*').order('date', { ascending: false });
        if (data) setHistory(data);
    };
    
    useEffect(() => { fetchHistory(); }, []);

    const handleSave = async () => {
        if (selectedDoctors.length === 0) return alert('برجاء اختيار الموظفين أولاً');
        const { data: existing } = await supabase.from('evening_schedules').select('id').eq('date', date).maybeSingle();
        
        if (existing) {
            await supabase.from('evening_schedules').update({ doctors: selectedDoctors }).eq('id', existing.id);
            alert('تم تحديث جدول النوبتجية لهذا اليوم');
        } else {
            await supabase.from('evening_schedules').insert([{ date, doctors: selectedDoctors }]);
            alert('تم إضافة جدول نوبتجية جديد');
        }
        fetchHistory(); 
        setSelectedDoctors([]); 
    };

    const handleExcelImport = async (data: any[]) => {
        const { data: existing } = await supabase.from('evening_schedules').select('id, date');
        const existingMap = new Map(existing?.map(h => [h.date, h.id]));

        let inserted = 0;
        let updated = 0;

        for (const row of data) {
            const d = formatDateForDB(row.date || row['التاريخ']);
            if (!d) continue;
            const doctors = String(row.doctors || row['الموظفين'] || row['الأطباء'] || '').split(',').map(s => s.trim()).filter(s => s);
            const notes = row.notes || row['ملاحظات'] || '';

            if (existingMap.has(d)) {
                await supabase.from('evening_schedules').update({ doctors, notes }).eq('id', existingMap.get(d));
                updated++;
            } else {
                await supabase.from('evening_schedules').insert([{ date: d, doctors, notes }]);
                inserted++;
            }
        }
        alert(`تقرير استيراد الجداول:\nتم رفع جديد: ${inserted}\nتم تحديث موجود: ${updated}`);
        fetchHistory();
    };

    const filteredEmployees = useMemo(() => {
        return employees.filter(e => 
            (e.name.toLowerCase().includes(searchName.toLowerCase())) && 
            (e.employee_id.includes(searchId)) &&
            (filterStatus === 'all' || e.status === filterStatus) &&
            (filterCenter === 'all' || e.center_id === filterCenter)
        );
    }, [employees, searchName, searchId, filterStatus, filterCenter]);

    const monthlyHistory = useMemo(() => {
        return history.filter(h => h.date.startsWith(viewMonth));
    }, [history, viewMonth]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center border-b pb-4">
                <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800">
                    <Calendar className="w-7 h-7 text-indigo-600"/> جداول النوبتجية المسائية
                </h2>
                <div className="flex gap-2">
                    <button onClick={() => downloadSample('evening_schedule')} className="text-gray-400 p-2 hover:text-indigo-600 transition-colors" title="تحميل ملف عينة"><Download className="w-5 h-5"/></button>
                    <ExcelUploadButton onData={handleExcelImport} label="رفع جداول إكسيل" />
                    <button 
                        onClick={() => setShowHistory(!showHistory)} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all shadow-sm ${showHistory ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                    >
                        <List className="w-4 h-4" /> عرض الجداول المحفوظة بالشهر
                    </button>
                </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-3xl border space-y-6 shadow-inner">
                {/* 1. اختيار التاريخ */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1 w-full">
                        <Input label="تاريخ النوبتجية" type="date" value={date} onChange={setDate} />
                    </div>
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-black text-gray-400 mb-1">المركز الطبي المستهدف</label>
                        <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg font-bold text-gray-800 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-blue-500" /> {centerName || 'المركز الحالي'}
                        </div>
                    </div>
                </div>

                {/* 2. فلاتر البحث */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Input label="بحث بالاسم" value={searchName} onChange={setSearchName} placeholder="أدخل اسم الموظف..." />
                    <Input label="بحث بالكود" value={searchId} onChange={setSearchId} placeholder="أدخل كود الموظف..." />
                    <Select label="حالة العمل" options={['all', 'نشط', 'موقوف', 'إجازة']} value={filterStatus} onChange={setFilterStatus} />
                    <Select label="المركز" options={['all', centerId || 'current']} value={filterCenter} onChange={setFilterCenter} />
                </div>

                {/* 3. اختيار الموظفين (متعدد) */}
                <div className="space-y-2">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">اختر الموظفين لهذه النوبتجية</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto p-4 bg-white border rounded-2xl shadow-inner border-gray-100">
                        {filteredEmployees.map(emp => (
                            <label 
                                key={emp.employee_id} 
                                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${selectedDoctors.includes(emp.name) ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-gray-50 hover:border-indigo-100'}`}
                            >
                                <div className="relative flex items-center">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedDoctors.includes(emp.name)} 
                                        onChange={() => setSelectedDoctors(prev => prev.includes(emp.name) ? prev.filter(n => n !== emp.name) : [...prev, emp.name])} 
                                        className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500" 
                                    />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="font-bold text-sm truncate">{emp.name}</p>
                                    <p className="text-[10px] text-gray-400 font-bold">{emp.employee_id} • {emp.specialty}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black ${emp.status === 'نشط' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{emp.status}</span>
                            </label>
                        ))}
                        {filteredEmployees.length === 0 && <div className="col-span-full py-10 text-center text-gray-400 font-black italic">لا توجد نتائج تطابق البحث</div>}
                    </div>
                </div>

                {/* 4. ملخص وزر الحفظ */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 text-white p-2 rounded-xl"><Users className="w-5 h-5"/></div>
                        <div className="text-indigo-600 font-black">عدد المختارين: <span className="text-2xl">{selectedDoctors.length}</span></div>
                    </div>
                    <button 
                        onClick={handleSave} 
                        className="bg-indigo-600 text-white px-12 py-3 rounded-2xl font-black shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Save className="w-5 h-5" /> اعتماد الجدول ليوم {date}
                    </button>
                </div>
            </div>

            {/* عرض الأرشيف حسب الشهر */}
            {showHistory && (
                <div className="animate-in slide-in-from-top duration-300 space-y-6">
                    <div className="flex items-center justify-between bg-white p-6 rounded-[30px] border shadow-sm">
                        <h3 className="text-xl font-black flex items-center gap-2 text-indigo-800"><List className="w-6 h-6"/> الأرشيف الشهري للجداول المعتمدة</h3>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-gray-400">فلترة بالشهر:</span>
                            <input 
                                type="month" 
                                value={viewMonth} 
                                onChange={e => setViewMonth(e.target.value)} 
                                className="p-2.5 border rounded-xl bg-gray-50 text-indigo-600 font-black outline-none focus:ring-2 focus:ring-indigo-500" 
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {monthlyHistory.map(sch => (
                            <div key={sch.id} className="p-6 bg-white border border-indigo-50 rounded-[30px] shadow-sm hover:shadow-md transition-all relative group overflow-hidden">
                                <div className="absolute top-0 right-0 w-12 h-12 bg-red-50 rounded-bl-[30px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={async () => { if(confirm('حذف هذا الجدول نهائياً؟')) { await supabase.from('evening_schedules').delete().eq('id', sch.id); fetchHistory(); } }} className="text-red-500 hover:scale-110"><Trash2 className="w-4 h-4"/></button>
                                </div>
                                <h4 className="font-black text-indigo-600 mb-3 border-b pb-2 flex justify-between">
                                    <span>{sch.date}</span>
                                    <span className="text-[10px] text-gray-400">{DAYS_AR[new Date(sch.date).getDay()]}</span>
                                </h4>
                                <div className="flex flex-wrap gap-1">
                                    {sch.doctors?.map((doc: string, idx: number) => (
                                        <span key={idx} className="bg-gray-50 px-3 py-1 rounded-lg text-[10px] font-bold text-gray-600 border border-gray-100 shadow-sm">{doc}</span>
                                    ))}
                                </div>
                                {sch.doctors?.length === 0 && <p className="text-xs text-gray-400 font-bold italic">لا يوجد موظفين مسجلين</p>}
                            </div>
                        ))}
                        {monthlyHistory.length === 0 && <div className="md:col-span-3 py-16 text-center text-gray-300 font-black border-2 border-dashed rounded-[30px]">لا توجد جداول محفوظة لشهر {viewMonth}</div>}
                    </div>
                </div>
            )}
        </div>
    );
}

// --- استعادة تبويب الإجازات المحدث ---
function LeavesTab({ onRefresh }: { onRefresh: () => void }) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'معلق' | 'مقبول' | 'مرفوض'>('all');
  const [searchName, setSearchName] = useState('');
  const [searchId, setSearchId] = useState('');
  const [searchType, setSearchType] = useState('all');

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
    await supabase.from('leave_requests').update({ status }).eq('id', req.id);
    fetchLeaves(); onRefresh();
  };

  const handleExcelImport = async (data: any[]) => {
      const { data: existing } = await supabase.from('leave_requests').select('id, employee_id, type, start_date');
      const existingMap = new Map(existing?.map(l => [`${l.employee_id}|${l.type}|${l.start_date}`, l.id]));

      let inserted = 0;
      let updated = 0;

      for (const row of data) {
          const eid = String(row.employee_id || row['كود الموظف'] || '');
          const type = String(row.type || row['نوع الطلب'] || '');
          const start = formatDateForDB(row.start_date || row['من تاريخ']);
          if (!eid || !type || !start) continue;

          const key = `${eid}|${type}|${start}`;
          const payload = {
              employee_id: eid,
              type: type,
              start_date: start,
              end_date: formatDateForDB(row.end_date || row['إلى تاريخ']),
              status: 'معلق',
              notes: String(row.notes || row['ملاحظات'] || '')
          };

          if (existingMap.has(key)) {
              await supabase.from('leave_requests').update(payload).eq('id', existingMap.get(key));
              updated++;
          } else {
              await supabase.from('leave_requests').insert([payload]);
              inserted++;
          }
      }
      alert(`تقرير استيراد الطلبات:\nتم رفع جديد: ${inserted}\nتم تحديث موجود: ${updated}`);
      fetchLeaves();
  };

  const filteredRequests = useMemo(() => {
      return requests.filter(r => 
          (statusFilter === 'all' || r.status === statusFilter) &&
          (r.employee_name?.toLowerCase().includes(searchName.toLowerCase())) &&
          (r.employee_id.includes(searchId)) &&
          (searchType === 'all' || r.type === searchType)
      );
  }, [requests, statusFilter, searchName, searchId, searchType]);

  const totalsByType = useMemo(() => {
      const summary: Record<string, number> = {};
      filteredRequests.forEach(r => {
          summary[r.type] = (summary[r.type] || 0) + 1;
      });
      return summary;
  }, [filteredRequests]);

  const leaveTypesOptions = ['all', ...Array.from(new Set(requests.map(r => r.type)))];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4">
        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <FileText className="text-blue-600 w-7 h-7"/> طلبات الإجازات والمأموريات
        </h2>
        <div className="flex gap-2">
            <button onClick={() => downloadSample('leave_requests')} className="text-gray-400 p-2 hover:text-blue-600 transition-colors" title="تحميل ملف عينة"><Download className="w-5 h-5"/></button>
            <ExcelUploadButton onData={handleExcelImport} label="استيراد طلبات" />
        </div>
      </div>

      {/* فلاتر البحث */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-6 rounded-[30px] border shadow-inner">
          <Input label="اسم الموظف" value={searchName} onChange={setSearchName} placeholder="بحث بالاسم..." />
          <Input label="كود الموظف" value={searchId} onChange={setSearchId} placeholder="بحث بالكود..." />
          <Select label="نوع الطلب" options={leaveTypesOptions} value={searchType} onChange={setSearchType} />
          <div className="text-right">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">الحالة</label>
              <div className="flex bg-white p-1 rounded-xl border">
                  {['all', 'معلق', 'مقبول', 'مرفوض'].map(f => (
                      <button key={f} onClick={()=>setStatusFilter(f as any)} className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-black transition-all ${statusFilter===f?'bg-blue-600 text-white shadow-sm':'text-gray-400 hover:text-blue-600'}`}>{f==='all'?'الكل':f}</button>
                  ))}
              </div>
          </div>
      </div>

      {/* ملخص الأنواع */}
      <div className="flex flex-wrap gap-2 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
          <span className="text-xs font-black text-blue-700 w-full mb-2">إجمالي الطلبات حسب النوع:</span>
          {Object.entries(totalsByType).map(([type, count]) => (
              <div key={type} className="bg-white px-3 py-1.5 rounded-xl border shadow-sm flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-500">{type}:</span>
                  <span className="text-sm font-black text-blue-600">{count}</span>
              </div>
          ))}
          {Object.keys(totalsByType).length === 0 && <span className="text-xs text-gray-400 font-bold italic">لا توجد بيانات للعرض</span>}
      </div>

      <div className="grid gap-4">
        {filteredRequests.map(req => (
          <div key={req.id} className="p-5 bg-white border rounded-[30px] flex justify-between items-center shadow-sm hover:shadow-md transition-all">
            <div className="flex gap-4 items-center">
                <div className="bg-gray-50 p-3 rounded-2xl text-blue-600 border"><FileText className="w-6 h-6"/></div>
                <div>
                    <p className="font-black text-lg text-gray-800">{req.employee_name}</p>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                        <span className="text-blue-600">{req.type}</span>
                        <span>•</span>
                        <span>ID: {req.employee_id}</span>
                        <span>•</span>
                        <span>من {req.start_date} إلى {req.end_date}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded-xl text-xs font-black shadow-sm ${req.status==='مقبول'?'bg-green-600 text-white':req.status==='مرفوض'?'bg-red-600 text-white':'bg-amber-500 text-white'}`}>{req.status}</span>
              {req.status === 'معلق' && (
                  <div className="flex gap-2">
                      <button onClick={() => handleAction(req, 'مقبول')} className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"><CheckCircle className="w-5 h-5"/></button>
                      <button onClick={() => handleAction(req, 'مرفوض')} className="bg-red-50 text-red-600 p-2.5 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"><XCircle className="w-5 h-5"/></button>
                  </div>
              )}
            </div>
          </div>
        ))}
        {filteredRequests.length === 0 && <div className="text-center py-20 text-gray-300 font-black border-2 border-dashed rounded-[30px]">لا توجد طلبات تطابق الفلاتر المختارة</div>}
      </div>
    </div>
  );
}

// --- استعادة تبويب البصمات ---
function AttendanceTab({ employees, onRefresh }: { employees: Employee[], onRefresh: () => void }) {
  const [formData, setFormData] = useState<Partial<AttendanceRecord>>({ date: new Date().toISOString().split('T')[0], times: '' });

  const handleImport = async (data: any[]) => {
    // جلب البيانات الحالية من قاعدة البيانات للمقارنة
    const { data: existing } = await supabase.from('attendance').select('id, employee_id, date, times');
    // Cast Map to any to resolve unknown typing from undefined existing query result
    const existingMap = new Map<string, any>(existing?.map(a => [`${a.employee_id}|${a.date}`, a]) || []);

    let inserted = 0;
    let updated = 0;

    for (const row of data) {
        const eid = String(row.employee_id || row['الكود'] || '');
        const d = formatDateForDB(row.date || row['التاريخ']);
        const times = String(row.times || row['البصمات'] || '').trim();
        
        if (!eid || !d) continue;
        const key = `${eid}|${d}`;

        if (existingMap.has(key)) {
            // Cast record to any to fix Property 'times'/'id' does not exist on type 'unknown'
            const record = existingMap.get(key) as any;
            // تحديث فقط إذا كانت البصمات مختلفة
            if (record.times !== times) {
                await supabase.from('attendance').update({ times }).eq('id', record.id);
                updated++;
            }
        } else {
            await supabase.from('attendance').insert([{ employee_id: eid, date: d, times }]);
            inserted++;
        }
    }

    alert(`تقرير استيراد البصمات:\nتم رفع جديد: ${inserted}\nتم تحديث موجود: ${updated}`);
    onRefresh(); 
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-black text-gray-800"><Clock className="inline-block ml-2 text-blue-600"/> سجل البصمات</h2>
        <div className="flex gap-2">
            <button onClick={()=>downloadSample('attendance')} className="text-gray-400 p-2 hover:text-blue-600 transition-colors" title="تحميل ملف عينة"><Download className="w-5 h-5"/></button>
            <ExcelUploadButton onData={handleImport} label="رفع ملف البصمات" />
        </div>
      </div>
      <div className="bg-gray-50 p-8 rounded-[40px] border grid grid-cols-1 md:grid-cols-2 gap-6 shadow-inner">
        <Select label="الموظف" options={employees.map(e => ({value: e.employee_id, label: e.name}))} value={formData.employee_id} onChange={(v:any)=>setFormData({...formData, employee_id: v})} />
        <Input label="التاريخ" type="date" value={formData.date} onChange={(v:any)=>setFormData({...formData, date: v})} />
        <div className="md:col-span-2"><Input label="التوقيتات (مفصولة بمسافات)" value={formData.times} onChange={(v:any)=>setFormData({...formData, times: v})} placeholder="مثال: 08:30 14:15 16:00" /></div>
        <button onClick={async () => { 
            const d = formData.date;
            const eid = formData.employee_id;
            if(!eid || !d) return alert('برجاء اختيار الموظف والتاريخ');
            
            const { data: existing } = await supabase.from('attendance').select('id').eq('employee_id', eid).eq('date', d).maybeSingle();
            
            if (existing) {
                await supabase.from('attendance').update({ times: formData.times }).eq('id', existing.id);
                alert('تم تحديث سجل البصمة بنجاح');
            } else {
                await supabase.from('attendance').insert([formData]);
                alert('تم إضافة سجل بصمة جديد بنجاح');
            }
            onRefresh();
        }} className="md:col-span-2 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl">حفظ السجل يدوياً</button>
      </div>
    </div>
  );
}

// --- استعادة التقارير الذكية ---
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4 no-print">
        <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800"><BarChart3 className="w-7 h-7 text-emerald-600"/> التقارير الذكية</h2>
        <div className="flex bg-gray-100 p-1 rounded-xl border">
            <button onClick={()=>setType('daily')} className={`px-4 py-2 rounded-lg text-xs font-bold ${type==='daily'?'bg-white text-emerald-600 shadow-sm':'text-gray-400'}`}>يومي</button>
            <button onClick={()=>setType('monthly')} className={`px-4 py-2 rounded-lg text-xs font-bold ${type==='monthly'?'bg-white text-emerald-600 shadow-sm':'text-gray-400'}`}>تقرير فترة</button>
            <button onClick={()=>setType('employee_month')} className={`px-4 py-2 rounded-lg text-xs font-bold ${type==='employee_month'?'bg-white text-emerald-600 shadow-sm':'text-gray-400'}`}>موظف مخصص</button>
        </div>
      </div>
      <div className="bg-white p-6 rounded-[30px] border shadow-sm space-y-4 no-print">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
             {type === 'daily' && <Input label="تاريخ التقرير" type="date" value={date} onChange={setDate} />}
             {(type === 'monthly' || type === 'employee_month') && (
                 <>
                    {type === 'employee_month' && <Select label="الموظف" options={employees.map(e=>({value:e.employee_id, label:e.name}))} value={targetId} onChange={setTargetId} />}
                    <Input label="من تاريخ" type="date" value={startDate} onChange={setStartDate} />
                    <Input label="إلى تاريخ" type="date" value={endDate} onChange={setEndDate} />
                 </>
             )}
         </div>
         <div className="flex justify-end pt-4 border-t"><button onClick={()=>window.print()} className="bg-gray-800 text-white px-8 py-2.5 rounded-2xl font-black flex gap-2 shadow-lg"><Printer className="w-5 h-5"/> طباعة التقرير</button></div>
      </div>
      <div className="overflow-x-auto border rounded-[30px] bg-white shadow-sm min-h-[400px]">
        <table className="w-full text-sm text-right">
            <thead className="bg-gray-100 font-bold">
                {type === 'daily' && <tr><th className="p-4">الكود</th><th className="p-4">الموظف</th><th className="p-4">الحضور</th><th className="p-4">الانصراف</th><th className="p-4">الحالة</th></tr>}
                {type === 'monthly' && <tr><th className="p-4">الموظف</th><th className="p-4">التخصص</th><th className="p-4 text-emerald-600">أيام حضور</th><th className="p-4 text-amber-500">أيام إجازة</th><th className="p-4">ساعات العمل</th></tr>}
                {type === 'employee_month' && <tr><th className="p-4">التاريخ</th><th className="p-4">اليوم</th><th className="p-4">الحضور</th><th className="p-4">الانصراف</th><th className="p-4">ساعات</th></tr>}
            </thead>
            <tbody>
                {type === 'daily' && employees.map(emp => {
                    const att = attData.find(a => a.employee_id === emp.employee_id && a.date === date);
                    const leave = leaveData.find(l => l.employee_id === emp.employee_id && date >= l.start_date && date <= l.end_date);
                    const t = att?.times.split(/\s+/).filter(x=>x.includes(':')) || [];
                    return (
                        <tr key={emp.id} className="border-b">
                            <td className="p-4 font-mono font-bold text-blue-600">{emp.employee_id}</td>
                            <td className="p-4 font-black">{emp.name}</td>
                            <td className="p-4 text-emerald-600 font-black">{t[0] || '--'}</td>
                            <td className="p-4 text-red-500 font-black">{t[t.length-1] || '--'}</td>
                            <td className={`p-4 font-bold ${att ? 'text-emerald-600' : 'text-red-400'}`}>{att ? 'حاضر' : (leave ? `إجازة (${leave.type})` : 'غائب')}</td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
      </div>
    </div>
  );
}

// --- استعادة التنبيهات ---
function AlertsTab({ employees }: { employees: Employee[] }) {
    const [target, setTarget] = useState('all'); 
    const [msg, setMsg] = useState('');
    const [history, setHistory] = useState<InternalMessage[]>([]);
    useEffect(() => { supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(20).then(({data})=>data && setHistory(data)); }, []);
    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-black border-b pb-4 flex items-center gap-2 text-gray-800"><Bell className="w-7 h-7 text-orange-500" /> تنبيهات العاملين</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-50 p-8 rounded-[40px] border space-y-4 shadow-inner">
                    <Select label="المستهدف" options={[{value:'all', label:'الجميع'}, ...employees.map(e=>({value:e.employee_id, label:e.name}))]} value={target} onChange={setTarget} />
                    <textarea className="w-full p-4 border rounded-2xl outline-none" rows={5} value={msg} onChange={e=>setMsg(e.target.value)} placeholder="نص التنبيه..." />
                    <button onClick={async ()=>{ await supabase.from('messages').insert([{from_user:'admin', to_user:target, content:msg}]); alert('تم الإرسال'); setMsg(''); }} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl flex justify-center items-center gap-2"><Send className="w-5 h-5"/> إرسال الآن</button>
                </div>
                <div className="space-y-4">
                    <h3 className="font-black text-gray-700">سجل التنبيهات</h3>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                        {history.map(m => (
                            <div key={m.id} className="p-4 bg-white border rounded-2xl shadow-sm">
                                <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-black"><span>{m.to_user==='all'?'إعلان عام':`إلى: ${m.to_user}`}</span><span>{new Date(m.created_at).toLocaleString('ar-EG')}</span></div>
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
        <div className="bg-white p-12 rounded-[40px] shadow-2xl w-full max-w-md border border-gray-100">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-8 font-black"><ArrowRight className="ml-2 w-4 h-4" /> العودة للرئيسية</button>
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-blue-100 shadow-inner"><ShieldCheck className="w-10 h-10 text-blue-600" /></div>
            <h2 className="text-3xl font-black text-gray-800">بوابة الإدارة</h2>
          </div>
          <div className="space-y-6">
            <select className="w-full p-4 border rounded-2xl font-black focus:ring-2 focus:ring-blue-500" onChange={(e) => setSelectedCenter(centers.find(c => c.id === e.target.value) || null)}>
              <option value="">-- اختر المركز الطبي --</option>
              {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}
            </select>
            <input type="password" className="w-full p-4 border rounded-2xl text-center font-black focus:ring-2 focus:ring-blue-500" placeholder="كلمة المرور" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            <button onClick={() => { if(selectedCenter && adminPassword === selectedCenter.password) setIsAdminLoggedIn(true); else alert('خطأ'); }} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl active:scale-95">دخول</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-10 text-right">
      <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-[35px] shadow-sm border no-print">
        <div><h1 className="text-3xl font-black text-gray-800 tracking-tighter">إدارة: {selectedCenter?.center_name}</h1><p className="text-gray-400 text-sm font-bold flex items-center gap-2 mt-1"><MapPin className="w-3 h-3"/> {selectedCenter?.address}</p></div>
        <button onClick={() => setIsAdminLoggedIn(false)} className="bg-red-50 text-red-600 px-8 py-3 rounded-2xl font-black flex items-center hover:bg-red-100 transition-all">خروج <LogOut className="ml-3 w-5 h-5"/></button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-3 no-print">
          <SidebarBtn active={activeTab === 'settings'} icon={<Settings className="w-5 h-5"/>} label="الإعدادات" onClick={() => setActiveTab('settings')} />
          <SidebarBtn active={activeTab === 'doctors'} icon={<Users className="w-5 h-5"/>} label="شئون الموظفين" onClick={() => setActiveTab('doctors')} />
          <SidebarBtn active={activeTab === 'evaluations'} icon={<Award className="w-5 h-5"/>} label="التقييمات الطبية" onClick={() => setActiveTab('evaluations')} />
          <SidebarBtn active={activeTab === 'evening'} icon={<Calendar className="w-5 h-5"/>} label="جداول النوبتجية" onClick={() => setActiveTab('evening')} />
          <SidebarBtn active={activeTab === 'leaves'} icon={<FileText className="w-5 h-5"/>} label="طلبات الإجازات" onClick={() => setActiveTab('leaves')} />
          <SidebarBtn active={activeTab === 'attendance'} icon={<Clock className="w-5 h-5"/>} label="سجل البصمات" onClick={() => setActiveTab('attendance')} />
          <SidebarBtn active={activeTab === 'reports'} icon={<BarChart3 className="w-5 h-5"/>} label="تقارير ذكية" onClick={() => setActiveTab('reports')} />
          <SidebarBtn active={activeTab === 'alerts'} icon={<Bell className="w-5 h-5"/>} label="تنبيهات العاملين" onClick={() => setActiveTab('alerts')} />
        </div>
        <div className="lg:col-span-3 bg-white p-10 rounded-[40px] shadow-sm border min-h-[600px] animate-in slide-in-from-left duration-500">
          {activeTab === 'settings' && selectedCenter && <GeneralSettingsTab center={selectedCenter} onRefresh={fetchCenters} />}
          {activeTab === 'doctors' && <DoctorsTab employees={employees} onRefresh={fetchEmployees} centerId={selectedCenter!.id} />}
          {activeTab === 'evaluations' && <EvaluationsTab employees={employees} />}
          {activeTab === 'evening' && <EveningSchedulesTab employees={employees} centerName={selectedCenter?.center_name} centerId={selectedCenter?.id} />}
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