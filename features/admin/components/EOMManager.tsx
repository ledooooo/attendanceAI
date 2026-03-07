import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { EOMCycle } from '../../../types';
import toast from 'react-hot-toast';
import { 
    Trophy, CheckCircle2, Loader2, Play, StopCircle, 
    Trash2, BarChart3, RotateCcw, History, PlusCircle, X 
} from 'lucide-react';
// 1. ✅ استيراد الخطافات من React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function EOMManager() {
    const queryClient = useQueryClient(); // للتحكم في الكاش
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    // ----------------------------------------------------------------
    // 1. 📥 القراءات (Queries)
    // ----------------------------------------------------------------

    // أ) جلب المرشحين (الموظفين + التقييمات)
    const { data: employees = [], isLoading: loadingCandidates } = useQuery({
        queryKey: ['eom_candidates'],
        queryFn: async () => {
            const date = new Date();
            date.setMonth(date.getMonth() - 1);
            const lastMonth = date.toISOString().slice(0, 7); 

            const { data: emps } = await supabase.from('employees').select('id, employee_id, name, specialty, photo_url');
            const { data: evals } = await supabase.from('evaluations').select('*').eq('month', lastMonth);

            if (emps && evals) {
                return emps.map(emp => {
                    const ev = evals.find(e => e.employee_id === emp.employee_id);
                    return {
                        ...emp,
                        score: ev ? ev.total_score : 0,
                    };
                }).sort((a, b) => b.score - a.score);
            }
            return [];
        },
        staleTime: 1000 * 60 * 10, // البيانات صالحة لمدة 10 دقائق
    });

    // ب) جلب الدورة النشطة الحالية
    const { data: activeCycle } = useQuery({
        queryKey: ['eom_active_cycle'],
        queryFn: async () => {
            const currentMonth = new Date().toISOString().slice(0, 7);
            const { data } = await supabase.from('eom_cycles')
                .select('*')
                .eq('month', currentMonth)
                .order('created_at', { ascending: false })
                .maybeSingle();
            return data as EOMCycle | null;
        }
    });

    // ج) جلب إحصائيات الدورة (يعتمد على ID الدورة النشطة)
    const { data: nomineesStats = [] } = useQuery({
        queryKey: ['eom_stats', activeCycle?.id],
        queryFn: async () => {
            if (!activeCycle?.id) return [];
            const { data, error } = await supabase
                .from('eom_vote_results') // View
                .select('*')
                .eq('cycle_id', activeCycle.id)
                .order('vote_count', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!activeCycle?.id, // لا يعمل إلا بوجود دورة
        refetchInterval: 10000, // تحديث كل 10 ثواني (احتياطي)
    });

    // د) جلب السجل (الأرشيف)
    const { data: historyCycles = [] } = useQuery({
        queryKey: ['eom_history'],
        queryFn: async () => {
            const { data } = await supabase.from('eom_cycles')
                .select('*, winner:employees(name)')
                .eq('status', 'completed')
                .order('month', { ascending: false });
            return data || [];
        },
        enabled: showHistory // لا يتم الجلب إلا عند فتح النافذة
    });

    // حساب إجمالي الأصوات (Computed)
    const totalVotes = nomineesStats.reduce((sum: number, item: any) => sum + (item.vote_count || 0), 0);

    // ----------------------------------------------------------------
    // 3. 🛠️ العمليات (Mutations)
    // ----------------------------------------------------------------

    // أ) بدء التصويت
    const startVotingMutation = useMutation({
        mutationFn: async () => {
            if (selectedIds.length < 2) throw new Error('اختر موظفين اثنين على الأقل');
            
            const currentMonth = new Date().toISOString().slice(0, 7);
            const { data: cycle, error } = await supabase.from('eom_cycles')
                .insert({ month: currentMonth, status: 'voting' })
                .select().single();
            
            if (error) throw error;

            const nomineesData = selectedIds.map(id => {
                const emp = employees.find((e: any) => e.id === id);
                return { cycle_id: cycle.id, employee_id: emp.employee_id };
            });

            await supabase.from('eom_nominees').insert(nomineesData);
            await supabase.from('news_posts').insert({
                title: '⭐ انطلاق سباق الموظف المثالي',
                content: 'تم فتح باب التصويت لاختيار الموظف المثالي لهذا الشهر. صوتك يفرق!',
                is_pinned: true,
            });
            return cycle;
        },
        onSuccess: () => {
            toast.success('تم بدء التصويت بنجاح!');
            queryClient.invalidateQueries({ queryKey: ['eom_active_cycle'] }); // تحديث الواجهة
            setSelectedIds([]);
        },
        onError: (err: any) => toast.error(err.message || 'فشل البدء')
    });

    // ب) إنهاء التصويت
    const endVotingMutation = useMutation({
        mutationFn: async () => {
            if (!activeCycle || nomineesStats.length === 0) return;
            const winner = nomineesStats[0];
            
            await supabase.from('eom_cycles')
                .update({ status: 'completed', winner_id: winner.employee_id })
                .eq('id', activeCycle.id);

            await supabase.from('news_posts').insert({
                title: `🏆 الموظف المثالي: ${winner.employee_name}`,
                content: `نبارك للزميل/ة **${winner.employee_name}** الفوز بلقب الموظف المثالي لهذا الشهر بعدد أصوات (${winner.vote_count}). \nنتمنى له وللجميع دوام التوفيق! 🎉`,
                is_pinned: true,
                image_url: 'https://cdn-icons-png.flaticon.com/512/744/744984.png',
            });
            return winner;
        },
        onSuccess: (winner) => {
            toast.success(`الفائز هو: ${winner.employee_name}`);
            queryClient.invalidateQueries({ queryKey: ['eom_active_cycle'] });
            queryClient.invalidateQueries({ queryKey: ['eom_history'] }); // تحديث السجل
        },
        onError: () => toast.error('حدث خطأ أثناء الإنهاء')
    });

    // ج) العمليات الإدارية (حذف، تراجع)
    const manageCycleMutation = useMutation({
        mutationFn: async ({ action }: { action: 'delete' | 'undo' | 'new' }) => {
            if (!activeCycle && action !== 'new') return;

            if (action === 'delete') {
                await supabase.from('eom_cycles').delete().eq('id', activeCycle!.id);
            } else if (action === 'undo') {
                await supabase.from('eom_cycles').update({ status: 'voting', winner_id: null }).eq('id', activeCycle!.id);
            }
            // 'new' doesn't need API call here, just state reset, but we handle logic below
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['eom_active_cycle'] });
            queryClient.invalidateQueries({ queryKey: ['eom_stats'] });
            if (variables.action === 'delete') {
                toast.success('تم حذف الدورة');
                setNomineesStats([]);
                setSelectedIds([]);
            } else if (variables.action === 'undo') {
                toast.success('تم إعادة فتح التصويت');
            }
        }
    });

    // دوال المساعدة للأزرار
    const handleStart = () => toast.promise(startVotingMutation.mutateAsync(), {
        loading: 'جاري بدء الدورة...',
        success: 'تم!',
        error: 'خطأ'
    });

    const handleEnd = () => {
        if (confirm('إنهاء التصويت وإعلان الفائز؟')) {
            toast.promise(endVotingMutation.mutateAsync(), {
                loading: 'جاري إعلان النتيجة...',
                success: 'مبروك للفائز!',
                error: 'خطأ'
            });
        }
    };

    const handleReset = () => {
        if (confirm('⚠️ حذف نهائي؟')) manageCycleMutation.mutate({ action: 'delete' });
    };

    const handleUndo = () => {
        if (confirm('إعادة فتح التصويت؟')) manageCycleMutation.mutate({ action: 'undo' });
    };

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) setSelectedIds(prev => prev.filter(i => i !== id));
        else {
            if (selectedIds.length >= 5) return toast.error('الحد الأقصى 5 مرشحين');
            setSelectedIds(prev => [...prev, id]);
        }
    };

    // --- واجهة العرض (Render) ---
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
                    {historyCycles.length === 0 ? <p className="text-center text-gray-400 text-xs">لا يوجد سجلات</p> : 
                    historyCycles.map((c: any) => (
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
                    <button onClick={() => setShowHistory(true)} className="p-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-colors" title="السجل">
                        <History className="w-4 h-4"/>
                    </button>
                    
                    {activeCycle ? (
                        <div className="flex gap-1.5 items-center">
                            {activeCycle.status === 'voting' ? (
                                <>
                                    <span className="hidden md:inline-block bg-green-100 text-green-700 px-2 py-1 rounded-lg text-[10px] font-bold animate-pulse">
                                        جاري التصويت
                                    </span>
                                    <button onClick={handleEnd} disabled={endVotingMutation.isPending} className="bg-red-600 text-white px-3 py-1.5 rounded-xl font-bold hover:bg-red-700 text-xs flex items-center gap-1 shadow-md shadow-red-100">
                                        {endVotingMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin"/> : <StopCircle className="w-3 h-3"/>} إنهاء
                                    </button>
                                </>
                            ) : (
                                <div className="flex gap-1">
                                    <button onClick={handleUndo} className="p-2 bg-yellow-50 text-yellow-600 rounded-xl hover:bg-yellow-100" title="تراجع">
                                        <RotateCcw className="w-4 h-4"/>
                                    </button>
                                    <button onClick={() => { if(confirm('بدء دورة جديدة؟')) { queryClient.setQueryData(['eom_active_cycle'], null); setSelectedIds([]); } }} className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100" title="دورة جديدة">
                                        <PlusCircle className="w-4 h-4"/>
                                    </button>
                                </div>
                            )}
                            <button onClick={handleReset} className="p-2 bg-gray-100 text-gray-400 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors" title="حذف">
                                <Trash2 className="w-4 h-4"/>
                            </button>
                        </div>
                    ) : (
                        <button onClick={handleStart} disabled={startVotingMutation.isPending || selectedIds.length === 0} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 text-xs shadow-md shadow-emerald-100">
                            {startVotingMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin"/> : <Play className="w-3 h-3"/>} بدء
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
                        {nomineesStats.map((nom: any, idx: number) => {
                            const percentage = totalVotes > 0 ? Math.round((nom.vote_count / totalVotes) * 100) : 0;
                            const isWinner = activeCycle.status === 'completed' && idx === 0;
                            
                            return (
                                <div key={nom.nominee_id} className={`relative overflow-hidden rounded-2xl border p-3 transition-all ${isWinner ? 'bg-yellow-50 border-yellow-200 ring-1 ring-yellow-300' : 'bg-white border-gray-100'}`}>
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
                        {loadingCandidates ? <div className="text-center p-4"><Loader2 className="animate-spin mx-auto text-emerald-500"/></div> : 
                        employees.map((emp: any, idx: number) => (
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
