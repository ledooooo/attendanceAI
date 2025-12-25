
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, User, Calendar, FilePlus, ClipboardCheck, MessageCircle, Send, LogOut, Clock, AlertTriangle, CheckCircle, List, BarChart, Inbox, FileText, Award, Printer, Share2, X, Filter, PieChart, Info, MapPin, Phone, Mail, Hash, Briefcase, CalendarDays, ShieldCheck, FileImage, LayoutGrid, TrendingUp, Baby
} from 'lucide-react';
import { Employee, LeaveRequest, AttendanceRecord, InternalMessage, GeneralSettings, Evaluation } from '../types';

interface StaffDashboardProps {
  onBack: () => void;
  employee: Employee | null;
  setEmployee: (emp: Employee | null) => void;
}

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const Input = ({ label, type = 'text', value, onChange, placeholder, required = false }: any) => (
  <div className="text-right">
    <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-widest">{label} {required && <span className="text-red-500">*</span>}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-sm" placeholder={placeholder} />
  </div>
);

const Select = ({ label, options, value, onChange }: any) => (
  <div className="text-right">
    <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-widest">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm">
      <option value="">-- اختر --</option>
      {options.map((opt: any) => typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

const StaffDashboard: React.FC<StaffDashboardProps> = ({ onBack, employee, setEmployee }) => {
  const [loginData, setLoginData] = useState({ id: '', natId: '' });
  const [activeTab, setActiveTab] = useState('profile');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [allMyRequests, setAllMyRequests] = useState<LeaveRequest[]>([]);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const fetchStaffData = async (empId: string) => {
    const [attRes, setRes, myReqRes, msgRes, evalRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('employee_id', empId),
      supabase.from('general_settings').select('*').limit(1).single(),
      supabase.from('leave_requests').select('*').eq('employee_id', empId).order('created_at', { ascending: false }),
      supabase.from('messages').select('*').or(`to_user.eq.${empId},to_user.eq.all`).order('created_at', { ascending: false }),
      supabase.from('evaluations').select('*').eq('employee_id', empId).order('month', { ascending: false })
    ]);
    if (attRes.data) setAttendance(attRes.data);
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
      <div className="flex items-center justify-center min-h-[85vh] p-6 text-right">
        <div className="bg-white p-12 rounded-[50px] shadow-2xl w-full max-w-md border animate-in zoom-in">
          <button onClick={onBack} className="flex items-center text-emerald-600 mb-10 font-black"><ArrowRight className="ml-2 w-5 h-5" /> العودة</button>
          <div className="text-center mb-10">
            <User className="w-16 h-16 text-emerald-600 mx-auto mb-6" />
            <h2 className="text-3xl font-black">دخول العاملين</h2>
          </div>
          <div className="space-y-6">
            <Input label="رقم الموظف" value={loginData.id} onChange={(v:any) => setLoginData({...loginData, id: v})} />
            <Input label="الرقم القومي" type="password" value={loginData.natId} onChange={(v:any) => setLoginData({...loginData, natId: v})} />
            <button 
              onClick={async () => {
                setLoading(true);
                const { data } = await supabase.from('employees').select('*').eq('employee_id', loginData.id).eq('national_id', loginData.natId).maybeSingle();
                if(data) { setEmployee(data); fetchStaffData(data.employee_id); } else alert('البيانات غير صحيحة');
                setLoading(false);
              }} 
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-5 rounded-[25px] font-black shadow-xl"
            >
              دخول
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-10 text-right">
      <div className="bg-white p-10 rounded-[55px] shadow-sm mb-12 flex flex-col md:flex-row justify-between items-center no-print gap-6">
        <div className="flex items-center gap-8">
            <div className="w-24 h-24 bg-emerald-50 rounded-[35px] flex items-center justify-center border-4 border-white shadow-xl overflow-hidden">
              {employee.photo_url ? <img src={employee.photo_url} className="w-full h-full object-cover" /> : <User className="w-12 h-12 text-emerald-600" />}
            </div>
            <div>
                <h1 className="text-3xl font-black tracking-tighter">{employee.name} {employee.maternity && <span className="text-pink-500 inline-block align-middle"><Baby className="w-6 h-6 ml-2" /></span>}</h1>
                <p className="text-emerald-600 font-black text-lg">{employee.specialty} • كود: {employee.employee_id}</p>
            </div>
        </div>
        <button onClick={() => setEmployee(null)} className="text-red-600 font-black bg-red-50 px-10 py-4 rounded-[30px] hover:bg-red-100 transition-all shadow-sm">تسجيل خروج <LogOut className="mr-3 w-5 h-5"/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        <div className="lg:col-span-1 space-y-3 no-print bg-white p-6 rounded-[45px] border shadow-sm h-fit">
           <StaffNav active={activeTab === 'profile'} icon={<LayoutGrid className="w-5 h-5"/>} label="الملف الشخصي" onClick={() => setActiveTab('profile')} />
           <StaffNav active={activeTab === 'attendance'} icon={<Clock className="w-5 h-5"/>} label="سجل الحضور" onClick={() => setActiveTab('attendance')} />
           <StaffNav active={activeTab === 'new-request'} icon={<FilePlus className="w-5 h-5"/>} label="تقديم طلب" onClick={() => setActiveTab('new-request')} />
           <StaffNav active={activeTab === 'requests-history'} icon={<List className="w-5 h-5"/>} label="طلباتي" onClick={() => setActiveTab('requests-history')} />
           <StaffNav active={activeTab === 'messages'} icon={<Inbox className="w-5 h-5"/>} label="الرسائل" onClick={() => setActiveTab('messages')} />
        </div>

        <div className="lg:col-span-3 bg-white p-12 rounded-[60px] shadow-sm border min-h-[650px]">
          {activeTab === 'profile' && <StaffProfile employee={employee} />}
          {activeTab === 'attendance' && <StaffAttendance attendance={attendance} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} calculateHours={calculateHours} />}
          {activeTab === 'new-request' && <StaffNewRequest employee={employee} leaveTypes={settings?.leave_types || []} refresh={() => fetchStaffData(employee.employee_id)} />}
          {activeTab === 'requests-history' && <StaffRequestsHistory requests={allMyRequests} />}
          {activeTab === 'messages' && <StaffMessages messages={messages} />}
        </div>
      </div>
    </div>
  );
};

// --- المكونات الفرعية ---

const ProfileItem = ({ label, value, icon: Icon }: any) => (
    <div className="p-6 bg-gray-50/50 rounded-[30px] border flex items-center gap-5 hover:bg-white hover:shadow-xl transition-all">
        <div className="p-4 bg-white rounded-2xl text-emerald-600 shadow-md">{Icon && <Icon className="w-6 h-6" />}</div>
        <div className="flex-1">
            <label className="text-[10px] text-gray-400 font-black block mb-1 uppercase">{label}</label>
            <p className="font-bold text-gray-800 text-lg">{value || '--'}</p>
        </div>
    </div>
);

const StaffProfile = ({ employee }: { employee: Employee }) => (
    <div className="space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-8 bg-emerald-600 rounded-[45px] text-white shadow-xl flex items-center justify-between">
                <div>
                    <h4 className="font-black text-sm uppercase opacity-80 mb-2">رصيد الاعتيادي</h4>
                    <p className="text-5xl font-black">{employee.remaining_annual}</p>
                </div>
                <PieChart className="w-16 h-16 opacity-30" />
            </div>
            <div className="p-8 bg-blue-600 rounded-[45px] text-white shadow-xl flex items-center justify-between">
                <div>
                    <h4 className="font-black text-sm uppercase opacity-80 mb-2">رصيد العارضة</h4>
                    <p className="text-5xl font-black">{employee.remaining_casual}</p>
                </div>
                <TrendingUp className="w-16 h-16 opacity-30" />
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ProfileItem label="الاسم" value={employee.name} icon={User} />
            <ProfileItem label="الرقم القومي" value={employee.national_id} icon={ShieldCheck} />
            <ProfileItem label="الدرجة" value={employee.grade} icon={Award} />
            <ProfileItem label="التعيين" value={employee.join_date} icon={CalendarDays} />
            <ProfileItem label="مرضعة" value={employee.maternity ? 'نعم' : 'لا'} icon={Baby} />
            <ProfileItem label="موعد الحضور" value={employee.start_time} icon={Clock} />
        </div>
    </div>
);

const StaffAttendance = ({ attendance, selectedMonth, setSelectedMonth, calculateHours }: any) => (
    <div className="space-y-8">
        <div className="flex justify-between items-center no-print">
            <h3 className="text-2xl font-black">سجل الحضور</h3>
            <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="p-3 bg-gray-50 border rounded-2xl font-black outline-none" />
        </div>
        <div className="overflow-x-auto border rounded-[45px] shadow-xl bg-white">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-100 font-black">
                <tr><th className="p-6">التاريخ</th><th className="p-6">الحضور</th><th className="p-6">الانصراف</th><th className="p-6 text-center">الساعات</th></tr>
              </thead>
              <tbody>
                {attendance.filter((a:any)=>a.date.startsWith(selectedMonth)).sort((a:any,b:any)=>b.date.localeCompare(a.date)).map((a:any) => {
                  const t = a.times.split(/\s+/).filter((t:string) => t.includes(':'));
                  return (
                    <tr key={a.id} className="border-b hover:bg-emerald-50/30">
                      <td className="p-6 font-bold">{a.date}</td>
                      <td className="p-6 text-emerald-600 font-black">{t[0] || '--'}</td>
                      <td className="p-6 text-red-500 font-black">{t[t.length-1] || '--'}</td>
                      <td className="p-6 font-mono font-black text-center">{calculateHours(t[0], t[t.length-1]).toFixed(1)} س</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </div>
    </div>
);

const StaffNewRequest = ({ employee, leaveTypes, refresh }: any) => {
    const [formData, setFormData] = useState({ type: '', start: '', end: '', backup: '', notes: '' });
    const submit = async () => {
        if(!formData.type || !formData.start || !formData.end) return alert('أكمل البيانات');
        await supabase.from('leave_requests').insert([{ employee_id: employee.employee_id, type: formData.type, start_date: formData.start, end_date: formData.end, backup_person: formData.backup, status: 'معلق', notes: formData.notes }]);
        alert('تم الإرسال'); setFormData({ type: '', start: '', end: '', backup: '', notes: '' }); refresh();
    };
    return (
        <div className="space-y-10">
            <h3 className="text-2xl font-black border-r-4 border-emerald-600 pr-4">تقديم طلب</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-50/50 p-10 rounded-[50px] border shadow-inner">
                <div className="md:col-span-2"><Select label="نوع الطلب" options={leaveTypes.length > 0 ? leaveTypes : ["اجازة عارضة", "اجازة اعتيادية", "اجازة مرضى"]} value={formData.type} onChange={(v:any)=>setFormData({...formData, type: v})} /></div>
                <Input label="من" type="date" value={formData.start} onChange={(v:any)=>setFormData({...formData, start: v})} />
                <Input label="إلى" type="date" value={formData.end} onChange={(v:any)=>setFormData({...formData, end: v})} />
                <Input label="الموظف البديل" value={formData.backup} onChange={(v:any)=>setFormData({...formData, backup: v})} />
                <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-gray-400 mb-1">ملاحظات</label>
                    <textarea value={formData.notes} onChange={e=>setFormData({...formData, notes: e.target.value})} className="w-full p-4 border rounded-[25px] bg-white font-bold text-sm" rows={3} />
                </div>
                <button onClick={submit} className="md:col-span-2 bg-emerald-600 text-white py-5 rounded-[25px] font-black shadow-xl hover:bg-emerald-700">إرسال الطلب</button>
            </div>
        </div>
    );
};

const StaffRequestsHistory = ({ requests }: { requests: LeaveRequest[] }) => (
    <div className="space-y-8">
        <h3 className="text-2xl font-black border-r-4 border-emerald-600 pr-4">تاريخ الطلبات</h3>
        <div className="grid gap-5">
            {requests.map(r => (
                <div key={r.id} className="p-8 bg-white border rounded-[40px] flex justify-between items-center shadow-sm hover:shadow-xl transition-all">
                    <div className="flex gap-5 items-center">
                        <div className={`p-4 rounded-[25px] ${r.status === 'مقبول' ? 'bg-green-50 text-green-600' : r.status === 'مرفوض' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                            <FileText className="w-7 h-7" />
                        </div>
                        <div>
                            <h4 className="font-black text-xl text-gray-800 mb-1">{r.type}</h4>
                            <p className="text-sm text-gray-400 font-bold">من {r.start_date} إلى {r.end_date}</p>
                        </div>
                    </div>
                    <div className={`px-6 py-3 rounded-2xl text-[10px] font-black ${r.status === 'مقبول' ? 'bg-green-600 text-white' : r.status === 'مرفوض' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>{r.status}</div>
                </div>
            ))}
        </div>
    </div>
);

const StaffMessages = ({ messages }: { messages: InternalMessage[] }) => (
    <div className="space-y-8">
        <h3 className="text-2xl font-black border-r-4 border-emerald-600 pr-4">الرسائل والتنبيهات</h3>
        <div className="space-y-5">
            {messages.map((m: any) => (
                <div key={m.id} className={`p-8 rounded-[40px] border-2 bg-white ${m.from_user === 'admin' ? 'border-emerald-100 shadow-xl shadow-emerald-50' : 'border-transparent opacity-70'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-black text-lg text-gray-800">{m.from_user === 'admin' ? 'إدارة المركز' : 'تنبيه'}</span>
                        <span className="text-[10px] text-gray-400 font-black">{new Date(m.created_at).toLocaleString('ar-EG')}</span>
                    </div>
                    <p className="text-gray-700 leading-loose text-sm font-bold">{m.content}</p>
                </div>
            ))}
        </div>
    </div>
);

const StaffNav = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-[25px] font-black transition-all group ${active ? 'bg-emerald-600 text-white shadow-xl' : 'bg-white text-gray-400 hover:text-emerald-600'}`}>
    <span className={`ml-3 p-3 rounded-2xl transition-colors ${active ? 'bg-emerald-500 text-white' : 'bg-gray-50 text-gray-300'}`}>{icon}</span>
    {label}
  </button>
);

export default StaffDashboard;
