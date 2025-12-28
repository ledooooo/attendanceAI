import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest, Evaluation, InternalMessage } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { ExcelUploadButton, downloadSample } from '../../../components/ui/ExcelUploadButton';
import { 
  Download, Users, ArrowRight, User, Clock, FileText, 
  Award, BarChart, Inbox, ArrowUpDown, ArrowUp, ArrowDown 
} from 'lucide-react';

// استيراد المكونات الفرعية
import StaffProfile from '../../staff/components/StaffProfile';
import StaffAttendance from '../../staff/components/StaffAttendance';
import StaffRequestsHistory from '../../staff/components/StaffRequestsHistory';
import StaffEvaluations from '../../staff/components/StaffEvaluations';
import StaffStats from '../../staff/components/StaffStats';
import StaffMessages from '../../staff/components/StaffMessages';

// دالة مساعدة لتنسيق التاريخ لقاعدة البيانات
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

export default function DoctorsTab({ employees, onRefresh, centerId }: { employees: Employee[], onRefresh: () => void, centerId: string }) {
  // --- States for Filtering ---
  const [fName, setFName] = useState('');
  const [fId, setFId] = useState('');
  const [fSpec, setFSpec] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [isProcessing, setIsProcessing] = useState(false);

  // --- States for Sorting ---
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'employee_id' | null, direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });

  // --- States for Detail View ---
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [detailTab, setDetailTab] = useState('profile');
  const [empData, setEmpData] = useState<{
    attendance: AttendanceRecord[],
    requests: LeaveRequest[],
    evals: Evaluation[],
    messages: InternalMessage[]
  }>({ attendance: [], requests: [], evals: [], messages: [] });
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // جلب بيانات الموظف المختار التفصيلية
  useEffect(() => {
    if (selectedEmp) {
      const fetchData = async () => {
        const [att, req, evl, msg] = await Promise.all([
            supabase.from('attendance').select('*').eq('employee_id', selectedEmp.employee_id),
            supabase.from('leave_requests').select('*').eq('employee_id', selectedEmp.employee_id).order('created_at', { ascending: false }),
            supabase.from('evaluations').select('*').eq('employee_id', selectedEmp.employee_id).order('month', { ascending: false }),
            supabase.from('messages').select('*').or(`to_user.eq.${selectedEmp.employee_id},to_user.eq.all`).order('created_at', { ascending: false })
        ]);
        
        setEmpData({
            attendance: att.data || [],
            requests: req.data || [],
            evals: evl.data || [],
            messages: msg.data || []
        });
      };
      fetchData();
    }
  }, [selectedEmp]);

  // منطق الفلترة
  const filtered = employees.filter(e => 
    (e.name.includes(fName)) && 
    (e.employee_id.includes(fId)) && 
    (fSpec === 'all' || e.specialty === fSpec) &&
    (fStatus === 'all' || e.status === fStatus)
  );

  // منطق الترتيب
  const handleSort = (key: 'name' | 'employee_id') => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  const sortedEmployees = useMemo(() => {
      let sortableItems = [...filtered];
      if (sortConfig.key !== null) {
          sortableItems.sort((a, b) => {
              if (a[sortConfig.key!] < b[sortConfig.key!]) {
                  return sortConfig.direction === 'asc' ? -1 : 1;
              }
              if (a[sortConfig.key!] > b[sortConfig.key!]) {
                  return sortConfig.direction === 'asc' ? 1 : -1;
              }
              return 0;
          });
      }
      return sortableItems;
  }, [filtered, sortConfig]);

  // منطق تحديث الحالة السريع
  const updateStatus = async (id: string, newStatus: string) => {
      const { error } = await supabase.from('employees').update({ status: newStatus }).eq('id', id);
      if (!error) {
          onRefresh(); // تحديث القائمة لإظهار الحالة الجديدة
      } else {
          alert('فشل تحديث الحالة: ' + error.message);
      }
  };

  // منطق استيراد الإكسيل
  const handleExcelImport = async (data: any[]) => {
    setIsProcessing(true);
    try {
        const payload = data.map(row => ({
            employee_id: String(row.employee_id || row.employee_ || row['الكود'] || row['ID'] || '').trim(),
            name: String(row.name || row['الاسم'] || '').trim(),
            national_id: String(row.national_id || row['الرقم القومي'] || '').trim(),
            specialty: String(row.specialty || row['التخصص'] || '').trim(),
            join_date: formatDateForDB(row.join_date || row['تاريخ التعيين']) || new Date().toISOString().split('T')[0],
            center_id: centerId,
            email: String(row.email || row['البريد'] || '').trim() || null
        })).filter(r => r.employee_id && r.name);

        if (payload.length === 0) return alert('لا توجد بيانات صالحة');

        const { data: res, error } = await supabase.rpc('process_employees_bulk', { payload });
        if (error) throw error;

        alert(`تقرير المزامنة:\n- إضافة: ${res.inserted}\n- تحديث: ${res.updated}\n- تجاهل: ${res.skipped}`);
        onRefresh();
    } catch (e:any) {
        alert('حدث خطأ: ' + e.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // --- عرض التفاصيل (ملف الموظف) ---
  if (selectedEmp) {
      return (
          <div className="space-y-6 animate-in slide-in-from-left duration-300">
              {/* Header */}
              <div className="flex items-center justify-between bg-white p-4 rounded-3xl shadow-sm border border-blue-100">
                  <div className="flex items-center gap-4">
                      <button onClick={() => setSelectedEmp(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                          <ArrowRight className="w-6 h-6 text-gray-600"/>
                      </button>
                      <div>
                          <h2 className="text-xl font-black text-gray-800">{selectedEmp.name}</h2>
                          <p className="text-xs text-gray-500 font-bold">{selectedEmp.specialty} • {selectedEmp.employee_id}</p>
                      </div>
                  </div>
                  <div className={`px-3 py-1 rounded-lg text-xs font-black ${selectedEmp.status==='نشط'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>
                      {selectedEmp.status}
                  </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {[
                      {id: 'profile', icon: User, label: 'البيانات والتعديل'},
                      {id: 'attendance', icon: Clock, label: 'الحضور'},
                      {id: 'stats', icon: BarChart, label: 'الإحصائيات'},
                      {id: 'requests', icon: FileText, label: 'الطلبات'},
                      {id: 'evals', icon: Award, label: 'التقييمات'},
                      {id: 'messages', icon: Inbox, label: 'الرسائل'},
                  ].map(tab => (
                      <button 
                          key={tab.id}
                          onClick={() => setDetailTab(tab.id)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${detailTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                      >
                          <tab.icon className="w-4 h-4"/> {tab.label}
                      </button>
                  ))}
              </div>

              {/* Content */}
              <div className="bg-white p-6 rounded-[30px] border shadow-sm min-h-[500px]">
                  {detailTab === 'profile' && (
                      <StaffProfile 
                          employee={selectedEmp} 
                          isEditable={true} // تفعيل التعديل للمدير
                          onUpdate={onRefresh} // لتحديث القائمة الرئيسية بعد الحفظ
                      />
                  )}
                  {detailTab === 'attendance' && <StaffAttendance attendance={empData.attendance} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} employee={selectedEmp} />}
                  {detailTab === 'stats' && <StaffStats attendance={empData.attendance} evals={empData.evals} requests={empData.requests} month={selectedMonth} />}
                  {detailTab === 'requests' && <StaffRequestsHistory requests={empData.requests} />}
                  {detailTab === 'evals' && <StaffEvaluations evals={empData.evals} />}
                  {detailTab === 'messages' && <StaffMessages messages={empData.messages} />}
              </div>
          </div>
      );
  }

  // --- عرض القائمة (الجدول الرئيسي) ---
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800"><Users className="w-7 h-7 text-blue-600"/> شئون الموظفين</h2>
        <div className="flex gap-2">
            <button onClick={()=>downloadSample('staff')} className="text-gray-400 p-2 hover:text-blue-600 transition-all"><Download className="w-5 h-5"/></button>
            <ExcelUploadButton onData={handleExcelImport} label={isProcessing ? "جاري المزامنة..." : "استيراد موظفين"} />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-3xl border border-gray-100 shadow-inner">
          <Input label="بحث بالاسم" value={fName} onChange={setFName} placeholder="اسم الموظف..." />
          <Input label="بحث بالكود" value={fId} onChange={setFId} placeholder="كود الموظف..." />
          <Select label="التخصص" options={['all', ...Array.from(new Set(employees.map(e=>e.specialty)))]} value={fSpec} onChange={setFSpec} />
          <Select label="الحالة" options={['all', 'نشط', 'موقوف', 'إجازة', 'خارج المركز']} value={fStatus} onChange={setFStatus} />
      </div>
      
      <div className="overflow-x-auto border rounded-[30px] bg-white shadow-sm max-h-[600px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-sm text-right">
              <thead className="bg-gray-100 font-black border-b sticky top-0 z-10 text-gray-600">
                  <tr>
                      <th 
                        className="p-4 text-center cursor-pointer hover:bg-gray-200 transition-colors select-none"
                        onClick={() => handleSort('employee_id')}
                      >
                          <div className="flex items-center justify-center gap-1">
                             الكود
                             {sortConfig.key === 'employee_id' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 text-blue-600"/> : <ArrowDown className="w-4 h-4 text-blue-600"/>)}
                             {sortConfig.key !== 'employee_id' && <ArrowUpDown className="w-4 h-4 text-gray-300"/>}
                          </div>
                      </th>
                      <th 
                        className="p-4 cursor-pointer hover:bg-gray-200 transition-colors select-none"
                        onClick={() => handleSort('name')}
                      >
                          <div className="flex items-center gap-1">
                             الاسم
                             {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 text-blue-600"/> : <ArrowDown className="w-4 h-4 text-blue-600"/>)}
                             {sortConfig.key !== 'name' && <ArrowUpDown className="w-4 h-4 text-gray-300"/>}
                          </div>
                      </th>
                      <th className="p-4 text-center">التخصص</th>
                      <th className="p-4 text-center">تغيير الحالة</th>
                  </tr>
              </thead>
              <tbody>
                  {sortedEmployees.map(emp => (
                      <tr key={emp.id} className="border-b hover:bg-blue-50/50 transition-all group">
                          {/* الكود والاسم يفتحان الملف */}
                          <td onClick={() => setSelectedEmp(emp)} className="p-4 font-mono font-bold text-blue-600 text-center cursor-pointer hover:underline">{emp.employee_id}</td>
                          <td onClick={() => setSelectedEmp(emp)} className="p-4 font-black group-hover:text-blue-600 transition-colors cursor-pointer">
                              <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs overflow-hidden">
                                      {emp.photo_url ? <img src={emp.photo_url} className="w-full h-full object-cover"/> : <User className="w-4 h-4"/>}
                                  </div>
                                  {emp.name}
                              </div>
                          </td>
                          <td onClick={() => setSelectedEmp(emp)} className="p-4 text-xs font-bold text-gray-500 text-center cursor-pointer">{emp.specialty}</td>
                          
                          {/* القائمة المنسدلة لتغيير الحالة */}
                          <td className="p-4 text-center">
                              <select 
                                value={emp.status || 'نشط'} 
                                onChange={(e) => updateStatus(emp.id, e.target.value)}
                                className={`px-2 py-1.5 rounded-lg text-xs font-black border-2 cursor-pointer outline-none transition-all ${
                                    emp.status === 'نشط' ? 'bg-green-50 border-green-200 text-green-700' :
                                    emp.status === 'موقوف' ? 'bg-red-50 border-red-200 text-red-700' :
                                    emp.status === 'إجازة' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                                    'bg-gray-50 border-gray-200 text-gray-700'
                                }`}
                                onClick={(e) => e.stopPropagation()} // هام: لمنع فتح الملف عند الضغط هنا
                              >
                                  <option value="نشط">نشط</option>
                                  <option value="موقوف">موقوف</option>
                                  <option value="إجازة">إجازة</option>
                                  <option value="خارج المركز">خارج المركز</option>
                              </select>
                          </td>
                      </tr>
                  ))}
                  {sortedEmployees.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-gray-400">لا توجد نتائج مطابقة</td></tr>
                  )}
              </tbody>
          </table>
      </div>
    </div>
  );
}