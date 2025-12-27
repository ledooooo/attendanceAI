
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, Settings, Users, FileText, Calendar, 
  Clock, BarChart3, Mail, Bell, Plus, Upload, Trash2, CheckCircle, XCircle, FileSpreadsheet, Info, Download, X, Send, LogOut, ShieldCheck, Eye, Award, MessageCircle, User, Filter, CheckSquare, Square, MailCheck, Search, List, Edit3, Save, ChevronDown, AlertTriangle, Printer, MapPin, Phone, Hash, Briefcase, CalendarDays, PieChart, ArrowUpDown, Stethoscope
} from 'lucide-react';
import { GeneralSettings, Employee, LeaveRequest, AttendanceRecord, InternalMessage, Evaluation, EveningSchedule } from '../types';
import * as XLSX from 'xlsx';

// --- مساعدات ومعالجات البيانات ---

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

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

const calculateHours = (inT: string, outT: string) => {
    if (!inT || !outT || inT === '--' || outT === '--') return 0;
    const [h1, m1] = inT.split(':').map(Number);
    const [h2, m2] = outT.split(':').map(Number);
    let diff = (new Date(0,0,0,h2,m2).getTime() - new Date(0,0,0,h1,m1).getTime()) / 3600000;
    if (diff < 0) diff += 24;
    return diff;
};

// دالة تحميل العينات
const downloadSample = (type: string) => {
    let data = [];
    let filename = "";
    if (type === 'staff') {
        data = [{ 'employee_id': '101', 'name': 'أحمد محمد', 'national_id': '29001011234567', 'specialty': 'طبيب', 'join_date': '2023-01-01' }];
        filename = "Sample_Staff.xlsx";
    } else if (type === 'attendance') {
        data = [{ 'employee_id': '101', 'date': '2024-05-01', 'times': '08:00 14:00' }];
        filename = "Sample_Attendance.xlsx";
    } else if (type === 'evening_schedule') {
        data = [{ 'date': '2024-05-20', 'doctors': 'أحمد محمد, سارة علي, محمود حسن', 'notes': 'نوبتجية الطوارئ' }];
        filename = "Sample_Evening_Schedule.xlsx";
    } else if (type === 'leave_requests') {
        data = [{ 'employee_id': '101', 'type': 'اجازة اعتيادية', 'start_date': '2024-06-01', 'end_date': '2024-06-05', 'notes': 'عينة استيراد' }];
        filename = "Sample_Leave_Requests.xlsx";
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample");
    XLSX.writeFile(wb, filename);
};

// --- المكونات العامة ---

function Input({ label, type = 'text', value, onChange, placeholder, required = false, max }: any) {
  return (
    <div className="text-right">
      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input 
        type={type} 
        value={value || ''} 
        onChange={e => onChange(e.target.value)} 
        max={max}
        className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
        placeholder={placeholder} 
      />
    </div>
  );
}

function Select({ label, options, value, onChange }: any) {
  return (
    <div className="text-right">
      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
      <select 
        value={value || ''} 
        onChange={e => onChange(e.target.value)} 
        className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
      >
        <option value="">-- اختر --</option>
        {options.map((opt: any) => typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  );
}

function ExcelUploadButton({ onData, label = "رفع إكسيل" }: any) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        onData(XLSX.utils.sheet_to_json(ws));
      } catch { alert("خطأ في قراءة ملف الإكسيل"); }
      finally { e.target.value = ''; }
    };
    reader.readAsBinaryString(file);
  };
  return (
    <label className="flex items-center bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 cursor-pointer font-semibold shadow-md transition-all">
      <Upload className="w-4 h-4 ml-2" /> {label}
      <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFile} />
    </label>
  );
}

