
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, User, Calendar, FilePlus, ClipboardCheck, MessageCircle, Send, LogOut, Clock, AlertTriangle, CheckCircle, List, BarChart
} from 'lucide-react';
import { Employee, LeaveRequest, AttendanceRecord, InternalMessage, GeneralSettings } from '../types';

interface StaffDashboardProps {
  onBack: () => void;
  employee: Employee | null;
  setEmployee: (emp: Employee | null) => void;
}

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
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const fetchStaffData = async (empId: string) => {
    try {
      const [attRes, leaveRes, setRes, myReqRes] = await Promise.all([
        supabase.from('attendance').select('*').eq('employee_id', empId),
        supabase.from('leave_requests').select('*').eq('employee_id', empId).eq('status', 'مقبول'),
        supabase.from('general_settings').select('*').limit(1).single(),
        supabase.from('leave_requests').select('*').eq('employee_id', empId).order('created_at', { ascending: false })
      ]);
      if (attRes.data) setAttendance(attRes.data);
      if (leaveRes.data) setLeaves(leaveRes.data);
      if (setRes.data) setSettings(setRes.data);
      if (myReqRes.data) setAllMyRequests(myReqRes.data);
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
    let absentDays = 0;
    let leaveDays = 0;
    let lateDays = 0;

    let weeklyHours = 0;
    const today = new Date();
    const currentDay = today.getDay();
    const diffToSat = (currentDay === 6 ? 0 : currentDay + 1);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - diffToSat);
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const att = attendance.find(a => a.date === dateStr);
      const leave = getLeaveOnDate(dateStr);
      const holiday = isHoliday(dateStr);

      if (att) {
        attendDays++;
        const times = att.times.split(/\s+/).filter(t => t.includes(':'));
        if (times.length >= 1) {
          if (settings?.shift_morning_in && times[0] > settings.shift_morning_in) lateDays++;
          
          if (times.length >= 2) {
            const h = calculateHours(times[0], times[times.length - 1]);
            monthlyHours += h;
            const dDate = new Date(dateStr);
            if (dDate >= startOfWeek && dDate <= today && dDate.getDay() !== 5) {
                weeklyHours += h;
            }
          }
        }
      } else {
        if (!holiday && !leave) absentDays++;
        if (leave) leaveDays++;
      }
    }

    return { 
      monthlyHours: monthlyHours.toFixed(1), 
      weeklyHours: weeklyHours.toFixed(1),
      attendDays, 
      absentDays, 
      leaveDays, 
      lateDays 
    };
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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="ساعات الشهر" value={stats.monthlyHours} icon={<Clock className="text-blue-500"/>} />
        <StatCard label="ساعات الأسبوع" value={stats.weeklyHours} icon={<BarChart className="text-purple-500"/>} />
        <StatCard label="أيام الحضور" value={stats.attendDays} icon={<CheckCircle className="text-emerald-500"/>} />
        <StatCard label="أيام الغياب" value={stats.absentDays} icon={<AlertTriangle className="text-red-500"/>} />
        <StatCard label="إجمالي الإجازات" value={stats.leaveDays} icon={<Calendar className="text-amber-500"/>} />
        <StatCard label="أيام التأخير" value={stats.lateDays} icon={<Clock className="text-orange-500"/>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 flex flex-col gap-3">
           <StaffNav active={activeTab === 'attendance'} icon={<Clock />} label="تقرير الحضور" onClick={() => setActiveTab('attendance')} />
           <StaffNav active={activeTab === 'leave'} icon={<FilePlus />} label="طلب إجازة" onClick={() => setActiveTab('leave')} />
           <StaffNav active={activeTab === 'profile'} icon={<User />} label="ملفي الشخصي" onClick={() => setActiveTab('profile')} />
        </div>
        <div className="lg:col-span-3 bg-white p-8 rounded-3xl shadow-sm border min-h-[500px]">
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">تقرير الحضور والانصراف التفصيلي</h3>
                <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="p-2 border rounded-xl outline-none font-bold bg-gray-50" />
              </div>
              <div className="overflow-x-auto border rounded-2xl bg-white shadow-inner">
                <table className="w-full text-sm text-right">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-4 border-b">التاريخ</th>
                      <th className="p-4 border-b">الحضور</th>
                      <th className="p-4 border-b">حالة الحضور</th>
                      <th className="p-4 border-b">الانصراف</th>
                      <th className="p-4 border-b">حالة الانصراف</th>
                      <th className="p-4 border-b">ساعات العمل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]), 0).getDate() }, (_, i) => {
                      const day = i + 1;
                      const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                      const att = attendance.find(a => a.date === dateStr);
                      const holiday = isHoliday(dateStr);
                      const leave = getLeaveOnDate(dateStr);
                      
                      const times = att?.times.split(/\s+/).filter(t => t.includes(':')) || [];
                      const cin = times[0] || null;
                      const cout = times.length > 1 ? times[times.length - 1] : null;
                      const workHours = (cin && cout) ? calculateHours(cin, cout).toFixed(1) : (att ? '0.0' : '--');

                      let rowClass = "border-b hover:bg-gray-50 transition-colors";
                      let statusIn = cin ? (settings?.shift_morning_in && cin > settings.shift_morning_in ? "متأخر" : "منتظم") : (holiday ? "عطلة" : (leave ? "إجازة" : "غياب"));
                      let statusOut = cout ? "انصراف" : (cin ? "ترك عمل" : "--");

                      if (holiday) rowClass += " bg-gray-50 text-gray-400";
                      if (leave) rowClass += " bg-blue-50";

                      return (
                        <tr key={dateStr} className={rowClass}>
                          <td className="p-4 font-bold">{dateStr} {isFriday(dateStr) && <span className="text-[10px] text-blue-500">(جمعة)</span>}</td>
                          <td className="p-4 text-emerald-600 font-bold">{cin || '--'}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusIn === 'منتظم' ? 'bg-emerald-100 text-emerald-700' : statusIn === 'متأخر' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100'}`}>
                              {statusIn}
                            </span>
                          </td>
                          <td className="p-4 text-red-500 font-bold">{cout || '--'}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusOut === 'انصراف' ? 'bg-blue-100 text-blue-700' : statusOut === 'ترك عمل' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>
                              {statusOut}
                            </span>
                          </td>
                          <td className="p-4 font-mono font-bold text-gray-700">{workHours} ساعة</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'leave' && <StaffLeaveForm employee={employee} requests={allMyRequests} refresh={() => fetchStaffData(employee.employee_id)} />}
          {activeTab === 'profile' && (
            <div className="space-y-6">
               <h3 className="text-xl font-bold border-b pb-4">معلومات الموظف الأساسية</h3>
               <div className="grid grid-cols-2 gap-6">
                  <div><label className="text-gray-400 text-xs">رقم الموظف</label><p className="font-bold">{employee.employee_id}</p></div>
                  <div><label className="text-gray-400 text-xs">الاسم</label><p className="font-bold">{employee.name}</p></div>
                  <div><label className="text-gray-400 text-xs">التخصص</label><p className="font-bold">{employee.specialty}</p></div>
                  <div><label className="text-gray-400 text-xs">الرقم القومي</label><p className="font-bold">{employee.national_id}</p></div>
               </div>
            </div>
          )}
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
  <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-2 items-center text-center">
    <div className="p-2 bg-gray-50 rounded-xl">{icon}</div>
    <div><p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{label}</p><p className="text-xl font-black text-gray-800">{value}</p></div>
  </div>
);

