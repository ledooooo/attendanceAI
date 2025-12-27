import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { LeaveRequest } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { ExcelUploadButton, downloadSample } from '../../../components/ui/ExcelUploadButton';
import { FileText, Download, CheckCircle, XCircle } from 'lucide-react';

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

export default function LeavesTab({ onRefresh }: { onRefresh: () => void }) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'معلق' | 'مقبول' | 'مرفوض'>('all');
  const [searchName, setSearchName] = useState('');
  const [searchId, setSearchId] = useState('');
  const [searchType, setTypeFilter] = useState('all');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchLeaves = async () => {
    const { data } = await supabase.from('leave_requests').select(`*, employees(name)`).order('created_at', { ascending: false });
    if (data) setRequests(data.map((r:any) => ({ ...r, employee_name: r.employees?.name })));
  };
  useEffect(() => { fetchLeaves(); }, []);

  const handleAction = async (req: any, status: 'مقبول' | 'مرفوض') => {
    if (status === 'مقبول') {
        const { data: emp } = await supabase.from('employees').select('*').eq('employee_id', req.employee_id).maybeSingle();
        if(emp) {
            const duration = Math.ceil((new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
            let updates: any = {};
            if (req.type.includes('اعتياد')) updates.remaining_annual = Math.max(0, (emp.remaining_annual || 0) - duration);
            else if (req.type.includes('عارضة')) updates.remaining_casual = Math.max(0, (emp.remaining_casual || 0) - duration);
            if (Object.keys(updates).length > 0) await supabase.from('employees').update(updates).eq('employee_id', req.employee_id);
        }
    }
    await supabase.from('leave_requests').update({ status }).eq('id', req.id);
    fetchLeaves(); onRefresh();
  };

  const handleExcelImport = async (data: any[]) => {
      setIsProcessing(true);
      try {
          const payload = data.map(row => ({
              employee_id: String(row.employee_id || row.employee_ || row['كود الموظف'] || row['ID'] || '').trim(),
              type: String(row.type || row['نوع الطلب'] || '').trim(),
              start_date: formatDateForDB(row.start_date || row['من تاريخ']),
              end_date: formatDateForDB(row.end_date || row['إلى تاريخ']),
              notes: String(row.notes || row['ملاحظات'] || '').trim()
          })).filter(r => r.employee_id && r.type && r.start_date);

          if (payload.length === 0) return alert('لا توجد بيانات صالحة');

          const { data: res, error } = await supabase.rpc('process_leaves_bulk', { payload });
          if (error) throw error;

          alert(`تقرير مزامنة الطلبات:\n- إضافة: ${res.inserted}\n- تحديث: ${res.updated}\n- تجاهل: ${res.skipped}`);
          fetchLeaves();
      } catch (e:any) {
          alert('حدث خطأ: ' + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const filteredRequests = useMemo(() => {
      return requests.filter(r => 
          (statusFilter === 'all' || r.status === statusFilter) &&
          (r.employee_name?.toLowerCase().includes(searchName.toLowerCase()) || !r.employee_name) &&
          (r.employee_id.includes(searchId)) &&
          (searchType === 'all' || r.type === searchType)
      );
  }, [requests, statusFilter, searchName, searchId, searchType]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4">
        <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <FileText className="text-blue-600 w-7 h-7"/> طلبات الإجازات والمأموريات
        </h2>
        <div className="flex gap-2">
            <button onClick={() => downloadSample('leave_requests')} className="text-gray-400 p-2" title="تحميل عينة"><Download className="w-5 h-5"/></button>
            <ExcelUploadButton onData={handleExcelImport} label={isProcessing ? "جاري الاستيراد..." : "استيراد طلبات"} />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-6 rounded-[30px] border shadow-inner">
          <Input label="اسم الموظف" value={searchName} onChange={setSearchName} placeholder="بحث بالاسم..." />
          <Input label="كود الموظف" value={searchId} onChange={setSearchId} placeholder="بحث بالكود..." />
          <Select label="نوع الطلب" options={['all', ...Array.from(new Set(requests.map(r => r.type)))]} value={searchType} onChange={setTypeFilter} />
          <div className="text-right">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">الحالة</label>
              <div className="flex bg-white p-1 rounded-xl border">
                  {['all', 'معلق', 'مقبول', 'مرفوض'].map(f => (
                      <button key={f} onClick={()=>setStatusFilter(f as any)} className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-black transition-all ${statusFilter===f?'bg-blue-600 text-white shadow-sm':'text-gray-400 hover:text-blue-600'}`}>{f==='all'?'الكل':f}</button>
                  ))}
              </div>
          </div>
      </div>

      <div className="grid gap-4">
        {filteredRequests.map(req => (
          <div key={req.id} className="p-5 bg-white border rounded-[30px] flex justify-between items-center shadow-sm hover:shadow-md transition-all">
            <div className="flex gap-4 items-center">
                <div className="bg-gray-50 p-3 rounded-2xl text-blue-600 border"><FileText className="w-6 h-6"/></div>
                <div>
                    <p className="font-black text-lg text-gray-800">{req.employee_name || 'غير معروف'}</p>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                        <span className="text-blue-600">{req.type}</span>
                        <span>•</span>
                        <span>ID: {req.employee_id}</span>
                        <span>•</span>
                        <span>من {req.start_date} إلى {req.end_date}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded-xl text-xs font-black shadow-sm ${req.status==='مقبول'?'bg-green-600 text-white':req.status==='مرفوض'?'bg-red-500 text-white':'bg-amber-500 text-white'}`}>{req.status}</span>
              {req.status === 'معلق' && (
                  <div className="flex gap-2">
                      <button onClick={() => handleAction(req, 'مقبول')} className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"><CheckCircle className="w-5 h-5"/></button>
                      <button onClick={() => handleAction(req, 'مرفوض')} className="bg-red-50 text-red-600 p-2.5 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"><XCircle className="w-5 h-5"/></button>
                  </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}