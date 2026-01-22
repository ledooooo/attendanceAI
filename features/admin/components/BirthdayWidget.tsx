import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, EOMCycle } from '../../../types';
import { Trophy, Star, CheckCircle2, Loader2, Play, StopCircle, PartyPopper } from 'lucide-react';

export default function EOMManager() {
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeCycle, setActiveCycle] = useState<EOMCycle | null>(null);

    // 1. جلب الموظفين مع تقييماتهم للشهر السابق
    const fetchCandidates = async () => {
        setLoading(true);
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        const lastMonth = date.toISOString().slice(0, 7); // YYYY-MM

        const { data: emps } = await supabase.from('employees').select('id, employee_id, name, specialty, photo_url');
        const { data: evals } = await supabase.from('evaluations').select('*').eq('month', lastMonth);

        if (emps && evals) {
            const ranked = emps.map(emp => {
                const ev = evals.find(e => e.employee_id === emp.employee_id);
                return {
                    ...emp,
                    score: ev ? ev.total_score : 0,
                    attendance_score: ev ? ev.score_attendance : 0
                };
            }).sort((a, b) => b.score - a.score);
            
            setEmployees(ranked);
        }
        
        // التحقق من وجود دورة حالية
        const currentMonth = new Date().toISOString().slice(0, 7);
        const { data: cycle } = await supabase.from('eom_cycles').select('*').eq('month', currentMonth).maybeSingle();
        if(cycle) setActiveCycle(cycle);

        setLoading(false);
    };

    useEffect(() => { fetchCandidates(); }, []);

    // 2. بدء التصويت
    const startVoting = async () => {
        if (selectedIds.length < 2) return alert('يجب اختيار موظفين اثنين على الأقل');
        setLoading(true);

        const currentMonth = new Date().toISOString().slice(0, 7);
        
        const { data: cycle, error } = await supabase.from('eom_cycles')
            .insert({ month: currentMonth, status: 'voting' })
            .select().single();

        if (error) { 
            alert('خطأ في الإنشاء: ربما يوجد تصويت مفتوح بالفعل لهذا الشهر'); 
            setLoading(false); 
            return; 
        }

        const nomineesData = selectedIds.map(id => {
            const emp = employees.find(e => e.id === id);
            return { cycle_id: cycle.id, employee_id: emp.employee_id };
        });

        await supabase.from('eom_nominees').insert(nomineesData);

        // نشر خبر تلقائي
        await supabase.from('news_posts').insert({
            title: '⭐ بدء التصويت للموظف المثالي ⭐',
            content: 'تم فتح باب التصويت لاختيار الموظف المثالي لهذا الشهر. شارك برأيك الآن من الصفحة الرئيسية!',
            is_pinned: true,
            author_id: 'admin' // إضافة معرف افتراضي
        });

        alert('تم بدء التصويت بنجاح!');
        setActiveCycle(cycle);
        setLoading(false);
    };

    // 3. إنهاء التصويت وإعلان الفائز (🔥 الكود الجديد 🔥)
    const endVoting = async () => {
        if (!activeCycle || activeCycle.status !== 'voting') return;
        if (!confirm('هل أنت متأكد من إنهاء التصويت وإعلان الفائز الآن؟')) return;

        setLoading(true);
        try {
            // أ) جلب نتائج التصويت
            const { data: votes } = await supabase
                .from('eom_votes')
                .select('nominee_id')
                .eq('cycle_id', activeCycle.id);

            const { data: nominees } = await supabase
                .from('eom_nominees')
                .select('id, employee_id, employees(name)')
                .eq('cycle_id', activeCycle.id);

            if (!nominees || nominees.length === 0) throw new Error('لا يوجد مرشحين');

            // ب) حساب الفائز
            const voteCounts: Record<string, number> = {};
            votes?.forEach(v => {
                voteCounts[v.nominee_id] = (voteCounts[v.nominee_id] || 0) + 1;
            });

            let winnerId = null;
            let maxVotes = -1;

            nominees.forEach(nom => {
                const count = voteCounts[nom.id] || 0;
                if (count > maxVotes) {
                    maxVotes = count;
                    winnerId = nom.employee_id;
                }
            });

            if (!winnerId) throw new Error('تعذر تحديد الفائز');

            const winnerName = nominees.find(n => n.employee_id === winnerId)?.employees?.name;

            // ج) تحديث حالة الدورة
            const { error: updateError } = await supabase
                .from('eom_cycles')
                .update({ 
                    status: 'completed',
                    winner_id: winnerId
                })
                .eq('id', activeCycle.id);

            if (updateError) throw updateError;

            // د) نشر خبر الفوز
            await supabase.from('news_posts').insert({
                title: '🏆 الموظف المثالي لهذا الشهر 🏆',
                content: `نبارك للزميل/ة **${winnerName}** حصوله على لقب الموظف المثالي لهذا الشهر بعدد أصوات ${maxVotes}. نتمنى له دوام التوفيق والنجاح!`,
                is_pinned: true,
                image_url: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', // صورة افتراضية للكأس
                author_id: 'admin'
            });

            // هـ) إرسال إشعار للموظفين (اختياري)
            // supabase.functions.invoke('send-push-notification', { ... })

            alert(`تم إنهاء التصويت! الفائز هو: ${winnerName}`);
            setActiveCycle(prev => prev ? { ...prev, status: 'completed', winner_id: winnerId } : null);

        } catch (error: any) {
            console.error(error);
            alert('حدث خطأ أثناء إنهاء التصويت: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) setSelectedIds(prev => prev.filter(i => i !== id));
        else {
            if (selectedIds.length >= 5) return alert('يمكنك اختيار 5 مرشحين كحد أقصى');
            setSelectedIds(prev => [...prev, id]);
        }
    };

    return (
        <div className="bg-white p-6 rounded-[30px] border shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-yellow-500"/> إدارة الموظف المثالي
                </h3>
                
                {activeCycle ? (
                    activeCycle.status === 'voting' ? (
                        <div className="flex gap-3 items-center">
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                                التصويت جاري ({activeCycle.month})
                            </span>
                            <button 
                                onClick={endVoting}
                                disabled={loading}
                                className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 text-xs"
                            >
                                {loading ? <Loader2 className="w-3 h-3 animate-spin"/> : <StopCircle className="w-3 h-3"/>}
                                إنهاء وإعلان الفائز
                            </button>
                        </div>
                    ) : (
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3"/>
                            تم إعلان الفائز ({activeCycle.month})
                        </span>
                    )
                ) : (
                    <button 
                        onClick={startVoting}
                        disabled={loading || selectedIds.length === 0}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4"/>}
                        بدء التصويت
                    </button>
                )}
            </div>

            {!activeCycle && (
                <>
                    <p className="text-gray-500 text-sm">اختر المرشحين بناءً على أداء الشهر الماضي (الحد الأقصى 5):</p>
                    <div className="grid gap-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {employees.map((emp, idx) => (
                            <div key={emp.id} 
                                onClick={() => toggleSelect(emp.id)}
                                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                    selectedIds.includes(emp.id) ? 'bg-yellow-50 border-yellow-400 ring-1 ring-yellow-400' : 'hover:bg-gray-50 border-gray-100'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                                        #{idx + 1}
                                    </span>
                                    <div>
                                        <h4 className="font-bold text-gray-800 text-sm">{emp.name}</h4>
                                        <p className="text-xs text-gray-400">{emp.specialty}</p>
                                    </div>
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-black text-emerald-600">{emp.score}%</div>
                                    <div className="text-[10px] text-gray-400">تقييم شامل</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
            
            {/* عرض الفائز إن وجد */}
            {activeCycle && activeCycle.winner_id && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-2xl flex items-center gap-4">
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-2xl">🏆</div>
                    <div>
                        <p className="text-xs text-yellow-600 font-bold">الفائز لهذا الشهر:</p>
                        <p className="text-lg font-black text-gray-800">
                            {employees.find(e => e.employee_id === activeCycle.winner_id)?.name || '...'}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
