import React, { useMemo } from 'react';
import { Employee } from '../../../types';

interface Props {
    employee: Employee;
}

export default function ThemeOverlay({ employee }: Props) {
    // 1. تحديد الثيم المناسب بناءً على التاريخ أو بيانات الموظف
    const activeTheme = useMemo(() => {
        const today = new Date();
        const month = today.getMonth() + 1; // الأشهر من 1 لـ 12
        const day = today.getDate();

        // أ) فحص عيد ميلاد الموظف (باستخدام الرقم القومي)
        if (employee.national_id && employee.national_id.length === 14) {
            const bMonth = parseInt(employee.national_id.substring(3, 5));
            const bDay = parseInt(employee.national_id.substring(5, 7));
            if (bMonth === month && bDay === day) return 'birthday';
        }

        // ب) فحص الكريسماس ورأس السنة (مثلاً من 25 ديسمبر لـ 7 يناير)
        if ((month === 12 && day >= 25) || (month === 1 && day <= 7)) return 'christmas';

        // ج) فحص رمضان (تحتاج لتحديث التواريخ سنوياً لأنها هجرية)
        // مثال تقريبي لرمضان 2026 (من 18 فبراير إلى 19 مارس)
        if ((month === 2 && day >= 18) || (month === 3 && day <= 19)) return 'ramadan';

        // د) فحص عيد الفطر (تقريبي لعام 2026)
        if (month === 3 && day >= 20 && day <= 23) return 'eid';

        return 'default';
    }, [employee.national_id]);

    // إذا لم يكن هناك مناسبة، لا تعرض شيئاً
    if (activeTheme === 'default') return null;

    // --- التأثيرات الحركية (CSS Animations) ---
    // نقوم بحقنها هنا لتعمل مباشرة بدون تعديل ملفات الـ CSS الخارجية
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
                {activeTheme === 'ramadan' && (
                    <div className="flex justify-between px-10 pt-[-10px] w-full absolute top-0">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="animate-swing flex flex-col items-center" style={{ animationDelay: \`\${i * 0.3}s\` }}>
                                <div className="w-0.5 h-16 bg-yellow-600/50"></div>
                                <span className="text-4xl drop-shadow-[0_0_10px_rgba(252,211,77,0.8)]">🏮</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* 🎉 ثيم عيد الميلاد: بالونات تطفو من الأسفل */}
                {activeTheme === 'birthday' && (
                    <div className="absolute inset-0 flex justify-around items-end pb-10 opacity-60">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <span key={i} className="text-6xl animate-float" style={{ animationDelay: \`\${i * 0.5}s\` }}>
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
                {activeTheme === 'christmas' && (
                    <div className="absolute inset-0 flex justify-between px-4">
                        {[...Array(15)].map((_, i) => (
                            <span 
                                key={i} 
                                className="text-white text-opacity-80 text-2xl animate-fall" 
                                style={{ 
                                    animationDelay: \`\${Math.random() * 5}s\`,
                                    animationDuration: \`\${5 + Math.random() * 5}s\`
                                }}
                            >
                                ❄
                            </span>
                        ))}
                    </div>
                )}

                {/* 🎊 ثيم العيد: زينة وألوان */}
                {activeTheme === 'eid' && (
                    <div className="flex justify-between px-4 pt-4 w-full absolute top-0">
                        <div className="w-full text-center absolute top-5 animate-float">
                             <span className="bg-emerald-50/90 px-6 py-2 rounded-full text-lg font-black text-emerald-700 shadow-sm border border-emerald-200">
                                ✨ عيدكم مبارك ✨
                            </span>
                        </div>
                        {[...Array(8)].map((_, i) => (
                            <span key={i} className="text-3xl animate-swing" style={{ animationDelay: \`\${i * 0.2}s\` }}>
                                {i % 2 === 0 ? '🎊' : '🎉'}
                            </span>
                        ))}
                    </div>
                )}

            </div>
        </>
    );
}
