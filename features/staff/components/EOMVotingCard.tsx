import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, EOMCycle, EOMNominee } from '../../../types';
import { Trophy, ThumbsUp, CheckCircle2, Briefcase, Star } from 'lucide-react';

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
                            employee_name: empData?.name || 'موظف غير معروف',
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
        if (!confirm('تأكيد صوتك لهذا المرشح؟ لا يمكن التراجع عن هذا القرار.')) return;

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
            alert('تم تسجيل صوتك بنجاح!');
        } else {
            alert('عذراً، حدث خطأ أثناء تسجيل الصوت.');
        }
    };

    if (loading || !cycle || nominees.length === 0) return null;

    return (
        <div className="bg-white rounded-[30px] p-6 border border-gray-100 shadow-lg mb-8 relative overflow-hidden text-right" dir="rtl">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50 rounded-full -mr-24 -mt-24 opacity-40 blur-3xl"></div>

            <div className="relative z-10">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2 justify-start">
                            <Trophy className="w-6 h-6 text-yellow-600 animate-bounce"/>
                            <h3 className="text-xl font-black text-gray-900 tracking-tight">الموظف المثالي</h3>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 font-bold">
                            {hasVoted ? 'اكتملت مشاركتك لهذا الشهر' : 'صوتك يصنع الفرق'}
                        </p>
                    </div>
                    {hasVoted && (
                        <div className="bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full border border-emerald-100 text-xs font-black flex items-center gap-1.5 animate-pulse">
                            <CheckCircle2 className="w-4 h-4"/> تم تسجيل صوتك
                        </div>
                    )}
                </div>

                {/* Grid: 2 columns on mobile, 3 on tablet, 4 on desktop for smaller cards */}
                <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {nominees.map(n => (
                        <div 
                            key={n.id} 
                            className={`group relative bg-white rounded-[25px] p-4 border transition-all duration-300 ${
                                hasVoted 
                                ? 'border-gray-50' 
                                : 'border-gray-100 hover:border-indigo-300 hover:shadow-md hover:-translate-y-1'
                            }`}
                        >
                            {/* إطار الصورة المصغر */}
                            <div className="relative mx-auto w-20 h-20 mb-3">
                                <div className={`absolute inset-0 rounded-full blur transition-opacity ${!hasVoted ? 'bg-indigo-400 opacity-10 group-hover:opacity-20' : 'bg-gray-100'}`}></div>
                                <div className="relative w-20 h-20 rounded-full border-2 border-white shadow-md overflow-hidden bg-gray-50">
                                    <img 
                                        src={n.photo_url} 
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${n.employee_name}&background=6366f1&color=fff&bold=true`;
                                        }}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        alt={n.employee_name}
                                    />
                                </div>
                            </div>

                            <div className="text-center space-y-2">
                                <h4 className="text-sm font-black text-gray-800 leading-tight line-clamp-1 px-1">{n.employee_name}</h4>
                                
                                <div className="flex items-center justify-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black w-fit mx-auto border border-indigo-100">
                                    <Briefcase className="w-3 h-3"/>
                                    {n.specialty || 'عضو فريق'}
                                </div>

                                {n.admin_tasks && (
                                    <div className="bg-gray-50/50 rounded-xl p-2 border border-gray-100 text-[10px] text-gray-500 font-bold min-h-[36px] flex items-center justify-center italic leading-tight">
                                        <span className="line-clamp-2">"{n.admin_tasks}"</span>
                                    </div>
                                )}

                                <button 
                                    disabled={hasVoted}
                                    onClick={() => handleVote(n.id)}
                                    className={`w-full mt-2 py-2 rounded-xl font-black text-[11px] flex items-center justify-center gap-1.5 transition-all duration-300 ${
                                        hasVoted 
                                        ? 'bg-gray-50 text-gray-400 border border-gray-100' 
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm active:scale-95'
                                    }`}
                                >
                                    {hasVoted ? (
                                        <>
                                            <Star className="w-3 h-3 fill-gray-400"/>
                                            {n.votes_count} صوت
                                        </>
                                    ) : (
                                        <>
                                            <ThumbsUp className="w-3 h-3"/>
                                            تصويت
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
