import React from 'react';
import { Employee } from '../../types';
import { Star, Zap } from 'lucide-react';

export default function LevelProgressBar({ employee }: { employee: Employee }) {
    const points = employee.total_points || 0;

    // تعريف المستويات
    const levels = [
        { name: 'مبتدئ', min: 0, max: 100, color: 'text-gray-500', bg: 'bg-gray-500' },
        { name: 'برونزي', min: 100, max: 500, color: 'text-orange-700', bg: 'bg-orange-700' },
        { name: 'فضي', min: 500, max: 1500, color: 'text-gray-400', bg: 'bg-gray-400' },
        { name: 'ذهبي', min: 1500, max: 3000, color: 'text-yellow-500', bg: 'bg-yellow-500' },
        { name: 'ماسي', min: 3000, max: 10000, color: 'text-blue-500', bg: 'bg-blue-500' },
    ];

    // حساب المستوى الحالي
    const currentLevel = levels.find(l => points >= l.min && points < l.max) || levels[levels.length - 1];
    const nextLevel = levels[levels.indexOf(currentLevel) + 1];

    // حساب النسبة المئوية
    const progress = nextLevel 
        ? Math.min(100, Math.max(0, ((points - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100))
        : 100;

    return (
        <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-[2rem] p-5 text-white shadow-lg relative overflow-hidden">
            {/* خلفية جمالية */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full blur-3xl -mr-10 -mt-10"></div>
            
            <div className="relative z-10 flex justify-between items-start mb-4">
                <div>
                    <p className="text-xs text-indigo-200 font-bold mb-1">المستوى الحالي</p>
                    <h3 className={`text-2xl font-black flex items-center gap-2 ${currentLevel.name === 'ذهبي' ? 'text-yellow-400' : 'text-white'}`}>
                        <Star className="w-5 h-5 fill-current" /> {currentLevel.name}
                    </h3>
                </div>
                <div className="text-center bg-white/10 px-3 py-1 rounded-xl backdrop-blur-sm">
                    <span className="block text-xl font-black text-yellow-300">{points}</span>
                    <span className="text-[9px] text-indigo-100">مجموع النقاط</span>
                </div>
            </div>

            {/* شريط التقدم */}
            <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                    <div className="text-right">
                        <span className="text-[10px] font-semibold inline-block text-indigo-200">
                            {nextLevel ? `باقي ${nextLevel.min - points} نقطة للوصول إلى ${nextLevel.name}` : 'أنت في القمة!'}
                        </span>
                    </div>
                    <div className="text-left">
                        <span className="text-[10px] font-semibold inline-block text-indigo-200">
                            {Math.round(progress)}%
                        </span>
                    </div>
                </div>
                <div className="overflow-hidden h-2.5 mb-4 text-xs flex rounded-full bg-indigo-800 border border-indigo-700/50">
                    <div style={{ width: `${progress}%` }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-1000 ease-out bg-gradient-to-r from-blue-400 to-indigo-400`}></div>
                </div>
            </div>
            
            {/* تحفيز */}
            <div className="flex items-center gap-2 text-[10px] text-indigo-300 bg-indigo-950/30 p-2 rounded-lg">
                <Zap className="w-3 h-3 text-yellow-400" />
                <span>حل سؤال اليوم + الحضور المبكر = نقاط أكثر! 🚀</span>
            </div>
        </div>
    );
}
