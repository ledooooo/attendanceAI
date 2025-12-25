
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, User, Calendar, FilePlus, ClipboardCheck, MessageCircle, Send, LogOut, Clock, AlertTriangle, CheckCircle, List, BarChart, Inbox, FileText, Award, Printer, Share2, X, Filter, PieChart, Info, MapPin, Phone, Mail, Hash, Briefcase, CalendarDays, ShieldCheck
} from 'lucide-react';
import { Employee, LeaveRequest, AttendanceRecord, InternalMessage, GeneralSettings, Evaluation } from '../types';

interface StaffDashboardProps {
  onBack: () => void;
  employee: Employee | null;
  setEmployee: (emp: Employee | null) => void;
}

const LEAVE_TYPES = [
  "اجازة عارضة", "اجازة اعتيادية", "اجازة مرضى", "جزء من الوقت", "خط سير", "مأمورية", "دورة تدريبية", "بيان حالة وظيفية"
];

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

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

const Input = ({ label, type = 'text', value, onChange, placeholder, required = false }: any) => (
  <div className="text-right">
    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">{label} {required && <span className="text-red-500">*</span>}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all" placeholder={placeholder} />
  </div>
);

const Select = ({ label, options, value, onChange }: any) => (
  <div className="text-right">
    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
      <option value="">-- اختر --</option>
      {options.map((opt: any) => typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

const StaffDashboard: React.FC<StaffDashboardProps> = ({ onBack, employee, setEmployee }) => {
  const [loginData, setLoginData] = useState({ id: '', natId: '' });
  const [activeTab, setActiveTab] = useState('profile');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [allMyRequests, setAllMyRequests] = useState<LeaveRequest[]>([]);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const fetchStaffData = async (empId: string) => {
    const [attRes, leaveRes, setRes, myReqRes, msgRes, evalRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('employee_id', empId),
      supabase.from('leave_requests').select('*').eq('employee_id', empId).eq('status', 'مقبول'),
      supabase.from('general_settings').select('*').limit(1).single(),
      supabase.from('leave_requests').select('*').eq('employee_id', empId).order('created_at', { ascending: false }),
      supabase.from('messages').select('*').or(`to_user.eq.${empId},to_user.eq.all`).order('created_at', { ascending: false }),
      supabase.from('evaluations').select('*').eq('employee_id', empId).order('month', { ascending: false })
    ]);
    if (attRes.data) setAttendance(attRes.data);
    if (leaveRes.data) setLeaves(leaveRes.data);
    if (setRes.data) setSettings(setRes.data);
    if (myReqRes.data) setAllMyRequests(myReqRes.data);
    if (msgRes.data) setMessages(msgRes.data);
    if (evalRes.data) setEvaluations(evalRes.data);
  };

  useEffect(() => { if (employee) fetchStaffData(employee.employee_id); }, [employee]);

  const calculateHours = (inT: string, outT: string) => {
    if (!inT || !outT) return 0;
    const [h1, m1] = inT.split(':').map(Number);
    const [h2, m2] = outT.split(':').map(Number);
    let diff = (new Date(0,0,0,h2,m2).getTime() - new Date(0,0,0,h1,m1).getTime()) / 3600000;
    if (diff < 0) diff += 24;
    return diff;
  };

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-6 text-right">
        <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md border border-gray-100 animate-in fade-in duration-500">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-8 font-bold hover:scale-105 transition-transform"><ArrowRight className="ml-2 w-4 h-4" /> العودة للرئيسية</button>
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-emerald-100">
              <User className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-3xl font-black text-gray-800">بوابة الموظف</h2>
            <p className="text-gray-400 text-sm mt-2">يرجى إدخال بيانات الدخول الخاصة بك</p>
          </div>
          <div className="space-y-5">
            <Input label="رقم الموظف (ID)" value={loginData.id} onChange={(v:any) => setLoginData({...loginData, id: v})} placeholder="12345" />
            <Input label="الرقم القومي" type="password" value={loginData.natId} onChange={(v:any) => setLoginData({...loginData, natId: v})} placeholder="14 رقم" />
            <button 
              onClick={async () => {
                setLoading(true);
                const { data } = await supabase.from('employees').select('*').eq('employee_id', loginData.id).eq('national_id', loginData.natId).maybeSingle();
                if(data) { setEmployee(data); fetchStaffData(data.employee_id); } else alert('البيانات المدخلة غير صحيحة');
                setLoading(false);
              }} 
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-emerald-700 transition-all active:scale-95 flex justify-center items-center gap-2"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'تسجيل الدخول'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 text-right">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border mb-8 flex flex-col md:flex-row justify-between items-center no-print">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center border-2 border-emerald-100 overflow-hidden shadow-inner">
              {employee.photo_url ? <img src={employee.photo_url} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-emerald-600" />}
            </div>
            <div className="absolute -bottom-1 -left-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white"></div>
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">{employee.name}</h1>
            <p className="text-gray-400 font-bold text-sm">{employee.specialty} • {employee.employee_id}</p>
          </div>
        </div>
        <button onClick={() => setEmployee(null)} className="flex items-center text-red-500 font-black bg-red-50 px-6 py-2.5 rounded-xl hover:bg-red-100 transition-all shadow-sm active:scale-95">خروج <LogOut className="mr-3 w-5 h-5"/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1 space-y-2 no-print">
           <StaffNav active={activeTab === 'profile'} icon={<User className="w-5 h-5"/>} label="الملف الشخصي" onClick={() => setActiveTab('profile')} />
           <StaffNav active={activeTab === 'attendance'} icon={<Clock className="w-5 h-5"/>} label="سجل الحضور" onClick={() => setActiveTab('attendance')} />
           <StaffNav active={activeTab === 'new-request'} icon={<FilePlus className="w-5 h-5"/>} label="تقديم طلب" onClick={() => setActiveTab('new-request')} />
           <StaffNav active={activeTab === 'requests-history'} icon={<List className="w-5 h-5"/>} label="سجل الطلبات" onClick={() => setActiveTab('requests-history')} />
           <StaffNav active={activeTab === 'print-tab'} icon={<Printer className="w-5 h-5"/>} label="طباعة طلب" onClick={() => setActiveTab('print-tab')} />
           <StaffNav active={activeTab === 'evals'} icon={<Award className="w-5 h-5"/>} label="التقييمات الشهرية" onClick={() => setActiveTab('evals')} />
           <StaffNav active={activeTab === 'messages'} icon={<Inbox className="w-5 h-5"/>} label="الرسائل والتنبيهات" onClick={() => setActiveTab('messages')} />
           <StaffNav active={activeTab === 'stats'} icon={<PieChart className="w-5 h-5"/>} label="الإحصائيات" onClick={() => setActiveTab('stats')} />
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3 bg-white p-8 rounded-3xl shadow-sm border border-gray-100 min-h-[600px] relative overflow-hidden">
          {activeTab === 'profile' && <StaffProfile employee={employee} />}
          {activeTab === 'attendance' && (
            <StaffAttendance 
                attendance={attendance} 
                selectedMonth={selectedMonth} 
                setSelectedMonth={setSelectedMonth} 
                calculateHours={calculateHours}
                employee={employee}
            />
          )}
          {activeTab === 'new-request' && <StaffNewRequest employee={employee} refresh={() => fetchStaffData(employee.employee_id)} />}
          {activeTab === 'requests-history' && <StaffRequestsHistory requests={allMyRequests} />}
          {activeTab === 'print-tab' && <StaffPrintTab requests={allMyRequests} employee={employee} />}
          {activeTab === 'evals' && <StaffEvaluations evals={evaluations} />}
          {activeTab === 'messages' && <StaffMessages messages={messages} />}
          {activeTab === 'stats' && <StaffStats attendance={attendance} employee={employee} month={selectedMonth} />}
        </div>
      </div>
    </div>
  );
};

// --- التبويبات الفرعية ---

const ProfileItem = ({ label, value, icon: Icon }: any) => (
    <div className="p-4 bg-gray-50 rounded-2xl border flex items-center gap-4 group hover:bg-white hover:border-emerald-200 transition-all">
        <div className="p-3 bg-white rounded-xl text-emerald-600 shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">{Icon && <Icon className="w-5 h-5" />}</div>
        <div className="flex-1">
            <label className="text-[10px] text-gray-400 font-black block mb-1 uppercase tracking-widest">{label}</label>
            <p className="font-bold text-gray-800">{value || '--'}</p>
        </div>
    </div>
);

const StaffProfile = ({ employee }: { employee: Employee }) => {
    return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800 border-b pb-4"><User className="text-emerald-600 w-7 h-7" /> الملف الشخصي الكامل</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ProfileItem label="الاسم الرباعي" value={employee.name} icon={User} />
                <ProfileItem label="الكود الوظيفي" value={employee.employee_id} icon={Hash} />
                <ProfileItem label="الرقم القومي" value={employee.national_id} icon={ShieldCheck} />
                <ProfileItem label="التخصص الوظيفي" value={employee.specialty} icon={Briefcase} />
                <ProfileItem label="الدرجة الوظيفية" value={employee.grade} icon={Award} />
                <ProfileItem label="رقم التواصل" value={employee.phone} icon={Phone} />
                <ProfileItem label="البريد الإلكتروني" value={employee.email} icon={Mail} />
                <ProfileItem label="تاريخ التعيين" value={employee.join_date} icon={CalendarDays} />
                <ProfileItem label="توقيت الحضور" value={employee.start_time} icon={Clock} />
                <ProfileItem label="توقيت الانصراف" value={employee.end_time} icon={Clock} />
                <ProfileItem label="الجنس" value={employee.gender} icon={User} />
                <ProfileItem label="الديانة" value={employee.religion} icon={Info} />
            </div>
            <div className="grid grid-cols-1 gap-6">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <label className="text-[10px] text-emerald-600 font-black block mb-2 uppercase tracking-widest">أيام العمل الأسبوعية</label>
                    <div className="flex flex-wrap gap-2">
                        {(employee.work_days && employee.work_days.length > 0 && !employee.work_days.includes("الكل")) ? (
                            employee.work_days.map(d => <span key={d} className="bg-white px-4 py-2 rounded-xl text-sm font-bold border border-emerald-200">{d}</span>)
                        ) : (
                            <span className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-sm">يعمل طوال الأسبوع (عدا الجمعة)</span>
                        )}
                    </div>
                </div>
                {employee.admin_tasks && <ProfileItem label="المهام الإدارية المسندة" value={employee.admin_tasks} icon={Briefcase} />}
                {employee.notes && <ProfileItem label="ملاحظات الموارد البشرية" value={employee.notes} icon={FileText} />}
            </div>
        </div>
    );
};

const StaffAttendance = ({ attendance, selectedMonth, setSelectedMonth, calculateHours, employee }: any) => {
    return (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
            <div className="flex justify-between items-center mb-6 no-print">
                <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><Clock className="text-emerald-600 w-7 h-7" /> سجل الحضور والانصراف</h3>
                <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-gray-400">اختر الشهر:</label>
                    <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="p-2.5 border rounded-2xl font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
            </div>
            <div className="overflow-x-auto border rounded-3xl shadow-sm bg-white">
                <table className="w-full text-sm text-right">
                  <thead className="bg-gray-100 font-black">
                    <tr className="border-b">
                        <th className="p-4">التاريخ</th>
                        <th className="p-4">اليوم</th>
                        <th className="p-4 text-emerald-600">توقيت الحضور</th>
                        <th className="p-4">حالة الحضور</th>
                        <th className="p-4 text-red-500">توقيت الانصراف</th>
                        <th className="p-4">حالة الانصراف</th>
                        <th className="p-4">ساعات العمل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 31 }, (_, i) => {
                      const day = i + 1;
                      const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                      const att = attendance.find((a:any) => a.date === dateStr);
                      const dObj = new Date(dateStr);
                      const daysCount = new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]), 0).getDate();
                      if (day > daysCount) return null;
                      
                      const dayName = DAYS_AR[dObj.getDay()];
                      const isFriday = dObj.getDay() === 5;
                      const isWorkDay = (!employee.work_days || employee.work_days.length === 0 || employee.work_days.includes("الكل") || employee.work_days.includes(dayName));

                      const times = att?.times.split(/\s+/).filter((t:string) => t.includes(':')) || [];
                      const cin = times[0] || '--';
                      const cout = times.length > 1 ? times[times.length - 1] : '--';
                      const hours = times.length >= 2 ? calculateHours(times[0], times[times.length-1]).toFixed(1) : '0.0';

                      let rowClass = "border-b hover:bg-gray-50 transition-colors";
                      if (isFriday) rowClass = "border-b bg-gray-50 text-gray-400";
                      else if (!isWorkDay && !att) rowClass = "border-b bg-amber-50/30 text-amber-600";

                      return (
                        <tr key={dateStr} className={rowClass}>
                          <td className="p-4 font-bold">{dateStr}</td>
                          <td className="p-4 font-bold">{dayName}</td>
                          <td className="p-4 text-emerald-600 font-black">{cin}</td>
                          <td className="p-4 font-bold">{isFriday ? 'عطلة' : (!isWorkDay && !att ? 'جزء من الوقت' : getCheckInLabel(cin))}</td>
                          <td className="p-4 text-red-500 font-black">{cout}</td>
                          <td className="p-4 font-bold">{isFriday ? 'عطلة' : (!isWorkDay && !att ? 'جزء من الوقت' : getCheckOutLabel(cout))}</td>
                          <td className="p-4 font-mono font-black text-center">{hours}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
        </div>
    );
};

