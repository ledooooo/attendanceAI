
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, User, Calendar, FilePlus, ClipboardCheck, MessageCircle, Send, LogOut, Clock, AlertTriangle, CheckCircle, List, BarChart, Inbox, FileText, Award, Printer, Share2, X, Filter, PieChart, Info, MapPin, Phone, Mail, Hash, Briefcase, CalendarDays, ShieldCheck, FileImage, LayoutGrid, TrendingUp
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
        <div className="bg-white p-12 rounded-[50px] shadow-2xl shadow-emerald-50 w-full max-w-md border border-gray-100 animate-in zoom-in duration-300">
          <button onClick={onBack} className="flex items-center text-emerald-600 mb-10 font-black hover:gap-3 transition-all"><ArrowRight className="ml-2 w-5 h-5" /> العودة للرئيسية</button>
          <div className="text-center mb-10">
            <div className="w-24 h-24 bg-emerald-50 rounded-[40px] flex items-center justify-center mx-auto mb-6 border-2 border-emerald-100 shadow-inner">
              <User className="w-12 h-12 text-emerald-600" />
            </div>
            <h2 className="text-3xl font-black text-gray-800 tracking-tighter">بوابة دخول العاملين</h2>
            <p className="text-gray-400 text-xs font-bold mt-2">يُرجى إدخال بيانات الهوية للوصول لملفك</p>
          </div>
          <div className="space-y-6">
            <Input label="رقم الموظف (الكود)" value={loginData.id} onChange={(v:any) => setLoginData({...loginData, id: v})} placeholder="مثال: 1010" />
            <Input label="الرقم القومي" type="password" value={loginData.natId} onChange={(v:any) => setLoginData({...loginData, natId: v})} placeholder="الـ 14 رقم بالكامل" />
            <button 
              onClick={async () => {
                setLoading(true);
                const { data } = await supabase.from('employees').select('*').eq('employee_id', loginData.id).eq('national_id', loginData.natId).maybeSingle();
                if(data) { setEmployee(data); fetchStaffData(data.employee_id); } else alert('البيانات المدخلة غير صحيحة، يرجى مراجعة إدارة شئون العاملين');
                setLoading(false);
              }} 
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-5 rounded-[25px] font-black shadow-2xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 flex justify-center items-center gap-3"
            >
              {loading ? <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : 'تسجيل دخول للمنصة'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-10 text-right">
      <div className="bg-white p-10 rounded-[55px] shadow-sm border border-gray-50 mb-12 flex flex-col md:flex-row justify-between items-center no-print gap-6">
        <div className="flex items-center gap-8">
          <div className="relative">
            <div className="w-24 h-24 bg-emerald-50 rounded-[35px] flex items-center justify-center border-4 border-white shadow-xl overflow-hidden z-10">
              {employee.photo_url ? <img src={employee.photo_url} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-12 h-12 text-emerald-600" />}
            </div>
            <div className="absolute -bottom-2 -left-2 bg-emerald-500 w-8 h-8 rounded-full border-4 border-white shadow-lg animate-pulse"></div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-800 tracking-tighter">{employee.name}</h1>
            <p className="text-emerald-600 font-black text-lg flex items-center gap-2 mt-1"><Briefcase className="w-4 h-4"/> {employee.specialty} • كود: {employee.employee_id}</p>
          </div>
        </div>
        <button onClick={() => setEmployee(null)} className="flex items-center text-red-600 font-black bg-red-50 px-10 py-4 rounded-[30px] hover:bg-red-100 transition-all shadow-sm active:scale-95">تسجيل خروج <LogOut className="mr-3 w-5 h-5"/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        <div className="lg:col-span-1 space-y-3 no-print bg-white p-6 rounded-[45px] border border-gray-50 shadow-sm h-fit">
           <StaffNav active={activeTab === 'profile'} icon={<LayoutGrid className="w-5 h-5"/>} label="لوحة التحكم الشخصية" onClick={() => setActiveTab('profile')} />
           <StaffNav active={activeTab === 'attendance'} icon={<Clock className="w-5 h-5"/>} label="سجل الحضور اليومي" onClick={() => setActiveTab('attendance')} />
           <StaffNav active={activeTab === 'new-request'} icon={<FilePlus className="w-5 h-5"/>} label="تقديم طلب جديد" onClick={() => setActiveTab('new-request')} />
           <StaffNav active={activeTab === 'requests-history'} icon={<List className="w-5 h-5"/>} label="تاريخ طلباتي" onClick={() => setActiveTab('requests-history')} />
           <StaffNav active={activeTab === 'evals'} icon={<Award className="w-5 h-5"/>} label="التقييمات الشهرية" onClick={() => setActiveTab('evals')} />
           <StaffNav active={activeTab === 'messages'} icon={<Inbox className="w-5 h-5"/>} label="تنبيهات الإدارة" onClick={() => setActiveTab('messages')} />
        </div>

        <div className="lg:col-span-3 bg-white p-12 rounded-[60px] shadow-sm border border-gray-50 min-h-[650px] relative overflow-hidden animate-in slide-in-from-left duration-500">
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
          {activeTab === 'evals' && <StaffEvaluations evals={evaluations} />}
          {activeTab === 'messages' && <StaffMessages messages={messages} />}
        </div>
      </div>
    </div>
  );
};

