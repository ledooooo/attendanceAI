import React from 'react';
import { supabase } from '../../../../supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Trophy, XCircle, Award, TrendingUp, User } from 'lucide-react';

interface Props {
    onClose: () => void;
}

export default function ArcadeLeaderboard({ onClose }: Props) {
    const { data: leaderboard = [] } = useQuery({
        queryKey: ['arcade_leaderboard'],
        queryFn: async () => {
            const { data: scores } = await supabase
                .from('arcade_scores')
                .select('employee_id, points_earned, is_win, employees(name, photo_url)')
                .eq('is_win', true);
            if (!scores) return [];
            const grouped: Record<string, any> = {};
            scores.forEach(s => {
                if (!grouped[s.employee_id]) {
                    grouped[s.employee_id] = {
                        id: s.employee_id,
                        name: (s.employees as any)?.name || 'مجهول',
                        photo: (s.employees as any)?.photo_url,
                        points: 0,
                        wins: 0
                    };
                }
                grouped[s.employee_id].points += s.points_earned;
                grouped[s.employee_id].wins += 1;
            });
            return Object.values(grouped).sort((a, b) => b.points - a.points).slice(0, 10);
        }
    });

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
            onClick={onClose}
        >
            <div
                className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-[2rem] border-2 border-amber-200 shadow-2xl p-6 md:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-black text-2xl md:text-3xl text-gray-800 flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <Trophy className="w-7 h-7 text-white"/>
                        </div>
                        أبطال الألعاب
                    </h3>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 bg-white hover:bg-gray-100 rounded-xl flex items-center justify-center shadow-md transition-all active:scale-95"
                    >
                        <XCircle className="w-5 h-5 text-gray-600"/>
                    </button>
                </div>

                {leaderboard.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-amber-200">
                        <Award className="w-20 h-20 text-amber-300 mx-auto mb-4"/>
                        <p className="text-xl font-black text-gray-400 mb-2">لا يوجد فائزين حتى الآن</p>
                        <p className="text-sm text-gray-500 font-bold">كن أنت الأول! 🚀</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {leaderboard.map((user: any, idx: number) => {
                            const firstName = user.name ? user.name.split(' ')[0] : 'غير معروف';
                            return (
                                <div
                                    key={user.id}
                                    className={`flex items-center justify-between bg-white p-4 rounded-2xl border-2 transition-all hover:scale-105 hover:shadow-lg ${idx === 0 ? 'border-yellow-400 shadow-lg' : idx === 1 ? 'border-gray-300 shadow-md' : idx === 2 ? 'border-amber-300 shadow-md' : 'border-gray-100'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg text-white shadow-lg ${idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' : idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' : idx === 2 ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-violet-400 to-violet-600'}`}>
                                            {idx === 0 ? '👑' : idx + 1}
                                        </div>
                                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-white shadow-md overflow-hidden">
                                            {user.photo
                                                ? <img src={user.photo} alt={firstName} className="w-full h-full object-cover"/>
                                                : <User className="w-full h-full p-2.5 text-gray-400"/>
                                            }
                                        </div>
                                        <div>
                                            <h4 className="font-black text-base text-gray-900">{firstName}</h4>
                                            <p className="text-xs text-gray-500 font-bold flex items-center gap-1">
                                                <TrendingUp className="w-3 h-3"/> {user.wins} انتصارات
                                            </p>
                                        </div>
                                    </div>
                                    <div className="bg-gradient-to-br from-violet-500 to-fuchsia-600 px-4 py-2 rounded-xl shadow-lg border-2 border-white">
                                        <p className="font-black text-white text-lg leading-none">{user.points}</p>
                                        <p className="text-[10px] text-violet-100 font-bold text-center">نقطة</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
