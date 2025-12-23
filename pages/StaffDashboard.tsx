
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, User, Calendar, FilePlus, ClipboardCheck, MessageCircle, Send, LogOut, Clock, Search
} from 'lucide-react';
import { Employee, LeaveRequest, AttendanceRecord, InternalMessage, GeneralSettings } from '../types';

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
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

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
    const [attRes, msgRes, leaveRes, setRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('employee_id', empId),
      supabase.from('messages').select('*').or(`to_user.eq.${empId},to_user.eq.all`).order('created_at', { ascending: false }),
      supabase.from('leave_requests').select('*').eq('employee_id', empId).eq('status', 'مقبول'),
      supabase.from('general_settings').select('*').limit(1).single()
    ]);
    if (attRes.data) setAttendance(attRes.data);
    if (msgRes.data) setMessages(msgRes.data);
    if (leaveRes.data) setLeaves(leaveRes.data);
    if (setRes.data) setSettings(setRes.data);
  };

  useEffect(() => {
    if (employee) fetchStaffData(employee.employee_id);
  }, [selectedMonth]);

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-6">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-6 hover:underline">
            <ArrowRight className="w-4 h-4 ml-1" /> العودة للرئيسية
          </button>
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">دخول العاملين</h2>
          <div className="space-y-4">
            <StaffInput label="رقم الموظف" value={loginData.id} onChange={(v: string) => setLoginData({...loginData, id: v})} />
            <StaffInput label="الرقم القومي" value={loginData.natId} onChange={(v: string) => setLoginData({...loginData, natId: v})} />
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
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center border-2 border-emerald-200">
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
           <StaffNav active={activeTab === 'attendance'} icon={<Clock />} label="تقارير الحضور الشهرية" onClick={() => setActiveTab('attendance')} />
           <StaffNav active={activeTab === 'leave'} icon={<FilePlus />} label="تقديم طلب إجازة" onClick={() => setActiveTab('leave')} />
           <StaffNav active={activeTab === 'eval'} icon={<ClipboardCheck />} label="تقييمي الشهري" onClick={() => setActiveTab('eval')} />
           <StaffNav active={activeTab === 'messages'} icon={<MessageCircle />} label={`الرسائل (${messages.length})`} onClick={() => setActiveTab('messages')} />
        </div>

        <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border min-h-[500px]">
          {activeTab === 'attendance' && (
            <StaffAttendance 
              records={attendance} 
              leaves={leaves} 
              holidays={settings?.holidays || []}
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
            />
          )}
          {activeTab === 'leave' && <StaffLeaveForm employee={employee} />}
          {activeTab === 'eval' && <StaffEval employee={employee} />}
          {activeTab === 'messages' && <StaffMessages messages={messages} employeeId={employee.employee_id} />}
        </div>
      </div>
    </div>
  );
};

// Helper to calculate hours
const calculateHours = (inTime: string | null, outTime: string | null) => {
  if (!inTime || !outTime) return '0';
  const [h1, m1] = inTime.split(':').map(Number);
  const [h2, m2] = outTime.split(':').map(Number);
  const date1 = new Date(0, 0, 0, h1, m1);
  const date2 = new Date(0, 0, 0, h2, m2);
  let diff = (date2.getTime() - date1.getTime()) / 1000 / 60 / 60;
  if (diff < 0) diff += 24; // Handle overnight shifts
  return diff.toFixed(1);
};

