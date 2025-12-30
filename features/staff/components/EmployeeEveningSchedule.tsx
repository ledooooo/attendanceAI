import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Moon, Calendar, FileText, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

interface EveningSchedule {
  id: string;
  date: string;
  doctors: any[]; // Array of strings OR objects
  notes: string;
}

interface Props {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
}

export default function EmployeeEveningSchedule({ employeeId, employeeCode, employeeName }: Props) {
  const [schedules, setSchedules] = useState<EveningSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (employeeId) {
        fetchMySchedule();
    }
  }, [employeeId, employeeCode, employeeName]);

  const fetchMySchedule = async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    // 1. جلب الجداول من اليوم وطالع
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

    // 2. الفلترة الذكية (Smart Matching)
    // هذه الدالة تتأكد من وجود الموظف سواء تم تخزينه كـ نص أو كائن
    const myShifts = (data || []).filter((item: EveningSchedule) => {
      let docs = item.doctors;
      
      // حماية ضد البيانات التالفة
      if (!Array.isArray(docs)) return false;

      // البحث داخل المصفوفة
      return docs.some((d: any) => {
        // تجهيز بيانات الموظف الحالي للمقارنة
        const targetId = String(employeeId || '').trim();
        const targetCode = String(employeeCode || '').trim();
        const targetName = String(employeeName || '').trim();

        // الحالة 1: البيانات الجديدة (كائنات)
        if (typeof d === 'object' && d !== null) {
          const storedId = String(d.id || '').trim();
          const storedCode = String(d.code || '').trim();
          const storedName = String(d.name || '').trim();

          // تطابق بأي وسيلة (ID هو الأقوى، ثم الكود، ثم الاسم)
          return (storedId && storedId === targetId) || 
                 (storedCode && storedCode === targetCode) || 
                 (storedName && storedName === targetName);
        }

        // الحالة 2: البيانات القديمة (نصوص)
        const val = String(d).trim();
        return val === targetName || val === targetCode || val === targetId;
      });
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

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="text-gray-400 font-medium">جاري البحث عن نوبتجياتك...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header Info */}
      <div className="flex items-center gap-4 border-b pb-4 mb-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
        <div className="bg-white p-3 rounded-full shadow-sm">
          <Moon className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-lg font-black text-gray-800">جدولك المسائي</h3>
          <p className="text-xs text-gray-500 font-bold mt-1">
            يتم عرض النوبتجيات القادمة فقط. يرجى الالتزام بالمواعيد.
          </p>
        </div>
      </div>

      {schedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-[30px] border border-dashed border-gray-300 text-center px-4">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <Moon className="w-8 h-8 text-gray-300" />
          </div>
          <h4 className="text-gray-800 font-bold text-lg">لا توجد نوبتجيات حالياً</h4>
          <p className="text-gray-500 text-sm mt-2 max-w-xs">
            لم يتم تسجيل أي نوبتجيات مسائية لك في الفترة القادمة. ستظهر هنا بمجرد إضافتها من قبل الإدارة.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {schedules.map((shift) => (
            <div key={shift.id} className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
              {/* شريط جانبي ملون */}
              <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-500 group-hover:bg-indigo-600 transition-colors"></div>
              
              <div className="flex justify-between items-start mb-4 pr-3">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-400 font-bold">التاريخ</span>
                    <span className="block text-indigo-900 font-black text-sm md:text-base">{formatDate(shift.date)}</span>
                  </div>
                </div>
                
                <div className="bg-green-50 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1 border border-green-100">
                  <CheckCircle2 className="w-3 h-3"/> مسجلة لك
                </div>
              </div>

              {shift.notes && (
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 pr-3 mb-3">
                  <p className="text-xs text-gray-500 font-bold mb-1">ملاحظات:</p>
                  <p className="text-sm text-gray-700 flex gap-2 leading-relaxed">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    {shift.notes}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400 font-mono">
                <span>REF: {shift.id.slice(0,8)}</span>
                <span className="flex items-center gap-1 font-sans font-bold text-orange-400"><AlertCircle className="w-3 h-3"/> فترة مسائية</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
