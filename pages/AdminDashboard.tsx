
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, Settings, Users, FileText, Calendar, 
  Clock, BarChart3, Mail, Bell, Plus, Upload, Trash2, CheckCircle, XCircle, FileSpreadsheet, Info, Download, X, Send, LogOut, ShieldCheck, Eye, Award, MessageCircle, User
} from 'lucide-react';
import { GeneralSettings, Employee, LeaveRequest, AttendanceRecord, InternalMessage, Evaluation } from '../types';
import * as XLSX from 'xlsx';

// --- مساعدات معالجة التواريخ والبيانات ---

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
        <option value="">-- اختر --</option>
        {options.map((opt: any) => typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  );
}

// --- مكون عرض تفاصيل الموظف للمدير ---
const StaffDetailsView = ({ employee, onBack, centerSettings }: { employee: Employee, onBack: () => void, centerSettings: GeneralSettings | null }) => {
  const [activeSubTab, setActiveSubTab] = useState('profile');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    const fetchData = async () => {
      const [attRes, leaveRes, evalRes, msgRes] = await Promise.all([
        supabase.from('attendance').select('*').eq('employee_id', employee.employee_id),
        supabase.from('leave_requests').select('*').eq('employee_id', employee.employee_id).order('created_at', { ascending: false }),
        supabase.from('evaluations').select('*').eq('employee_id', employee.employee_id).order('month', { ascending: false }),
        supabase.from('messages').select('*').or(`from_user.eq.${employee.employee_id},to_user.eq.${employee.employee_id}`).order('created_at', { ascending: false })
      ]);
      if (attRes.data) setAttendance(attRes.data);
      if (leaveRes.data) setLeaves(leaveRes.data);
      if (evalRes.data) setEvaluations(evalRes.data);
      if (msgRes.data) setMessages(msgRes.data);
    };
    fetchData();
  }, [employee.employee_id]);

  const stats = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    let monthlyHours = 0;
    let attendDays = 0;
    
    attendance.forEach(att => {
        if (att.date.startsWith(selectedMonth)) {
            attendDays++;
            const times = att.times.split(/\s+/).filter(t => t.includes(':'));
            if (times.length >= 2) {
                monthlyHours += calculateHours(times[0], times[times.length - 1]);
            }
        }
    });

    return { monthlyHours: monthlyHours.toFixed(1), attendDays };
  }, [attendance, selectedMonth]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-all"><ArrowRight className="w-6 h-6"/></button>
          <div>
            <h2 className="text-2xl font-bold">{employee.name}</h2>
            <p className="text-gray-400 text-sm">كود: {employee.employee_id} | {employee.specialty}</p>
          </div>
        </div>
        <div className="flex gap-2">
            <span className={`px-4 py-1 rounded-full text-xs font-bold ${employee.status === 'نشط' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{employee.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-center">
            <p className="text-[10px] text-blue-600 font-bold uppercase mb-1">ساعات الشهر المختارة</p>
            <p className="text-2xl font-black text-blue-800">{stats.monthlyHours}</p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center">
            <p className="text-[10px] text-emerald-600 font-bold uppercase mb-1">أيام الحضور</p>
            <p className="text-2xl font-black text-emerald-800">{stats.attendDays}</p>
        </div>
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 text-center">
            <p className="text-[10px] text-amber-600 font-bold uppercase mb-1">المتبقي اعتيادي</p>
            <p className="text-2xl font-black text-amber-800">{employee.remaining_annual}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 text-center">
            <p className="text-[10px] text-purple-600 font-bold uppercase mb-1">المتبقي عارضة</p>
            <p className="text-2xl font-black text-purple-800">{employee.remaining_casual}</p>
        </div>
      </div>

      <div className="flex border-b overflow-x-auto">
        <SubTab active={activeSubTab === 'profile'} label="الملف الشخصي" onClick={() => setActiveSubTab('profile')} />
        <SubTab active={activeSubTab === 'attendance'} label="سجل الحضور" onClick={() => setActiveSubTab('attendance')} />
        <SubTab active={activeSubTab === 'leaves'} label="الطلبات" onClick={() => setActiveSubTab('leaves')} />
        <SubTab active={activeSubTab === 'evals'} label="التقييمات" onClick={() => setActiveSubTab('evals')} />
        <SubTab active={activeSubTab === 'messages'} label="الرسائل" onClick={() => setActiveSubTab('messages')} />
      </div>

      <div className="p-4">
        {activeSubTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <DataField label="الاسم الرباعي" value={employee.name} />
            <DataField label="الرقم القومي" value={employee.national_id} />
            <DataField label="التليفون" value={employee.phone} />
            <DataField label="البريد الإلكتروني" value={employee.email} />
            <DataField label="الدرجة الوظيفية" value={employee.grade} />
            <DataField label="تاريخ التعيين" value={employee.join_date} />
            <DataField label="الجنس" value={employee.gender} />
            <DataField label="الديانة" value={employee.religion} />
            <DataField label="مواعيد العمل" value={`${employee.start_time} - ${employee.end_time}`} />
            <DataField label="أيام العمل" value={employee.work_days?.join('، ') || 'الكل'} />
            <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl border">
                    <p className="text-xs text-gray-400 font-bold mb-1">المهام الإدارية</p>
                    <p className="text-sm font-semibold">{employee.admin_tasks || 'لا يوجد'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border">
                    <p className="text-xs text-gray-400 font-bold mb-1">الدورات التدريبية</p>
                    <p className="text-sm font-semibold">{employee.training_courses || 'لا يوجد'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border md:col-span-2">
                    <p className="text-xs text-gray-400 font-bold mb-1">ملاحظات عامة</p>
                    <p className="text-sm italic">{employee.notes || 'لا يوجد ملاحظات'}</p>
                </div>
            </div>
          </div>
        )}

        {activeSubTab === 'attendance' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h4 className="font-bold">تقرير شهر {selectedMonth}</h4>
                <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="p-2 border rounded-lg bg-gray-50" />
            </div>
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-right">التاريخ</th>
                    <th className="p-3 text-right">الحضور</th>
                    <th className="p-3 text-right">الانصراف</th>
                    <th className="p-3 text-right">الساعات</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.filter(a => a.date.startsWith(selectedMonth)).map(a => {
                    const times = a.times.split(/\s+/).filter(t => t.includes(':'));
                    return (
                      <tr key={a.id} className="border-t">
                        <td className="p-3 font-bold">{a.date}</td>
                        <td className="p-3 text-emerald-600 font-bold">{times[0] || '--'}</td>
                        <td className="p-3 text-red-500 font-bold">{times.length > 1 ? times[times.length - 1] : '--'}</td>
                        <td className="p-3 font-mono">{(times.length >= 2) ? calculateHours(times[0], times[times.length - 1]).toFixed(1) : '0.0'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === 'leaves' && (
          <div className="space-y-4">
            {leaves.map(req => (
              <div key={req.id} className="p-4 border rounded-xl flex justify-between items-center bg-white shadow-sm">
                <div>
                  <p className="font-bold text-blue-700">{req.type}</p>
                  <p className="text-xs text-gray-500">{req.start_date} إلى {req.end_date}</p>
                  {req.notes && <p className="text-xs italic text-gray-400 mt-1">الملاحظة: {req.notes}</p>}
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${req.status === 'مقبول' ? 'bg-green-100 text-green-700' : req.status === 'مرفوض' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{req.status}</span>
              </div>
            ))}
            {leaves.length === 0 && <div className="text-center py-10 text-gray-400">لا يوجد سجل طلبات</div>}
          </div>
        )}

        {activeSubTab === 'evals' && (
          <div className="space-y-4">
            {evaluations.map(ev => (
              <div key={ev.id} className="p-4 border rounded-xl flex justify-between items-center bg-white shadow-sm">
                <div>
                  <p className="font-bold">{ev.month}</p>
                  <p className="text-xs text-gray-500">{ev.notes || 'بدون ملاحظات'}</p>
                </div>
                <div className="text-center">
                    <p className="text-2xl font-black text-emerald-600">{ev.total_score}%</p>
                </div>
              </div>
            ))}
            {evaluations.length === 0 && <div className="text-center py-10 text-gray-400">لا يوجد تقييمات مسجلة</div>}
          </div>
        )}

        {activeSubTab === 'messages' && (
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {messages.map(m => (
              <div key={m.id} className={`p-4 rounded-2xl border ${m.from_user === 'admin' ? 'bg-blue-50 mr-10' : 'bg-gray-50 ml-10'}`}>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-gray-400">{m.from_user === 'admin' ? 'الإدارة' : 'الموظف'}</span>
                    <span className="text-[10px] text-gray-400">{new Date(m.created_at).toLocaleString('ar-EG')}</span>
                </div>
                <p className="text-sm">{m.content}</p>
              </div>
            ))}
            {messages.length === 0 && <div className="text-center py-10 text-gray-400">لا توجد رسائل سابقة</div>}
          </div>
        )}
      </div>
    </div>
  );
};

const SubTab = ({ active, label, onClick }: any) => (
  <button onClick={onClick} className={`px-6 py-3 font-bold transition-all border-b-2 whitespace-nowrap ${active ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>{label}</button>
);

const DataField = ({ label, value }: any) => (
  <div className="bg-white p-3 border-b">
    <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">{label}</label>
    <p className="font-bold text-gray-800">{value || '--'}</p>
  </div>
);

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
      {sampleData && <button onClick={downloadSample} className="mt-3 flex items-center text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-all shadow-sm"><Download className="w-4 h-4 ml-2" /> تحميل النموذج الجاهز</button>}
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

// --- الأقسام الوظيفية ---

function GeneralSettingsTab({ center }: { center: GeneralSettings }) {
  const [settings, setSettings] = useState<GeneralSettings>({ ...center, holidays: center.holidays || [] });
  const [newHoliday, setNewHoliday] = useState('');
  const handleSave = async () => {
    const { error } = await supabase.from('general_settings').update(settings).eq('id', center.id);
    if (error) alert('فشل الحفظ'); else alert('تم الحفظ بنجاح');
  };
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold border-b pb-4 text-gray-800 flex items-center gap-2"><Settings className="w-6 h-6 text-blue-600" /> إعدادات المركز العامة</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input label="اسم المركز" value={settings.center_name} onChange={(v:any)=>setSettings({...settings, center_name: v})} />
        <Input label="اسم المدير" value={settings.admin_name} onChange={(v:any)=>setSettings({...settings, admin_name: v})} />
        <Input label="كلمة مرور الإدارة" type="password" value={settings.password} onChange={(v:any)=>setSettings({...settings, password: v})} />
        <Input label="تليفون التواصل" value={settings.phone} onChange={(v:any)=>setSettings({...settings, phone: v})} />
        <Input label="الموعد الرسمي للحضور (صباحاً)" type="time" value={settings.shift_morning_in} onChange={(v:any)=>setSettings({...settings, shift_morning_in: v})} />
        <Input label="الموعد الرسمي للانصراف (صباحاً)" type="time" value={settings.shift_morning_out} onChange={(v:any)=>setSettings({...settings, shift_morning_out: v})} />
      </div>
      <div className="border-t pt-4">
        <h3 className="font-bold text-gray-700 mb-3 flex items-center"><Calendar className="w-4 h-4 ml-2 text-blue-500"/> العطلات الرسمية المضافة</h3>
        <p className="text-xs text-gray-400 mb-3">* ملاحظة: أيام الجمعة تعتبر عطلة تلقائية في النظام.</p>
        <div className="flex gap-2 mb-4">
          <input type="date" value={newHoliday} onChange={e => setNewHoliday(e.target.value)} className="p-2 border rounded-lg" />
          <button onClick={() => { if(newHoliday) setSettings({...settings, holidays: [...(settings.holidays||[]), newHoliday]}); setNewHoliday(''); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg"><Plus/></button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(settings.holidays || []).map(date => (
            <span key={date} className="bg-gray-100 px-3 py-1 rounded-full text-xs border flex items-center gap-2">
              {date} <button onClick={() => setSettings({...settings, holidays: (settings.holidays||[]).filter(d=>d!==date)})}><X className="w-3 h-3 text-red-500"/></button>
            </span>
          ))}
        </div>
      </div>
      <button onClick={handleSave} className="bg-emerald-600 text-white px-8 py-3 rounded-lg font-bold shadow-md">حفظ الإعدادات</button>
    </div>
  );
}

