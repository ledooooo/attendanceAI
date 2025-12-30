import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Moon, Calendar, FileText, AlertCircle, Clock } from 'lucide-react';

interface EveningSchedule {
  id: string;
  date: string;
  doctors: any; // JSON column
  notes: string;
}

export default function EmployeeEveningSchedule({ employeeId, employeeCode }: { employeeId: string, employeeCode: string }) {
  const [schedules, setSchedules] = useState<EveningSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMySchedule();
  }, [employeeId]);

  const fetchMySchedule = async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    // 1. جلب الجداول من اليوم وطالع (المستقبلية)
    const { data, error } = await supabase
      .from('evening_schedules')
      .select('*')
      .gte('date', today) 
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching schedules:', error);
      setLoading(false);
      return;
    }

    // 2. الفلترة: هل الموظف موجود داخل مصفوفة doctors؟
    // نفترض أن JSON يخزن إما مصفوفة IDs ["101", "102"] أو كائنات [{id: "101", name: ".."}]
    const myShifts = (data || []).filter((item: EveningSchedule) => {
      const docs = item.doctors;
      
      if (!docs) return false;

      // حالة 1: المصفوفة تحتوي على نصوص مباشرة (أكواد الموظفين)
      if (Array.isArray(docs) && typeof docs[0] === 'string') {
        return docs.includes(employeeId) || docs.includes(employeeCode);
      }

      // حالة 2: المصفوفة تحتوي على كائنات (نبحث داخل خاصية id أو employee_id)
      if (Array.isArray(docs) && typeof docs[0] === 'object') {
        return docs.some((d: any) => 
            String(d.id) === String(employeeId) || 
            String(d.employee_id) === String(employeeCode) ||
            String(d.code) === String(employeeCode)
        );
      }

      return false;
    });

    setSchedules(myShifts);
    setLoading(false);
  };

  // تنسيق التاريخ للعربية
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) return <div className="text-center py-10 text-gray-400">جاري تحميل الجدول...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 border-b pb-4 mb-4">
        <div className="bg-indigo-100 p-2 rounded-xl">
          <Moon className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-xl font-black text-gray-800">نوبتجيات المسائي</h3>
          <p className="text-xs text-gray-500">جدول نوبتجياتك القادمة في العيادة المسائية</p>
        </div>
      </div>

      {schedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-300">
          <Moon className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-bold">لا توجد نوبتجيات مسائية مسجلة لك قريباً</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {schedules.map((shift) => (
            <div key={shift.id} className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500 group-hover:bg-indigo-600 transition-colors"></div>
              
              <div className="flex justify-between items-start mb-4 pr-3">
                <div className="flex items-center gap-2 text-indigo-700 font-black text-lg">
                  <Calendar className="w-5 h-5" />
                  {formatDate(shift.date)}
                </div>
                <div className="bg-indigo-50 text-indigo-600 text-xs px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3"/> مسائي
                </div>
              </div>

              {shift.notes && (
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 pr-3">
                  <p className="text-sm text-gray-600 flex gap-2">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    {shift.notes}
                  </p>
                </div>
              )}

              <div className="mt-4 pt-3 border-t flex justify-between items-center text-xs text-gray-400">
                <span>تم الجدول: {new Date(shift.date).toLocaleDateString('en-GB')}</span>
                <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3"/> تأكد من الحضور</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
