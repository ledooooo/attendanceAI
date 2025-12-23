
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, Settings, Users, FileText, Calendar, 
  Clock, BarChart3, Mail, Bell, Plus, Upload, Trash2, CheckCircle, XCircle, FileSpreadsheet, Info, Download, X, Send
} from 'lucide-react';
import { GeneralSettings, Employee, LeaveRequest, AttendanceRecord, InternalMessage } from '../types';
import * as XLSX from 'xlsx';

// --- المحرك الذكي لمعالجة التواريخ (حل مشكلة الرقم 45871) ---

const MONTH_MAP: { [key: string]: string } = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
};

/**
 * دالة برمجية ذكية لتحويل أي صيغة تاريخ قادمة من إكسيل (نص، تاريخ، أو رقم تسلسلي 45871)
 * إلى الصيغة القياسية YYYY-MM-DD المقبولة في قاعدة البيانات.
 */
const formatDateForDB = (val: any): string | null => {
  if (val === undefined || val === null || val === '') return null;

  // 1. التعامل مع كائنات التاريخ (في حال قراءة الملف مع خيار cellDates: true)
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().split('T')[0];
  }

  // 2. التعامل مع أرقام إكسيل التسلسلية (مثل 45871) - الحل الجذري
  const num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 60000) { 
    // إكسيل يبدأ الترقيم من 30/12/1899. الفرق بينه وبين JS هو 25569 يوم.
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }

  const str = String(val).trim();
  
  // 3. التعامل مع صيغة "Aug 2, 2025"
  const matchFancy = str.match(/^([a-zA-Z]{3,9})\s+(\d{1,2}),\s+(\d{4})$/);
  if (matchFancy) {
    const monthName = matchFancy[1].toLowerCase().substring(0, 3);
    const day = matchFancy[2].padStart(2, '0');
    const year = matchFancy[3];
    const monthNum = MONTH_MAP[monthName];
    if (monthNum) return `${year}-${monthNum}-${day}`;
  }

  // 4. التعامل مع صيغة YYYY-MM-DD
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
  
  // 5. التعامل مع صيغة DD/MM/YYYY أو DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  // محاولة أخيرة باستخدام محول JS الافتراضي
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch(e) {}

  return null; 
};

/**
 * تحويل تاريخ YYYY-MM-DD إلى صيغة عرض جذابة Aug 2, 2025
 */
const formatDateForExcelDisplay = (dateStr: string | null | undefined) => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
};

// --- المكونات البصرية العامة ---

