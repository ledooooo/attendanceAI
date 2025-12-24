
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, User, Calendar, FilePlus, ClipboardCheck, MessageCircle, Send, LogOut, Clock, AlertTriangle, CheckCircle, List, BarChart, Inbox, FileText, Award, Printer, Share2, X
} from 'lucide-react';
import { Employee, LeaveRequest, AttendanceRecord, InternalMessage, GeneralSettings, Evaluation } from '../types';

interface StaffDashboardProps {
  onBack: () => void;
  employee: Employee | null;
  setEmployee: (emp: Employee | null) => void;
}

const LEAVE_TYPES = [
  "اعتيادى", "عارضة", "مرضى", "خط سير", "تامين صحى", "مأمورية", "دورة تدريبية", "اذن صباحى", "اذن مسائى", "بدل راحة", "أخرى"
];

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
    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input 
      type={type} 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
      placeholder={placeholder} 
    />
  </div>
);

const Select = ({ label, options, value, onChange, required = false }: any) => (
  <div className="text-right">
    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <select 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
    >
      <option value="">-- اختر --</option>
      {options.map((opt: any) => typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

const StaffDashboard: React.FC<StaffDashboardProps> = ({ onBack, employee, setEmployee }) => {
  const [loginData, setLoginData] = useState({ id: '', natId: '' });
  const [activeTab, setActiveTab] = useState('attendance');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [allMyRequests, setAllMyRequests] = useState<LeaveRequest[]>([]);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const fetchStaffData = async (empId: string) => {
    try {
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
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (employee) fetchStaffData(employee.employee_id);
  }, [employee]);

  const calculateHours = (inT: string, outT: string) => {
    if (!inT || !outT) return 0;
    const [h1, m1] = inT.split(':').map(Number);
    const [h2, m2] = outT.split(':').map(Number);
    let diff = (new Date(0,0,0,h2,m2).getTime() - new Date(0,0,0,h1,m1).getTime()) / 3600000;
    if (diff < 0) diff += 24;
    return diff;
  };

  const isFriday = (dateStr: string) => new Date(dateStr).getDay() === 5;
  const isHoliday = (dateStr: string) => settings?.holidays?.includes(dateStr) || isFriday(dateStr);
  const getLeaveOnDate = (dateStr: string) => leaves.find(l => dateStr >= l.start_date && dateStr <= l.end_date);

  const stats = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    let monthlyHours = 0;
    let attendDays = 0;
    attendance.forEach(att => {
        if (att.date.startsWith(selectedMonth)) {
            attendDays++;
            const times = att.times.split(/\s+/).filter(t => t.includes(':'));
            if (times.length >= 2) monthlyHours += calculateHours(times[0], times[times.length - 1]);
        }
    });
    return { monthlyHours: monthlyHours.toFixed(1), attendDays };
  }, [attendance, selectedMonth]);

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-6 text-right">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-8 hover:underline font-bold"><ArrowRight className="ml-2 w-4 h-4" /> العودة</button>
          <h2 className="text-3xl font-bold mb-8 text-center text-gray-800">بوابة الموظف</h2>
          <div className="space-y-6">
            <Input label="رقم الموظف" value={loginData.id} onChange={(v:any) => setLoginData({...loginData, id: v})} />
            <Input label="الرقم القومي" type="password" value={loginData.natId} onChange={(v:any) => setLoginData({...loginData, natId: v})} />
            <button onClick={async () => {
               setLoading(true);
               const { data } = await supabase.from('employees').select('*').eq('employee_id', loginData.id).eq('national_id', loginData.natId).maybeSingle();
               if(data) { setEmployee(data); fetchStaffData(data.employee_id); } else alert('بيانات خاطئة');
               setLoading(false);
            }} disabled={loading} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-md">{loading ? 'تحقق...' : 'دخول'}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-10 text-right">
      <div className="bg-white p-8 rounded-3xl shadow-sm border mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center border-2 border-emerald-100">
            {employee.photo_url ? (
                <img src={employee.photo_url} alt="Profile" className="w-full h-full object-cover rounded-2xl" />
            ) : (
                <User className="w-10 h-10 text-emerald-600" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{employee.name}</h1>
            <p className="text-gray-400 font-semibold">{employee.specialty} | كود: {employee.employee_id}</p>
          </div>
        </div>
        <button onClick={() => setEmployee(null)} className="flex items-center text-red-500 hover:text-red-700 font-bold bg-red-50 px-6 py-2 rounded-xl transition-all shadow-sm">خروج <LogOut className="mr-3 w-5 h-5"/></button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border text-center">
            <p className="text-xs text-gray-400 font-bold uppercase mb-1">ساعات الشهر</p>
            <p className="text-3xl font-black text-emerald-600">{stats.monthlyHours}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border text-center">
            <p className="text-xs text-gray-400 font-bold uppercase mb-1">أيام الحضور</p>
            <p className="text-3xl font-black text-blue-600">{stats.attendDays}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border text-center">
            <p className="text-xs text-gray-400 font-bold uppercase mb-1">رصيد اعتيادي</p>
            <p className="text-3xl font-black text-amber-600">{employee.remaining_annual}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border text-center">
            <p className="text-xs text-gray-400 font-bold uppercase mb-1">رصيد عارضة</p>
            <p className="text-3xl font-black text-orange-600">{employee.remaining_casual}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 flex flex-col gap-3">
           <StaffNav active={activeTab === 'attendance'} icon={<Clock />} label="سجل الحضور" onClick={() => setActiveTab('attendance')} />
           <StaffNav active={activeTab === 'leave'} icon={<FilePlus />} label="تقديم طلب" onClick={() => setActiveTab('leave')} />
           <StaffNav active={activeTab === 'messages'} icon={<Inbox />} label="الرسائل" onClick={() => setActiveTab('messages')} />
           <StaffNav active={activeTab === 'profile'} icon={<User />} label="الملف الشخصي" onClick={() => setActiveTab('profile')} />
        </div>
        <div className="lg:col-span-3 bg-white p-8 rounded-3xl shadow-sm border min-h-[500px]">
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">تقرير الحضور التفصيلي</h3>
                <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="p-2 border rounded-xl font-bold bg-gray-50 outline-none" />
              </div>
              <div className="overflow-x-auto border rounded-2xl">
                <table className="w-full text-sm text-right">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-4">التاريخ</th>
                      <th className="p-4">الحضور</th>
                      <th className="p-4">حالة الحضور</th>
                      <th className="p-4">الانصراف</th>
                      <th className="p-4">حالة الانصراف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 31 }, (_, i) => {
                      const day = i + 1;
                      const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                      const att = attendance.find(a => a.date === dateStr);
                      if (!att && day > new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]), 0).getDate()) return null;
                      
                      const times = att?.times.split(/\s+/).filter(t => t.includes(':')) || [];
                      const cin = times[0] || '--';
                      const cout = times.length > 1 ? times[times.length - 1] : '--';

                      return (
                        <tr key={dateStr} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="p-4 font-bold">{dateStr}</td>
                          <td className="p-4 text-emerald-600 font-bold">{cin}</td>
                          <td className="p-4 font-bold">{getCheckInLabel(cin)}</td>
                          <td className="p-4 text-red-500 font-bold">{cout}</td>
                          <td className="p-4 font-bold">{getCheckOutLabel(cout)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'leave' && <StaffLeaveForm employee={employee} requests={allMyRequests} refresh={() => fetchStaffData(employee.employee_id)} />}
          {activeTab === 'messages' && <StaffMessages employee={employee} messages={messages} refresh={() => fetchStaffData(employee.employee_id)} />}
          {activeTab === 'profile' && <StaffProfile employee={employee} />}
        </div>
      </div>
    </div>
  );
};

