import React from 'react';
import { Star, Trophy, Dices, Timer, Lock, Gamepad2, Brain, Calculator } from 'lucide-react';
import { DiffProfile } from './types';

interface GameCardProps {
    onClick: () => void;
    gradient: string;
    border: string;
    glowColor: string;
    iconBg: string;
    icon: React.ReactNode;
    title: string;
    desc: string;
    tagBg: string;
    tagColor: string;
    tagText: string;
    pointsColor: string;
    pointsText: string;
}

function GameCard({ onClick, gradient, border, glowColor, iconBg, icon, title, desc, tagBg, tagColor, tagText, pointsColor, pointsText }: GameCardProps) {
    return (
        <button
            onClick={onClick}
            className={`group ${gradient} border-2 ${border} p-3 md:p-4 rounded-2xl shadow-md hover:shadow-2xl transition-all text-right flex flex-col relative overflow-hidden hover:scale-105 active:scale-95`}
        >
            <div className={`absolute top-0 right-0 w-24 h-24 ${glowColor} rounded-full blur-3xl group-hover:blur-2xl transition-all`}></div>
            <div className="relative z-10 flex flex-col h-full">
                <div className={`w-10 h-10 md:w-12 md:h-12 ${iconBg} text-white rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-3 group-hover:scale-110 group-hover:rotate-12 transition-transform shadow-lg`}>
                    {icon}
                </div>
                <h3 className="font-black text-gray-900 text-sm md:text-base mb-1 leading-tight">{title}</h3>
                <p className="text-[11px] md:text-xs text-gray-500 font-bold leading-relaxed mb-3 flex-1 hidden sm:block">{desc}</p>
                <div className="flex items-center justify-between pt-2 border-t border-opacity-30" style={{ borderColor: 'currentColor' }}>
                    <span className={`text-[10px] md:text-xs ${tagBg} ${tagColor} px-2 py-1 rounded-lg font-black shadow-sm`}>{tagText}</span>
                    <span className={`text-[10px] md:text-xs ${pointsColor} font-black flex items-center gap-0.5`}><Trophy className="w-2.5 h-2.5 md:w-3 md:h-3"/> {pointsText}</span>
                </div>
            </div>
        </button>
    );
}

interface Props {
    diffProfile: DiffProfile;
    onSelectGame: (game: string) => void;
}

export default function ArcadeGameGrid({ diffProfile, onSelectGame }: Props) {
    const GAMES = [
        {
            key: 'spin',
            gradient: 'bg-gradient-to-br from-fuchsia-50 to-pink-50',
            border: 'border-fuchsia-100 hover:border-fuchsia-300',
            glowColor: 'bg-fuchsia-200/20',
            iconBg: 'bg-gradient-to-br from-fuchsia-500 to-pink-600',
            icon: <Dices className="w-5 h-5 md:w-7 md:h-7"/>,
            title: 'عجلة الحظ',
            desc: 'لف العجلة وأجب على سؤال طبي لتفوز!',
            tagBg: 'bg-white', tagColor: 'text-fuchsia-700', tagText: 'حظ + ذكاء',
            pointsColor: 'text-fuchsia-600', pointsText: '5-30',
        },
        {
            key: 'scramble',
            gradient: 'bg-gradient-to-br from-blue-50 to-cyan-50',
            border: 'border-blue-100 hover:border-blue-300',
            glowColor: 'bg-blue-200/20',
            iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-600',
            icon: <Timer className="w-5 h-5 md:w-7 md:h-7"/>,
            title: 'فك الشفرة',
            desc: 'رتب الحروف بسرعة. النقاط تنقص كل ثانية!',
            tagBg: 'bg-white', tagColor: 'text-blue-700', tagText: 'سرعة بديهة',
            pointsColor: 'text-blue-600', pointsText: '5-20',
        },
        {
            key: 'safe',
            gradient: 'bg-gradient-to-br from-emerald-50 to-teal-50',
            border: 'border-emerald-100 hover:border-emerald-300',
            glowColor: 'bg-emerald-200/20',
            iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
            icon: <Lock className="w-5 h-5 md:w-7 md:h-7"/>,
            title: 'الخزنة السرية',
            desc: 'خمن الرقم السري في 5 محاولات بالتلميحات.',
            tagBg: 'bg-white', tagColor: 'text-emerald-700', tagText: 'ذكاء ومنطق',
            pointsColor: 'text-emerald-600', pointsText: '20',
        },
        {
            key: 'memory',
            gradient: 'bg-gradient-to-br from-orange-50 to-amber-50',
            border: 'border-orange-100 hover:border-orange-300',
            glowColor: 'bg-orange-200/20',
            iconBg: 'bg-gradient-to-br from-orange-500 to-amber-600',
            icon: <Gamepad2 className="w-5 h-5 md:w-7 md:h-7"/>,
            title: 'تطابق الذاكرة',
            desc: 'اقلب الكروت وطابق الأيقونات قبل انتهاء الوقت.',
            tagBg: 'bg-white', tagColor: 'text-orange-700', tagText: 'قوة ذاكرة',
            pointsColor: 'text-orange-600', pointsText: '20',
        },
        {
            key: 'quiz',
            gradient: 'bg-gradient-to-br from-indigo-50 to-purple-50',
            border: 'border-indigo-100 hover:border-indigo-300',
            glowColor: 'bg-indigo-200/20',
            iconBg: 'bg-gradient-to-br from-indigo-500 to-purple-600',
            icon: <Brain className="w-5 h-5 md:w-7 md:h-7"/>,
            title: 'سباق المعرفة',
            desc: 'أجب على 5 أسئلة طبية. كل ثانية = نقاط إضافية!',
            tagBg: 'bg-white', tagColor: 'text-indigo-700', tagText: 'معرفة + سرعة',
            pointsColor: 'text-indigo-600', pointsText: '5-25',
        },
        {
            key: 'dose',
            gradient: 'bg-gradient-to-br from-rose-50 to-red-50',
            border: 'border-rose-100 hover:border-rose-300',
            glowColor: 'bg-rose-200/20',
            iconBg: 'bg-gradient-to-br from-rose-500 to-red-600',
            icon: <Calculator className="w-5 h-5 md:w-7 md:h-7"/>,
            title: 'حساب الجرعات',
            desc: 'احسب الجرعات الدوائية بدقة في 3 حالات طبية!',
            tagBg: 'bg-white', tagColor: 'text-rose-700', tagText: 'دقة حسابية',
            pointsColor: 'text-rose-600', pointsText: '10-30',
        },
    ];

    return (
        <div>
            {/* بانر المستوى */}
            <div className={`mb-4 p-3 md:p-4 rounded-2xl border-2 flex items-center gap-3 ${diffProfile.color}`}>
                <span className="text-2xl md:text-3xl">{diffProfile.emoji}</span>
                <div className="flex-1 min-w-0">
                    <p className="font-black text-sm">مستواك الحالي: {diffProfile.label}</p>
                    <p className="text-xs font-bold opacity-80 truncate">{diffProfile.desc}</p>
                </div>
                <div className="text-left flex-shrink-0">
                    <p className="font-black text-lg">×{diffProfile.multiplier.toFixed(1)}</p>
                    <p className="text-xs font-bold opacity-70">مضاعف</p>
                </div>
            </div>

            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg md:text-xl font-black text-gray-800 flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500"/> اختر لعبتك
                </h3>
                <div className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-xl">
                    6 ألعاب متاحة
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                {GAMES.map(g => (
                    <GameCard key={g.key} onClick={() => onSelectGame(g.key)} {...g} />
                ))}
            </div>
        </div>
    );
}
