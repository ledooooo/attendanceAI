import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { EOMCycle } from '../../../types';
import { 
    Trophy, CheckCircle2, Loader2, Play, StopCircle, 
    Trash2, BarChart3, RotateCcw, History, PlusCircle, X 
} from 'lucide-react';

export default function EOMManager() {
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    
    // حالات الدورة الحالية
    const [activeCycle, setActiveCycle] = useState<EOMCycle | null>(null);
    const [nomineesStats, setNomineesStats] = useState<any[]>([]);
    const [totalVotes, setTotalVotes] = useState(0);

    // حالات السجل
    const [showHistory, setShowHistory] = useState(false);
    const [historyCycles, setHistoryCycles] = useState<any[]>([]);

    // 1. جلب بيانات المرشحين المحتملين (للشهر الماضي)
    const fetchCandidates = async () => {
        setLoading(true);
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        const lastMonth = date.toISOString().slice(0, 7); 

        // جلب الموظفين والتقييمات
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
        
        // البحث عن دورة نشطة لهذا الشهر
        const currentMonth = new Date().toISOString().slice(0, 7);
        const { data: cycle } = await supabase.from('eom_cycles')
            .select('*')
            .eq('month', currentMonth)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (cycle) {
            setActiveCycle(cycle);
        }

        setLoading(false);
    };

    // 🔥 دالة جلب الإحصائيات (تم تعديلها لتكون أكثر أماناً)
    const fetchCycleStats = async () => {
        if (!activeCycle) return;

        // أ) جلب المرشحين (الجدول الوسيط)
        const { data: noms } = await supabase.from('eom_nominees')
            .select('*')
            .eq('cycle_id', activeCycle.id);

        if (!noms || noms.length === 0) {
            setNomineesStats([]);
            return;
        }

        // ب) جلب بيانات الموظفين (الأسماء والصور) يدوياً
        // نستخرج قائمة الـ employee_id للمرشحين
        const empIds = noms.map(n => n.employee_id);
        const { data: empDetails } = await supabase.from('employees')
            .select('employee_id, name, photo_url')
            .in('employee_id', empIds);

        // ج) جلب الأصوات
        const { data: votes } = await supabase.from('eom_votes')
            .select('nominee_id')
            .eq('cycle_id', activeCycle.id);

        // د) الدمج والحساب
        if (empDetails && votes) {
            const stats = noms.map(nom => {
                const details = empDetails.find(e => e.employee_id === nom.employee_id);
                const count = votes.filter(v => v.nominee_id === nom.id).length;
                
                return {
                    id: nom.id, // معرف المرشح
                    employee_id: nom.employee_id, // معرف الموظف
                    name: details?.name || 'غير معروف',
                    photo_url: details?.photo_url,
                    votes: count
                };
            }).sort((a, b) => b.votes - a.votes);

            setNomineesStats(stats);
            setTotalVotes(votes.length);
        }
    };

    // جلب السجل التاريخي
    const fetchHistory = async () => {
        setLoading(true);
        // نستخدم طريقة آمنة أيضاً للسجل
        const { data: cycles } = await supabase.from('eom_cycles')
            .select('*')
            .eq('status', 'completed')
            .order('month', { ascending: false });
        
        if (cycles) {
            // جلب أسماء الفائزين
            const winnerIds = cycles.map(c => c.winner_id).filter(Boolean);
            const { data: winners } = await supabase.from('employees')
                .select('employee_id, name')
                .in('employee_id', winnerIds);

            const enrichedCycles = cycles.map(c => ({
                ...c,
                winner_name: winners?.find(w => w.employee_id === c.winner_id)?.name || 'غير معروف'
            }));
            
            setHistoryCycles(enrichedCycles);
        }
        setLoading(false);
        setShowHistory(true);
    };

    useEffect(() => { fetchCandidates(); }, []);

    // تحديث النتائج عند تغير الدورة أو عند التحميل
    useEffect(() => {
        if (activeCycle) {
            fetchCycleStats();

            // اشتراك Realtime لتحديث النتائج لحظياً عند تصويت أي شخص
            const channel = supabase.channel('eom_votes_watch')
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'eom_votes',
                    filter: `cycle_id=eq.${activeCycle.id}`
                }, () => {
                    fetchCycleStats(); // إعادة الجلب عند وجود تصويت جديد
                })
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        }
    }, [activeCycle?.id]); // الاعتماد على ID الدورة فقط

    // 2. بدء التصويت
    const startVoting = async () => {
        if (selectedIds.length < 2) return alert('يجب اختيار موظفين اثنين على الأقل');
        setLoading(true);

        const currentMonth = new Date().toISOString().slice(0, 7);
        
        const { data: cycle, error } = await supabase.from('eom_cycles')
            .insert({ month: currentMonth, status: 'voting' })
            .select().single();

        if (error) { 
            alert('خطأ في بدء الدورة'); 
            setLoading(false); 
            return; 
        }

        const nomineesData = selectedIds.map(id => {
            const emp = employees.find(e => e.id === id);
            return { cycle_id: cycle.id, employee_id: emp.employee_id };
        });

        await supabase.from('eom_nominees').insert(nomineesData);

        await supabase.from('news_posts').insert({
            title: '⭐ بدء سباق الموظف المثالي ⭐',
            content: 'تم فتح باب التصويت. شارك برأيك الآن لاختيار الأفضل لهذا الشهر!',
            is_pinned: true,
        });

        setActiveCycle(cycle);
        setLoading(false);
    };

    // 3. إنهاء التصويت
    const endVoting = async () => {
        if (!activeCycle || nomineesStats.length === 0) return;
        if (!confirm('هل أنت متأكد من إنهاء التصويت وإعلان النتائج؟')) return;

        setLoading(true);
        try {
            const winner = nomineesStats[0];
            const runnersUp = nomineesStats.slice(1).map(n => n.name).join('، ');

            await supabase.from('eom_cycles')
                .update({ status: 'completed', winner_id: winner.employee_id })
                .eq('id', activeCycle.id);

            const celebrationContent = `
🎉 **نبارك للزميل/ة ${winner.name}** 🎉
حصوله على لقب **الموظف المثالي** لهذا الشهر بعد منافسة قوية، حيث حصل على ${winner.votes} صوتاً.

كما نتوجه بالشكر والتقدير لجميع الزملاء المرشحين (${runnersUp}) على أدائهم المتميز.
            `.trim();

            await supabase.from('news_posts').insert({
                title: '🏆 إعلان نتائج الموظف المثالي 🏆',
                content: celebrationContent,
                is_pinned: true,
                image_url: 'https://cdn-icons-png.flaticon.com/512/744/744984.png',
            });

            alert(`تم إعلان الفائز: ${winner.name}`);
            setActiveCycle({ ...activeCycle, status: 'completed', winner_id: winner.employee_id });

        } catch (error: any) {
            alert('حدث خطأ: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // 4. تراجع عن الإنهاء
    const undoEndVoting = async () => {
        if (!activeCycle) return;
        if (!confirm('هل تريد إعادة فتح التصويت مرة أخرى؟')) return;

        setLoading(true);
        const { error } = await supabase.from('eom_cycles')
            .update({ status: 'voting', winner_id: null })
            .eq('id', activeCycle.id);

        if (!error) {
            setActiveCycle({ ...activeCycle, status: 'voting', winner_id: null });
            alert('تم إعادة فتح التصويت.');
        } else {
            alert('فشل التراجع');
        }
        setLoading(false);
    };

    // 5. حذف الدورة
    const resetCycle = async () => {
        if (!activeCycle) return;
        if (!confirm('⚠️ حذف نهائي: سيتم مسح الدورة والأصوات. هل أنت متأكد؟')) return;
        
        setLoading(true);
        const { error } = await supabase.from('eom_cycles').delete().eq('id', activeCycle.id);
        
        if (!error) {
            setActiveCycle(null);
            setSelectedIds([]);
            setNomineesStats([]);
            alert('تم حذف الدورة.');
        }
        setLoading(false);
    };

    // 6. دورة جديدة
    const startNewCycleSameMonth = () => {
        if (!confirm('هل تريد بدء دورة تصويت جديدة إضافية لهذا الشهر؟')) return;
        setActiveCycle(null);
        setSelectedIds([]);
        setNomineesStats([]);
    };

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) setSelectedIds(prev => prev.filter(i => i !== id));
        else {
            if (selectedIds.length >= 5) return alert('الحد الأقصى 5');
            setSelectedIds(prev => [...prev, id]);
        }
    };

    // واجهة السجل
    if (showHistory) {
        return (
            <div className="bg-white p-6 rounded-[30px] border shadow-sm space-y-4 animate-in fade-in">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                        <History className="w-6 h-6 text-purple-500"/> سجل الفائزين السابقين
                    </h3>
                    <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-gray-100 rounded-full">
                        <X className="w-5 h-5"/>
                    </button>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {historyCycles.length === 0 ? <p className="text-gray-400 text-center">لا يوجد سجلات</p> : 
                    historyCycles.map(cycle => (
                        <div key={cycle.id} className="flex justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <span className="font-bold text-gray-700">{cycle.month}</span>
                            <span className="text-emerald-600 font-black flex items-center gap-1">
                                <Trophy className="w-3 h-3"/> {cycle.winner_name}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-[30px] border shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-yellow-500"/> إدارة الموظف المثالي
                </h3>
                
                <div className="flex gap-2">
                    <button onClick={fetchHistory} className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100" title="السجل">
                        <History className="w-5 h-5"/>
                    </button>
                    
                    {activeCycle ? (
                        <div className="flex gap-2 items-center">
                            {activeCycle.status === 'voting' ? (
                                <>
                                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                                        جاري التصويت
                                    </span>
                                    <button onClick={endVoting} disabled={loading} className="bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-red-700 text-xs flex items-center gap-1 shadow-lg shadow-red-100">
                                        {loading ? <Loader2 className="w-3 h-3 animate-spin"/> : <StopCircle className="w-3 h-3"/>} إنهاء وإعلان
                                    </button>
                                </>
                            ) : (
                                <div className="flex gap-1">
                                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                                        <CheckCircle2 className="w-3 h-3"/> مكتمل
                                    </span>
                                    <button onClick={undoEndVoting} className="p-2 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100" title="تراجع عن الإنهاء">
                                        <RotateCcw className="w-4 h-4"/>
                                    </button>
                                    <button onClick={startNewCycleSameMonth} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100" title="دورة جديدة">
                                        <PlusCircle className="w-4 h-4"/>
                                    </button>
                                </div>
                            )}
                            <button onClick={resetCycle} className="p-2 bg-gray-100 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-600" title="حذف الدورة">
                                <Trash2 className="w-4 h-4"/>
                            </button>
                        </div>
                    ) : (
                        <button onClick={startVoting} disabled={loading || selectedIds.length === 0} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-100">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4"/>} بدء التصويت
                        </button>
                    )}
                </div>
            </div>

            {/* عرض المحتوى حسب الحالة */}
            {activeCycle ? (
                <div className="space-y-4">
                    <h4 className="font-bold text-gray-700 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-gray-400"/>
                        {activeCycle.status === 'voting' ? 'نتائج التصويت الحالية (مباشر)' : 'النتائج النهائية'}
                    </h4>
                    
                    {nomineesStats.length === 0 ? (
                         <div className="text-center py-6 text-gray-400">لا توجد بيانات (أو لم يتم التصويت بعد)</div>
                    ) : (
                        <div className="space-y-3">
                            {nomineesStats.map((nom, idx) => {
                                const percentage = totalVotes > 0 ? Math.round((nom.votes / totalVotes) * 100) : 0;
                                const isWinner = activeCycle.status === 'completed' && idx === 0;
                                
                                return (
                                    <div key={nom.id} className={`relative overflow-hidden rounded-2xl border p-3 ${isWinner ? 'bg-yellow-50 border-yellow-200 ring-1 ring-yellow-300' : 'bg-white border-gray-100'}`}>
                                        <div className="absolute bottom-0 left-0 top-0 bg-gray-100/50 transition-all duration-1000" style={{ width: `${percentage}%`, zIndex: 0 }} />
                                        
                                        <div className="relative z-10 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-white border flex items-center justify-center font-bold text-gray-500 shadow-sm overflow-hidden">
                                                    {nom.photo_url ? <img src={nom.photo_url} className="w-full h-full object-cover"/> : (isWinner ? '🏆' : `#${idx + 1}`)}
                                                </div>
                                                <div>
                                                    <h5 className="font-black text-gray-800 text-sm">{nom.name}</h5>
                                                    {isWinner && <span className="text-[10px] text-yellow-600 font-bold">الفائز باللقب</span>}
                                                </div>
                                            </div>
                                            <div className="text-left">
                                                <span className="block text-lg font-black text-indigo-600">{nom.votes}</span>
                                                <span className="text-[10px] text-gray-400 font-bold">{percentage}%</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
                <>
                    <p className="text-gray-500 text-sm bg-blue-50 p-3 rounded-xl border border-blue-100 text-center">
                        اختر المرشحين من قائمة الأفضل أداءً للشهر الماضي لبدء التصويت
                    </p>
                    <div className="grid gap-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {employees.map((emp, idx) => (
                            <div key={emp.id} onClick={() => toggleSelect(emp.id)} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${selectedIds.includes(emp.id) ? 'bg-yellow-50 border-yellow-400 ring-1' : 'hover:bg-gray-50'}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>#{idx + 1}</span>
                                    <div><h4 className="font-bold text-gray-800 text-sm">{emp.name}</h4><p className="text-xs text-gray-400">{emp.specialty}</p></div>
                                </div>
                                <div className="text-left"><div className="text-sm font-black text-emerald-600">{emp.score}%</div><div className="text-[10px] text-gray-400">أداء</div></div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