const SidebarBtn = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-2xl transition-all font-bold ${active ? 'bg-blue-600 text-white shadow-xl' : 'bg-white text-gray-500 hover:bg-blue-50 border border-transparent'}`}>
    <span className="ml-3">{icon}</span>{label}
  </button>
);

// --- الأقسام ---

function GeneralSettingsTab({ center, onRefresh }: { center: GeneralSettings, onRefresh: () => void }) {
  const [settings, setSettings] = useState<GeneralSettings>({ ...center, holidays: center.holidays || [], specialties: center.specialties || [], leave_types: center.leave_types || [] });
  const handleSave = async () => {
    const { error } = await supabase.from('general_settings').update(settings).eq('id', center.id);
    if (!error) { alert('تم حفظ كافة الإعدادات بنجاح'); onRefresh(); } else alert(error.message);
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-black border-b pb-4 flex items-center gap-2 text-gray-800"><Settings className="w-7 h-7 text-blue-600" /> إعدادات النظام والقواعد</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Input label="اسم المركز" value={settings.center_name} onChange={(v:any) => setSettings({...settings, center_name: v})} />
          <Input label="اسم المدير" value={settings.admin_name} onChange={(v:any) => setSettings({...settings, admin_name: v})} />
          <Input label="رقم الهاتف" value={settings.phone} onChange={(v:any) => setSettings({...settings, phone: v})} />
          <Input label="كلمة سر الإدارة" type="password" value={settings.password} onChange={(v:any) => setSettings({...settings, password: v})} />
      </div>
      <div className="flex justify-end pt-6">
        <button onClick={handleSave} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg transition-all">
            <Save className="w-5 h-5" /> حفظ الإعدادات
        </button>
      </div>
    </div>
  );
}

// --- المكون الرئيسي للوحة الإدارة ---

interface AdminDashboardProps {
  onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('settings');
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passInput, setPassInput] = useState('');

  const fetchSettings = async () => {
    const { data } = await supabase.from('general_settings').select('*').limit(1).single();
    if (data) setSettings(data);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleLogin = () => {
    if (settings && passInput === settings.password) {
      setIsAuthorized(true);
    } else {
      alert('كلمة المرور غير صحيحة');
    }
  };

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-6">
        <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md text-right">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-8 font-bold hover:gap-2 transition-all">
            <ArrowRight className="ml-2 w-4 h-4" /> العودة للرئيسية
          </button>
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-3xl font-black text-gray-800">لوحة الإدارة</h2>
            <p className="text-gray-400 mt-2">يرجى إدخال كلمة سر الإدارة للمتابعة</p>
          </div>
          <Input 
            label="كلمة السر" 
            type="password" 
            value={passInput} 
            onChange={setPassInput} 
            placeholder="ادخل كلمة السر هنا" 
          />
          <button 
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black mt-6 shadow-lg hover:bg-blue-700 transition-all active:scale-95"
          >
            دخول لوحة التحكم
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full md:w-64 space-y-3">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6 text-center">
            <h1 className="font-black text-xl text-blue-600 mb-1">{settings?.center_name || 'لوحة الإدارة'}</h1>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">نظام الإدارة الشامل</p>
          </div>
          <SidebarBtn active={activeTab === 'settings'} icon={<Settings className="w-5 h-5" />} label="الإعدادات العامة" onClick={() => setActiveTab('settings')} />
          <SidebarBtn active={activeTab === 'employees'} icon={<Users className="w-5 h-5" />} label="إدارة العاملين" onClick={() => setActiveTab('employees')} />
          <SidebarBtn active={activeTab === 'attendance'} icon={<Clock className="w-5 h-5" />} label="سجل الحضور" onClick={() => setActiveTab('attendance')} />
          <SidebarBtn active={activeTab === 'leaves'} icon={<FileText className="w-5 h-5" />} label="طلبات الإجازات" onClick={() => setActiveTab('leaves')} />
          <SidebarBtn active={activeTab === 'messages'} icon={<Mail className="w-5 h-5" />} label="الرسائل الداخلية" onClick={() => setActiveTab('messages')} />
          <button onClick={() => setIsAuthorized(false)} className="w-full flex items-center p-4 rounded-2xl transition-all font-bold text-red-500 bg-red-50 hover:bg-red-100 mt-10">
            <LogOut className="ml-3 w-5 h-5" /> تسجيل الخروج
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-white p-8 rounded-3xl shadow-sm border border-gray-100 min-h-[600px]">
          {activeTab === 'settings' && settings && (
            <GeneralSettingsTab center={settings} onRefresh={fetchSettings} />
          )}
          {activeTab === 'employees' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Users className="w-7 h-7 text-blue-600" /> إدارة شؤون العاملين</h2>
                    <ExcelUploadButton label="استيراد موظفين" onData={(data: any) => console.log('Import employees', data)} />
                </div>
                <div className="text-center py-20 text-gray-400 bg-gray-50 rounded-3xl border-2 border-dashed font-bold">
                    قسم إدارة الموظفين قيد التطوير أو يمكن استكماله لاحقاً
                </div>
            </div>
          )}
          {activeTab === 'attendance' && (
             <div className="space-y-6">
                <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Clock className="w-7 h-7 text-blue-600" /> سجلات الحضور والانصراف</h2>
                <div className="text-center py-20 text-gray-400 bg-gray-50 rounded-3xl border-2 border-dashed font-bold">
                    قسم الحضور والانصراف العام قيد التطوير
                </div>
             </div>
          )}
          {activeTab === 'leaves' && (
             <div className="space-y-6">
                <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><FileText className="w-7 h-7 text-blue-600" /> مراجعة طلبات الإجازات</h2>
                <div className="text-center py-20 text-gray-400 bg-gray-50 rounded-3xl border-2 border-dashed font-bold">
                    قسم مراجعة واعتماد الطلبات قيد التطوير
                </div>
             </div>
          )}
          {activeTab === 'messages' && (
             <div className="space-y-6">
                <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Mail className="w-7 h-7 text-blue-600" /> مركز الرسائل والتعميمات</h2>
                <div className="text-center py-20 text-gray-400 bg-gray-50 rounded-3xl border-2 border-dashed font-bold">
                    قسم الرسائل والتنبيهات قيد التطوير
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Fixed: Added default export for AdminDashboard to match import in App.tsx
export default AdminDashboard;
