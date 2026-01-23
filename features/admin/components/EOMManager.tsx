import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { EOMCycle } from '../../../types';
import toast from 'react-hot-toast'; // ✅ استخدام نظام التنبيهات الجديد
import { 
    Trophy, CheckCircle2, Loader2, Play, StopCircle, 
    Trash2, BarChart3, RotateCcw, History, PlusCircle, X 
} from 'lucide-react';

export default function EOMManager() {
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    
    const [activeCycle, setActiveCycle] = useState<EOMCycle | null>(null);
    const [nomineesStats, setNomineesStats] = useState<any[]>([]);
    const [totalVotes, setTotalVotes] = useState(0);

    const [showHistory, setShowHistory] = useState(false);
    const [historyCycles, setHistoryCycles] = useState<any[]>([]);

    // 1. جلب المرشحين المحتملين والدورة النشطة
    const fetchCandidates = async () => {
        setLoading(true);
        try {
            // أ) جلب المرشحين بناءً على تقييم الشهر الماضي
            const date = new Date();
            date.setMonth(date.getMonth() - 1);
            const lastMonth = date.toISOString().slice(0, 7); 

            const { data: emps } = await supabase.from('employees').select('id, employee_id, name, specialty, photo_url');
            const { data: evals } = await supabase.from('evaluations').select('*').eq('month', lastMonth);

            if (emps && evals) {
                const ranked = emps.map(emp => {
                    const ev = evals.find(e => e.employee_id === emp.employee_id);
                    return {
                        ...emp,
                        score: ev ? ev.total_score : 0,
                    };
                }).sort((a, b) => b.score - a.score);
                setEmployees(ranked);
            }
            
            // ب) البحث عن الدورة الحالية
            const currentMonth = new Date().toISOString().slice(0, 7);
            const { data: cycle } = await supabase.from('eom_cycles')
                .select('*')
                .eq('month', currentMonth)
                .order('created_at', { ascending: false })
                .maybeSingle();

            if (cycle) {
                setActiveCycle(cycle);
                // جلب النتائج فوراً إذا وجدت دورة
                fetchCycleStats(cycle.id);
            }
        } catch (error) {
            console.error(error);
            toast.error('فشل تحميل البيانات');
        } finally {
            setLoading(false);
        }
    };

    // 🔥 2. جلب الإحصائيات (أسرع 100 مرة باستخدام View)
    const fetchCycleStats = async (cycleId: string) => {
        // نطلب البيانات الجاهزة من الـ View مباشرة
        const { data: stats, error } = await supabase
            .from('eom_vote_results') // ⚡ اسم الـ View الجديد
            .select('*')
            .eq('cycle_id', cycleId)
            .order('vote_count', { ascending: false });

        if (error) {
            console.error("Error fetching stats:", error);
            return;
        }

        if (stats) {
            setNomineesStats(stats);
            // حساب الإجمالي
            const total = stats.reduce((sum, item) => sum + (item.vote_count || 0), 0);
            setTotalVotes(total);
        }
    };

    // 3. الاشتراك اللحظي (لتحديث الأصوات فوراً)
    useEffect(() => {
        if (activeCycle) {
            const channel = supabase.channel('realtime_votes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'eom_votes' }, () => {
                    fetchCycleStats(activeCycle.id); // إعادة طلب الـ View عند أي تغيير
                })
                .subscribe();
            return () => { supabase.removeChannel(channel); };
        }
    }, [activeCycle?.id]);

    useEffect(() => { fetchCandidates(); }, []);

    // 4. بدء التصويت
    const startVoting = async () => {
        if (selectedIds.length < 2) {
            toast.error('اختر موظفين اثنين على الأقل');
            return;
        }
        
        const toastId = toast.loading('جاري بدء الدورة...');
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        const { data: cycle, error } = await supabase.from('eom_cycles')
            .insert({ month: currentMonth, status: 'voting' })
            .select().single();

        if (error) { 
            toast.error('فشل البدء (ربما توجد دورة بالفعل)', { id: toastId });
            return; 
        }

        const nomineesData = selectedIds.map(id => {
            const emp = employees.find(e => e.id === id);
            return { cycle_id: cycle.id, employee_id: emp.employee_id };
        });

        await supabase.from('eom_nominees').insert(nomineesData);

        // نشر خبر تلقائي
        await supabase.from('news_posts').insert({
            title: '⭐ انطلاق سباق الموظف المثالي',
            content: 'تم فتح باب التصويت لاختيار الموظف المثالي لهذا الشهر. صوتك يفرق!',
            is_pinned: true,
        });

        toast.success('تم بدء التصويت بنجاح!', { id: toastId });
        setActiveCycle(cycle);
        fetchCycleStats(cycle.id);
    };

    // 5. إنهاء التصويت
    const endVoting = async () => {
        if (!activeCycle || nomineesStats.length === 0) return;
        if (!confirm('هل أنت متأكد من إنهاء التصويت وإعلان الفائز؟')) return;

        const toastId = toast.loading('جاري إعلان النتيجة...');
        
        try {
            const winner = nomineesStats[0]; // الأول في القائمة (لأنها مرتبة من الـ View)
            
            // تحديث الدورة
            await supabase.from('eom_cycles')
                .update({ status: 'completed', winner_id: winner.employee_id })
                .eq('id', activeCycle.id);

            // نشر خبر الاحتفال
            await supabase.from('news_posts').insert({
                title: `🏆 الموظف المثالي: ${winner.employee_name}`,
                content: `نبارك للزميل/ة **${winner.employee_name}** الفوز بلقب الموظف المثالي لهذا الشهر بعدد أصوات (${winner.vote_count}). \nنتمنى له وللجميع دوام التوفيق! 🎉`,
                is_pinned: true,
                image_url: 'https://cdn-icons-png.flaticon.com/512/744/744984.png',
            });

            toast.success(`الفائز هو: ${winner.employee_name}`, { id: toastId });
            setActiveCycle({ ...activeCycle, status: 'completed', winner_id: winner.employee_id });

        } catch (error: any) {
            toast.error('حدث خطأ أثناء الإنهاء', { id: toastId });
        }
    };

    // العمليات الإدارية الأخرى
    const undoEndVoting = async () => {
        if (!confirm('إعادة فتح التصويت؟')) return;
        await supabase.from('eom_cycles').update({ status: 'voting', winner_id: null }).eq('id', activeCycle!.id);
        setActiveCycle({ ...activeCycle!, status: 'voting', winner_id: null });
        toast.success('تم إعادة فتح التصويت');
    };

    const resetCycle = async () => {
        if (!confirm('⚠️ تحذير: سيتم حذف الدورة والأصوات نهائياً!')) return;
        await supabase.from('eom_cycles').delete().eq('id', activeCycle!.id);
        setActiveCycle(null);
        setNomineesStats([]);
        setSelectedIds([]);
        toast.success('تم حذف الدورة');
    };

    const startNewCycleSameMonth = () => {
        if (!confirm('هل تريد بدء دورة جديدة إضافية لهذا الشهر؟')) return;
        setActiveCycle(null);
        setNomineesStats([]);
        setSelectedIds([]);
    };

    // جلب السجل التاريخي
    const fetchHistory = async () => {
        const { data: cycles } = await supabase.from('eom_cycles')
            .select('*, winner:employees(name)') // Join بسيط لجلب اسم الفائز
            .eq('status', 'completed')
            .order('month', { ascending: false });
        
        if (cycles) setHistoryCycles(cycles);
        setShowHistory(true);
    };

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) setSelectedIds(prev => prev.filter(i => i !== id));
        else {
            if (selectedIds.length >= 5) return toast.error('الحد الأقصى 5 مرشحين');
            setSelectedIds(prev => [...prev, id]);
        }
    };

    // --- واجهة العرض ---
    if (showHistory) {
        return (
            <div className="bg-white p-4 rounded-3xl border shadow-sm space-y-4 animate-in fade-in">
                <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="font-black text-gray-800 flex items-center gap-2 text-sm">
                        <History className="w-5 h-5 text-purple-500"/> الأرشيف
                    </h3>
                    <button onClick={() => setShowHistory(false)} className="p-1.5 hover:bg-gray-100 rounded-full"><X className="w-4 h-4"/></button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {historyCycles.map(c => (
                        <div key={c.id} className="flex justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs">
                            <span className="font-bold text-gray-600">{c.month}</span>
                            <span className="text-emerald-600 font-black flex items-center gap-1">
                                <Trophy className="w-3 h-3"/> {c.winner?.name || '---'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-4 rounded-3xl border shadow-sm space-y-5">
            {/* الهيدر */}
            <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-black text-gray-800 flex items-center gap-2 text-sm md:text-base">
                    <Trophy className="w-5 h-5 text-yellow-500"/> الموظف المثالي
                </h3>
                
                <div className="flex gap-1.5">
                    <button onClick={fetchHistory} className="p-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-colors" title="السجل">
                        <History className="w-4 h-4"/>
                    </button>
                    
                    {activeCycle ? (
                        <div className="flex gap-1.5 items-center">
                            {activeCycle.status === 'voting' ? (
                                <>
                                    <span className="hidden md:inline-block bg-green-100 text-green-700 px-2 py-1 rounded-lg text-[10px] font-bold animate-pulse">
                                        جاري التصويت
                                    </span>
                                    <button onClick={endVoting} className="bg-red-600 text-white px-3 py-1.5 rounded-xl font-bold hover:bg-red-700 text-xs flex items-center gap-1 shadow-md shadow-red-100">
                                        {loading ? <Loader2 className="w-3 h-3 animate-spin"/> : <StopCircle className="w-3 h-3"/>} إنهاء
                                    </button>
                                </>
                            ) : (
                                <div className="flex gap-1">
                                    <button onClick={undoEndVoting} className="p-2 bg-yellow-50 text-yellow-600 rounded-xl hover:bg-yellow-100" title="تراجع">
                                        <RotateCcw className="w-4 h-4"/>
                                    </button>
                                    <button onClick={startNewCycleSameMonth} className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100" title="دورة جديدة">
                                        <PlusCircle className="w-4 h-4"/>
                                    </button>
                                </div>
                            )}
                            <button onClick={resetCycle} className="p-2 bg-gray-100 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors" title="حذف">
                                <Trash2 className="w-4 h-4"/>
                            </button>
                        </div>
                    ) : (
                        <button onClick={startVoting} disabled={loading || selectedIds.length === 0} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 text-xs shadow-md shadow-emerald-100">
                            {loading ? <Loader2 className="w-3 h-3 animate-spin"/> : <Play className="w-3 h-3"/>} بدء
                        </button>
                    )}
                </div>
            </div>

            {/* المحتوى */}
            {activeCycle ? (
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <h4 className="font-bold text-gray-700 text-xs flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-gray-400"/>
                            {activeCycle.status === 'voting' ? 'النتائج الحية' : 'النتائج النهائية'}
                        </h4>
                        <span className="text-[10px] text-gray-400 font-bold">إجمالي: {totalVotes} صوت</span>
                    </div>
                    
                    <div className="space-y-3">
                        {nomineesStats.map((nom, idx) => {
                            const percentage = totalVotes > 0 ? Math.round((nom.vote_count / totalVotes) * 100) : 0;
                            const isWinner = activeCycle.status === 'completed' && idx === 0;
                            
                            return (
                                <div key={nom.nominee_id} className={`relative overflow-hidden rounded-2xl border p-3 transition-all ${isWinner ? 'bg-yellow-50 border-yellow-200 ring-1 ring-yellow-300' : 'bg-white border-gray-100'}`}>
                                    {/* شريط التقدم الخلفي */}
                                    <div className="absolute bottom-0 left-0 top-0 bg-gray-100/50 transition-all duration-1000 ease-out" style={{ width: `${percentage}%`, zIndex: 0 }} />
                                    
                                    <div className="relative z-10 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-white border flex items-center justify-center font-bold text-gray-500 shadow-sm overflow-hidden">
                                                {nom.employee_photo ? <img src={nom.employee_photo} className="w-full h-full object-cover"/> : (isWinner ? '🏆' : `#${idx + 1}`)}
                                            </div>
                                            <div>
                                                <h5 className="font-black text-gray-800 text-xs md:text-sm">{nom.employee_name}</h5>
                                                {isWinner && <span className="text-[9px] text-yellow-600 font-bold bg-yellow-100 px-1.5 py-0.5 rounded">الفائز باللقب</span>}
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <span className="block text-sm font-black text-indigo-600">{nom.vote_count}</span>
                                            <span className="text-[9px] text-gray-400 font-bold">{percentage}%</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {nomineesStats.length === 0 && <p className="text-center text-gray-400 text-xs py-4">لم يتم التصويت بعد</p>}
                    </div>
                </div>
            ) : (
                <>
                    <p className="text-gray-500 text-xs bg-blue-50 p-3 rounded-xl border border-blue-100 text-center leading-relaxed">
                        قم باختيار المرشحين من القائمة أدناه لبدء دورة تصويت جديدة لهذا الشهر.
                    </p>
                    <div className="grid gap-2 max-h-[350px] overflow-y-auto custom-scrollbar">
                        {employees.map((emp, idx) => (
                            <div key={emp.id} onClick={() => toggleSelect(emp.id)} className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${selectedIds.includes(emp.id) ? 'bg-yellow-50 border-yellow-400 ring-1 ring-yellow-200' : 'hover:bg-gray-50 border-gray-100'}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>#{idx + 1}</span>
                                    <div>
                                        <h4 className="font-bold text-gray-800 text-xs">{emp.name}</h4>
                                        <p className="text-[9px] text-gray-400">{emp.specialty}</p>
                                    </div>
                                </div>
                                <div className="text-left">
                                    <div className="text-xs font-black text-emerald-600">{emp.score}%</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
