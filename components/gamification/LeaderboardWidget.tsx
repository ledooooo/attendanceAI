import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Employee } from '../../types';
import { Trophy, Medal, Crown, User } from 'lucide-react';

export default function LeaderboardWidget() {
    const [leaders, setLeaders] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaders = async () => {
            const { data } = await supabase
                .from('employees')
                .select('*')
                .gt('total_points', 0) // فقط من لديهم نقاط
                .order('total_points', { ascending: false })
                .limit(5);
            
            if (data) setLeaders(data);
            setLoading(false);
        };

        fetchLeaders();
    }, []);

    const getRankIcon = (index: number) => {
        switch (index) {
            case 0: return <Crown className="w-5 h-5 text-yellow-500 fill-yellow-500" />; // الأول
            case 1: return <Medal className="w-5 h-5 text-gray-400 fill-gray-400" />; // الثاني
            case 2: return <Medal className="w-5 h-5 text-orange-400 fill-orange-400" />; // الثالث
            default: return <span className="text-gray-500 font-bold w-5 text-center">{index + 1}</span>;
        }
    };

    return (
        <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm">
            <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" /> لوحة الشرف (Top 5)
            </h3>
            
            {loading ? (
                <div className="space-y-3">
                    {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse"></div>)}
                </div>
            ) : leaders.length === 0 ? (
                <p className="text-center text-gray-400 text-xs py-4">لا يوجد نقاط مسجلة بعد، كن الأول!</p>
            ) : (
                <div className="space-y-3">
                    {leaders.map((emp, index) => (
                        <div key={emp.id} className={`flex items-center justify-between p-2 rounded-xl border ${index === 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-100'}`}>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-6">
                                    {getRankIcon(index)}
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white border border-gray-200 overflow-hidden">
                                    {emp.photo_url ? <img src={emp.photo_url} className="w-full h-full object-cover"/> : <User className="w-full h-full p-1.5 text-gray-400"/>}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-800 truncate w-24">{emp.name.split(' ').slice(0, 2).join(' ')}</p>
                                    <p className="text-[9px] text-gray-500">{emp.specialty}</p>
                                </div>
                            </div>
                            <div className="bg-white px-2 py-1 rounded-lg shadow-sm border">
                                <span className="text-xs font-black text-indigo-600">{emp.total_points || 0}</span>
                                <span className="text-[8px] text-gray-400 mr-1">نقطة</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
