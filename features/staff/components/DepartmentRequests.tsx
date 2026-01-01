import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, LeaveRequest } from '../../../types';
import { CheckCircle2, XCircle, Clock, User, FileText, Check, X } from 'lucide-react';

export default function DepartmentRequests({ hod }: { hod: Employee }) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // جلب الطلبات الخاصة بالموظفين في نفس التخصص (القسم)
  const fetchDeptRequests = async () => {
    setLoading(true);
    try {
      // 1. جلب الموظفين الذين في نفس التخصص (باستثناء رئيس القسم نفسه)
      const { data: deptEmployees } = await supabase
        .from('employees')
        .select('employee_id')
        .eq('specialty', hod.specialty)
        .neq('employee_id', hod.employee_id);

      if (!deptEmployees || deptEmployees.length === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      const empIds = deptEmployees.map(e => e.employee_id);

      // 2. جلب الطلبات "قيد الانتظار" لهؤلاء الموظفين
      const { data: reqs } = await supabase
        .from('leave_requests')
        .select('*')
        .in('employee_id', empIds)
        .eq('status', 'قيد الانتظار') // عرض المعلق فقط لاتخاذ إجراء
        .order('created_at', { ascending: false });

      // 3. جلب أسماء الموظفين لدمجها مع الطلبات (اختياري للتحسين)
      const { data: empsDetails } = await supabase
        .from('employees')
        .select('employee_id, name')
        .in('employee_id', empIds);

      const enrichedRequests = (reqs || []).map(r => {
        const emp = empsDetails?.find(e => e.employee_id === r.employee_id);
        return { ...r, employee_name: emp ? emp.name : r.employee_id };
      });

      setRequests(enrichedRequests);
    } catch (error) {
      console.error("Error fetching dept requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeptRequests();
  }, [hod]);

  // دالة اتخاذ القرار (قبول/رفض)
  const handleAction = async (id: string, status: 'مقبول' | 'مرفوض') => {
    if (!confirm(`هل أنت متأكد من ${status === 'مقبول' ? 'قبول' : 'رفض'} هذا الطلب؟`)) return;

    const { error } = await supabase
      .from('leave_requests')
      .update({ status: status }) // تحديث الحالة
      .eq('id', id);

    if (!error) {
      // تحديث القائمة محلياً
      setRequests(prev => prev.filter(r => r.id !== id));
      alert(`تم ${status === 'مقبول' ? 'قبول' : 'رفض'} الطلب بنجاح`);
    } else {
      alert('حدث خطأ أثناء التحديث');
    }
  };

  if (loading) return <div className="text-center p-10 text-gray-500">جاري تحميل طلبات القسم...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-3 bg-purple-50 p-4 rounded-2xl border border-purple-100">
        <div className="bg-white p-2 rounded-xl shadow-sm">
           <FileText className="w-6 h-6 text-purple-600"/>
        </div>
        <div>
           <h3 className="font-black text-gray-800 text-lg">إدارة قسم {hod.specialty}</h3>
           <p className="text-xs text-gray-500 font-bold">لديك {requests.length} طلبات معلقة للمراجعة</p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-[30px] border border-dashed border-gray-200">
           <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4"/>
           <p className="text-gray-500 font-bold">لا توجد طلبات معلقة في القسم حالياً</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map(req => (
            <div key={req.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
               <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                     <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-500"/>
                     </div>
                     <div>
                        <h4 className="font-bold text-gray-800 text-sm">{req.employee_name}</h4>
                        <span className="text-[10px] text-gray-400 font-mono">{req.created_at?.split('T')[0]}</span>
                     </div>
                  </div>
                  <span className="bg-yellow-50 text-yellow-600 text-[10px] font-bold px-2 py-1 rounded-lg border border-yellow-100">
                     {req.type}
                  </span>
               </div>

               <div className="flex items-center gap-4 text-xs text-gray-600 bg-gray-50 p-3 rounded-xl mb-4">
                  <div className="flex items-center gap-1">
                     <Clock className="w-3 h-3 text-blue-500"/>
                     <span>من: <span className="font-bold font-mono">{req.start_date}</span></span>
                  </div>
                  <div className="flex items-center gap-1">
                     <Clock className="w-3 h-3 text-red-500"/>
                     <span>إلى: <span className="font-bold font-mono">{req.end_date}</span></span>
                  </div>
               </div>

               {req.notes && (
                 <p className="text-xs text-gray-500 mb-4 bg-gray-50 p-2 rounded-lg border border-gray-100">
                    "{req.notes}"
                 </p>
               )}

               <div className="flex gap-2 pt-2 border-t border-gray-50">
                  <button 
                    onClick={() => handleAction(req.id, 'مقبول')}
                    className="flex-1 bg-green-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-green-700 flex items-center justify-center gap-1 transition-colors"
                  >
                     <Check className="w-3 h-3"/> قبول
                  </button>
                  <button 
                    onClick={() => handleAction(req.id, 'مرفوض')}
                    className="flex-1 bg-red-50 text-red-600 border border-red-100 py-2 rounded-xl text-xs font-bold hover:bg-red-100 flex items-center justify-center gap-1 transition-colors"
                  >
                     <X className="w-3 h-3"/> رفض
                  </button>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
