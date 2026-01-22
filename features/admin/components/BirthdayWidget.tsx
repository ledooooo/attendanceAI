import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Cake, Send, Check } from 'lucide-react';

interface Props {
  employees: Employee[];
}

export default function BirthdayWidget({ employees }: Props) {
  const [postedMap, setPostedMap] = useState<Record<string, boolean>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  // 1. تحديد موالين هذا الشهر
  const currentMonth = new Date().getMonth() + 1;
  const birthdayEmployees = employees.filter(emp => {
    if (!emp.birth_date) return false;
    const birthMonth = new Date(emp.birth_date).getMonth() + 1;
    return birthMonth === currentMonth;
  });

  // 2. دالة نشر التهنئة
  const postBirthdayGreeting = async (emp: Employee) => {
    if (postedMap[emp.id]) return;
    
    setLoadingMap(prev => ({ ...prev, [emp.id]: true }));

    try {
        const { error } = await supabase.from('news_posts').insert({
            title: `🎂 عيد ميلاد سعيد!`,
            content: `تتقدم إدارة المركز وأسرة العاملين بأحر التهاني للزميل/ة **${emp.name}** بمناسبة عيد ميلاده، متمنين له عاماً مليئاً بالنجاح والسعادة! 🎉`,
            image_url: emp.photo_url || 'https://cdn-icons-png.flaticon.com/512/864/864758.png', // صورة الكيكة الافتراضية
            is_pinned: false,
            author_id: 'admin'
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

  if (birthdayEmployees.length === 0) {
      return (
          <div className="bg-white p-6 rounded-[30px] border shadow-sm flex flex-col items-center justify-center text-gray-400 py-10">
              <Cake className="w-10 h-10 mb-2 opacity-50"/>
              <p>لا توجد أعياد ميلاد هذا الشهر</p>
          </div>
      );
  }

  return (
    <div className="bg-white p-6 rounded-[30px] border shadow-sm">
      <h3 className="text-xl font-black text-gray-800 mb-4 flex items-center gap-2">
        <Cake className="w-6 h-6 text-pink-500"/> أعياد ميلاد هذا الشهر ({currentMonth})
      </h3>
      
      <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
        {birthdayEmployees.map(emp => (
          <div key={emp.id} className="flex items-center justify-between p-3 border rounded-2xl hover:bg-pink-50 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center overflow-hidden border border-pink-200">
                {emp.photo_url ? (
                  <img src={emp.photo_url} alt="" className="w-full h-full object-cover"/>
                ) : (
                  <span className="text-pink-600 font-bold">{emp.name.charAt(0)}</span>
                )}
              </div>
              <div>
                <h4 className="font-bold text-gray-800 text-sm">{emp.name}</h4>
                <p className="text-xs text-gray-500">{new Date(emp.birth_date).getDate()} / {currentMonth}</p>
              </div>
            </div>

            <button
                onClick={() => postBirthdayGreeting(emp)}
                disabled={loadingMap[emp.id] || postedMap[emp.id]}
                className={`p-2 rounded-xl transition-all ${
                    postedMap[emp.id] 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-pink-100 text-pink-600 hover:bg-pink-600 hover:text-white'
                }`}
                title="نشر تهنئة"
            >
                {postedMap[emp.id] ? <Check className="w-4 h-4"/> : <Send className="w-4 h-4 rtl:rotate-180"/>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
