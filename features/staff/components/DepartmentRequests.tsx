import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { CheckCircle, XCircle, Clock, FileText, User } from 'lucide-react';

interface LeaveRequest {
  id: string;
  employee_id: string;
  type: string;
  start_date: string;
  end_date: string;
  status: 'قيد الانتظار' | 'مقبول' | 'مرفوض';
  notes: string;
  created_at: string;
  // تم التعديل هنا: نطلب التخصص بدلاً من القسم
  employee?: { name: string; specialty: string }; 
}

export default function DepartmentRequests({ hod }: { hod: Employee }) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDepartmentRequests();
  }, [hod]);

  const fetchDepartmentRequests = async () => {
    setLoading(true);
    
    // تم التعديل: جلب specialty بدلاً من department
    // ومقارنة التخصص بتخصص رئيس القسم (hod.specialty)
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, employee:employees!inner(name, specialty)')
      .eq('status', 'قيد الانتظار') 
      .eq('employee.specialty', hod.specialty) // <--- التعديل هنا
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error:', error);
    } else {
      setRequests(data as any);
    }
    setLoading(false);
  };

  const handleAction = async (id: string, newStatus: 'مقبول' | 'مرفوض') => {
    const confirmMsg = newStatus === 'مقبول' ? 'هل توافق على الطلب؟' : 'هل تريد رفض الطلب؟';
    if (!confirm(confirmMsg)) return;

    const { error } = await supabase
      .from('leave_requests')
      .update({ 
        status: newStatus,
        notes: `تم ${newStatus} بواسطة رئيس القسم ${hod.name}`
      })
      .eq('id', id);

    if (!error) {
      alert(`تم ${newStatus} بنجاح`);
      fetchDepartmentRequests(); 
    } else {
      alert('حدث خطأ');
    }
  };

  if (loading) return <div className="text-center py-10">جاري تحميل طلبات القسم...</div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center gap-3 border-b pb-4">
        <div className="bg-purple-100 p-2 rounded-xl">
          <FileText className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          {/* تم التعديل: عرض التخصص */}
          <h3 className="text-xl font-black text-gray-800">طلبات قسم ({hod.specialty})</h3>
          <p className="text-xs text-gray-500">إدارة الإجازات والطلبات الخاصة بأطباء القسم</p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed text-gray-400">
          لا توجد طلبات معلقة في القسم حالياً
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600">
                    <User className="w-5 h-5"/>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800">{req.employee?.name}</h4>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {req.type}
                    </span>
                  </div>
                </div>
                <div className="text-left text-xs text-gray-500">
                  {new Date(req.created_at).toLocaleDateString('ar-EG')}
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mb-4 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">من:</span>
                  <span className="font-bold">{req.start_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">إلى:</span>
                  <span className="font-bold">{req.end_date}</span>
                </div>
                {req.notes && (
                   <p className="mt-2 pt-2 border-t text-gray-600 text-xs">{req.notes}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => handleAction(req.id, 'مقبول')}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-xl font-bold text-sm hover:bg-emerald-700 flex justify-center items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4"/> موافقة
                </button>
                <button 
                  onClick={() => handleAction(req.id, 'مرفوض')}
                  className="flex-1 bg-red-50 text-red-600 py-2 rounded-xl font-bold text-sm hover:bg-red-100 flex justify-center items-center gap-2"
                >
                  <XCircle className="w-4 h-4"/> رفض
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
