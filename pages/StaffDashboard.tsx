
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, User, Calendar, FilePlus, ClipboardCheck, MessageCircle, Send, LogOut, Clock
} from 'lucide-react';
import { Employee, LeaveRequest, AttendanceRecord, InternalMessage } from '../types';

interface StaffDashboardProps {
  onBack: () => void;
  employee: Employee | null;
  setEmployee: (emp: Employee | null) => void;
}

const StaffDashboard: React.FC<StaffDashboardProps> = ({ onBack, employee, setEmployee }) => {
  const [loginData, setLoginData] = useState({ id: '', natId: '', phone: '', email: '' });
  const [activeTab, setActiveTab] = useState('attendance');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('employees')
      .select('*')
      .eq('employee_id', loginData.id)
      .eq('national_id', loginData.natId)
      .maybeSingle();

    if (data) {
      setEmployee(data);
      fetchStaffData(data.employee_id);
    } else {
      alert('بيانات الدخول غير صحيحة');
    }
    setLoading(false);
  };

  const fetchStaffData = async (empId: string) => {
    const [attRes, msgRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('employee_id', empId).order('date', { ascending: false }),
      supabase.from('messages').select('*').or(`to_user.eq.${empId},to_user.eq.all`).order('created_at', { ascending: false })
    ]);
    if (attRes.data) setAttendance(attRes.data);
    if (msgRes.data) setMessages(msgRes.data);
  };

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-6">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-6 hover:underline">
            <ArrowRight className="w-4 h-4 ml-1" /> العودة للرئيسية
          </button>
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">دخول العاملين</h2>
          <div className="space-y-4">
            <StaffInput label="رقم الموظف" value={loginData.id} onChange={v => setLoginData({...loginData, id: v})} />
            <StaffInput label="الرقم القومي" value={loginData.natId} onChange={v => setLoginData({...loginData, natId: v})} />
            <StaffInput label="رقم الهاتف" value={loginData.phone} onChange={v => setLoginData({...loginData, phone: v})} />
            <StaffInput label="البريد الإلكتروني" value={loginData.email} onChange={v => setLoginData({...loginData, email: v})} />
            <button 
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 disabled:bg-gray-400 transition-colors"
            >
              {loading ? 'جاري التحقق...' : 'دخول'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="bg-white p-6 rounded-2xl shadow-sm border mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
            <User className="w-10 h-10 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{employee.name}</h1>
            <p className="text-gray-500">{employee.specialty} | كود: {employee.employee_id}</p>
            <div className="mt-2 flex gap-2">
              <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs font-bold">اعتيادي: {employee.remaining_annual}</span>
              <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded text-xs font-bold">عارضة: {employee.remaining_casual}</span>
            </div>
          </div>
        </div>
        <button onClick={() => setEmployee(null)} className="flex items-center text-red-500 hover:text-red-700 font-bold border-r pr-6 border-gray-200">
           تسجيل الخروج <LogOut className="w-5 h-5 mr-2" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 flex flex-col gap-2">
           <StaffNav active={activeTab === 'attendance'} icon={<Clock />} label="تقارير الحضور" onClick={() => setActiveTab('attendance')} />
           <StaffNav active={activeTab === 'leave'} icon={<FilePlus />} label="تقديم طلب إجازة" onClick={() => setActiveTab('leave')} />
           <StaffNav active={activeTab === 'eval'} icon={<ClipboardCheck />} label="تقييمي الشهري" onClick={() => setActiveTab('eval')} />
           <StaffNav active={activeTab === 'messages'} icon={<MessageCircle />} label="الرسائل (" + messages.length + ")" onClick={() => setActiveTab('messages')} />
        </div>

        <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border min-h-[500px]">
          {activeTab === 'attendance' && <StaffAttendance records={attendance} />}
          {activeTab === 'leave' && <StaffLeaveForm employee={employee} />}
          {activeTab === 'eval' && <StaffEval employee={employee} />}
          {activeTab === 'messages' && <StaffMessages messages={messages} employeeId={employee.employee_id} />}
        </div>
      </div>
    </div>
  );
};

// Staff components
const StaffInput = ({ label, ...props }: any) => (
  <div>
    <label className="block text-sm font-semibold mb-1">{label}</label>
    <input className="w-full p-2.5 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-emerald-500 outline-none" {...props} />
  </div>
);