const StaffNewRequest = ({ employee, refresh }: any) => {
    const [formData, setFormData] = useState({ type: '', start: '', end: '', backup: '', notes: '' });
    const [submitting, setSubmitting] = useState(false);

    const submit = async () => {
        if(!formData.type || !formData.start || !formData.end) return alert('برجاء إكمال البيانات الأساسية');
        setSubmitting(true);
        const { error } = await supabase.from('leave_requests').insert([{ 
            employee_id: employee.employee_id, 
            type: formData.type, 
            start_date: formData.start, 
            end_date: formData.end, 
            backup_person: formData.backup, 
            status: 'معلق',
            notes: formData.notes 
        }]);
        if(!error) { 
            alert('تم إرسال الطلب بنجاح وهو الآن تحت المراجعة'); 
            setFormData({ type: '', start: '', end: '', backup: '', notes: '' }); 
            refresh(); 
        } else alert(error.message);
        setSubmitting(false);
    };

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><FilePlus className="text-emerald-600 w-7 h-7" /> تقديم طلب إجازة / مأمورية</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-emerald-50/50 p-8 rounded-3xl border border-emerald-100 shadow-inner">
                <div className="md:col-span-2"><Select label="نوع الطلب" options={LEAVE_TYPES} value={formData.type} onChange={(v:any)=>setFormData({...formData, type: v})} /></div>
                <Input label="من تاريخ" type="date" value={formData.start} onChange={(v:any)=>setFormData({...formData, start: v})} />
                <Input label="إلى تاريخ" type="date" value={formData.end} onChange={(v:any)=>setFormData({...formData, end: v})} />
                <Input label="الموظف البديل (إن وجد)" value={formData.backup} onChange={(v:any)=>setFormData({...formData, backup: v})} placeholder="الاسم أو الكود" />
                <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">ملاحظات إضافية</label>
                    <textarea value={formData.notes} onChange={e=>setFormData({...formData, notes: e.target.value})} className="w-full p-4 border rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white" rows={3} placeholder="أي تفاصيل أخرى..." />
                </div>
                <button 
                    onClick={submit} 
                    disabled={submitting}
                    className="md:col-span-2 bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:bg-emerald-700 transition-all active:scale-95 disabled:bg-gray-400"
                >
                    {submitting ? 'جاري الإرسال...' : 'إرسال الطلب للاعتماد'}
                </button>
            </div>
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-4 items-start">
                <Info className="w-6 h-6 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-800 leading-relaxed"><b>تنبيه:</b> سيتم خصم رصيد الإجازة تلقائياً من رصيدك المتبقي بمجرد اعتماد الطلب من قبل الإدارة. يرجى التأكد من التواريخ المختارة بدقة.</p>
            </div>
        </div>
    );
};

