import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { LeaveRequest, Employee } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { ExcelUploadButton } from '../../../components/ui/ExcelUploadButton';
import * as XLSX from 'xlsx';
import { 
  ClipboardList, CheckCircle, XCircle, Clock, 
  Search, Filter, Download, Trash2, Edit, Save, X, UserCheck,
  ChevronRight, ChevronLeft // ✅ تم إضافة أيقونات التقليب
} from 'lucide-react';

// دالة تنسيق التاريخ
const formatDateForDB = (val: any): string | null => {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const localDate = new Date(val.getTime() - (val.getTimezoneOffset() * 60000));
    return localDate.toISOString().split('T')[0];
  }
  const num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    d.setHours(12, 0, 0, 0);
    return d.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    d.setHours(12, 0, 0, 0);
    return d.toISOString().split('T')[0];
  }
  return null;
};

export default function LeavesTab({ onRefresh }: { onRefresh?: () => void }) {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Partial<Employee>[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // حالات التعديل
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<LeaveRequest>>({});

  // فلاتر البحث
  const [fEmployee, setFEmployee] = useState('');
  const [fType, setFType] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [fMonth, setFMonth] = useState(new Date().toISOString().slice(0, 7));

  // ✅ حالات التقسيم (Pagination)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // يمكنك تغيير هذا الرقم لعدد الصفوف التي تريدها في كل صفحة

  // ✅ العودة للصفحة الأولى عند تغيير أي فلتر بحث
  useEffect(() => {
    setCurrentPage(1);
  }, [fEmployee, fType, fStatus, fMonth]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: leavesData } = await supabase
      .from('leave_requests')
      .select('*, employees(name)')
      .order('start_date', { ascending: false });

    const { data: empsData } = await supabase
      .from('employees')
      .select('id, employee_id, name');

    if (leavesData) {
      const formattedLeaves = leavesData.map(l => ({
        ...l,
        employee_name: l.employees?.name || 'غير معروف'
      }));
      setLeaves(formattedLeaves);
    }
    
    if (empsData) setEmployees(empsData);
    setLoading(false);
  };

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
      }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LeaveRequests");
    XLSX.writeFile(wb, "نموذج_طلبات_الإجازات.xlsx");
  };

  const handleExcelImport = async (data: any[]) => {
    setIsProcessing(true);
    let inserted = 0; let updated = 0; let skipped = 0;
    
    try {
        const { data: currentLeaves } = await supabase.from('leave_requests').select('*');
        const dbLeaves = currentLeaves || [];
        
        const rowsToInsert: any[] = [];
        const rowsToUpdate: any[] = [];
        const processedKeys = new Set(); 
        
        const notificationsToSave: any[] = [];
        const pushPromises: Promise<any>[] = [];

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
                type,
                start_date: startDate,
                end_date: endDate,
                backup_person: String(row['الموظف البديل'] || row.backup_person || '').trim(),
                status,
                notes: String(row['ملاحظات'] || row.notes || '').trim(),
                back_date: formatDateForDB(row['تاريخ العودة'] || row.back_date)
            };

            const existingRecord = dbLeaves.find(l => 
                l.employee_id === empId && 
                l.type === type && 
                l.start_date === startDate
            );

            if (existingRecord) {
                const isChanged = existingRecord.end_date !== payload.end_date || 
                                  existingRecord.status !== payload.status ||
                                  existingRecord.notes !== payload.notes ||
                                  existingRecord.backup_person !== payload.backup_person;
                                  
                if (isChanged) {
                    rowsToUpdate.push({ ...payload, id: existingRecord.id });
                    updated++;

                    if (existingRecord.status !== payload.status) {
                        const msg = `تم تحديث طلب إجازتك (${type}) ليكون: ${payload.status}`;
                        notificationsToSave.push({
                            user_id: empId, title: 'تحديث طلب الإجازة', message: msg, type: 'leave', is_read: false
                        });
                        pushPromises.push(
                            supabase.functions.invoke('send-push-notification', {
                                body: { userId: empId, title: 'تحديث طلب الإجازة', body: msg, url: '/staff?tab=requests-history' }
                            })
                        );
                    }
                } else {
                    skipped++;
                }
            } else {
                rowsToInsert.push(payload);
                inserted++;
            }
        }

        if (rowsToInsert.length > 0) {
            const { error: insertError } = await supabase.from('leave_requests').insert(rowsToInsert);
            if (insertError) throw insertError;
        }

        if (rowsToUpdate.length > 0) {
            const { error: updateError } = await supabase.from('leave_requests').upsert(rowsToUpdate); 
            if (updateError) throw updateError;
        }

        if (notificationsToSave.length > 0) {
            await supabase.from('notifications').insert(notificationsToSave);
            Promise.all(pushPromises).catch(e => console.error("Batch Push Error:", e));
        }

        alert(`تمت المعالجة بنجاح:\n- إضافة جديدة: ${inserted}\n- تحديث بيانات: ${updated}\n- تخطي (بدون تغيير): ${skipped}`);
        fetchData();

    } catch (err: any) {
        console.error("Import Error:", err);
        alert('حدث خطأ أثناء المعالجة: ' + (err.message || JSON.stringify(err)));
    } finally {
        setIsProcessing(false);
    }
  };
  
  const startEditing = (req: LeaveRequest) => {
    setEditingId(req.id);
    setEditFormData({ ...req });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase
      .from('leave_requests')
      .update({
        type: editFormData.type,
        start_date: editFormData.start_date,
        end_date: editFormData.end_date,
        backup_person: editFormData.backup_person,
        notes: editFormData.notes,
        back_date: editFormData.back_date
      })
      .eq('id', editingId);

    if (!error) {
      setEditingId(null);
      fetchData();
    } else {
      alert("خطأ في حفظ التعديلات");
    }
  };

  const updateStatus = async (request: LeaveRequest, newStatus: string) => {
    const { error: updateError } = await supabase.from('leave_requests').update({ status: newStatus }).eq('id', request.id);
    if (updateError) return;

    const notifTitle = 'تحديث حالة طلب الإجازة';
    const notifMsg = `تم تغيير حالة طلب الإجازة (${request.type}) لشهر ${request.start_date} إلى: ${newStatus}`;

    await supabase.from('notifications').insert({
        user_id: String(request.employee_id),
        title: notifTitle,
        message: notifMsg,
        type: 'leave',
        is_read: false
    });

    supabase.functions.invoke('send-push-notification', {
        body: {
            userId: String(request.employee_id),
            title: notifTitle,
            body: notifMsg,
            url: '/staff?tab=requests-history' 
        }
    }).catch(err => console.error("Push Error in Leaves:", err));

    fetchData();
  };
  
  const handleDelete = async (id: string) => {
    if(!confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;
    await supabase.from('leave_requests').delete().eq('id', id);
    fetchData();
  };

  // ✅ الفلترة الأساسية
  const filteredLeaves = leaves.filter(l => {
    const matchName = l.employee_name?.includes(fEmployee) || l.employee_id.includes(fEmployee);
    const matchType = fType === 'all' || l.type === fType;
    const matchStatus = fStatus === 'all' || l.status === fStatus;
    const matchMonth = l.start_date.startsWith(fMonth);
    return matchName && matchType && matchStatus && matchMonth;
  });

  // ✅ حساب بيانات الـ Pagination
  const totalPages = Math.ceil(filteredLeaves.length / itemsPerPage);
  const paginatedLeaves = filteredLeaves.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4">
        <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800">
          <ClipboardList className="w-7 h-7 text-orange-600"/> طلبات الإجازات
        </h2>
        <div className="flex gap-2">
          <button onClick={handleDownloadSample} className="bg-white text-gray-600 border px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm text-sm">
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

      {/* ✅ تعديل ارتفاع الحاوية لإظهار شريط التنقل بوضوح */}
      <div className="border rounded-[30px] bg-white shadow-sm flex flex-col">
        <div className="overflow-x-auto custom-scrollbar flex-1 min-h-[400px]">
          <table className="w-full text-sm text-right min-w-[1000px]">
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
              {/* ✅ عرض البيانات المقسمة بدلاً من كل البيانات المفلترة */}
              {paginatedLeaves.map(req => {
                const isEditing = editingId === req.id;
                const days = Math.ceil((new Date(isEditing ? editFormData.end_date! : req.end_date).getTime() - new Date(isEditing ? editFormData.start_date! : req.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
                
                return (
                  <tr key={req.id} className={`border-b transition-colors ${isEditing ? 'bg-orange-50' : 'hover:bg-orange-50/50'}`}>
                    <td className="p-4">
                      <div className="font-bold text-gray-800">{req.employee_name}</div>
                      <div className="text-xs text-gray-400 font-mono">{req.employee_id}</div>
                    </td>
                    
                    <td className="p-4">
                      {isEditing ? (
                        <select 
                          value={editFormData.type} 
                          onChange={e => setEditFormData({...editFormData, type: e.target.value})}
                          className="p-1 border rounded text-xs"
                        >
                          {['اعتيادية', 'عارضة', 'مرضي', 'مأمورية', 'بدل راحة'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      ) : (
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">{req.type}</span>
                      )}
                    </td>

                    <td className="p-4 font-mono">
                      {isEditing ? (
                        <input type="date" value={editFormData.start_date} onChange={e => setEditFormData({...editFormData, start_date: e.target.value})} className="p-1 border rounded text-xs" />
                      ) : req.start_date}
                    </td>

                    <td className="p-4 font-mono">
                      {isEditing ? (
                        <input type="date" value={editFormData.end_date} onChange={e => setEditFormData({...editFormData, end_date: e.target.value})} className="p-1 border rounded text-xs" />
                      ) : req.end_date}
                    </td>

                    <td className="p-4 font-bold text-blue-600">{days} يوم</td>
                    
                    <td className="p-4 text-gray-500">
                      {isEditing ? (
                        <input type="text" value={editFormData.backup_person || ''} onChange={e => setEditFormData({...editFormData, backup_person: e.target.value})} className="p-1 border rounded text-xs w-24" />
                      ) : (req.backup_person || '-')}
                    </td>

                    <td className="p-4 text-xs font-bold text-purple-600">
                      {req.approved_by ? <div className="flex items-center gap-1"><UserCheck className="w-3 h-3"/> {req.approved_by}</div> : '-'}
                    </td>

                    <td className="p-4 text-center">
                      <select 
                        value={req.status}
                        onChange={(e) => updateStatus(req, e.target.value)}
                        disabled={isEditing}
                        className={`px-2 py-1 rounded-lg text-xs font-bold border outline-none cursor-pointer ${
                          req.status === 'مقبول' ? 'bg-green-100 text-green-700 border-green-200' :
                          req.status === 'مرفوض' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                        }`}
                      >
                        <option value="معلق">معلق</option>
                        <option value="مقبول">مقبول</option>
                        <option value="مرفوض">مرفوض</option>
                      </select>
                    </td>

                    <td className="p-4">
                      <div className="flex gap-1">
                        {isEditing ? (
                          <>
                            <button onClick={saveEdit} className="text-green-600 hover:bg-green-100 p-2 rounded-lg transition-colors" title="حفظ">
                              <Save className="w-4 h-4"/>
                            </button>
                            <button onClick={cancelEditing} className="text-gray-400 hover:bg-gray-100 p-2 rounded-lg transition-colors" title="إلغاء">
                              <X className="w-4 h-4"/>
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEditing(req)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-colors" title="تعديل">
                              <Edit className="w-4 h-4"/>
                            </button>
                            <button onClick={() => handleDelete(req.id)} className="text-red-400 hover:bg-red-50 p-2 rounded-lg transition-colors" title="حذف">
                              <Trash2 className="w-4 h-4"/>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              
              {/* رسالة في حالة عدم وجود بيانات */}
              {paginatedLeaves.length === 0 && (
                  <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-500 font-bold">
                          لا توجد إجازات مطابقة لنتائج البحث
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ✅ شريط التنقل (Pagination UI) */}
        {filteredLeaves.length > 0 && (
          <div className="border-t bg-gray-50/80 p-4 flex flex-col sm:flex-row justify-between items-center gap-4 rounded-b-[30px]">
            <div className="text-xs font-bold text-gray-500 bg-white px-3 py-1.5 rounded-lg border shadow-sm">
              إجمالي السجلات: <span className="text-orange-600">{filteredLeaves.length}</span>
            </div>
            
            <div className="flex items-center gap-2" dir="ltr">
              {/* زر السابق (سهم يسار لأننا نعكس الاتجاه للغة العربية) */}
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 bg-white border rounded-lg hover:bg-orange-50 hover:text-orange-600 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-gray-700 transition-colors shadow-sm"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              {/* أرقام الصفحات */}
              <div className="px-4 py-1.5 bg-white border rounded-lg text-sm font-bold text-gray-700 shadow-sm flex items-center gap-1">
                <span>{currentPage}</span>
                <span className="text-gray-400 text-xs mx-1">من</span>
                <span>{totalPages}</span>
              </div>

              {/* زر التالي */}
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 bg-white border rounded-lg hover:bg-orange-50 hover:text-orange-600 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-gray-700 transition-colors shadow-sm"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
