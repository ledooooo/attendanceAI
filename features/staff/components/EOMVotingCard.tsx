import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, EOMCycle, EOMNominee } from '../../../types';
import { Trophy, ThumbsUp, CheckCircle2 } from 'lucide-react';

export default function EOMVotingCard({ employee }: { employee: Employee }) {
    const [cycle, setCycle] = useState<EOMCycle | null>(null);
    const [nominees, setNominees] = useState<EOMNominee[]>([]);
    const [hasVoted, setHasVoted] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchVotingStatus();
    }, []);

    const fetchVotingStatus = async () => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        // 1. جلب الدورة الحالية
        const { data: cyc } = await supabase.from('eom_cycles')
            .select('*').eq('month', currentMonth).eq('status', 'voting').maybeSingle();
        
        if (cyc) {
            setCycle(cyc);
            // 2. جلب المرشحين
            const { data: noms } = await supabase.from('eom_nominees').select('*').eq('cycle_id', cyc.id);
            if (noms) {
                // جلب أسماء المرشحين
                const enrichedNoms = await Promise.all(noms.map(async (n) => {
                    const { data: emp } = await supabase.from('employees').select('name, photo_url').eq('employee_id', n.employee_id).single();
                    return { ...n, employee_name: emp?.name, photo_url: emp?.photo_url };
                }));
                setNominees(enrichedNoms);
            }

            // 3. هل صوتت من قبل؟
            const { data: vote } = await supabase.from('eom_votes')
                .select('*').eq('cycle_id', cyc.id).eq('voter_id', employee.employee_id).maybeSingle();
            
            if (vote) setHasVoted(true);
        }
        setLoading(false);
    };

    const handleVote = async (nomineeId: string) => {
        if (!cycle) return;
        if (!confirm('تأكيد صوتك لهذا المرشح؟ لا يمكن التراجع.')) return;

        // تسجيل الصوت
        const { error } = await supabase.from('eom_votes').insert({
            cycle_id: cycle.id,
            voter_id: employee.employee_id,
            nominee_id: nomineeId
        });

        if (!error) {
            // زيادة العداد
            await supabase.rpc('increment_vote', { row_id: nomineeId }); // (يحتاج دالة RPC أو تحديث عادي)
            // سنستخدم التحديث العادي للتبسيط حالياً
            const nom = nominees.find(n => n.id === nomineeId);
            if(nom) {
                 await supabase.from('eom_nominees').update({ votes_count: nom.votes_count + 1 }).eq('id', nomineeId);
            }
            
            setHasVoted(true);
            alert('شكراً! تم تسجيل صوتك.');
        } else {
            alert('حدث خطأ أو لقد قمت بالتصويت مسبقاً.');
        }
    };

    if (loading || !cycle || nominees.length === 0) return null;

    return (
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-6 rounded-[30px] border border-yellow-200 shadow-sm mb-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-200 rounded-bl-full -mr-10 -mt-10 opacity-20"></div>
            
            <div className="relative z-10">
                <h3 className="text-xl font-black text-yellow-700 mb-2 flex items-center gap-2">
                    <Trophy className="w-6 h-6 fill-yellow-600"/> صوت للموظف المثالي
                </h3>
                <p className="text-sm text-yellow-800 mb-6 font-medium">
                    {hasVoted ? 'شكراً لمشاركتك! سيتم إعلان الفائز قريباً.' : 'اختر زميلك الذي يستحق لقب الموظف المثالي لهذا الشهر.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {nominees.map(nom => (
                        <button 
                            key={nom.id}
                            disabled={hasVoted}
                            onClick={() => handleVote(nom.id)}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-right ${
                                hasVoted 
                                    ? 'bg-white/50 border-white/50 cursor-default' 
                                    : 'bg-white border-yellow-100 hover:border-yellow-400 hover:shadow-md active:scale-95'
                            }`}
                        >
                            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0">
                                {nom.photo_url ? (
                                    <img src={nom.photo_url} className="w-full h-full object-cover"/>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold bg-gray-100">
                                        {nom.employee_name?.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-gray-800 text-sm">{nom.employee_name}</h4>
                            </div>
                            {!hasVoted && <ThumbsUp className="w-4 h-4 text-yellow-500"/>}
                            {hasVoted && <CheckCircle2 className="w-4 h-4 text-green-500 opacity-0"/>} {/* يمكن إظهار من صوّت له */}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
