
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ArrowRight, Settings, Users, FileText, Calendar, 
  Clock, BarChart3, Mail, Bell, Plus, Upload, Trash2, CheckCircle, XCircle, Send, FileSpreadsheet, Info, Download, X
} from 'lucide-react';
import { GeneralSettings, Employee, LeaveRequest, AttendanceRecord, InternalMessage } from '../types';
import * as XLSX from 'xlsx';

// --- Generic UI Helpers ---
function Input({ label, type = 'text', value, onChange, placeholder }: any) {
  return (
    <div>
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
    <div>
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
    XLSX.utils.book_append_sheet(wb, ws, "Sample");
    XLSX.writeFile(wb, `${fileName || 'sample'}.xlsx`);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg mb-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs text-amber-800 font-bold mb-1">أعمدة ملف الإكسيل المطلوبة:</p>
          <div className="flex flex-wrap gap-2">
            {fields.map(f => <span key={f} className="bg-white px-2 py-0.5 rounded border border-amber-300 text-[10px] text-amber-700">{f}</span>)}
          </div>
        </div>
      </div>
      {sampleData && (
        <button 
          onClick={downloadSample}
          className="flex items-center text-xs font-bold text-amber-700 hover:text-amber-900 bg-amber-100/50 w-fit px-3 py-1.5 rounded-md border border-amber-200 transition-colors"
        >
          <Download className="w-3.5 h-3.5 ml-1.5" /> تحميل نموذج إكسيل جاهز (.xlsx)
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
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        onData(data);
      } catch (err) {
        alert("خطأ في قراءة ملف الإكسيل");
      } finally {
        setLoading(false);
        e.target.value = ''; // Reset input
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <label className="flex items-center bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 cursor-pointer font-semibold transition-all shadow-sm">
      {loading ? 'جاري التحميل...' : <>{icon} {label}</>}
      <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFile} />
    </label>
  );
}

// --- Sub-Components for Tabs ---

function GeneralSettingsTab({ center }: { center: GeneralSettings }) {
  const [settings, setSettings] = useState<GeneralSettings>({
    ...center,
    holidays: center.holidays || []
  });
  const [newHoliday, setNewHoliday] = useState('');

  const handleSave = async () => {
    const { error } = await supabase.from('general_settings').update(settings).eq('id', center.id);
    if (error) alert('خطأ في الحفظ');
    else alert('تم الحفظ بنجاح');
  };

  const addHoliday = () => {
    if (!newHoliday) return;
    const currentHolidays = settings.holidays || [];
    if (currentHolidays.includes(newHoliday)) return alert('التاريخ موجود بالفعل');
    setSettings({...settings, holidays: [...currentHolidays, newHoliday]});
    setNewHoliday('');
  };

  const removeHoliday = (date: string) => {
    setSettings({...settings, holidays: (settings.holidays || []).filter(d => d !== date)});
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">الإعدادات العامة للمركز</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="اسم المركز" value={settings.center_name} onChange={(v:any) => setSettings({...settings, center_name: v})} />
        <Input label="اسم الإدارة" value={settings.admin_name} onChange={(v:any) => setSettings({...settings, admin_name: v})} />
        <Input label="تليفون المركز" value={settings.phone} onChange={(v:any) => setSettings({...settings, phone: v})} />
        <Input label="عنوان المركز" value={settings.address} onChange={(v:any) => setSettings({...settings, address: v})} />
        <Input label="رابط اللوكيشن" value={settings.location_url} onChange={(v:any) => setSettings({...settings, location_url: v})} />
        <Input label="باسورد المركز" type="password" value={settings.password} onChange={(v:any) => setSettings({...settings, password: v})} />
      </div>
      
      <div className="border-t pt-4">
        <h3 className="font-bold text-gray-700 mb-3 flex items-center"><Calendar className="w-4 h-4 ml-2"/> إدارة العطلات الرسمية (الأعياد والمناسبات)</h3>
        <div className="flex gap-2 mb-4">
          <input type="date" value={newHoliday} onChange={e => setNewHoliday(e.target.value)} className="p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          <button onClick={addHoliday} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center"><Plus className="w-4 h-4 ml-1"/> إضافة عطلة</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(settings.holidays || []).map(date => (
            <span key={date} className="bg-gray-100 px-3 py-1 rounded-full text-sm border flex items-center gap-2">
              {date}
              <button onClick={() => removeHoliday(date)} className="text-red-500 hover:text-red-700"><X className="w-3.5 h-3.5"/></button>
            </span>
          ))}
          {(!settings.holidays || settings.holidays.length === 0) && <p className="text-xs text-gray-400">لا توجد عطلات مضافة بعد.</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-t pt-4">
        <Input label="حضور الصباحي" type="time" value={settings.shift_morning_in} onChange={(v:any) => setSettings({...settings, shift_morning_in: v})} />
        <Input label="انصراف الصباحي" type="time" value={settings.shift_morning_out} onChange={(v:any) => setSettings({...settings, shift_morning_out: v})} />
        <Input label="حضور المسائي" type="time" value={settings.shift_evening_in} onChange={(v:any) => setSettings({...settings, shift_evening_in: v})} />
        <Input label="انصراف المسائي" type="time" value={settings.shift_evening_out} onChange={(v:any) => setSettings({...settings, shift_evening_out: v})} />
        <Input label="حضور السهر" type="time" value={settings.shift_night_in} onChange={(v:any) => setSettings({...settings, shift_night_in: v})} />
        <Input label="انصراف السهر" type="time" value={settings.shift_night_out} onChange={(v:any) => setSettings({...settings, shift_night_out: v})} />
      </div>
      <button onClick={handleSave} className="bg-emerald-600 text-white px-8 py-3 rounded-lg hover:bg-emerald-700 font-bold">حفظ التغييرات</button>
    </div>
  );
}

function DoctorsTab({ employees, onRefresh, centerId }: { employees: Employee[], onRefresh: () => void, centerId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Employee>>({ gender: 'ذكر', status: 'نشط', center_id: centerId, leave_annual_balance: 21, leave_casual_balance: 7 });

  const handleAdd = async () => {
    const { error } = await supabase.from('employees').insert([formData]);
    if (error) alert('خطأ في الإضافة: ' + error.message);
    else { setShowForm(false); onRefresh(); }
  };

  const handleExcelImport = async (data: any[]) => {
    const formatted = data.map(row => ({
      employee_id: String(row.employee_id || row['رقم الموظف']),
      name: row.name || row['الاسم'],
      national_id: String(row.national_id || row['الرقم القومي']),
      specialty: row.specialty || row['التخصص'],
      phone: String(row.phone || row['الهاتف'] || ''),
      email: row.email || row['الايميل'] || '',
      gender: row.gender || row['النوع'] || 'ذكر',
      grade: row.grade || row['الدرجة'] || '',
      status: row.status || 'نشط',
      center_id: centerId,
      leave_annual_balance: row.leave_annual_balance || 21,
      leave_casual_balance: row.leave_casual_balance || 7,
      remaining_annual: row.remaining_annual || row.leave_annual_balance || 21,
      remaining_casual: row.remaining_casual || row.leave_casual_balance || 7
    }));
    const { error } = await supabase.from('employees').insert(formatted);
    if (error) alert("خطأ في الرفع: " + error.message);
    else { alert("تم رفع الموظفين بنجاح"); onRefresh(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">إعدادات الأطباء والعاملين</h2>
        <div className="flex gap-2">
          <ExcelUploadButton onData={handleExcelImport} label="استيراد موظفين" />
          <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center">
            {showForm ? 'إلغاء' : <><Plus className="w-4 h-4 ml-2" /> إضافة يدوي</>}
          </button>
        </div>
      </div>
      <ExcelInfo 
        fields={['employee_id', 'name', 'national_id', 'specialty', 'phone', 'email', 'gender', 'grade', 'leave_annual_balance', 'leave_casual_balance']} 
        sampleData={[{employee_id: '1001', name: 'أحمد محمد', national_id: '12345678901234', specialty: 'باطنة', phone: '0123456789', email: 'ahmed@mail.com', gender: 'ذكر', grade: 'أخصائي', leave_annual_balance: 21, leave_casual_balance: 7}]}
        fileName="employees_sample"
      />
      
      {showForm && (
        <div className="bg-gray-50 p-6 rounded-xl border-2 border-dashed grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="رقم الموظف" value={formData.employee_id || ''} onChange={(v:any) => setFormData({...formData, employee_id: v})} />
          <Input label="اسم الموظف" value={formData.name || ''} onChange={(v:any) => setFormData({...formData, name: v})} />
          <Input label="الرقم القومي" value={formData.national_id || ''} onChange={(v:any) => setFormData({...formData, national_id: v})} />
          <Input label="التخصص" value={formData.specialty || ''} onChange={(v:any) => setFormData({...formData, specialty: v})} />
          <Input label="رقم الهاتف" value={formData.phone || ''} onChange={(v:any) => setFormData({...formData, phone: v})} />
          <Input label="البريد الإلكتروني" value={formData.email || ''} onChange={(v:any) => setFormData({...formData, email: v})} />
          <Select label="النوع" options={['ذكر', 'أنثى']} value={formData.gender} onChange={(v:any) => setFormData({...formData, gender: v as any})} />
          <Input label="الدرجة الوظيفية" value={formData.grade || ''} onChange={(v:any) => setFormData({...formData, grade: v})} />
          <Input label="رصيد سنوي" type="number" value={formData.leave_annual_balance || 21} onChange={(v:any) => setFormData({...formData, leave_annual_balance: parseInt(v)})} />
          <Input label="رصيد عارضة" type="number" value={formData.leave_casual_balance || 7} onChange={(v:any) => setFormData({...formData, leave_casual_balance: parseInt(v)})} />
          <Select label="الحالة" options={['نشط', 'موقوف', 'إجازة']} value={formData.status} onChange={(v:any) => setFormData({...formData, status: v as any})} />
          <div className="md:col-span-3">
             <button onClick={handleAdd} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">تأكيد الإضافة</button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto border rounded-xl">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">رقم</th>
              <th className="p-3">الاسم</th>
              <th className="p-3">التخصص</th>
              <th className="p-3">الحالة</th>
              <th className="p-3">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono">{emp.employee_id}</td>
                <td className="p-3 font-bold">{emp.name}</td>
                <td className="p-3 text-gray-600">{emp.specialty}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${emp.status === 'نشط' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {emp.status}
                  </span>
                </td>
                <td className="p-3"><button onClick={async () => { if(confirm('حذف؟')) { await supabase.from('employees').delete().eq('id', emp.id); onRefresh(); } }} className="text-red-500"><Trash2 className="w-4 h-4"/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeavesTab({ requests, onRefresh }: { requests: LeaveRequest[], onRefresh: () => void }) {
  const handleExcelImport = async (data: any[]) => {
    const formatted = data.map(row => ({
      employee_id: String(row.employee_id || row['رقم الموظف']),
      type: row.type || row['نوع الإجازة'],
      start_date: row.start_date || row['من تاريخ'],
      end_date: row.end_date || row['إلى تاريخ'],
      status: row.status || 'مقبول',
      backup_person: row.backup_person || row['القائم بالعمل'] || '',
      notes: row.notes || ''
    }));
    const { error } = await supabase.from('leave_requests').insert(formatted);
    if (error) alert(error.message); else { alert("تم استيراد الطلبات"); onRefresh(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">الطلبات والإجازات</h2>
        <ExcelUploadButton onData={handleExcelImport} label="رفع أرشيف إجازات" />
      </div>
      <ExcelInfo 
        fields={['employee_id', 'type', 'start_date', 'end_date', 'backup_person', 'status', 'notes']} 
        sampleData={[{employee_id: '1001', type: 'اعتيادي', start_date: '2023-11-01', end_date: '2023-11-05', backup_person: 'د. محمد علي', status: 'مقبول', notes: 'سفر عائلي'}]}
        fileName="leaves_sample"
      />
      <div className="space-y-4">
        {requests.length === 0 && <p className="text-center text-gray-400 py-10">لا توجد طلبات معلقة</p>}
        {requests.map(req => (
          <div key={req.id} className="p-4 border rounded-xl flex justify-between items-center hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-bold text-lg">{req.employee_name}</span>
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">{req.type}</span>
              </div>
              <p className="text-sm text-gray-500">الفترة: {req.start_date} إلى {req.end_date}</p>
              {req.notes && <p className="text-xs text-gray-400 mt-1 italic">ملاحظة: {req.notes}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={async () => { await supabase.from('leave_requests').update({status: 'مقبول'}).eq('id', req.id); onRefresh(); }} className="p-2 bg-green-50 text-green-600 rounded-full hover:bg-green-100"><CheckCircle/></button>
              <button onClick={async () => { await supabase.from('leave_requests').update({status: 'مرفوض'}).eq('id', req.id); onRefresh(); }} className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100"><XCircle/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EveningScheduleTab() {
  const handleExcelSchedule = async (data: any[]) => {
    const formatted = data.map(row => ({
      date: row.date || row['التاريخ'],
      specs: Array.isArray(row.specs) ? row.specs : (row.specs || row['التخصصات'])?.split(',') || [],
      doctors: Array.isArray(row.doctors) ? row.doctors : (row.doctors || row['الأطباء'])?.split(',') || []
    }));
    const { error } = await supabase.from('evening_schedule').insert(formatted);
    if(error) alert(error.message); else alert("تم رفع الجدول بنجاح");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">جدول المسائي</h2>
        <ExcelUploadButton onData={handleExcelSchedule} label="رفع جدول المسائي" />
      </div>
      <ExcelInfo 
        fields={['date', 'specs', 'doctors']} 
        sampleData={[{date: '2023-10-30', specs: 'باطنة,أطفال,جراحة', doctors: 'د.أحمد,د.سارة,د.خالد'}]}
        fileName="evening_sample"
      />
      <div className="border-2 border-dashed p-12 text-center rounded-2xl bg-gray-50">
         <Calendar className="w-12 h-12 mx-auto mb-4 text-blue-500" />
         <h3 className="text-xl font-bold mb-2">إدارة الجدول المسائي</h3>
         <p className="text-sm text-gray-400 mb-6">يمكنك رفع ملف إكسيل يحتوي على التاريخ، قائمة التخصصات، وقائمة الأطباء.</p>
      </div>
    </div>
  );
}

function AttendanceTab({ employees, onRefresh }: { employees: Employee[], onRefresh: () => void }) {
  const [formData, setFormData] = useState<Partial<AttendanceRecord>>({ 
    date: new Date().toISOString().split('T')[0], 
    check_in_status: 'حاضر', 
    check_out_status: 'منصرف',
    notes: ''
  });

  const handleManualAdd = async () => {
    if(!formData.employee_id) return alert('اختر الموظف');
    const { error } = await supabase.from('attendance').insert([formData]);
    if (error) {
      if (error.code === '23503') alert('خطأ: رقم الموظف غير مسجل في النظام. تأكد من إضافة الموظف أولاً.');
      else alert(error.message);
    } else { alert('تم تسجيل الحضور بنجاح'); onRefresh(); }
  };

  const handleExcelAttendance = async (data: any[]) => {
    // Check if employee_ids exist in current employees list to prevent FK errors
    const validIds = new Set(employees.map(e => e.employee_id));
    const formatted = [];
    const invalidRows = [];

    for (const row of data) {
      const eid = String(row.employee_id || row['رقم الموظف'] || '');
      if (validIds.has(eid)) {
        formatted.push({
          employee_id: eid,
          date: row.date || row['التاريخ'] || new Date().toISOString().split('T')[0],
          check_in: row.check_in || row['وقت الحضور'] || null,
          check_out: row.check_out || row['وقت الانصراف'] || null,
          check_in_status: row.check_in_status || row['حالة الحضور'] || 'حاضر',
          check_out_status: row.check_out_status || row['حالة الانصراف'] || 'منصرف',
          notes: row.notes || row['ملاحظات'] || ''
        });
      } else {
        invalidRows.push(eid);
      }
    }

    if (invalidRows.length > 0) {
      alert(`تحذير: تم استبعاد ${invalidRows.length} سجل لأن أرقام الموظفين التالية غير مسجلة: ${invalidRows.join(', ')}`);
    }

    if (formatted.length > 0) {
      const { error } = await supabase.from('attendance').insert(formatted);
      if(error) alert(error.message); 
      else { alert(`تم رفع ${formatted.length} سجل حضور بنجاح`); onRefresh(); }
    } else if (invalidRows.length > 0) {
      alert("لم يتم رفع أي بيانات لعدم وجود مطابقة لأرقام الموظفين.");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">بيانات الحضور والانصراف</h2>
        <ExcelUploadButton onData={handleExcelAttendance} label="رفع إكسيل بصمة" />
      </div>
      <ExcelInfo 
        fields={['employee_id', 'date', 'check_in', 'check_out', 'check_in_status', 'check_out_status', 'notes']} 
        sampleData={[{employee_id: '1001', date: '2023-10-25', check_in: '08:30', check_out: '14:30', check_in_status: 'حاضر', check_out_status: 'منصرف', notes: 'دخول بموعد'}]}
        fileName="attendance_sample"
      />
      
      <div className="bg-gray-50 p-6 rounded-xl border grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select 
          label="الموظف" 
          options={[{value: '', label: '-- اختر موظف --'}, ...employees.map(e => ({value: e.employee_id, label: `${e.name} (${e.employee_id})`}))]} 
          value={formData.employee_id} 
          onChange={(v:any) => setFormData({...formData, employee_id: v})} 
        />
        <Input label="التاريخ" type="date" value={formData.date} onChange={(v:any) => setFormData({...formData, date: v})} />
        <Input label="وقت الحضور" type="time" value={formData.check_in || ''} onChange={(v:any) => setFormData({...formData, check_in: v})} />
        <Select label="حالة الحضور" options={['حاضر', 'متأخر', 'غائب', 'مأمورية']} value={formData.check_in_status} onChange={(v:any) => setFormData({...formData, check_in_status: v})} />
        <Input label="وقت الانصراف" type="time" value={formData.check_out || ''} onChange={(v:any) => setFormData({...formData, check_out: v})} />
        <Select label="حالة الانصراف" options={['منصرف', 'خروج مبكر', 'مأمورية', 'مستمر']} value={formData.check_out_status} onChange={(v:any) => setFormData({...formData, check_out_status: v})} />
        <div className="md:col-span-2">
          <Input label="ملاحظات الحضور" value={formData.notes} onChange={(v:any) => setFormData({...formData, notes: v})} placeholder="اكتب أي ملاحظات تتعلق بهذا اليوم..." />
        </div>
        <div className="md:col-span-2">
          <button onClick={handleManualAdd} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center">
            <Plus className="w-5 h-5 ml-2" /> حفظ سجل الحضور يدوياً
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportsTab({ employees }: { employees: Employee[] }) {
  const [reportData, setReportData] = useState<any[]>([]);
  const fetchReport = async () => {
    const { data } = await supabase.from('attendance').select('*').limit(100).order('date', {ascending: false});
    if(data) setReportData(data);
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "MedicalCenter_FullReport.xlsx");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold">التقارير والإحصاء</h2>
        <button onClick={exportExcel} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center font-bold transition-all hover:bg-emerald-700">
          <FileSpreadsheet className="w-4 h-4 ml-2" /> تصدير التقرير الكامل
        </button>
      </div>
      <button onClick={fetchReport} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-bold">توليد تقرير أحدث 100 سجل</button>
      <div className="overflow-x-auto border rounded-xl shadow-sm">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">رقم الموظف</th>
              <th className="p-3">التاريخ</th>
              <th className="p-3">حضور</th>
              <th className="p-3">انصراف</th>
              <th className="p-3">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((r,i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono">{r.employee_id}</td>
                <td className="p-3">{r.date}</td>
                <td className="p-3 text-emerald-600 font-bold">{r.check_in || '--'}</td>
                <td className="p-3 text-red-500 font-bold">{r.check_out || '--'}</td>
                <td className="p-3 text-xs">{r.check_in_status} / {r.check_out_status}</td>
              </tr>
            ))}
            {reportData.length === 0 && <tr><td colSpan={5} className="text-center p-10 text-gray-400">انقر على الزر لتوليد التقرير</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertsTab({ employees, sender }: { employees: Employee[], sender: string }) {
  const [recipient, setRecipient] = useState('');
  const [msg, setMsg] = useState('');
  const [history, setHistory] = useState<InternalMessage[]>([]);

  const fetchHistory = async () => {
    const { data } = await supabase.from('messages').select('*').eq('from_user', sender).order('created_at', { ascending: false });
    if (data) setHistory(data);
  };

  const sendMsg = async () => {
    if(!recipient || !msg) return alert('أكمل البيانات');
    const { error } = await supabase.from('messages').insert([{ from_user: sender, to_user: recipient, content: msg }]);
    if(!error) { alert('تم الإرسال'); setMsg(''); fetchHistory(); }
  };

  useEffect(() => { fetchHistory(); }, []);

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold border-b pb-4">الرسائل والتنبيهات الصادرة</h2>
      <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 space-y-4">
        <Select 
          label="المستلم" 
          options={[{value: '', label: '-- اختر المستلم --'}, {value: 'all', label: 'إرسال للجميع'}, ...employees.map(e => ({value: e.employee_id, label: e.name}))]} 
          value={recipient} 
          onChange={(v:any) => setRecipient(v)} 
        />
        <textarea className="w-full p-3 border rounded-lg min-h-[120px] focus:ring-2 focus:ring-blue-400 outline-none" placeholder="اكتب نص التنبيه أو التعليمات هنا..." value={msg} onChange={e => setMsg(e.target.value)} />
        <button onClick={sendMsg} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold flex items-center justify-center hover:bg-blue-700 transition-colors"><Bell className="ml-2 w-5 h-5"/> إرسال التنبيه الآن</button>
      </div>
      <div className="space-y-3">
        <h3 className="font-bold text-gray-700 flex items-center"><Mail className="w-4 h-4 ml-2" /> سجل الرسائل السابقة</h3>
        {history.map(item => (
          <div key={item.id} className="p-4 bg-white border rounded-xl shadow-sm hover:border-blue-200 transition-all">
            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
              <span className="font-bold text-blue-600">إلى: {item.to_user === 'all' ? 'الكل' : item.to_user}</span>
              <span>{new Date(item.created_at).toLocaleString('ar-EG')}</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{item.content}</p>
          </div>
        ))}
        {history.length === 0 && <p className="text-center text-gray-400 py-10">لا يوجد سجل رسائل</p>}
      </div>
    </div>
  );
}

// --- Main Dashboard Component ---

interface AdminDashboardProps { onBack: () => void; }

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [centers, setCenters] = useState<GeneralSettings[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<GeneralSettings | null>(null);
  const [activeTab, setActiveTab] = useState('settings');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

  useEffect(() => { fetchCenters(); }, []);

  const fetchCenters = async () => {
    const { data } = await supabase.from('general_settings').select('*');
    if (data) setCenters(data);
  };

  const handleAdminLogin = async () => {
    if (!selectedCenter) return alert('اختر المركز');
    if (adminPassword === selectedCenter.password) {
      setIsAdminLoggedIn(true);
      fetchDashboardData();
    } else alert('كلمة مرور خاطئة');
  };

  const fetchDashboardData = async () => {
    if (!selectedCenter) return;
    const [empRes, leaveRes] = await Promise.all([
      supabase.from('employees').select('*').eq('center_id', selectedCenter.id),
      supabase.from('leave_requests').select(`*, employees(name)`).eq('status', 'معلق').order('created_at', { ascending: false })
    ]);
    if (empRes.data) setEmployees(empRes.data);
    if (leaveRes.data) {
        setLeaveRequests((leaveRes.data as any[]).map(l => ({...l, employee_name: l.employees?.name})));
    }
  };

  if (!isAdminLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-6">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border">
          <button onClick={onBack} className="flex items-center text-blue-600 mb-6 hover:underline"><ArrowRight className="ml-1" /> رجوع</button>
          <h2 className="text-2xl font-bold mb-6 text-center">دخول الإدارة</h2>
          <div className="space-y-4">
            <select className="w-full p-3 border rounded-lg" onChange={(e) => setSelectedCenter(centers.find(c => c.id === e.target.value) || null)}>
              <option value="">-- اختر مركز --</option>
              {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}
            </select>
            <input type="password" className="w-full p-3 border rounded-lg" placeholder="الباسورد" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            <button onClick={handleAdminLogin} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">دخول</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">لوحة تحكم: {selectedCenter?.center_name}</h1>
          <p className="text-gray-500">مرحباً بك في نظام الإدارة الرئيسي</p>
        </div>
        <button onClick={onBack} className="bg-gray-200 px-6 py-2 rounded-lg font-semibold flex items-center hover:bg-gray-300 transition-all shadow-sm">
          <ArrowRight className="ml-2 w-5 h-5" /> تسجيل خروج
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-2">
          <SidebarBtn active={activeTab === 'settings'} icon={<Settings/>} label="الإعدادات العامة" onClick={() => setActiveTab('settings')} />
          <SidebarBtn active={activeTab === 'doctors'} icon={<Users/>} label="إعدادات الأطباء" onClick={() => setActiveTab('doctors')} />
          <SidebarBtn active={activeTab === 'leaves'} icon={<FileText/>} label="الطلبات والإجازات" onClick={() => setActiveTab('leaves')} />
          <SidebarBtn active={activeTab === 'evening'} icon={<Calendar/>} label="جدول المسائي" onClick={() => setActiveTab('evening')} />
          <SidebarBtn active={activeTab === 'attendance'} icon={<Clock/>} label="بيانات الحضور" onClick={() => setActiveTab('attendance')} />
          <SidebarBtn active={activeTab === 'reports'} icon={<BarChart3/>} label="التقارير والإحصاء" onClick={() => setActiveTab('reports')} />
          <SidebarBtn active={activeTab === 'alerts'} icon={<Bell/>} label="الرسائل والتنبيهات" onClick={() => setActiveTab('alerts')} />
        </div>
        <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border min-h-[600px]">
          {activeTab === 'settings' && selectedCenter && <GeneralSettingsTab center={selectedCenter} />}
          {activeTab === 'doctors' && <DoctorsTab employees={employees} onRefresh={fetchDashboardData} centerId={selectedCenter!.id} />}
          {activeTab === 'leaves' && <LeavesTab requests={leaveRequests} onRefresh={fetchDashboardData} />}
          {activeTab === 'evening' && <EveningScheduleTab />}
          {activeTab === 'attendance' && <AttendanceTab employees={employees} onRefresh={fetchDashboardData} />}
          {activeTab === 'reports' && <ReportsTab employees={employees} />}
          {activeTab === 'alerts' && <AlertsTab employees={employees} sender="admin" />}
        </div>
      </div>
    </div>
  );
};

const SidebarBtn = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-xl transition-all font-semibold ${active ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
    <span className="ml-3">{icon}</span>{label}
  </button>
);

export default AdminDashboard;