function Input({ label, type = 'text', value, onChange, placeholder }: any) {
  return (
    <div className="text-right">
      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
      <input 
        type={type} 
        value={value} 
        onChange={e => onChange(e.target.value)}
        className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all outline-none"
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
        value={value} 
        onChange={e => onChange(e.target.value)}
        className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all outline-none"
      >
        {options.map((opt: any) => (
          typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function ExcelInfo({ fields, sampleData, fileName }: { fields: string[], sampleData?: any[], fileName?: string }) {
  const downloadSample = () => {
    if (!sampleData) return;
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${fileName || 'sample'}.xlsx`);
  };

  return (
    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl mb-6 flex flex-col gap-3 text-right">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-900 font-bold mb-2">عناوين الأعمدة في ملف الإكسيل يجب أن تكون كالتالي (مطابقة لقاعدة البيانات):</p>
          <div className="flex flex-wrap gap-2">
            {fields.map(f => (
              <code key={f} className="bg-white px-2 py-1 rounded border border-blue-300 text-xs font-mono font-bold text-blue-700 shadow-sm">
                {f}
              </code>
            ))}
          </div>
        </div>
      </div>
      {sampleData && (
        <button 
          onClick={downloadSample}
          className="flex items-center text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 w-fit px-4 py-2 rounded-lg transition-all shadow-sm"
        >
          <Download className="w-4 h-4 ml-2" /> تحميل نموذج جاهز مطابق للحقول
        </button>
      )}
    </div>
  );
}

function ExcelUploadButton({ onData, label = "رفع إكسيل", icon = <Upload className="w-4 h-4 ml-2" /> }: any) {
  const [loading, setLoading] = useState(false);
  
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        // قراءة الملف مع تفعيل تحويل التواريخ تلقائياً إن أمكن
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        onData(data);
      } catch (err) {
        alert("فشل في قراءة ملف الإكسيل. تأكد من سلامة الملف.");
      } finally {
        setLoading(false);
        e.target.value = ''; 
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <label className="flex items-center bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 cursor-pointer font-semibold transition-all shadow-md">
      {loading ? 'جاري المعالجة...' : <>{icon} {label}</>}
      <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFile} />
    </label>
  );
}

// --- الأقسام الوظيفية الرئيسية ---

function GeneralSettingsTab({ center }: { center: GeneralSettings }) {
  const [settings, setSettings] = useState<GeneralSettings>({ ...center, holidays: center.holidays || [] });
  const [newHoliday, setNewHoliday] = useState('');

  const handleSave = async () => {
    const { error } = await supabase.from('general_settings').update(settings).eq('id', center.id);
    if (error) alert('فشل حفظ الإعدادات');
    else alert('تم تحديث إعدادات المركز بنجاح');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold border-b pb-4 text-gray-800 flex items-center gap-2">
        <Settings className="w-6 h-6 text-blue-600" /> الإعدادات العامة للمركز
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input label="اسم المركز الطبي" value={settings.center_name} onChange={(v:any) => setSettings({...settings, center_name: v})} />
        <Input label="اسم مدير الإدارة" value={settings.admin_name} onChange={(v:any) => setSettings({...settings, admin_name: v})} />
        <Input label="تليفون التواصل" value={settings.phone} onChange={(v:any) => setSettings({...settings, phone: v})} />
        <Input label="عنوان المركز" value={settings.address} onChange={(v:any) => setSettings({...settings, address: v})} />
        <Input label="رابط الموقع الجغرافي" value={settings.location_url} onChange={(v:any) => setSettings({...settings, location_url: v})} />
        <Input label="كلمة مرور الإدارة" type="password" value={settings.password} onChange={(v:any) => setSettings({...settings, password: v})} />
      </div>
      
      <div className="border-t pt-6">
        <h3 className="font-bold text-gray-700 mb-4 flex items-center"><Calendar className="w-5 h-5 ml-2 text-blue-500"/> إدارة العطلات الرسمية (Holidays)</h3>
        <div className="flex gap-3 mb-6 bg-gray-50 p-4 rounded-xl border">
          <input type="date" value={newHoliday} onChange={e => setNewHoliday(e.target.value)} className="p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          <button 
            onClick={() => { if(newHoliday) setSettings({...settings, holidays: [...(settings.holidays||[]), newHoliday]}); setNewHoliday(''); }} 
            className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus className="w-5 h-5"/> إضافة عطلة
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(settings.holidays || []).map(date => (
            <span key={date} className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-bold border border-blue-200 flex items-center gap-2">
              {formatDateForExcelDisplay(date)}
              <button onClick={() => setSettings({...settings, holidays: (settings.holidays || []).filter(d => d !== date)})} className="text-red-500 hover:text-red-700"><X className="w-4 h-4"/></button>
            </span>
          ))}
        </div>
      </div>

      <div className="border-t pt-6 grid grid-cols-2 md:grid-cols-3 gap-6">
        <Input label="حضور الفترة الصباحية" type="time" value={settings.shift_morning_in} onChange={(v:any) => setSettings({...settings, shift_morning_in: v})} />
        <Input label="انصراف الفترة الصباحية" type="time" value={settings.shift_morning_out} onChange={(v:any) => setSettings({...settings, shift_morning_out: v})} />
        <Input label="حضور الفترة المسائية" type="time" value={settings.shift_evening_in} onChange={(v:any) => setSettings({...settings, shift_evening_in: v})} />
        <Input label="انصراف الفترة المسائية" type="time" value={settings.shift_evening_out} onChange={(v:any) => setSettings({...settings, shift_evening_out: v})} />
        <Input label="حضور فترة السهر" type="time" value={settings.shift_night_in} onChange={(v:any) => setSettings({...settings, shift_night_in: v})} />
        <Input label="انصراف فترة السهر" type="time" value={settings.shift_night_out} onChange={(v:any) => setSettings({...settings, shift_night_out: v})} />
      </div>

      <div className="flex justify-end pt-6">
        <button onClick={handleSave} className="bg-emerald-600 text-white px-10 py-3 rounded-xl hover:bg-emerald-700 font-bold shadow-lg transition-all">حفظ كافة الإعدادات</button>
      </div>
    </div>
  );
}

function DoctorsTab({ employees, onRefresh, centerId }: { employees: Employee[], onRefresh: () => void, centerId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Employee>>({ gender: 'ذكر', status: 'نشط', center_id: centerId, leave_annual_balance: 21, leave_casual_balance: 7 });

  const handleImport = async (data: any[]) => {
    try {
      const formatted = data.map(row => ({
        employee_id: String(row.employee_id || ''),
        name: String(row.name || ''),
        national_id: String(row.national_id || ''),
        specialty: String(row.specialty || ''),
        phone: String(row.phone || ''),
        email: String(row.email || ''),
        gender: (row.gender === 'أنثى' ? 'أنثى' : 'ذكر'),
        grade: String(row.grade || ''),
        join_date: formatDateForDB(row.join_date),
        leave_annual_balance: Number(row.leave_annual_balance || 21),
        leave_casual_balance: Number(row.leave_casual_balance || 7),
        remaining_annual: Number(row.leave_annual_balance || 21),
        remaining_casual: Number(row.leave_casual_balance || 7),
        status: String(row.status || 'نشط'),
        notes: String(row.notes || ''),
        center_id: centerId
      })).filter(item => item.employee_id && item.name);

      if (formatted.length === 0) return alert("لم يتم العثور على بيانات صالحة in the file.");

      const { error } = await supabase.from('employees').upsert(formatted, { onConflict: 'employee_id' });
      if (error) throw error;
      alert("تم استيراد / تحديث بيانات الموظفين بنجاح");
      onRefresh();
    } catch (err: any) {
      alert("خطأ في الاستيراد: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6 text-blue-600"/> الموظفون والأطباء</h2>
        <div className="flex gap-2">
           <ExcelUploadButton onData={handleImport} label="استيراد موظفين" />
           <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md">
             {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {showForm ? 'إلغاء' : 'إضافة موظف'}
           </button>
        </div>
      </div>

      <ExcelInfo 
        fields={['employee_id', 'name', 'national_id', 'specialty', 'phone', 'join_date', 'leave_annual_balance', 'leave_casual_balance']} 
        sampleData={[{employee_id: '1001', name: 'أحمد محمود', national_id: '29000000000', specialty: 'باطنة', phone: '010000000', join_date: 'Aug 2, 2025', leave_annual_balance: 21, leave_casual_balance: 7}]}
        fileName="employees_template"
      />

      {showForm && (
        <div className="bg-gray-50 p-6 rounded-2xl border shadow-inner grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in duration-300">
           <Input label="كود الموظف (ID)" value={formData.employee_id} onChange={(v:any) => setFormData({...formData, employee_id: v})} />
           <Input label="الاسم الكامل" value={formData.name} onChange={(v:any) => setFormData({...formData, name: v})} />
           <Input label="الرقم القومي" value={formData.national_id} onChange={(v:any) => setFormData({...formData, national_id: v})} />
           <Input label="التخصص" value={formData.specialty} onChange={(v:any) => setFormData({...formData, specialty: v})} />
           <Input label="تاريخ التعيين" type="date" value={formData.join_date} onChange={(v:any) => setFormData({...formData, join_date: v})} />
           <Select label="النوع" options={['ذكر', 'أنثى']} value={formData.gender} onChange={(v:any) => setFormData({...formData, gender: v})} />
           <button onClick={async () => { 
             if(!formData.employee_id || !formData.name) return alert('برجاء إدخال الكود والاسم');
             const { error } = await supabase.from('employees').insert([formData]);
             if(!error) { onRefresh(); setShowForm(false); alert('تمت الإضافة بنجاح'); } else alert(error.message);
           }} className="md:col-span-2 lg:col-span-3 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-md">تأكيد إضافة الموظف</button>
        </div>
      )}

      <div className="overflow-x-auto border rounded-2xl shadow-sm bg-white">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-4 border-b">الكود</th>
              <th className="p-4 border-b">الاسم</th>
              <th className="p-4 border-b">التخصص</th>
              <th className="p-4 border-b">تاريخ التعيين</th>
              <th className="p-4 border-b text-center">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className="border-b hover:bg-blue-50 transition-colors">
                <td className="p-4 font-mono font-bold text-blue-600">{emp.employee_id}</td>
                <td className="p-4 font-bold">{emp.name}</td>
                <td className="p-4">{emp.specialty}</td>
                <td className="p-4">{formatDateForExcelDisplay(emp.join_date)}</td>
                <td className="p-4 text-center">
                  <button onClick={async () => { if(confirm('هل أنت متأكد من حذف هذا الموظف؟')) { await supabase.from('employees').delete().eq('id', emp.id); onRefresh(); } }} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-all">
                    <Trash2 className="w-5 h-5"/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttendanceTab({ employees, onRefresh }: { employees: Employee[], onRefresh: () => void }) {
  const [formData, setFormData] = useState<Partial<AttendanceRecord>>({ 
    date: new Date().toISOString().split('T')[0], 
    check_in_status: 'حاضر', 
    check_out_status: 'منصرف'
  });

  const handleImportAttendance = async (data: any[]) => {
    try {
      const validEmployeeIds = new Set(employees.map(e => e.employee_id));
      const processed = data.map(row => {
        // مطابقة الحقول تماماً مع DB
        const eid = String(row.employee_id || '');
        const dateRaw = row.date;
        const dbDate = formatDateForDB(dateRaw);
        
        if (validEmployeeIds.has(eid) && dbDate) {
          return {
            employee_id: eid,
            date: dbDate,
            check_in: row.check_in || null,
            check_in_status: row.check_in_status || 'حاضر',
            check_out: row.check_out || null,
            check_out_status: row.check_out_status || 'منصرف',
            notes: row.notes || ''
          };
        }
        return null;
      }).filter(Boolean);

      if (processed.length === 0) return alert("لم يتم العثور على سجلات صالحة. تأكد من مطابقة كود الموظف وصيغة التاريخ.");

      // فحص التكرار (Upsert) لمنع الخطأ
      const { error } = await supabase.from('attendance').upsert(processed, { onConflict: 'employee_id, date' });
      if (error) throw error;

      alert(`تم استيراد ${processed.length} سجل حضور وانصراف بنجاح.`);
      onRefresh();
    } catch (err: any) {
      alert("فشل رفع الحضور: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2"><Clock className="w-6 h-6 text-emerald-600"/> الحضور والانصراف</h2>
        <ExcelUploadButton onData={handleImportAttendance} label="رفع سجل البصمة" />
      </div>

      <ExcelInfo 
        fields={['employee_id', 'date', 'check_in', 'check_out', 'check_in_status', 'check_out_status']} 
        sampleData={[{employee_id: '1001', date: 'Aug 2, 2025', check_in: '08:00', check_out: '14:00', check_in_status: 'حاضر', check_out_status: 'منصرف'}]}
        fileName="attendance_db_match"
      />

      <div className="bg-gray-50 p-6 rounded-2xl border shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Select label="الموظف" options={[{value: '', label: '-- اختر موظف --'}, ...employees.map(e => ({value: e.employee_id, label: e.name}))]} value={formData.employee_id} onChange={(v:any) => setFormData({...formData, employee_id: v})} />
        <Input label="التاريخ" type="date" value={formData.date} onChange={(v:any) => setFormData({...formData, date: v})} />
        <Input label="وقت الحضور" type="time" value={formData.check_in || ''} onChange={(v:any) => setFormData({...formData, check_in: v})} />
        <Input label="وقت الانصراف" type="time" value={formData.check_out || ''} onChange={(v:any) => setFormData({...formData, check_out: v})} />
        <Select label="حالة الحضور" options={['حاضر', 'متأخر', 'غياب بعذر']} value={formData.check_in_status} onChange={(v:any) => setFormData({...formData, check_in_status: v})} />
        <button onClick={async () => { 
          if(!formData.employee_id) return alert('اختر الموظف أولاً');
          const { error } = await supabase.from('attendance').insert([formData]);
          if(!error) { alert('تم تسجيل الحضور يدوياً'); onRefresh(); } else alert(error.message);
        }} className="lg:mt-6 bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-md">حفظ سجل يدوي</button>
      </div>
    </div>
  );
}

function LeavesTab({ requests, onRefresh }: { requests: LeaveRequest[], onRefresh: () => void }) {
  const handleImport = async (data: any[]) => {
    try {
      const formatted = data.map(row => ({
        employee_id: String(row.employee_id || ''),
        type: String(row.type || 'اعتيادي'),
        start_date: formatDateForDB(row.start_date),
        end_date: formatDateForDB(row.end_date),
        backup_person: String(row.backup_person || ''),
        status: String(row.status || 'مقبول'),
        notes: String(row.notes || '')
      })).filter(r => r.employee_id && r.start_date);

      if (formatted.length === 0) return alert("لا توجد بيانات إجازات صالحة.");

      const { error } = await supabase.from('leave_requests').insert(formatted);
      if (error) throw error;
      alert("تم استيراد أرشيف الإجازات بنجاح");
      onRefresh();
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-purple-600"/> طلبات الإجازات</h2>
        <ExcelUploadButton onData={handleImport} label="استيراد إجازات سابقة" />
      </div>

      <ExcelInfo 
        fields={['employee_id', 'type', 'start_date', 'end_date', 'backup_person', 'status', 'notes']} 
        sampleData={[{employee_id: '1001', type: 'اعتيادي', start_date: 'Aug 2, 2025', end_date: 'Aug 5, 2025', backup_person: 'د. سارة', status: 'مقبول', notes: 'سفر عائلي'}]}
        fileName="leaves_db_match"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {requests.map(req => (
          <div key={req.id} className="p-5 border bg-white rounded-2xl shadow-sm flex justify-between items-center border-r-4 border-r-amber-400">
            <div>
              <p className="font-bold text-gray-800">{req.employee_name} <span className="text-xs text-gray-400 font-normal">(كود: {req.employee_id})</span></p>
              <p className="text-sm text-blue-600 font-bold">{req.type}</p>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {formatDateForExcelDisplay(req.start_date)} إلى {formatDateForExcelDisplay(req.end_date)}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={async () => { await supabase.from('leave_requests').update({status: 'مقبول'}).eq('id', req.id); onRefresh(); }} className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100 shadow-sm"><CheckCircle className="w-5 h-5"/></button>
              <button onClick={async () => { await supabase.from('leave_requests').update({status: 'مرفوض'}).eq('id', req.id); onRefresh(); }} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all border border-red-100 shadow-sm"><XCircle className="w-5 h-5"/></button>
            </div>
          </div>
        ))}
        {requests.length === 0 && <div className="md:col-span-2 text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed text-gray-400 font-bold">لا توجد طلبات إجازة معلقة حالياً</div>}
      </div>
    </div>
  );
}

function EveningScheduleTab() {
  const handleImportSchedule = async (data: any[]) => {
    try {
      const formatted = data.map(row => ({
        date: formatDateForDB(row.date),
        specs: String(row.specs || '').split(',').map(s => s.trim()),
        doctors: String(row.doctors || '').split(',').map(d => d.trim())
      })).filter(r => r.date);

      if (formatted.length === 0) return alert("ملف فارغ أو صيغة تاريخ خاطئة.");

      const { error } = await supabase.from('evening_schedule').insert(formatted);
      if (error) throw error;
      alert("تم رفع الجدول المسائي بنجاح");
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold border-b pb-4 flex items-center gap-2"><Calendar className="w-6 h-6 text-blue-600"/> الجدول المسائي</h2>
      <ExcelUploadButton onData={handleImportSchedule} label="رفع جدول المسائي" />
      <ExcelInfo 
        fields={['date', 'specs', 'doctors']} 
        sampleData={[{date: 'Aug 2, 2025', specs: 'باطنة,أطفال', doctors: 'د.أحمد,د.سارة'}]}
        fileName="evening_db_match"
      />
    </div>
  );
}

function ReportsTab() {
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFullReport = async () => {
    setLoading(true);
    const { data } = await supabase.from('attendance').select('*').order('date', {ascending: false}).limit(300);
    if(data) setReportData(data);
    setLoading(false);
  };

  const exportToExcel = () => {
    const formatted = reportData.map(r => ({
      'employee_id': r.employee_id,
      'date': r.date,
      'check_in': r.check_in,
      'check_out': r.check_out,
      'check_in_status': r.check_in_status,
      'check_out_status': r.check_out_status,
      'notes': r.notes
    }));
    const ws = XLSX.utils.json_to_sheet(formatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance_Report");
    XLSX.writeFile(wb, `Attendance_Report_${new Date().toLocaleDateString()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-emerald-600"/> التقارير والإحصائيات</h2>
        <button 
          onClick={exportToExcel} 
          disabled={reportData.length === 0} 
          className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 disabled:bg-gray-400 hover:bg-emerald-700 shadow-md transition-all"
        >
          <FileSpreadsheet className="w-5 h-5" /> تصدير إكسيل (Exact DB Format)
        </button>
      </div>
      <button onClick={fetchFullReport} className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-md">
        {loading ? 'جاري التحميل...' : 'عرض أحدث 300 سجل'}
      </button>
      
      <div className="overflow-x-auto border rounded-2xl shadow-sm bg-white">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-4 border-b">كود الموظف</th>
              <th className="p-4 border-b">التاريخ</th>
              <th className="p-4 border-b">الحضور</th>
              <th className="p-4 border-b">الانصراف</th>
              <th className="p-4 border-b">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((r,i) => (
              <tr key={i} className="border-b hover:bg-gray-50 transition-colors">
                <td className="p-4 font-mono font-bold text-blue-600">{r.employee_id}</td>
                <td className="p-4 font-bold">{formatDateForExcelDisplay(r.date)}</td>
                <td className="p-4 text-emerald-600 font-mono">{r.check_in || '--'}</td>
                <td className="p-4 text-red-500 font-mono">{r.check_out || '--'}</td>
                <td className="p-4"><span className={`px-2 py-1 rounded-md text-[10px] font-bold ${r.check_in_status === 'متأخر' ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{r.check_in_status}</span></td>
              </tr>
            ))}
            {reportData.length === 0 && <tr><td colSpan={5} className="text-center p-20 text-gray-400 font-bold">انقر على الزر لتوليد التقرير</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertsTab({ employees, sender }: { employees: Employee[], sender: string }) {
  const [recipient, setRecipient] = useState('');
  const [msg, setMsg] = useState('');
  const sendAlert = async () => {
    if(!recipient || !msg) return alert('برجاء اختيار المستلم وكتابة الرسالة');
    const { error } = await supabase.from('messages').insert([{ from_user: sender, to_user: recipient, content: msg }]);
    if(!error) { alert('تم إرسال التنبيه بنجاح'); setMsg(''); } else alert(error.message);
  };
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold border-b pb-4 flex items-center gap-2"><Bell className="w-6 h-6 text-amber-500"/> الرسائل والتنبيهات</h2>
      <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-6">
        <Select label="إلى المستلم" options={[{value: '', label: '-- اختر موظف --'}, {value: 'all', label: 'إرسال للجميع (All)'}, ...employees.map(e => ({value: e.employee_id, label: e.name}))]} value={recipient} onChange={setRecipient} />
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">محتوى الرسالة</label>
          <textarea className="w-full p-4 border rounded-xl min-h-[150px] outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-gray-50" placeholder="اكتب نص التنبيه أو التعليمات الإدارية هنا..." value={msg} onChange={e => setMsg(e.target.value)} />
        </div>
        <button onClick={sendAlert} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 shadow-md transition-all flex items-center justify-center gap-2">
          <Send className="w-5 h-5"/> إرسال التنبيه الإداري
        </button>
      </div>
    </div>
  );
}

// --- لوحة التحكم الرئيسية (Main Component) ---

interface AdminDashboardProps { onBack: () => void; }

const SidebarBtn = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-2xl transition-all font-bold ${active ? 'bg-blue-600 text-white shadow-xl translate-x-1' : 'bg-white text-gray-500 hover:bg-blue-50 hover:text-blue-600 border'}`}>
    <span className={`ml-3 p-2 rounded-lg ${active ? 'bg-blue-500' : 'bg-gray-50'}`}>{icon}</span>{label}
  </button>
);

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [centers, setCenters] = useState<GeneralSettings[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<GeneralSettings | null>(null);
  const [activeTab, setActiveTab] = useState('settings');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    supabase.from('general_settings').select('*').then(({data}) => { if(data) setCenters(data); });
  }, []);

  const fetchDashboardData = async () => {
    if (!selectedCenter) return;
    const [empRes, leaveRes] = await Promise.all([
      supabase.from('employees').select('*').eq('center_id', selectedCenter.id).order('name'),
      supabase.from('leave_requests').select(`*, employees(name)`).eq('status', 'معلق').order('created_at', { ascending: false })
    ]);
    if (empRes.data) setEmployees(empRes.data);
    if (leaveRes.data) setLeaveRequests((leaveRes.data as any[]).map(l => ({...l, employee_name: l.employees?.name})));
  };

  const handleLogin = () => {
    if(selectedCenter && adminPassword === selectedCenter.password) {
      setIsAdminLoggedIn(true);
      fetchDashboardData();
    } else {
      alert('كلمة المرور المدخلة غير صحيحة لهذا المركز');
    }
  };

  if (!isAdminLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-[85vh] p-6 text-right">
        <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-8 hover:underline font-bold"><ArrowRight className="ml-2" /> العودة للرئيسية</button>
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 border-2 border-blue-200">
              <ShieldCheck className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800">بوابة الإدارة</h2>
            <p className="text-gray-400 mt-2">تسجيل الدخول للوصول إلى لوحة التحكم</p>
          </div>
          <div className="space-y-6">
            <div className="text-right">
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">المركز الطبي</label>
              <select className="w-full p-3.5 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 border-gray-200" onChange={(e) => setSelectedCenter(centers.find(c => c.id === e.target.value) || null)}>
                <option value="">-- اختر المركز الطبي --</option>
                {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}
              </select>
            </div>
            <div className="text-right">
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">كلمة المرور</label>
              <input type="password" className="w-full p-3.5 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 border-gray-200" placeholder="أدخل باسورد المركز" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            </div>
            <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 shadow-xl transition-all transform hover:scale-[1.02]">دخول لوحة التحكم</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-10 text-right">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 bg-white p-8 rounded-3xl shadow-sm border gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-800 tracking-tight">إدارة: {selectedCenter?.center_name}</h1>
          <p className="text-gray-400 mt-1 font-semibold flex items-center gap-2">
            <Settings className="w-4 h-4" /> مركز التحكم الإداري الشامل
          </p>
        </div>
        <button onClick={onBack} className="bg-gray-100 text-gray-600 px-8 py-3 rounded-2xl font-bold flex items-center hover:bg-red-50 hover:text-red-600 transition-all shadow-sm">تسجيل خروج <LogOut className="mr-3 w-5 h-5"/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-3">
          <SidebarBtn active={activeTab === 'settings'} icon={<Settings className="w-5 h-5"/>} label="إعدادات المركز" onClick={() => setActiveTab('settings')} />
          <SidebarBtn active={activeTab === 'doctors'} icon={<Users className="w-5 h-5"/>} label="شؤون الموظفين" onClick={() => setActiveTab('doctors')} />
          <SidebarBtn active={activeTab === 'leaves'} icon={<FileText className="w-5 h-5"/>} label="طلبات الإجازة" onClick={() => setActiveTab('leaves')} />
          <SidebarBtn active={activeTab === 'evening'} icon={<Calendar className="w-5 h-5"/>} label="الجدول المسائي" onClick={() => setActiveTab('evening')} />
          <SidebarBtn active={activeTab === 'attendance'} icon={<Clock className="w-5 h-5"/>} label="سجل الحضور" onClick={() => setActiveTab('attendance')} />
          <SidebarBtn active={activeTab === 'reports'} icon={<BarChart3 className="w-5 h-5"/>} label="التقارير المالية" onClick={() => setActiveTab('reports')} />
          <SidebarBtn active={activeTab === 'alerts'} icon={<Bell className="w-5 h-5"/>} label="التنبيهات الإدارية" onClick={() => setActiveTab('alerts')} />
        </div>
        
        <div className="lg:col-span-3 bg-white p-8 rounded-3xl shadow-xl border border-gray-100 min-h-[700px]">
          {activeTab === 'settings' && selectedCenter && <GeneralSettingsTab center={selectedCenter} />}
          {activeTab === 'doctors' && <DoctorsTab employees={employees} onRefresh={fetchDashboardData} centerId={selectedCenter!.id} />}
          {activeTab === 'leaves' && <LeavesTab requests={leaveRequests} onRefresh={fetchDashboardData} />}
          {activeTab === 'evening' && <EveningScheduleTab />}
          {activeTab === 'attendance' && <AttendanceTab employees={employees} onRefresh={fetchDashboardData} />}
          {activeTab === 'reports' && <ReportsTab />}
          {activeTab === 'alerts' && <AlertsTab employees={employees} sender="admin" />}
        </div>
      </div>
    </div>
  );
};

// --- المساعدات المفقودة ---
const ShieldCheck = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
);

const LogOut = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
);

export default AdminDashboard;
