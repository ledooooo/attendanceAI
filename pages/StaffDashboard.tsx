
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder={placeholder} />
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
  const [activeTab, setActiveTab] = useState('attendance');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [allMyRequests, setAllMyRequests] = useState<LeaveRequest[]>([]);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const fetchStaffData = async (empId: string) => {
    const [attRes, leaveRes, setRes, myReqRes, msgRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('employee_id', empId),
      supabase.from('leave_requests').select('*').eq('employee_id', empId).eq('status', 'مقبول'),
      supabase.from('general_settings').select('*').limit(1).single(),
      supabase.from('leave_requests').select('*').eq('employee_id', empId).order('created_at', { ascending: false }),
      supabase.from('messages').select('*').or(`to_user.eq.${empId},to_user.eq.all`).order('created_at', { ascending: false })
    ]);
    if (attRes.data) setAttendance(attRes.data);
    if (leaveRes.data) setLeaves(leaveRes.data);
    if (setRes.data) setSettings(setRes.data);
    if (myReqRes.data) setAllMyRequests(myReqRes.data);
    if (msgRes.data) setMessages(msgRes.data);
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
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-8 font-bold"><ArrowRight className="ml-2 w-4 h-4" /> العودة</button>
          <h2 className="text-3xl font-bold mb-8 text-center text-gray-800">بوابة الموظف</h2>
          <div className="space-y-6">
            <Input label="رقم الموظف" value={loginData.id} onChange={(v:any) => setLoginData({...loginData, id: v})} />
            <Input label="الرقم القومي" type="password" value={loginData.natId} onChange={(v:any) => setLoginData({...loginData, natId: v})} />
            <button onClick={async () => {
               setLoading(true);
               const { data } = await supabase.from('employees').select('*').eq('employee_id', loginData.id).eq('national_id', loginData.natId).maybeSingle();
               if(data) { setEmployee(data); fetchStaffData(data.employee_id); } else alert('بيانات خاطئة');
               setLoading(false);
            }} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-md">{loading ? 'تحقق...' : 'دخول'}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-10 text-right">
      <div className="bg-white p-8 rounded-3xl shadow-sm border mb-8 flex flex-col md:flex-row justify-between items-center no-print">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center border-2 border-emerald-100">
            {employee.photo_url ? <img src={employee.photo_url} alt="Profile" className="w-full h-full object-cover rounded-2xl" /> : <User className="w-10 h-10 text-emerald-600" />}
          </div>
          <div><h1 className="text-2xl font-bold text-gray-800">{employee.name}</h1><p className="text-gray-400 font-semibold">{employee.specialty} | كود: {employee.employee_id}</p></div>
        </div>
        <button onClick={() => setEmployee(null)} className="flex items-center text-red-500 font-bold bg-red-50 px-6 py-2 rounded-xl">خروج <LogOut className="mr-3 w-5 h-5"/></button>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border mb-8">
          <h3 className="text-xl font-bold border-b pb-4 mb-6 flex items-center gap-2"><User className="text-emerald-600" /> الملف الشخصي الكامل</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
              <ProfileItem label="الاسم الرباعي" value={employee.name} />
              <ProfileItem label="الكود الوظيفي" value={employee.employee_id} />
              <ProfileItem label="الرقم القومي" value={employee.national_id} />
              <ProfileItem label="التخصص" value={employee.specialty} />
              <ProfileItem label="الدرجة الوظيفية" value={employee.grade} />
              <ProfileItem label="تليفون التواصل" value={employee.phone} />
              <ProfileItem label="تاريخ التعيين" value={employee.join_date} />
              <ProfileItem label="الحضور الرسمي" value={employee.start_time} />
              <ProfileItem label="الانصراف الرسمي" value={employee.end_time} />
              <ProfileItem label="أيام العمل المحددة" value={employee.work_days?.join('، ') || 'الكل'} />
              <ProfileItem label="المهام الإدارية" value={employee.admin_tasks} />
              <ProfileItem label="ملاحظات" value={employee.notes} />
          </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 no-print">
        <div className="bg-white p-6 rounded-2xl shadow-sm border text-center">
            <p className="text-xs text-gray-400 font-bold mb-1">متبقي اعتيادي</p>
            <p className="text-3xl font-black text-emerald-600">{employee.remaining_annual}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border text-center">
            <p className="text-xs text-gray-400 font-bold mb-1">متبقي عارضة</p>
            <p className="text-3xl font-black text-blue-600">{employee.remaining_casual}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 flex flex-col gap-3 no-print">
           <StaffNav active={activeTab === 'attendance'} icon={<Clock />} label="سجل الحضور" onClick={() => setActiveTab('attendance')} />
           <StaffNav active={activeTab === 'leave'} icon={<FilePlus />} label="تقديم طلب" onClick={() => setActiveTab('leave')} />
           <StaffNav active={activeTab === 'print'} icon={<Printer />} label="طباعة الطلبات" onClick={() => setActiveTab('print')} />
           <StaffNav active={activeTab === 'messages'} icon={<Inbox />} label="الرسائل" onClick={() => setActiveTab('messages')} />
        </div>
        <div className="lg:col-span-3 bg-white p-8 rounded-3xl shadow-sm border min-h-[500px]">
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-6 no-print">
                <h3 className="text-xl font-bold">سجل الحضور والانصراف</h3>
                <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="p-2 border rounded-xl font-bold" />
              </div>
              <div className="overflow-x-auto border rounded-2xl shadow-sm">
                <table className="w-full text-sm text-right">
                  <thead className="bg-gray-100 font-bold">
                    <tr><th className="p-4">التاريخ</th><th className="p-4">اليوم</th><th className="p-4">الحضور</th><th className="p-4">حالة الحضور</th><th className="p-4">الانصراف</th><th className="p-4">حالة الانصراف</th><th className="p-4">ساعات العمل</th></tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 31 }, (_, i) => {
                      const day = i + 1;
                      const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                      const att = attendance.find(a => a.date === dateStr);
                      const daysCount = new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]), 0).getDate();
                      if (day > daysCount) return null;
                      const times = att?.times.split(/\s+/).filter(t => t.includes(':')) || [];
                      const cin = times[0] || '--';
                      const cout = times.length > 1 ? times[times.length - 1] : '--';
                      const hours = times.length >= 2 ? calculateHours(times[0], times[times.length-1]).toFixed(1) : '0.0';
                      return (
                        <tr key={dateStr} className="border-b hover:bg-gray-50">
                          <td className="p-4 font-bold">{dateStr}</td><td className="p-4">{DAYS_AR[new Date(dateStr).getDay()]}</td>
                          <td className="p-4 text-emerald-600 font-bold">{cin}</td><td className="p-4">{getCheckInLabel(cin)}</td>
                          <td className="p-4 text-red-500 font-bold">{cout}</td><td className="p-4">{getCheckOutLabel(cout)}</td>
                          <td className="p-4 font-mono font-bold">{hours}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'leave' && <StaffLeaveForm employee={employee} requests={allMyRequests} refresh={() => fetchStaffData(employee.employee_id)} />}
          {activeTab === 'print' && <PrintTab requests={allMyRequests} employee={employee} />}
          {activeTab === 'messages' && <StaffMessages messages={messages} />}
        </div>
      </div>
    </div>
  );
};