const StaffMessages = ({ employee, messages, refresh }: any) => {
    const [newMsg, setNewMsg] = useState('');
    const [sending, setSending] = useState(false);

    const sendMessage = async () => {
        if (!newMsg.trim()) return;
        setSending(true);
        const { error } = await supabase.from('messages').insert([{
            from_user: employee.employee_id,
            to_user: 'admin',
            content: newMsg.trim()
        }]);
        if (!error) {
            setNewMsg('');
            alert('تم إرسال الرسالة للإدارة');
            refresh();
        } else alert('فشل الإرسال');
        setSending(false);
    };

    return (
        <div className="space-y-8">
            <h3 className="text-xl font-bold flex items-center gap-2"><MessageCircle className="text-emerald-600" /> التواصل مع الإدارة</h3>
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex gap-2">
                <textarea 
                    className="flex-1 p-3 border rounded-xl outline-none"
                    placeholder="اكتب رسالتك هنا..."
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    rows={2}
                />
                <button 
                    onClick={sendMessage}
                    disabled={sending}
                    className="bg-emerald-600 text-white px-6 rounded-xl hover:bg-emerald-700 disabled:bg-gray-400"
                >
                    <Send className="w-5 h-5" />
                </button>
            </div>
            <div className="space-y-4">
                {messages.map((m: any) => (
                    <div key={m.id} className={`p-4 rounded-2xl border ${m.from_user === 'admin' ? 'bg-white' : 'bg-gray-50'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-gray-400">{m.from_user === 'admin' ? 'الإدارة' : 'أنا'}</span>
                            <span className="text-[10px] text-gray-400">{new Date(m.created_at).toLocaleString('ar-EG')}</span>
                        </div>
                        <p className="text-sm">{m.content}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const StaffProfile = ({ employee }: { employee: Employee }) => {
    return (
        <div className="space-y-8 text-right">
            <h3 className="text-xl font-bold flex items-center gap-2 border-b pb-4"><User className="text-emerald-600" /> الملف الوظيفي</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ProfileItem label="الاسم" value={employee.name} />
                <ProfileItem label="التخصص" value={employee.specialty} />
                <ProfileItem label="الدرجة" value={employee.grade} />
                <ProfileItem label="تاريخ التعيين" value={employee.join_date} />
                <ProfileItem label="التليفون" value={employee.phone} />
                <ProfileItem label="الحضور الرسمي" value={employee.start_time} />
                <ProfileItem label="أيام العمل" value={employee.work_days?.join('، ') || 'الكل'} />
            </div>
        </div>
    );
};

const ProfileItem = ({ label, value }: any) => (
    <div className="bg-gray-50 p-3 rounded-xl border">
        <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">{label}</label>
        <p className="text-gray-800 font-bold">{value || '--'}</p>
    </div>
);

const StaffNav = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-2xl transition-all font-bold ${active ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-emerald-50 border'}`}><span className="ml-3">{icon}</span>{label}</button>
);

const StaffLeaveForm = ({ employee, requests, refresh }: any) => {
  const [formData, setFormData] = useState({ type: '', start: '', end: '', backup: '', notes: '' });
  const submit = async () => {
    if(!formData.type || !formData.start || !formData.end) return alert('أكمل البيانات');
    const { error } = await supabase.from('leave_requests').insert([{ employee_id: employee.employee_id, type: formData.type, start_date: formData.start, end_date: formData.end, backup_person: formData.backup, status: 'معلق' }]);
    if(!error) { alert('تم الإرسال'); setFormData({ type: '', start: '', end: '', backup: '', notes: '' }); refresh(); }
  };
  return (
    <div className="space-y-8">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><FilePlus className="text-emerald-600"/> تقديم طلب جديد</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-6 rounded-2xl border">
        <Select label="نوع الطلب" options={LEAVE_TYPES} value={formData.type} onChange={(v:any)=>setFormData({...formData, type: v})} />
        <Input label="من تاريخ" type="date" value={formData.start} onChange={(v:any)=>setFormData({...formData, start: v})} />
        <Input label="إلى تاريخ" type="date" value={formData.end} onChange={(v:any)=>setFormData({...formData, end: v})} />
        <Input label="البديل" value={formData.backup} onChange={(v:any)=>setFormData({...formData, backup: v})} />
        <button onClick={submit} className="md:col-span-2 bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-md hover:bg-emerald-700">إرسال الطلب</button>
      </div>
      <div className="overflow-x-auto rounded-2xl border shadow-inner">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-50">
            <tr>
                <th className="p-4 border-b">النوع</th>
                <th className="p-4 border-b">التاريخ</th>
                <th className="p-4 border-b">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r:any) => (
              <tr key={r.id} className="border-b hover:bg-gray-50 transition-colors">
                <td className="p-4 font-bold">{r.type}</td>
                <td className="p-4 text-xs">{r.start_date} إلى {r.end_date}</td>
                <td className="p-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'مقبول' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StaffDashboard;
