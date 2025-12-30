import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, getBirthDateFromNationalID } from '../../../types';
import { Cake, Send, CalendarHeart } from 'lucide-react';

export default function BirthdayWidget({ employees }: { employees: Employee[] }) {
    const [upcomingBirthdays, setUpcomingBirthdays] = useState<Employee[]>([]);

    useEffect(() => {
        const today = new Date();
        const nextMonth = new Date();
        nextMonth.setDate(today.getDate() + 30); // البحث في الـ 30 يوم القادمة

        const list = employees.filter(emp => {
            const birthDate = getBirthDateFromNationalID(emp.national_id);
            if (!birthDate) return false;

            // ضبط السنة للسنة الحالية للمقارنة
            const currentYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
            
            // إذا كان عيد الميلاد قد مر هذا العام، نفحص العام القادم (نهاية السنة)
            if (currentYearBirthday < today) {
                currentYearBirthday.setFullYear(today.getFullYear() + 1);
            }

            return currentYearBirthday >= today && currentYearBirthday <= nextMonth;
        });

        setUpcomingBirthdays(list);
    }, [employees]);

    const handleCelebrate = async (emp: Employee) => {
        if(!confirm(`هل تريد نشر بوست تهنئة لـ ${emp.name}؟`)) return;

        const { error } = await supabase.from('news_posts').insert({
            title: `🎉 عيد ميلاد سعيد! 🎉`,
            content: `تتقدم إدارة المركز بخالص التهاني للزميل/ة ${emp.name} بمناسبة عيد ميلاده/ها. نتمنى لك عاماً مليئاً بالنجاح والتوفيق! 🎂🎈`,
            image_url: 'https://images.unsplash.com/photo-1464349153735-7db50ed83c84?auto=format&fit=crop&q=80&w=1000', // صورة كيكة احتفالية
            is_pinned: true
        });

        if (!error) {
            alert('تم نشر التهنئة بنجاح!');
        }
    };

    if (upcomingBirthdays.length === 0) return null;

    return (
        <div className="bg-gradient-to-br from-pink-50 to-red-50 p-6 rounded-[30px] border border-pink-100 shadow-sm animate-in slide-in-from-top-5">
            <h3 className="text-lg font-black text-pink-700 mb-4 flex items-center gap-2">
                <Cake className="w-6 h-6"/> أعياد الميلاد القادمة
            </h3>
            <div className="space-y-3">
                {upcomingBirthdays.map(emp => {
                     const birthDate = getBirthDateFromNationalID(emp.national_id);
                     const dateStr = birthDate ? `${birthDate.getDate()}/${birthDate.getMonth() + 1}` : '';
                     
                     return (
                        <div key={emp.id} className="bg-white p-3 rounded-2xl flex justify-between items-center shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold">
                                    {emp.name.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 text-sm">{emp.name}</h4>
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <CalendarHeart className="w-3 h-3"/> {dateStr}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleCelebrate(emp)}
                                className="bg-pink-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-pink-700 flex items-center gap-1 transition-colors"
                            >
                                <Send className="w-3 h-3"/> تهنئة
                            </button>
                        </div>
                     );
                })}
            </div>
        </div>
    );
}