const ProfileItem = ({ label, value }: any) => (
    <div className="p-3 bg-gray-50 rounded-xl border"><label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">{label}</label><p className="font-bold text-gray-800">{value || '--'}</p></div>
);

const StaffNav = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-2xl font-bold transition-all ${active ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-emerald-50 border'}`}><span className="ml-3">{icon}</span>{label}</button>
);

const PrintTab = ({ requests, employee }: any) => {
    const printRef = useRef<HTMLDivElement>(null);
    const [selectedReq, setSelectedReq] = useState<any>(null);
    const handlePrint = (req: any) => { setSelectedReq(req); setTimeout(() => window.print(), 200); };
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold mb-6">طباعة طلبات الإجازة المعتمدة</h3>
            <div className="space-y-4">
                {requests.filter((r:any)=>r.status==='مقبول').map((r:any) => (
                    <div key={r.id} className="p-6 bg-white border rounded-2xl flex justify-between items-center hover:shadow-md transition-all">
                        <div><p className="font-bold text-lg">{r.type}</p><p className="text-sm text-gray-500">من {r.start_date} إلى {r.end_date}</p></div>
                        <button onClick={() => handlePrint(r)} className="bg-gray-800 text-white px-6 py-2 rounded-xl flex items-center gap-2"><Printer className="w-4 h-4"/> طباعة</button>
                    </div>
                ))}
                {requests.filter((r:any)=>r.status==='مقبول').length === 0 && <p className="text-center text-gray-400 py-20 font-bold border-2 border-dashed rounded-3xl">لا يوجد طلبات معتمدة للطباعة</p>}
            </div>
            {selectedReq && (
                <div className="hidden print:block p-10 text-right leading-loose" dir="rtl">
                    <div className="text-center mb-10 border-b pb-6"><h1 className="text-2xl font-black">طلب إجازة / إذن</h1><p className="font-bold mt-2">السيد / مدير المركز الطبي</p></div>
                    <p className="text-xl">أفيد سيادتكم بطلبي للحصول على إجازة نوع <b>({selectedReq.type})</b></p>
                    <p className="text-xl">وذلك اعتباراً من تاريخ <b>{selectedReq.start_date}</b> حتى تاريخ <b>{selectedReq.end_date}</b></p>
                    <div className="mt-10 grid grid-cols-2 gap-10">
                        <div className="border p-6 rounded-2xl">
                            <p className="font-bold mb-2">بيانات الموظف:</p>
                            <p>الاسم: {employee.name}</p>
                            <p>الوظيفة: {employee.specialty}</p>
                        </div>
                        <div className="text-center flex flex-col justify-end h-full">
                            <p className="font-bold underline">توقيع الموظف</p>
                            <p className="mt-16">................................</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StaffLeaveForm = ({ employee, requests, refresh }: any) => {
  const [formData, setFormData] = useState({ type: '', start: '', end: '', backup: '' });
  const submit = async () => { if(!formData.type || !formData.start || !formData.end) return alert('أكمل البيانات'); await supabase.from('leave_requests').insert([{ employee_id: employee.employee_id, type: formData.type, start_date: formData.start, end_date: formData.end, backup_person: formData.backup, status: 'معلق' }]); alert('تم الإرسال'); setFormData({ type:'', start:'', end:'', backup:'' }); refresh(); };
  return (
    <div className="space-y-8">
      <h3 className="text-xl font-bold flex items-center gap-2"><FilePlus className="text-emerald-600"/> تقديم طلب جديد</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-6 rounded-2xl border">
        <Select label="نوع الطلب" options={LEAVE_TYPES} value={formData.type} onChange={(v:any)=>setFormData({...formData, type: v})} />
        <Input label="من" type="date" value={formData.start} onChange={(v:any)=>setFormData({...formData, start: v})} />
        <Input label="إلى" type="date" value={formData.end} onChange={(v:any)=>setFormData({...formData, end: v})} />
        <button onClick={submit} className="md:col-span-2 bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-md hover:bg-emerald-700">إرسال الطلب</button>
      </div>
      <div className="overflow-x-auto rounded-2xl border shadow-inner">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-50 font-bold"><tr><th className="p-4 border-b">النوع</th><th className="p-4 border-b">الفترة</th><th className="p-4 border-b">الحالة</th></tr></thead>
          <tbody>{requests.map((r:any) => (<tr key={r.id} className="border-b"><td className="p-4 font-bold">{r.type}</td><td className="p-4 text-xs">{r.start_date} إلى {r.end_date}</td><td className="p-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'مقبول' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span></td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
};

const StaffMessages = ({ messages }: any) => (
    <div className="space-y-8"><h3 className="text-xl font-bold flex items-center gap-2"><Inbox className="text-emerald-600" /> تنبيهات الإدارة</h3>
        <div className="space-y-4">
            {messages.map((m: any) => (<div key={m.id} className={`p-4 rounded-2xl border ${m.from_user === 'admin' ? 'bg-white border-blue-200 shadow-sm' : 'bg-gray-50'}`}>
                <div className="flex justify-between items-center mb-2"><span className="text-[10px] font-bold text-gray-400">{m.from_user === 'admin' ? 'الإدارة' : 'أنا'}</span><span className="text-[10px] text-gray-400">{new Date(m.created_at).toLocaleString('ar-EG')}</span></div><p className="text-sm">{m.content}</p></div>))}
            {messages.length === 0 && <p className="text-center text-gray-400 py-20 font-bold border-2 border-dashed rounded-3xl">لا توجد رسائل جديدة</p>}
        </div>
    </div>
);

export default StaffDashboard;
