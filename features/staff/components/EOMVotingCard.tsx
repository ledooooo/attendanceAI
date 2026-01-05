import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, EOMCycle, EOMNominee } from '../../../types';
import { Trophy, ThumbsUp, CheckCircle2, Briefcase, Star } from 'lucide-react';

// تعريف واجهة موسعة للمرشح لتشمل بيانات الموظف
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

    // دالة جلب رابط الصورة من الـ Bucket كاحتياطي
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
            // جلب الشهر الحالي بالتوقيت المحلي لتجنب أخطاء UTC
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            const { data: cyc } = await supabase.from('eom_cycles')
                .select('*')
                .eq('month', currentMonth)
                .eq('status', 'voting')
                .maybeSingle();
            
            if (cyc) {
                setCycle(cyc);
                
                // 1. جلب المرشحين
                const { data: noms } = await supabase.from('eom_nominees').select('*').eq('cycle_id', cyc.id);

                if (noms && noms.length > 0) {
                    // 2. جلب بيانات الموظفين المرشحين (للحصول على الاسم، التخصص، وصورة الملف الشخصي)
                    const employeeIds = noms.map(n => n.employee_id);
                    const { data: emps } = await supabase.from('employees')
                        .select('employee_id, name, specialty, admin_tasks, photo_url')
                        .in('employee_id', employeeIds);

                    // 3. دمج البيانات (Enrichment)
                    const enriched = noms.map(n => {
                        const empData = emps?.find(e => e.employee_id === n.employee_id);
                        
                        // الأولوية لـ photo_url من جدول الموظفين، ثم الـ Bucket كاحتياطي
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

                // 4. التحقق من التصويت السابق
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
            alert('تم تسجيل صوتك بنجاح! شكراً لمشاركتك.');
        } else {
            alert('عذراً، حدث خطأ أثناء تسجيل الصوت.');
        }
    };

    if (loading || !cycle || nominees.length === 0) return null;

    return (
        <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-xl shadow-indigo-50/50 mb-10 relative overflow-hidden animate-in fade-in duration-700 text-right" dir="rtl">
            {/* الديكورات الخلفية */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-32 -mt-32 opacity-50 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-50 rounded-full -ml-24 -mb-24 opacity-50 blur-3xl"></div>

            <div className="relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
                    <div className="text-right w-full md:w-auto">
                        <div className="flex items-center gap-3 justify-start">
                            <div className="bg-yellow-100 p-2 rounded-2xl">
                                <Trophy className="w-8 h-8 text-yellow-600 animate-bounce"/>
                            </div>
                            <h3 className="text-3xl font-black text-gray-900 tracking-tight">الموظف المثالي</h3>
                        </div>
                        <p className="text-gray-500 mt-2 font-bold flex items-center gap-2 justify-start">
                            <Star className="w-4 h-4 text-indigo-500 fill-indigo-500"/>
                            {hasVoted ? 'اكتملت مشاركتك لهذا الشهر' : 'صوتك يصنع الفرق.. اختر زميلك المتميز'}
                        </p>
                    </div>
                    {hasVoted && (
                        <div className="bg-emerald-50 text-emerald-700 px-6 py-3 rounded-[20px] border border-emerald-100 font-black flex items-center gap-2 animate-pulse">
                            <CheckCircle2 className="w-5 h-5"/> تم تسجيل صوتك
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {nominees.map(n => (
                        <div 
                            key={n.id} 
                            className={`group relative bg-white rounded-[35px] p-6 border-2 transition-all duration-500 ${
                                hasVoted 
                                ? 'border-gray-50 grayscale-[0.5]' 
                                : 'border-gray-100 hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-100 hover:-translate-y-2'
                            }`}
                        >
                            {/* إطار الصورة */}
                            <div className="relative mx-auto w-28 h-28 mb-6">
                                <div className={`absolute inset-0 rounded-full blur-lg transition-opacity ${!hasVoted ? 'bg-indigo-400 opacity-20 group-hover:opacity-40' : 'bg-gray-200'}`}></div>
                                <div className="relative w-28 h-28 rounded-full border-4 border-white shadow-xl overflow-hidden bg-gray-50">
                                    <img 
                                        src={n.photo_url} 
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${n.employee_name}&background=6366f1&color=fff&bold=true`;
                                        }}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        alt={n.employee_name}
                                    />
                                </div>
                            </div>

                            <div className="text-center space-y-3">
                                <h4 className="text-lg font-black text-gray-800 leading-tight line-clamp-1">{n.employee_name}</h4>
                                
                                <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-black w-fit mx-auto border border-indigo-100">
                                    <Briefcase className="w-3.5 h-3.5"/>
                                    {n.specialty || 'عضو فريق'}
                                </div>

                                {n.admin_tasks && (
                                    <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 text-[11px] text-gray-500 font-bold min-h-[50px] flex items-center justify-center italic">
                                        "{n.admin_tasks}"
                                    </div>
                                )}

                                <button 
                                    disabled={hasVoted}
                                    onClick={() => handleVote(n.id)}
                                    className={`w-full mt-4 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all duration-300 ${
                                        hasVoted 
                                        ? 'bg-gray-50 text-gray-400 border border-gray-100' 
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-95'
                                    }`}
                                >
                                    {hasVoted ? (
                                        <span className="flex items-center gap-2">
                                            <Star className="w-4 h-4 fill-gray-400"/>
                                            {n.votes_count} صوت حصدها الزميل
                                        </span>
                                    ) : (
                                        <>
                                            <ThumbsUp className="w-4 h-4"/>
                                            ادعم زميلك الآن
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
