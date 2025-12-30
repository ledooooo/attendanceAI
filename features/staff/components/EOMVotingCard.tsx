import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, EOMCycle, EOMNominee } from '../../../types';
import { Trophy, ThumbsUp, CheckCircle2, User, Briefcase, FileText } from 'lucide-react';

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

    // رابط الـ Bucket الخاص بالصور (تأكد من إنشاء bucket باسم 'staff-photos')
    // يتم تكوين الرابط بناءً على رابط مشروعك في Supabase
    const PROJECT_URL = "https://YOUR_PROJECT_ID.supabase.co"; // ⚠️ استبدل هذا برابط مشروعك الحقيقي، أو سيتم جلبه تلقائياً
    
    // دالة مساعدة لتوليد رابط الصورة
    const getPhotoUrl = (empId: string) => {
        // نستخدم الدالة المدمجة لجلب الرابط العام
        const { data } = supabase.storage.from('staff-photos').getPublicUrl(`${empId}.jpg`);
        return data.publicUrl;
    };

    useEffect(() => {
        fetchVotingStatus();
    }, []);

    const fetchVotingStatus = async () => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        // 1. جلب الدورة الحالية النشطة
        const { data: cyc } = await supabase.from('eom_cycles')
            .select('*')
            .eq('month', currentMonth)
            .eq('status', 'voting')
            .maybeSingle();
        
        if (cyc) {
            setCycle(cyc);
            
            // 2. جلب المرشحين مع بيانات الموظفين (Join)
            const { data: noms } = await supabase.from('eom_nominees')
                .select(`
                    *,
                    employees:employee_id ( name, specialty, admin_tasks )
                `)
                .eq('cycle_id', cyc.id);

            if (noms) {
                // تنسيق البيانات
                const enrichedNoms = noms.map((n: any) => ({
                    ...n,
                    employee_name: n.employees?.name,
                    specialty: n.employees?.specialty,
                    admin_tasks: n.employees?.admin_tasks,
                    photo_url: getPhotoUrl(n.employee_id) // توليد رابط الصورة: 80.jpg
                }));
                setNominees(enrichedNoms);
            }

            // 3. التحقق هل قام الموظف الحالي بالتصويت؟
            const { data: vote } = await supabase.from('eom_votes')
                .select('*')
                .eq('cycle_id', cyc.id)
                .eq('voter_id', employee.employee_id)
                .maybeSingle();
            
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
            // زيادة العداد في الواجهة فورياً
            setNominees(prev => prev.map(n => 
                n.id === nomineeId ? { ...n, votes_count: (n.votes_count || 0) + 1 } : n
            ));
            
            // زيادة العداد في قاعدة البيانات (يفضل استخدام دالة RPC للأمان)
            const nom = nominees.find(n => n.id === nomineeId);
            if(nom) {
                 await supabase.from('eom_nominees')
                    .update({ votes_count: (nom.votes_count || 0) + 1 })
                    .eq('id', nomineeId);
            }
            
            setHasVoted(true);
            alert('شكراً! تم تسجيل صوتك.');
        } else {
            alert('حدث خطأ أو لقد قمت بالتصويت مسبقاً.');
        }
    };

    if (loading || !cycle || nominees.length === 0) return null;

    return (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-[30px] border border-indigo-100 shadow-sm mb-6 relative overflow-hidden animate-in fade-in">
            {/* خلفية جمالية */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-200 rounded-br-full -ml-10 -mt-10 opacity-20"></div>
            
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-xl font-black text-indigo-900 flex items-center gap-2">
                            <Trophy className="w-6 h-6 text-yellow-500 fill-yellow-500"/> التصويت للموظف المثالي
                        </h3>
                        <p className="text-sm text-indigo-700 mt-1 font-medium">
                            {hasVoted ? 'شكراً لمشاركتك! النتائج ستعلن قريباً.' : 'اختر الزميل الأكثر تميزاً لهذا الشهر.'}
                        </p>
                    </div>
                    {hasVoted && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> تم التصويت</span>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {nominees.map(nom => (
                        <div key={nom.id} className={`bg-white rounded-2xl p-4 border transition-all relative overflow-hidden group ${hasVoted ? 'opacity-90 grayscale-[0.3]' : 'hover:shadow-lg hover:border-indigo-300'}`}>
                            
                            {/* صورة الموظف */}
                            <div className="flex justify-center -mt-8 mb-3">
                                <div className="w-20 h-20 rounded-full border-4 border-white shadow-md bg-gray-100 overflow-hidden">
                                    <img 
                                        src={nom.photo_url} 
                                        onError={(e) => {
                                            // في حال عدم وجود صورة، نعرض أيقونة افتراضية
                                            (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + nom.employee_name + '&background=random';
                                        }}
                                        className="w-full h-full object-cover"
                                        alt={nom.employee_name}
                                    />
                                </div>
                            </div>

                            {/* البيانات */}
                            <div className="text-center space-y-2 mb-4">
                                <h4 className="font-bold text-gray-800 truncate" title={nom.employee_name}>{nom.employee_name}</h4>
                                
                                {/* التخصص */}
                                <div className="flex items-center justify-center gap-1 text-xs text-indigo-600 font-bold bg-indigo-50 py-1 px-2 rounded-lg w-fit mx-auto">
                                    <Briefcase className="w-3 h-3"/> {nom.specialty || 'عام'}
                                </div>

                                {/* المهام الإدارية */}
                                {nom.admin_tasks && (
                                    <p className="text-[10px] text-gray-500 line-clamp-2 bg-gray-50 p-2 rounded-lg border border-gray-100 min-h-[40px] flex items-center justify-center">
                                        {nom.admin_tasks}
                                    </p>
                                )}
                            </div>

                            {/* زر التصويت وعداد الأصوات */}
                            <button 
                                disabled={hasVoted}
                                onClick={() => handleVote(nom.id)}
                                className={`w-full py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${
                                    hasVoted 
                                    ? 'bg-gray-100 text-gray-400 cursor-default' 
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200'
                                }`}
                            >
                                {hasVoted ? (
                                    <>
                                        <span className="text-lg">{nom.votes_count}</span> صوت
                                    </>
                                ) : (
                                    <>
                                        <ThumbsUp className="w-4 h-4"/> تصويت
                                    </>
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
