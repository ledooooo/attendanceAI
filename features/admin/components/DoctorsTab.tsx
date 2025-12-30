import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { ExcelUploadButton } from '../../../components/ui/ExcelUploadButton';
import * as XLSX from 'xlsx';
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
  const [fName, setFName] = useState('');
  const [fId, setFId] = useState('');
  const [fSpec, setFSpec] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'employee_id' | null, direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [detailTab, setDetailTab] = useState('profile');
  const [empData, setEmpData] = useState<any>({ attendance: [], requests: [], evals: [], messages: [] });
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // --- دالة جلب بيانات الموظف (تم فصلها لاستخدامها عند التحديث) ---
  const fetchEmpData = async () => {
    if (!selectedEmp) return;
    const [att, req, evl, msg] = await Promise.all([
        supabase.from('attendance').select('*').eq('employee_id', selectedEmp.employee_id),
        supabase.from('leave_requests').select('*').eq('employee_id', selectedEmp.employee_id).order('created_at', { ascending: false }),
        supabase.from('evaluations').select('*').eq('employee_id', selectedEmp.employee_id).order('month', { ascending: false }),
        supabase.from('messages').select('*').or(`to_user.eq.${selectedEmp.employee_id},to_user.eq.all`).order('created_at', { ascending: false })
    ]);
    setEmpData({ attendance: att.data || [], requests: req.data || [], evals: evl.data || [], messages: msg.data || [] });
  };

  useEffect(() => {
    if (selectedEmp) {
        fetchEmpData();
    }
  }, [selectedEmp]);

  const filtered = employees.filter(e => 
    (e.name.includes(fName)) && (e.employee_id.includes(fId)) && 
    (fSpec === 'all' || e.specialty === fSpec) && (fStatus === 'all' || e.status === fStatus)
  );

  const handleSort = (key: 'name' | 'employee_id') => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
      setSortConfig({ key, direction });
  };

  const sortedEmployees = useMemo(() => {
      let sortableItems = [...filtered];
      if (sortConfig.key !== null) {
          sortableItems.sort((a, b) => {
              if (a[sortConfig.key!] < b[sortConfig.key!]) return sortConfig.direction === 'asc' ? -1 : 1;
              if (a[sortConfig.key!] > b[sortConfig.key!]) return sortConfig.direction === 'asc' ? 1 : -1;
              return 0;
          });
      }
      return sortableItems;
  }, [filtered, sortConfig]);

  const updateStatus = async (id: string, newStatus: string) => {
      await supabase.from('employees').update({ status: newStatus }).eq('id', id);
      onRefresh();
  };

  const handleDownloadSample = () => {
    // ... (نفس كود التحميل السابق) ...
    const sampleData = [
      { employee_id: '101', name: 'اسم الموظف', national_id: '29000000000000', specialty: 'طبيب عام', phone: '01000000000', email: 'employee@example.com', gender: 'ذكر', grade: 'أخصائي', photo_url: '', id_front_url: '', id_back_url: '', religion: 'مسلم', work_days: 'Sunday,Monday', start_time: '08:00', end_time: '14:00', leave_annual_balance: 21, leave_casual_balance: 7, total_absence: 0, remaining_annual: 21, remaining_casual: 7, admin_tasks: 'لا يوجد', status: 'نشط', join_date: '2023-01-01', center_id: centerId, training_courses: '', notes: '', maternity: '', role: 'user' }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "نموذج_بيانات_الموظفين.xlsx");
  };

  const handleExcelImport = async (data: any[]) => {
    // ... (نفس كود الاستيراد السابق) ...
    setIsProcessing(true);
    try {
        const payload = data.map((row) => ({
            employee_id: String(row.employee_id || row['الكود'] || '').trim(),
            name: String(row.name || row['الاسم'] || '').trim(),
            national_id: String(row.national_id || row['الرقم القومي'] || '').trim(),
            specialty: String(row.specialty || row['التخصص'] || '').trim(),
            phone: String(row.phone || row['الهاتف'] || '').trim(),
            email: String(row.email || row['البريد'] || '').trim(),
            gender: String(row.gender || '').trim(),
            grade: String(row.grade || '').trim(),
            photo_url: String(row.photo_url || '').trim(),
            id_front_url: String(row.id_front_url || '').trim(),
            id_back_url: String(row.id_back_url || '').trim(),
            religion: String(row.religion || '').trim(),
            work_days: String(row.work_days || '').trim(),
            start_time: String(row.start_time || '').trim(),
            end_time: String(row.end_time || '').trim(),
            leave_annual_balance: Number(row.leave_annual_balance) || 21,
            leave_casual_balance: Number(row.leave_casual_balance) || 7,
            total_absence: Number(row.total_absence) || 0,
            remaining_annual: Number(row.remaining_annual) || 21,
            remaining_casual: Number(row.remaining_casual) || 7,
            admin_tasks: String(row.admin_tasks || '').trim(),
            status: String(row.status || 'نشط').trim(),
            join_date: formatDateForDB(row.join_date || row['تاريخ التعيين']) || new Date().toISOString().split('T')[0],
            center_id: centerId,
            training_courses: String(row.training_courses || '').trim(),
            notes: String(row.notes || '').trim(),
            maternity: String(row.maternity || '').trim(),
            role: String(row.role || 'user').trim()
        })).filter(r => r.employee_id && r.name);

        if (payload.length === 0) return alert('لم يتم العثور على بيانات صالحة.');
        const { data: res, error } = await supabase.rpc('process_employees_bulk', { payload });
        if (error) throw error;
        alert(`تقرير العملية:\n✅ تم إضافة: ${res.inserted}\n🔄 تم تحديث: ${res.updated}\n⏭️ متطابق (تجاهل): ${res.skipped}`);
        onRefresh();
    } catch (e:any) {
        console.error(e);
        alert('حدث خطأ أثناء المعالجة: ' + e.message);
    } finally {
        setIsProcessing(false);
    }
  };

  if (selectedEmp) {
      return (
          <div className="space-y-6 animate-in slide-in-from-left duration-300">
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

              <div className="bg-white p-6 rounded-[30px] border shadow-sm min-h-[500px]">
                  {detailTab === 'profile' && <StaffProfile employee={selectedEmp} isEditable={true} onUpdate={onRefresh} />}
                  {detailTab === 'attendance' && <StaffAttendance attendance={empData.attendance} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} employee={selectedEmp} />}
                  {detailTab === 'stats' && <StaffStats attendance={empData.attendance} evals={empData.evals} requests={empData.requests} month={selectedMonth} />}
                  {detailTab === 'requests' && <StaffRequestsHistory requests={empData.requests} employee={selectedEmp} />}
                  
                  {/* هنا التحديث: تمرير isAdmin و onUpdate و employee */}
                  {detailTab === 'evals' && (
                    <StaffEvaluations 
                        evals={empData.evals} 
                        employee={selectedEmp}
                        isAdmin={true}
                        onUpdate={fetchEmpData}
                    />
                  )}
                  
                  {detailTab === 'messages' && (
                    <StaffMessages 
                        messages={empData.messages} 
                        employee={selectedEmp} 
                        currentUserId="admin" 
                    />
                  )}              
              </div>
          </div>
      );
  }

  return (
    // ... (باقي الكود الخاص بالقائمة الجدولية كما هو) ...
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4">
        <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800"><Users className="w-7 h-7 text-blue-600"/> شئون الموظفين</h2>
        <div className="flex gap-2">
            <button 
                onClick={handleDownloadSample} 
                className="bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 hover:text-blue-600 transition-all shadow-sm text-sm"
            >
                <Download className="w-4 h-4"/> تحميل نموذج شامل
            </button>
            <ExcelUploadButton onData={handleExcelImport} label={isProcessing ? "جاري المزامنة..." : "رفع ملف إكسيل"} />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-3xl border border-gray-100 shadow-inner">
          <Input label="بحث بالاسم" value={fName} onChange={setFName} placeholder="اسم الموظف..." />
          <Input label="بحث بالكود" value={fId} onChange={setFId} placeholder="كود الموظف..." />
          <Select label="التخصص" options={['all', ...Array.from(new Set(employees.map(e=>e.specialty)))]} value={fSpec} onChange={setFSpec} />
          <Select label="الحالة" options={['all', 'نشط', 'موقوف', 'إجازة', 'خارج المركز']} value={fStatus} onChange={setFStatus} />
      </div>
      
      <div className="overflow-x-auto border rounded-[30px] bg-white shadow-sm max-h-[600px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-sm text-right min-w-[800px]">
              <thead className="bg-gray-100 font-black border-b sticky top-0 z-10 text-gray-600">
                  <tr>
                      <th className="p-4 text-center cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('employee_id')}>
                          <div className="flex items-center justify-center gap-1">
                             الكود
                             {sortConfig.key === 'employee_id' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 text-blue-600"/> : <ArrowDown className="w-4 h-4 text-blue-600"/>)}
                             {sortConfig.key !== 'employee_id' && <ArrowUpDown className="w-4 h-4 text-gray-300"/>}
                          </div>
                      </th>
                      <th className="p-4 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('name')}>
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
                          <td onClick={() => setSelectedEmp(emp)} className="p-4 font-mono font-bold text-blue-600 text-center cursor-pointer hover:underline">{emp.employee_id}</td>
                          <td onClick={() => setSelectedEmp(emp)} className="p-4 font-black group-hover:text-blue-600 transition-colors cursor-pointer">
                              <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs overflow-hidden">
                                      {emp.photo_url ? <img src={emp.photo_url} className="w-full h-full object-cover" alt=""/> : <User className="w-4 h-4"/>}
                                  </div>
                                  {emp.name}
                              </div>
                          </td>
                          <td onClick={() => setSelectedEmp(emp)} className="p-4 text-xs font-bold text-gray-500 text-center cursor-pointer">{emp.specialty}</td>
                          <td className="p-4 text-center">
                              <select 
                                value={emp.status || 'نشط'} 
                                onChange={(e) => updateStatus(emp.id, e.target.value)}
                                className={`px-2 py-1.5 rounded-lg text-xs font-black border-2 cursor-pointer outline-none transition-all ${
                                    emp.status === 'نشط' ? 'bg-green-50 border-green-200 text-green-700' :
                                    emp.status === 'موقوف' ? 'bg-red-50 border-red-200 text-red-700' :
                                    'bg-gray-50 border-gray-200 text-gray-700'
                                }`}
                                onClick={(e) => e.stopPropagation()} 
                              >
                                  <option value="نشط">نشط</option>
                                  <option value="موقوف">موقوف</option>
                                  <option value="إجازة">إجازة</option>
                                  <option value="خارج المركز">خارج المركز</option>
                              </select>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>
    </div>
  );
}