const StaffAttendance = ({ records, leaves, holidays, selectedMonth, setSelectedMonth }: any) => {
  // Generate days for the selected month
  const [year, month] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h3 className="text-xl font-bold">تقرير الحضور والانصراف التفصيلي</h3>
        <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent outline-none text-sm font-bold"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-50 text-gray-600 border-b">
            <tr>
              <th className="p-3 text-center">التاريخ</th>
              <th className="p-3 text-center">توقيت الحضور</th>
              <th className="p-3 text-center">حالة الحضور</th>
              <th className="p-3 text-center">توقيت الانصراف</th>
              <th className="p-3 text-center">ساعات العمل</th>
            </tr>
          </thead>
          <tbody>
            {daysArray.map(date => {
              const record = records.find((r: any) => r.date === date);
              const isLeave = leaves.some((l: any) => date >= l.start_date && date <= l.end_date);
              const isHoliday = holidays.includes(date);
              
              let statusText = "";
              let rowClass = "border-b hover:bg-gray-50 transition-colors";

              if (record) {
                statusText = record.check_in_status;
              } else if (isLeave) {
                statusText = "إجازة معتمدة";
                rowClass += " bg-blue-50/30";
              } else if (isHoliday) {
                statusText = "عطلة رسمية";
                rowClass += " bg-amber-50/30";
              } else {
                statusText = "غياب";
                rowClass += " text-red-500 bg-red-50/20";
              }

              return (
                <tr key={date} className={rowClass}>
                  <td className="p-3 text-center font-bold">{date}</td>
                  <td className="p-3 text-center font-mono">{record?.check_in || '--:--'}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      record ? 'bg-emerald-100 text-emerald-700' : 
                      isLeave ? 'bg-blue-100 text-blue-700' : 
                      isHoliday ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {statusText}
                    </span>
                  </td>
                  <td className="p-3 text-center font-mono">{record?.check_out || '--:--'}</td>
                  <td className="p-3 text-center font-bold text-gray-700">
                    {record ? `${calculateHours(record.check_in, record.check_out)} ساعة` : '--'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StaffLeaveForm = ({ employee }: { employee: Employee }) => {
  const [formData, setFormData] = useState({ type: 'اعتيادي', start: '', end: '', backup: '', notes: '' });

  const submit = async () => {
    if (!formData.start || !formData.end) return alert('برجاء تحديد التواريخ');
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
          <select className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
            <option value="اعتيادي">إجازة اعتيادية</option>
            <option value="عارضة">إجازة عارضة</option>
            <option value="مرضي">إجازة مرضية</option>
            <option value="مأمورية">مأمورية عمل</option>
          </select>
        </div>
        <div>
           <label className="block text-sm font-semibold mb-1">تاريخ البداية</label>
           <input type="date" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.start} onChange={e => setFormData({...formData, start: e.target.value})} />
        </div>
        <div>
           <label className="block text-sm font-semibold mb-1">تاريخ النهاية</label>
           <input type="date" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.end} onChange={e => setFormData({...formData, end: e.target.value})} />
        </div>
        <div>
           <label className="block text-sm font-semibold mb-1">القائم بالعمل (البديل)</label>
           <input type="text" placeholder="اسم الزميل البديل" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.backup} onChange={e => setFormData({...formData, backup: e.target.value})} />
        </div>
        <div className="md:col-span-2">
           <label className="block text-sm font-semibold mb-1">ملاحظات إضافية</label>
           <textarea className="w-full p-3 border rounded-lg min-h-[100px] focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="اكتب سبب الطلب أو أي تفاصيل أخرى..." value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
        </div>
        <div className="md:col-span-2">
          <button onClick={submit} className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-md">إرسال الطلب للمدير</button>
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
    if(!content) return;
    const { error } = await supabase.from('messages').insert([{
      from_user: employeeId,
      to_user: recipient,
      content
    }]);
    if(error) alert('خطأ في الإرسال');
    else {
      alert('تم إرسال الرسالة بنجاح');
      setContent('');
      setShowCompose(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h3 className="text-xl font-bold">الرسائل والتنبيهات</h3>
        <button onClick={() => setShowCompose(!showCompose)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors">
          {showCompose ? 'إلغاء' : 'إرسال رسالة للمدير'}
        </button>
      </div>

      {showCompose && (
        <div className="p-6 border rounded-xl bg-blue-50/50 space-y-4 mb-6 animate-in slide-in-from-top duration-300">
          <label className="block text-sm font-bold">المستلم</label>
          <select className="w-full p-2 rounded border bg-white" value={recipient} onChange={e => setRecipient(e.target.value)}>
             <option value="admin">إدارة المركز الرئيسي</option>
          </select>
          <textarea className="w-full p-3 rounded border min-h-[120px] bg-white outline-none focus:ring-2 focus:ring-blue-400" placeholder="اكتب استفسارك أو رسالتك هنا..." value={content} onChange={e => setContent(e.target.value)} />
          <button onClick={send} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow-sm">إرسال الرسالة الآن</button>
        </div>
      )}

      <div className="space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`p-4 rounded-xl border-r-4 ${m.from_user === 'admin' ? 'bg-amber-50 border-amber-400' : 'bg-white border-blue-400 shadow-sm'}`}>
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span className="font-bold text-gray-600">من: {m.from_user === 'admin' ? 'الإدارة' : 'أنا'}</span>
              <span>{new Date(m.created_at).toLocaleString('ar-EG')}</span>
            </div>
            <p className="text-gray-800 leading-relaxed text-sm">{m.content}</p>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-center py-20 text-gray-400 border-2 border-dashed rounded-xl">
            <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p>لا يوجد رسائل في صندوق الوارد</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Nav components
const StaffInput = ({ label, onChange, value, ...props }: any) => (
  <div>
    <label className="block text-sm font-semibold mb-1 text-gray-700">{label}</label>
    <input 
      className="w-full p-2.5 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...props} 
    />
  </div>
);

const StaffNav = ({ active, icon, label, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center p-4 rounded-xl transition-all font-semibold ${
      active ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border'
    }`}
  >
    <span className="ml-3">{icon}</span>
    {label}
  </button>
);

export default StaffDashboard;
