import React from 'react';
import { Employee } from '../../types';
import { Star, Target } from 'lucide-react';

export default function LevelProgressBar({ employee }: { employee: Employee }) {
    const points = employee.total_points || 0;

    // تعريف المستويات
const levels = [
        { name: 'مبتدئ', min: 0, max: 500, color: 'text-gray-500' },
        { name: 'برونزي', min: 500, max: 1000, color: 'text-orange-700' },
        { name: 'فضي', min: 1000, max: 2000, color: 'text-slate-400' }, 
        { name: 'ذهبي', min: 2000, max: 3000, color: 'text-yellow-500' },
        { name: 'ماسي', min: 3000, max: 4000, color: 'text-blue-500' },
        { name: 'أسطوري', min: 4000, max: 1000000, color: 'text-purple-600' }, 
    ];

    // حساب المستوى الحالي
    const currentLevel = levels.find(l => points >= l.min && points < l.max) || levels[levels.length - 1];
    const nextLevel = levels[levels.indexOf(currentLevel) + 1];

    // حساب النسبة المئوية
    const progress = nextLevel 
        ? Math.min(100, Math.max(0, ((points - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100))
        : 100;

    return (
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[2rem] p-5 text-white shadow-lg relative overflow-hidden">
            {/* خلفية جمالية */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-3xl -mr-10 -mt-10"></div>
            
            <div className="relative z-10 flex justify-between items-start mb-4">
                <div>
                    <p className="text-xs text-emerald-100 font-bold mb-1">المستوى الحالي</p>
                    <h3 className={`text-2xl font-black flex items-center gap-2 ${currentLevel.name === 'ذهبي' ? 'text-yellow-300' : 'text-white'}`}>
                        <Star className="w-5 h-5 fill-current" /> {currentLevel.name}
                    </h3>
                </div>
                <div className="text-center bg-black/10 border border-white/10 px-3 py-1 rounded-xl backdrop-blur-sm">
                    <span className="block text-xl font-black text-yellow-300">{points}</span>
                    <span className="text-[9px] text-emerald-50">مجموع النقاط</span>
                </div>
            </div>

            {/* شريط التقدم */}
            <div className="relative pt-1 mb-4">
                <div className="flex mb-2 items-center justify-between">
                    <div className="text-right">
                        <span className="text-[10px] font-semibold inline-block text-emerald-100">
                            {nextLevel ? `باقي ${nextLevel.min - points} نقطة للوصول إلى ${nextLevel.name}` : 'أنت في القمة!'}
                        </span>
                    </div>
                    <div className="text-left">
                        <span className="text-[10px] font-semibold inline-block text-emerald-100">
                            {Math.round(progress)}%
                        </span>
                    </div>
                </div>
                {/* شريط التقدم بألوان متناسقة ومضيئة */}
                <div className="overflow-hidden h-2.5 flex rounded-full bg-black/20 border border-white/10 shadow-inner">
                    <div style={{ width: `${progress}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-1000 ease-out bg-gradient-to-r from-yellow-400 to-amber-300"></div>
                </div>
            </div>
            
            {/* تحفيز (النص المحدث) */}
            <div className="flex items-start gap-2 text-[10px] text-emerald-50 bg-black/10 border border-white/10 p-3 rounded-xl leading-relaxed backdrop-blur-sm">
                <Target className="w-4 h-4 text-yellow-300 shrink-0 mt-0.5" />
                <span>
                    <strong className="text-white font-black">طرق تجميع النقاط: </strong> 
                    الحضور المبكر، الزيارة اليومية، التحديات اليومية، اجتياز التدريبات، إرسال OVR، الألعاب التدريبية، تنفيذ التكليفات... وغيرها 🚀
                </span>
            </div>
        </div>
    );
}