// --- المكونات الفرعية ---

const ProfileItem = ({ label, value, icon: Icon }: any) => (
    <div className="p-6 bg-gray-50/50 rounded-[30px] border border-gray-100 flex items-center gap-5 group hover:bg-white hover:border-emerald-100 transition-all hover:shadow-xl hover:shadow-emerald-50">
        <div className="p-4 bg-white rounded-2xl text-emerald-600 shadow-md border border-gray-50 group-hover:scale-110 transition-transform">{Icon && <Icon className="w-6 h-6" />}</div>
        <div className="flex-1">
            <label className="text-[10px] text-gray-400 font-black block mb-1 uppercase tracking-widest">{label}</label>
            <p className="font-bold text-gray-800 text-lg">{value || '--'}</p>
        </div>
    </div>
);

const StaffProfile = ({ employee }: { employee: Employee }) => {
    return (
        <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-8 bg-emerald-600 rounded-[45px] text-white shadow-2xl shadow-emerald-100 relative overflow-hidden group">
                    <PieChart className="absolute -right-6 -bottom-6 w-32 h-32 opacity-20 group-hover:rotate-12 transition-transform"/>
                    <h4 className="font-black text-sm uppercase opacity-80 mb-2">رصيد الإجازات الاعتيادي</h4>
                    <p className="text-5xl font-black mb-1">{employee.remaining_annual} <span className="text-xl">يوم</span></p>
                    <p className="text-xs font-bold opacity-70">من إجمالي {employee.leave_annual_balance} يوم متاح سنوياً</p>
                </div>
                <div className="p-8 bg-blue-600 rounded-[45px] text-white shadow-2xl shadow-blue-100 relative overflow-hidden group">
                    <TrendingUp className="absolute -right-6 -bottom-6 w-32 h-32 opacity-20 group-hover:rotate-12 transition-transform"/>
                    <h4 className="font-black text-sm uppercase opacity-80 mb-2">رصيد الإجازات العارضة</h4>
                    <p className="text-5xl font-black mb-1">{employee.remaining_casual} <span className="text-xl">يوم</span></p>
                    <p className="text-xs font-bold opacity-70">متبقي من {employee.leave_casual_balance} أيام عارضة</p>
                </div>
            </div>

            <div className="space-y-6">
                <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800 border-r-4 border-emerald-600 pr-4">بيانات الملف الوظيفي</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <ProfileItem label="الاسم الرباعي" value={employee.name} icon={User} />
                    <ProfileItem label="الرقم القومي" value={employee.national_id} icon={ShieldCheck} />
                    <ProfileItem label="الدرجة الوظيفية" value={employee.grade} icon={Award} />
                    <ProfileItem label="تاريخ التعيين" value={employee.join_date} icon={CalendarDays} />
                    <ProfileItem label="رقم التواصل" value={employee.phone} icon={Phone} />
                    <ProfileItem label="توقيت الحضور الرسمي" value={employee.start_time} icon={Clock} />
                </div>
            </div>

            <div className="p-8 bg-gray-50/50 rounded-[40px] border border-gray-100 space-y-6">
                <h3 className="font-black text-gray-700 flex items-center gap-2"><FileImage className="w-5 h-5 text-emerald-600"/> مستندات الهوية المسجلة</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400">وجه البطاقة</label>
                        <div className="h-48 bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm flex items-center justify-center">
                            {employee.id_front_url ? <img src={employee.id_front_url} className="w-full h-full object-contain" /> : <div className="text-gray-200 italic text-xs font-bold">لم يتم الرفع</div>}
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400">ظهر البطاقة</label>
                        <div className="h-48 bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm flex items-center justify-center">
                            {employee.id_back_url ? <img src={employee.id_back_url} className="w-full h-full object-contain" /> : <div className="text-gray-200 italic text-xs font-bold">لم يتم الرفع</div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StaffAttendance = ({ attendance, selectedMonth, setSelectedMonth, calculateHours, employee }: any) => {
    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center mb-6 no-print">
                <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><Clock className="text-emerald-600 w-8 h-8" /> سجل الحضور والانصراف التفصيلي</h3>
                <div className="flex items-center gap-4">
                    <label className="text-xs font-black text-gray-400">اختر الشهر:</label>
                    <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="p-3 bg-gray-50 border border-gray-100 rounded-2xl font-black outline-none focus:ring-4 focus:ring-emerald-50 shadow-inner" />
                </div>
            </div>
            <div className="overflow-x-auto border rounded-[45px] shadow-2xl shadow-gray-100 bg-white">
                <table className="w-full text-sm text-right">
                  <thead className="bg-gray-100 font-black text-gray-500">
                    <tr className="border-b">
                        <th className="p-6">التاريخ</th>
                        <th className="p-6">اليوم</th>
                        <th className="p-6 text-emerald-600 text-center">الحضور</th>
                        <th className="p-6 text-red-500 text-center">الانصراف</th>
                        <th className="p-6 text-center">ساعات العمل</th>
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
                      const times = att?.times.split(/\s+/).filter((t:string) => t.includes(':')) || [];
                      const cin = times[0] || '--';
                      const cout = times.length > 1 ? times[times.length - 1] : '--';
                      const hours = times.length >= 2 ? calculateHours(times[0], times[times.length-1]).toFixed(1) : '0.0';
                      return (
                        <tr key={dateStr} className="border-b hover:bg-emerald-50/30 transition-all group">
                          <td className="p-6 font-bold">{dateStr}</td>
                          <td className="p-6 font-black">{dayName}</td>
                          <td className="p-6 text-emerald-600 font-black text-center text-lg">{cin}</td>
                          <td className="p-6 text-red-500 font-black text-center text-lg">{cout}</td>
                          <td className="p-6 font-mono font-black text-center bg-gray-50/50 group-hover:bg-emerald-600 group-hover:text-white transition-colors">{hours} <span className="text-[10px]">س</span></td>
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
        <div className="space-y-10">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800 border-r-4 border-emerald-600 pr-4">تقديم طلب إجازة / مأمورية رسمية</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-50/50 p-10 rounded-[50px] border border-gray-100 shadow-inner">
                <div className="md:col-span-2"><Select label="نوع الطلب" options={LEAVE_TYPES} value={formData.type} onChange={(v:any)=>setFormData({...formData, type: v})} /></div>
                <Input label="بداية الفترة" type="date" value={formData.start} onChange={(v:any)=>setFormData({...formData, start: v})} />
                <Input label="نهاية الفترة" type="date" value={formData.end} onChange={(v:any)=>setFormData({...formData, end: v})} />
                <Input label="الموظف البديل لتغطية العمل" value={formData.backup} onChange={(v:any)=>setFormData({...formData, backup: v})} placeholder="اسم الزميل البديل" />
                <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-widest">ملاحظات أو مبرر الطلب</label>
                    <textarea value={formData.notes} onChange={e=>setFormData({...formData, notes: e.target.value})} className="w-full p-4 border rounded-[25px] outline-none focus:ring-4 focus:ring-emerald-50 bg-white shadow-sm font-bold text-sm" rows={3} placeholder="يرجى كتابة أي تفاصيل إضافية..." />
                </div>
                <button 
                    onClick={submit} 
                    disabled={submitting}
                    className="md:col-span-2 bg-emerald-600 text-white py-5 rounded-[25px] font-black text-lg shadow-2xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 disabled:bg-gray-300"
                >
                    {submitting ? 'جاري بث الطلب...' : 'إرسال الطلب للاعتماد'}
                </button>
            </div>
            <div className="bg-amber-50 p-6 rounded-[30px] border border-amber-100 flex gap-4 items-start">
                <Info className="w-6 h-6 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-800 leading-relaxed font-bold"><b>تنبيه فني:</b> سيتم خصم رصيد الإجازات تلقائياً من رصيدك المتاح (اعتيادي/عارضة) بمجرد موافقة مدير المركز وشئون العاملين على هذا الطلب.</p>
            </div>
        </div>
    );
};

const StaffRequestsHistory = ({ requests }: { requests: LeaveRequest[] }) => {
    return (
        <div className="space-y-8">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800 border-r-4 border-emerald-600 pr-4">سجل الطلبات والقرارات الإدارية</h3>
            <div className="grid gap-5">
                {requests.map(r => (
                    <div key={r.id} className="p-8 bg-white border border-gray-100 rounded-[40px] flex justify-between items-center shadow-sm hover:shadow-xl transition-all group">
                        <div className="flex gap-5 items-center">
                            <div className={`p-4 rounded-[25px] ${r.status === 'مقبول' ? 'bg-green-50 text-green-600' : r.status === 'مرفوض' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                <FileText className="w-7 h-7" />
                            </div>
                            <div>
                                <h4 className="font-black text-xl text-gray-800 mb-1">{r.type}</h4>
                                <p className="text-sm text-gray-400 font-bold">للفترة من {r.start_date} حتى {r.end_date}</p>
                            </div>
                        </div>
                        <div className={`px-6 py-3 rounded-2xl text-[10px] font-black shadow-lg ${r.status === 'مقبول' ? 'bg-green-600 text-white' : r.status === 'مرفوض' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
                            {r.status}
                        </div>
                    </div>
                ))}
                {requests.length === 0 && <div className="text-center py-24 text-gray-400 border-4 border-dashed rounded-[45px] font-black italic">لا يوجد سجل طلبات حالياً في ملفك</div>}
            </div>
        </div>
    );
};

const StaffEvaluations = ({ evals }: { evals: Evaluation[] }) => {
    return (
        <div className="space-y-8">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800 border-r-4 border-emerald-600 pr-4">تقييم الأداء الطبي الشهري</h3>
            <div className="grid gap-8">
                {evals.map(ev => {
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
                        <div key={ev.id} className="p-10 bg-white border border-gray-100 rounded-[45px] shadow-xl hover:shadow-emerald-50 transition-all border-r-[12px] border-r-emerald-600">
                            <div className="flex justify-between items-center mb-8 border-b pb-4">
                                <h4 className="font-black text-2xl text-emerald-700 tracking-tighter">تقييم شهر: {ev.month}</h4>
                                <div className="text-4xl font-black text-emerald-600">{ev.total_score} <span className="text-sm text-gray-400 font-bold">/ 100</span></div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
                                {criteria.map((c, i) => (
                                    <div key={i} className="bg-gray-50 p-4 rounded-3xl text-center border border-gray-100">
                                        <p className="text-[9px] text-gray-400 font-black mb-1 uppercase">{c.label}</p>
                                        <p className="font-black text-emerald-600 text-lg">{c.score}</p>
                                    </div>
                                ))}
                            </div>
                            {ev.notes && (
                                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-sm font-bold text-emerald-800">
                                    <b>ملاحظات الإدارة:</b> {ev.notes}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const StaffMessages = ({ messages }: { messages: InternalMessage[] }) => (
    <div className="space-y-8">
        <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800 border-r-4 border-emerald-600 pr-4">صندوق الرسائل والتنبيهات الرسمية</h3>
        <div className="space-y-5">
            {messages.map((m: any) => (
                <div key={m.id} className={`p-8 rounded-[40px] border-2 transition-all ${m.from_user === 'admin' ? 'bg-white border-emerald-100 shadow-xl shadow-emerald-50' : 'bg-gray-50 border-transparent opacity-70'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center ${m.from_user === 'admin' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-gray-300 text-white'}`}>
                                <ShieldCheck className="w-8 h-8"/>
                            </div>
                            <span className="font-black text-lg text-gray-800">{m.from_user === 'admin' ? 'إدارة المركز الطبي' : 'تنبيه النظام'}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-black flex items-center gap-1"><Clock className="w-3 h-3"/> {new Date(m.created_at).toLocaleString('ar-EG')}</span>
                    </div>
                    <p className="text-gray-700 leading-loose text-sm font-bold pr-18">{m.content}</p>
                </div>
            ))}
            {messages.length === 0 && <div className="text-center py-32 text-gray-400 border-4 border-dashed rounded-[50px] font-black italic">صندوق الرسائل فارغ تماماً حالياً</div>}
        </div>
    </div>
);

const StaffNav = ({ active, icon, label, onClick }: any) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center p-4 rounded-[25px] font-black transition-all active:scale-95 group ${active ? 'bg-emerald-600 text-white shadow-2xl shadow-emerald-100' : 'bg-white text-gray-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
  >
    <span className={`ml-3 p-3 rounded-2xl transition-colors ${active ? 'bg-emerald-500 text-white shadow-inner' : 'bg-gray-50 text-gray-300 group-hover:bg-white'}`}>{icon}</span>
    {label}
  </button>
);

export default StaffDashboard;
