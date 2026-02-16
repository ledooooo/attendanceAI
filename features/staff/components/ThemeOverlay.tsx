import React, { useMemo, useState, useEffect } from 'react';
import { Employee } from '../../../types';
import { supabase } from '../../../supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Gift, PartyPopper, Moon, Star } from 'lucide-react';

interface Props {
    employee: Employee;
}

export default function ThemeOverlay({ employee }: Props) {
    const [showConfetti, setShowConfetti] = useState(false);

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
        staleTime: 1000 * 60 * 60,
    });

    // 2. تحديد الثيم النهائي
    const finalTheme = useMemo(() => {
        const today = new Date();
        const month = today.getMonth() + 1;
        const day = today.getDate();

        // فحص عيد ميلاد الموظف
        if (employee.national_id && employee.national_id.length === 14) {
            const bMonth = parseInt(employee.national_id.substring(3, 5));
            const bDay = parseInt(employee.national_id.substring(5, 7));
            if (bMonth === month && bDay === day) return 'birthday';
        }

        return adminTheme;
    }, [employee.national_id, adminTheme]);

    // تأثير الكونفيتي عند عيد الميلاد
    useEffect(() => {
        if (finalTheme === 'birthday') {
            setShowConfetti(true);
            const timer = setTimeout(() => setShowConfetti(false), 10000);
            return () => clearTimeout(timer);
        }
    }, [finalTheme]);

    if (finalTheme === 'default') return null;

    // --- التأثيرات الحركية المحسّنة ---
    const animations = `
        @keyframes swing {
            0%, 100% { transform: rotate(-6deg); }
            50% { transform: rotate(6deg); }
        }
        @keyframes swingHard {
            0%, 100% { transform: rotate(-11deg) scale(1); }
            50% { transform: rotate(11deg) scale(1.05); }
        }
        @keyframes fall {
            0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
            100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
        }
        @keyframes float {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-25px) rotate(5deg); }
        }
        @keyframes floatSlow {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-15px); }
        }
        @keyframes bounce-in {
            0% { transform: scale(0) rotate(-180deg); opacity: 0; }
            50% { transform: scale(1.2) rotate(10deg); }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes glow {
            0%, 100% { filter: drop-shadow(0 0 8px rgba(250,204,21,0.6)); }
            50% { filter: drop-shadow(0 0 20px rgba(250,204,21,0.9)); }
        }
        @keyframes twinkle {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.3; transform: scale(0.8); }
        }
        @keyframes confetti-fall {
            0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 0 20px rgba(236, 72, 153, 0.5); }
            50% { box-shadow: 0 0 40px rgba(236, 72, 153, 0.8); }
        }
        @keyframes shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
        }
        
        .animate-swing { animation: swing 3s ease-in-out infinite; transform-origin: top center; }
        .animate-swing-hard { animation: swingHard 2.5s ease-in-out infinite; transform-origin: top center; }
        .animate-fall { animation: fall 12s linear infinite; }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .animate-float-slow { animation: floatSlow 6s ease-in-out infinite; }
        .animate-bounce-in { animation: bounce-in 1s ease-out forwards; }
        .animate-glow { animation: glow 2s ease-in-out infinite; }
        .animate-twinkle { animation: twinkle 2s ease-in-out infinite; }
        .animate-confetti { animation: confetti-fall 5s linear infinite; }
        .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
        .shimmer-bg {
            background: linear-gradient(90deg, 
                rgba(255,255,255,0) 0%, 
                rgba(255,255,255,0.3) 50%, 
                rgba(255,255,255,0) 100%);
            background-size: 200% 100%;
            animation: shimmer 3s infinite;
        }
    `;

    return (
        <>
            <style>{animations}</style>
            
            <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
                
                {/* 🏮 ثيم رمضان المحسّن: فوانيس متطورة مع نجوم وهلال */}
                {finalTheme === 'ramadan' && (
                    <>
                        {/* خلفية سماء ليلية خفيفة */}
                        <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/5 via-purple-900/3 to-transparent pointer-events-none"></div>
                        
                        {/* نجوم متلألئة في الخلفية */}
                        <div className="absolute top-0 left-0 w-full">
                            {[...Array(12)].map((_, i) => (
                                <Star 
                                    key={i}
                                    className="absolute text-yellow-400 animate-twinkle"
                                    style={{
                                        left: `${Math.random() * 100}%`,
                                        top: `${Math.random() * 30}%`,
                                        width: `${12 + Math.random() * 12}px`,
                                        height: `${12 + Math.random() * 12}px`,
                                        animationDelay: `${Math.random() * 3}s`,
                                        opacity: 0.6 + Math.random() * 0.4
                                    }}
                                />
                            ))}
                        </div>

                        {/* هلال رمضان مع رسالة رمضان كريم */}
                        <div className="absolute top-6 md:top-10 right-6 md:right-12 flex items-center gap-3 animate-float-slow">
                            <Moon className="w-10 h-10 md:w-12 md:h-12 text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]" />
                            <span className="text-sm md:text-base font-black bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent drop-shadow-lg">
                                رمضان كريم
                            </span>
                        </div>

                        {/* الفوانيس المحسّنة */}
                        <div className="flex justify-around px-2 md:px-10 w-full absolute top-0">
                            {[1, 2, 3, 4, 5, 6].map((i) => {
                                const isEven = i % 2 === 0;
                                // تصغير الحبل بمقدار الربع (من h-16/h-24 إلى h-12/h-18)
                                const ropeHeight = isEven ? 'h-12 md:h-18' : 'h-18 md:h-24';
                                // تصغير الفانوس بمقدار الثلث تقريباً (من w-12/w-16 إلى w-8/w-11)
                                const lanternSize = isEven ? 'w-8 md:w-11' : 'w-9 md:w-13';
                                
                                return (
                                    <div 
                                        key={i} 
                                        className={`${isEven ? 'animate-swing' : 'animate-swing-hard'} flex flex-col items-center`} 
                                        style={{ animationDelay: `${i * 0.3}s` }}
                                    >
                                        {/* الحبل المحسّن */}
                                        <div className={`w-[3px] ${ropeHeight} bg-gradient-to-b from-yellow-200 via-yellow-400 to-yellow-600 rounded-full shadow-sm`}></div>
                                        
                                        {/* الفانوس مع توهج محسّن */}
                                        <div className="relative animate-bounce-in" style={{ animationDelay: `${i * 0.2}s` }}>
                                            <img 
                                                src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjfI9u7voEn02bukifDWCgR1S4pMUd58kSKsVAz8HPMgBRXZpQM2BeYZWy1Rf_vVLWWbRERdkpggQQKvtVR7hDtAiYvzJnN-52i2OvDD5eYxOiYjkPr8HYMy9ReOTpU-IX-pmWSvIpGM8X9s7rZpMPsoBqlOhhXrWBXCa1A0dGAb_6lqzhEkyAr6Vqdq2uK/s320/Ramadan%20%281%29.png"
                                                alt="Ramadan Lantern" 
                                                className={`${lanternSize} object-contain animate-glow`}
                                            />
                                            {/* توهج إضافي */}
                                            <div className="absolute inset-0 bg-yellow-300/20 blur-xl rounded-full"></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* 🎉 ثيم عيد الميلاد المحسّن: احتفال كامل */}
                {finalTheme === 'birthday' && (
                    <>
                        {/* خلفية احتفالية خفيفة */}
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-100/20 via-purple-100/20 to-blue-100/20"></div>

                        {/* كونفيتي متساقط */}
                        {showConfetti && (
                            <div className="absolute inset-0">
                                {[...Array(30)].map((_, i) => {
                                    const colors = ['bg-pink-500', 'bg-purple-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500', 'bg-red-500'];
                                    const shapes = ['w-2 h-6 rounded-full', 'w-3 h-3 rounded-full', 'w-4 h-1 rounded'];
                                    
                                    return (
                                        <div
                                            key={i}
                                            className={`absolute animate-confetti ${colors[Math.floor(Math.random() * colors.length)]} ${shapes[Math.floor(Math.random() * shapes.length)]}`}
                                            style={{
                                                left: `${Math.random() * 100}%`,
                                                top: '-10vh',
                                                animationDelay: `${Math.random() * 3}s`,
                                                animationDuration: `${4 + Math.random() * 3}s`
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        )}

                        {/* رسالة عيد الميلاد الرئيسية */}
                        <div className="absolute top-12 md:top-20 left-1/2 transform -translate-x-1/2 z-10 animate-bounce-in">
                            <div className="relative">
                                {/* توهج خلفي */}
                                <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-500 blur-2xl opacity-50 rounded-full animate-pulse-glow"></div>
                                
                                {/* البطاقة */}
                                <div className="relative bg-gradient-to-br from-white to-pink-50 backdrop-blur-lg px-8 py-4 md:px-12 md:py-6 rounded-3xl shadow-2xl border-4 border-pink-300">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="flex items-center gap-2 text-3xl md:text-4xl">
                                            <span className="animate-bounce">🎂</span>
                                            <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>🎉</span>
                                            <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>🎊</span>
                                        </div>
                                        <h2 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
                                            كل سنة وأنت طيب!
                                        </h2>
                                        <p className="text-xl md:text-2xl font-black text-pink-600">
                                            {employee.name.split(' ')[0]} 💖
                                        </p>
                                        <div className="flex gap-1 mt-2">
                                            {[...Array(5)].map((_, i) => (
                                                <Sparkles 
                                                    key={i} 
                                                    className="w-4 h-4 text-yellow-500 animate-twinkle" 
                                                    style={{ animationDelay: `${i * 0.2}s` }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* بالونات وهدايا متحركة */}
                        <div className="absolute inset-0 flex justify-around items-end pb-10 px-4">
                            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                                <div key={i} className="flex flex-col items-center gap-2">
                                    {/* البالون */}
                                    <span 
                                        className="text-5xl md:text-6xl animate-float drop-shadow-lg" 
                                        style={{ animationDelay: `${i * 0.4}s` }}
                                    >
                                        {i % 3 === 0 ? '🎈' : i % 3 === 1 ? '🎁' : '🎀'}
                                    </span>
                                    {/* الخيط */}
                                    {i % 3 === 0 && (
                                        <div className="w-[2px] h-12 md:h-20 bg-gradient-to-b from-pink-400 to-transparent"></div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* أيقونات طائرة إضافية */}
                        <div className="absolute top-1/3 left-8 animate-float">
                            <Gift className="w-12 h-12 md:w-16 md:h-16 text-pink-500 drop-shadow-xl" />
                        </div>
                        <div className="absolute top-1/2 right-8 animate-float" style={{ animationDelay: '1s' }}>
                            <PartyPopper className="w-12 h-12 md:w-16 md:h-16 text-purple-500 drop-shadow-xl" />
                        </div>
                    </>
                )}

                {/* ❄️ ثيم الكريسماس المحسّن: ثلج واقعي */}
                {finalTheme === 'christmas' && (
                    <>
                        {/* خلفية شتوية */}
                        <div className="absolute inset-0 bg-gradient-to-b from-blue-100/10 to-transparent"></div>

                        {/* ثلج متساقط بأحجام مختلفة */}
                        <div className="absolute inset-0">
                            {[...Array(25)].map((_, i) => {
                                const size = ['text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'][Math.floor(Math.random() * 5)];
                                
                                return (
                                    <span 
                                        key={i} 
                                        className={`absolute text-white ${size} animate-fall drop-shadow-md`}
                                        style={{ 
                                            left: `${Math.random() * 100}%`,
                                            top: '-10vh',
                                            animationDelay: `${Math.random() * 8}s`,
                                            animationDuration: `${8 + Math.random() * 8}s`,
                                            opacity: 0.7 + Math.random() * 0.3
                                        }}
                                    >
                                        ❄
                                    </span>
                                );
                            })}
                        </div>

                        {/* رسالة كريسماس */}
                        <div className="absolute top-10 left-1/2 transform -translate-x-1/2 animate-float">
                            <div className="bg-gradient-to-r from-red-600 to-green-600 text-white px-8 py-3 rounded-full font-black text-lg md:text-xl shadow-2xl border-2 border-white">
                                <span className="flex items-center gap-2">
                                    ❄️ Merry Christmas! 🎄
                                </span>
                            </div>
                        </div>

                        {/* شجرة كريسماس صغيرة */}
                        <div className="absolute bottom-8 right-8 md:bottom-12 md:right-16 text-6xl md:text-8xl animate-float-slow drop-shadow-2xl">
                            🎄
                        </div>
                    </>
                )}

                {/* 🎊 ثيم العيد المحسّن: احتفال مبهج */}
                {finalTheme === 'eid' && (
                    <>
                        {/* خلفية احتفالية */}
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-100/10 via-teal-100/10 to-green-100/10"></div>

                        {/* رسالة العيد الرئيسية */}
                        <div className="absolute top-12 md:top-16 left-1/2 transform -translate-x-1/2 z-10 animate-bounce-in">
                            <div className="relative">
                                <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-40 rounded-full"></div>
                                <div className="relative bg-gradient-to-br from-white to-emerald-50 backdrop-blur-lg px-10 py-5 rounded-3xl shadow-2xl border-4 border-emerald-300">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            {[...Array(5)].map((_, i) => (
                                                <Sparkles 
                                                    key={i} 
                                                    className="w-6 h-6 text-emerald-500 animate-twinkle" 
                                                    style={{ animationDelay: `${i * 0.15}s` }}
                                                />
                                            ))}
                                        </div>
                                        <h2 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                                            عيد مبارك
                                        </h2>
                                        <p className="text-lg font-bold text-emerald-700">
                                            كل عام وأنتم بخير 🌙
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* زينة العيد المتحركة */}
                        <div className="flex justify-between px-4 md:px-8 pt-6 w-full absolute top-0">
                            {[...Array(10)].map((_, i) => (
                                <span 
                                    key={i} 
                                    className={`text-3xl md:text-4xl ${i % 2 === 0 ? 'animate-swing' : 'animate-swing-hard'} drop-shadow-lg`}
                                    style={{ animationDelay: `${i * 0.2}s` }}
                                >
                                    {i % 3 === 0 ? '🎊' : i % 3 === 1 ? '🎉' : '✨'}
                                </span>
                            ))}
                        </div>

                        {/* هلال ونجمة العيد */}
                        <div className="absolute bottom-12 left-8 md:left-16 animate-float-slow">
                            <div className="flex items-center gap-2 text-5xl md:text-6xl drop-shadow-2xl">
                                <span className="animate-twinkle">⭐</span>
                                <span className="animate-float" style={{ animationDelay: '0.5s' }}>🌙</span>
                            </div>
                        </div>
                    </>
                )}

            </div>
        </>
    );
}
