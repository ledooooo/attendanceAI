import React, { useMemo } from 'react';
import { Employee } from '../../../types';
import { supabase } from '../../../supabaseClient';
import { useQuery } from '@tanstack/react-query';

interface Props {
    employee: Employee;
}

export default function ThemeOverlay({ employee }: Props) {
    // 1. جلب الثيم العام من الإعدادات التي حددها المدير
    const { data: adminTheme = 'default' } = useQuery({
        queryKey: ['active_theme_setting'],
        queryFn: async () => {
            const { data } = await supabase
                .from('general_settings')
                .select('active_theme')
                .limit(1)
                .maybeSingle();
            return data?.active_theme || 'default';
        },
        staleTime: 1000 * 60 * 60, // تحديث الكاش كل ساعة لتقليل الاستعلامات
    });

    // 2. تحديد الثيم النهائي (أولوية لعيد الميلاد، ثم لثيم الإدارة)
    const finalTheme = useMemo(() => {
        const today = new Date();
        const month = today.getMonth() + 1; // الأشهر من 1 لـ 12
        const day = today.getDate();

        // أولوية قصوى: فحص عيد ميلاد الموظف (باستخدام الرقم القومي)
        if (employee.national_id && employee.national_id.length === 14) {
            const bMonth = parseInt(employee.national_id.substring(3, 5));
            const bDay = parseInt(employee.national_id.substring(5, 7));
            if (bMonth === month && bDay === day) return 'birthday';
        }

        // إذا لم يكن عيد ميلاده، نستخدم الثيم الذي حدده المدير من صفحة الإعدادات
        return adminTheme;
    }, [employee.national_id, adminTheme]);

    // إذا لم يكن هناك مناسبة، لا تعرض شيئاً
    if (finalTheme === 'default') return null;

    // --- التأثيرات الحركية (CSS Animations) ---
    const animations = `
        @keyframes swing {
            0%, 100% { transform: rotate(-10deg); }
            50% { transform: rotate(10deg); }
        }
        @keyframes fall {
            0% { transform: translateY(-5vh) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(360deg); opacity: 0.2; }
        }
        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
        }
        .animate-swing { animation: swing 3s ease-in-out infinite; transform-origin: top center; }
        .animate-fall { animation: fall 10s linear infinite; }
        .animate-float { animation: float 4s ease-in-out infinite; }
    `;

    return (
        <>
            <style>{animations}</style>
            
            {/* الحاوية الرئيسية: fixed لتبقى فوق الشاشة، و pointer-events-none لكي لا تمنع الضغط على الأزرار أسفلها */}
            <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
                
                {/* 🏮 ثيم رمضان: فوانيس تتدلى من الأعلى وتتأرجح */}
                {finalTheme === 'ramadan' && (
                    <div className="flex justify-around px-2 md:px-10 pt-[-10px] w-full absolute top-0">
                        {[1, 2, 3, 4, 5, 6].map((i) => {
                            // تغيير طول الحبل وحجم الفانوس بالتبادل ليعطي شكلاً واقعياً
                            const isEven = i % 2 === 0;
                            const ropeHeight = isEven ? 'h-12 md:h-16' : 'h-20 md:h-28';
                            const lanternSize = isEven ? 'w-10 md:w-14' : 'w-12 md:w-16';
                            
                            return (
                                <div key={i} className="animate-swing flex flex-col items-center" style={{ animationDelay: `${i * 0.4}s` }}>
                                    {/* 1. الحبل (تم تحسينه بلون ذهبي متدرج) */}
                                    <div className={`w-[2px] ${ropeHeight} bg-gradient-to-b from-yellow-300 to-yellow-700`}></div>
                                    
                                    {/* 2. صورة الفانوس مع تأثير التوهج الذهبي */}
                                    <img 
                                        src={isEven 
                                            ? "https://cdn-icons-png.flaticon.com/512/2386/2386822.png" // شكل الفانوس الأول
                                            : "https://cdn-icons-png.flaticon.com/512/2386/2386806.png" // شكل الفانوس الثاني
                                        } 
                                        alt="Ramadan Lantern" 
                                        className={`${lanternSize} object-contain drop-shadow-[0_15px_20px_rgba(250,204,21,0.6)]`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 🎉 ثيم عيد الميلاد: بالونات تطفو من الأسفل */}
                {finalTheme === 'birthday' && (
                    <div className="absolute inset-0 flex justify-around items-end pb-10 opacity-60">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <span key={i} className="text-6xl animate-float" style={{ animationDelay: `${i * 0.5}s` }}>
                                {i % 2 === 0 ? '🎈' : '🎁'}
                            </span>
                        ))}
                        <div className="absolute top-10 w-full text-center animate-bounce">
                            <span className="bg-white/80 backdrop-blur-sm px-6 py-2 rounded-full text-xl font-black text-pink-600 shadow-xl border-2 border-pink-200">
                                🎂 كل عام وأنت بخير يا {employee.name.split(' ')[0]}! 🎉
                            </span>
                        </div>
                    </div>
                )}

                {/* ❄️ ثيم الكريسماس: ثلج يتساقط */}
                {finalTheme === 'christmas' && (
                    <div className="absolute inset-0 flex justify-between px-4">
                        {[...Array(15)].map((_, i) => (
                            <span 
                                key={i} 
                                className="text-white text-opacity-80 text-2xl animate-fall" 
                                style={{ 
                                    animationDelay: `${Math.random() * 5}s`,
                                    animationDuration: `${5 + Math.random() * 5}s`
                                }}
                            >
                                ❄
                            </span>
                        ))}
                    </div>
                )}

                {/* 🎊 ثيم العيد: زينة وألوان */}
                {finalTheme === 'eid' && (
                    <div className="flex justify-between px-4 pt-4 w-full absolute top-0">
                        <div className="w-full text-center absolute top-5 animate-float">
                             <span className="bg-emerald-50/90 px-6 py-2 rounded-full text-lg font-black text-emerald-700 shadow-sm border border-emerald-200">
                                ✨ عيدكم مبارك ✨
                            </span>
                        </div>
                        {[...Array(8)].map((_, i) => (
                            <span key={i} className="text-3xl animate-swing" style={{ animationDelay: `${i * 0.2}s` }}>
                                {i % 2 === 0 ? '🎊' : '🎉'}
                            </span>
                        ))}
                    </div>
                )}

            </div>
        </>
    );
}
