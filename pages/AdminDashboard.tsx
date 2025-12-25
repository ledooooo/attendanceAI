
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, Settings, Users, FileText, Calendar, 
  Clock, BarChart3, Mail, Bell, Plus, Upload, Trash2, CheckCircle, XCircle, FileSpreadsheet, Info, Download, X, Send, LogOut, ShieldCheck, Eye, Award, MessageCircle, User, Filter, CheckSquare, Square, MailCheck, Search, List, Edit3, Save, ChevronDown, AlertTriangle, Printer
} from 'lucide-react';
import { GeneralSettings, Employee, LeaveRequest, AttendanceRecord, InternalMessage, Evaluation } from '../types';
import * as XLSX from 'xlsx';

// --- مساعدات ومعالجات البيانات ---

const DAYS_OF_WEEK = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
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
    if (!inT || !outT) return 0;
    const [h1, m1] = inT.split(':').map(Number);
    const [h2, m2] = outT.split(':').map(Number);
    let diff = (new Date(0,0,0,h2,m2).getTime() - new Date(0,0,0,h1,m1).getTime()) / 3600000;
    if (diff < 0) diff += 24;
    return diff;
};

// --- منطق حالات الحضور والانصراف ---

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

// --- المكونات العامة ---

function Input({ label, type = 'text', value, onChange, placeholder, required = false }: any) {
  return (
    <div className="text-right">
      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input 
        type={type} 
        value={value || ''} 
        onChange={e => onChange(e.target.value)} 
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

const EditEmployeeForm = ({ employee, onBack, onSave }: { employee: Employee, onBack: () => void, onSave: (data: Partial<Employee>) => void }) => {
    const [formData, setFormData] = useState<Employee>({ ...employee });

    const toggleWorkDay = (day: string) => {
        let current = formData.work_days || [];
        if (current.includes("الكل")) current = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
        if (current.includes(day)) {
            setFormData({ ...formData, work_days: current.filter(d => d !== day) });
        } else {
            setFormData({ ...formData, work_days: [...current, day] });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-all"><ArrowRight className="w-6 h-6"/></button>
                    <h2 className="text-2xl font-bold">تعديل بيانات: {employee.name}</h2>
                </div>
                <button onClick={() => onSave(formData)} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-emerald-700 transition-all">
                    <Save className="w-5 h-5"/> حفظ التعديلات
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Input label="الاسم الرباعي" value={formData.name} onChange={(v:any) => setFormData({...formData, name: v})} required />
                <Input label="الكود الوظيفي" value={formData.employee_id} onChange={(v:any) => setFormData({...formData, employee_id: v})} required />
                <Input label="الرقم القومي" value={formData.national_id} onChange={(v:any) => setFormData({...formData, national_id: v})} required />
                <Input label="التخصص" value={formData.specialty} onChange={(v:any) => setFormData({...formData, specialty: v})} />
                <Input label="رقم التليفون" value={formData.phone} onChange={(v:any) => setFormData({...formData, phone: v})} />
                <Input label="البريد الإلكتروني" value={formData.email} onChange={(v:any) => setFormData({...formData, email: v})} />
                <Select label="الجنس" options={['ذكر', 'أنثى']} value={formData.gender} onChange={(v:any) => setFormData({...formData, gender: v})} />
                <Input label="الدرجة الوظيفية" value={formData.grade} onChange={(v:any) => setFormData({...formData, grade: v})} />
                <Input label="تاريخ التعيين" type="date" value={formData.join_date} onChange={(v:any) => setFormData({...formData, join_date: v})} />
                <Input label="الديانة" value={formData.religion} onChange={(v:any) => setFormData({...formData, religion: v})} />
                <Input label="توقيت الحضور الرسمي" type="time" value={formData.start_time} onChange={(v:any) => setFormData({...formData, start_time: v})} />
                <Input label="توقيت الانصراف الرسمي" type="time" value={formData.end_time} onChange={(v:any) => setFormData({...formData, end_time: v})} />
                <Input label="رصيد اعتيادي كلي" type="number" value={formData.leave_annual_balance} onChange={(v:any) => setFormData({...formData, leave_annual_balance: Number(v)})} />
                <Input label="رصيد عارضة كلي" type="number" value={formData.leave_casual_balance} onChange={(v:any) => setFormData({...formData, leave_casual_balance: Number(v)})} />
                <Select label="الحالة" options={['نشط', 'موقوف', 'إجازة']} value={formData.status} onChange={(v:any) => setFormData({...formData, status: v})} />
                <div className="md:col-span-2 lg:col-span-3 border-t pt-4">
                    <label className="block text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide">أيام العمل المحددة</label>
                    <div className="flex flex-wrap gap-2">
                        {["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"].map(day => (
                            <button key={day} onClick={() => toggleWorkDay(day)} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${formData.work_days?.includes(day) || formData.work_days?.includes("الكل") ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-400 border-gray-200'}`}>
                                {day}
                            </button>
                        ))}
                        <button onClick={() => setFormData({...formData, work_days: ["الكل"]})} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${formData.work_days?.includes("الكل") ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-400 border-gray-200'}`}>الكل</button>
                    </div>
                </div>
                <div className="md:col-span-2 lg:col-span-3 space-y-4">
                    <Input label="المهام الإدارية" value={formData.admin_tasks} onChange={(v:any) => setFormData({...formData, admin_tasks: v})} />
                    <Input label="الدورات التدريبية" value={formData.training_courses} onChange={(v:any) => setFormData({...formData, training_courses: v})} />
                    <Input label="ملاحظات عامة" value={formData.notes} onChange={(v:any) => setFormData({...formData, notes: v})} />
                </div>
            </div>
        </div>
    );
};

function DoctorsTab({ employees, onRefresh, centerId, settings }: { employees: Employee[], onRefresh: () => void, centerId: string, settings: GeneralSettings | null }) {
  const [editingStaff, setEditingStaff] = useState<Employee | null>(null);
  const [sortBy, setSortBy] = useState<'id' | 'name' | 'specialty'>('name');
  const handleSaveEdit = async (updatedData: Partial<Employee>) => {
      const { error } = await supabase.from('employees').update(updatedData).eq('id', editingStaff?.id);
      if (!error) { alert('تم حفظ التعديلات بنجاح'); setEditingStaff(null); onRefresh(); } else alert(error.message);
  };
  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => {
      if (sortBy === 'id') return a.employee_id.localeCompare(b.employee_id);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'specialty') return a.specialty.localeCompare(b.specialty);
      return 0;
    });
  }, [employees, sortBy]);
  if (editingStaff) return <EditEmployeeForm employee={editingStaff} onBack={() => setEditingStaff(null)} onSave={handleSaveEdit} />;
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6 text-blue-600"/> شئون الموظفين</h2>
        <div className="flex items-center bg-gray-100 p-1 rounded-xl border">
          <button onClick={() => setSortBy('name')} className={`px-3 py-1 rounded-lg text-xs font-bold ${sortBy === 'name' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>الاسم</button>
          <button onClick={() => setSortBy('id')} className={`px-3 py-1 rounded-lg text-xs font-bold ${sortBy === 'id' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>الكود</button>
        </div>
      </div>
      <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100">
            <tr><th className="p-3">الكود</th><th className="p-3">الاسم</th><th className="p-3 text-center">إجراء</th></tr>
          </thead>
          <tbody>
            {sortedEmployees.map(emp => (
              <tr key={emp.id} className="border-b hover:bg-blue-50/50"><td className="p-3 font-mono">{emp.employee_id}</td><td className="p-3 font-bold">{emp.name}</td>
                <td className="p-3 text-center">
                  <button onClick={() => setEditingStaff(emp)} className="text-blue-500 p-2"><Edit3 className="w-4 h-4"/></button>
                  <button onClick={async () => { if(confirm('حذف؟')) { await supabase.from('employees').delete().eq('id', emp.id); onRefresh(); } }} className="text-red-500 p-2"><Trash2 className="w-4 h-4"/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsTab({ employees }: { employees: Employee[] }) {
  const [activeReportType, setActiveReportType] = useState<'daily' | 'employee' | 'monthly'>('daily');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [filter, setFilter] = useState<'all' | 'present' | 'absent' | 'leave'>('all');
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [settings, setSettings] = useState<GeneralSettings | null>(null);

  useEffect(() => {
    supabase.from('general_settings').select('*').limit(1).single().then(({data}) => setSettings(data));
    supabase.from('attendance').select('*').then(({data}) => data && setAllAttendance(data));
    supabase.from('leave_requests').select('*').eq('status', 'مقبول').then(({data}) => data && setAllLeaves(data));
  }, []);

  const getDailyStatus = (emp: Employee, d: string) => {
      const att = allAttendance.find(a => a.employee_id === emp.employee_id && a.date === d);
      const leave = allLeaves.find(l => l.employee_id === emp.employee_id && d >= l.start_date && d <= l.end_date);
      const isFriday = new Date(d).getDay() === 5;
      const isOfficialHoliday = settings?.holidays?.includes(d) || isFriday;
      const dayName = DAYS_AR[new Date(d).getDay()];
      const isWorkDay = (!emp.work_days || emp.work_days.length === 0 || emp.work_days.includes("الكل") || emp.work_days.includes(dayName));

      if (isOfficialHoliday) return { status: isFriday ? 'الجمعه (عطلة)' : 'عطلة رسمية', code: 'holiday' };
      if (leave) return { status: `إجازة (${leave.type})`, code: 'leave' };
      if (!isWorkDay) return { status: 'جزء من الوقت', code: 'part-time' };
      if (att) {
          const times = att.times.split(/\s+/).filter(t => t.includes(':'));
          return { status: 'حاضر', code: 'present', cin: times[0], cout: times[times.length-1] };
      }
      return { status: 'غائب', code: 'absent' };
  };

  const dailyData = useMemo(() => {
    return employees.map(emp => {
        const statusObj = getDailyStatus(emp, date);
        const att = allAttendance.find(a => a.employee_id === emp.employee_id && a.date === date);
        const times = att?.times.split(/\s+/).filter(t => t.includes(':')) || [];
        return { 
          ...emp, 
          cin: times[0] || '--', 
          cout: times.length > 1 ? times[times.length-1] : '--', 
          status: statusObj.status,
          code: statusObj.code 
        };
    }).filter(item => {
        if (filter === 'all') return true;
        if (filter === 'present') return item.code === 'present';
        if (filter === 'absent') return item.code === 'absent';
        if (filter === 'leave') return item.code === 'leave';
        return true;
    });
  }, [employees, allAttendance, allLeaves, date, filter, settings]);

  const summary = useMemo(() => ({
      total: employees.length,
      present: dailyData.filter(d => d.code === 'present').length,
      absent: dailyData.filter(d => d.code === 'absent').length,
      leaves: dailyData.filter(d => d.code === 'leave').length
  }), [dailyData, employees]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4 no-print">
        <h2 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-emerald-600"/> تقارير الحضور</h2>
        <div className="flex bg-gray-100 p-1 rounded-xl border">
            <button onClick={() => setActiveReportType('daily')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeReportType === 'daily' ? 'bg-white text-emerald-600' : 'text-gray-400'}`}>يومي</button>
            <button onClick={() => setActiveReportType('employee')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeReportType === 'employee' ? 'bg-white text-emerald-600' : 'text-gray-400'}`}>موظف</button>
            <button onClick={() => setActiveReportType('monthly')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeReportType === 'monthly' ? 'bg-white text-emerald-600' : 'text-gray-400'}`}>شهري</button>
        </div>
      </div>
      {activeReportType === 'daily' && (
          <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-2xl border items-end no-print">
                  <Input label="التاريخ" type="date" value={date} onChange={setDate} />
                  <Select label="الفلتر" options={[{value:'all', label:'الكل'}, {value:'present', label:'حضور'}, {value:'absent', label:'غياب'}]} value={filter} onChange={setFilter} />
                  <button onClick={() => window.print()} className="bg-gray-800 text-white py-2.5 rounded-xl font-bold flex justify-center gap-2 shadow-md"><Printer className="w-4 h-4"/> طباعة</button>
              </div>
              <div className="overflow-x-auto border rounded-2xl shadow-sm bg-white">
                <table className="w-full text-sm text-right">
                  <thead className="bg-gray-100">
                    <tr><th className="p-4">الكود</th><th className="p-4">الاسم</th><th className="p-4">الوظيفة</th><th className="p-4">الحضور</th><th className="p-4">حالة الحضور</th><th className="p-4">الانصراف</th><th className="p-4">حالة الانصراف</th><th className="p-4">حالة العمل</th></tr>
                  </thead>
                  <tbody>
                    {dailyData.map(d => (
                        <tr key={d.employee_id} className="border-b">
                            <td className="p-4 font-mono">{d.employee_id}</td><td className="p-4 font-bold">{d.name}</td><td className="p-4">{d.specialty}</td>
                            <td className="p-4 text-emerald-600 font-bold">{d.cin}</td><td className="p-4">{getCheckInLabel(d.cin)}</td>
                            <td className="p-4 text-red-500 font-bold">{d.cout}</td><td className="p-4">{getCheckOutLabel(d.cout)}</td>
                            <td className="p-4 font-bold">{d.status}</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-6 rounded-3xl border shadow-sm no-print">
                  <div className="text-center p-4 bg-gray-50 rounded-2xl"><p className="text-[10px] font-bold">الموظفين</p><p className="text-3xl font-black">{summary.total}</p></div>
                  <div className="text-center p-4 bg-emerald-50 rounded-2xl"><p className="text-[10px] font-bold">حضور</p><p className="text-3xl font-black text-emerald-600">{summary.present}</p></div>
                  <div className="text-center p-4 bg-red-50 rounded-2xl"><p className="text-[10px] font-bold">غياب</p><p className="text-3xl font-black text-red-600">{summary.absent}</p></div>
                  <div className="text-center p-4 bg-blue-50 rounded-2xl"><p className="text-[10px] font-bold">إجازات</p><p className="text-3xl font-black text-blue-600">{summary.leaves}</p></div>
              </div>
          </div>
      )}
      {activeReportType === 'employee' && (
          <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-2xl border items-end no-print">
                  <Select label="الموظف" options={employees.map(e=>({value:e.employee_id, label:e.name}))} value={selectedStaffId} onChange={setSelectedStaffId} />
                  <Input label="من" type="date" value={startDate} onChange={setStartDate} /><Input label="إلى" type="date" value={endDate} onChange={setEndDate} />
              </div>
              <div className="overflow-x-auto border rounded-2xl bg-white shadow-sm">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-gray-100">
                        <tr><th className="p-4">التاريخ</th><th className="p-4">الحضور</th><th className="p-4">حالة الحضور</th><th className="p-4">الانصراف</th><th className="p-4">حالة الانصراف</th><th className="p-4">ساعات العمل</th></tr>
                    </thead>
                    <tbody>
                        {allAttendance.filter(a => a.employee_id === selectedStaffId && a.date >= startDate && a.date <= endDate).sort((a,b)=>b.date.localeCompare(a.date)).map(a => {
                            const times = a.times.split(/\s+/).filter(t => t.includes(':'));
                            const hours = times.length >= 2 ? calculateHours(times[0], times[times.length-1]).toFixed(1) : '0.0';
                            return (
                                <tr key={a.id} className="border-b"><td className="p-4 font-bold">{a.date}</td><td className="p-4 text-emerald-600 font-bold">{times[0] || '--'}</td><td className="p-4">{getCheckInLabel(times[0])}</td><td className="p-4 text-red-500 font-bold">{times[times.length-1] || '--'}</td><td className="p-4">{getCheckOutLabel(times[times.length-1])}</td><td className="p-4 font-mono">{hours} ساعة</td></tr>
                            )
                        })}
                    </tbody>
                  </table>
              </div>
          </div>
      )}
      {activeReportType === 'monthly' && (
          <div className="space-y-6">
              <div className="bg-gray-50 p-6 rounded-2xl border max-w-sm no-print"><Input label="الشهر" type="month" value={month} onChange={setMonth} /></div>
              <div className="overflow-x-auto border rounded-2xl bg-white shadow-sm">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-gray-100">
                        <tr><th className="p-4">الموظف</th><th className="p-4 text-emerald-600">حضور (يوم)</th><th className="p-4 text-red-500">غياب (يوم)</th><th className="p-4 text-blue-600">إجازات (يوم)</th><th className="p-4">إجمالي الساعات</th></tr>
                    </thead>
                    <tbody>
                        {employees.map(emp => {
                            const atts = allAttendance.filter(a => a.employee_id === emp.employee_id && a.date.startsWith(month));
                            const leaves = allLeaves.filter(l => l.employee_id === emp.employee_id && (l.start_date.startsWith(month) || l.end_date.startsWith(month)));
                            let totalHours = 0; atts.forEach(a => { const t = a.times.split(/\s+/).filter(x=>x.includes(':')); if(t.length>=2) totalHours += calculateHours(t[0], t[t.length-1]); });
                            return (
                                <tr key={emp.employee_id} className="border-b"><td className="p-4 font-bold">{emp.name}</td><td className="p-4 text-emerald-600 font-bold">{atts.length} يوم</td><td className="p-4 text-red-500 font-bold">{Math.max(0, 26 - atts.length - leaves.length)} يوم</td><td className="p-4 text-blue-600 font-bold">{leaves.length} يوم</td><td className="p-4 font-mono">{totalHours.toFixed(1)} ساعة</td></tr>
                            )
                        })}
                    </tbody>
                  </table>
              </div>
          </div>
      )}
    </div>
  );
}

function LeavesTab({ requests, onRefresh }: { requests: LeaveRequest[], onRefresh: () => void }) {
  const handleAction = async (id: string, status: 'مقبول' | 'مرفوض') => {
    const { data: req } = await supabase.from('leave_requests').select('*, employees(*)').eq('id', id).single();
    if (!req) return;
    if (status === 'مقبول') {
        const emp = req.employees;
        const duration = Math.ceil((new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
        let updates: any = {};
        if (req.type === 'اعتيادى') updates.remaining_annual = Math.max(0, (emp.remaining_annual || 0) - duration);
        else if (req.type === 'عارضة') updates.remaining_casual = Math.max(0, (emp.remaining_casual || 0) - duration);
        if (Object.keys(updates).length > 0) await supabase.from('employees').update(updates).eq('id', emp.id);
    }
    await supabase.from('leave_requests').update({ status }).eq('id', id);
    alert('تم التحديث'); onRefresh();
  };
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-blue-600"/> طلبات الإجازة</h2>
      <div className="grid gap-4">
        {requests.map(req => (
          <div key={req.id} className="p-6 bg-white border rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1"><span className="font-bold text-lg">{req.employee_name}</span><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">{req.type}</span></div>
              <p className="text-sm text-gray-500">{req.start_date} إلى {req.end_date}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleAction(req.id, 'مقبول')} className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold shadow-md hover:bg-green-700 transition-all">قبول</button>
              <button onClick={() => handleAction(req.id, 'مرفوض')} className="bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold hover:bg-red-100 transition-all">رفض</button>
            </div>
          </div>
        ))}
        {requests.length === 0 && <div className="text-center py-20 text-gray-400 font-bold border-2 border-dashed rounded-3xl">لا يوجد طلبات معلقة</div>}
      </div>
    </div>
  );
}

function AttendanceTab({ employees, onRefresh }: { employees: Employee[], onRefresh: () => void }) {
  const [formData, setFormData] = useState<Partial<AttendanceRecord>>({ date: new Date().toISOString().split('T')[0], times: '' });
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2"><Clock className="w-6 h-6 text-blue-600"/> تسجيل البصمات</h2>
      <div className="bg-gray-50 p-6 rounded-xl border grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="الموظف" options={employees.map(e => ({value: e.employee_id, label: e.name}))} value={formData.employee_id} onChange={(v:any)=>setFormData({...formData, employee_id: v})} />
        <Input label="التاريخ" type="date" value={formData.date} onChange={(v:any)=>setFormData({...formData, date: v})} />
        <div className="md:col-span-2"><Input label="التوقيتات" value={formData.times} onChange={(v:any)=>setFormData({...formData, times: v})} placeholder="مثال: 08:30 14:15" /></div>
        <button onClick={async () => { await supabase.from('attendance').insert([formData]); alert('تم'); onRefresh(); }} className="md:col-span-2 bg-blue-600 text-white py-3 rounded-xl font-bold shadow-md">حفظ</button>
      </div>
    </div>
  );
}

function GeneralSettingsTab({ center }: { center: GeneralSettings }) {
  const [settings, setSettings] = useState<GeneralSettings>({ ...center, holidays: center.holidays || [] });
  const [newHoliday, setNewHoliday] = useState('');
  const handleSave = async () => { await supabase.from('general_settings').update(settings).eq('id', center.id); alert('تم'); };
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold border-b pb-4 text-gray-800"><Settings className="w-6 h-6 text-blue-600 inline mr-2" /> الإعدادات</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input label="المركز" value={settings.center_name} onChange={(v:any)=>setSettings({...settings, center_name: v})} />
        <Input label="المدير" value={settings.admin_name} onChange={(v:any)=>setSettings({...settings, admin_name: v})} />
        <Input label="كلمة المرور" type="password" value={settings.password} onChange={(v:any)=>setSettings({...settings, password: v})} />
      </div>
      <div className="border-t pt-4">
        <h3 className="font-bold mb-3">العطلات</h3>
        <div className="flex gap-2 mb-4"><input type="date" value={newHoliday} onChange={e => setNewHoliday(e.target.value)} className="p-2 border rounded-lg" /><button onClick={() => { if(newHoliday) setSettings({...settings, holidays: [...(settings.holidays||[]), newHoliday]}); setNewHoliday(''); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg"><Plus/></button></div>
        <div className="flex flex-wrap gap-2">{(settings.holidays || []).map(date => (<span key={date} className="bg-gray-100 px-3 py-1 rounded-full text-xs border flex items-center gap-2">{date}<button onClick={() => setSettings({...settings, holidays: (settings.holidays||[]).filter(d=>d!==date)})}><X className="w-3 h-3 text-red-500"/></button></span>))}</div>
      </div>
      <button onClick={handleSave} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold">حفظ</button>
    </div>
  );
}

function AlertsTab({ employees }: { employees: Employee[] }) {
    const [target, setTarget] = useState('all'); const [msg, setMsg] = useState('');
    const sendAlert = async () => { if (!msg.trim()) return; await supabase.from('messages').insert([{ from_user: 'admin', to_user: target, content: msg.trim() }]); alert('تم'); setMsg(''); };
    return (
        <div className="space-y-6"><h2 className="text-2xl font-bold border-b pb-4"><Bell className="w-6 h-6 text-orange-500 inline mr-2" /> التنبيهات</h2>
            <div className="bg-gray-50 p-6 rounded-3xl border space-y-4 shadow-inner">
                <Select label="الهدف" options={[{value: 'all', label: 'الجميع'}, ...employees.map(e => ({value: e.employee_id, label: e.name}))]} value={target} onChange={setTarget} />
                <textarea className="w-full p-4 border rounded-2xl outline-none" rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="اكتب التنبيه هنا..." />
                <button onClick={sendAlert} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-xl">إرسال</button>
            </div>
        </div>
    );
}

// --- المكونات والأنواع المفقودة ---

interface AdminDashboardProps {
  onBack: () => void;
}

const SidebarBtn = ({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center p-4 rounded-2xl font-bold transition-all ${active ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-blue-50 border border-transparent'}`}
  >
    <span className="ml-3">{icon}</span>
    {label}
  </button>
);

function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [centers, setCenters] = useState<GeneralSettings[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<GeneralSettings | null>(null);
  const [activeTab, setActiveTab] = useState('settings');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  useEffect(() => { supabase.from('general_settings').select('*').then(({data}) => { if(data) setCenters(data); }); }, []);
  const fetchDashboardData = async () => { if (!selectedCenter) return; const [empRes, leaveRes] = await Promise.all([supabase.from('employees').select('*').eq('center_id', selectedCenter.id).order('name'), supabase.from('leave_requests').select(`*, employees(name)`).eq('status', 'معلق').order('created_at', { ascending: false })]); if (empRes.data) setEmployees(empRes.data); if (leaveRes.data) setLeaveRequests((leaveRes.data as any[]).map(l => ({...l, employee_name: l.employees?.name}))); };
  if (!isAdminLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-[85vh] p-6 text-right">
        <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md border border-gray-100"><button onClick={onBack} className="flex items-center text-blue-600 mb-8 font-bold"><ArrowRight className="ml-2 w-4 h-4" /> العودة</button>
          <div className="text-center mb-8"><ShieldCheck className="w-12 h-12 text-blue-600 mx-auto mb-2" /><h2 className="text-3xl font-bold">بوابة الإدارة</h2></div>
          <div className="space-y-6">
            <select className="w-full p-4 border rounded-xl outline-none bg-gray-50 font-bold" onChange={(e) => setSelectedCenter(centers.find(c => c.id === e.target.value) || null)}><option value="">-- المركز الطبي --</option>{centers.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}</select>
            <input type="password" className="w-full p-4 border rounded-xl outline-none bg-gray-50 text-center" placeholder="كلمة المرور" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            <button onClick={() => { if(selectedCenter && adminPassword === selectedCenter.password) { setIsAdminLoggedIn(true); fetchDashboardData(); } else alert('خطأ'); }} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold">دخول</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-10 text-right">
      <div className="flex justify-between items-center mb-10 bg-white p-8 rounded-3xl shadow-sm border no-print">
        <div><h1 className="text-3xl font-black text-gray-800">إدارة: {selectedCenter?.center_name}</h1></div>
        <button onClick={onBack} className="bg-red-50 text-red-600 px-6 py-2 rounded-xl font-bold flex items-center shadow-sm">خروج <LogOut className="ml-2 w-5 h-5"/></button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-3 no-print">
          <SidebarBtn active={activeTab === 'settings'} icon={<Settings/>} label="الإعدادات" onClick={() => setActiveTab('settings')} />
          <SidebarBtn active={activeTab === 'doctors'} icon={<Users/>} label="شئون الموظفين" onClick={() => setActiveTab('doctors')} />
          <SidebarBtn active={activeTab === 'leaves'} icon={<FileText/>} label="طلبات الإجازة" onClick={() => setActiveTab('leaves')} />
          <SidebarBtn active={activeTab === 'attendance'} icon={<Clock/>} label="سجل البصمات" onClick={() => setActiveTab('attendance')} />
          <SidebarBtn active={activeTab === 'reports'} icon={<BarChart3/>} label="تقارير الحضور" onClick={() => setActiveTab('reports')} />
          <SidebarBtn active={activeTab === 'alerts'} icon={<Bell/>} label="تنبيهات العاملين" onClick={() => setActiveTab('alerts')} />
        </div>
        <div className="lg:col-span-3 bg-white p-8 rounded-3xl shadow-sm border border-gray-100 min-h-[600px]">
          {activeTab === 'settings' && selectedCenter && <GeneralSettingsTab center={selectedCenter} />}
          {activeTab === 'doctors' && <DoctorsTab employees={employees} onRefresh={fetchDashboardData} centerId={selectedCenter!.id} settings={selectedCenter} />}
          {activeTab === 'leaves' && <LeavesTab requests={leaveRequests} onRefresh={fetchDashboardData} />}
          {activeTab === 'attendance' && <AttendanceTab employees={employees} onRefresh={fetchDashboardData} />}
          {activeTab === 'reports' && <ReportsTab employees={employees} />}
          {activeTab === 'alerts' && <AlertsTab employees={employees} />}
        </div>
      </div>
    </div>
  );
};
export default AdminDashboard;
