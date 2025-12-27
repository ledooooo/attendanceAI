import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { OFFICIAL_TEMPLATES } from '../data/OfficialTemplates'; // تأكد من المسار الصحيح
import { Search } from 'lucide-react'; // أيقونة البحث
import { 
  ArrowRight, User, Calendar, FilePlus, ClipboardCheck, MessageCircle, Send, LogOut, Clock, AlertTriangle, CheckCircle, List, BarChart, Inbox, FileText, Award, Printer, Share2, X, Filter, PieChart, Info, MapPin, Phone, Mail, Hash, Briefcase, CalendarDays, ShieldCheck, FileCheck
} from 'lucide-react';
import { Employee, LeaveRequest, AttendanceRecord, InternalMessage, GeneralSettings, Evaluation } from '../types';

// --- (نفس الثوابت السابقة) ---
const LEAVE_TYPES = [
  "اجازة عارضة", "اجازة اعتيادية", "اجازة مرضى", "جزء من الوقت", "خط سير", "مأمورية", "دورة تدريبية", "بيان حالة وظيفية"
];
const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// --- بيانات القوالب الرسمية (هنا الجزء الجديد) ---
const OFFICIAL_TEMPLATES = [
    {
        id: 'status_statement',
        title: 'بيان حالة وظيفية',
        icon: <User className="w-6 h-6 text-blue-600"/>,
        content: (emp: Employee) => `
            تشهد إدارة الموارد البشرية بالمركز الطبي بأن السيد/ **${emp.name}**، 
            والحامل للرقم القومي **${emp.national_id}**، 
            يعمل لدينا بوظيفة **${emp.specialty}** (كود: ${emp.employee_id}).
            
            تاريخ التعيين: **${emp.join_date || 'غير محدد'}**.
            حالة العمل الحالية: **${emp.status}**.
            
            وقد أعطي له هذا البيان بناءً على طلبه لتقديمه لمن يهمه الأمر دون أدنى مسئولية على المركز.
        `
    },
    {
        id: 'casual_leave',
        title: 'طلب إجازة عارضة',
        icon: <Calendar className="w-6 h-6 text-amber-600"/>,
        content: (emp: Employee) => `
            السيد الدكتور / مدير المركز الطبي
            تحية طيبة وبعد،،،
            
            أرجو من سيادتكم التكرم بالموافقة على احتساب يوم ................. الموافق ..../..../2024
            إجازة عارضة لظروف خاصة، حيث أنني لم أتمكن من الحضور في هذا اليوم.
            
            مقدمه لسيادتكم
            الاسم: **${emp.name}**
            الوظيفة: **${emp.specialty}**
            التاريخ: ${new Date().toLocaleDateString('ar-EG')}
        `
    },
    {
        id: 'annual_leave',
        title: 'طلب إجازة اعتيادية',
        icon: <CalendarDays className="w-6 h-6 text-emerald-600"/>,
        content: (emp: Employee) => `
            السيد الدكتور / مدير المركز الطبي
            تحية طيبة وبعد،،،
            
            أرجو الموافقة على منحي إجازة اعتيادية لمدة ( ... ) أيام
            تبدأ من يوم ................. الموافق ..../..../2024
            وتنتهي يوم ................. الموافق ..../..../2024
            
            رصيدي الحالي يسمح بذلك، وسيقوم الزميل/ .......................... بالعمل بدلاً مني خلال هذه الفترة.
            
            مقدمه لسيادتكم
            الاسم: **${emp.name}**
            الوظيفة: **${emp.specialty}**
        `
    },
    {
        id: 'sick_leave',
        title: 'إفادة توقيع كشف طبي',
        icon: <Stethoscope className="w-6 h-6 text-red-600"/>,
        content: (emp: Employee) => `
            إلى اللجنة الطبية المختصة / التامين الصحي
            
            نحيطكم علماً بأن الموظف/ **${emp.name}**
            الوظيفة/ **${emp.specialty}**
            
            قد شعر بإعياء شديد أثناء العمل يوم ................. الساعة .................
            وتم تحويله إليكم لتوقيع الكشف الطبي وتقرير ما يلزم من إجازة مرضية إذا استدعى الأمر.
            
            مدير المركز الطبي
        `
    }
];