const StaffLeaveForm = ({ employee, requests, refresh }: any) => {
  const [formData, setFormData] = useState({ 
    type: 'اعتيادي', 
    start: '', 
    end: '', 
    back: '', 
    backup: '', 
    notes: '' 
  });

  const submit = async () => {
    // التحقق من الخانات الإجبارية
    if(!formData.start || !formData.end || !formData.back || !formData.backup) {
        return alert('برجاء إكمال جميع البيانات الإجبارية المميزة بنجمة (*)');
    }

    const { error } = await supabase.from('leave_requests').insert([{ 
        employee_id: employee.employee_id, 
        type: formData.type,
        start_date: formData.start,
        end_date: formData.end,
        back_date: formData.back,
        backup_person: formData.backup,
        notes: formData.notes,
        status: 'معلق' 
    }]);

    if(!error) { 
        alert('تم إرسال طلب الإجازة بنجاح'); 
        setFormData({ type: 'اعتيادي', start: '', end: '', back: '', backup: '', notes: '' });
        refresh(); 
    } else {
        alert('حدث خطأ أثناء إرسال الطلب: ' + error.message);
    }
  };

  return (
    <div className="space-y-8">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><FilePlus className="text-emerald-600"/> تقديم طلب إجازة جديد</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-6 rounded-2xl border">
        <Select label="نوع الطلب" options={['اعتيادي', 'عارضة', 'مرضي']} value={formData.type} onChange={(v:any)=>setFormData({...formData, type: v})} required />
        <Input label="تاريخ البداية" type="date" value={formData.start} onChange={(v:any)=>setFormData({...formData, start: v})} required />
        <Input label="تاريخ النهاية" type="date" value={formData.end} onChange={(v:any)=>setFormData({...formData, end: v})} required />
        <Input label="تاريخ العودة للعمل" type="date" value={formData.back} onChange={(v:any)=>setFormData({...formData, back: v})} required />
        <Input label="القائم بالعمل (البديل)" value={formData.backup} onChange={(v:any)=>setFormData({...formData, backup: v})} required placeholder="اسم الزميل البديل" />
        <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">الملاحظات (اختياري)</label>
            <textarea 
                className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="أي ملاحظات إضافية..."
            ></textarea>
        </div>
        <button onClick={submit} className="md:col-span-2 bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-md hover:bg-emerald-700 transition-all">إرسال طلب الإجازة</button>
      </div>
      
      <h3 className="text-xl font-bold flex items-center gap-2 mt-10"><List className="text-blue-600"/> سجل طلباتي السابقة</h3>
      <div className="overflow-x-auto rounded-2xl border shadow-inner bg-white">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-50">
            <tr>
                <th className="p-4 border-b">النوع</th>
                <th className="p-4 border-b">الفترة</th>
                <th className="p-4 border-b">العودة للعمل</th>
                <th className="p-4 border-b">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r:any) => (
              <tr key={r.id} className="border-b hover:bg-gray-50 transition-colors">
                <td className="p-4 font-bold">{r.type}</td>
                <td className="p-4 text-xs font-semibold">{r.start_date} إلى {r.end_date}</td>
                <td className="p-4 text-xs">{r.back_date || '--'}</td>
                <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${r.status === 'مقبول' ? 'bg-emerald-100 text-emerald-700' : r.status === 'مرفوض' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.status}
                    </span>
                </td>
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-gray-400">لا يوجد سجل طلبات حالياً</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StaffDashboard;
