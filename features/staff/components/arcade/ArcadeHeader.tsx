import React from 'react';
import { Gamepad2, Clock, Trophy } from 'lucide-react';
import { Employee } from '../../../../types';
import { getDiffProfile, DiffProfile } from './types';

// ================================================
// LevelBadge
// ================================================
export function LevelBadge({ employee }: { employee: Employee }) {
    const profile = getDiffProfile(employee.total_points || 0);
    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 font-black text-xs ${profile.color}`}>
            <span>{profile.emoji}</span>
            <div>
                <span>{profile.label}</span>
                <span className="opacity-70 mr-1">× {profile.multiplier.toFixed(1)}</span>
            </div>
        </div>
    );
}

// ================================================
// ArcadeHeader
// ================================================
interface Props {
    employee: Employee;
    onShowLeaderboard: () => void;
}

export default function ArcadeHeader({ employee, onShowLeaderboard }: Props) {
    return (
        <div className="relative bg-gradient-to-br from-violet-600 via-fuchsia-600 to-purple-700 rounded-2xl p-5 text-white shadow-2xl overflow-hidden">
            <div className="absolute inset-0 opacity-10">
                <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-10 right-10 w-40 h-40 bg-fuchsia-300 rounded-full blur-3xl animate-pulse delay-700"></div>
            </div>
            <div className="relative z-10">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-2xl md:text-4xl font-black flex items-center gap-2 mb-1">
                            <Gamepad2 className="w-7 h-7 md:w-10 md:h-10 text-fuchsia-300 animate-bounce flex-shrink-0"/>
                            <span>صالة الألعاب</span>
                        </h2>
                        <p className="text-violet-100 text-xs md:text-base font-bold flex items-center gap-1 mb-2">
                            <Clock className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0"/> محاولة واحدة كل 5 ساعات
                        </p>
                        <LevelBadge employee={employee} />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={onShowLeaderboard}
                            className="bg-white bg-opacity-20 backdrop-blur-sm hover:bg-opacity-30 p-2.5 md:px-4 md:py-3 rounded-xl border border-white border-opacity-30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                        >
                            <Trophy className="w-5 h-5 text-yellow-300"/>
                            <span className="hidden md:inline text-sm font-black">الأبطال</span>
                        </button>
                        <div className="bg-white bg-opacity-20 backdrop-blur-sm px-3 py-2 md:px-6 md:py-3 rounded-xl border border-white border-opacity-30">
                            <p className="text-[10px] text-violet-200 mb-0.5">رصيدك</p>
                            <p className="text-lg md:text-2xl font-black flex items-center gap-1">
                                <Trophy className="w-4 h-4 text-yellow-300"/> {employee.total_points || 0}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
