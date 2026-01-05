import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, EOMCycle, EOMNominee, getBirthDateFromNationalID } from '../../../types';
import { 
  Trophy, Users, CalendarHeart, Cake, AlertCircle, 
  Send, BarChart3, CheckCircle2, StopCircle, Share2 
} from 'lucide-react';

interface EnrichedNominee extends EOMNominee {
    employee_name?: string;
    photo_url?: string;
}

export default function MotivationTab({ employees }: { employees: Employee[] }) {
    const [cycle, setCycle] = useState<EOMCycle | null>(null);
    const [nominees, setNominees] = useState<EnrichedNominee[]>([]);
    const [upcomingBirthdays, setUpcomingBirthdays] = useState<any[]>([]);
    const [totalVotes, setTotalVotes] = useState(0);

    useEffect(() => {
        fetchEOMStatus();
        processBirthdays();
    }, [employees]);

    // 1. معالجة أعياد الميلاد للموظفين النشطين فقط
    const processBirthdays = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextMonth = new Date();
        nextMonth.setDate(today.getDate() + 30);

        const list = employees
            .filter(emp => emp.status === 'active') // ✅ فلترة النشطين فقط
            .map(emp => {
                const birthDate = getBirthDateFromNationalID(emp.national_id);
                if (!birthDate) return null;

                let currentYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
                if (currentYearBirthday < today) currentYearBirthday.setFullYear(today.getFullYear() + 1);

                if (currentYearBirthday <= nextMonth) {
                    const diffDays = Math.ceil((currentYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    return {
                        ...emp,
                        daysRemaining: diffDays,
                        formattedDate: `${birthDate.getDate()} / ${birthDate.getMonth() + 1}`
                    };
                }
                return null;
            })
            .filter(Boolean)
            .sort((a: any, b: any) => a.daysRemaining - b.daysRemaining);

        setUpcomingBirthdays(list);
    };

    // 2. جلب بيانات التصويت الحالية
    const fetchEOMStatus = async () => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const { data: cyc } = await supabase.from('eom_cycles')
            .select('*').eq('month', currentMonth).maybeSingle();

        if (cyc) {
            setCycle(cyc);
            const { data: noms } = await supabase.from('eom_nominees')
                .select('*').eq('cycle_id', cyc.id);

            if (noms) {
                const total = noms.reduce((sum, n) => sum + (n.votes_count || 0), 0);
                setTotalVotes(total);
                
                const enriched = noms.map(n => ({
                    ...n,
                    employee_name: employees.find(e => e.employee_id === n.employee_id)?.name,
                    photo_url: employees.find(e => e.employee_id === n.employee_id)?.photo_url
                }));
                setNominees(enriched.sort((a, b) => (b.votes_count || 0) - (a.votes_count || 0)));
            }
        }
    };

    // 3. إنهاء التصويت وإعلان الفائز
    const handleEndVoting = async () => {
        if (!cycle || nominees.length === 0) return;
        if (!confirm('هل أنت متأكد من إغلاق التصويت وإعلان الفائز؟')) return;

        const winner = nominees[0]; // الأعلى تصويتاً

        const { error } = await supabase.from('eom_cycles')
            .update({ 
                status: 'announced', 
                winner_id: winner.employee_id 
            })
            .eq('id', cycle.id);

        if (!error) {
            if (confirm('تم إغلاق التصويت. هل تريد نشر بوست تهنئة للفائز تلقائياً؟')) {
                await supabase.from('news_posts').insert({
                    title: `🏆 موظف الشهر: ${winner.employee_name}`,
                    content: `نهنئ الزميل المتميز ${winner.employee_name} لحصوله على لقب موظف الشهر بناءً على تصويت الزملاء. نتمنى له دوام التوفيق! 🎉`,
                    is_pinned: true,
                    category: 'تنبيه'
                });
            }
            alert('تم إنهاء الدورة وإعلان النتائج بنجاح');
            fetchEOMStatus();
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 text-right" dir="rtl">
            
            {/* قسم متابعة التصويت (للمدير) */}
            <div className="bg-white rounded-[35px] p-8 shadow-sm border border-indigo-100">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                            <BarChart3 className="text-indigo-600 w-8 h-8"/> متابعة تصويت الموظف المثالي
                        </h3>
                        <p className="text-gray-500 font-bold mt-1">إجمالي الأصوات المشاركة: {totalVotes}</p>
                    </div>
                    {cycle?.status === 'voting' && (
                        <button 
                            onClick={handleEndVoting}
                            className="bg-red-50 text-red-600 px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-red-100 transition-colors"
                        >
                            <StopCircle className="w-5 h-5"/> إنهاء التصويت وإعلان النتائج
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {nominees.map((nom, index) => {
                        const percentage = totalVotes > 0 ? Math.round((nom.votes_count / totalVotes) * 100) : 0;
                        return (
                            <div key={nom.id} className="relative group">
                                <div className="flex justify-between items-center mb-2 px-2">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${index === 0 ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                            {index + 1}
                                        </span>
                                        <span className="font-bold text-gray-700">{nom.employee_name}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-indigo-600 font-black">{nom.votes_count} صوت</span>
                                        <span className="text-gray-400 font-bold text-sm">{percentage}%</span>
                                    </div>
                                </div>
                                {/* شريط التقدم */}
                                <div className="w-full bg-gray-50 h-4 rounded-full overflow-hidden border border-gray-100">
                                    <div 
                                        className={`h-full transition-all duration-1000 ${index === 0 ? 'bg-indigo-600' : 'bg-indigo-300'}`}
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* قسم أعياد الميلاد (للموظفين النشطين فقط) */}
            <div className="bg-white rounded-[35px] p-8 shadow-sm border border-pink-100">
                <h3 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-3">
                    <Cake className="text-pink-600 w-8 h-8"/> أعياد ميلاد الموظفين النشطين
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {upcomingBirthdays.map((emp) => (
                        <div key={emp.id} className="bg-pink-50/50 p-4 rounded-3xl border border-pink-100 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm overflow-hidden">
                                    {emp.photo_url ? <img src={emp.photo_url} className="w-full h-full object-cover"/> : <Users className="text-pink-300"/>}
                                </div>
                                <div>
                                    <p className="font-black text-gray-800">{emp.name}</p>
                                    <p className="text-xs text-pink-600 font-bold">{emp.formattedDate} ({emp.daysRemaining === 0 ? 'اليوم 🎉' : `بعد ${emp.daysRemaining} يوم`})</p>
                                </div>
                            </div>
                            <button className="p-3 bg-white text-pink-600 rounded-xl hover:bg-pink-600 hover:text-white transition-all shadow-sm">
                                <Share2 className="w-5 h-5"/>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
