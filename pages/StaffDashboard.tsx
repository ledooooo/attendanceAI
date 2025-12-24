
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, User, Calendar, FilePlus, ClipboardCheck, MessageCircle, Send, LogOut, Clock, AlertTriangle, CheckCircle, List
} from 'lucide-react';
import { Employee, LeaveRequest, AttendanceRecord, InternalMessage, GeneralSettings } from '../types';

interface StaffDashboardProps {
  onBack: () => void;
  employee: Employee | null;
  setEmployee: (emp: Employee | null) => void;
}

// Added Input component to fix missing reference error
const Input = ({ label, type = 'text', value, onChange, placeholder }: any) => (
  <div className="text-right">
    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
    <input 
      type={type} 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
      placeholder={placeholder} 
    />
  </div>
);

// Added Select component to fix missing reference error
const Select = ({ label, options, value, onChange }: any) => (
  <div className="text-right">
    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
    <select 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
    >
      {options.map((opt: any) => typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

const StaffDashboard: React.FC<StaffDashboardProps> = ({ onBack, employee, setEmployee }) => {
  const [loginData, setLoginData] = useState({ id: '', natId: '' });
  const [activeTab, setActiveTab] = useState('attendance');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [allMyRequests, setAllMyRequests] = useState<LeaveRequest[]>([]);
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const fetchStaffData = async (empId: string) => {
    try {
      const [attRes, msgRes, leaveRes, setRes, myReqRes] = await Promise.all([
        supabase.from('attendance').select('*').eq('employee_id', empId),
        supabase.from('messages').select('*').or(`to_user.eq.${empId},to_user.eq.all`).order('created_at', { ascending: false }),
        supabase.from('leave_requests').select('*').eq('employee_id', empId).eq('status', 'مقبول'),
        supabase.from('general_settings').select('*').limit(1).single(),
        supabase.from('leave_requests').select('*').eq('employee_id', empId).order('created_at', { ascending: false })
      ]);
      if (attRes.data) setAttendance(attRes.data);
      if (msgRes.data) setMessages(msgRes.data);
      if (leaveRes.data) setLeaves(leaveRes.data);
      if (setRes.data) setSettings(setRes.data);
      if (myReqRes.data) setAllMyRequests(myReqRes.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (employee) fetchStaffData(employee.employee_id);
  }, [employee]);

  const stats = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const filteredAtt = attendance.filter(a => a.date.startsWith(selectedMonth));
    const totalAttend = filteredAtt.length;
    
    let totalHours = 0;
    filteredAtt.forEach(a => {
      const times = a.times.split(/\s+/).filter(t => t.includes(':'));
      if (times.length >= 2) {
        const h = calculateHours(times[0], times[times.length-1]);
        totalHours += parseFloat(h);
      }
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    let absentCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isWeekend = new Date(dateStr).getDay() === 5;
      const isHoliday = settings?.holidays?.includes(dateStr) || isWeekend;
      const hasAtt = filteredAtt.some(a => a.date === dateStr);
      const hasLeave = leaves.some(l => dateStr >= l.start_date && dateStr <= l.end_date);
      if (!hasAtt && !hasLeave && !isHoliday) absentCount++;
    }

    return { totalAttend, totalHours: totalHours.toFixed(1), absentCount };
  }, [attendance, leaves, settings, selectedMonth]);

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-6 text-right">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-8 hover:underline font-bold"><ArrowRight className="ml-2 w-4 h-4" /> العودة</button>
          <h2 className="text-3xl font-bold mb-8 text-center text-gray-800">بوابة الموظف</h2>
          <div className="space-y-6">
            <StaffInput label="رقم الموظف" value={loginData.id} onChange={(v: string) => setLoginData({...loginData, id: v})} />
            <StaffInput label="الرقم القومي" value={loginData.natId} onChange={(v: string) => setLoginData({...loginData, natId: v})} type="password" />
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
          <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center border-2 border-emerald-100"><User className="w-10 h-10 text-emerald-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{employee.name}</h1>
            <p className="text-gray-400 font-semibold">{employee.specialty} | {employee.employee_id}</p>
          </div>
        </div>
        <button onClick={() => setEmployee(null)} className="flex items-center text-red-500 hover:text-red-700 font-bold bg-red-50 px-6 py-2 rounded-xl transition-all shadow-sm">تسجيل خروج <LogOut className="mr-3 w-5 h-5"/></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard label="ساعات العمل" value={stats.totalHours} icon={<Clock className="text-blue-500"/>} />
        <StatCard label="أيام الحضور" value={stats.totalAttend} icon={<CheckCircle className="text-emerald-500"/>} />
        <StatCard label="أيام الغياب" value={stats.absentCount} icon={<AlertTriangle className="text-red-500"/>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 flex flex-col gap-3">
           <StaffNav active={activeTab === 'attendance'} icon={<Clock />} label="تقرير الحضور" onClick={() => setActiveTab('attendance')} />
           <StaffNav active={activeTab === 'leave'} icon={<FilePlus />} label="طلب إجازة" onClick={() => setActiveTab('leave')} />
           <StaffNav active={activeTab === 'messages'} icon={<MessageCircle />} label="الرسائل" onClick={() => setActiveTab('messages')} />
        </div>
        <div className="lg:col-span-3 bg-white p-8 rounded-3xl shadow-sm border min-h-[500px]">
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">سجل الحضور اليومي</h3>
                <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="p-2 border rounded-xl outline-none font-bold bg-gray-50" />
              </div>
              <div className="overflow-x-auto border rounded-2xl bg-white shadow-inner">
                <table className="w-full text-sm text-right">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr><th className="p-4">التاريخ</th><th className="p-4">الحضور</th><th className="p-4">الانصراف</th><th className="p-4">الحالة</th></tr>
                  </thead>
                  <tbody>
                    {attendance.filter(a=>a.date.startsWith(selectedMonth)).map(a => {
                      const times = a.times.split(/\s+/).filter(t=>t.includes(':'));
                      const cin = times[0] || '--';
                      const cout = times.length > 1 ? times[times.length-1] : '--';
                      const status = times.length === 1 ? 'ترك عمل' : 'حاضر';
                      return (
                        <tr key={a.id} className="border-b hover:bg-emerald-50 transition-colors">
                          <td className="p-4 font-bold">{a.date}</td>
                          <td className="p-4 text-emerald-600 font-bold">{cin}</td>
                          <td className="p-4 text-red-500 font-bold">{cout}</td>
                          <td className="p-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${status === 'حاضر' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'leave' && <StaffLeaveForm employee={employee} requests={allMyRequests} refresh={() => fetchStaffData(employee.employee_id)} />}
          {activeTab === 'messages' && <div className="text-center py-20 text-gray-400">لا توجد رسائل جديدة</div>}
        </div>
      </div>
    </div>
  );
};

const StaffInput = ({ label, onChange, value, type = "text" }: any) => (
  <div className="text-right">
    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">{label}</label>
    <input type={type} className="w-full p-4 border rounded-2xl bg-gray-50 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const StaffNav = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-2xl transition-all font-bold ${active ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-emerald-50 border'}`}><span className="ml-3">{icon}</span>{label}</button>
);

const StatCard = ({ label, value, icon }: any) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
    <div className="p-3 bg-gray-50 rounded-xl">{icon}</div>
    <div><p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{label}</p><p className="text-2xl font-black text-gray-800">{value}</p></div>
  </div>
);

const calculateHours = (inT: string, outT: string) => {
  const [h1, m1] = inT.split(':').map(Number);
  const [h2, m2] = outT.split(':').map(Number);
  let diff = (new Date(0,0,0,h2,m2).getTime() - new Date(0,0,0,h1,m1).getTime()) / 3600000;
  if (diff < 0) diff += 24;
  return diff.toFixed(1);
};

const StaffLeaveForm = ({ employee, requests, refresh }: any) => {
  const [formData, setFormData] = useState({ type: 'اعتيادي', start: '', end: '', backup: '', notes: '' });
  const submit = async () => {
    if(!formData.start || !formData.end) return alert('حدد التواريخ');
    const { error } = await supabase.from('leave_requests').insert([{ employee_id: employee.employee_id, ...formData, status: 'معلق' }]);
    if(!error) { alert('تم الطلب'); refresh(); } else alert('خطأ');
  };
  return (
    <div className="space-y-8">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><FilePlus className="text-emerald-600"/> تقديم طلب إجازة</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-6 rounded-2xl border">
        <Select label="النوع" options={['اعتيادي', 'عارضة', 'مرضي']} value={formData.type} onChange={(v:any)=>setFormData({...formData, type: v})} />
        <Input label="من تاريخ" type="date" value={formData.start} onChange={(v:any)=>setFormData({...formData, start: v})} />
        <Input label="إلى تاريخ" type="date" value={formData.end} onChange={(v:any)=>setFormData({...formData, end: v})} />
        <Input label="القائم بالعمل" value={formData.backup} onChange={(v:any)=>setFormData({...formData, backup: v})} />
        <button onClick={submit} className="md:col-span-2 bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-md hover:bg-emerald-700 transition-all">إرسال الطلب</button>
      </div>
      <h3 className="text-xl font-bold flex items-center gap-2"><List className="text-blue-600"/> تاريخ طلباتي</h3>
      <div className="overflow-x-auto rounded-2xl border shadow-inner">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-50"><tr><th className="p-3">النوع</th><th className="p-3">الفترة</th><th className="p-3">الحالة</th></tr></thead>
          <tbody>
            {requests.map((r:any) => (
              <tr key={r.id} className="border-b"><td className="p-3 font-bold">{r.type}</td><td className="p-3 text-xs">{r.start_date} - {r.end_date}</td><td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'مقبول' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100'}`}>{r.status}</span></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StaffDashboard;