const StaffNav = ({ active, icon, label, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center p-4 rounded-xl transition-all font-semibold ${
      active ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100'
    }`}
  >
    <span className="ml-3">{icon}</span>
    {label}
  </button>
);

const StaffAttendance = ({ records }: { records: AttendanceRecord[] }) => (
  <div className="space-y-4">
    <h3 className="text-xl font-bold mb-4">سجل الحضور والانصراف</h3>
    <div className="grid grid-cols-1 gap-3">
      {records.length === 0 && <p className="text-center py-20 text-gray-400">لا يوجد سجلات حضور مسجلة حتى الآن.</p>}
      {records.map(r => (
        <div key={r.id} className="p-4 border rounded-xl flex justify-between items-center">
          <div>
            <span className="block font-bold text-lg">{r.date}</span>
            <span className="text-sm text-gray-500">الحالة: {r.check_in_status}</span>
          </div>
          <div className="flex gap-4">
            <div className="text-center">
              <span className="block text-xs text-gray-400">حضور</span>
              <span className="font-mono text-emerald-600 font-bold">{r.check_in || '--:--'}</span>
            </div>
            <div className="text-center">
              <span className="block text-xs text-gray-400">انصراف</span>
              <span className="font-mono text-red-500 font-bold">{r.check_out || '--:--'}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const StaffLeaveForm = ({ employee }: { employee: Employee }) => {
  const [formData, setFormData] = useState({ type: 'اعتيادي', start: '', end: '', backup: '', notes: '' });

  const submit = async () => {
    const { error } = await supabase.from('leave_requests').insert([{
      employee_id: employee.employee_id,
      ...formData,
      status: 'معلق'
    }]);
    if (error) alert('خطأ في الإرسال');
    else {
      alert('تم تقديم الطلب بنجاح وهو قيد المراجعة');
      setFormData({ type: 'اعتيادي', start: '', end: '', backup: '', notes: '' });
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold mb-4">تقديم طلب إجازة أو عارضة</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">نوع الطلب</label>
          <select className="w-full p-3 border rounded-lg bg-gray-50" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
            <option value="اعتيادي">إجازة اعتيادية</option>
            <option value="عارضة">إجازة عارضة</option>
            <option value="مرضي">إجازة مرضية</option>
            <option value="مأمورية">مأمورية عمل</option>
          </select>
        </div>
        <div>
           <label className="block text-sm font-semibold mb-1">تاريخ البداية</label>
           <input type="date" className="w-full p-3 border rounded-lg" value={formData.start} onChange={e => setFormData({...formData, start: e.target.value})} />
        </div>
        <div>
           <label className="block text-sm font-semibold mb-1">تاريخ النهاية</label>
           <input type="date" className="w-full p-3 border rounded-lg" value={formData.end} onChange={e => setFormData({...formData, end: e.target.value})} />
        </div>
        <div>
           <label className="block text-sm font-semibold mb-1">القائم بالعمل (البديل)</label>
           <input type="text" className="w-full p-3 border rounded-lg" value={formData.backup} onChange={e => setFormData({...formData, backup: e.target.value})} />
        </div>
        <div className="md:col-span-2">
           <label className="block text-sm font-semibold mb-1">ملاحظات إضافية</label>
           <textarea className="w-full p-3 border rounded-lg min-h-[100px]" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
        </div>
        <div className="md:col-span-2">
          <button onClick={submit} className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold">إرسال الطلب</button>
        </div>
      </div>
    </div>
  );
};

const StaffEval = ({ employee }: { employee: Employee }) => (
  <div className="space-y-6">
    <h3 className="text-xl font-bold mb-4">التقييمات الشهرية</h3>
    <div className="p-8 border-2 border-dashed rounded-2xl text-center bg-gray-50">
       <ClipboardCheck className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
       <h4 className="text-lg font-bold mb-2">لا يوجد تقييم متاح لهذا الشهر</h4>
       <p className="text-sm text-gray-400">سيتم عرض التقييم فور اعتماده من الإدارة.</p>
    </div>
  </div>
);

const StaffMessages = ({ messages, employeeId }: { messages: InternalMessage[], employeeId: string }) => {
  const [showCompose, setShowCompose] = useState(false);
  const [recipient, setRecipient] = useState('admin');
  const [content, setContent] = useState('');

  const send = async () => {
    const { error } = await supabase.from('messages').insert([{
      from_user: employeeId,
      to_user: recipient,
      content
    }]);
    if(error) alert('خطأ');
    else {
      alert('تم الإرسال');
      setContent('');
      setShowCompose(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">الرسائل الواردة</h3>
        <button onClick={() => setShowCompose(!showCompose)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm">
          {showCompose ? 'إغلاق' : 'رسالة جديدة'}
        </button>
      </div>

      {showCompose && (
        <div className="p-6 border rounded-xl bg-blue-50 space-y-4 mb-6 animate-in slide-in-from-top">
          <select className="w-full p-2 rounded border" value={recipient} onChange={e => setRecipient(e.target.value)}>
             <option value="admin">إدارة المركز</option>
             {/* Note: Can fetch list of employees here if needed */}
          </select>
          <textarea className="w-full p-3 rounded border min-h-[100px]" placeholder="محتوى الرسالة..." value={content} onChange={e => setContent(e.target.value)} />
          <button onClick={send} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold">إرسال</button>
        </div>
      )}

      <div className="space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`p-4 rounded-xl border-l-4 ${m.from_user === 'admin' ? 'bg-amber-50 border-amber-400' : 'bg-white border-blue-400 shadow-sm'}`}>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>من: {m.from_user === 'admin' ? 'الإدارة' : m.from_user}</span>
              <span>{new Date(m.created_at).toLocaleDateString('ar-EG')}</span>
            </div>
            <p className="text-gray-800 leading-relaxed">{m.content}</p>
          </div>
        ))}
        {messages.length === 0 && <p className="text-center py-10 text-gray-400">لا يوجد رسائل حالياً</p>}
      </div>
    </div>
  );
};

export default StaffDashboard;