const StaffRequestsHistory = ({ requests }: { requests: LeaveRequest[] }) => {
    const [filter, setFilter] = useState('all');
    const filtered = requests.filter(r => filter === 'all' || r.status === filter);

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
            <div className="flex justify-between items-center no-print">
                <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><List className="text-emerald-600 w-7 h-7" /> سجل طلباتي</h3>
                <div className="flex bg-gray-100 p-1 rounded-xl border">
                    <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filter === 'all' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>الكل</button>
                    <button onClick={() => setFilter('معلق')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filter === 'معلق' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-400'}`}>معلق</button>
                    <button onClick={() => setFilter('مقبول')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filter === 'مقبول' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'}`}>مقبول</button>
                    <button onClick={() => setFilter('مرفوض')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filter === 'مرفوض' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400'}`}>مرفوض</button>
                </div>
            </div>
            <div className="grid gap-4">
                {filtered.map(r => (
                    <div key={r.id} className="p-6 bg-white border rounded-3xl flex justify-between items-center shadow-sm hover:shadow-md transition-all">
                        <div className="flex gap-4 items-center">
                            <div className={`p-3 rounded-2xl ${r.status === 'مقبول' ? 'bg-green-50 text-green-600' : r.status === 'مرفوض' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                <FileText className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-black text-lg text-gray-800">{r.type}</h4>
                                <p className="text-sm text-gray-400">من {r.start_date} إلى {r.end_date}</p>
                            </div>
                        </div>
                        <div className={`px-4 py-2 rounded-xl text-xs font-black shadow-sm ${r.status === 'مقبول' ? 'bg-green-600 text-white' : r.status === 'مرفوض' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
                            {r.status}
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && <div className="text-center py-24 text-gray-400 border-2 border-dashed rounded-3xl font-bold">لا توجد طلبات في السجل حالياً</div>}
            </div>
        </div>
    );
};

const StaffPrintTab = ({ requests, employee }: any) => {
    const [selectedReq, setSelectedReq] = useState<any>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    const approved = requests.filter((r:any) => r.status === 'مقبول');

    const handlePrint = (req: any) => {
        setSelectedReq(req);
        setTimeout(() => window.print(), 300);
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800 no-print"><Printer className="text-emerald-600 w-7 h-7" /> طباعة الطلبات والبيانات</h3>
            <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 no-print">
                <p className="text-sm font-bold text-gray-500 mb-4">اختر الطلب المراد طباعته من القائمة المعتمدة:</p>
                <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
                    {approved.map((r:any) => (
                        <button 
                            key={r.id} 
                            onClick={() => handlePrint(r)}
                            className="p-5 bg-white border rounded-2xl flex justify-between items-center hover:border-emerald-500 transition-all text-right shadow-sm group"
                        >
                            <div>
                                <h4 className="font-bold text-gray-800 group-hover:text-emerald-600 transition-colors">{r.type}</h4>
                                <p className="text-xs text-gray-400">الفترة: {r.start_date} إلى {r.end_date}</p>
                            </div>
                            <Printer className="w-5 h-5 text-gray-300 group-hover:text-emerald-500" />
                        </button>
                    ))}
                    {approved.length === 0 && <p className="text-center py-10 text-gray-400 font-bold">لا يوجد طلبات معتمدة متاحة للطباعة</p>}
                </div>
            </div>

            {/* Print Layout */}
            {selectedReq && (
                <div className="hidden print:block p-8 text-right font-serif" dir="rtl" style={{ minHeight: '297mm' }}>
                    {/* Official Header */}
                    <div className="flex justify-between items-start border-b-4 border-black pb-4 mb-8">
                        <div className="text-center space-y-1">
                            <h2 className="font-black text-xl">مديرية الجيزة للشئون الصحية</h2>
                            <h3 className="font-bold text-lg">ادارة شمال الجيزة</h3>
                            <h4 className="font-bold">مركز غرب المطار</h4>
                        </div>
                        <div className="w-24 h-24 bg-gray-100 flex items-center justify-center border border-gray-300">
                             <img src="https://upload.wikimedia.org/wikipedia/ar/thumb/a/a2/Logo_Ministry_of_Health_and_Population_%28Egypt%29.svg/1200px-Logo_Ministry_of_Health_and_Population_%28Egypt%29.svg.png" alt="MOH" className="w-20" />
                        </div>
                    </div>

                    {/* Content Title */}
                    <div className="text-center my-12">
                        <h1 className="text-3xl font-black underline decoration-2 underline-offset-8 uppercase">{selectedReq.type}</h1>
                    </div>

                    {/* Main Content Body */}
                    <div className="space-y-8 text-lg leading-loose mt-16 px-6">
                        <p>السيد الدكتور / مدير المركز الطبي</p>
                        <p className="mr-8">تحية طيبة وبعد،،،</p>
                        <p className="mr-8">أرجو من سيادتكم الموافقة على منحي <b>{selectedReq.type}</b> وذلك للفترة من تاريخ <b>{selectedReq.start_date}</b> وحتى تاريخ <b>{selectedReq.end_date}</b>.</p>
                        
                        <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-200 mt-10">
                            <p className="font-black mb-4 underline">بيانات المتقدم بالطلب:</p>
                            <div className="grid grid-cols-2 gap-4 text-base">
                                <p>الاسم: <b>{employee.name}</b></p>
                                <p>الكود الوظيفي: <b>{employee.employee_id}</b></p>
                                <p>التخصص: <b>{employee.specialty}</b></p>
                                <p>تاريخ الطلب: <b>{new Date(selectedReq.created_at).toLocaleDateString('ar-EG')}</b></p>
                            </div>
                        </div>

                        {selectedReq.backup_person && (
                            <p className="mt-6">الموظف القائم بالعمل البديل: <b>{selectedReq.backup_person}</b></p>
                        )}
                        
                        <p className="mt-8">وتفضلوا بقبول فائق الاحترام والتقدير،،،</p>
                    </div>

                    {/* Signature Section */}
                    <div className="mt-32 grid grid-cols-2 gap-20 text-center">
                        <div className="space-y-16">
                            <p className="font-black border-b border-black pb-2 mx-10">توقيع الموظف</p>
                            <p className="text-sm font-bold">{employee.name}</p>
                        </div>
                        <div className="space-y-16">
                            <p className="font-black border-b border-black pb-2 mx-10">رئيس شئون العاملين</p>
                            <p>................................</p>
                        </div>
                    </div>
                    
                    <div className="mt-20 text-center">
                        <div className="inline-block border-2 border-black p-6 rounded-xl">
                            <p className="font-black text-xl mb-6">يعتمد ،،،</p>
                            <p className="font-bold text-lg">مدير المركز الطبي</p>
                            <p className="mt-12">................................</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StaffEvaluations = ({ evals }: { evals: Evaluation[] }) => {
    return (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500 text-right">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><Award className="text-emerald-600 w-7 h-7" /> تقييماتي الشهرية</h3>
            <div className="grid gap-6">
                {evals.map(ev => {
                    // Mapping Evaluation properties to labels for display
                    const criteria = [
                        { label: 'المظهر', score: ev.score_appearance, max: 10 },
                        { label: 'الحضور', score: ev.score_attendance, max: 20 },
                        { label: 'الجودة', score: ev.score_quality, max: 10 },
                        { label: 'العدوى', score: ev.score_infection, max: 10 },
                        { label: 'التدريب', score: ev.score_training, max: 20 },
                        { label: 'الملفات', score: ev.score_records, max: 20 },
                        { label: 'المهام', score: ev.score_tasks, max: 10 },
                    ];
                    
                    return (
                        <div key={ev.id} className="p-8 bg-white border rounded-3xl shadow-sm hover:shadow-md transition-all border-emerald-100 border-r-8 border-r-emerald-600">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="font-black text-xl text-emerald-700">شهر: {ev.month}</h4>
                                <div className="text-3xl font-black text-emerald-600">{ev.total_score} <span className="text-sm text-gray-400">/ 100</span></div>
                            </div>
                            <p className="text-sm text-gray-600 leading-relaxed mb-4"><b>ملاحظات الإدارة:</b> {ev.notes || 'لا توجد ملاحظات إضافية'}</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mt-4">
                                {criteria.map((c, i) => (
                                    <div key={i} className="bg-gray-50 p-2 rounded-xl text-center border">
                                        <p className="text-[10px] text-gray-400 font-bold mb-1">{c.label} ({c.max})</p>
                                        <p className="font-bold text-emerald-600">{c.score}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
                {evals.length === 0 && <div className="text-center py-24 text-gray-400 border-2 border-dashed rounded-3xl font-bold">لم يتم تسجيل تقييمات لك بعد</div>}
            </div>
        </div>
    );
};

const StaffMessages = ({ messages }: { messages: InternalMessage[] }) => (
    <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
        <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><Inbox className="text-emerald-600 w-7 h-7" /> الرسائل والتنبيهات</h3>
        <div className="space-y-4">
            {messages.map((m: any) => (
                <div key={m.id} className={`p-6 rounded-3xl border-2 transition-all ${m.from_user === 'admin' ? 'bg-white border-blue-50 hover:border-blue-200' : 'bg-gray-50 border-transparent'}`}>
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.from_user === 'admin' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
                                {m.from_user === 'admin' ? <ShieldCheck className="w-5 h-5"/> : <User className="w-5 h-5"/>}
                            </div>
                            <span className="font-black text-sm">{m.from_user === 'admin' ? 'إدارة المركز' : 'رسالة مرسلة'}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold">{new Date(m.created_at).toLocaleString('ar-EG')}</span>
                    </div>
                    <p className="text-gray-700 leading-relaxed text-sm pr-13">{m.content}</p>
                </div>
            ))}
            {messages.length === 0 && <div className="text-center py-24 text-gray-400 border-2 border-dashed rounded-3xl font-bold">صندوق الرسائل فارغ حالياً</div>}
        </div>
    </div>
);

const StaffStats = ({ attendance, employee, month }: any) => {
    const stats = useMemo(() => {
        const atts = attendance.filter((a:any) => a.date.startsWith(month));
        let totalHours = 0;
        atts.forEach((a:any) => {
            const times = a.times.split(/\s+/).filter((t:string) => t.includes(':'));
            if (times.length >= 2) {
                totalHours += ((new Date(0,0,0,...times[times.length-1].split(':').map(Number)).getTime() - new Date(0,0,0,...times[0].split(':').map(Number)).getTime()) / 3600000);
            }
        });
        return {
            days: atts.length,
            hours: totalHours.toFixed(1),
            leaves: 0 // Fetch from actual leave count if possible
        };
    }, [attendance, month]);

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><BarChart className="text-emerald-600 w-7 h-7" /> إحصائيات الأداء لشهر {month}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-emerald-600 p-8 rounded-3xl text-white shadow-xl shadow-emerald-100 relative overflow-hidden group">
                    <PieChart className="absolute -right-4 -bottom-4 w-32 h-32 text-emerald-500/30 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-black uppercase opacity-80 mb-2">إجمالي الساعات المسجلة</p>
                    <h4 className="text-5xl font-black mb-4">{stats.hours} <span className="text-xl">ساعة</span></h4>
                </div>
                <div className="bg-blue-600 p-8 rounded-3xl text-white shadow-xl shadow-blue-100 relative overflow-hidden group">
                    <Calendar className="absolute -right-4 -bottom-4 w-32 h-32 text-blue-500/30 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-black uppercase opacity-80 mb-2">عدد أيام الحضور الفعلي</p>
                    <h4 className="text-5xl font-black mb-4">{stats.days} <span className="text-xl">يوم</span></h4>
                </div>
            </div>
            <div className="p-8 bg-gray-50 rounded-3xl border border-gray-100">
                <h4 className="font-black text-gray-800 mb-6 flex items-center gap-2"><Info className="w-5 h-5 text-gray-400" /> ملخص رصيد الإجازات</h4>
                <div className="space-y-4">
                    <BalanceBar label="رصيد الإجازات الاعتيادية" remaining={employee.remaining_annual} total={employee.leave_annual_balance} color="bg-emerald-500" />
                    <BalanceBar label="رصيد الإجازات العارضة" remaining={employee.remaining_casual} total={employee.leave_casual_balance} color="bg-blue-500" />
                </div>
            </div>
        </div>
    );
};

const BalanceBar = ({ label, remaining, total, color }: any) => {
    const percent = total > 0 ? (remaining / total) * 100 : 0;
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-xs font-black uppercase">
                <span>{label}</span>
                <span className="text-gray-400">{remaining} من {total}</span>
            </div>
            <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
                <div className={`${color} h-full rounded-full transition-all duration-1000`} style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
};

const StaffNav = ({ active, icon, label, onClick }: any) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center p-4 rounded-2xl font-black transition-all active:scale-95 ${active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 border-2 border-emerald-600' : 'bg-white text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 border-2 border-transparent'}`}
  >
    <span className="ml-3 p-2 rounded-xl bg-gray-50 group-hover:bg-white transition-colors">{icon}</span>
    {label}
  </button>
);

export default StaffDashboard;