function AttendanceTab({ employees, onRefresh }: { employees: Employee[], onRefresh: () => void }) {
  const [formData, setFormData] = useState<Partial<AttendanceRecord>>({ 
    date: new Date().toISOString().split('T')[0], times: ''
  });

  const handleImport = async (data: any[]) => {
    try {
      const validIds = new Set(employees.map(e => e.employee_id));
      const processed = data.map(row => {
        const eid = String(row.employee_id || '');
        const dbDate = formatDateForDB(row.date);
        const times = String(row.times || '').trim();
        if (validIds.has(eid) && dbDate) {
          return { employee_id: eid, date: dbDate, times: times };
        }
        return null;
      }).filter(Boolean);

      if (processed.length === 0) return alert("لا توجد بيانات صالحة");

      const uniqueDates = Array.from(new Set(processed.map((p: any) => p.date)));
      const { data: existing } = await supabase.from('attendance').select('employee_id, date').in('date', uniqueDates);
      const existingKeys = new Set(existing?.map(r => `${r.employee_id}-${r.date}`));
      const toInsert = processed.filter((p: any) => !existingKeys.has(`${p.employee_id}-${p.date}`));

      if (toInsert.length > 0) {
        const { error } = await supabase.from('attendance').insert(toInsert);
        if (error) throw error;
        alert(`تم رفع ${toInsert.length} سجل بنجاح.`);
      } else { alert("جميع السجلات مكررة بالفعل."); }
      onRefresh();
    } catch (err: any) { alert("خطأ: " + err.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2"><Clock className="w-6 h-6 text-blue-600"/> الحضور اليومي (البصمات)</h2>
        <ExcelUploadButton onData={handleImport} label="رفع ملف البصمات" />
      </div>
      <ExcelInfo 
        fields={['employee_id', 'date', 'times']} 
        sampleData={[{employee_id: '1001', date: '2025-01-01', times: '08:22 13:47 14:05'}]}
        fileName="attendance_times_format"
      />
      <div className="bg-gray-50 p-6 rounded-xl border grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="رقم الموظف" options={[{value: '', label: '-- اختر --'}, ...employees.map(e => ({value: e.employee_id, label: e.name}))]} value={formData.employee_id} onChange={(v:any)=>setFormData({...formData, employee_id: v})} />
        <Input label="التاريخ" type="date" value={formData.date} onChange={(v:any)=>setFormData({...formData, date: v})} />
        <div className="md:col-span-2">
          <Input label="التوقيتات (مفصولة بمسافات)" value={formData.times} onChange={(v:any)=>setFormData({...formData, times: v})} placeholder="مثال: 08:30 14:15" />
        </div>
        <button onClick={async () => { 
          if(!formData.employee_id || !formData.times) return alert('أكمل البيانات');
          const { error } = await supabase.from('attendance').insert([formData]);
          if(!error) { alert('تم الحفظ'); onRefresh(); } else alert(error.message);
        }} className="md:col-span-2 bg-blue-600 text-white py-3 rounded-lg font-bold shadow-md">إضافة سجل يدوي</button>
      </div>
    </div>
  );
}

function DoctorsTab({ employees, onRefresh, centerId, settings }: { employees: Employee[], onRefresh: () => void, centerId: string, settings: GeneralSettings | null }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Employee | null>(null);

  const handleImport = async (data: any[]) => {
    const formatted = data.map(row => ({
      employee_id: String(row.employee_id || ''),
      name: String(row.name || ''),
      national_id: String(row.national_id || ''),
      specialty: String(row.specialty || ''),
      join_date: formatDateForDB(row.join_date),
      center_id: centerId,
      leave_annual_balance: Number(row.leave_annual_balance || 21),
      leave_casual_balance: Number(row.leave_casual_balance || 7),
      remaining_annual: Number(row.leave_annual_balance || 21),
      remaining_casual: Number(row.leave_casual_balance || 7),
      status: 'نشط'
    })).filter(r => r.employee_id && r.name);

    const { error } = await supabase.from('employees').upsert(formatted, { onConflict: 'employee_id' });
    if (error) alert(error.message); else { alert("تم الاستيراد بنجاح"); onRefresh(); }
  };

  if (selectedStaff) {
    return <StaffDetailsView employee={selectedStaff} onBack={() => setSelectedStaff(null)} centerSettings={settings} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6 text-blue-600"/> شئون الموظفين</h2>
        <div className="flex gap-2">
           <ExcelUploadButton onData={handleImport} label="استيراد موظفين" />
           <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-md">
             {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
           </button>
        </div>
      </div>
      <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100">
            <tr>
                <th className="p-3">الكود</th>
                <th className="p-3">الاسم</th>
                <th className="p-3">التخصص</th>
                <th className="p-3">الحالة</th>
                <th className="p-3 text-center">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className="border-b hover:bg-blue-50/50 transition-colors cursor-pointer" onClick={() => setSelectedStaff(emp)}>
                <td className="p-3 font-mono font-bold text-blue-600">{emp.employee_id}</td>
                <td className="p-3 font-bold">{emp.name}</td>
                <td className="p-3">{emp.specialty}</td>
                <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${emp.status === 'نشط' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{emp.status}</span>
                </td>
                <td className="p-3">
                  <div className="flex justify-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedStaff(emp); }} className="text-blue-500 hover:bg-blue-50 p-2 rounded-full"><Eye className="w-4 h-4"/></button>
                    <button onClick={async (e) => { e.stopPropagation(); if(confirm('حذف؟')) { await supabase.from('employees').delete().eq('id', emp.id); onRefresh(); } }} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-all"><Trash2 className="w-4 h-4"/></button>
                  </div>
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
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold border-b pb-4 flex items-center gap-2"><FileText className="w-6 h-6 text-blue-600"/> طلبات الإجازات المعلقة</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {requests.map(req => (
          <div key={req.id} className="p-4 border bg-white rounded-xl shadow-sm flex flex-col border-r-4 border-r-blue-500">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <p className="font-bold">{req.employee_name} ({req.employee_id})</p>
                    <p className="text-sm text-blue-600 font-bold">{req.type}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={async () => { await supabase.from('leave_requests').update({status: 'مقبول'}).eq('id', req.id); onRefresh(); }} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"><CheckCircle/></button>
                    <button onClick={async () => { await supabase.from('leave_requests').update({status: 'مرفوض'}).eq('id', req.id); onRefresh(); }} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><XCircle/></button>
                </div>
            </div>
            <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-2 rounded">
                <p>الفترة: {req.start_date} إلى {req.end_date}</p>
                <p className="text-blue-600 font-bold">تاريخ العودة: {req.back_date}</p>
                <p>البديل: {req.backup_person}</p>
                {req.notes && <p className="italic text-gray-400">الملاحظات: {req.notes}</p>}
            </div>
          </div>
        ))}
        {requests.length === 0 && <div className="md:col-span-2 text-center py-10 text-gray-400 font-bold border-2 border-dashed rounded-xl">لا توجد طلبات معلقة</div>}
      </div>
    </div>
  );
}

function AlertsTab({ employees }: { employees: Employee[] }) {
    const [target, setTarget] = useState('all');
    const [msg, setMsg] = useState('');
    const [sending, setSending] = useState(false);

    const send = async () => {
        if (!msg.trim()) return;
        setSending(true);
        const { error } = await supabase.from('messages').insert([{
            from_user: 'admin',
            to_user: target,
            content: msg.trim()
        }]);
        if (!error) {
            alert('تم إرسال التنبيه بنجاح');
            setMsg('');
        } else alert('خطأ في الإرسال');
        setSending(false);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold border-b pb-4 flex items-center gap-2"><Bell className="w-6 h-6 text-orange-500" /> إرسال تنبيهات للعاملين</h2>
            <div className="bg-gray-50 p-6 rounded-2xl border space-y-4">
                <Select 
                    label="المستهدف بالتنبيه" 
                    options={[{value: 'all', label: 'الجميع'}, ...employees.map(e => ({value: e.employee_id, label: e.name}))]} 
                    value={target} 
                    onChange={setTarget} 
                />
                <div className="text-right">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">نص التنبيه</label>
                    <textarea 
                        className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
                        rows={4} 
                        placeholder="اكتب التنبيه أو الرسالة هنا..."
                        value={msg}
                        onChange={(e) => setMsg(e.target.value)}
                    />
                </div>
                <button 
                    onClick={send}
                    disabled={sending}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                    <Send className="w-4 h-4" /> {sending ? 'جاري الإرسال...' : 'إرسال التنبيه الآن'}
                </button>
            </div>
        </div>
    );
}

function ReportsTab({ employees }: { employees: Employee[] }) {
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<GeneralSettings | null>(null);

  useEffect(() => {
    supabase.from('general_settings').select('*').limit(1).single().then(({data}) => setSettings(data));
  }, []);

  const fetchFullReport = async () => {
    setLoading(true);
    const { data } = await supabase.from('attendance').select('*').order('date', {ascending: false}).limit(200);
    if(data) setReportData(data);
    setLoading(false);
  };

  const exportExcel = () => {
    const formatted = reportData.map(r => {
      const times = r.times.split(/\s+/).filter((t:string) => t.includes(':'));
      const cin = times[0] || null;
      const cout = times.length > 1 ? times[times.length - 1] : null;
      const hours = (cin && cout) ? calculateHours(cin, cout).toFixed(1) : '0.0';
      const statusIn = cin ? (settings?.shift_morning_in && cin > settings.shift_morning_in ? "متأخر" : "منتظم") : "غائب";
      const statusOut = cout ? "انصراف" : (cin ? "ترك عمل" : "--");

      return {
        'رقم الموظف': r.employee_id,
        'التاريخ': r.date,
        'وقت الحضور': cin || '--',
        'حالة الحضور': statusIn,
        'وقت الانصراف': cout || '--',
        'حالة الانصراف': statusOut,
        'ساعات العمل': hours
      };
    });
    const ws = XLSX.utils.json_to_sheet(formatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AttendanceReport");
    XLSX.writeFile(wb, "MedicalCenter_FullReport.xlsx");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-emerald-600"/> تقارير الحضور الشاملة</h2>
        <button onClick={exportExcel} disabled={reportData.length === 0} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center shadow-md disabled:bg-gray-400"><FileSpreadsheet className="w-4 h-4 ml-2" /> تصدير إكسيل</button>
      </div>
      <button onClick={fetchFullReport} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-blue-700 transition-all">{loading ? 'جاري التحميل...' : 'توليد أحدث تقرير'}</button>
      <div className="overflow-x-auto border rounded-xl shadow-sm bg-white">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100">
            <tr>
                <th className="p-3">الموظف</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">حضور</th>
                <th className="p-3">حالة الحضور</th>
                <th className="p-3">انصراف</th>
                <th className="p-3">ساعات</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((r,i) => {
              const times = r.times.split(/\s+/).filter((t:string) => t.includes(':'));
              const cin = times[0];
              const cout = times.length > 1 ? times[times.length - 1] : null;
              const statusIn = cin ? (settings?.shift_morning_in && cin > settings.shift_morning_in ? "متأخر" : "منتظم") : "غائب";
              return (
                <tr key={i} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="p-3 font-mono font-bold text-blue-600">{r.employee_id}</td>
                  <td className="p-3 font-bold">{r.date}</td>
                  <td className="p-3 text-emerald-600 font-bold">{cin || '--'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusIn === 'منتظم' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{statusIn}</span>
                  </td>
                  <td className="p-3 text-red-500 font-bold">{cout || '--'}</td>
                  <td className="p-3 font-mono font-bold">{(cin && cout) ? calculateHours(cin, cout).toFixed(1) : '0.0'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- المكون الرئيسي للمسؤول ---

interface AdminDashboardProps { onBack: () => void; }

const SidebarBtn = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-2xl transition-all font-bold ${active ? 'bg-blue-600 text-white shadow-xl' : 'bg-white text-gray-500 hover:bg-blue-50 border'}`}>
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
        <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md border border-gray-100">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-8 hover:underline font-bold"><ArrowRight className="ml-2" /> العودة للرئيسية</button>
          <div className="text-center mb-8"><ShieldCheck className="w-12 h-12 text-blue-600 mx-auto mb-2" /><h2 className="text-3xl font-bold">بوابة الإدارة</h2></div>
          <div className="space-y-6">
            <select className="w-full p-4 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" onChange={(e) => setSelectedCenter(centers.find(c => c.id === e.target.value) || null)}>
              <option value="">-- اختر المركز الطبي --</option>
              {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}
            </select>
            <input type="password" className="w-full p-4 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" placeholder="كلمة المرور" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            <button onClick={() => { if(selectedCenter && adminPassword === selectedCenter.password) { setIsAdminLoggedIn(true); fetchDashboardData(); } else alert('خطأ في البيانات'); }} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all">دخول لوحة التحكم</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-10 text-right">
      <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-3xl shadow-sm border">
        <div><h1 className="text-3xl font-black text-gray-800 tracking-tight">إدارة: {selectedCenter?.center_name}</h1></div>
        <button onClick={onBack} className="bg-red-50 text-red-600 px-6 py-2 rounded-xl font-bold flex items-center hover:bg-red-100 transition-all shadow-sm"><LogOut className="ml-2 w-5 h-5"/> خروج</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-3">
          <SidebarBtn active={activeTab === 'settings'} icon={<Settings className="w-5 h-5"/>} label="إعدادات المركز" onClick={() => setActiveTab('settings')} />
          <SidebarBtn active={activeTab === 'doctors'} icon={<Users className="w-5 h-5"/>} label="شئون الموظفين" onClick={() => setActiveTab('doctors')} />
          <SidebarBtn active={activeTab === 'leaves'} icon={<FileText className="w-5 h-5"/>} label="طلبات الإجازة" onClick={() => setActiveTab('leaves')} />
          <SidebarBtn active={activeTab === 'attendance'} icon={<Clock className="w-5 h-5"/>} label="سجل الحضور" onClick={() => setActiveTab('attendance')} />
          <SidebarBtn active={activeTab === 'reports'} icon={<BarChart3 className="w-5 h-5"/>} label="التقارير المالية" onClick={() => setActiveTab('reports')} />
          <SidebarBtn active={activeTab === 'alerts'} icon={<Bell className="w-5 h-5"/>} label="التنبيهات" onClick={() => setActiveTab('alerts')} />
        </div>
        <div className="lg:col-span-3 bg-white p-8 rounded-3xl shadow-sm border border-gray-100 min-h-[600px]">
          {activeTab === 'settings' && selectedCenter && <GeneralSettingsTab center={selectedCenter} />}
          {activeTab === 'doctors' && <DoctorsTab employees={employees} onRefresh={fetchDashboardData} centerId={selectedCenter!.id} settings={selectedCenter} />}
          {activeTab === 'leaves' && <LeavesTab requests={leaveRequests} onRefresh={fetchDashboardData} />}
          {activeTab === 'attendance' && <AttendanceTab employees={employees} onRefresh={fetchDashboardData} />}
          {activeTab === 'reports' && <ReportsTab employees={employees} />}
          {activeTab === 'alerts' && <AlertsTab employees={employees} />}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
