
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, Settings, Users, FileText, Calendar, 
  Clock, BarChart3, Bell, Upload, CheckCircle, XCircle, 
  Download, LogOut, ShieldCheck, Eye, 
  Award, User, Printer, MapPin, 
  CalendarDays, PieChart, TrendingUp, Baby, Stethoscope, Send
} from 'lucide-react';
import { GeneralSettings, Employee, LeaveRequest, AttendanceRecord, InternalMessage, Evaluation, EveningSchedule } from '../types';
import * as XLSX from 'xlsx';

// --- مساعدات البيانات ---

// دالة لتنسيق التاريخ لقاعدة البيانات
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

// دالة لتحميل نماذج الإكسل
const downloadSample = (type: 'staff' | 'attendance' | 'schedule') => {
    let data = [];
    let filename = "";
    if (type === 'staff') {
        data = [{
            'employee_id': '80',
            'name': 'موظف عينة 80',
            'national_id': '29001011234567',
            'specialty': 'تمريض',
            'grade': 'ثالثة',
            'gender': 'أنثى',
            'maternity': 'نعم',
            'join_date': '2023-01-01'
        }];
        filename = "Sample_Staff_80.xlsx";
    } else if (type === 'attendance') {
        data = [{ 'employee_id': '80', 'date': '2024-01-01', 'times': '08:00 14:00' }];
        filename = "Sample_Attendance_80.xlsx";
    } else {
        data = [{ 'date': '2024-01-01', 'doctors': '80, 101, 105', 'notes': 'نوبتجية مسائية' }];
        filename = "Sample_Schedule.xlsx";
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample");
    XLSX.writeFile(wb, filename);
};

// --- المكونات العامة ---

// مكون الإدخال
function Input({ label, type = 'text', value, onChange, placeholder }: any) {
  return (
    <div className="text-right">
      <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-widest">{label}</label>
      <input 
        type={type} 
        value={value || ''} 
        onChange={e => onChange(e.target.value)} 
        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold" 
        placeholder={placeholder} 
      />
    </div>
  );
}

// مكون الاختيار
function Select({ label, options, value, onChange }: any) {
  return (
    <div className="text-right">
      <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-widest">{label}</label>
      <select 
        value={value || ''} 
        onChange={e => onChange(e.target.value)} 
        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
      >
        <option value="">-- اختر --</option>
        {options.map((opt: any) => typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  );
}

// أزرار القائمة الجانبية
function SidebarBtn({ active, icon, label, onClick }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center p-4 rounded-2xl transition-all font-black group ${active ? 'bg-blue-600 text-white shadow-xl' : 'bg-white text-gray-400 hover:bg-blue-50 hover:text-blue-600 border border-transparent'}`}>
      <span className={`ml-3 p-2 rounded-xl ${active ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-white group-hover:text-blue-600'}`}>{icon}</span>
      {label}
    </button>
  );
}

// --- أقسام لوحة التحكم ---

// 1. إعدادات المنشأة
function SettingsTab({ center, onRefresh }: { center: GeneralSettings, onRefresh: () => void }) {
  const [data, setData] = useState<GeneralSettings>({ ...center });
  const handleSave = async () => {
    const { error } = await supabase.from('general_settings').update(data).eq('id', center.id);
    if (!error) { alert('تم الحفظ'); onRefresh(); }
  };
  return (
    <div className="space-y-8 animate-in fade-in">
        <h2 className="text-2xl font-black flex items-center gap-3"><Settings className="w-8 h-8 text-blue-600"/> إعدادات المنشأة</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-gray-50/50 p-8 rounded-[40px] border shadow-inner">
            <Input label="اسم المركز" value={data.center_name} onChange={(v:any)=>setData({...data, center_name: v})} />
            <Input label="اسم المدير" value={data.admin_name} onChange={(v:any)=>setData({...data, admin_name: v})} />
            <Input label="رقم الهاتف" value={data.phone} onChange={(v:any)=>setData({...data, phone: v})} />
            <Input label="العنوان" value={data.address} onChange={(v:any)=>setData({...data, address: v})} />
            <Input label="كلمة السر" type="password" value={data.password} onChange={(v:any)=>setData({...data, password: v})} />
            <div className="md:col-span-3">
                <label className="block text-[10px] font-black text-gray-400 mb-1">أنواع الإجازات (مفصولة بفاصلة)</label>
                <textarea className="w-full p-4 border rounded-2xl font-bold bg-white" value={data.leave_types?.join(', ')} onChange={e=>setData({...data, leave_types: e.target.value.split(',').map(s=>s.trim())})} rows={3} />
            </div>
            <button onClick={handleSave} className="md:col-span-3 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all">حفظ الإعدادات</button>
        </div>
    </div>
  );
}

// 2. إدارة العاملين
function StaffTab() {
    const [staff, setStaff] = useState<Employee[]>([]);
    useEffect(() => { fetchStaff(); }, []);
    const fetchStaff = async () => {
        const { data } = await supabase.from('employees').select('*');
        if (data) setStaff(data);
    };
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black flex items-center gap-3"><Users className="w-8 h-8 text-blue-600"/> إدارة العاملين</h2>
                <button onClick={() => downloadSample('staff')} className="text-blue-600 font-bold flex items-center gap-2"><Download className="w-4 h-4"/> تحميل نموذج Excel</button>
            </div>
            <div className="bg-white border rounded-[30px] overflow-hidden shadow-sm">
                <table className="w-full text-right">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4 font-black text-sm">كود</th>
                            <th className="p-4 font-black text-sm">الاسم</th>
                            <th className="p-4 font-black text-sm">التخصص</th>
                            <th className="p-4 font-black text-sm">الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        {staff.map(s => (
                            <tr key={s.id} className="border-b hover:bg-gray-50">
                                <td className="p-4 font-bold">{s.employee_id}</td>
                                <td className="p-4 font-bold">{s.name}</td>
                                <td className="p-4 text-gray-500 font-bold">{s.specialty}</td>
                                <td className="p-4">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black ${s.status === 'نشط' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{s.status}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// المكون الرئيسي للوحة الإدارة
export default function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState('settings');
  const [center, setCenter] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from('general_settings').select('*').limit(1).single();
    if (data) setCenter(data);
    setLoading(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center font-black text-blue-600">
      جاري التحميل...
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-10 text-right">
      <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 bg-white p-8 rounded-[40px] shadow-sm border">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-blue-600 text-white rounded-[25px] shadow-lg">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-800">{center?.center_name || 'لوحة الإدارة'}</h1>
            <p className="text-gray-400 font-bold">مرحباً بك في نظام الإدارة الذكي</p>
          </div>
        </div>
        <button onClick={onBack} className="flex items-center gap-3 text-gray-400 font-black bg-gray-50 px-8 py-4 rounded-[25px] hover:bg-red-50 hover:text-red-600 transition-all">
          تسجيل خروج <LogOut className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        <div className="lg:col-span-1 space-y-3 bg-white p-6 rounded-[40px] border shadow-sm h-fit">
          <SidebarBtn active={activeTab === 'settings'} icon={<Settings className="w-5 h-5"/>} label="إعدادات المركز" onClick={() => setActiveTab('settings')} />
          <SidebarBtn active={activeTab === 'staff'} icon={<Users className="w-5 h-5"/>} label="إدارة الموظفين" onClick={() => setActiveTab('staff')} />
          <SidebarBtn active={activeTab === 'attendance'} icon={<Clock className="w-5 h-5"/>} label="سجل الحضور" onClick={() => setActiveTab('attendance')} />
          <SidebarBtn active={activeTab === 'requests'} icon={<Bell className="w-5 h-5"/>} label="طلبات الإجازات" onClick={() => setActiveTab('requests')} />
          <SidebarBtn active={activeTab === 'evaluations'} icon={<Award className="w-5 h-5"/>} label="التقييمات" onClick={() => setActiveTab('evaluations')} />
        </div>

        <div className="lg:col-span-3 bg-white p-10 rounded-[50px] border shadow-sm min-h-[600px]">
          {activeTab === 'settings' && center && <SettingsTab center={center} onRefresh={fetchSettings} />}
          {activeTab === 'staff' && <StaffTab />}
          {activeTab === 'attendance' && <div className="p-10 text-center text-gray-400 font-bold">قسم الحضور قيد التطوير</div>}
          {activeTab === 'requests' && <div className="p-10 text-center text-gray-400 font-bold">قسم الطلبات قيد التطوير</div>}
          {activeTab === 'evaluations' && <div className="p-10 text-center text-gray-400 font-black">قسم التقييمات قيد التطوير</div>}
        </div>
      </div>
    </div>
  );
}
