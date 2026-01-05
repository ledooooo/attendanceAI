import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, EOMCycle, EOMNominee } from '../../../types';
import { Trophy, ThumbsUp, CheckCircle2, Star } from 'lucide-react';

interface EnrichedNominee extends EOMNominee {
    employee_name?: string;
    specialty?: string;
    admin_tasks?: string;
    photo_url?: string;
}

export default function EOMVotingCard({ employee }: { employee: Employee }) {
    const [cycle, setCycle] = useState<EOMCycle | null>(null);
    const [nominees, setNominees] = useState<EnrichedNominee[]>([]);
    const [hasVoted, setHasVoted] = useState(false);
    const [loading, setLoading] = useState(true);

    const getPhotoUrlFromBucket = (empId: string) => {
        const { data } = supabase.storage.from('staff-photos').getPublicUrl(`${empId}.jpg`);
        return data.publicUrl;
    };

    useEffect(() => {
        fetchVotingStatus();
    }, []);

    const fetchVotingStatus = async () => {
        try {
            setLoading(true);
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            const { data: cyc } = await supabase.from('eom_cycles')
                .select('*')
                .eq('month', currentMonth)
                .eq('status', 'voting')
                .maybeSingle();
            
            if (cyc) {
                setCycle(cyc);
                const { data: noms } = await supabase.from('eom_nominees').select('*').eq('cycle_id', cyc.id);

                if (noms && noms.length > 0) {
                    const employeeIds = noms.map(n => n.employee_id);
                    const { data: emps } = await supabase.from('employees')
                        .select('employee_id, name, specialty, admin_tasks, photo_url')
                        .in('employee_id', employeeIds);

                    const enriched = noms.map(n => {
                        const empData = emps?.find(e => e.employee_id === n.employee_id);
                        const finalPhotoUrl = empData?.photo_url || getPhotoUrlFromBucket(n.employee_id);

                        return {
                            ...n,
                            employee_name: empData?.name || 'موظف',
                            specialty: empData?.specialty,
                            admin_tasks: empData?.admin_tasks,
                            photo_url: finalPhotoUrl
                        };
                    });
                    setNominees(enriched);
                }

                const { data: vote } = await supabase.from('eom_votes')
                    .select('*')
                    .eq('cycle_id', cyc.id)
                    .eq('voter_id', employee.employee_id)
                    .maybeSingle();
                
                if (vote) setHasVoted(true);
            }
        } catch (error) {
            console.error("Voting Load Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleVote = async (nomineeId: string) => {
        if (!cycle || hasVoted) return;
        if (!confirm('تأكيد تصويتك؟')) return;

        const { error } = await supabase.from('eom_votes').insert({
            cycle_id: cycle.id,
            voter_id: employee.employee_id,
            nominee_id: nomineeId
        });

        if (!error) {
            setNominees(prev => prev.map(n => 
                n.id === nomineeId ? { ...n, votes_count: (n.votes_count || 0) + 1 } : n
            ));
            
            const selectedNominee = nominees.find(n => n.id === nomineeId);
            if(selectedNominee) {
                 await supabase.from('eom_nominees')
                    .update({ votes_count: (selectedNominee.votes_count || 0) + 1 })
                    .eq('id', nomineeId);
            }
            
            setHasVoted(true);
        }
    };

    if (loading || !cycle || nominees.length === 0) return null;

    return (
        <div className="bg-white rounded-[24px] p-4 border border-gray-100 shadow-sm mb-6 relative overflow-hidden text-right" dir="rtl">
            <div className="relative z-10">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-1.5">
                        <Trophy className="w-5 h-5 text-yellow-600 animate-pulse"/>
                        <h3 className="text-sm font-black text-gray-900 tracking-tight">الموظف المثالي</h3>
                    </div>
                    {hasVoted && (
                        <div className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100 text-[9px] font-black flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3"/> تم التصويت
                        </div>
                    )}
                </div>

                {/* 5 Columns Grid on all screens */}
                <div className="grid grid-cols-5 gap-2">
                    {nominees.map(n => (
                        <div key={n.id} className="flex flex-col items-center group">
                            <div className="relative mb-1.5">
                                {/* أصوات الموظف تظهر كـ Badge فوق الصورة عند انتهاء التصويت */}
                                {hasVoted && (
                                    <div className="absolute -top-1 -right-1 z-10 bg-indigo-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm border border-white">
                                        {n.votes_count}
                                    </div>
                                )}

                                <button 
                                    disabled={hasVoted}
                                    onClick={() => handleVote(n.id)}
                                    className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-2 transition-all overflow-hidden ${
                                        hasVoted 
                                        ? 'border-gray-50 opacity-80' 
                                        : 'border-white shadow-sm hover:border-indigo-400 active:scale-90 shadow-indigo-100'
                                    }`}
                                >
                                    <img 
                                        src={n.photo_url} 
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${n.employee_name}&background=6366f1&color=fff&bold=true`;
                                        }}
                                        className="w-full h-full object-cover"
                                        alt={n.employee_name}
                                    />
                                    {!hasVoted && (
                                        <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <ThumbsUp className="w-4 h-4 text-white" />
                                        </div>
                                    )}
                                </button>
                            </div>

                            <div className="text-center w-full">
                                {/* عرض الاسم الأول فقط لتوفير مساحة */}
                                <h4 className="text-[9px] font-black text-gray-800 leading-none truncate mb-1">
                                    {n.employee_name?.split(' ')[0]}
                                </h4>
                                
                                {!hasVoted && (
                                    <button 
                                        onClick={() => handleVote(n.id)}
                                        className="text-indigo-600 hover:text-indigo-800 transition-colors"
                                    >
                                        <Star className="w-4 h-4 mx-auto" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