// ... (باقي المكونات المساعدة Input و Select كما هي) ...
const Input = ({ label, type = 'text', value, onChange, placeholder, required = false }: any) => (
  <div className="text-right">
    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">{label} {required && <span className="text-red-500">*</span>}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all" placeholder={placeholder} />
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

// --- المكون الرئيسي ---
interface StaffDashboardProps {
  onBack: () => void;
  employee: Employee | null;
  setEmployee: (emp: Employee | null) => void;
}

const StaffDashboard: React.FC<StaffDashboardProps> = ({ onBack, employee, setEmployee }) => {
  const [loginData, setLoginData] = useState({ id: '', natId: '' });
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  
  // Data States
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [allMyRequests, setAllMyRequests] = useState<LeaveRequest[]>([]);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Fetch Data Function
  const fetchStaffData = async (empId: string) => {
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
  };

  useEffect(() => { if (employee) fetchStaffData(employee.employee_id); }, [employee]);

  // Login Screen
  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-6 text-right">
        <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md border border-gray-100 animate-in fade-in duration-500">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-8 font-bold hover:scale-105 transition-transform"><ArrowRight className="ml-2 w-4 h-4" /> العودة للرئيسية</button>
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-emerald-100">
              <User className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-3xl font-black text-gray-800">بوابة الموظف</h2>
            <p className="text-gray-400 text-sm mt-2">يرجى إدخال بيانات الدخول الخاصة بك</p>
          </div>
          <div className="space-y-5">
            <Input label="رقم الموظف (ID)" value={loginData.id} onChange={(v:any) => setLoginData({...loginData, id: v})} placeholder="12345" />
            <Input label="الرقم القومي" type="password" value={loginData.natId} onChange={(v:any) => setLoginData({...loginData, natId: v})} placeholder="14 رقم" />
            <button 
              onClick={async () => {
                setLoading(true);
                const { data } = await supabase.from('employees').select('*').eq('employee_id', loginData.id).eq('national_id', loginData.natId).maybeSingle();
                if(data) { setEmployee(data); fetchStaffData(data.employee_id); } else alert('البيانات المدخلة غير صحيحة');
                setLoading(false);
              }} 
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-emerald-700 transition-all active:scale-95 flex justify-center items-center gap-2"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'تسجيل الدخول'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Helper for attendance calc (moved inside or kept outside)
  const calculateHours = (inT: string, outT: string) => {
    if (!inT || !outT) return 0;
    const [h1, m1] = inT.split(':').map(Number);
    const [h2, m2] = outT.split(':').map(Number);
    let diff = (new Date(0,0,0,h2,m2).getTime() - new Date(0,0,0,h1,m1).getTime()) / 3600000;
    if (diff < 0) diff += 24;
    return diff;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 text-right">
      {/* Header Bar - Hidden in Print */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border mb-8 flex flex-col md:flex-row justify-between items-center no-print">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center border-2 border-emerald-100 overflow-hidden shadow-inner">
              {employee.photo_url ? <img src={employee.photo_url} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-emerald-600" />}
            </div>
            <div className="absolute -bottom-1 -left-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white"></div>
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">{employee.name}</h1>
            <p className="text-gray-400 font-bold text-sm">{employee.specialty} • {employee.employee_id}</p>
          </div>
        </div>
        <button onClick={() => setEmployee(null)} className="flex items-center text-red-500 font-black bg-red-50 px-6 py-2.5 rounded-xl hover:bg-red-100 transition-all shadow-sm active:scale-95">خروج <LogOut className="mr-3 w-5 h-5"/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation - Hidden in Print */}
        <div className="lg:col-span-1 space-y-2 no-print">
           <StaffNav active={activeTab === 'profile'} icon={<User className="w-5 h-5"/>} label="الملف الشخصي" onClick={() => setActiveTab('profile')} />
           <StaffNav active={activeTab === 'attendance'} icon={<Clock className="w-5 h-5"/>} label="سجل الحضور" onClick={() => setActiveTab('attendance')} />
           <StaffNav active={activeTab === 'new-request'} icon={<FilePlus className="w-5 h-5"/>} label="تقديم طلب إلكتروني" onClick={() => setActiveTab('new-request')} />
           <StaffNav active={activeTab === 'templates'} icon={<Printer className="w-5 h-5"/>} label="نماذج للطباعة" onClick={() => setActiveTab('templates')} />
           <StaffNav active={activeTab === 'requests-history'} icon={<List className="w-5 h-5"/>} label="سجل الطلبات" onClick={() => setActiveTab('requests-history')} />
           <StaffNav active={activeTab === 'evals'} icon={<Award className="w-5 h-5"/>} label="التقييمات الشهرية" onClick={() => setActiveTab('evals')} />
           <StaffNav active={activeTab === 'messages'} icon={<Inbox className="w-5 h-5"/>} label="الرسائل والتنبيهات" onClick={() => setActiveTab('messages')} />
           <StaffNav active={activeTab === 'stats'} icon={<PieChart className="w-5 h-5"/>} label="الإحصائيات" onClick={() => setActiveTab('stats')} />
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3 bg-white p-8 rounded-3xl shadow-sm border border-gray-100 min-h-[600px] relative overflow-hidden print:p-0 print:border-0 print:shadow-none">
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
          
          {/* هنا التبويب الجديد للقوالب */}
          {activeTab === 'templates' && <StaffTemplatesTab employee={employee} />}

          {activeTab === 'requests-history' && <StaffRequestsHistory requests={allMyRequests} />}
          {activeTab === 'evals' && <StaffEvaluations evals={evaluations} />}
          {activeTab === 'messages' && <StaffMessages messages={messages} />}
          {activeTab === 'stats' && <StaffStats attendance={attendance} employee={employee} month={selectedMonth} />}
        </div>
      </div>
    </div>
  );
};

// --- المكونات الفرعية ---

// 1. مكون القوالب الجديد (Templates Tab)
const StaffTemplatesTab = ({ employee }: { employee: Employee }) => {
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('الكل');

    // استخراج التصنيفات المتاحة تلقائياً من الملف
    const categories = ['الكل', ...Array.from(new Set(OFFICIAL_TEMPLATES.map(t => t.category)))];

    // فلترة النماذج حسب البحث والتصنيف
    const filteredTemplates = OFFICIAL_TEMPLATES.filter(tmpl => 
        (filterCategory === 'الكل' || tmpl.category === filterCategory) &&
        (tmpl.title.includes(searchTerm))
    );

    const handlePrint = () => {
        setTimeout(() => window.print(), 100);
    };

    if (selectedTemplate) {
        // ... (نفس كود المعاينة والطباعة السابق بالضبط بدون تغيير) ...
        return (
            <div className="animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-8 no-print border-b pb-4">
                    <button onClick={() => setSelectedTemplate(null)} className="flex items-center text-gray-500 font-bold hover:text-emerald-600 gap-2">
                        <ArrowRight className="w-5 h-5"/> عودة للقائمة
                    </button>
                    <button onClick={handlePrint} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-emerald-700">
                        <Printer className="w-5 h-5"/> طباعة النموذج
                    </button>
                </div>
                {/* ورقة الطباعة A4 (نفس الكود السابق) */}
                <div className="print-paper mx-auto bg-white p-12 max-w-[210mm] min-h-[297mm] relative text-black print:w-full print:max-w-none print:p-0">
                    <div className="flex justify-between items-start border-b-4 border-black pb-6 mb-12">
                         {/* ... نفس الترويسة السابقة ... */}
                         <div className="text-center space-y-2"><h2 className="font-black text-xl">مديرية الشئون الصحية</h2><h3 className="font-bold text-lg">المركز الطبي</h3></div>
                         <div className="w-24 h-24 flex items-center justify-center opacity-80"><img src="https://upload.wikimedia.org/wikipedia/ar/thumb/a/a2/Logo_Ministry_of_Health_and_Population_%28Egypt%29.svg/1200px-Logo_Ministry_of_Health_and_Population_%28Egypt%29.svg.png" alt="MOH" className="w-20 object-contain grayscale" /></div>
                         <div className="text-center space-y-2"><h2 className="font-black text-xl">Ministry of Health</h2><h3 className="font-bold text-lg">Medical Center</h3></div>
                    </div>
                    <div className="text-center my-16"><h1 className="text-3xl font-black underline decoration-2 underline-offset-8 border-2 border-black inline-block px-8 py-2 rounded-lg">{selectedTemplate.title}</h1></div>
                    <div className="text-2xl leading-[3] text-justify font-medium px-4 whitespace-pre-line">{selectedTemplate.content(employee)}</div>
                    <div className="mt-32 grid grid-cols-2 gap-20 text-center text-lg">
                        <div className="space-y-24"><div className="space-y-2"><p className="font-black underline">توقيع الموظف</p><p className="text-sm font-bold">{employee.name}</p></div></div>
                        <div className="space-y-24"><div className="space-y-2"><p className="font-black underline">مدير المركز الطبي</p><p className="mt-8">............................</p></div></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500 no-print">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800 border-b pb-4">
                <FileCheck className="text-emerald-600 w-7 h-7" /> مكتبة النماذج والقوالب ({OFFICIAL_TEMPLATES.length})
            </h3>
            
            {/* شريط البحث والتصنيف */}
            <div className="bg-gray-50 p-6 rounded-3xl border flex flex-col md:flex-row gap-4 items-center">
                <div className="relative w-full">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="ابحث عن اسم النموذج..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pr-12 pl-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
                    {categories.map(cat => (
                        <button 
                            key={cat}
                            onClick={() => setFilterCategory(cat)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${filterCategory === cat ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-gray-500 border hover:bg-emerald-50'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* شبكة النماذج */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.map((tmpl) => (
                    <button 
                        key={tmpl.id}
                        onClick={() => setSelectedTemplate(tmpl)}
                        className="p-6 bg-white border-2 border-gray-100 rounded-3xl hover:border-emerald-500 hover:shadow-lg transition-all text-right group flex flex-col items-start gap-4 relative overflow-hidden"
                    >
                        <div className="flex justify-between w-full">
                            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                                {tmpl.icon}
                            </div>
                            <span className="text-[10px] bg-gray-100 px-2 py-1 rounded-lg text-gray-500 font-bold h-fit">{tmpl.category}</span>
                        </div>
                        <div>
                            <h4 className="font-black text-lg text-gray-800 group-hover:text-emerald-600">{tmpl.title}</h4>
                            <p className="text-xs text-gray-400 mt-1 font-bold">اضغط للمعاينة والطباعة</p>
                        </div>
                    </button>
                ))}
                {filteredTemplates.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-400 font-bold border-2 border-dashed rounded-3xl">
                        لا توجد نماذج تطابق بحثك
                    </div>
                )}
            </div>
        </div>
    );
};
// --- باقي المكونات (Profile, Attendance, etc.) تظل كما هي ---
// (لتوفير المساحة سأكتب المكونات كما كانت، تأكد من عدم حذفها عند النسخ)
// ... [باقي الكود الخاص بـ StaffProfile, StaffAttendance, StaffNewRequest, StaffRequestsHistory, StaffEvaluations, StaffMessages, StaffStats] ...
// سأعيد كتابة المكونات الأساسية المطلوبة لعمل الصفحة بشكل صحيح

const StaffNav = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-2xl font-black transition-all active:scale-95 ${active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 border-2 border-emerald-600' : 'bg-white text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 border-2 border-transparent'}`}>
    <span className="ml-3 p-2 rounded-xl bg-gray-50 group-hover:bg-white transition-colors">{icon}</span>
    {label}
  </button>
);

const ProfileItem = ({ label, value, icon: Icon }: any) => (
    <div className="p-4 bg-gray-50 rounded-2xl border flex items-center gap-4 group hover:bg-white hover:border-emerald-200 transition-all">
        <div className="p-3 bg-white rounded-xl text-emerald-600 shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">{Icon && <Icon className="w-5 h-5" />}</div>
        <div className="flex-1">
            <label className="text-[10px] text-gray-400 font-black block mb-1 uppercase tracking-widest">{label}</label>
            <p className="font-bold text-gray-800">{value || '--'}</p>
        </div>
    </div>
);

const StaffProfile = ({ employee }: { employee: Employee }) => (
    <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
        <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800 border-b pb-4"><User className="text-emerald-600 w-7 h-7" /> الملف الشخصي الكامل</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ProfileItem label="الاسم الرباعي" value={employee.name} icon={User} />
            <ProfileItem label="الكود الوظيفي" value={employee.employee_id} icon={Hash} />
            <ProfileItem label="الرقم القومي" value={employee.national_id} icon={ShieldCheck} />
            <ProfileItem label="التخصص الوظيفي" value={employee.specialty} icon={Briefcase} />
            <ProfileItem label="تاريخ التعيين" value={employee.join_date} icon={CalendarDays} />
            <ProfileItem label="رقم الهاتف" value={employee.phone} icon={Phone} />
        </div>
    </div>
);

const getCheckInLabel = (time: string): string => {
  if (!time || time === "--") return '--';
  if (time >= "06:00" && time <= "08:30") return "حضور رسمى";
  return "حضور";
};
const getCheckOutLabel = (time: string): string => {
  if (!time || time === "--") return '--';
  if (time >= "13:45" && time <= "15:00") return "انصراف رسمى";
  return "انصراف";
};

const StaffAttendance = ({ attendance, selectedMonth, setSelectedMonth, calculateHours, employee }: any) => (
    <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
        <div className="flex justify-between items-center mb-6 no-print">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><Clock className="text-emerald-600 w-7 h-7" /> سجل الحضور والانصراف</h3>
            <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="p-2.5 border rounded-2xl font-bold bg-gray-50 outline-none" />
        </div>
        <div className="overflow-x-auto border rounded-3xl shadow-sm bg-white">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-100 font-black">
                <tr className="border-b"><th className="p-4">التاريخ</th><th className="p-4">اليوم</th><th className="p-4 text-emerald-600">حضور</th><th className="p-4">حالة</th><th className="p-4 text-red-500">انصراف</th><th className="p-4">حالة</th><th className="p-4">ساعات</th></tr>
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
                    <tr key={dateStr} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-bold">{dateStr}</td>
                      <td className="p-4 font-bold">{dayName}</td>
                      <td className="p-4 text-emerald-600 font-black">{cin}</td>
                      <td className="p-4 font-bold">{getCheckInLabel(cin)}</td>
                      <td className="p-4 text-red-500 font-black">{cout}</td>
                      <td className="p-4 font-bold">{getCheckOutLabel(cout)}</td>
                      <td className="p-4 font-mono font-black text-center">{hours}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </div>
    </div>
);

const StaffNewRequest = ({ employee, refresh }: any) => {
    const [formData, setFormData] = useState({ type: '', start: '', end: '', backup: '', notes: '' });
    const [submitting, setSubmitting] = useState(false);
    const submit = async () => {
        if(!formData.type || !formData.start || !formData.end) return alert('برجاء إكمال البيانات الأساسية');
        setSubmitting(true);
        const { error } = await supabase.from('leave_requests').insert([{ 
            employee_id: employee.employee_id, type: formData.type, start_date: formData.start, end_date: formData.end, backup_person: formData.backup, status: 'معلق', notes: formData.notes 
        }]);
        if(!error) { alert('تم الإرسال'); setFormData({ type: '', start: '', end: '', backup: '', notes: '' }); refresh(); } 
        else alert(error.message);
        setSubmitting(false);
    };
    return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><FilePlus className="text-emerald-600 w-7 h-7" /> تقديم طلب إلكتروني</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-emerald-50/50 p-8 rounded-3xl border border-emerald-100 shadow-inner">
                <div className="md:col-span-2"><Select label="نوع الطلب" options={LEAVE_TYPES} value={formData.type} onChange={(v:any)=>setFormData({...formData, type: v})} /></div>
                <Input label="من تاريخ" type="date" value={formData.start} onChange={(v:any)=>setFormData({...formData, start: v})} />
                <Input label="إلى تاريخ" type="date" value={formData.end} onChange={(v:any)=>setFormData({...formData, end: v})} />
                <Input label="الموظف البديل" value={formData.backup} onChange={(v:any)=>setFormData({...formData, backup: v})} />
                <button onClick={submit} disabled={submitting} className="md:col-span-2 bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-emerald-700 transition-all active:scale-95 disabled:bg-gray-400">{submitting ? 'جاري الإرسال...' : 'إرسال الطلب للاعتماد'}</button>
            </div>
        </div>
    );
};

const StaffRequestsHistory = ({ requests }: { requests: LeaveRequest[] }) => (
    <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
        <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><List className="text-emerald-600 w-7 h-7" /> سجل طلباتي</h3>
        <div className="grid gap-4">
            {requests.map(r => (
                <div key={r.id} className="p-6 bg-white border rounded-3xl flex justify-between items-center shadow-sm">
                    <div><h4 className="font-black text-lg text-gray-800">{r.type}</h4><p className="text-sm text-gray-400">من {r.start_date} إلى {r.end_date}</p></div>
                    <div className={`px-4 py-2 rounded-xl text-xs font-black ${r.status === 'مقبول' ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'}`}>{r.status}</div>
                </div>
            ))}
        </div>
    </div>
);

const StaffEvaluations = ({ evals }: { evals: Evaluation[] }) => (
    <div className="space-y-6 animate-in slide-in-from-bottom duration-500 text-right">
        <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><Award className="text-emerald-600 w-7 h-7" /> تقييماتي الشهرية</h3>
        <div className="grid gap-6">
            {evals.map(ev => (
                <div key={ev.id} className="p-8 bg-white border rounded-3xl shadow-sm border-r-8 border-r-emerald-600">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="font-black text-xl text-emerald-700">شهر: {ev.month}</h4>
                        <div className="text-3xl font-black text-emerald-600">{ev.total_score} <span className="text-sm text-gray-400">/ 100</span></div>
                    </div>
                    <p className="text-sm text-gray-600"><b>ملاحظات:</b> {ev.notes || 'لا يوجد'}</p>
                </div>
            ))}
        </div>
    </div>
);

const StaffMessages = ({ messages }: { messages: InternalMessage[] }) => (
    <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
        <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><Inbox className="text-emerald-600 w-7 h-7" /> الرسائل</h3>
        <div className="space-y-4">
            {messages.map((m: any) => (
                <div key={m.id} className="p-6 rounded-3xl border-2 bg-white border-blue-50">
                    <p className="text-gray-700 leading-relaxed text-sm">{m.content}</p>
                    <span className="text-[10px] text-gray-400 font-bold mt-2 block">{new Date(m.created_at).toLocaleString('ar-EG')}</span>
                </div>
            ))}
        </div>
    </div>
);

const StaffStats = ({ attendance, employee, month }: any) => {
    const stats = useMemo(() => {
        const atts = attendance.filter((a:any) => a.date.startsWith(month));
        let totalHours = 0;
        atts.forEach((a:any) => {
            const times = a.times.split(/\s+/).filter((t:string) => t.includes(':'));
            if (times.length >= 2) totalHours += ((new Date(0,0,0,...times[times.length-1].split(':').map(Number)).getTime() - new Date(0,0,0,...times[0].split(':').map(Number)).getTime()) / 3600000);
        });
        return { days: atts.length, hours: totalHours.toFixed(1) };
    }, [attendance, month]);
    return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><BarChart className="text-emerald-600 w-7 h-7" /> إحصائيات الأداء</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-emerald-600 p-8 rounded-3xl text-white shadow-xl"><h4 className="text-5xl font-black mb-2">{stats.hours}</h4><p>ساعة عمل</p></div>
                <div className="bg-blue-600 p-8 rounded-3xl text-white shadow-xl"><h4 className="text-5xl font-black mb-2">{stats.days}</h4><p>يوم حضور</p></div>
            </div>
        </div>
    );
};

// --- أيقونة Stethoscope الناقصة ---
const Stethoscope = (props: any) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>
);

export default StaffDashboard;
