import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { ExcelUploadButton, downloadSample } from '../../../components/ui/ExcelUploadButton';
import { Eye, Download, Users, CheckCircle } from 'lucide-react';

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

  // الفلترة
  const filtered = employees.filter(e => 
    (e.name.includes(fName)) && 
    (e.employee_id.includes(fId)) && 
    (fSpec === 'all' || e.specialty === fSpec) &&
    (fStatus === 'all' || e.status === fStatus)
  );

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

        alert(`تقرير مزامنة الموظفين:\n- إضافة جديد: ${res.inserted}\n- تحديث بيانات: ${res.updated}\n- تجاهل (مطابق): ${res.skipped}`);
        onRefresh();
    } catch (e:any) {
        alert('حدث خطأ: ' + e.message);
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
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
          <Select label="الحالة" options={['all', 'نشط', 'موقوف', 'إجازة']} value={fStatus} onChange={setFStatus} />
      </div>
      
      <div className="overflow-x-auto border rounded-[30px] bg-white shadow-sm max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm text-right">
              <thead className="bg-gray-100 font-black border-b sticky top-0">
                  <tr><th className="p-4 text-center">الكود</th><th className="p-4">الاسم</th><th className="p-4 text-center">التخصص</th><th className="p-4 text-center">الحالة</th></tr>
              </thead>
              <tbody>
                  {filtered.map(emp => (
                      <tr key={emp.id} className="border-b hover:bg-blue-50/50 transition-all">
                          <td className="p-4 font-mono font-bold text-blue-600 text-center">{emp.employee_id}</td>
                          <td className="p-4 font-black">{emp.name}</td>
                          <td className="p-4 text-xs font-bold text-gray-500 text-center">{emp.specialty}</td>
                          <td className="p-4 text-center"><span className={`px-3 py-1 rounded-lg text-[10px] font-black ${emp.status==='نشط'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{emp.status}</span></td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>
    </div>
  );
}