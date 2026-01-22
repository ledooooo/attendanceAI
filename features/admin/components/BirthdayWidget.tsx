import React, { useState, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Cake, Send, Check, Search, Filter, CalendarClock } from 'lucide-react';

interface Props {
  employees: Employee[];
}

// دالة مساعدة لاستخراج التاريخ من الرقم القومي
const getBirthDateFromNationalID = (nid: string): Date | null => {
    if (!nid || nid.length !== 14) return null;
    const century = nid[0] === '2' ? '19' : '20';
    const year = century + nid.substring(1, 3);
    const month = nid.substring(3, 5);
    const day = nid.substring(5, 7);
    return new Date(`${year}-${month}-${day}`);
};

export default function BirthdayWidget({ employees }: Props) {
  const [postedMap, setPostedMap] = useState<Record<string, boolean>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all'); // الحالة الافتراضية

  // 1. استخراج الحالات المتاحة للفلتر (مثل الكود القديم)
  const availableStatuses = useMemo(() => {
    const statuses = Array.from(new Set(employees.map(e => e.status?.trim()).filter(Boolean)));
    return statuses;
  }, [employees]);

  // تعيين الفلتر الافتراضي على "نشط" إذا وجد
  React.useEffect(() => {
    if (statusFilter === 'all' && availableStatuses.length > 0) {
        const activeKey = availableStatuses.find(s => 
            s?.toLowerCase() === 'active' || s === 'نشط' || s === 'قوة فعلية'
        );
        if (activeKey) setStatusFilter(activeKey);
    }
  }, [availableStatuses]);

  const currentMonth = new Date().getMonth() + 1; // 1-12
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 2. معالجة القائمة (فلترة + حساب الأيام + ترتيب)
  const birthdayEmployees = useMemo(() => {
    return employees
      .map(emp => {
        // أ) استخراج تاريخ الميلاد
        let birthMonth = 0;
        let birthDay = 0;

        if (emp.birth_date) {
            const parts = emp.birth_date.split('-');
            if (parts.length >= 2) {
                birthMonth = parseInt(parts[1], 10);
                birthDay = parseInt(parts[2], 10);
            }
        } else if (emp.national_id) {
            const date = getBirthDateFromNationalID(emp.national_id);
            if (date) {
                birthMonth = date.getMonth() + 1;
                birthDay = date.getDate();
            }
        }

        if (birthMonth === 0) return null; // لا يوجد تاريخ

        // ب) التحقق هل هو في هذا الشهر؟
        if (birthMonth !== currentMonth) return null;

        // ج) تطبيق الفلاتر (الحالة + البحث)
        const matchStatus = statusFilter === 'all' || emp.status?.trim() === statusFilter;
        const matchSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchStatus || !matchSearch) return null;

        // د) حساب الأيام المتبقية للترتيب
        // ننشئ تاريخ لعيد الميلاد في السنة الحالية
        const bDayDate = new Date(today.getFullYear(), birthMonth - 1, birthDay);
        
        // إذا كان التاريخ قد فات (أمس مثلاً)، نعتبره العام القادم لغرض الترتيب (يوضع في الآخر)
        // أو يمكننا تركه كما هو ليظهر بالسالب، لكن الأفضل وضعه في النهاية
        let daysRemaining = Math.ceil((bDayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        // إذا فات الميعاد، نضيف 365 يوماً ليظهر في أسفل القائمة
        // أو يمكننا جعله رقماً كبيراً جداً
        const sortValue = daysRemaining < 0 ? daysRemaining + 365 : daysRemaining;

        return {
            ...emp,
            displayDay: birthDay,
            daysRemaining,
            sortValue // قيمة نستخدمها للترتيب فقط
        };
      })
      .filter((item): item is any => item !== null) // حذف الفارغ
      .sort((a, b) => a.sortValue - b.sortValue); // الترتيب حسب الأقرب للقادم

  }, [employees, currentMonth, searchTerm, statusFilter, today]);

  // 3. دالة نشر التهنئة (تم إصلاح الخطأ)
  const postBirthdayGreeting = async (emp: any) => {
    if (postedMap[emp.id]) return;
    
    setLoadingMap(prev => ({ ...prev, [emp.id]: true }));

    try {
        // ✅ تم حذف author_id لأنه غير موجود في الجدول
        const { error } = await supabase.from('news_posts').insert({
            title: `🎂 عيد ميلاد سعيد!`,
            content: `تتقدم إدارة المركز وأسرة العاملين بأحر التهاني للزميل/ة **${emp.name}** بمناسبة عيد ميلاده الموافق ${emp.displayDay} / ${currentMonth}، متمنين له عاماً مليئاً بالنجاح والسعادة! 🎉`,
            image_url: emp.photo_url || 'https://cdn-icons-png.flaticon.com/512/864/864758.png', 
            is_pinned: false
            // ❌ author_id: 'admin'  <-- تم الحذف
        });

        if (error) throw error;

        setPostedMap(prev => ({ ...prev, [emp.id]: true }));
        alert(`تم نشر تهنئة ${emp.name} بنجاح!`);

    } catch (error: any) {
        console.error(error);
        alert('فشل النشر: ' + error.message);
    } finally {
        setLoadingMap(prev => ({ ...prev, [emp.id]: false }));
    }
  };

  return (
    <div className="bg-white p-6 rounded-[30px] border shadow-sm">
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                <Cake className="w-6 h-6 text-pink-500"/> أعياد ميلاد شهر ({currentMonth})
            </h3>
            {/* فلتر الحالة */}
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <select 
                    className="bg-transparent text-xs font-bold text-gray-600 outline-none cursor-pointer"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">الكل</option>
                    {availableStatuses.map(status => (
                        <option key={status} value={status}>
                             {status === 'active' || status === 'نشط' ? '🟢 نشط' : status}
                        </option>
                    ))}
                </select>
            </div>
        </div>
        
        {/* حقل بحث سريع */}
        <div className="relative w-full">
             <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
             <input 
                type="text" 
                placeholder="بحث بالاسم..." 
                className="w-full pr-8 pl-3 py-2 bg-gray-50 rounded-xl text-xs border-none outline-none focus:ring-1 focus:ring-pink-200 transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
             />
        </div>
      </div>
      
      {birthdayEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-gray-400 py-8 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              <Cake className="w-8 h-8 mb-2 opacity-30"/>
              <p className="text-xs font-bold">لا توجد مناسبات مطابقة</p>
          </div>
      ) : (
          <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
            {birthdayEmployees.map(emp => (
              <div key={emp.id} className={`flex items-center justify-between p-3 border rounded-2xl transition-all group ${
                  emp.daysRemaining === 0 ? 'bg-pink-50 border-pink-200 ring-1 ring-pink-200' : 'border-gray-100 hover:bg-gray-50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center overflow-hidden border border-pink-200 shadow-sm relative">
                    {emp.photo_url ? (
                      <img src={emp.photo_url} alt="" className="w-full h-full object-cover"/>
                    ) : (
                      <span className="text-pink-600 font-bold text-sm">{emp.name.charAt(0)}</span>
                    )}
                    {emp.daysRemaining === 0 && (
                        <div className="absolute inset-0 bg-pink-500/20 animate-pulse"/>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm truncate max-w-[120px] md:max-w-xs">{emp.name}</h4>
                    <div className="flex items-center gap-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                            emp.daysRemaining === 0 ? 'bg-pink-500 text-white' : 
                            emp.daysRemaining > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                            <CalendarClock className="w-3 h-3"/>
                            {emp.daysRemaining === 0 ? 'اليوم!' : 
                             emp.daysRemaining > 0 ? `بعد ${emp.daysRemaining} يوم` : 'فات الميعاد'}
                        </span>
                        <span className="text-gray-400 font-medium">({emp.displayDay}/{currentMonth})</span>
                    </div>
                  </div>
                </div>

                <button
                    onClick={() => postBirthdayGreeting(emp)}
                    disabled={loadingMap[emp.id] || postedMap[emp.id]}
                    className={`p-2 rounded-xl transition-all shadow-sm shrink-0 ${
                        postedMap[emp.id] 
                        ? 'bg-green-100 text-green-600 cursor-default' 
                        : 'bg-white text-pink-500 border border-pink-100 hover:bg-pink-600 hover:text-white hover:border-pink-600 hover:shadow-md active:scale-95'
                    }`}
                    title="نشر تهنئة في الأخبار"
                >
                    {loadingMap[emp.id] ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/>
                    ) : postedMap[emp.id] ? (
                        <Check className="w-4 h-4"/>
                    ) : (
                        <Send className="w-4 h-4 rtl:rotate-180"/>
                    )}
                </button>
              </div>
            ))}
          </div>
      )}
    </div>
  );
}
