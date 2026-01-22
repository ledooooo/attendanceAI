import React, { useState, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Cake, Send, Check, Search, Filter } from 'lucide-react';

interface Props {
  employees: Employee[];
}

// دالة مساعدة لاستخراج تاريخ الميلاد من الرقم القومي المصري
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

  // 1. حساب المواليد (يدعم حقل birth_date و national_id)
  const currentMonth = new Date().getMonth() + 1; // 1-12
  
  const birthdayEmployees = useMemo(() => {
    return employees.filter(emp => {
        let birthMonth = 0;
        let birthDay = 0;

        // المحاولة الأولى: من حقل birth_date المباشر
        if (emp.birth_date) {
            const parts = emp.birth_date.split('-');
            if (parts.length >= 2) {
                birthMonth = parseInt(parts[1], 10);
                birthDay = parseInt(parts[2], 10);
            }
        } 
        // المحاولة الثانية: من الرقم القومي إذا فشلت الأولى
        else if (emp.national_id) {
            const date = getBirthDateFromNationalID(emp.national_id);
            if (date) {
                birthMonth = date.getMonth() + 1;
                birthDay = date.getDate();
            }
        }

        // الفلترة: نفس الشهر + تطابق البحث
        const isSameMonth = birthMonth === currentMonth;
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
        
        // نضيف خاصية اليوم للعرض
        (emp as any).displayDay = birthDay; 

        return isSameMonth && matchesSearch;
    }).sort((a, b) => ((a as any).displayDay || 0) - ((b as any).displayDay || 0));
  }, [employees, currentMonth, searchTerm]);

  // 2. دالة نشر التهنئة
  const postBirthdayGreeting = async (emp: Employee) => {
    if (postedMap[emp.id]) return;
    
    setLoadingMap(prev => ({ ...prev, [emp.id]: true }));

    try {
        const { error } = await supabase.from('news_posts').insert({
            title: `🎂 عيد ميلاد سعيد!`,
            content: `تتقدم إدارة المركز وأسرة العاملين بأحر التهاني للزميل/ة **${emp.name}** بمناسبة عيد ميلاده الموافق ${ (emp as any).displayDay } / ${currentMonth}، متمنين له عاماً مليئاً بالنجاح والسعادة! 🎉`,
            image_url: emp.photo_url || 'https://cdn-icons-png.flaticon.com/512/864/864758.png', 
            is_pinned: false,
            author_id: 'admin' // أو user.id إذا كان متوفراً
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <Cake className="w-6 h-6 text-pink-500"/> أعياد ميلاد شهر ({currentMonth})
        </h3>
        
        {/* حقل بحث سريع */}
        <div className="relative w-full sm:w-48">
             <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
             <input 
                type="text" 
                placeholder="بحث..." 
                className="w-full pr-8 pl-3 py-1.5 bg-gray-50 rounded-xl text-xs border-none outline-none focus:ring-1 focus:ring-pink-200"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
             />
        </div>
      </div>
      
      {birthdayEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-gray-400 py-8 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              <Cake className="w-8 h-8 mb-2 opacity-30"/>
              <p className="text-xs font-bold">لا توجد مناسبات هذا الشهر</p>
          </div>
      ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
            {birthdayEmployees.map(emp => (
              <div key={emp.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-2xl hover:bg-pink-50 hover:border-pink-100 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center overflow-hidden border border-pink-200 shadow-sm">
                    {emp.photo_url ? (
                      <img src={emp.photo_url} alt="" className="w-full h-full object-cover"/>
                    ) : (
                      <span className="text-pink-600 font-bold text-sm">{emp.name.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm">{emp.name}</h4>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {(emp as any).displayDay} / {currentMonth}
                        </span>
                        <span className="truncate max-w-[100px]">{emp.specialty}</span>
                    </div>
                  </div>
                </div>

                <button
                    onClick={() => postBirthdayGreeting(emp)}
                    disabled={loadingMap[emp.id] || postedMap[emp.id]}
                    className={`p-2 rounded-xl transition-all shadow-sm ${
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
