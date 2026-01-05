// src/features/admin/components/LeavesTab.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { LeaveRequest, Employee } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { ExcelUploadButton } from '../../../components/ui/ExcelUploadButton';
import * as XLSX from 'xlsx';
import { 
  ClipboardList, CheckCircle, XCircle, Clock, 
  Search, Filter, Download, Trash2, Edit, Save, X, UserCheck, Send, MessageSquare 
} from 'lucide-react';

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
  const [employees, setEmployees] = useState<Employee[]>([]);
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
      .select('*, employees(name, specialty)')
      .order('start_date', { ascending: false });

    // جلب قائمة الموظفين
    const { data: empsData } = await supabase
      .from('employees')
      .select('*');

    if (leavesData) {
      const formattedLeaves = leavesData.map(l => ({
        ...l,
        employee_name: l.employees?.name || 'غير معروف',
        employee_specialty: l.employees?.specialty
      }));
      setLeaves(formattedLeaves as any); // cast as any لتفادي أخطاء الربط المعقدة مؤقتاً
    }
    
    if (empsData) setEmployees(empsData);
    setLoading(false);
  };

  const handleDownloadSample = () => {
    const sampleData = [
      {
        'كود الموظف': '101', 'نوع الإجازة': 'اعتيادية',
        'تاريخ البداية': '2023-10-01', 'تاريخ النهاية': '2023-10-05',
        'الموظف البديل': 'أحمد علي', 'الحالة': 'مقبول',
        'ملاحظات': 'ظروف خاصة', 'تاريخ العودة': '2023-10-06'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LeaveRequests");
    XLSX.writeFile(wb, "نموذج_طلبات_الإجازات.xlsx");
  };

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
            const status = ['مقبول', 'مرفوض', 'معلق', 'موافقة_رئيس_القسم'].includes(statusRaw) ? statusRaw : 'معلق';
            
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
                l.employee_id === empId && l.type === type && l.start_date === startDate
            );

            if (existingRecord) {
                const isChanged = existingRecord.status !== payload.status;
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

        alert(`تقرير المعالجة:\n✅ تم إضافة: ${inserted}\n🔄 تم تحديث: ${updated}\n⏭️ تم تجاهل: ${skipped}`);
        fetchData();
        if (onRefresh) onRefresh();

    } catch (err: any) {
        alert('حدث خطأ أثناء المعالجة: ' + err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  const filteredLeaves = leaves.filter(l => {
      const matchName = l.employee_name?.includes(fEmployee) || l.employee_id.includes(fEmployee);
      const matchType = fType === 'all' || l.type === fType;
      const matchStatus = fStatus === 'all' || l.status === fStatus || (fStatus === 'قيد الانتظار' && l.status === 'موافقة_رئيس_القسم');
      const matchMonth = l.start_date.startsWith(fMonth);
      return matchName && matchType && matchStatus && matchMonth;
  });

  const handleDelete = async (id: string) => {
      if(!confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;
      await supabase.from('leave_requests').delete().eq('id', id);
      fetchData();
  };

  const updateStatus = async (request: LeaveRequest, newStatus: string) => {
      const { error: updateError } = await supabase
          .from('leave_requests')
          .update({ status: newStatus })
          .eq('id', request.id);

      if (updateError) {
          alert('حدث خطأ أثناء تحديث الحالة');
          return;
      }

      await supabase.from('notifications').insert({
          user_id: request.employee_id,
          title: 'تحديث حالة طلب الإجازة',
          message: `تم تغيير حالة طلبك (${request.type}) إلى: ${newStatus}`,
          is_read: false
      });

      // هنا قمنا باستخدام (as any) لحل مشكلة النوع التي ظهرت في الـ Build
      setLeaves(prev => prev.map(l => l.id === request.id ? { ...l, status: newStatus as any } : l));
  };

  // إرسال رسالة لرئيس القسم
  const sendToHoD = async (request: any) => {
      if (!confirm('هل تريد إرسال تفاصيل هذا الطلب لرئيس القسم المختص؟')) return;

      const hod = employees.find(e => 
          e.specialty === request.employee_specialty && 
          e.role === 'head_of_dept'
      );

      if (!hod) {
          alert(`لم يتم العثور على رئيس قسم لتخصص: ${request.employee_specialty || 'غير محدد'}`);
          return;
      }

      const messageContent = `
          يرجى مراجعة طلب الإجازة التالي:
          - الموظف: ${request.employee_name} (${request.employee_id})
          - النوع: ${request.type}
          - المدة: من ${request.start_date} إلى ${request.end_date}
          - ملاحظات: ${request.notes || 'لا يوجد'}
          الرجاء الإفادة بالرأي.
      `.trim();

      const { error } = await supabase.from('messages').insert({
          from_user: 'admin',
          to_user: hod.employee_id,
          content: messageContent,
          is_read: false
      });

      if (!error) {
          alert(`تم إرسال الرسالة بنجاح إلى د. ${hod.name}`);
      } else {
          alert('فشل الإرسال: ' + error.message);
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4">
            <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800">
                <ClipboardList className="w-7 h-7 text-orange-600"/> طلبات الإجازات
            </h2>
            <div className="flex gap-2">
                <button onClick={handleDownloadSample} className="bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 hover:text-orange-600 transition-all shadow-sm text-sm">
                    <Download className="w-4 h-4"/> نموذج العينة
                </button>
                <ExcelUploadButton onData={handleExcelImport} label={isProcessing ? "جاري المعالجة..." : "رفع ومزامنة"} />
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-3xl border border-gray-100 shadow-inner">
            <Input label="بحث (اسم/كود)" value={fEmployee} onChange={setFEmployee} placeholder="اسم الموظف..." />
            <Input type="month" label="الشهر" value={fMonth} onChange={setFMonth} />
            <Select label="نوع الإجازة" options={['all', 'اعتيادية', 'عارضة', 'مرضي', 'مأمورية', 'بدل راحة']} value={fType} onChange={setFType} />
            <Select label="الحالة" options={['all', 'مقبول', 'مرفوض', 'معلق']} value={fStatus} onChange={setFStatus} />
        </div>

        <div className="overflow-x-auto border rounded-[30px] bg-white shadow-sm max-h-[600px] custom-scrollbar">
            <table className="w-full text-sm text-right min-w-[1100px]">
                <thead className="bg-gray-100 font-black border-b sticky top-0 z-10 text-gray-600">
                    <tr>
                        <th className="p-4">الموظف</th>
                        <th className="p-4">النوع</th>
                        <th className="p-4">من</th>
                        <th className="p-4">إلى</th>
                        <th className="p-4">المدة</th>
                        <th className="p-4">البديل</th>
                        <th className="p-4">بواسطة</th>
                        <th className="p-4 text-center">الحالة</th>
                        <th className="p-4">إجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredLeaves.map(req => {
                        const days = Math.ceil((new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        const isHodApproved = req.status === 'موافقة_رئيس_القسم';

                        return (
                            <tr key={req.id} className={`border-b transition-colors ${isHodApproved ? 'bg-blue-50/60' : 'hover:bg-orange-50/50'}`}>
                                <td className="p-4">
                                    <div className="font-bold text-gray-800">{req.employee_name}</div>
                                    <div className="text-xs text-gray-400 font-mono">{req.employee_id}</div>
                                    <div className="text-[10px] text-indigo-400">{req.employee_specialty}</div>
                                </td>
                                <td className="p-4">
                                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">{req.type}</span>
                                </td>
                                <td className="p-4 font-mono">{req.start_date}</td>
                                <td className="p-4 font-mono">{req.end_date}</td>
                                <td className="p-4 font-bold text-blue-600">{days} يوم</td>
                                <td className="p-4 text-gray-500">{req.backup_person || '-'}</td>
                                
                                <td className="p-4 text-xs font-bold text-purple-600">
                                    {req.approved_by ? (
                                        <div className="flex items-center gap-1" title="تمت الموافقة المبدئية بواسطة">
                                            <UserCheck className="w-3 h-3"/> {req.approved_by}
                                        </div>
                                    ) : '-'}
                                </td>

                                <td className="p-4 text-center">
                                    <div className="relative">
                                        {isHodApproved && (
                                            <span className="absolute -top-3 right-0 bg-blue-100 text-blue-700 text-[9px] px-1.5 rounded-full font-bold border border-blue-200 shadow-sm z-10">
                                                موصى به
                                            </span>
                                        )}
                                        <select 
                                            value={req.status === 'موافقة_رئيس_القسم' ? 'معلق' : req.status}
                                            onChange={(e) => updateStatus(req, e.target.value)}
                                            className={`w-full px-2 py-1.5 rounded-lg text-xs font-bold border outline-none cursor-pointer ${
                                                req.status === 'مقبول' ? 'bg-green-100 text-green-700 border-green-200' :
                                                req.status === 'مرفوض' ? 'bg-red-100 text-red-700 border-red-200' :
                                                isHodApproved ? 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-200' :
                                                'bg-yellow-100 text-yellow-700 border-yellow-200'
                                            }`}
                                        >
                                            <option value="معلق">
                                                {isHodApproved ? 'موافقة رئيس القسم (انتظار)' : 'معلق (انتظار)'}
                                            </option>
                                            <option value="مقبول">اعتماد نهائي (مقبول)</option>
                                            <option value="مرفوض">رفض نهائي</option>
                                        </select>
                                    </div>
                                </td>
                                <td className="p-4 flex gap-2 justify-end">
                                    <button 
                                        onClick={() => sendToHoD(req)}
                                        className="text-indigo-500 hover:text-indigo-700 p-2 hover:bg-indigo-50 rounded-lg transition-colors tooltip"
                                        title="إرسال لرئيس القسم"
                                    >
                                        <Send className="w-4 h-4 rtl:rotate-180"/>
                                    </button>
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
