import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, EOMCycle, EOMNominee } from '../../../types';
import { Trophy, ThumbsUp, CheckCircle2, Star, User } from 'lucide-react';

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
        if (!confirm('هل تريد تأكيد صوتك لهذا الزميل؟')) return;

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
            alert('تم تسجيل صوتك بنجاح! شكراً لمشاركتك.');
        } else {
            alert('عذراً، حدث خطأ أثناء تسجيل الصوت.');
        }
    };

    // دالة لاستخراج الاسم الثلاثي فقط
    const getTripleName = (fullName: string) => {
        const parts = fullName.trim().split(/\s+/);
        return parts.slice(0, 3).join(' ');
    };

    if (loading || !cycle || nominees.length === 0) return null;

    return (
        <div className="bg-white rounded-[32px] p-5 border border-gray-100 shadow-xl shadow-indigo-50/50 mb-8 relative overflow-hidden text-right" dir="rtl">
            {/* الخلفية التجميلية */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-50 rounded-full -ml-16 -mt-16 opacity-50 blur-3xl"></div>

            <div className="relative z-10">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="bg-yellow-100 p-1.5 rounded-xl">
                                <Trophy className="w-5 h-5 text-yellow-600"/>
                            </div>
                            <h3 className="text-lg font-black text-gray-900 tracking-tight">الموظف المثالي</h3>
                        </div>
                    </div>
                    {hasVoted && (
                        <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 text-[10px] font-black flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5"/> تم التصويت
                        </div>
                    )}
                </div>

                {/* Grid: 2 Columns */}
                <div className="grid grid-cols-2 gap-4">
                    {nominees.map(n => (
                        <div 
                            key={n.id} 
                            className={`relative bg-white rounded-[24px] p-3 border-2 transition-all duration-300 ${
                                hasVoted 
                                ? 'border-gray-50' 
                                : 'border-gray-100 hover:border-indigo-400 hover:shadow-lg active:scale-95 cursor-pointer'
                            }`}
                            onClick={() => !hasVoted && handleVote(n.id)}
                        >
                            {/* عداد الأصوات كـ Badge فوق الصورة */}
                            {hasVoted && (
                                <div className="absolute top-2 right-2 z-20 bg-indigo-600 text-white text-[10px] font-black h-5 min-w-[20px] px-1 rounded-lg flex items-center justify-center shadow-lg border border-white">
                                    {n.votes_count}
                                </div>
                            )}

                            <div className="flex flex-col items-center">
                                {/* صورة الموظف بحجم متوسط */}
                                <div className="relative w-20 h-20 mb-3">
                                    <div className="w-20 h-20 rounded-2xl border-2 border-white shadow-md overflow-hidden bg-gray-50">
                                        <img 
                                            src={n.photo_url} 
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${n.employee_name}&background=6366f1&color=fff&bold=true`;
                                            }}
                                            className={`w-full h-full object-cover ${hasVoted ? 'grayscale-[0.3]' : ''}`}
                                            alt={n.employee_name}
                                        />
                                    </div>
                                    {!hasVoted && (
                                        <div className="absolute -bottom-1 -left-1 bg-white p-1 rounded-lg shadow-md border border-gray-100">
                                            <ThumbsUp className="w-3 h-3 text-indigo-600" />
                                        </div>
                                    )}
                                </div>

                                <div className="text-center w-full space-y-1">
                                    {/* الاسم الثلاثي بخط واضح */}
                                    <h4 className="text-xs font-black text-gray-800 leading-tight min-h-[32px] flex items-center justify-center">
                                        {getTripleName(n.employee_name || '')}
                                    </h4>
                                    
                                    {/* التخصص */}
                                    <p className="text-[10px] text-indigo-600 font-bold opacity-80">
                                        {n.specialty || 'عضو فريق'}
                                    </p>
                                    
                                    {!hasVoted && (
                                        <div className="mt-2 text-[10px] font-black text-white bg-indigo-600 py-1.5 rounded-xl shadow-md shadow-indigo-100">
                                            إختر الآن
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                
                {!hasVoted && (
                    <p className="text-center text-[10px] text-gray-400 mt-5 font-bold italic">
                        * اضغط على كارت الزميل لتأكيد اختيارك
                    </p>
                )}
            </div>
        </div>
    );
}
