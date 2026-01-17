import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, getBirthDateFromNationalID } from '../../../types';
import { Cake, Send, CalendarHeart, Clock, AlertCircle } from 'lucide-react';

// واجهة مساعدة لتخزين البيانات المحسوبة
interface BirthdayEmployee extends Employee {
    daysRemaining: number;
    formattedDate: string;
}

export default function BirthdayWidget({ employees }: { employees: Employee[] }) {
    const [upcomingBirthdays, setUpcomingBirthdays] = useState<BirthdayEmployee[]>([]);

    useEffect(() => {
        const processBirthdays = async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // تصفير الوقت للمقارنة الدقيقة

            const nextMonth = new Date();
            nextMonth.setDate(today.getDate() + 30);

            const list: BirthdayEmployee[] = [];

            employees.forEach(emp => {
                const birthDate = getBirthDateFromNationalID(emp.national_id);
                if (!birthDate) return;

                // إنشاء تاريخ عيد الميلاد للسنة الحالية
                const currentYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
                
                // إذا كان التاريخ قد مضى هذا العام، نحسب للعام القادم
                if (currentYearBirthday < today) {
                    currentYearBirthday.setFullYear(today.getFullYear() + 1);
                }

                // التحقق مما إذا كان في نطاق الـ 30 يوم القادمة
                if (currentYearBirthday >= today && currentYearBirthday <= nextMonth) {
                    // حساب الفرق بالأيام
                    const diffTime = currentYearBirthday.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

                    list.push({
                        ...emp,
                        daysRemaining: diffDays,
                        formattedDate: `${birthDate.getDate()} / ${birthDate.getMonth() + 1}`
                    });
                }
            });

            // 1. الترتيب حسب الأقرب (تصاعدي)
            list.sort((a, b) => a.daysRemaining - b.daysRemaining);

            setUpcomingBirthdays(list);

            // 2. إرسال تنبيه للمدير (إذا كان اليوم أو غداً)
            // نستخدم sessionStorage لمنع تكرار الإشعار في نفس الجلسة
            list.forEach(async (emp) => {
                if (emp.daysRemaining <= 1) { // اليوم (0) أو غداً (1)
                    const notificationKey = `notified_birthday_${emp.id}_${new Date().toDateString()}`;
                    
                    if (!sessionStorage.getItem(notificationKey)) {
                        // إرسال الإشعار للقاعدة
                        await supabase.from('notifications').insert({
                            user_id: 'all', // أو حدد كود المدير هنا
                            title: '🎂 تنبيه عيد ميلاد',
                            message: emp.daysRemaining === 0 
                                ? `اليوم هو عيد ميلاد ${emp.name}!` 
                                : `غداً هو عيد ميلاد ${emp.name}!`,
                            is_read: false
                        });
                        
                        // وضع علامة أنه تم التنبيه
                        sessionStorage.setItem(notificationKey, 'true');
                        console.log(`Notification sent for ${emp.name}`);
                    }
                }
            });
        };

        processBirthdays();
    }, [employees]);

    const handleCelebrate = async (emp: Employee) => {
        if(!confirm(`هل تريد نشر بوست تهنئة لـ ${emp.name}؟`)) return;

        const { error } = await supabase.from('news_posts').insert({
            title: `🎉 عيد ميلاد سعيد! 🎉`,
            content: `تتقدم إدارة المركز بخالص التهاني للزميل/ة ${emp.name} بمناسبة عيد ميلاده/ها. نتمنى لك عاماً مليئاً بالنجاح والتوفيق! 🎂🎈`,
            image_url: 'https://images.unsplash.com/photo-1464349153735-7db50ed83c84?auto=format&fit=crop&q=80&w=1000',
            is_pinned: true
        });

        if (!error) {
            alert('تم نشر التهنئة بنجاح!');
        } else {
            alert('حدث خطأ أثناء النشر');
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
                    // تحديد لون وتسمية بناءً على الأيام المتبقية
                    let remainingText = '';
                    let badgeColor = '';
                    
                    if (emp.daysRemaining === 0) {
                        remainingText = 'اليوم! 🎉';
                        badgeColor = 'bg-red-500 text-white animate-pulse';
                    } else if (emp.daysRemaining === 1) {
                        remainingText = 'غداً';
                        badgeColor = 'bg-orange-500 text-white';
                    } else {
                        remainingText = `باقي ${emp.daysRemaining} يوم`;
                        badgeColor = 'bg-pink-100 text-pink-700';
                    }

                    return (
                        <div key={emp.id} className={`bg-white p-3 rounded-2xl flex justify-between items-center shadow-sm border ${emp.daysRemaining <= 1 ? 'border-red-200 ring-2 ring-red-50' : 'border-transparent'}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold overflow-hidden">
                                    {emp.photo_url ? (
                                        <img src={emp.photo_url} alt={emp.name} className="w-full h-full object-cover"/>
                                    ) : (
                                        emp.name.charAt(0)
                                    )}
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                        {emp.name}
                                        {/* أيقونة تنبيه إذا كان اليوم أو غداً */}
                                        {emp.daysRemaining <= 1 && <AlertCircle className="w-4 h-4 text-red-500"/>}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <CalendarHeart className="w-3 h-3"/> {emp.formattedDate}
                                        </p>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${badgeColor}`}>
                                            <Clock className="w-3 h-3"/> {remainingText}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleCelebrate(emp)}
                                className="bg-pink-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-pink-700 flex items-center gap-1 transition-colors shadow-lg shadow-pink-200"
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
