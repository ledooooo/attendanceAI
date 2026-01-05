import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { LeaveRequest, Employee } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { ExcelUploadButton } from '../../../components/ui/ExcelUploadButton';
import * as XLSX from 'xlsx';
import { 
  ClipboardList, CheckCircle, XCircle, Clock, 
  Search, Filter, Download, Trash2, Edit, Save, X, UserCheck 
} from 'lucide-react';

// دالة تنسيق التاريخ
const formatDateForDB = (val: any): string | null => {
  if (!val) return null;

  // 1️⃣ إذا كان Date Object صالح
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val.toISOString().split('T')[0];
  }

  // 2️⃣ تحويل إلى نص للمعالجة
  const str = String(val).trim();

  // 3️⃣ محاولة التحويل المباشر (يدعم "Sunday, July 06, 2025" و "2025-07-06")
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {}

  // 4️⃣ التعامل مع Excel Serial Numbers فقط
  const num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    // معادلة Excel الصحيحة (UTC لتجنب مشاكل التوقيت)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // 30 ديسمبر 1899
    const jsDate = new Date(excelEpoch.getTime() + num * 86400000);
    return jsDate.toISOString().split('T')[0];
  }

  // 5️⃣ التعامل مع التنسيق DD/MM/YYYY أو DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  return null;
};
export default function LeavesTab({ onRefresh }: { onRefresh?: () => void }) {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Partial<Employee>[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // فلاتر البحث
  const [fEmployee, setFEmployee] = useState('');
  const [fType, setFType] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [fMonth, setFMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // جلب الإجازات مع بيانات الموظفين
    const { data: leavesData } = await supabase
      .from('leave_requests')
      .select('*, employees(name)')
      .order('start_date', { ascending: false });

    // جلب قائمة الموظفين (لربط الأسماء عند الرفع)
    const { data: empsData } = await supabase
      .from('employees')
      .select('id, employee_id, name');

    if (leavesData) {
      // دمج اسم الموظف مع الطلب لتسهيل العرض
      const formattedLeaves = leavesData.map(l => ({
        ...l,
        employee_name: l.employees?.name || 'غير معروف'
      }));
      setLeaves(formattedLeaves);
    }
    
    if (empsData) setEmployees(empsData);
    setLoading(false);
  };

  // --- 1. تحميل نموذج العينة ---
  const handleDownloadSample = () => {
    const sampleData = [
      {
        'كود الموظف': '101',
        'نوع الإجازة': 'اعتيادية',
        'تاريخ البداية': '2023-10-01',
        'تاريخ النهاية': '2023-10-05',
        'الموظف البديل': 'أحمد علي',
        'الحالة': 'مقبول',
        'ملاحظات': 'ظروف خاصة',
        'تاريخ العودة': '2023-10-06'
      },
      {
        'كود الموظف': '102',
        'نوع الإجازة': 'عارضة',
        'تاريخ البداية': '2023-10-10',
        'تاريخ النهاية': '2023-10-10',
        'الموظف البديل': '',
        'الحالة': 'معلق',
        'ملاحظات': '',
        'تاريخ العودة': '2023-10-11'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LeaveRequests");
    XLSX.writeFile(wb, "نموذج_طلبات_الإجازات.xlsx");
  };

  // --- 2. معالجة الرفع الذكي ---
  const handleExcelImport = async (data: any[]) => {
    setIsProcessing(true);
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    try {
        const { data: currentLeaves } = await supabase.from('leave_requests').select('*');
        const dbLeaves = currentLeaves || [];

        const rowsToUpsert: any[] = [];
        const processedKeys = new Set(); 

        for (const row of data) {
            const empId = String(row['كود الموظف'] || row.employee_id || '').trim();
            const type = String(row['نوع الإجازة'] || row.type || '').trim();
            const startDate = formatDateForDB(row['تاريخ البداية'] || row.start_date);
            
            if (!empId || !type || !startDate) continue;

            const rowKey = `${empId}_${type}_${startDate}`;
            if (processedKeys.has(rowKey)) continue; 
            processedKeys.add(rowKey);

            const endDate = formatDateForDB(row['تاريخ النهاية'] || row.end_date) || startDate;
            const statusRaw = String(row['الحالة'] || row.status || 'معلق').trim();
            const status = ['مقبول', 'مرفوض', 'معلق'].includes(statusRaw) ? statusRaw : 'معلق';
            
            const payload = {
                employee_id: empId,
                type: type,
                start_date: startDate,
                end_date: endDate,
                backup_person: String(row['الموظف البديل'] || row.backup_person || '').trim(),
                status: status,
                notes: String(row['ملاحظات'] || row.notes || '').trim(),
                back_date: formatDateForDB(row['تاريخ العودة'] || row.back_date)
            };

            const existingRecord = dbLeaves.find(l => 
                l.employee_id === empId && 
                l.type === type && 
                l.start_date === startDate
            );

            if (existingRecord) {
                const isChanged = 
                    existingRecord.end_date !== payload.end_date ||
                    existingRecord.status !== payload.status ||
                    existingRecord.backup_person !== payload.backup_person ||
                    existingRecord.notes !== payload.notes ||
                    (payload.back_date && existingRecord.back_date !== payload.back_date);

                if (isChanged) {
                    rowsToUpsert.push({ ...payload, id: existingRecord.id });
                    updated++;
                } else {
                    skipped++;
                }
            } else {
                rowsToUpsert.push(payload);
                inserted++;
            }
        }

        if (rowsToUpsert.length > 0) {
            const { error } = await supabase.from('leave_requests').upsert(rowsToUpsert);
            if (error) throw error;
        }

        alert(`تقرير المعالجة:\n✅ تم إضافة: ${inserted}\n🔄 تم تحديث: ${updated}\n⏭️ تم تجاهل (متطابق): ${skipped}`);
        fetchData();
        if (onRefresh) onRefresh();

    } catch (err: any) {
        console.error(err);
        alert('حدث خطأ أثناء المعالجة: ' + err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // تصفية البيانات للعرض
  const filteredLeaves = leaves.filter(l => {
      const matchName = l.employee_name?.includes(fEmployee) || l.employee_id.includes(fEmployee);
      const matchType = fType === 'all' || l.type === fType;
      const matchStatus = fStatus === 'all' || l.status === fStatus;
      const matchMonth = l.start_date.startsWith(fMonth);
      return matchName && matchType && matchStatus && matchMonth;
  });

  // حذف طلب
  const handleDelete = async (id: string) => {
      if(!confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;
      await supabase.from('leave_requests').delete().eq('id', id);
      fetchData();
  };

  // --- تحديث الحالة مع إرسال إشعار للموظف ---
  const updateStatus = async (request: LeaveRequest, newStatus: string) => {
      // 1. تحديث حالة الطلب في قاعدة البيانات
      const { error: updateError } = await supabase
          .from('leave_requests')
          .update({ status: newStatus })
          .eq('id', request.id);

      if (updateError) {
          alert('حدث خطأ أثناء تحديث الحالة');
          return;
      }

      // 2. إرسال إشعار للموظف
      const { error: notifError } = await supabase
          .from('notifications')
          .insert({
              user_id: request.employee_id, // إرسال للكود الوظيفي
              title: 'تحديث حالة طلب الإجازة',
              message: `تم تغيير حالة طلب الإجازة (${request.type}) لشهر ${request.start_date} إلى: ${newStatus}`,
              is_read: false
          });

      if (notifError) {
          console.error("فشل إرسال الإشعار:", notifError);
      }

      // 3. تحديث البيانات في الشاشة
      fetchData();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4">
            <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800">
                <ClipboardList className="w-7 h-7 text-orange-600"/> طلبات الإجازات
            </h2>
            <div className="flex gap-2">
                <button 
                    onClick={handleDownloadSample} 
                    className="bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 hover:text-orange-600 transition-all shadow-sm text-sm"
                >
                    <Download className="w-4 h-4"/> نموذج العينة
                </button>
                <ExcelUploadButton onData={handleExcelImport} label={isProcessing ? "جاري المعالجة..." : "رفع ومزامنة"} />
            </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-3xl border border-gray-100 shadow-inner">
            <Input label="بحث (اسم/كود)" value={fEmployee} onChange={setFEmployee} placeholder="اسم الموظف..." />
            <Input type="month" label="الشهر" value={fMonth} onChange={setFMonth} />
            <Select label="نوع الإجازة" options={['all', 'اعتيادية', 'عارضة', 'مرضي', 'مأمورية', 'بدل راحة']} value={fType} onChange={setFType} />
            <Select label="الحالة" options={['all', 'مقبول', 'مرفوض', 'معلق']} value={fStatus} onChange={setFStatus} />
        </div>

        {/* Table */}
        <div className="overflow-x-auto border rounded-[30px] bg-white shadow-sm max-h-[600px] custom-scrollbar">
            <table className="w-full text-sm text-right min-w-[1000px]">
                <thead className="bg-gray-100 font-black border-b sticky top-0 z-10 text-gray-600">
                    <tr>
                        <th className="p-4">الموظف</th>
                        <th className="p-4">النوع</th>
                        <th className="p-4">من</th>
                        <th className="p-4">إلى</th>
                        <th className="p-4">المدة</th>
                        <th className="p-4">البديل</th>
                        <th className="p-4">بواسطة</th> {/* العمود الجديد */}
                        <th className="p-4 text-center">الحالة</th>
                        <th className="p-4">إجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredLeaves.map(req => {
                        const days = Math.ceil((new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        return (
                            <tr key={req.id} className="border-b hover:bg-orange-50/50 transition-colors">
                                <td className="p-4">
                                    <div className="font-bold text-gray-800">{req.employee_name}</div>
                                    <div className="text-xs text-gray-400 font-mono">{req.employee_id}</div>
                                </td>
                                <td className="p-4">
                                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">{req.type}</span>
                                </td>
                                <td className="p-4 font-mono">{req.start_date}</td>
                                <td className="p-4 font-mono">{req.end_date}</td>
                                <td className="p-4 font-bold text-blue-600">{days} يوم</td>
                                <td className="p-4 text-gray-500">{req.backup_person || '-'}</td>
                                
                                {/* عرض اسم من قام بالموافقة */}
                                <td className="p-4 text-xs font-bold text-purple-600">
                                    {req.approved_by ? (
                                        <div className="flex items-center gap-1">
                                            <UserCheck className="w-3 h-3"/> {req.approved_by}
                                        </div>
                                    ) : '-'}
                                </td>

                                <td className="p-4 text-center">
                                    <select 
                                        value={req.status}
                                        onChange={(e) => updateStatus(req, e.target.value)}
                                        className={`px-2 py-1 rounded-lg text-xs font-bold border outline-none cursor-pointer ${
                                            req.status === 'مقبول' ? 'bg-green-100 text-green-700 border-green-200' :
                                            req.status === 'مرفوض' ? 'bg-red-100 text-red-700 border-red-200' :
                                            'bg-yellow-100 text-yellow-700 border-yellow-200'
                                        }`}
                                    >
                                        <option value="معلق">معلق</option>
                                        <option value="مقبول">مقبول</option>
                                        <option value="مرفوض">مرفوض</option>
                                        <option value="قيد الانتظار">قيد الانتظار</option>
                                    </select>
                                </td>
                                <td className="p-4 flex gap-2">
                                    <button onClick={() => handleDelete(req.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors">
                                        <Trash2 className="w-4 h-4"/>
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    {filteredLeaves.length === 0 && (
                        <tr><td colSpan={9} className="p-8 text-center text-gray-400">لا توجد طلبات مطابقة</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );
}
