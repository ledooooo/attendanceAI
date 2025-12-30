import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, EOMCycle } from '../../../types';
import { Trophy, Star, CheckCircle2, Loader2, Play } from 'lucide-react';

export default function EOMManager() {
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeCycle, setActiveCycle] = useState<EOMCycle | null>(null);

    // 1. جلب الموظفين مع تقييماتهم للشهر السابق
    const fetchCandidates = async () => {
        setLoading(true);
        // حساب الشهر السابق
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        const lastMonth = date.toISOString().slice(0, 7); // YYYY-MM

        // جلب الموظفين والتقييمات
        const { data: emps } = await supabase.from('employees').select('id, employee_id, name, specialty, photo_url');
        const { data: evals } = await supabase.from('evaluations').select('*').eq('month', lastMonth);

        if (emps && evals) {
            // دمج البيانات وحساب الترتيب
            const ranked = emps.map(emp => {
                const ev = evals.find(e => e.employee_id === emp.employee_id);
                return {
                    ...emp,
                    score: ev ? ev.total_score : 0,
                    attendance_score: ev ? ev.score_attendance : 0
                };
            }).sort((a, b) => b.score - a.score); // ترتيب تنازلي
            
            setEmployees(ranked);
        }
        
        // التحقق من وجود دورة حالية
        const currentMonth = new Date().toISOString().slice(0, 7);
        const { data: cycle } = await supabase.from('eom_cycles').select('*').eq('month', currentMonth).maybeSingle();
        if(cycle) setActiveCycle(cycle);

        setLoading(false);
    };

    useEffect(() => { fetchCandidates(); }, []);

    // بدء التصويت
    const startVoting = async () => {
        if (selectedIds.length < 2) return alert('يجب اختيار موظفين اثنين على الأقل');
        setLoading(true);

        const currentMonth = new Date().toISOString().slice(0, 7);
        
        // 1. إنشاء الدورة
        const { data: cycle, error } = await supabase.from('eom_cycles')
            .insert({ month: currentMonth, status: 'voting' })
            .select().single();

        if (error) { alert('خطأ في الإنشاء'); setLoading(false); return; }

        // 2. إضافة المرشحين
        const nomineesData = selectedIds.map(id => {
            const emp = employees.find(e => e.id === id);
            return { cycle_id: cycle.id, employee_id: emp.employee_id };
        });

        await supabase.from('eom_nominees').insert(nomineesData);

        // 3. نشر خبر تلقائي
        await supabase.from('news_posts').insert({
            title: '⭐ بدء التصويت للموظف المثالي ⭐',
            content: 'تم فتح باب التصويت لاختيار الموظف المثالي لهذا الشهر. شارك برأيك الآن من الصفحة الرئيسية!',
            is_pinned: true
        });

        alert('تم بدء التصويت بنجاح!');
        setActiveCycle(cycle);
        setLoading(false);
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
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                        التصويت جاري ({activeCycle.month})
                    </span>
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
        </div>
    );
}
